// Guards the failure modes that all used to surface as one confusing
// "Upload Failed" toast:
//   B  expired VAS JWT     -> clean logout + redirect, never a raw 401 blob
//   C  S3/AWS failure      -> upload error only, MUST NOT log the installer out
//      bad login password  -> form error only, MUST NOT log the user out
//      everything else     -> passes through untouched
// Plus layer 3, the silent renewal that stops sessions reaching expiry at all.
//
// Each test gets a FRESH module instance: handleSessionExpired() latches after
// the first redirect (so a burst of parallel 401s navigates once), and in the
// browser that latch is cleared by the page load the redirect itself causes.
// Re-importing per test reproduces that clean-page-load state.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const DAY = 24 * 60 * 60 * 1000;

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const jwtExpiringIn = (ms: number) =>
  ['h', b64url({ id: 'u1', role: 'DETAILING_PARTNER', exp: Math.floor((Date.now() + ms) / 1000) }), 'sig'].join('.');

let instance = 0;

/** A clean browser-ish page with a freshly installed guard. */
async function freshPage(opts: { token?: string; pathname?: string; reply?: { status: number; body?: unknown } } = {}) {
  const store = new Map<string, string>();
  store.set('auth_token', opts.token ?? jwtExpiringIn(7 * DAY));
  store.set('auth_user', '{"id":"u1"}');

  const state = {
    store,
    navigatedTo: null as string | null,
    calls: [] as string[],
    // Staged before installSessionGuards() runs, because renewal fires on install.
    reply: opts.reply ?? { status: 200, body: undefined as unknown },
  };

  const raw = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  // Object.keys(localStorage) must enumerate stored keys, as it does in a browser.
  (globalThis as any).localStorage = new Proxy(raw, {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  (globalThis as any).document = { visibilityState: 'visible', addEventListener() {} };

  // In a browser `window === globalThis`, so replacing window.fetch replaces the
  // bare `fetch` that application code calls. The stub must mirror that or the
  // guard looks installed while real calls sail past it.
  const g = globalThis as any;
  g.window = g;
  g.location = {
    origin: 'https://www.pulsevas.p91india.com',
    pathname: opts.pathname ?? '/job-cards',
    get href() { return state.navigatedTo; },
    set href(v: string) { state.navigatedTo = v; },
  };
  g.addEventListener = () => {};
  g.fetch = async (input: any) => {
    state.calls.push(typeof input === 'string' ? input : input.url);
    return {
      status: state.reply.status,
      ok: state.reply.status >= 200 && state.reply.status < 300,
      json: async () => state.reply.body,
    } as any;
  };

  // Cache-busting specifier => a module instance with its own redirect latch.
  const session = await import('../client/src/lib/session.js?i=' + instance++);
  session.installSessionGuards();
  // Augment rather than spread: callers must see live `navigatedTo`/`calls`,
  // and reassigning `reply` must be visible to the fetch stub above.
  return Object.assign(state, { session, fetch: (globalThis as any).fetch });
}

const settle = () => new Promise((r) => setImmediate(r));

test('B: expired VAS session clears storage and redirects to /login', async () => {
  const p = await freshPage();
  p.reply.status = 401;
  const res = await p.fetch('/api/objects/upload-file');
  assert.equal(p.navigatedTo, '/login');
  assert.equal(p.store.has('auth_token'), false);
  assert.equal(p.store.has('auth_user'), false);
  assert.equal(res.status, 401, 'response must still reach the caller unchanged');
});

test('B: per-user keys are cleared, unrelated prefs are kept', async () => {
  const p = await freshPage();
  p.store.set('selected_oem_id_u1', 'oem-9');
  p.store.set('notifications_read', '[]');
  p.store.set('theme', 'dark');
  p.reply.status = 401;
  await p.fetch('/api/job-cards');
  assert.deepEqual([...p.store.keys()], ['theme']);
});

test('C: an S3 failure must NOT log the installer out', async () => {
  for (const status of [401, 403, 500]) {
    const p = await freshPage();
    p.reply.status = status;
    await p.fetch('https://p91-brochures.s3.ap-south-1.amazonaws.com/setuppf-uploads/x?X-Amz-Signature=a');
    assert.equal(p.navigatedTo, null, 'S3 ' + status + ' must not redirect');
    assert.equal(p.store.has('auth_token'), true, 'S3 ' + status + ' must not clear the session');
  }
});

test('a wrong password must NOT log the user out', async () => {
  const p = await freshPage();
  p.reply.status = 401;
  await p.fetch('/api/auth/login');
  assert.equal(p.navigatedTo, null);
  assert.equal(p.store.has('auth_token'), true);
});

test('non-401 responses pass through untouched', async () => {
  for (const status of [200, 400, 403, 404, 500]) {
    const p = await freshPage();
    p.reply.status = status;
    const res = await p.fetch('/api/job-cards');
    assert.equal(res.status, status);
    assert.equal(p.navigatedTo, null, 'status ' + status + ' must not redirect');
  }
});

test('a burst of parallel 401s navigates exactly once', async () => {
  const p = await freshPage();
  p.reply.status = 401;
  await Promise.all([
    p.fetch('/api/job-cards'),
    p.fetch('/api/objects/upload-file'),
    p.fetch('/api/partners'),
  ]);
  assert.equal(p.navigatedTo, '/login');
});

test('no redirect loop: a 401 while already on /login does not navigate', async () => {
  const p = await freshPage({ pathname: '/login' });
  p.reply.status = 401;
  await p.fetch('/api/job-cards');
  assert.equal(p.navigatedTo, null);
});

test('expiry detection respects clock skew and unreadable tokens', async () => {
  const p = await freshPage();
  p.store.set('auth_token', jwtExpiringIn(DAY));
  assert.equal(p.session.isStoredTokenExpired(), false);
  p.store.set('auth_token', jwtExpiringIn(-60 * 60 * 1000));
  assert.equal(p.session.isStoredTokenExpired(), true);
  p.store.set('auth_token', jwtExpiringIn(-5000));
  assert.equal(p.session.isStoredTokenExpired(), false, 'inside the clock-skew grace');
  p.store.set('auth_token', 'not-a-jwt');
  assert.equal(p.session.isStoredTokenExpired(), false, 'defer to the server');
  p.store.delete('auth_token');
  assert.equal(p.session.isStoredTokenExpired(), false);
});

test('only same-origin VAS API paths count as session traffic', async () => {
  const { session } = await freshPage();
  assert.equal(session.isOwnApiRequest('/api/objects/upload-file'), true);
  assert.equal(session.isOwnApiRequest('/api/objects/upload'), true);
  assert.equal(session.isOwnApiRequest('https://www.pulsevas.p91india.com/api/partners'), true);
  assert.equal(session.isOwnApiRequest('/api/auth/login'), false);
  assert.equal(session.isOwnApiRequest('https://p91-brochures.s3.amazonaws.com/x'), false);
  assert.equal(session.isOwnApiRequest('/objects/photo.jpg'), false);
  assert.equal(session.isOwnApiRequest('::::'), false);
});

// ---- Layer 3: silent renewal, so a working session never reaches expiry ----

test('a token near expiry is renewed and the new one stored', async () => {
  const renewed = jwtExpiringIn(7 * DAY);
  const p = await freshPage({
    token: jwtExpiringIn(2 * DAY),
    reply: { status: 200, body: { token: renewed, user: { id: 'u1', name: 'Installer' } } },
  });
  await settle();
  assert.ok(
    p.calls.includes('/api/auth/refresh'),
    'expected a refresh call, saw ' + JSON.stringify(p.calls)
  );
  assert.equal(p.store.get('auth_token'), renewed);
});

test('a token with plenty of life left is NOT renewed', async () => {
  const p = await freshPage({ token: jwtExpiringIn(6 * DAY) });
  await settle();
  assert.deepEqual(p.calls, [], 'no refresh traffic for a healthy session');
});

test('a failed renewal never logs anyone out', async () => {
  for (const status of [404, 500]) {
    const original = jwtExpiringIn(2 * DAY);
    const p = await freshPage({ token: original, reply: { status, body: undefined } });
    await settle();
    assert.equal(p.navigatedTo, null, 'refresh ' + status + ' must not redirect');
    assert.equal(p.store.get('auth_token'), original, 'refresh ' + status + ' must keep the session');
  }
});

test('an already-expired token is logged out, not renewed', async () => {
  const p = await freshPage({ token: jwtExpiringIn(-DAY) });
  await settle();
  assert.equal(p.navigatedTo, '/login');
  assert.deepEqual(p.calls, [], 'must not try to renew a dead token');
});
