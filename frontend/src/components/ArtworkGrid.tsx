import { useState, useEffect, useRef } from 'react';
import { Artist, Artwork, markArtworkSeen, markAllSeen, toggleFavorite } from '../api';
import { toast } from 'react-hot-toast';
import ArtworkPreviewModal from './ArtworkPreviewModal';
import './ArtworkGrid.css';

interface ArtworkGridProps {
  artworks: Artwork[];
  showNewOnly: boolean;
  onToggleNewOnly: () => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  onArtworkSeen: () => void;
  selectedArtist?: Artist;
  onScrapeArtist?: (artistId: number) => Promise<void>;
  isLoading?: boolean;
  onOpenMobileArtistList?: () => void;
}

function ArtworkGrid({ artworks, showNewOnly, onToggleNewOnly, showFavorites, onToggleFavorites, onArtworkSeen, selectedArtist, onScrapeArtist, isLoading = false, onOpenMobileArtistList }: ArtworkGridProps) {
  const newCount = artworks.filter(a => a.is_new).length;
  const [isScraping, setIsScraping] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [previewArtwork, setPreviewArtwork] = useState<Artwork | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = gridRef.current;
    if (!target) return;

    const handleScroll = () => {
      setShowBackToTop(target.scrollTop > 400);
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    gridRef.current.scrollTo({ top: 0 });
  }, [selectedArtist?.id, showNewOnly]);

  const scrollToTop = () => {
    gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkSeen = async (artworkId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await markArtworkSeen(artworkId);
      onArtworkSeen();
      // Update preview artwork if it's currently open
      if (previewArtwork?.id === artworkId) {
        setPreviewArtwork({ ...previewArtwork, is_new: 0 });
      }
    } catch (error) {
      toast.error('Failed to mark as seen');
    }
  };

  const handleToggleFavorite = async (artworkId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await toggleFavorite(artworkId);
      onArtworkSeen(); // Refresh artworks to update favorite status
      // Update preview artwork if it's currently open
      if (previewArtwork?.id === artworkId) {
        const currentFavorite = previewArtwork.is_favorite || 0;
        setPreviewArtwork({ ...previewArtwork, is_favorite: currentFavorite === 1 ? 0 : 1 });
      }
    } catch (error) {
      toast.error('Failed to toggle favorite');
    }
  };

  const handlePreviewClick = (artwork: Artwork, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewArtwork(artwork);
  };

  const handleClosePreview = () => {
    setPreviewArtwork(null);
  };

  const handlePreviewMarkSeen = async (artworkId: number) => {
    try {
      await markArtworkSeen(artworkId);
      onArtworkSeen();
      if (previewArtwork?.id === artworkId) {
        setPreviewArtwork({ ...previewArtwork, is_new: 0 });
      }
      toast.success('Marked as seen');
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
    <>
      <main className="artwork-grid-container" ref={gridRef}>
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
              {showFavorites ? (
                <>Favorites</>
              ) : selectedArtist ? (
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
          {newCount > 0 && !showFavorites && (
            <button 
              className="btn btn-secondary"
              onClick={handleMarkAllSeen}
            >
              <img 
                src="/icons/check.svg" 
                alt="" 
                className="btn-check-icon"
                aria-hidden="true"
              />
              Mark All as Seen
            </button>
          )}
          
          <button
            className={`btn ${showFavorites ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onToggleFavorites}
          >
            {showFavorites ? '❤️ Favorites' : 'Show Favorites'}
          </button>
          
          {!showFavorites && (
            <button
              className={`btn ${showNewOnly ? 'btn-primary' : 'btn-secondary'}`}
              onClick={onToggleNewOnly}
            >
              {showNewOnly ? 'New Only' : 'Show All'}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="empty-artworks">
          <img 
            src="/icons/Refresh.svg" 
            alt="" 
            className="loading-indicator loading-spin"
            aria-hidden="true"
          />
          <p>Loading artworks...</p>
          <p className="empty-hint">Please wait</p>
        </div>
      ) : artworks.length === 0 ? (
        <div className="empty-artworks">
          <p>
            {showFavorites
              ? 'No favorites yet. Click the heart icon on any artwork to add it to your favorites.'
              : showNewOnly 
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
              <button
                className="artwork-preview-btn"
                onClick={(e) => handlePreviewClick(artwork, e)}
                title="Preview artwork"
                aria-label="Preview artwork"
              >
                <img src="/icons/enlarge.svg" alt="Preview" className="enlarge-icon" />
              </button>

              <button
                className="artwork-favorite-btn"
                onClick={(e) => handleToggleFavorite(artwork.id, e)}
                title={(artwork.is_favorite || 0) === 1 ? "Remove from favorites" : "Add to favorites"}
                aria-label={(artwork.is_favorite || 0) === 1 ? "Remove from favorites" : "Add to favorites"}
              >
                <img 
                  src={(artwork.is_favorite || 0) === 1 ? "/icons/favorite.svg" : "/icons/nofavorite.svg"} 
                  alt={(artwork.is_favorite || 0) === 1 ? "Favorite" : "Not favorite"} 
                  className="favorite-icon" 
                />
              </button>

              {artwork.is_new === 1 && (
                <div className="new-indicator">
                  <span className="new-label">NEW</span>
                  <button
                    className="mark-seen-btn"
                    onClick={(e) => handleMarkSeen(artwork.id, e)}
                    title="Mark as seen"
                  >
                    <img 
                      src="/icons/check.svg" 
                      alt="" 
                      className="mark-seen-icon"
                      aria-hidden="true"
                    />
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
      {showBackToTop && (
        <button 
          className="back-to-top" 
          type="button" 
          onClick={scrollToTop} 
          aria-label="Back to top"
        >
          ↑
        </button>
      )}

      {previewArtwork && (
        <ArtworkPreviewModal
          artwork={previewArtwork}
          onClose={handleClosePreview}
          onMarkSeen={handlePreviewMarkSeen}
          onFavoriteToggle={() => {
            onArtworkSeen(); // Refresh artworks to update favorite status
            // Update preview artwork favorite status
            const currentFavorite = previewArtwork.is_favorite || 0;
            setPreviewArtwork({ ...previewArtwork, is_favorite: currentFavorite === 1 ? 0 : 1 });
          }}
        />
      )}
    </>
  );
}

export default ArtworkGrid;

