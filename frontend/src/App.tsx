import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Header from './components/Header';
import ArtistList from './components/ArtistList';
import ArtworkGrid from './components/ArtworkGrid';
import ImportFollowingModal from './components/ImportFollowingModal';
import ScrapeProgressModal from './components/ScrapeProgressModal';
import SyncProgressModal from './components/SyncProgressModal';
import LoginModal from './components/LoginModal';
import SettingsModal from './components/SettingsModal';
import { Artist, Artwork, getArtists, getArtworks, getNewCount, importFollowing, scrapeArtist, getCurrentUser, logout, getAuthToken, User } from './api';
import { loadCachedData, saveCachedData, clearCachedData } from './offlineCache.ts';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [showScrapeProgress, setShowScrapeProgress] = useState(false);
  const [scrapeProgressArtists, setScrapeProgressArtists] = useState<Artist[]>([]);
  const [isScrapeProgressInitialImport, setIsScrapeProgressInitialImport] = useState(false);
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [isSyncComplete, setIsSyncComplete] = useState(false);
  const [isScrapingFromSync, setIsScrapingFromSync] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(false);
  const [isMobileArtistListOpen, setIsMobileArtistListOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check authentication on mount (only once)
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      if (navigator.onLine) {
        checkAuth();
      } else {
        const cached = loadCachedData();
        if (cached?.user) {
          setUser(cached.user);
          setIsAuthenticated(true);
          setIsCheckingAuth(false);
          if (cached.artists) setArtists(cached.artists);
          if (cached.artworks) setArtworks(cached.artworks);
          if (cached.newCount !== undefined) setNewCount(cached.newCount);
        } else {
          setIsCheckingAuth(false);
          setIsAuthenticated(false);
        }
      }
    } else {
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
      saveCachedData({ user: currentUser });
    } catch (error: any) {
      // Token invalid or expired, clear it
      console.log('Auth check failed:', error.response?.status);
      logout();
      setIsAuthenticated(false);
      clearCachedData();
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
      saveCachedData({ user: currentUser });
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
    clearCachedData();
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

    if (!navigator.onLine) {
      const cached = loadCachedData();
      if (cached?.artists) {
        setArtists(cached.artists);
      } else {
        toast.error('Offline and no cached artists available');
      }
      if (showLoading) {
        setIsLoadingArtists(false);
      }
      return;
    }

    try {
      const data = await getArtists();
      setArtists(data);
      saveCachedData({ artists: data });
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

    if (!navigator.onLine) {
      const cached = loadCachedData();
      if (cached?.artworks && cached.selectedArtistId === selectedArtistId) {
        setArtworks(cached.artworks);
      } else {
        toast.error('Offline and no cached artworks for this view');
      }
      if (showLoading) {
        setIsLoadingArtworks(false);
      }
      return;
    }

    try {
      // Show only latest per artist when viewing "All Artists"
      const latestPerArtist = selectedArtistId === null;
      const data = await getArtworks(selectedArtistId, showNewOnly, latestPerArtist);
      setArtworks(data);
      saveCachedData({ artworks: data, selectedArtistId });
    } catch (error) {
      toast.error('Failed to load artworks');
    } finally {
      if (showLoading) {
        setIsLoadingArtworks(false);
      }
    }
  };

  const loadNewCount = async () => {
    if (!navigator.onLine) {
      const cached = loadCachedData();
      if (cached?.newCount !== undefined) {
        setNewCount(cached.newCount);
      }
      return;
    }
    try {
      const data = await getNewCount();
      setNewCount(data.count);
      saveCachedData({ newCount: data.count });
    } catch (error) {
      console.error('Failed to load new count');
    }
  };

  const handleScrapeAll = async () => {
    if (artists.length === 0) {
      toast.error('No artists to scrape. Add some artists first!');
      return;
    }

    if (!navigator.onLine) {
      toast.error('Cannot check for updates while offline');
      return;
    }
    
    setIsScraping(true);
    setScrapeProgressArtists(artists);
    setIsScrapeProgressInitialImport(false); // "Check for Updates" uses optimized scraping
    setShowScrapeProgress(true);
  };

  const handleShowImportProgress = (artistsToScrape: Artist[]) => {
    setScrapeProgressArtists(artistsToScrape);
    setIsScrapeProgressInitialImport(true); // This is for newly imported artists
    setShowScrapeProgress(true);
  };

  const handleScrapeComplete = async () => {
    const wasFromSync = isScrapingFromSync;
    
    setShowScrapeProgress(false);
    setIsScraping(false);
    setIsScrapeProgressInitialImport(false);
    setIsScrapingFromSync(false);
    
    // Reload data
    await loadArtists();
    await loadArtworks();
    await loadNewCount();
    
    // Check if this was triggered from sync
    if (wasFromSync) {
      toast.success('Sync and artwork loading complete!');
    } else {
      toast.success('Scraping complete!');
    }
  };

  const handleScrapeSingleArtist = async (artistId: number) => {
    try {
      if (!navigator.onLine) {
        toast.error('Cannot load artworks while offline');
        return;
      }

      toast.loading('Loading artworks...', { id: 'scrape-single' });
      const result = await scrapeArtist(artistId);
      
      toast.dismiss('scrape-single');
      
      if (result.new_artworks > 0) {
        toast.success(`Loaded ${result.total_found} artworks (${result.new_artworks} new)!`);
      } else {
        toast.success(`Loaded ${result.total_found} artworks!`);
      }
      
      // Reload artworks, new count, AND artists list to show updated last_checked date
      await loadArtists();
      await loadArtworks();
      await loadNewCount();
    } catch (error: any) {
      toast.dismiss('scrape-single');
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load artworks';
      toast.error(`Failed to load: ${errorMessage}`);
    }
  };


  const handleImportComplete = async () => {
    if (!navigator.onLine) {
      toast.error('Cannot import while offline');
      return;
    }
    await loadArtists();
    await loadArtworks();
    await loadNewCount();
  };

  const handleSyncWithArtStation = async () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync while offline');
      return;
    }
    // For sync, we don't need to provide username - it uses the user's ArtStation username from their profile
    // If they don't have one, the backend will return an error
    setShowSyncProgress(true);
    setIsSyncComplete(false);
    setIsLoadingArtists(true);
    try {
      // Refresh sync: clearExisting = false (syncs list - adds new, removes unfollowed)
      // Pass empty string to use user's stored ArtStation username
      // Use skipArtworkScraping = true so we can show progress in ScrapeProgressModal
      const importResults = await importFollowing('', false, true);
      
      // If we have newly added artists, show progress modal to load their artworks
      if (importResults.newly_added_artist_ids && importResults.newly_added_artist_ids.length > 0) {
        // Close sync modal and show scrape progress modal
        setShowSyncProgress(false);
        setIsScrapingFromSync(true); // Track that scraping is part of sync
        
        // Fetch the artist details for the progress modal
        const allArtists = await getArtists();
        const newlyAddedArtists = allArtists.filter(artist => 
          importResults.newly_added_artist_ids.includes(artist.id)
        );
        
        // Show scrape progress for newly added artists
        setScrapeProgressArtists(newlyAddedArtists);
        setIsScrapeProgressInitialImport(true); // Use full scrape for new artists
        setShowScrapeProgress(true);
        
        // Wait for scraping to complete (handled by handleScrapeComplete)
        return;
      }
      
      setIsSyncComplete(true);
      
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
      setShowSyncProgress(false);
      setShowScrapeProgress(false);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to sync with ArtStation';
      toast.error(`Failed to sync: ${errorMessage}`);
      console.error('Sync error:', error);
    } finally {
      setIsLoadingArtists(false);
    }
  };

  const handleSyncComplete = () => {
    setShowSyncProgress(false);
    setIsSyncComplete(false);
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
      
      {isOffline && (
        <div className="offline-banner">
          <span>Offline mode: showing last synced data</span>
        </div>
      )}
      
      <Header 
        onImportFollowing={() => setIsImportModalOpen(true)}
        onScrapeAll={handleScrapeAll}
        isScraping={isScraping}
        newCount={newCount}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettingsModal(true)}
      />
      
      <div className="main-container">
        <ArtistList 
          artists={artists}
          selectedArtistId={selectedArtistId}
          onSelectArtist={(id) => {
            setSelectedArtistId(id);
            setIsMobileArtistListOpen(false); // Close mobile drawer when artist is selected
          }}
          onArtistDeleted={handleArtistDeleted}
          onSyncWithArtStation={handleSyncWithArtStation}
          isLoading={isLoadingArtists}
          isMobileOpen={isMobileArtistListOpen}
          onMobileClose={() => setIsMobileArtistListOpen(false)}
        />
        
        <ArtworkGrid 
          artworks={artworks}
          showNewOnly={showNewOnly}
          onToggleNewOnly={() => setShowNewOnly(!showNewOnly)}
          onArtworkSeen={handleArtworkSeen}
          selectedArtist={artists.find(a => a.id === selectedArtistId)}
          onScrapeArtist={handleScrapeSingleArtist}
          isLoading={isLoadingArtworks}
          onOpenMobileArtistList={() => setIsMobileArtistListOpen(true)}
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
          isInitialImport={isScrapeProgressInitialImport}
        />
      )}

      {showSyncProgress && (
        <SyncProgressModal 
          isComplete={isSyncComplete}
          onComplete={handleSyncComplete}
        />
      )}

      {showSettingsModal && (
        <SettingsModal 
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}

export default App;

