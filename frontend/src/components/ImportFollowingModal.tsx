import { useState } from 'react';
import { importFollowing, getArtists, Artist } from '../api';
import { toast } from 'react-hot-toast';
import './ImportFollowingModal.css';

interface ImportFollowingModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  onShowProgress: (artists: Artist[]) => void;
}

function ImportFollowingModal({ onClose, onImportComplete, onShowProgress }: ImportFollowingModalProps) {
  const [username, setUsername] = useState('');
  const [clearExisting, setClearExisting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ArtStation username is optional - if not provided, uses the one from user profile
    // If user doesn't have one stored, backend will return an error
    
    setIsLoading(true);
    setResults(null);
    
    try {
      // First, import artists without scraping artworks (we'll do that with progress modal)
      // Pass username only if provided, otherwise empty string to use profile's ArtStation username
      const importResults = await importFollowing(username.trim() || '', clearExisting, true);
      
      setResults(importResults);
      
      // If we have newly added artists, show progress modal to load their artworks
      if (importResults.newly_added_artist_ids && importResults.newly_added_artist_ids.length > 0) {
        // Fetch the artist details for the progress modal
        const allArtists = await getArtists();
        const newlyAddedArtists = allArtists.filter(artist => 
          importResults.newly_added_artist_ids.includes(artist.id)
        );
        
        // Close this modal and show progress modal (onImportComplete will be called after scraping completes)
        onClose();
        onShowProgress(newlyAddedArtists);
      } else {
        // No new artists to scrape, just reload data and close
        if (importResults.added > 0) {
          toast.success(`Successfully imported ${importResults.added} artist${importResults.added > 1 ? 's' : ''}!`);
        } else if (importResults.already_exists === importResults.total_found) {
          toast('All artists already in your list', { icon: '✓' });
        } else {
          toast.success('Import complete!');
        }
        onImportComplete();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to import following list');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal import-modal">
        <div className="modal-header">
          <h2>Import Following List</h2>
          {!isLoading && (
            <button className="btn-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="import-description">
              Import all artists you follow on ArtStation. Your ArtStation username is stored privately and not displayed.
            </p>
            
            <label htmlFor="username" className="form-label">
              ArtStation Username (Optional)
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="Leave empty to use saved username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={isLoading}
            />
            <p className="form-hint">
              {username.trim() 
                ? 'This will update your saved ArtStation username and import artists.' 
                : 'If you\'ve set an ArtStation username before, it will be used. Otherwise, enter one now.'}
            </p>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                disabled={isLoading}
              />
              <span>Replace existing artists (recommended)</span>
            </label>
            <p className="form-hint">
              {clearExisting 
                ? '⚠️ This will remove all current artists and replace them with your followed list.' 
                : 'This will add to your existing artists (may create duplicates).'
              }
            </p>

            {results && (
              <div className="import-results">
                <h3>Import Results</h3>
                <div className="result-stats">
                  <div className="stat">
                    <span className="stat-value">{results.total_found}</span>
                    <span className="stat-label">Found</span>
                  </div>
                  <div className="stat stat-success">
                    <span className="stat-value">{results.added}</span>
                    <span className="stat-label">Added</span>
                  </div>
                  {results.artworks_loaded > 0 && (
                    <div className="stat stat-success">
                      <span className="stat-value">{results.artworks_loaded}</span>
                      <span className="stat-label">Artworks loaded</span>
                    </div>
                  )}
                  <div className="stat stat-info">
                    <span className="stat-value">{results.already_exists}</span>
                    <span className="stat-label">Already existed</span>
                  </div>
                  {results.failed > 0 && (
                    <div className="stat stat-error">
                      <span className="stat-value">{results.failed}</span>
                      <span className="stat-label">Failed</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {!results && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner">🔄</span>
                      Importing...
                    </>
                  ) : (
                    'Import Following'
                  )}
                </button>
              </>
            )}
            {results && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
              >
                Done
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default ImportFollowingModal;

