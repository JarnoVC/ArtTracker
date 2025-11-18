import { useState } from 'react';
import { Artist, Artwork, markArtworkSeen, markAllSeen } from '../api';
import { toast } from 'react-hot-toast';
import './ArtworkGrid.css';

interface ArtworkGridProps {
  artworks: Artwork[];
  showNewOnly: boolean;
  onToggleNewOnly: () => void;
  onArtworkSeen: () => void;
  selectedArtist?: Artist;
  onScrapeArtist?: (artistId: number) => Promise<void>;
  isLoading?: boolean;
  onOpenMobileArtistList?: () => void;
}

function ArtworkGrid({ artworks, showNewOnly, onToggleNewOnly, onArtworkSeen, selectedArtist, onScrapeArtist, isLoading = false, onOpenMobileArtistList }: ArtworkGridProps) {
  const newCount = artworks.filter(a => a.is_new).length;
  const [isScraping, setIsScraping] = useState(false);

  const handleMarkSeen = async (artworkId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await markArtworkSeen(artworkId);
      onArtworkSeen();
    } catch (error) {
      toast.error('Failed to mark as seen');
    }
  };

  const handleMarkAllSeen = async () => {
    try {
      await markAllSeen(selectedArtist?.id);
      toast.success('All marked as seen');
      onArtworkSeen();
    } catch (error) {
      toast.error('Failed to mark all as seen');
    }
  };

  const handleLoadArtworks = async () => {
    if (!selectedArtist || !onScrapeArtist) return;
    
    setIsScraping(true);
    try {
      await onScrapeArtist(selectedArtist.id);
    } catch (error) {
      // Error is handled in parent
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <main className="artwork-grid-container">
      <div className="artwork-header">
        <div className="artwork-header-left">
          {onOpenMobileArtistList && (
            <button 
              className="mobile-menu-toggle"
              onClick={onOpenMobileArtistList}
              title="Show Artists"
            >
              ☰
            </button>
          )}
          <div className="artwork-header-title">
            <h2>
              {selectedArtist ? (
                <>Artworks by @{selectedArtist.username}</>
              ) : (
                <>Latest from All Artists</>
              )}
            </h2>
            <span className="artwork-count">
              {selectedArtist ? (
                `${artworks.length} artwork${artworks.length !== 1 ? 's' : ''}`
              ) : (
                `Latest from ${artworks.length} artist${artworks.length !== 1 ? 's' : ''}`
              )}
              {newCount > 0 && ` · ${newCount} new`}
            </span>
          </div>
        </div>

        <div className="artwork-actions">
          {newCount > 0 && (
            <button 
              className="btn btn-secondary"
              onClick={handleMarkAllSeen}
            >
              ✓ Mark All as Seen
            </button>
          )}
          
          <button
            className={`btn ${showNewOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onToggleNewOnly}
          >
            {showNewOnly ? '🔴 New Only' : '📋 Show All'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-artworks">
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🔄</div>
          <p>Loading artworks...</p>
          <p className="empty-hint">Please wait</p>
        </div>
      ) : artworks.length === 0 ? (
        <div className="empty-artworks">
          <p>
            {showNewOnly 
              ? 'No new artworks' 
              : selectedArtist 
                ? 'No artworks found for this artist yet.' 
                : 'No artworks yet. Add artists and click "Check for Updates"'
            }
          </p>
          {selectedArtist && !showNewOnly && (
            <div className="empty-artworks-actions">
              <button
                className="btn btn-primary"
                onClick={handleLoadArtworks}
                disabled={isScraping}
              >
                {isScraping ? '⏳ Loading Artworks...' : '🎨 Load Artworks'}
              </button>
              <p className="empty-hint">
                This will fetch all artworks from @{selectedArtist.username}
              </p>
            </div>
          )}
          {!selectedArtist && !showNewOnly && (
            <p className="empty-hint">
              💡 Tip: Click an artist on the left to see all their artworks
            </p>
          )}
        </div>
      ) : (
        <div className="artwork-grid">
          {artworks.map((artwork) => (
            <a
              key={artwork.id}
              href={artwork.artwork_url}
              target="_blank"
              rel="noopener noreferrer"
              className="artwork-card"
            >
              {artwork.is_new === 1 && (
                <div className="new-indicator">
                  <span className="new-label">NEW</span>
                  <button
                    className="mark-seen-btn"
                    onClick={(e) => handleMarkSeen(artwork.id, e)}
                    title="Mark as seen"
                  >
                    ✓
                  </button>
                </div>
              )}

              <div className="artwork-image-container">
                {artwork.thumbnail_url ? (
                  <img 
                    src={artwork.thumbnail_url} 
                    alt={artwork.title}
                    className="artwork-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="artwork-placeholder">
                    🖼️
                  </div>
                )}
              </div>

              <div className="artwork-info">
                <h3 className="artwork-title">{artwork.title}</h3>
                <p className="artwork-artist">
                  @{artwork.username || 'Unknown'}
                </p>
                {(artwork.upload_date || artwork.discovered_at) && (
                  <p className="artwork-date">
                    {new Date(artwork.upload_date || artwork.discovered_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}

export default ArtworkGrid;

