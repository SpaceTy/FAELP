CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id text NOT NULL,
  username text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  previous_state jsonb,
  rolled_back boolean NOT NULL DEFAULT false,
  rolled_back_at timestamptz,
  rolled_back_by text
);

CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
