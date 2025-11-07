import axios from 'axios';
import * as cheerio from 'cheerio';
import * as db from './database';

const SCRAPE_DELAY = parseInt(process.env.SCRAPE_DELAY_MS || '2000');

interface ScrapedArtwork {
  artwork_id: string;
  title: string;
  thumbnail_url: string;
  artwork_url: string;
  upload_date?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function scrapeArtist(artistId: number) {
  const artist = db.getArtistById(artistId);
  
  if (!artist) {
    throw new Error('Artist not found');
  }

  console.log(`🔍 Scraping ${artist.username}...`);

  try {
    // Try API endpoint first (more reliable and less likely to be blocked)
    const apiUrl = `https://www.artstation.com/users/${artist.username}/projects.json`;
    
    let apiData: any = null;
    try {
      const apiResponse = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.artstation.com/',
          'Origin': 'https://www.artstation.com'
        },
        timeout: 15000
      });
      apiData = apiResponse.data;
    } catch (apiError: any) {
      console.log(`API endpoint failed for ${artist.username}, trying page scrape...`);
    }

    // Fetch the artist's page as fallback
    const response = await axios.get(artist.profile_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.artstation.com/'
      },
      timeout: 15000
    });

    const artworks: ScrapedArtwork[] = [];

    // If we got API data, use that first (most reliable)
    if (apiData && apiData.data && Array.isArray(apiData.data)) {
      console.log(`Using API data for ${artist.username} - found ${apiData.data.length} artworks`);
      
      apiData.data.forEach((project: any) => {
        artworks.push({
          artwork_id: project.hash_id || project.id?.toString() || '',
          title: project.title || 'Untitled',
          thumbnail_url: project.cover?.thumb_url || project.cover?.small_square_url || '',
          artwork_url: project.permalink || `https://www.artstation.com/artwork/${project.hash_id}`,
          upload_date: project.published_at
        });
      });

      // Also try to get user info from API
      if (apiData.data.length > 0 && apiData.data[0].user) {
        const user = apiData.data[0].user;
        if (!artist.display_name && user.full_name) {
          db.updateArtist(artistId, { display_name: user.full_name });
        }
        if (!artist.avatar_url && user.medium_avatar_url) {
          db.updateArtist(artistId, { avatar_url: user.medium_avatar_url });
        }
      }
    } else {
      // Fall back to page scraping
      console.log(`Using page scraping for ${artist.username}`);
      
      const $ = cheerio.load(response.data);

      // Try to extract display name if not already set
      if (!artist.display_name) {
        const displayName = $('.profile-header-name').text().trim() || 
                           $('meta[property="og:title"]').attr('content') ||
                           artist.username;
        
        db.updateArtist(artistId, { display_name: displayName });
      }

      // Try to extract avatar
      if (!artist.avatar_url) {
        const avatarUrl = $('.profile-avatar img').attr('src') || 
                         $('meta[property="og:image"]').attr('content');
        
        if (avatarUrl) {
          db.updateArtist(artistId, { avatar_url: avatarUrl });
        }
      }

      // Extract artworks from the page
      // Method 1: Look for JSON data in scripts
      const scripts = $('script[type="application/ld+json"]');
      scripts.each((_, elem) => {
        try {
          const data = JSON.parse($(elem).html() || '');
          if (data['@type'] === 'Person' && data.workExample) {
            data.workExample.forEach((work: any) => {
              if (work.url) {
                const artworkId = work.url.split('/').pop() || '';
                artworks.push({
                  artwork_id: artworkId,
                  title: work.name || 'Untitled',
                  thumbnail_url: work.thumbnailUrl || work.image || '',
                  artwork_url: work.url,
                  upload_date: work.datePublished
                });
              }
            });
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      });

      // Method 2: Extract from initial state
      const pageText = response.data;
      const jsonDataMatch = pageText.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
      
      if (jsonDataMatch) {
        try {
          const initialState = JSON.parse(jsonDataMatch[1]);
          
          if (initialState.projects && initialState.projects.data) {
            initialState.projects.data.forEach((project: any) => {
              artworks.push({
                artwork_id: project.hash_id || project.id?.toString() || '',
                title: project.title || 'Untitled',
                thumbnail_url: project.cover?.thumb_url || project.cover?.small_square_url || '',
                artwork_url: `https://www.artstation.com/artwork/${project.hash_id || project.id}`,
                upload_date: project.published_at
              });
            });
          }
        } catch (e) {
          console.error('Error parsing initial state:', e);
        }
      }
    }

    // Remove duplicates
    const uniqueArtworks = Array.from(
      new Map(artworks.map(a => [a.artwork_id, a])).values()
    );

    console.log(`Found ${uniqueArtworks.length} artworks for ${artist.username}`);

    // Store artworks in database
    let newCount = 0;

    for (const artwork of uniqueArtworks) {
      const result = db.addArtwork(
        artistId,
        artwork.artwork_id,
        artwork.title,
        artwork.thumbnail_url,
        artwork.artwork_url,
        artwork.upload_date
      );
      if (result.isNew) {
        newCount++;
      }
    }

    // Update last_checked timestamp
    db.updateArtist(artistId, { last_checked: new Date().toISOString() });

    return {
      artist: artist.username,
      total_found: uniqueArtworks.length,
      new_artworks: newCount
    };

  } catch (error: any) {
    console.error(`Error scraping ${artist.username}:`, error.message);
    throw error;
  }
}

export async function scrapeAllArtists() {
  const artists = db.getAllArtists();
  
  console.log(`📊 Scraping ${artists.length} artists...`);
  
  const results = [];
  
  for (const artist of artists) {
    try {
      const result = await scrapeArtist(artist.id);
      results.push(result);
      
      // Delay between requests to be respectful
      if (artists.indexOf(artist) < artists.length - 1) {
        await delay(SCRAPE_DELAY);
      }
    } catch (error: any) {
      results.push({
        artist: artist.username,
        error: error.message
      });
    }
  }
  
  return {
    total_artists: artists.length,
    results
  };
}
