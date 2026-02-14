ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS "outgoingTrackingCode" text;
