import { useEffect, useState } from 'react';
import { Artist, getAuthToken } from '../api';
import axios from 'axios';
import './ScrapeProgressModal.css';

// Use the same API_BASE as api.ts
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Create axios instance with base URL and default auth header
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface ScrapeProgressModalProps {
  artists: Artist[];
  onComplete: () => void;
}

interface ArtistProgress {
  id: number;
  username: string;
  status: 'pending' | 'checking' | 'scraping' | 'completed' | 'skipped' | 'failed';
  newArtworks?: number;
  error?: string;
  reason?: string;
}

function ScrapeProgressModal({ artists, onComplete }: ScrapeProgressModalProps) {
  const [progress, setProgress] = useState<ArtistProgress[]>(
    artists.map(a => ({
      id: a.id,
      username: a.username,
      status: 'pending'
    }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    scrapeArtists();
  }, []);

  const scrapeArtists = async () => {
    // Always use individual requests for real-time progress updates
    // This provides better UX as users can see each artist being processed
    for (let i = 0; i < artists.length; i++) {
      const artist = artists[i];
      
      // Update status to checking and current index
      setCurrentIndex(i);
      setProgress(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'checking' };
        return updated;
      });

      // Give React time to render the update
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        // Use optimized scraping endpoint (checks first, only scrapes if updates exist)
        console.log(`[${i + 1}/${artists.length}] Scraping artist ${artist.id} (${artist.username})...`);
        
        // Update to scraping status
        setProgress(prev => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'scraping' };
          return updated;
        });
        
        // Small delay to show scraping state
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const response = await apiClient.post(`/scrape/artist/${artist.id}?optimized=true`, {});
        
        const result = response.data;
        
        // Handle skipped status (no updates)
        if (result.status === 'skipped') {
          setProgress(prev => {
            const updated = [...prev];
            updated[i] = { 
              ...updated[i], 
              status: 'skipped',
              reason: result.reason || 'no_updates',
              newArtworks: 0
            };
            return updated;
          });
          console.log(`  ✓ ${artist.username}: Skipped (no updates)`);
        } else {
          // Has updates, was scraped
          const newArtworks = result.new_artworks || 0;
          const totalFound = result.total_found || 0;
          setProgress(prev => {
            const updated = [...prev];
            updated[i] = { 
              ...updated[i], 
              status: 'completed',
              newArtworks: newArtworks
            };
            return updated;
          });
          console.log(`  ✓ ${artist.username}: Completed (${newArtworks} new, ${totalFound} total)`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error scraping artist ${artist.id} (${artist.username}):`, error);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to scrape';
        setProgress(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            status: 'failed',
            error: errorMessage
          };
          return updated;
        });
      }

      // Small delay between artists to avoid overwhelming the backend
      // Also allows UI to update smoothly and shows progress
      if (i < artists.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Clear current index when done
    setCurrentIndex(-1);
    setIsComplete(true);
    console.log(`✅ All artists processed!`);
  };

  const completedCount = progress.filter(p => p.status === 'completed').length;
  const skippedCount = progress.filter(p => p.status === 'skipped').length;
  const failedCount = progress.filter(p => p.status === 'failed').length;
  const totalNewArtworks = progress.reduce((sum, p) => sum + (p.newArtworks || 0), 0);
  const processedCount = completedCount + skippedCount + failedCount;
  const progressPercent = Math.round((processedCount / artists.length) * 100);

  return (
    <div className="modal-backdrop scrape-modal-backdrop">
      <div className="modal scrape-progress-modal">
        <div className="modal-header">
          <h2>
            {isComplete ? '✅ Check Complete!' : '🔄 Checking for Updates...'}
          </h2>
        </div>

        <div className="modal-body">
          {/* Overall Progress Bar */}
          <div className="overall-progress">
            <div className="progress-header">
              <span className="progress-label">
                Progress: {processedCount} / {artists.length} artists
              </span>
              <span className="progress-percent">{progressPercent}%</span>
            </div>
            <div className="progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Scraping progress">
              <div 
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          {isComplete && (
            <div className="scrape-stats">
              <div className="stat">
                <span className="stat-icon">✓</span>
                <span className="stat-value">{completedCount}</span>
                <span className="stat-label">Updated</span>
              </div>
              {skippedCount > 0 && (
                <div className="stat stat-info">
                  <span className="stat-icon">⏭</span>
                  <span className="stat-value">{skippedCount}</span>
                  <span className="stat-label">Skipped</span>
                </div>
              )}
              <div className="stat stat-highlight">
                <span className="stat-icon">🎨</span>
                <span className="stat-value">{totalNewArtworks}</span>
                <span className="stat-label">New Artworks</span>
              </div>
              {failedCount > 0 && (
                <div className="stat stat-error">
                  <span className="stat-icon">✗</span>
                  <span className="stat-value">{failedCount}</span>
                  <span className="stat-label">Failed</span>
                </div>
              )}
            </div>
          )}

          {/* Artist List */}
          <div className="artist-progress-list">
            {progress.map((artist, index) => (
              <div 
                key={`${artist.id}-${artist.status}-${index}`}
                className={`artist-progress-item ${artist.status} ${index === currentIndex && !isComplete ? 'current' : ''}`}
              >
                <div className="artist-progress-icon">
                  {artist.status === 'pending' && '⏳'}
                  {artist.status === 'checking' && (
                    <span className="spinner-small" title="Checking for updates">🔄</span>
                  )}
                  {artist.status === 'scraping' && (
                    <span className="spinner-small" title="Scraping artworks">⏳</span>
                  )}
                  {artist.status === 'completed' && '✓'}
                  {artist.status === 'skipped' && '⏭'}
                  {artist.status === 'failed' && '✗'}
                </div>
                
                <div className="artist-progress-info">
                  <span className="artist-progress-name">@{artist.username}</span>
                  {artist.status === 'checking' && (
                    <span className="artist-progress-result">Checking...</span>
                  )}
                  {artist.status === 'scraping' && (
                    <span className="artist-progress-result">Scraping...</span>
                  )}
                  {artist.status === 'completed' && artist.newArtworks !== undefined && (
                    <span className="artist-progress-result">
                      {artist.newArtworks > 0 
                        ? `+${artist.newArtworks} new` 
                        : 'Up to date'
                      }
                    </span>
                  )}
                  {artist.status === 'skipped' && (
                    <span className="artist-progress-result">No updates</span>
                  )}
                  {artist.status === 'failed' && (
                    <span className="artist-progress-error">Failed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          {isComplete ? (
            <button 
              className="btn btn-primary"
              onClick={onComplete}
            >
              Done
            </button>
          ) : (
            <div className="scraping-notice">
              <span className="spinner">⏳</span>
              Checking artists for updates...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScrapeProgressModal;

