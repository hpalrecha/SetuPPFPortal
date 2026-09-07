// Single source of truth for "this session is gone".
//
// VAS mints JWTs with `expiresIn: '7d'` (server/auth.ts) and has no refresh
// mechanism, so every session eventually dies mid-use. Queries are cached with
// `staleTime: Infinity` and `refetchOnWindowFocus: false`, so a tab left open
// past expiry keeps rendering job cards from cache and the dead session only
// surfaces on the next write — historically as a raw
// `401: {"error":"Invalid token"}` toast on whatever the installer clicked
// (usually a photo upload), with no hint that the fix is to sign in again.
//
// Auth is hand-rolled at ~154 `fetch()` call sites across the client, each with
// its own `Authorization` header and its own error handling, so fixing this per
// call site is not realistic. `installSessionGuards()` instead installs one
// global check, in two layers:
//   1. reactive  — a window.fetch wrapper that catches any 401 from our own API;
//   2. proactive — an expiry check on load and on tab focus, so an installer is
//      sent to the login page BEFORE filling in a job-completion form rather
//      than after, when submitting would throw the work away.

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// A 401 from our API always means the session is gone: `authenticate`
// (server/middleware.ts) rejects a missing/expired/badly-signed token, and the
// only other 401s a browser can reach mean the same thing ("User not found or
// inactive" on /api/auth/me, "Unauthenticated" on the e-warranty route). The
// single exception is the login route, where 401 is "Invalid credentials" and
// must stay an ordinary form error rather than bouncing the user off the page
// they are typing into.
const AUTH_EXEMPT_PATHS = ['/api/auth/login'];

// Tolerance for a client clock running ahead of the server's, so a skewed
// device does not sign itself out while its token is still genuinely valid.
// A clock running behind is harmless — layer 1 catches the 401 instead.
const CLOCK_SKEW_GRACE_MS = 60_000;

/**
 * True when `url` targets our own API on a route where 401 can only mean the
 * session died. Deliberately false for cross-origin requests: the
 * pre-installation flow PUTs directly to a presigned S3 URL, and S3's own auth
 * failures must not be mistaken for our session expiring.
 */
export function isOwnApiRequest(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return false;
    if (!parsed.pathname.startsWith('/api/')) return false;
    return !AUTH_EXEMPT_PATHS.includes(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Mirrors AuthService.logout()'s storage cleanup. Inlined rather than imported
 * because lib/auth.ts imports lib/queryClient.ts, which imports this module —
 * importing back would close the cycle.
 */
export function clearStoredSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('notifications_read');
    Object.keys(localStorage)
      .filter((k) => k.startsWith('selected_oem_id_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage unavailable — the redirect below still gets the user to /login.
  }
}

// Guards against a burst of parallel 401s each kicking off its own navigation.
let redirectingToLogin = false;

/** Drop the dead session and send the user somewhere they can fix it. */
export function handleSessionExpired(): void {
  clearStoredSession();
  if (redirectingToLogin || window.location.pathname === '/login') return;
  redirectingToLogin = true;
  window.location.href = '/login';
}

/** `exp` (ms since epoch) from the stored JWT, or null if absent/unreadable. */
export function storedTokenExpiry(): number | null {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
  if (!token) return null;

  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    // base64url → base64, then pad to a multiple of 4 for atob().
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
    return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    // Not a JWT we can read — let the server be the judge (layer 1).
    return null;
  }
}

/**
 * True only when we can positively prove the stored token is past its `exp`.
 * An absent or unreadable token returns false so that route guards and the
 * server keep their existing say over what happens.
 */
export function isStoredTokenExpired(): boolean {
  const expiresAt = storedTokenExpiry();
  if (expiresAt === null) return false;
  return expiresAt < Date.now() - CLOCK_SKEW_GRACE_MS;
}

// Renew a token that still has less than this long to run. Tokens last 7 days,
// so anyone who opens VAS at least once every few days is never logged out
// mid-job; someone who stays away past expiry still has to sign in again.
const REFRESH_WHEN_REMAINING_MS = 3 * 24 * 60 * 60 * 1000;

// Floor between renewal attempts, so alt-tabbing repeatedly cannot spam the API.
const REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;

let lastRefreshAttempt = 0;

/**
 * Extend a still-valid session in the background (POST /api/auth/refresh).
 *
 * Deliberately silent on every failure. A 401 here is already handled by the
 * fetch guard, and any other outcome — a 404 from a server that predates the
 * refresh route, a flaky connection, an installer on bad signal at a customer
 * site — must leave the existing session exactly as it was. Renewal is an
 * improvement on top of the guards, never a new way to get logged out.
 */
async function maybeRefreshSession(): Promise<void> {
  const expiresAt = storedTokenExpiry();
  if (expiresAt === null) return;

  const remaining = expiresAt - Date.now();
  if (remaining <= 0 || remaining > REFRESH_WHEN_REMAINING_MS) return;

  const now = Date.now();
  if (now - lastRefreshAttempt < REFRESH_MIN_INTERVAL_MS) return;
  lastRefreshAttempt = now;

  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) return;

    const data = await res.json();
    if (typeof data?.token !== 'string') return;

    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  } catch {
    // Keep the current session; the guards still cover real expiry.
  }
}

let guardsInstalled = false;

/**
 * Install both layers. Idempotent, so a Vite HMR reload cannot stack wrappers.
 * Call once from the app entry point, before React renders.
 */
export function installSessionGuards(): void {
  if (guardsInstalled || typeof window === 'undefined') return;
  guardsInstalled = true;

  // Layer 1 — catch every 401 from our API, whichever of the ~154 call sites
  // (or the two rival apiRequest helpers) issued it. The response is returned
  // untouched and unread, so each caller's own error handling still runs
  // exactly as before; the navigation simply outlives it.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await originalFetch(input, init);
    if (res.status === 401) {
      const url =
        typeof input === 'string' ? input
        : input instanceof URL ? input.href
        : input.url;
      if (isOwnApiRequest(url)) handleSessionExpired();
    }
    return res;
  };

  // Layer 2 — a tab reopened after the token expired should ask for a login
  // straight away, not let someone fill in a whole completion form first.
  // Layer 3 — and if it has not expired yet but is getting close, quietly renew
  // it, so an installer working through the day never reaches expiry at all.
  const checkSession = () => {
    if (isStoredTokenExpired()) {
      handleSessionExpired();
      return;
    }
    void maybeRefreshSession();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkSession();
  });
  window.addEventListener('focus', checkSession);
  checkSession();
}
