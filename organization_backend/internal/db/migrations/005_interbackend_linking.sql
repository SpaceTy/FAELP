ALTER TABLE distribution_centers
  ADD COLUMN IF NOT EXISTS center_code text,
  ADD COLUMN IF NOT EXISTS callback_url text,
  ADD COLUMN IF NOT EXISTS link_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dist_public_key text,
  ADD COLUMN IF NOT EXISTS challenge_token_hash text,
  ADD COLUMN IF NOT EXISTS challenge_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_ip text,
  ADD COLUMN IF NOT EXISTS hibernated_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_reason text,
  ADD COLUMN IF NOT EXISTS last_inventory_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inventory_sync_status text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS distribution_centers_center_code_unique_idx
  ON distribution_centers(center_code)
  WHERE center_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS distribution_centers_link_state_idx
  ON distribution_centers(link_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS distribution_centers_last_seen_idx
  ON distribution_centers(last_seen_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'distribution_centers_link_state_check'
  ) THEN
    ALTER TABLE distribution_centers
      ADD CONSTRAINT distribution_centers_link_state_check
      CHECK (link_state IN ('pending','approved','active','hibernating','admin_locked','rejected','revoked'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS distribution_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_center_id uuid NOT NULL REFERENCES distribution_centers(id) ON DELETE CASCADE,
  requested_center_name text NOT NULL,
  requested_center_address text NOT NULL,
  requested_callback_url text NOT NULL,
  requested_dist_public_key text NOT NULL,
  challenge_token_hash text NOT NULL,
  challenge_expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_user_id uuid REFERENCES users(id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'distribution_link_requests_state_check'
  ) THEN
    ALTER TABLE distribution_link_requests
      ADD CONSTRAINT distribution_link_requests_state_check
      CHECK (state IN ('pending','approved','rejected','expired'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS distribution_link_requests_state_idx
  ON distribution_link_requests(state, created_at DESC);

CREATE INDEX IF NOT EXISTS distribution_link_requests_center_idx
  ON distribution_link_requests(distribution_center_id, created_at DESC);
