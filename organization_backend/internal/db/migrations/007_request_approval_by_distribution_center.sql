ALTER TABLE requests
  DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE requests
  ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending', 'approved', 'inAction', 'returned'));

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS approved_distribution_center_id uuid
  REFERENCES distribution_centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS requests_approved_distribution_center_idx
  ON requests (approved_distribution_center_id)
  WHERE approved_distribution_center_id IS NOT NULL;
