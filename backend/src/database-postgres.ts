import pg from 'pg';
const { Pool } = pg;
import crypto from 'crypto';

// Export interfaces (same as database.ts)
export interface User {
  id: number;
  username: string;
  artstation_username?: string;
  token: string;
  created_at: string;
}

export interface Artist {
  id: number;
  user_id: number;
  username: string;
  display_name?: string;
  profile_url: string;
  avatar_url?: string;
  last_checked?: string;
  created_at: string;
}

export interface Artwork {
  id: number;
  user_id: number;
  artist_id: number;
  artwork_id: string;
  title: string;
  thumbnail_url: string;
  artwork_url: string;
  upload_date?: string;
  is_new: number;
  discovered_at: string;
}

let pool: pg.Pool | null = null;

function generateToken(username: string): string {
  return crypto.createHash('sha256').update(username + Date.now().toString()).digest('hex').substring(0, 32);
}

export function initDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false }
  });

  // Test connection (async, but we don't wait - connection will be tested on first query)
  pool.query('SELECT NOW()')
    .then(() => {
      console.log('✅ Database initialized (PostgreSQL)');
    })
    .catch((err: Error) => {
      console.error('❌ Database connection error:', err);
      console.error('   Make sure DATABASE_URL is correct and the database is accessible');
    });
}

async function query(text: string, params?: any[]): Promise<pg.QueryResult> {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool.query(text, params);
}

// User operations
export async function getAllUsers(): Promise<User[]> {
  const result = await query('SELECT * FROM users ORDER BY created_at DESC');
  return result.rows.map((row: any) => ({
    id: row.id,
    username: row.username,
    artstation_username: row.artstation_username || undefined,
    token: row.token,
    created_at: row.created_at.toISOString()
  }));
}

export async function getUserById(id: number): Promise<User | undefined> {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    artstation_username: row.artstation_username || undefined,
    token: row.token,
    created_at: row.created_at.toISOString()
  };
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const result = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    artstation_username: row.artstation_username || undefined,
    token: row.token,
    created_at: row.created_at.toISOString()
  };
}

export async function getUserByToken(token: string): Promise<User | undefined> {
  const result = await query('SELECT * FROM users WHERE token = $1', [token]);
  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    artstation_username: row.artstation_username || undefined,
    token: row.token,
    created_at: row.created_at.toISOString()
  };
}

export async function createUser(username: string, artstation_username?: string): Promise<User> {
  const existing = await getUserByUsername(username);
  if (existing) {
    throw new Error('USERNAME_EXISTS');
  }

  const token = generateToken(username);
  const result = await query(
    'INSERT INTO users (username, artstation_username, token) VALUES ($1, $2, $3) RETURNING *',
    [username, artstation_username || null, token]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    artstation_username: row.artstation_username || undefined,
    token: row.token,
    created_at: row.created_at.toISOString()
  };
}

export async function updateUser(id: number, updates: Partial<User>): Promise<boolean> {
  if (updates.username) {
    const existing = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [updates.username, id]);
    if (existing.rows.length > 0) {
      throw new Error('USERNAME_EXISTS');
    }
  }

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.username !== undefined) {
    fields.push(`username = $${paramIndex++}`);
    values.push(updates.username);
  }
  if (updates.artstation_username !== undefined) {
    fields.push(`artstation_username = $${paramIndex++}`);
    values.push(updates.artstation_username || null);
  }

  if (fields.length === 0) return false;

  values.push(id);
  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  return (result.rowCount ?? 0) > 0;
}

// Artist operations
export async function getAllArtists(user_id: number): Promise<Artist[]> {
  const result = await query(
    'SELECT * FROM artists WHERE user_id = $1 ORDER BY created_at DESC',
    [user_id]
  );
  
  return result.rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    display_name: row.display_name || undefined,
    profile_url: row.profile_url,
    avatar_url: row.avatar_url || undefined,
    last_checked: row.last_checked ? row.last_checked.toISOString() : undefined,
    created_at: row.created_at.toISOString()
  }));
}

export async function getArtistById(id: number, user_id: number): Promise<Artist | undefined> {
  const result = await query('SELECT * FROM artists WHERE id = $1 AND user_id = $2', [id, user_id]);
  if (result.rows.length === 0) return undefined;
  const row = result.rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    display_name: row.display_name || undefined,
    profile_url: row.profile_url,
    avatar_url: row.avatar_url || undefined,
    last_checked: row.last_checked ? row.last_checked.toISOString() : undefined,
    created_at: row.created_at.toISOString()
  };
}

export async function addArtist(user_id: number, username: string, profile_url: string): Promise<Artist> {
  // Check if artist already exists
  const existing = await query(
    'SELECT id FROM artists WHERE user_id = $1 AND LOWER(username) = LOWER($2)',
    [user_id, username]
  );
  
  if (existing.rows.length > 0) {
    throw new Error('ARTIST_EXISTS');
  }

  const result = await query(
    'INSERT INTO artists (user_id, username, profile_url) VALUES ($1, $2, $3) RETURNING *',
    [user_id, username, profile_url]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    display_name: row.display_name || undefined,
    profile_url: row.profile_url,
    avatar_url: row.avatar_url || undefined,
    last_checked: row.last_checked ? row.last_checked.toISOString() : undefined,
    created_at: row.created_at.toISOString()
  };
}

export async function updateArtist(id: number, user_id: number, updates: Partial<Artist>): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.display_name !== undefined) {
    fields.push(`display_name = $${paramIndex++}`);
    values.push(updates.display_name || null);
  }
  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(updates.avatar_url || null);
  }
  if (updates.last_checked !== undefined) {
    fields.push(`last_checked = $${paramIndex++}`);
    values.push(updates.last_checked ? new Date(updates.last_checked) : null);
  }

  if (fields.length === 0) return false;

  values.push(id, user_id);
  const result = await query(
    `UPDATE artists SET ${fields.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
    values
  );

  return (result.rowCount ?? 0) > 0;
}

export async function deleteArtist(id: number, user_id: number): Promise<boolean> {
  const result = await query('DELETE FROM artists WHERE id = $1 AND user_id = $2', [id, user_id]);
  return (result.rowCount ?? 0) > 0;
}

// Artwork operations
export async function getAllArtworks(user_id: number, filters?: { artist_id?: number; new_only?: boolean }): Promise<Artwork[]> {
  let queryText = 'SELECT * FROM artworks WHERE user_id = $1';
  const params: any[] = [user_id];
  let paramIndex = 2;

  if (filters?.artist_id) {
    queryText += ` AND artist_id = $${paramIndex++}`;
    params.push(filters.artist_id);
  }

  if (filters?.new_only) {
    queryText += ` AND is_new = 1`;
  }

  queryText += ' ORDER BY COALESCE(upload_date, discovered_at) DESC';

  const result = await query(queryText, params);
  
  return result.rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    artist_id: row.artist_id,
    artwork_id: row.artwork_id,
    title: row.title,
    thumbnail_url: row.thumbnail_url,
    artwork_url: row.artwork_url,
    upload_date: row.upload_date ? row.upload_date.toISOString() : undefined,
    is_new: row.is_new,
    discovered_at: row.discovered_at.toISOString()
  }));
}

export async function getArtworksWithArtistInfo(user_id: number, filters?: { artist_id?: number; new_only?: boolean }) {
  const artworks = await getAllArtworks(user_id, filters);
  
  // Get all unique artist IDs
  const artistIds = [...new Set(artworks.map(a => a.artist_id))];
  
  if (artistIds.length === 0) {
    return artworks.map(artwork => ({ ...artwork, username: undefined, display_name: undefined }));
  }

  // Fetch all artists in one query
  const artistsResult = await query(
    `SELECT id, username, display_name FROM artists WHERE user_id = $1 AND id = ANY($2)`,
    [user_id, artistIds]
  );
  
  const artistsMap = new Map(
    artistsResult.rows.map((row: any) => [row.id, { username: row.username, display_name: row.display_name }])
  );

  return artworks.map(artwork => {
    const artist = artistsMap.get(artwork.artist_id) as { username: string; display_name?: string } | undefined;
    return {
      ...artwork,
      username: artist?.username,
      display_name: artist?.display_name
    };
  });
}

export async function addArtwork(
  user_id: number,
  artist_id: number,
  artwork_id: string,
  title: string,
  thumbnail_url: string,
  artwork_url: string,
  upload_date?: string
): Promise<{ artwork: Artwork; isNew: boolean }> {
  // Check if artwork already exists
  const existingResult = await query(
    'SELECT * FROM artworks WHERE user_id = $1 AND artist_id = $2 AND artwork_id = $3',
    [user_id, artist_id, artwork_id]
  );

  if (existingResult.rows.length > 0) {
    const row = existingResult.rows[0];
    return {
      artwork: {
        id: row.id,
        user_id: row.user_id,
        artist_id: row.artist_id,
        artwork_id: row.artwork_id,
        title: row.title,
        thumbnail_url: row.thumbnail_url,
        artwork_url: row.artwork_url,
        upload_date: row.upload_date ? row.upload_date.toISOString() : undefined,
        is_new: row.is_new,
        discovered_at: row.discovered_at.toISOString()
      },
      isNew: false
    };
  }

  const result = await query(
    `INSERT INTO artworks (user_id, artist_id, artwork_id, title, thumbnail_url, artwork_url, upload_date, is_new)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1) RETURNING *`,
    [user_id, artist_id, artwork_id, title, thumbnail_url, artwork_url, upload_date ? new Date(upload_date) : null]
  );

  const row = result.rows[0];
  return {
    artwork: {
      id: row.id,
      user_id: row.user_id,
      artist_id: row.artist_id,
      artwork_id: row.artwork_id,
      title: row.title,
      thumbnail_url: row.thumbnail_url,
      artwork_url: row.artwork_url,
      upload_date: row.upload_date ? row.upload_date.toISOString() : undefined,
      is_new: row.is_new,
      discovered_at: row.discovered_at.toISOString()
    },
    isNew: true
  };
}

export async function markArtworkSeen(id: number, user_id: number): Promise<boolean> {
  const result = await query('UPDATE artworks SET is_new = 0 WHERE id = $1 AND user_id = $2', [id, user_id]);
  return (result.rowCount ?? 0) > 0;
}

export async function markAllArtworksSeen(user_id: number, artist_id?: number): Promise<number> {
  let queryText = 'UPDATE artworks SET is_new = 0 WHERE user_id = $1 AND is_new = 1';
  const params: any[] = [user_id];

  if (artist_id) {
    queryText += ' AND artist_id = $2';
    params.push(artist_id);
  }

  const result = await query(queryText, params);
  return result.rowCount || 0;
}

export async function getNewArtworksCount(user_id: number): Promise<number> {
  const result = await query('SELECT COUNT(*) as count FROM artworks WHERE user_id = $1 AND is_new = 1', [user_id]);
  return parseInt(result.rows[0].count, 10);
}

export async function deleteAllArtworks(user_id: number): Promise<number> {
  const result = await query('DELETE FROM artworks WHERE user_id = $1', [user_id]);
  return result.rowCount || 0;
}

export async function deleteAllArtists(user_id: number): Promise<number> {
  const result = await query('DELETE FROM artists WHERE user_id = $1', [user_id]);
  return result.rowCount || 0;
}

