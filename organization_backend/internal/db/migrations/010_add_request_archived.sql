ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS requests_archived_idx ON requests (archived);
