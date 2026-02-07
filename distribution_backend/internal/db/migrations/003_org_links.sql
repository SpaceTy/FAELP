CREATE TABLE IF NOT EXISTS org_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_base_url text NOT NULL,
  center_code text NOT NULL,
  center_name text NOT NULL,
  center_address text NOT NULL,
  callback_url text NOT NULL,
  challenge_token text NOT NULL,
  dist_private_key text NOT NULL,
  dist_public_key text NOT NULL,
  org_link_request_id uuid,
  link_state text NOT NULL DEFAULT 'pending',
  org_access_token text,
  org_access_token_expires_at timestamptz,
  last_bootstrap_at timestamptz,
  last_heartbeat_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_links_state_check CHECK (link_state IN ('pending','approved','active','hibernating','admin_locked','rejected','revoked')),
  CONSTRAINT org_links_unique_org_center UNIQUE(org_base_url, center_code)
);

CREATE INDEX IF NOT EXISTS org_links_state_idx ON org_links(link_state);

DROP TRIGGER IF EXISTS org_links_set_updated_at ON org_links;
CREATE TRIGGER org_links_set_updated_at
BEFORE UPDATE ON org_links
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
