ALTER TABLE distribution_centers
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE distribution_centers
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE distribution_centers
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE distribution_centers
  ALTER COLUMN created_at SET NOT NULL;
