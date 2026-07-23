// Embedded mode: VAS is rendered inside an <iframe> by the Pulse app. Pulse
// deep-links to a VAS route with `?embed=1`; we then hide VAS's own chrome
// (sidebar/icon-rail + top header/logo) so only the page content shows next to
// Pulse's own sidebar.
//
// The flag is persisted in sessionStorage so it survives client-side navigation
// within the iframe (a wouter route change drops the query string, but embed
// mode must stick for the whole session).
const EMBED_KEY = 'vas_embed';

export function isEmbedded(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location.search).get('embed');
    if (q === '1') {
      sessionStorage.setItem(EMBED_KEY, '1');
      return true;
    }
    if (q === '0') {
      // Explicit opt-out (e.g. the super-admin console needs VAS's own nav).
      // Clear any stale flag so the full chrome is guaranteed to render.
      sessionStorage.removeItem(EMBED_KEY);
      return false;
    }
    return sessionStorage.getItem(EMBED_KEY) === '1';
  } catch {
    return false;
  }
}
