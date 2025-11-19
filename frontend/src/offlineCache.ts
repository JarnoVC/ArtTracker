interface CachedState {
  user?: any;
  artists?: any[];
  artworks?: any[];
  newCount?: number;
  selectedArtistId?: number | null;
  timestamp: number;
}

const CACHE_KEY = 'arttracker_offline_cache_v1';

export function saveCachedData(data: Partial<CachedState>) {
  try {
    const existing = loadCachedData();
    const merged: CachedState = {
      user: data.user ?? existing?.user,
      artists: data.artists ?? existing?.artists,
      artworks: data.artworks ?? existing?.artworks,
      newCount: data.newCount ?? existing?.newCount,
      selectedArtistId: data.selectedArtistId ?? existing?.selectedArtistId,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn('Failed to cache offline data', error);
  }
}

export function loadCachedData(): CachedState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedState;
  } catch {
    return null;
  }
}

export function clearCachedData() {
  localStorage.removeItem(CACHE_KEY);
}

