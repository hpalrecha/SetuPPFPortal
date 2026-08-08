-- Admin-editable notification templates (one row per lifecycle event), overriding the code
-- defaults. Email subject/body are freely editable; WhatsApp is a Meta template-name + language
-- mapping. Idempotent — safe to re-run / apply via `npm run db:push`.
CREATE TABLE IF NOT EXISTS notification_templates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type             text NOT NULL UNIQUE,
  email_subject          text,
  email_body             text,
  email_active           boolean DEFAULT true,
  whatsapp_template_name text,
  whatsapp_language      text DEFAULT 'en',
  whatsapp_active        boolean DEFAULT true,
  updated_at             timestamp DEFAULT now()
);
