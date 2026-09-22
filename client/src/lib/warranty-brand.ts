/**
 * Brand routing for warranty verification links.
 *
 * A warranty's brand is derived from its product name — there is no brand column on
 * sold_units, so the product name is the only available signal.
 *
 * NOTE: this is the third copy of STEK_PRODUCTS. Keep it in sync with P91Elite's
 * `artifacts/api-server/src/services/verify-url.ts` (server: PDF + email) and
 * `artifacts/p91-erp/src/lib/brand.ts` (its web client). If a STEK line is added
 * there and not here, the QR on our card points at the wrong verify site.
 */

/** Product names that are STEK-branded, normalized (trimmed, lowercased). */
const STEK_PRODUCTS = new Set<string>([
  'f-clear',
]);

export const P91_VERIFY_BASE = 'https://p91india.com/verify';
export const STEK_VERIFY_BASE = 'https://stek-india.in/verify';

function normalizeProductName(productName: string | null | undefined): string {
  return (productName ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isStekProduct(productName: string | null | undefined): boolean {
  return STEK_PRODUCTS.has(normalizeProductName(productName));
}

/** Full public verify URL for a warranty code — what the QR encodes. */
export function buildVerifyUrl(
  productName: string | null | undefined,
  warrantyCode: string,
): string {
  const base = isStekProduct(productName) ? STEK_VERIFY_BASE : P91_VERIFY_BASE;
  return `${base}/${warrantyCode}`;
}

/** Host shown as the caption under the QR, e.g. "p91india.com/verify". */
export function verifyCaptionFor(productName: string | null | undefined): string {
  return isStekProduct(productName) ? 'stek-india.in/verify' : 'p91india.com/verify';
}
