import { useState } from 'react';
import { importFollowing, getArtists, Artist } from '../api';
import { toast } from 'react-hot-toast';
import './ImportFollowingModal.css';

// Helper to ensure React renders state updates
const flushRender = () => new Promise(resolve => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 100);
    });
  });
});

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
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'fetching' | 'processing' | 'complete'>('idle');
  const [currentStatus, setCurrentStatus] = useState('');
  const [artistsFound, setArtistsFound] = useState(0);
  const [artistsAdded, setArtistsAdded] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ArtStation username is optional - if not provided, uses the one from user profile
    // If user doesn't have one stored, backend will return an error
    
    setIsLoading(true);
    setResults(null);
    setLoadingPhase('fetching');
    setCurrentStatus('Fetching your following list from ArtStation...');
    setArtistsFound(0);
    setArtistsAdded(0);
    
    // Allow React to render the initial "fetching" state
    await flushRender();
    
    try {
      // First, import artists without scraping artworks (we'll do that with progress modal)
      // Pass username only if provided, otherwise empty string to use profile's ArtStation username
      
      // Update status to "processing" - allow React to render this change
      // Note: During the importFollowing() call below, React can't render updates
      // because JavaScript is blocking on the await. This is why we update the status
      // BEFORE the blocking call, and then update it AFTER the call completes.
      setLoadingPhase('processing');
      setCurrentStatus('Processing artists and adding to your list...');
      await flushRender();
      
      // This is a blocking call - React can't render during this time
      const importResults = await importFollowing(username.trim() || '', clearExisting, true);
      
      setResults(importResults);
      setLoadingPhase('complete');
      setArtistsFound(importResults.total_found || 0);
      setArtistsAdded(importResults.added || 0);
      
      // Allow React to render the complete state with artist counts
      await flushRender();
      
      // If we have newly added artists, show progress modal to load their artworks
      if (importResults.newly_added_artist_ids && importResults.newly_added_artist_ids.length > 0) {
        // Show a clear message about what's happening next
        const artistCount = importResults.newly_added_artist_ids.length;
        setCurrentStatus(`Found ${artistCount} new artist${artistCount > 1 ? 's' : ''}! Loading their artworks...`);
        setArtistsFound(importResults.total_found || 0);
        setArtistsAdded(importResults.added || 0);
        
        // Allow React to render the status update before closing - longer delay so user sees it
        await flushRender();
        await new Promise(resolve => setTimeout(resolve, 2500));
        
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
        setCurrentStatus('Import complete!');
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
      setLoadingPhase('idle');
      setCurrentStatus('');
      toast.error(error.response?.data?.error || 'Failed to import following list');
    } finally {
      setIsLoading(false);
      if (results && (!results.newly_added_artist_ids || results.newly_added_artist_ids.length === 0)) {
        setLoadingPhase('idle');
      }
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
            {!isLoading && !results && (
              <>
                <p className="import-description">
                  Import all artists you follow on ArtStation. Your ArtStation username is stored privately and not displayed.
                </p>
                
                <label htmlFor="username" className="form-label">
                  ArtStation Username (Optional)
                </label>
              </>
            )}

            {isLoading && (
              <div className="import-progress">
                <div className="progress-status">
                  <span className="progress-icon">
                    {loadingPhase === 'fetching' && '🔍'}
                    {loadingPhase === 'processing' && '⚙️'}
                    {loadingPhase === 'complete' && '✓'}
                  </span>
                  <div className="progress-text">
                    <p className="progress-main">{currentStatus}</p>
                    {artistsFound > 0 && (
                      <p className="progress-detail">
                        Found {artistsFound} artist{artistsFound !== 1 ? 's' : ''} 
                        {artistsAdded > 0 && ` · ${artistsAdded} new`}
                      </p>
                    )}
                  </div>
                </div>
                
                {(loadingPhase === 'fetching' || loadingPhase === 'processing' || 
                  (loadingPhase === 'complete' && currentStatus.includes('Loading their artworks'))) && (
                  <div className="progress-bar-container">
                    <div className="progress-bar-indeterminate">
                      <div className="progress-bar-fill"></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && !results && (
              <>
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
              </>
            )}

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
                      {loadingPhase === 'fetching' ? 'Fetching...' : 
                       loadingPhase === 'processing' ? 'Processing...' : 
                       'Importing...'}
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

