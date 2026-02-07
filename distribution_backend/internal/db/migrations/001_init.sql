CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS material_instances (
  id text PRIMARY KEY,
  type_id text NOT NULL,
  status text NOT NULL,
  use_count integer NOT NULL DEFAULT 0,
  location text NOT NULL,
  current_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_instances_status_check CHECK (status IN ('available', 'rented', 'returned'))
);

CREATE INDEX IF NOT EXISTS material_instances_type_id_idx ON material_instances (type_id);
CREATE INDEX IF NOT EXISTS material_instances_status_idx ON material_instances (status);
CREATE INDEX IF NOT EXISTS material_instances_location_idx ON material_instances (location);
CREATE INDEX IF NOT EXISTS material_instances_current_request_id_idx ON material_instances (current_request_id);
CREATE INDEX IF NOT EXISTS material_instances_updated_at_idx ON material_instances (updated_at DESC);

CREATE OR REPLACE FUNCTION set_material_instances_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS material_instances_set_updated_at ON material_instances;
CREATE TRIGGER material_instances_set_updated_at
BEFORE UPDATE ON material_instances
FOR EACH ROW
EXECUTE FUNCTION set_material_instances_updated_at();
