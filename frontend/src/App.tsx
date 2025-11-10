import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Header from './components/Header';
import ArtistList from './components/ArtistList';
import ArtworkGrid from './components/ArtworkGrid';
import ImportFollowingModal from './components/ImportFollowingModal';
import ScrapeProgressModal from './components/ScrapeProgressModal';
import ConfirmModal from './components/ConfirmModal';
import LoginModal from './components/LoginModal';
import { Artist, Artwork, getArtists, getArtworks, getNewCount, clearDatabase, importFollowing, scrapeArtist, getCurrentUser, logout, getAuthToken, User } from './api';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [showScrapeProgress, setShowScrapeProgress] = useState(false);
  const [scrapeProgressArtists, setScrapeProgressArtists] = useState<Artist[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(false);

  // Check authentication on mount (only once)
  useEffect(() => {
    // Clear any invalid tokens first
    const token = getAuthToken();
    if (token) {
      // Check if token is valid
      checkAuth();
    } else {
      // No token, skip auth check
      setIsCheckingAuth(false);
      setIsAuthenticated(false);
    }
  }, []); // Empty deps - only run once on mount

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadArtists();
      loadArtworks();
      loadNewCount();
      
      // Check for new artworks every 5 minutes
      const interval = setInterval(() => {
        loadNewCount();
      }, 5 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      setIsCheckingAuth(false);
      setIsAuthenticated(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error: any) {
      // Token invalid or expired, clear it
      console.log('Auth check failed:', error.response?.status);
      logout();
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async () => {
    // After login/register, the token is already set in the API functions
    // Just refresh the user data
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Failed to get user after login:', error);
      // If this fails, user might need to login again
      toast.error('Login successful but failed to load user data. Please try again.');
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setIsAuthenticated(false);
    setArtists([]);
    setArtworks([]);
    setSelectedArtistId(null);
    toast.success('Logged out');
  };

  useEffect(() => {
    // Only load artworks if authenticated
    if (isAuthenticated) {
      loadArtworks();
    }
  }, [selectedArtistId, showNewOnly, isAuthenticated]);

  const loadArtists = async (showLoading = false) => {
    if (showLoading) {
      setIsLoadingArtists(true);
    }
    try {
      const data = await getArtists();
      setArtists(data);
    } catch (error) {
      toast.error('Failed to load artists');
    } finally {
      if (showLoading) {
        setIsLoadingArtists(false);
      }
    }
  };

  const loadArtworks = async (showLoading = false) => {
    if (showLoading) {
      setIsLoadingArtworks(true);
    }
    try {
      // Show only latest per artist when viewing "All Artists"
      const latestPerArtist = selectedArtistId === null;
      const data = await getArtworks(selectedArtistId, showNewOnly, latestPerArtist);
      setArtworks(data);
    } catch (error) {
      toast.error('Failed to load artworks');
    } finally {
      if (showLoading) {
        setIsLoadingArtworks(false);
      }
    }
  };

  const loadNewCount = async () => {
    try {
      const data = await getNewCount();
      setNewCount(data.count);
    } catch (error) {
      console.error('Failed to load new count');
    }
  };

  const handleScrapeAll = async () => {
    if (artists.length === 0) {
      toast.error('No artists to scrape. Add some artists first!');
      return;
    }
    
    setIsScraping(true);
    setScrapeProgressArtists(artists);
    setShowScrapeProgress(true);
  };

  const handleShowImportProgress = (artistsToScrape: Artist[]) => {
    setScrapeProgressArtists(artistsToScrape);
    setShowScrapeProgress(true);
  };

  const handleScrapeComplete = async () => {
    setShowScrapeProgress(false);
    setIsScraping(false);
    
    // Reload data
    await loadArtists();
    await loadArtworks();
    await loadNewCount();
    
    toast.success('Scraping complete!');
  };

  const handleScrapeSingleArtist = async (artistId: number) => {
    try {
      toast.loading('Loading artworks...', { id: 'scrape-single' });
      
      const result = await scrapeArtist(artistId);
      
      toast.dismiss('scrape-single');
      
      if (result.new_artworks > 0) {
        toast.success(`Loaded ${result.total_found} artworks (${result.new_artworks} new)!`);
      } else {
        toast.success(`Loaded ${result.total_found} artworks!`);
      }
      
      // Reload artworks and new count
      await loadArtworks();
      await loadNewCount();
    } catch (error: any) {
      toast.dismiss('scrape-single');
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load artworks';
      toast.error(`Failed to load: ${errorMessage}`);
    }
  };


  const handleImportComplete = async () => {
    await loadArtists();
    await loadArtworks();
    await loadNewCount();
  };

  const handleSyncWithArtStation = async () => {
    // For sync, we don't need to provide username - it uses the user's ArtStation username from their profile
    // If they don't have one, the backend will return an error
    setIsLoadingArtists(true);
    try {
      toast.loading('Syncing with ArtStation...', { id: 'sync' });
      
      // Refresh sync: clearExisting = false (syncs list - adds new, removes unfollowed)
      // Pass empty string to use user's stored ArtStation username
      const importResults = await importFollowing('', false);
      
      toast.dismiss('sync');
      
      let message = '';
      if (importResults.added > 0) {
        message += `Added ${importResults.added} new artist${importResults.added > 1 ? 's' : ''}`;
        if (importResults.artworks_loaded > 0) {
          message += ` with ${importResults.artworks_loaded} artwork${importResults.artworks_loaded > 1 ? 's' : ''}`;
        }
      }
      if (importResults.removed > 0) {
        if (message) message += ', ';
        message += `removed ${importResults.removed} artist${importResults.removed > 1 ? 's' : ''}`;
      }
      if (message) {
        toast.success(message + '!');
      } else if (importResults.already_exists === importResults.total_found) {
        toast.success('All up to date! No changes found.');
      } else {
        toast.success('Sync complete!');
      }
      
      await loadArtists(true);
      // Reload artworks in case some were removed or new ones were added
      await loadArtworks(true);
      // Update the new count counter in the header
      await loadNewCount();
    } catch (error: any) {
      toast.dismiss('sync');
      const errorMessage = error.response?.data?.error || error.message || 'Failed to sync with ArtStation';
      toast.error(`Failed to sync: ${errorMessage}`);
      console.error('Sync error:', error);
    } finally {
      setIsLoadingArtists(false);
    }
  };

  const handleClearDatabase = async () => {
    try {
      const result = await clearDatabase();
      toast.success(`Database cleared: ${result.deleted_artists} artists, ${result.deleted_artworks} artworks`);
      
      // Reload everything
      await loadArtists();
      await loadArtworks();
      await loadNewCount();
      setSelectedArtistId(null);
    } catch (error) {
      toast.error('Failed to clear database');
    }
  };

  const handleArtistDeleted = () => {
    loadArtists();
    if (selectedArtistId) {
      setSelectedArtistId(null);
    }
  };

  const handleArtworkSeen = () => {
    loadArtworks();
    loadNewCount();
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="app">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="app">
        <LoginModal onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          },
          success: {
            iconTheme: {
              primary: 'var(--success)',
              secondary: 'var(--surface)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--error)',
              secondary: 'var(--surface)',
            },
          },
        }}
      />
      
      <Header 
        onImportFollowing={() => setIsImportModalOpen(true)}
        onClearDatabase={() => setShowClearConfirm(true)}
        onScrapeAll={handleScrapeAll}
        isScraping={isScraping}
        newCount={newCount}
        user={user}
        onLogout={handleLogout}
      />
      
      <div className="main-container">
        <ArtistList 
          artists={artists}
          selectedArtistId={selectedArtistId}
          onSelectArtist={setSelectedArtistId}
          onArtistDeleted={handleArtistDeleted}
          onSyncWithArtStation={handleSyncWithArtStation}
          isLoading={isLoadingArtists}
        />
        
        <ArtworkGrid 
          artworks={artworks}
          showNewOnly={showNewOnly}
          onToggleNewOnly={() => setShowNewOnly(!showNewOnly)}
          onArtworkSeen={handleArtworkSeen}
          selectedArtist={artists.find(a => a.id === selectedArtistId)}
          onScrapeArtist={handleScrapeSingleArtist}
          isLoading={isLoadingArtworks}
        />
      </div>
      
      {isImportModalOpen && (
        <ImportFollowingModal 
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={handleImportComplete}
          onShowProgress={handleShowImportProgress}
        />
      )}

      {showScrapeProgress && (
        <ScrapeProgressModal 
          artists={scrapeProgressArtists}
          onComplete={handleScrapeComplete}
        />
      )}

      {showClearConfirm && (
        <ConfirmModal 
          title="⚠️ Clear Database?"
          message="This will permanently delete ALL artists and artworks from your database. This action cannot be undone. Are you sure you want to continue?"
          confirmText="Yes, Clear Everything"
          cancelText="Cancel"
          confirmButtonClass="btn-error"
          onConfirm={() => {
            setShowClearConfirm(false);
            handleClearDatabase();
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

export default App;

