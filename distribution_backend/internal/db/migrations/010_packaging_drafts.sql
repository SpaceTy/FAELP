CREATE TABLE IF NOT EXISTS request_packaging_drafts (
  request_id text PRIMARY KEY,
  outgoing_tracking_code text,
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
