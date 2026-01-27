-- Add workos_user_id column to link with WorkOS
ALTER TABLE customers ADD COLUMN IF NOT EXISTS workos_user_id text UNIQUE;

-- Add email_verified column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Index for faster WorkOS user lookups
CREATE INDEX IF NOT EXISTS customers_workos_user_id_idx ON customers(workos_user_id);
