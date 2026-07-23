import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

// SSO landing: consumes a VAS JWT handed off by Pulse in the URL fragment
// (#sso_token=...), stores it EXACTLY the way a normal login does
// (localStorage auth_token + auth_user), clears the fragment, then lands on the
// dashboard already authenticated. The token is a valid VAS-minted JWT, so the
// VAS backend accepts it as `Authorization: Bearer` with no new validation.
// safeRedirect only permits same-origin paths (must start with a single "/")
// to avoid an open-redirect, while PRESERVING any query string
// (e.g. "/work-orders?embed=1"). Anything else falls back to /dashboard.
function safeRedirect(raw: string | null): string {
  if (!raw) return '/dashboard';
  let dec = raw;
  try { dec = decodeURIComponent(raw); } catch { /* use raw */ }
  // Browsers normalize "\" to "/", so validate against a backslash-normalized
  // copy to stop "/\evil.com" (→ "//evil.com") from sneaking through. Reject
  // protocol-relative ("//host") and absolute ("http(s)://…") URLs.
  const norm = dec.replace(/\\/g, '/');
  if (!norm.startsWith('/') || norm.startsWith('//')) return '/dashboard';
  // Same-origin path (with its optional ?query) — safe to use verbatim.
  return dec;
}

export default function SSOPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(rawHash);
      const token = params.get('sso_token');
      const redirect = safeRedirect(params.get('redirect'));

      // Already-authenticated fast path: when a valid token is present and we
      // have a redirect target, just navigate — no need to re-mint/re-load.
      const existing = localStorage.getItem('auth_token');
      if (!token && existing) {
        window.location.replace(redirect);
        return;
      }

      if (!token) {
        window.location.replace('/login');
        return;
      }

      // Store the token the same way AuthService.login does so the auth context
      // and the api client (Bearer header) both pick it up.
      localStorage.setItem('auth_token', token);
      // Strip the token from the URL/history immediately.
      window.history.replaceState(null, '', '/sso');

      try {
        // Same call a normal session makes; also populates auth_user.
        const res = await apiRequest('GET', '/api/auth/me');
        const data = await res.json();
        localStorage.setItem('auth_user', JSON.stringify(data.user ?? data));
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setError('Sign-in link is invalid or expired.');
        window.location.replace('/login');
        return;
      }

      // Full navigation so AuthProvider bootstraps from the stored session,
      // landing on the requested VAS route (default /dashboard).
      window.location.replace(redirect);
    })();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <p>{error ?? 'Signing you in…'}</p>
    </div>
  );
}
