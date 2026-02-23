ALTER TABLE material_instances
  DROP CONSTRAINT IF EXISTS material_instances_status_check;

ALTER TABLE material_instances
  ADD CONSTRAINT material_instances_status_check
  CHECK (status IN ('available', 'rented', 'returned', 'archived'));
