ALTER TABLE donation_bank_transfer_forms
  ADD COLUMN IF NOT EXISTS matching_code text;

UPDATE donation_bank_transfer_forms
SET matching_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE matching_code IS NULL;

ALTER TABLE donation_bank_transfer_forms
  ALTER COLUMN matching_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donation_bank_transfer_forms_matching_code_idx
  ON donation_bank_transfer_forms (matching_code);
