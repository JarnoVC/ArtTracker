-- Add last_updated_at column to artworks table to track edits
ALTER TABLE artworks
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP;

-- Backfill existing rows with upload_date if last_updated_at is null
UPDATE artworks
SET last_updated_at = COALESCE(last_updated_at, upload_date, discovered_at)
WHERE last_updated_at IS NULL;

