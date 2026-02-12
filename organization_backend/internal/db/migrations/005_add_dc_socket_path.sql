-- Add socket_path to distribution_centers to track co-located backends
ALTER TABLE distribution_centers ADD COLUMN IF NOT EXISTS socket_path text UNIQUE;

-- Add index for socket path lookups
CREATE INDEX IF NOT EXISTS distribution_centers_socket_path_idx ON distribution_centers(socket_path) WHERE socket_path IS NOT NULL;
