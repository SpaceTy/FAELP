ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS planned_return_date timestamptz;

UPDATE requests
SET planned_return_date = delivery_date
WHERE planned_return_date IS NULL;

ALTER TABLE requests
  ALTER COLUMN planned_return_date SET NOT NULL;
