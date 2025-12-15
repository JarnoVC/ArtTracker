/// <reference types="vite/client" />
import axios from 'axios';

// Use environment variable for production, fallback to relative path for local dev
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Configure axios with longer timeout for Render free tier wake-up (can take up to 2 minutes)
// This allows the backend time to wake up from sleep mode
axios.defaults.timeout = 120000; // 2 minutes to allow backend to wake up

// Retry configuration for failed requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds base delay

// Helper function to retry requests with exponential backoff
// This handles cases where the backend is waking up from sleep
async function retryRequest<T>(
  requestFn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await requestFn();
  } catch (error: any) {
    // Only retry on network errors, timeouts, or 5xx errors (not 4xx client errors)
    const shouldRetry = 
      retries > 0 && 
      (!error.response || (error.response.status >= 500 && error.response.status < 600)) &&
      (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response);
    
    if (shouldRetry) {
      // Exponential backoff: 2s, 4s, 8s
      const delay = RETRY_DELAY * Math.pow(2, MAX_RETRIES - retries);
      console.log(`Request failed, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(requestFn, retries - 1);
    }
    throw error;
  }
}

// Get auth token from localStorage
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

// Set auth token in localStorage
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('auth_token', token);
    // Set default authorization header for all requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('auth_token');
    delete axios.defaults.headers.common['Authorization'];
  }
}

// Initialize axios with token if available
const token = getAuthToken();
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Add interceptor to handle 401 errors (unauthorized)
// Note: We don't redirect here - the React component handles showing the login modal
axios.interceptors.response.use(
  response => response,
  error => {
    // Don't clear token on 401 from /auth/me during initial check
    // The component will handle authentication state
    return Promise.reject(error);
  }
);

export interface Artist {
  id: number;
  user_id?: number;
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
  high_quality_image_url?: string;
  artwork_url: string;
  upload_date?: string;
  last_updated_at?: string;
  is_new: number;
  is_favorite?: number;
  discovered_at: string;
  username?: string;
  display_name?: string;
}

export interface FeaturedArtworkPreview {
  id: number;
  artist_id: number;
  title: string;
  thumbnail_url?: string;
  artwork_url?: string;
  upload_date?: string;
  discovered_at?: string;
  username?: string;
  display_name?: string;
}

export const getArtists = async (): Promise<Artist[]> => {
  return retryRequest(async () => {
    const response = await axios.get(`${API_BASE}/artists`);
    return response.data;
  });
};

export const addArtist = async (username: string): Promise<Artist> => {
  return retryRequest(async () => {
    const response = await axios.post(`${API_BASE}/artists`, { username });
    return response.data;
  });
};

export const deleteArtist = async (id: number): Promise<void> => {
  return retryRequest(async () => {
    await axios.delete(`${API_BASE}/artists/${id}`);
  });
};

export const getArtworks = async (
  artistId: number | null = null, 
  newOnly: boolean = false,
  latestPerArtist: boolean = false,
  favoritesOnly: boolean = false
): Promise<Artwork[]> => {
  return retryRequest(async () => {
    const params = new URLSearchParams();
    if (artistId) params.append('artist_id', artistId.toString());
    if (newOnly) params.append('new_only', 'true');
    if (latestPerArtist) params.append('latest_per_artist', 'true');
    if (favoritesOnly) params.append('favorites_only', 'true');
    
    const response = await axios.get(`${API_BASE}/artworks?${params}`);
    return response.data;
  });
};

export const getFeaturedArtworks = async (limit: number = 10): Promise<FeaturedArtworkPreview[]> => {
  return retryRequest(async () => {
    const response = await axios.get(`${API_BASE}/public/featured-artworks`, {
      params: { limit },
    });
    return response.data;
  });
};

export const markArtworkSeen = async (id: number): Promise<void> => {
  return retryRequest(async () => {
    await axios.patch(`${API_BASE}/artworks/${id}/mark-seen`);
  });
};

export const markAllSeen = async (artistId?: number): Promise<void> => {
  return retryRequest(async () => {
    await axios.post(`${API_BASE}/artworks/mark-all-seen`, { artist_id: artistId });
  });
};

export const toggleFavorite = async (id: number): Promise<void> => {
  return retryRequest(async () => {
    await axios.patch(`${API_BASE}/artworks/${id}/toggle-favorite`);
  });
};

export const getNewCount = async (): Promise<{ count: number }> => {
  return retryRequest(async () => {
    const response = await axios.get(`${API_BASE}/artworks/new-count`);
    return response.data;
  });
};

export const scrapeArtist = async (id: number): Promise<any> => {
  return retryRequest(async () => {
    const response = await axios.post(`${API_BASE}/scrape/artist/${id}`);
    return response.data;
  });
};

export const scrapeAll = async (): Promise<any> => {
  return retryRequest(async () => {
    const response = await axios.post(`${API_BASE}/scrape/all`);
    return response.data;
  });
};

export const importFollowing = async (username: string = '', clearExisting: boolean = true, skipArtworkScraping: boolean = false): Promise<any> => {
  return retryRequest(async () => {
    // If username is empty, backend will use user's stored ArtStation username
    const response = await axios.post(`${API_BASE}/import/following`, { 
      username: username || undefined, 
      clearExisting, 
      skipArtworkScraping 
    });
    return response.data;
  });
};

// Auth API
export interface User {
  id: number;
  username: string;
  artstation_username?: string;
  discord_webhook_url?: string | null;
  discord_user_id?: string | null;
  token?: string; // Only present in login/register responses
  created_at: string;
}

export const register = async (username: string, artstation_username?: string): Promise<User> => {
  return retryRequest(async () => {
    const response = await axios.post(`${API_BASE}/auth/register`, { username, artstation_username });
    const user = response.data;
    if (user.token) {
      setAuthToken(user.token);
    }
    return user;
  });
};

export const login = async (username: string): Promise<User> => {
  return retryRequest(async () => {
    const response = await axios.post(`${API_BASE}/auth/login`, { username });
    const user = response.data;
    if (user.token) {
      setAuthToken(user.token);
    }
    return user;
  });
};

export const getCurrentUser = async (): Promise<User> => {
  return retryRequest(async () => {
    const response = await axios.get(`${API_BASE}/auth/me`);
    return response.data;
  });
};

export const updateUser = async (artstation_username?: string): Promise<User> => {
  return retryRequest(async () => {
    const response = await axios.patch(`${API_BASE}/auth/me`, { artstation_username });
    return response.data;
  });
};

// User profile API (includes Discord settings)
export const getUserProfile = async (): Promise<User> => {
  return retryRequest(async () => {
    const response = await axios.get(`${API_BASE}/user`);
    return response.data;
  });
};

export const updateUserProfile = async (updates: {
  discord_webhook_url?: string | null;
  discord_user_id?: string | null;
}): Promise<{ success: boolean; user: User }> => {
  return retryRequest(async () => {
    const response = await axios.patch(`${API_BASE}/user`, updates);
    return response.data;
  });
};

export const testDiscordNotification = async (): Promise<{ success: boolean; message: string; artwork?: { title: string; artist: string } }> => {
  return retryRequest(async () => {
    const response = await axios.post(`${API_BASE}/user/test-discord`);
    return response.data;
  });
};

export const sendCustomDiscordMessage = async (message: string): Promise<{ success: boolean; message: string }> => {
  return retryRequest(async () => {
    const response = await axios.post(`${API_BASE}/user/custom-discord`, { message });
    return response.data;
  });
};

export const logout = () => {
  setAuthToken(null);
};

// Health check function to wake up the backend before making API calls
// This is useful for Render free tier which sleeps after 15 minutes of inactivity
export const wakeUpBackend = async (): Promise<void> => {
  try {
    // Ping health endpoint to wake up the backend
    // Use a longer timeout to allow for wake-up time (can take up to 2 minutes)
    await axios.get(`${API_BASE}/health`, { timeout: 120000 });
  } catch (error) {
    // Ignore errors - backend might be waking up or health check might fail
    // The retry logic in other API calls will handle actual failures
    console.log('Backend health check:', error);
  }
};

