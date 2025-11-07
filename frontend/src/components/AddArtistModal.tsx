import { useState } from 'react';
import { addArtist } from '../api';
import { toast } from 'react-hot-toast';
import './AddArtistModal.css';

interface AddArtistModalProps {
  onClose: () => void;
  onArtistAdded: () => void;
}

function AddArtistModal({ onClose, onArtistAdded }: AddArtistModalProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error('Please enter a username or URL');
      return;
    }

    setIsLoading(true);
    try {
      await addArtist(username.trim());
      toast.success('Artist added successfully!');
      onArtistAdded();
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Artist already exists');
      } else {
        toast.error('Failed to add artist');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal">
        <div className="modal-header">
          <h2>Add Artist</h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label htmlFor="username" className="form-label">
              ArtStation Username or Profile URL
            </label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="e.g., 'bobby_rebholz' or full URL"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={isLoading}
            />
            <p className="form-hint">
              Enter just the username or paste the full ArtStation profile URL
            </p>
          </div>

          <div className="modal-footer">
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
              {isLoading ? 'Adding...' : 'Add Artist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddArtistModal;

