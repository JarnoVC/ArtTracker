-- Create a persistent favorites table that survives artwork deletions
-- This allows favorites to be restored when artworks are re-imported

-- Ensure is_favorite column exists on artworks table (in case it wasn't in initial schema)
ALTER TABLE artworks
ADD COLUMN IF NOT EXISTS is_favorite INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS persistent_favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_username VARCHAR(100) NOT NULL,
  artwork_id VARCHAR(100) NOT NULL,
  artwork_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, artist_username, artwork_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_persistent_favorites_user ON persistent_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_persistent_favorites_lookup ON persistent_favorites(user_id, artist_username, artwork_id);

-- Migrate existing favorites to persistent table
-- This ensures existing favorites are preserved even if artworks are deleted
INSERT INTO persistent_favorites (user_id, artist_username, artwork_id, artwork_url)
SELECT 
  aw.user_id,
  LOWER(a.username) as artist_username,
  aw.artwork_id,
  aw.artwork_url
FROM artworks aw
JOIN artists a ON aw.artist_id = a.id
WHERE aw.is_favorite = 1
ON CONFLICT (user_id, artist_username, artwork_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE persistent_favorites IS 'Stores favorite artworks independently of the artworks table, allowing favorites to persist across deletions and re-imports';

