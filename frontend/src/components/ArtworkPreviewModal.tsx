import { useEffect } from 'react';
import { Artwork } from '../api';
import './ArtworkPreviewModal.css';

interface ArtworkPreviewModalProps {
  artwork: Artwork | null;
  onClose: () => void;
  onMarkSeen?: (artworkId: number) => void;
}

function ArtworkPreviewModal({ artwork, onClose, onMarkSeen }: ArtworkPreviewModalProps) {
  useEffect(() => {
    if (!artwork) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [artwork, onClose]);

  if (!artwork) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleMarkSeen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkSeen) {
      onMarkSeen(artwork.id);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="modal-backdrop artwork-preview-backdrop" onClick={handleBackdropClick}>
      <div className="artwork-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="artwork-preview-close"
          onClick={onClose}
          aria-label="Close preview"
          title="Close (Esc)"
        >
          ✕
        </button>

        <div className="artwork-preview-content">
          <div className="artwork-preview-image-container">
            {artwork.high_quality_image_url ? (
              <img
                src={artwork.high_quality_image_url}
                alt={artwork.title}
                className="artwork-preview-image"
              />
            ) : artwork.thumbnail_url ? (
              <img
                src={artwork.thumbnail_url}
                alt={artwork.title}
                className="artwork-preview-image"
              />
            ) : (
              <div className="artwork-preview-placeholder">
                🖼️
              </div>
            )}
          </div>

          <div className="artwork-preview-info">
            <div className="artwork-preview-header">
              <h2 className="artwork-preview-title">{artwork.title}</h2>
              {artwork.is_new === 1 && (
                <span className="artwork-preview-new-badge">NEW</span>
              )}
            </div>

            <div className="artwork-preview-meta">
              <p className="artwork-preview-artist">
                <span className="meta-label">Artist:</span>
                <a
                  href={"https://www.artstation.com/" + artwork.username}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="artist-link"
                >
                  @{artwork.username || artwork.display_name || 'Unknown'}
                </a>
              </p>

              {(artwork.upload_date || artwork.discovered_at) && (
                <p className="artwork-preview-date">
                  <span className="meta-label">Date:</span>
                  {formatDate(artwork.upload_date || artwork.discovered_at)}
                </p>
              )}
            </div>

            <div className="artwork-preview-actions">
              <a
                href={artwork.artwork_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                View on ArtStation →
              </a>
              {artwork.is_new === 1 && onMarkSeen && (
                <button
                  className="btn btn-secondary"
                  onClick={handleMarkSeen}
                >
                  ✓ Mark as Seen
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArtworkPreviewModal;

