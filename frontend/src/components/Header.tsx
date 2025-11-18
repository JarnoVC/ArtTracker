import './Header.css';
import { User } from '../api';

interface HeaderProps {
  onImportFollowing: () => void;
  onClearDatabase: () => void;
  onScrapeAll: () => void;
  isScraping: boolean;
  newCount: number;
  user: User | null;
  onLogout: () => void;
  onOpenSettings: () => void;
}

function Header({ onImportFollowing, onClearDatabase, onScrapeAll, isScraping, newCount, user, onLogout, onOpenSettings }: HeaderProps) {
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
        
        <div className="header-actions">
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

          <button 
            className="btn btn-danger"
            onClick={onClearDatabase}
            title="Clear all data from database"
          >
            🗑️ Clear Database
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;

