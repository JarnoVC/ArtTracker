import { useState } from 'react';
import { Artist, deleteArtist } from '../api';
import { toast } from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import './ArtistList.css';

interface ArtistListProps {
  artists: Artist[];
  selectedArtistId: number | null;
  onSelectArtist: (id: number | null) => void;
  onArtistDeleted: () => void;
  onSyncWithArtStation: () => void;
  isLoading?: boolean;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

function ArtistList({ artists, selectedArtistId, onSelectArtist, onArtistDeleted, onSyncWithArtStation, isLoading = false, isMobileOpen = false, onMobileClose }: ArtistListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (artistId: number) => {
    setDeletingId(artistId);
    try {
      await deleteArtist(artistId);
      toast.success('Artist removed');
      onArtistDeleted();
    } catch (error) {
      toast.error('Failed to remove artist');
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, artistId: number) => {
    e.stopPropagation();
    setPendingDeleteId(artistId);
  };

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredArtists = normalizedQuery
    ? artists.filter((artist) => {
        const usernameMatch = artist.username.toLowerCase().includes(normalizedQuery);
        const displayNameMatch = artist.display_name
          ? artist.display_name.toLowerCase().includes(normalizedQuery)
          : false;
        return usernameMatch || displayNameMatch;
      })
    : artists;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncWithArtStation();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {pendingDeleteId !== null && (
        <ConfirmModal
          title="Unfollow artist"
          message="Are you sure you want to unfollow this artist? This will also stop checking for new artworks from them."
          confirmText="Unfollow"
          cancelText="Cancel"
          confirmButtonClass="btn-error"
          onConfirm={() => handleDelete(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
      {/* Mobile overlay */}
      {isMobileOpen && onMobileClose && (
        <div className="mobile-overlay" onClick={onMobileClose}></div>
      )}
      <aside className={`artist-list ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="artist-list-header">
          <h2>Following ({artists.length})</h2>
          <div className="artist-list-header-actions">
            <button 
              className={`btn-icon ${isSyncing ? 'syncing' : ''}`}
              onClick={handleSync} 
              disabled={isSyncing}
              title="Sync with ArtStation (re-import following list)"
            >
              {isSyncing ? (
                <span className="spinner spinner-small" aria-hidden="true"></span>
              ) : (
                <img
                  src="/icons/Refresh.svg"
                  alt="Refresh following list"
                  className="btn-icon-image"
                />
              )}
            </button>
            {onMobileClose && (
              <button 
                className="btn-icon mobile-close-btn"
                onClick={onMobileClose}
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

      <div className="filter-section">
        <button
          className={`filter-btn ${selectedArtistId === null ? 'active' : ''}`}
          onClick={() => onSelectArtist(null)}
        >
          <img 
            src="/icons/All.svg" 
            alt="" 
            className="filter-btn-icon"
            aria-hidden="true"
          />
          All Artists
        </button>
        <div className="artist-search">
          <input
            type="text"
            className="artist-search-input"
            placeholder="Search artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="artist-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="artists-scroll">
        {isLoading || isSyncing ? (
          <div className="empty-state">
            <img 
              src="/icons/Refresh.svg" 
              alt="" 
              className="loading-indicator loading-spin"
              aria-hidden="true"
            />
            <p>Loading artists...</p>
            <p className="empty-hint">Please wait</p>
          </div>
        ) : artists.length === 0 ? (
          <div className="empty-state">
            <p>No artists yet</p>
            <p className="empty-hint">Click "Add Artist" to start tracking</p>
          </div>
        ) : filteredArtists.length === 0 ? (
          <div className="empty-state">
            <p>No matching artists</p>
            <p className="empty-hint">
              {searchTerm ? `Try a different search term` : 'Click "Add Artist" to start tracking'}
            </p>
          </div>
        ) : (
          filteredArtists.map((artist) => (
            <div
              key={artist.id}
              className={`artist-card ${selectedArtistId === artist.id ? 'selected' : ''}`}
              onClick={() => onSelectArtist(artist.id)}
            >
              <div className="artist-info">
                {artist.avatar_url ? (
                  <img 
                    src={artist.avatar_url} 
                    alt={artist.username}
                    className="artist-avatar"
                  />
                ) : (
                  <div className="artist-avatar-placeholder">
                    {artist.username[0].toUpperCase()}
                  </div>
                )}
                
                <div className="artist-details">
                  <div className="artist-name">
                    {artist.display_name || artist.username}
                  </div>
                  <div className="artist-username">@{artist.username}</div>
                  {artist.last_checked && (
                    <div className="artist-last-checked">
                      Last checked: {new Date(artist.last_checked).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <button
                className="btn-delete"
                onClick={(e) => handleDeleteClick(e, artist.id)}
                disabled={deletingId === artist.id}
                title="Unfollow"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
    </>
  );
}

export default ArtistList;

