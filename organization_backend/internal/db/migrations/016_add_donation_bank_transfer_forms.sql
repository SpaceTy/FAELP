CREATE TABLE IF NOT EXISTS donation_bank_transfer_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  email text NOT NULL,
  phone_number text NOT NULL,
  submitted_ip inet NOT NULL,
  privacy_consent_accepted boolean NOT NULL,
  privacy_consent_text text NOT NULL,
  privacy_consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS donation_bank_transfer_forms_created_at_idx
  ON donation_bank_transfer_forms (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS donation_bank_transfer_forms_submitted_ip_created_at_idx
  ON donation_bank_transfer_forms (submitted_ip, created_at DESC);
