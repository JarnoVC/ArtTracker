// JSON file-based database (for local development)
// This is a copy of the original database.ts with async support added

import fs from 'fs';
import path from 'path';
import type { PublicFeaturedArtwork } from './database';

const DB_PATH = process.env.DATABASE_PATH || './data/arttracker.json';

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export interface User {
  id: number;
  username: string;
  artstation_username?: string;
  token: string;
  created_at: string;
  discord_webhook_url?: string;
  discord_user_id?: string;
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
  last_updated_at?: string;
  is_new: number;
  discovered_at: string;
}

interface Database {
  users: User[];
  artists: Artist[];
  artworks: Artwork[];
  nextUserId: number;
  nextArtistId: number;
  nextArtworkId: number;
}

let db: Database = {
  users: [],
  artists: [],
  artworks: [],
  nextUserId: 1,
  nextArtistId: 1,
  nextArtworkId: 1
};

function generateToken(username: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(username + Date.now().toString()).digest('hex').substring(0, 32);
}

function loadDatabase(): { db: Database; wasMigrated: boolean } {
  if (!fs.existsSync(DB_PATH)) {
    return {
      db: {
        users: [],
        artists: [],
        artworks: [],
        nextUserId: 1,
        nextArtistId: 1,
        nextArtworkId: 1
      },
      wasMigrated: false
    };
  }
  
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    let wasMigrated = false;
    
    const needsUsersMigration = !parsed.users || !Array.isArray(parsed.users);
    
    if (needsUsersMigration) {
      parsed.users = [];
      parsed.nextUserId = 1;
      wasMigrated = true;
    }
    
    const artistsNeedMigration = parsed.artists && parsed.artists.some((a: any) => !a.user_id);
    const artworksNeedMigration = parsed.artworks && parsed.artworks.some((a: any) => !a.user_id);
    
    if (wasMigrated || artistsNeedMigration || artworksNeedMigration) {
      if ((parsed.artists && parsed.artists.length > 0) || (parsed.artworks && parsed.artworks.length > 0)) {
        let defaultUser = parsed.users.find((u: any) => u.username === 'default');
        
        if (!defaultUser) {
          defaultUser = {
            id: parsed.nextUserId || 1,
            username: 'default',
            token: generateToken('default'),
            created_at: new Date().toISOString()
          };
          parsed.users.push(defaultUser);
          parsed.nextUserId = (parsed.nextUserId || 1) + 1;
        }
        
        if (artistsNeedMigration && parsed.artists) {
          parsed.artists = parsed.artists.map((a: any) => ({
            ...a,
            user_id: a.user_id || defaultUser.id
          }));
        }
        
        if (artworksNeedMigration && parsed.artworks) {
          parsed.artworks = parsed.artworks.map((a: any) => ({
            ...a,
            user_id: a.user_id || defaultUser.id
          }));
        }
        
        wasMigrated = true;
        console.log(`🔄 Migrated existing data to default user (ID: ${defaultUser.id})`);
      }
    }
    
    return { db: parsed as Database, wasMigrated };
  } catch (error) {
    console.error('Error loading database:', error);
    return {
      db: {
        users: [],
        artists: [],
        artworks: [],
        nextUserId: 1,
        nextArtistId: 1,
        nextArtworkId: 1
      },
      wasMigrated: false
    };
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
}

export function initDatabase() {
  const { db: loadedDb, wasMigrated } = loadDatabase();
  
  db = loadedDb;
  
  if (wasMigrated) {
    try {
      saveDatabase();
      console.log('💾 Database migrated and saved');
    } catch (error) {
      console.error('Failed to save migrated database:', error);
    }
  }
  
  console.log('✅ Database initialized (JSON storage)');
  console.log(`   Users: ${db.users.length}, Artists: ${db.artists.length}, Artworks: ${db.artworks.length}`);
  
  if (db.users.length > 0) {
    console.log(`   User accounts: ${db.users.map(u => u.username).join(', ')}`);
    const defaultUser = db.users.find(u => u.username === 'default');
    if (defaultUser) {
      console.log(`   ℹ️  Default user token (for login): ${defaultUser.token}`);
    }
  }
}

// User operations
export function getAllUsers(): User[] {
  return [...db.users];
}

export function getUserById(id: number): User | undefined {
  return db.users.find(u => u.id === id);
}

export function getUserByUsername(username: string): User | undefined {
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function getUserByToken(token: string): User | undefined {
  return db.users.find(u => u.token === token);
}

export function createUser(username: string, artstation_username?: string): User {
  const existing = getUserByUsername(username);
  if (existing) {
    throw new Error('USERNAME_EXISTS');
  }

  const user: User = {
    id: db.nextUserId++,
    username,
    artstation_username,
    token: generateToken(username),
    created_at: new Date().toISOString()
  };

  db.users.push(user);
  saveDatabase();
  return user;
}

export function updateUser(id: number, updates: Partial<User>): boolean {
  const index = db.users.findIndex(u => u.id === id);
  if (index === -1) return false;

  if (updates.username) {
    const existing = db.users.find(u => u.id !== id && u.username.toLowerCase() === updates.username!.toLowerCase());
    if (existing) {
      throw new Error('USERNAME_EXISTS');
    }
  }

  db.users[index] = { ...db.users[index], ...updates };
  saveDatabase();
  return true;
}

// Artist operations
export function getAllArtists(user_id: number): Artist[] {
  return db.artists
    .filter(a => a.user_id === user_id)
    .sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function getArtistById(id: number, user_id: number): Artist | undefined {
  const artist = db.artists.find(a => a.id === id);
  if (!artist || artist.user_id !== user_id) return undefined;
  return artist;
}

export function addArtist(user_id: number, username: string, profile_url: string): Artist {
  const existing = db.artists.find(a => a.user_id === user_id && a.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    throw new Error('ARTIST_EXISTS');
  }

  const artist: Artist = {
    id: db.nextArtistId++,
    user_id,
    username,
    profile_url,
    created_at: new Date().toISOString()
  };

  db.artists.push(artist);
  saveDatabase();
  return artist;
}

export function updateArtist(id: number, user_id: number, updates: Partial<Artist>): boolean {
  const index = db.artists.findIndex(a => a.id === id && a.user_id === user_id);
  if (index === -1) return false;

  db.artists[index] = { ...db.artists[index], ...updates };
  saveDatabase();
  return true;
}

export function deleteArtist(id: number, user_id: number): boolean {
  const index = db.artists.findIndex(a => a.id === id && a.user_id === user_id);
  if (index === -1) return false;

  db.artists.splice(index, 1);
  db.artworks = db.artworks.filter(a => !(a.artist_id === id && a.user_id === user_id));
  saveDatabase();
  return true;
}

// Artwork operations
export function getAllArtworks(user_id: number, filters?: { artist_id?: number; new_only?: boolean }): Artwork[] {
  let artworks = db.artworks.filter(a => a.user_id === user_id);

  if (filters?.artist_id) {
    artworks = artworks.filter(a => a.artist_id === filters.artist_id);
  }

  if (filters?.new_only) {
    artworks = artworks.filter(a => a.is_new === 1);
  }

  return artworks.sort((a, b) => {
    const dateA = new Date(a.upload_date || a.discovered_at).getTime();
    const dateB = new Date(b.upload_date || b.discovered_at).getTime();
    return dateB - dateA;
  });
}

export function getArtworksWithArtistInfo(user_id: number, filters?: { artist_id?: number; new_only?: boolean }) {
  const artworks = getAllArtworks(user_id, filters);
  
  return artworks.map(artwork => {
    const artist = db.artists.find(a => a.id === artwork.artist_id && a.user_id === user_id);
    return {
      ...artwork,
      username: artist?.username,
      display_name: artist?.display_name
    };
  });
}

interface AddArtworkOptions {
  allowInsert?: boolean;
  markUpdatesAsNew?: boolean;
}

export function addArtwork(
  user_id: number,
  artist_id: number,
  artwork_id: string,
  title: string,
  thumbnail_url: string,
  artwork_url: string,
  upload_date?: string,
  updated_at?: string,
  options: AddArtworkOptions = {}
): { artwork: Artwork | null; isNew: boolean; wasUpdated?: boolean; skipped?: boolean } {
  const { allowInsert = true, markUpdatesAsNew = true } = options;
  const existing = db.artworks.find(
    a => a.user_id === user_id && a.artist_id === artist_id && a.artwork_id === artwork_id
  );
  
  if (existing) {
    const changed =
      existing.title !== title ||
      existing.thumbnail_url !== thumbnail_url ||
      existing.artwork_url !== artwork_url ||
      existing.upload_date !== upload_date ||
      existing.last_updated_at !== updated_at;

    if (changed) {
      existing.title = title;
      existing.thumbnail_url = thumbnail_url;
      existing.artwork_url = artwork_url;
      existing.upload_date = upload_date;
      existing.last_updated_at = updated_at || upload_date || existing.last_updated_at;
      if (markUpdatesAsNew) {
        existing.is_new = 1;
      }
      saveDatabase();
      return { artwork: existing, isNew: false, wasUpdated: true };
    }

    return { artwork: existing, isNew: false, wasUpdated: false };
  }

  if (!allowInsert) {
    return { artwork: null, isNew: false, wasUpdated: false, skipped: true };
  }

  const artwork: Artwork = {
    id: db.nextArtworkId++,
    user_id,
    artist_id,
    artwork_id,
    title,
    thumbnail_url,
    artwork_url,
    upload_date,
    last_updated_at: updated_at || upload_date || new Date().toISOString(),
    is_new: 1,
    discovered_at: new Date().toISOString()
  };

  db.artworks.push(artwork);
  saveDatabase();
  return { artwork, isNew: true, wasUpdated: false };
}

export function markArtworkSeen(id: number, user_id: number): boolean {
  const artwork = db.artworks.find(a => a.id === id && a.user_id === user_id);
  if (!artwork) return false;

  artwork.is_new = 0;
  saveDatabase();
  return true;
}

export function markAllArtworksSeen(user_id: number, artist_id?: number): number {
  let count = 0;
  
  db.artworks.forEach(artwork => {
    if (artwork.user_id === user_id && artwork.is_new === 1 && (!artist_id || artwork.artist_id === artist_id)) {
      artwork.is_new = 0;
      count++;
    }
  });

  if (count > 0) {
    saveDatabase();
  }
  
  return count;
}

export function getNewArtworksCount(user_id: number): number {
  return db.artworks.filter(a => a.user_id === user_id && a.is_new === 1).length;
}

export function deleteAllArtworks(user_id: number): number {
  const count = db.artworks.filter(a => a.user_id === user_id).length;
  db.artworks = db.artworks.filter(a => a.user_id !== user_id);
  if (count > 0) {
    saveDatabase();
  }
  return count;
}

export function deleteAllArtists(user_id: number): number {
  const count = db.artists.filter(a => a.user_id === user_id).length;
  db.artists = db.artists.filter(a => a.user_id !== user_id);
  db.artworks = db.artworks.filter(a => a.user_id !== user_id);
  if (count > 0) {
    saveDatabase();
  }
  return count;
}

export function getPublicFeaturedArtworks(limit: number = 10): PublicFeaturedArtwork[] {
  if (db.artworks.length === 0) {
    return [];
  }

  const candidates = db.artworks.filter(a => a.thumbnail_url && a.thumbnail_url.trim().length > 0);
  const pool = candidates.length ? candidates : db.artworks;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, limit).map(artwork => {
    const artist = db.artists.find(a => a.id === artwork.artist_id);
    return {
      id: artwork.id,
      artist_id: artwork.artist_id,
      title: artwork.title || 'Untitled',
      thumbnail_url: artwork.thumbnail_url,
      artwork_url: artwork.artwork_url,
      upload_date: artwork.upload_date,
      discovered_at: artwork.discovered_at,
      username: artist?.username,
      display_name: artist?.display_name,
    };
  });
}

