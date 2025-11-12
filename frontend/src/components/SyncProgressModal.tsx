import './SyncProgressModal.css';

interface SyncProgressModalProps {
  isComplete: boolean;
  onComplete: () => void;
}

function SyncProgressModal({ isComplete, onComplete }: SyncProgressModalProps) {
  return (
    <div className="modal-backdrop sync-modal-backdrop">
      <div className="modal sync-progress-modal">
        <div className="modal-header">
          <h2>
            {isComplete ? '✅ Sync Complete!' : '🔄 Syncing with ArtStation...'}
          </h2>
        </div>

        <div className="modal-body">
          {!isComplete ? (
            <div className="sync-loading">
              <div className="sync-spinner">
                <div className="spinner-large">🔄</div>
              </div>
              <p>Fetching your following list from ArtStation...</p>
              <p className="sync-hint">This may take a moment</p>
            </div>
          ) : (
            <div className="sync-complete">
              <div className="sync-success-icon">✓</div>
              <p>Sync completed successfully!</p>
            </div>
          )}
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
            <div className="syncing-notice">
              <span className="spinner">⏳</span>
              Please wait...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SyncProgressModal;

