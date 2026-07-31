// Synthetic (placeholder) customer contact details for work orders where the
// customer did not provide a phone / email. ERPNext + Pulse require both fields,
// so the backend stores an identifiable, collision-proof stand-in — but the UI
// (and PDFs / exports / emails) must display it as "N/A", never the fake value.
//
//   Phone (10 digits): "1111" + 6-digit zero-padded sequence  (1111000001 …)
//     • Starts with 1 → never a real Indian mobile (those start 6–9), so it can
//       never collide with a genuine number, and survives being stored as a
//       number (1,111,000,001 …). Detect via isPlaceholderPhone().
//   Email: "<phone-digits>@noreply.plus91inc.in"  (non-deliverable, identifiable)

export const PLACEHOLDER_PHONE_PREFIX = '1111';
export const PLACEHOLDER_SEQ_DIGITS = 6;
export const PLACEHOLDER_EMAIL_DOMAIN = 'noreply.plus91inc.in';

const PLACEHOLDER_PHONE_RE = new RegExp(`^${PLACEHOLDER_PHONE_PREFIX}\\d{${PLACEHOLDER_SEQ_DIGITS}}$`);

export const digitsOnly = (v?: string | null): string => (v || '').replace(/\D/g, '');
export const isBlankContact = (v?: string | null): boolean => !v || v.trim() === '';

/** Build the placeholder phone for a given sequence number (0 – 999999). */
export function formatPlaceholderPhone(seq: number): string {
  return PLACEHOLDER_PHONE_PREFIX + String(seq).padStart(PLACEHOLDER_SEQ_DIGITS, '0');
}

/** Placeholder email derived from a phone (real or placeholder). */
export function placeholderEmailFor(phone: string): string {
  return `${digitsOnly(phone)}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** True if the value is one of our generated placeholder phones. */
export function isPlaceholderPhone(phone?: string | null): boolean {
  return PLACEHOLDER_PHONE_RE.test(digitsOnly(phone));
}

/** True if the value is one of our generated placeholder emails. */
export function isPlaceholderEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/** True if the value is a placeholder phone OR placeholder email. */
export function isPlaceholderContact(value?: string | null): boolean {
  return isPlaceholderPhone(value) || isPlaceholderEmail(value);
}

/** The numeric sequence encoded in a placeholder phone, or -1 if not one. */
export function placeholderSequenceOf(phone?: string | null): number {
  const d = digitsOnly(phone);
  return isPlaceholderPhone(d) ? parseInt(d.slice(PLACEHOLDER_PHONE_PREFIX.length), 10) : -1;
}

/**
 * Display helper: return the value for humans, or `fallback` when it's blank OR a
 * generated placeholder. Use everywhere a customer phone/email is shown (UI, PDF,
 * CSV, emails) so the synthetic values never surface. Do NOT use for sync payloads
 * or the customers grouping — those need the real stored value.
 */
export function displayContact(value?: string | null, fallback = 'N/A'): string {
  if (isBlankContact(value) || isPlaceholderContact(value)) return fallback;
  return value as string;
}
