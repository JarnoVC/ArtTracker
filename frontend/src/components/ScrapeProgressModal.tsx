import { useEffect, useState } from 'react';
import { Artist, getAuthToken } from '../api';
import axios from 'axios';
import './ScrapeProgressModal.css';

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
    for (let i = 0; i < artists.length; i++) {
      const artist = artists[i];
      
      // Step 1: Check for updates (optimized check)
      setProgress(prev => prev.map((p, idx) => 
        idx === i ? { ...p, status: 'checking' } : p
      ));
      setCurrentIndex(i);

      try {
        // Use optimized scraping endpoint (checks first, only scrapes if updates exist)
        // Get token dynamically for each request
        const token = getAuthToken();
        const response = await axios.post(`/api/scrape/artist/${artist.id}?optimized=true`, {}, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        const result = response.data;
        
        // Handle skipped status (no updates)
        if (result.status === 'skipped') {
          setProgress(prev => prev.map((p, idx) => 
            idx === i ? { 
              ...p, 
              status: 'skipped',
              reason: result.reason || 'no_updates',
              newArtworks: 0
            } : p
          ));
        } else {
          // Has updates, was scraped
          setProgress(prev => prev.map((p, idx) => 
            idx === i ? { 
              ...p, 
              status: 'completed',
              newArtworks: result.new_artworks || 0
            } : p
          ));
        }
      } catch (error: any) {
        console.error(`Error scraping artist ${artist.id}:`, error);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to scrape';
        setProgress(prev => prev.map((p, idx) => 
          idx === i ? { 
            ...p, 
            status: 'failed',
            error: errorMessage
          } : p
        ));
      }

      // Small delay between artists
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsComplete(true);
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
            <div className="progress-bar">
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
                key={artist.id} 
                className={`artist-progress-item ${artist.status} ${index === currentIndex && !isComplete ? 'current' : ''}`}
              >
                <div className="artist-progress-icon">
                  {artist.status === 'pending' && '⏳'}
                  {(artist.status === 'checking' || artist.status === 'scraping') && (
                    <span className="spinner-small">🔄</span>
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

