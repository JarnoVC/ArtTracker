import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { login, register, getFeaturedArtworks, type FeaturedArtworkPreview } from '../api';
import { toast } from 'react-hot-toast';
import './LoginModal.css';

interface LoginModalProps {
  onLogin: () => void;
}

type CarouselCard = {
  id: string;
  title: string;
  artist: string;
  imageUrl?: string;
  artworkUrl?: string;
  accent: string;
};

type OrbitCSSProperties = CSSProperties & {
  '--orbit-count'?: number;
  '--orbit-duration'?: string;
  '--orbit-stagger'?: string;
};

type OrbitCardStyle = CSSProperties & {
  '--card-index'?: number;
  '--card-accent'?: string;
  '--card-shift'?: number;
};

const ACCENT_PALETTE = [
  'rgba(130, 202, 255, 0.7)',
  'rgba(192, 132, 252, 0.65)',
  'rgba(252, 211, 77, 0.6)',
  'rgba(244, 114, 182, 0.65)',
  'rgba(165, 243, 252, 0.65)',
  'rgba(190, 242, 100, 0.6)',
  'rgba(253, 164, 175, 0.6)',
  'rgba(196, 181, 253, 0.65)',
];
const ORBIT_DURATION = 36;
const ORBIT_STAGGER = 6;
const MIN_CARD_COUNT = 3;
const MAX_CARD_COUNT = 5;
const FEATURED_LIMIT = 5;
const CARD_CYCLE_MS = 6500;

const FALLBACK_CARDS: CarouselCard[] = [
  {
    id: 'fallback-01',
    title: 'Chroma Bloom',
    artist: 'Nova Renders',
    accent: ACCENT_PALETTE[0],
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
    artworkUrl: 'https://unsplash.com/photos/AIisImh7aKo',
  },
  {
    id: 'fallback-02',
    title: 'Silent Nebula',
    artist: 'Aster Vega',
    accent: ACCENT_PALETTE[1],
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
    artworkUrl: 'https://unsplash.com/photos/1Y4Jq5nYCOU',
  },
  {
    id: 'fallback-03',
    title: 'Glass Garden',
    artist: 'Mara Ives',
    accent: ACCENT_PALETTE[2],
    imageUrl: 'https://images.unsplash.com/photo-1482192597420-4817fdd7e8b0?auto=format&fit=crop&w=800&q=80',
    artworkUrl: 'https://unsplash.com/photos/hqCEQTc5gZA',
  },
  {
    id: 'fallback-04',
    title: 'Signal Noise',
    artist: 'Orbitworks',
    accent: ACCENT_PALETTE[3],
    imageUrl: 'https://images.unsplash.com/photo-1500534310685-3d04392a97b4?auto=format&fit=crop&w=800&q=80',
    artworkUrl: 'https://unsplash.com/photos/0c4LOlv_wGc',
  },
  {
    id: 'fallback-05',
    title: 'Specular Tide',
    artist: 'Ilan Cerez',
    accent: ACCENT_PALETTE[4],
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-bbc1f28b095d?auto=format&fit=crop&w=800&q=80',
    artworkUrl: 'https://unsplash.com/photos/G9Rfc1qccH4',
  },
  {
    id: 'fallback-06',
    title: 'Graphite Halo',
    artist: 'Studio Meridian',
    accent: ACCENT_PALETTE[5],
    imageUrl: 'https://images.unsplash.com/photo-1500534310685-73b4e7cd7c85?auto=format&fit=crop&w=800&q=80',
    artworkUrl: 'https://unsplash.com/photos/IDNqI2I3j8o',
  },
];

const normalizeArtworks = (artworks: FeaturedArtworkPreview[]): CarouselCard[] => {
  return artworks.map((artwork, index) => ({
    id: `featured-${artwork.id}`,
    title: artwork.title || 'Untitled drop',
    artist: artwork.display_name || artwork.username || 'Unknown Artist',
    imageUrl: artwork.thumbnail_url || undefined,
    artworkUrl: artwork.artwork_url,
    accent: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
  }));
};

function LoginModal({ onLogin }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [artstationUsername, setArtstationUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [featuredArtworks, setFeaturedArtworks] = useState<CarouselCard[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegistering) {
        // Register new user
        await register(username.trim(), artstationUsername.trim() || undefined);
        toast.success(`Welcome, ${username}!`);
        onLogin();
      } else {
        // Login existing user
        await login(username.trim());
        toast.success(`Welcome back, ${username}!`);
        onLogin();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to authenticate';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadFeatured = async () => {
      if (!navigator.onLine) {
        return;
      }

      try {
        const artworks = await getFeaturedArtworks(FEATURED_LIMIT);
        if (!isMounted || !artworks?.length) {
          return;
        }
        setFeaturedArtworks(normalizeArtworks(artworks));
      } catch (error) {
        console.debug('Login carousel using fallback data', error);
      }
    };

    loadFeatured();
    return () => {
      isMounted = false;
    };
  }, []);

  const carouselCards = useMemo(() => {
    const source = featuredArtworks.length ? featuredArtworks : FALLBACK_CARDS;
    if (!source.length) {
      return [];
    }
    const loops = Math.min(Math.max(source.length, MIN_CARD_COUNT), MAX_CARD_COUNT);
    if (source.length >= loops) {
      return source.slice(0, loops).map((card, idx) => ({
        ...card,
        derivedId: `${card.id}-${idx}`,
        sequenceIndex: idx,
      }));
    }
    return Array.from({ length: loops }, (_, idx) => {
      const card = source[idx % source.length];
      return {
        ...card,
        derivedId: `${card.id}-${idx}`,
        sequenceIndex: idx,
      };
    });
  }, [featuredArtworks]);

  useEffect(() => {
    if (!carouselCards.length) {
      return;
    }
    setActiveIndex(0);
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % carouselCards.length);
    }, CARD_CYCLE_MS);
    return () => clearInterval(interval);
  }, [carouselCards.length]);

  const carouselStyle = useMemo<OrbitCSSProperties>(
    () => ({
      '--orbit-count': carouselCards.length,
      '--orbit-duration': `${ORBIT_DURATION}s`,
      '--orbit-stagger': `${ORBIT_STAGGER}s`,
    }),
    [carouselCards.length]
  );

  const handleImageError = (id: string) => {
    setImageErrors(prev => {
      if (prev[id]) {
        return prev;
      }
      return { ...prev, [id]: true };
    });
  };

  return (
    <div className="modal-backdrop login-backdrop">
      <div className="modal login-modal">
        <div className="login-shell">
          <section className="login-showcase" aria-label="Featured artwork orbit">
            <div className="login-showcase__copy">
              <p className="eyebrow">Live highlights</p>
              <h3>Watch new drops orbit into focus</h3>
              <p>
                ArtTracker keeps a quiet pulse on your favorite artists, surfacing fresh work the moment it lands.
              </p>
            </div>
            <div className="login-showcase__carousel" style={carouselStyle}>
              <div className="login-carousel">
                {carouselCards.map((card, idx) => {
                  const isActive = idx === activeIndex;
                  const hasImage = Boolean(card.imageUrl && !imageErrors[card.id]);
                  const cardStyle: OrbitCardStyle = {
                    '--card-index': card.sequenceIndex,
                    '--card-accent': card.accent,
                    '--card-shift': idx,
                  };
                  return (
                    <article
                      key={card.derivedId}
                      className="orbit-card"
                      data-has-image={hasImage}
                      data-active={isActive}
                      style={cardStyle}
                    >
                      <div className="orbit-card__glow" aria-hidden="true"></div>
                      <div className="orbit-card__media">
                        {hasImage ? (
                          <img
                            src={card.imageUrl}
                            alt={`${card.title} by ${card.artist}`}
                            loading="lazy"
                            decoding="async"
                            onError={() => handleImageError(card.id)}
                          />
                        ) : (
                          <div className="orbit-card__placeholder" aria-hidden="true">
                            <span>{card.artist.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="orbit-card__meta">
                        <p className="orbit-card__artist">{card.artist}</p>
                        <p className="orbit-card__title">{card.title}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="login-panel">
            <div className="modal-header login-header">
              <img
                src="/icons/Logo_nbg.png"
                alt="ArtTracker logo"
                className="login-logo"
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
              />
              <h2>ArtTracker</h2>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="modal-body">
                <p className="login-description">
                  {isRegistering 
                    ? 'Create your account to start tracking artists' 
                    : 'Enter your username to access your tracker'}
                </p>
                
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  disabled={isLoading}
                  pattern="[a-zA-Z0-9_]+"
                  title="Only letters, numbers, and underscores allowed"
                />
                
                {isRegistering && (
                  <>
                    <label htmlFor="artstation-username" className="form-label">
                      ArtStation Username (Optional)
                    </label>
                    <input
                      id="artstation-username"
                      type="text"
                      className="form-input"
                      placeholder="Your ArtStation username (for importing)"
                      value={artstationUsername}
                      onChange={(e) => setArtstationUsername(e.target.value)}
                      disabled={isLoading}
                    />
                    <p className="form-hint">
                      This will be saved but not displayed. You can change it later.
                    </p>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRegistering(!isRegistering)}
                  disabled={isLoading}
                >
                  {isRegistering ? 'Already have an account? Login' : 'New user? Register'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" aria-hidden="true"></span>
                      {isRegistering ? 'Creating...' : 'Logging in...'}
                    </>
                  ) : (
                    isRegistering ? 'Register' : 'Login'
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;

