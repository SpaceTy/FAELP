CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  delivery_date timestamptz NOT NULL,
  status text NOT NULL,
  shipping_customer_name text NOT NULL,
  shipping_address_line1 text NOT NULL,
  shipping_address_line2 text,
  shipping_city text NOT NULL,
  shipping_zip_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requests_status_check CHECK (status IN ('pending', 'inAction', 'returned'))
);

CREATE TABLE IF NOT EXISTS request_items (
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  material_type_id text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (request_id, material_type_id)
);

CREATE TABLE IF NOT EXISTS distribution_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL
);

CREATE TABLE IF NOT EXISTS material_available (
  material_type_id text NOT NULL,
  distribution_center_id uuid NOT NULL REFERENCES distribution_centers(id) ON DELETE CASCADE,
  amount int NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (material_type_id, distribution_center_id)
);

CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS requests_updated_at_idx ON requests (updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status);
CREATE INDEX IF NOT EXISTS requests_customer_idx ON requests (customer_id);

CREATE OR REPLACE FUNCTION set_requests_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS requests_set_updated_at ON requests;
CREATE TRIGGER requests_set_updated_at
BEFORE UPDATE ON requests
FOR EACH ROW
EXECUTE FUNCTION set_requests_updated_at();

CREATE OR REPLACE FUNCTION notify_request_change()
RETURNS trigger AS $$
DECLARE
  payload json;
BEGIN
  payload = json_build_object(
    'request_id', COALESCE(NEW.id, OLD.id),
    'action', TG_OP,
    'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
  );
  PERFORM pg_notify('requests_channel', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS requests_notify_change ON requests;
CREATE TRIGGER requests_notify_change
AFTER INSERT OR UPDATE OR DELETE ON requests
FOR EACH ROW
EXECUTE FUNCTION notify_request_change();
