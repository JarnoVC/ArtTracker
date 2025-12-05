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
          <h2 className="sync-modal-title">
            {isComplete ? (
              <>
                <img 
                  src="/icons/check.svg" 
                  alt="" 
                  className="check-icon"
                  aria-hidden="true"
                />
                Sync Complete!
              </>
            ) : (
              <>
                <img 
                  src="/icons/Refresh.svg" 
                  alt="" 
                  className="refresh-icon loading-spin"
                  aria-hidden="true"
                />
                Syncing with ArtStation...
              </>
            )}
          </h2>
        </div>

        <div className="modal-body">
          {!isComplete ? (
            <div className="sync-loading">
              <div className="sync-spinner">
                <div className="spinner spinner-large" aria-hidden="true"></div>
              </div>
              <p>Fetching your following list from ArtStation...</p>
              <p className="sync-hint">This may take a moment</p>
            </div>
          ) : (
            <div className="sync-complete">
              <img 
                src="/icons/check.svg" 
                alt="" 
                className="sync-success-icon"
                aria-hidden="true"
              />
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
              <span className="spinner" aria-hidden="true"></span>
              Please wait...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SyncProgressModal;

