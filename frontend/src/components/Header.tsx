import './Header.css';
import { User } from '../api';
import { useState } from 'react';

interface HeaderProps {
  onImportFollowing: () => void;
  onScrapeAll: () => void;
  isScraping: boolean;
  newCount: number;
  user: User | null;
  onLogout: () => void;
  onOpenSettings: () => void;
}

function Header({ onImportFollowing, onScrapeAll, isScraping, newCount, user, onLogout, onOpenSettings }: HeaderProps) {
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);

  const toggleMobileActions = () => {
    setIsMobileActionsOpen(prev => !prev);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="logo">🎨 ArtTracker</h1>
          {newCount > 0 && (
            <span className="new-badge">{newCount} new</span>
          )}
          {user && (
            <span className="user-badge">@{user.username}</span>
          )}
        </div>
        <div className="header-actions-wrapper">
          <button
            className="header-actions-toggle"
            type="button"
            onClick={toggleMobileActions}
            aria-controls="header-actions-panel"
          >
            Quick Actions
            <span className={`toggle-icon ${isMobileActionsOpen ? 'open' : ''}`} aria-hidden="true">▾</span>
          </button>

          <div
            id="header-actions-panel"
            className={`header-actions ${isMobileActionsOpen ? 'is-open' : ''}`}
          >
            {user && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={onOpenSettings}
                  title="Settings"
                >
                  ⚙️ Settings
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={onLogout}
                  title="Logout"
                >
                  🚪 Logout
                </button>
              </>
            )}
            <button
              className="btn btn-secondary"
              onClick={onScrapeAll}
              disabled={isScraping}
            >
              {isScraping ? '⏳ Scraping...' : '🔄 Check for Updates'}
            </button>
            
            <button
              className="btn btn-accent"
              onClick={onImportFollowing}
              title="Import all artists you follow on ArtStation"
            >
              📥 Import Following
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

