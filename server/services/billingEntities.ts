// Company billing entities (who issues the invoice when the partner does NOT bill directly).
//
// Source of truth: system_settings key `billing_entities` (edited in Settings → Billing Entities).
// When unset, the built-in defaults below apply. Each entity has an invoice-number prefix (the
// ERPNext naming series, e.g. ST/1060/26-27 or P91TFPL/3/26-27) and an optional effectiveFrom date:
// new work orders snapshot the entity with the latest effectiveFrom <= now; an entity whose
// effectiveFrom is null is only the baseline fallback (the first such entity), never "newer".
import { z } from "zod";
import { storage } from "../storage";

export const BILLING_ENTITIES_SETTING_KEY = "billing_entities";

export const billingEntitySchema = z.object({
  key: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i, "key: letters, digits, - or _ only"),
  name: z.string().trim().min(1),
  addressLine1: z.string().trim().default(""),
  city: z.string().trim().default(""),
  state: z.string().trim().default(""),
  pincode: z.string().trim().default(""),
  gstin: z.string().trim().toUpperCase().default(""),
  pan: z.string().trim().toUpperCase().optional().default(""),
  invoicePrefix: z.string().trim().toUpperCase().min(1).regex(/^[A-Z0-9]+$/, "invoicePrefix: letters/digits only (no slash)"),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveFrom must be YYYY-MM-DD")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const billingEntitiesSchema = z
  .array(billingEntitySchema)
  .min(1, "At least one billing entity is required")
  .superRefine((list, ctx) => {
    const keys = new Set<string>();
    const prefixes = new Set<string>();
    list.forEach((e, i) => {
      if (keys.has(e.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "key"], message: `Duplicate key ${e.key}` });
      if (prefixes.has(e.invoicePrefix)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "invoicePrefix"], message: `Duplicate invoice prefix ${e.invoicePrefix}` });
      keys.add(e.key);
      prefixes.add(e.invoicePrefix);
    });
  });

export type BillingEntity = z.infer<typeof billingEntitySchema>;

export const OLD_ENTITY_KEY = "plus-nine-one-inc";
export const NEW_ENTITY_KEY = "plusnineone-tech-films";

export const DEFAULT_BILLING_ENTITIES: BillingEntity[] = [
  {
    key: OLD_ENTITY_KEY,
    name: "Plus Nine One Inc",
    addressLine1: "Ward 117, 49, Bannerghatta Rd, Ayappa Garden, Shanti Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560030",
    gstin: "29AMIPP3288M1Z6",
    pan: "",
    invoicePrefix: "ST",
    effectiveFrom: null,
  },
  {
    key: NEW_ENTITY_KEY,
    name: "PLUSNINEONE TECH FILMS PRIVATE LIMITED",
    addressLine1: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
    pan: "",
    invoicePrefix: "P91TFPL",
    // null = not yet the default for new work orders. Set the cutover date in Settings.
    effectiveFrom: null,
  },
];

const CACHE_TTL_MS = 60_000;
let cache: { at: number; entities: BillingEntity[] } | null = null;

export function invalidateBillingEntitiesCache() {
  cache = null;
}

export async function getBillingEntities(): Promise<BillingEntity[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.entities;
  let entities = DEFAULT_BILLING_ENTITIES;
  try {
    const setting = await storage.getSystemSetting(BILLING_ENTITIES_SETTING_KEY);
    if (setting?.value != null) {
      const parsed = billingEntitiesSchema.safeParse(setting.value);
      if (parsed.success) entities = parsed.data;
      else console.error("⚠️ Invalid billing_entities setting — using defaults:", parsed.error.flatten());
    }
  } catch (err) {
    console.error("⚠️ Failed to load billing_entities setting — using defaults:", err);
  }
  cache = { at: Date.now(), entities };
  return entities;
}

/** effectiveFrom (YYYY-MM-DD) is read as start of that day in IST. */
function effectiveFromDate(e: BillingEntity): Date | null {
  return e.effectiveFrom ? new Date(`${e.effectiveFrom}T00:00:00+05:30`) : null;
}

export function pickDefaultBillingEntity(entities: BillingEntity[], at: Date = new Date()): BillingEntity {
  let best: BillingEntity | null = null;
  let bestAt = -Infinity;
  for (const e of entities) {
    const d = effectiveFromDate(e);
    if (d && d.getTime() <= at.getTime() && d.getTime() > bestAt) {
      best = e;
      bestAt = d.getTime();
    }
  }
  return best || entities.find((e) => !e.effectiveFrom) || entities[0];
}

export async function getDefaultBillingEntity(at: Date = new Date()): Promise<BillingEntity> {
  return pickDefaultBillingEntity(await getBillingEntities(), at);
}

export async function getBillingEntity(key: string | null | undefined): Promise<BillingEntity | undefined> {
  if (!key) return undefined;
  return (await getBillingEntities()).find((e) => e.key === key);
}

/** Trim + uppercase, collapse inner whitespace around slashes. */
export function normaliseInvoiceNumber(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/\s*\/\s*/g, "/");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * <PREFIX>/<n>/<YY-YY>, with an optional ERPNext amendment suffix "-<k>"
 * (e.g. ST/364/25-26-1 — amended invoices already exist in the data).
 */
export function buildInvoiceRegex(entities: BillingEntity[]): RegExp {
  const alt = entities.map((e) => escapeRe(e.invoicePrefix)).join("|");
  return new RegExp(`^(${alt})/\\d+/\\d{2}-\\d{2}(-\\d+)?$`);
}

export function invoiceFormatHint(entities: BillingEntity[]): string {
  return entities.map((e) => `${e.invoicePrefix}/<number>/<YY-YY>`).join(" or ");
}

export function entityForInvoiceNumberSync(entities: BillingEntity[], no: string): BillingEntity | undefined {
  const n = normaliseInvoiceNumber(no);
  return entities.find((e) => n.startsWith(`${e.invoicePrefix}/`));
}

export async function entityForInvoiceNumber(no: string): Promise<BillingEntity | undefined> {
  return entityForInvoiceNumberSync(await getBillingEntities(), no);
}

/** The jsonb snapshot stored in work_orders.bill_from / job_cards.bill_from. */
export function toBillFromSnapshot(e: BillingEntity) {
  return {
    name: e.name,
    addressLine1: e.addressLine1,
    city: e.city,
    state: e.state,
    pincode: e.pincode,
    gstin: e.gstin,
    ...(e.pan ? { pan: e.pan } : {}),
    entityKey: e.key,
  };
}

/** True when a bill_from snapshot is one of our company entities (not a partner). */
export function matchCompanyBillFrom(entities: BillingEntity[], billFrom: any): BillingEntity | undefined {
  if (!billFrom || typeof billFrom !== "object") return undefined;
  if (billFrom.entityKey) {
    const byKey = entities.find((e) => e.key === billFrom.entityKey);
    if (byKey) return byKey;
  }
  const name = String(billFrom.name || "").trim().toLowerCase();
  if (!name) return undefined;
  return entities.find((e) => e.name.trim().toLowerCase() === name);
}
