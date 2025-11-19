// Shared TypeScript types used across backend and frontend

export interface Artist {
  id: number;
  username: string;
  display_name?: string;
  profile_url: string;
  avatar_url?: string;
  last_checked?: string;
  created_at: string;
}

export interface Artwork {
  id: number;
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

export interface ScrapeResult {
  artist: string;
  total_found: number;
  new_artworks: number;
  error?: string;
}

