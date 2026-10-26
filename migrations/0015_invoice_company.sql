-- Invoice company tracking (Plus Nine One Inc → PLUSNINEONE TECH FILMS PRIVATE LIMITED cutover).
-- invoice_company = billing_entities key of the company that issued the sales invoice, derived
-- from the invoice-number prefix (ST/… or P91TFPL/…). invoice_raised_at = when it was entered.
-- Idempotent. Backfill existing rows with scripts/backfill-invoice-company.mjs.
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS invoice_company text;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS invoice_raised_at timestamp;
CREATE INDEX IF NOT EXISTS job_cards_sales_invoice_number_upper_idx
  ON job_cards (upper(trim(sales_invoice_number)))
  WHERE sales_invoice_number IS NOT NULL;
