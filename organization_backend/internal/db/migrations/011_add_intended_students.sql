ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS intended_students integer;

UPDATE requests
SET intended_students = 1
WHERE intended_students IS NULL;

ALTER TABLE requests
  ALTER COLUMN intended_students SET NOT NULL;

ALTER TABLE requests
  ALTER COLUMN intended_students SET DEFAULT 1;
