// Unified database interface that supports both JSON (local dev) and PostgreSQL (production)
// If DATABASE_URL is set, use PostgreSQL; otherwise use JSON file storage
// All functions return Promises for consistent async interface

import * as jsonDb from './database-json';
import * as pgDb from './database-postgres';

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
  is_new: number;
  discovered_at: string;
}

const usePostgres = !!process.env.DATABASE_URL;

export function initDatabase(): void {
  if (usePostgres) {
    console.log('📦 Using PostgreSQL database');
    pgDb.initDatabase();
  } else {
    console.log('📦 Using JSON file storage (local development)');
    jsonDb.initDatabase();
  }
}

// Helper to wrap sync results in promises
function toPromise<T>(value: T | Promise<T>): Promise<T> {
  return Promise.resolve(value);
}

// User operations
export async function getAllUsers(): Promise<User[]> {
  if (usePostgres) {
    return pgDb.getAllUsers();
  }
  return toPromise(jsonDb.getAllUsers());
}

export async function getUserById(id: number): Promise<User | undefined> {
  if (usePostgres) {
    return pgDb.getUserById(id);
  }
  return toPromise(jsonDb.getUserById(id));
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  if (usePostgres) {
    return pgDb.getUserByUsername(username);
  }
  return toPromise(jsonDb.getUserByUsername(username));
}

export async function getUserByToken(token: string): Promise<User | undefined> {
  if (usePostgres) {
    return pgDb.getUserByToken(token);
  }
  return toPromise(jsonDb.getUserByToken(token));
}

export async function createUser(username: string, artstation_username?: string): Promise<User> {
  if (usePostgres) {
    return pgDb.createUser(username, artstation_username);
  }
  return toPromise(jsonDb.createUser(username, artstation_username));
}

export async function updateUser(id: number, updates: Partial<User>): Promise<boolean> {
  if (usePostgres) {
    return pgDb.updateUser(id, updates);
  }
  return toPromise(jsonDb.updateUser(id, updates));
}

// Artist operations
export async function getAllArtists(user_id: number): Promise<Artist[]> {
  if (usePostgres) {
    return pgDb.getAllArtists(user_id);
  }
  return toPromise(jsonDb.getAllArtists(user_id));
}

export async function getArtistById(id: number, user_id: number): Promise<Artist | undefined> {
  if (usePostgres) {
    return pgDb.getArtistById(id, user_id);
  }
  return toPromise(jsonDb.getArtistById(id, user_id));
}

export async function addArtist(user_id: number, username: string, profile_url: string): Promise<Artist> {
  if (usePostgres) {
    return pgDb.addArtist(user_id, username, profile_url);
  }
  return toPromise(jsonDb.addArtist(user_id, username, profile_url));
}

export async function updateArtist(id: number, user_id: number, updates: Partial<Artist>): Promise<boolean> {
  if (usePostgres) {
    return pgDb.updateArtist(id, user_id, updates);
  }
  return toPromise(jsonDb.updateArtist(id, user_id, updates));
}

export async function deleteArtist(id: number, user_id: number): Promise<boolean> {
  if (usePostgres) {
    return pgDb.deleteArtist(id, user_id);
  }
  return toPromise(jsonDb.deleteArtist(id, user_id));
}

// Artwork operations
export async function getAllArtworks(user_id: number, filters?: { artist_id?: number; new_only?: boolean }): Promise<Artwork[]> {
  if (usePostgres) {
    return pgDb.getAllArtworks(user_id, filters);
  }
  return toPromise(jsonDb.getAllArtworks(user_id, filters));
}

export async function getArtworksWithArtistInfo(user_id: number, filters?: { artist_id?: number; new_only?: boolean }) {
  if (usePostgres) {
    return pgDb.getArtworksWithArtistInfo(user_id, filters);
  }
  return toPromise(jsonDb.getArtworksWithArtistInfo(user_id, filters));
}

export interface AddArtworkOptions {
  allowInsert?: boolean;
  markUpdatesAsNew?: boolean;
}

export interface AddArtworkResult {
  artwork: Artwork | null;
  isNew: boolean;
  wasUpdated?: boolean;
  skipped?: boolean;
}

export async function addArtwork(
  user_id: number,
  artist_id: number,
  artwork_id: string,
  title: string,
  thumbnail_url: string,
  artwork_url: string,
  upload_date?: string,
  options?: AddArtworkOptions
): Promise<AddArtworkResult> {
  if (usePostgres) {
    return pgDb.addArtwork(user_id, artist_id, artwork_id, title, thumbnail_url, artwork_url, upload_date, options);
  }
  return toPromise(jsonDb.addArtwork(user_id, artist_id, artwork_id, title, thumbnail_url, artwork_url, upload_date, options));
}

export async function markArtworkSeen(id: number, user_id: number): Promise<boolean> {
  if (usePostgres) {
    return pgDb.markArtworkSeen(id, user_id);
  }
  return toPromise(jsonDb.markArtworkSeen(id, user_id));
}

export async function markAllArtworksSeen(user_id: number, artist_id?: number): Promise<number> {
  if (usePostgres) {
    return pgDb.markAllArtworksSeen(user_id, artist_id);
  }
  return toPromise(jsonDb.markAllArtworksSeen(user_id, artist_id));
}

export async function getNewArtworksCount(user_id: number): Promise<number> {
  if (usePostgres) {
    return pgDb.getNewArtworksCount(user_id);
  }
  return toPromise(jsonDb.getNewArtworksCount(user_id));
}

export async function deleteAllArtworks(user_id: number): Promise<number> {
  if (usePostgres) {
    return pgDb.deleteAllArtworks(user_id);
  }
  return toPromise(jsonDb.deleteAllArtworks(user_id));
}

export async function deleteAllArtists(user_id: number): Promise<number> {
  if (usePostgres) {
    return pgDb.deleteAllArtists(user_id);
  }
  return toPromise(jsonDb.deleteAllArtists(user_id));
}
