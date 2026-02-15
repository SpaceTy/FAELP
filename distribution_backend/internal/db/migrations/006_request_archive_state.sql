CREATE TABLE IF NOT EXISTS request_archive_state (
  request_id uuid PRIMARY KEY,
  archived boolean NOT NULL DEFAULT FALSE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_archive_state_archived_idx
  ON request_archive_state (archived);
