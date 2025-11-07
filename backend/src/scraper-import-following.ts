import puppeteer from 'puppeteer';
import * as db from './database';
import { scrapeArtist } from './scraper-puppeteer';

let browser: any = null;

async function getBrowser() {
  if (!browser) {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

export async function importFollowingFromUser(userId: number, artstationUsername: string, clearExisting: boolean = false, skipArtworkScraping: boolean = false) {
  console.log(`📥 Importing followed artists from @${artstationUsername} for user ${userId}...`);
  
  let existingArtistsCount = 0;
  let removedCount = 0;
  
  // Clear existing artists if requested (for switching between users)
  if (clearExisting) {
    console.log(`  🗑️ Clearing existing artists and artworks...`);
    const existingArtists = await db.getAllArtists(userId);
    existingArtistsCount = existingArtists.length;
    removedCount = await db.deleteAllArtists(userId);
    console.log(`  ✓ Cleared ${removedCount} existing artists and their artworks`);
  }

  try {
    console.log(`  🚀 Getting browser instance...`);
    const browser = await getBrowser();
    console.log(`  ✓ Browser ready`);
    let followedArtists: Array<{ username: string; name?: string; avatar?: string }> = [];

    // Fetch all pages of followed artists
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`  → Fetching page ${currentPage}...`);
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const apiUrl = `https://www.artstation.com/users/${artstationUsername}/following.json?page=${currentPage}`;
      
      await page.goto(apiUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Extract the JSON data
      const jsonData = await page.evaluate(() => {
        // @ts-ignore - document is available in browser context
        const preElement = document.querySelector('pre');
        if (preElement) {
          return JSON.parse(preElement.textContent || '{}');
        }
        // @ts-ignore - document is available in browser context
        const bodyText = document.body.textContent;
        if (bodyText) {
          try {
            return JSON.parse(bodyText);
          } catch (e) {
            return null;
          }
        }
        return null;
      });

      await page.close();

      // Check if we got valid data
      if (jsonData && jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
        console.log(`     Found ${jsonData.data.length} artists on page ${currentPage}`);
        
        jsonData.data.forEach((user: any) => {
          if (user.username) {
            followedArtists.push({
              username: user.username,
              name: user.full_name || user.username,
              avatar: user.medium_avatar_url || user.large_avatar_url
            });
          }
        });

        // Check if there are more pages
        // If we got less than 20 results, it's probably the last page
        if (jsonData.data.length < 20) {
          hasMorePages = false;
        } else {
          currentPage++;
          // Add a delay between page requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        // No more data, we're done
        hasMorePages = false;
        
        // If this is the first page and we got no data, try fallback
        if (currentPage === 1) {
          console.log(`  → API returned no data, trying HTML page fallback...`);
          try {
            followedArtists = await fetchFollowingFromHTMLPage(browser, artstationUsername);
          } catch (fallbackError: any) {
            console.error('Fallback also failed:', fallbackError.message);
            throw new Error(`Failed to fetch following list. The profile might be private or the username might be incorrect. Error: ${fallbackError.message}`);
          }
        }
      }
    }

    console.log(`  → Total found: ${followedArtists.length} followed artists`);

    if (followedArtists.length === 0) {
      throw new Error('No followed artists found. Make sure the username is correct and the profile is public.');
    }

    // Get existing artists (after clearing if clearExisting was true)
    const existingArtists = await db.getAllArtists(userId);
    const existingUsernames = new Set(existingArtists.map(a => a.username.toLowerCase()));
    const followedUsernames = new Set(followedArtists.map(a => a.username.toLowerCase()));

    // Remove artists that are no longer being followed
    // This keeps the list in sync with ArtStation following list
    let removed = 0;
    if (!clearExisting) {
      // Only remove if not doing a full clear (which already cleared everything)
      for (const existingArtist of existingArtists) {
        if (!followedUsernames.has(existingArtist.username.toLowerCase())) {
          await db.deleteArtist(existingArtist.id, userId);
          removed++;
          console.log(`  🗑️ Removed @${existingArtist.username} (no longer following)`);
        }
      }
    }

    // Add artists to database (skip existing ones for efficiency)
    const results: any = {
      total_found: followedArtists.length,
      added: 0,
      already_exists: 0,
      skipped: 0,
      removed: clearExisting ? removedCount : removed,
      failed: 0,
      artworks_loaded: 0,
      artists: []
    };

    // Track newly added artists to scrape their artworks
    const newlyAddedArtists: number[] = [];

    for (const artist of followedArtists) {
      // Check if artist already exists (case-insensitive)
      if (existingUsernames.has(artist.username.toLowerCase())) {
        results.already_exists++;
        results.skipped++;
        // Update display name and avatar if they've changed
        const existingArtist = existingArtists.find(a => a.username.toLowerCase() === artist.username.toLowerCase());
        if (existingArtist && artist.name && !existingArtist.display_name) {
          await db.updateArtist(existingArtist.id, userId, { 
            display_name: artist.name,
            avatar_url: artist.avatar 
          });
        }
        // Don't log every skip to avoid spam
        continue;
      }

      try {
        const profile_url = `https://www.artstation.com/${artist.username}`;
        const newArtist = await db.addArtist(userId, artist.username, profile_url);
        
        // Update display name and avatar if available
        if (artist.name) {
          await db.updateArtist(newArtist.id, userId, { 
            display_name: artist.name,
            avatar_url: artist.avatar 
          });
        }
        
        results.added++;
        newlyAddedArtists.push(newArtist.id);
        results.artists.push({
          username: artist.username,
          status: 'added'
        });
        
        console.log(`  ✓ Added @${artist.username}`);
      } catch (error: any) {
        if (error.message === 'ARTIST_EXISTS') {
          results.already_exists++;
          results.artists.push({
            username: artist.username,
            status: 'already_exists'
          });
          console.log(`  → @${artist.username} already exists`);
        } else {
          results.failed++;
          results.artists.push({
            username: artist.username,
            status: 'failed',
            error: error.message
          });
          console.error(`  ✗ Failed to add @${artist.username}:`, error.message);
        }
      }
    }

    // Automatically scrape artworks for newly added artists (unless skipped)
    if (newlyAddedArtists.length > 0 && !skipArtworkScraping) {
      console.log(`\n🎨 Loading artworks for ${newlyAddedArtists.length} new artist(s)...`);
      
      for (const artistId of newlyAddedArtists) {
        try {
          const artist = await db.getArtistById(artistId, userId);
          if (!artist) continue;
          
          console.log(`  → Loading artworks for @${artist.username}...`);
          const scrapeResult = await scrapeArtist(artistId, userId);
          
          results.artworks_loaded += scrapeResult.total_found;
          
          console.log(`  ✓ Loaded ${scrapeResult.total_found} artworks for @${artist.username}`);
          
          // Small delay between scraping artists to be respectful
          if (newlyAddedArtists.indexOf(artistId) < newlyAddedArtists.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          console.error(`  ✗ Failed to load artworks for artist ID ${artistId}:`, error.message);
          // Don't fail the entire import if one artist's scrape fails
        }
      }
    }
    
    // Add newly added artist IDs to results so frontend can scrape them individually
    if (skipArtworkScraping && newlyAddedArtists.length > 0) {
      results.newly_added_artist_ids = newlyAddedArtists;
    }

    if (results.skipped > 0) {
      console.log(`  ⏭ Skipped ${results.skipped} artists that already exist`);
    }
    
    if (results.removed > 0) {
      if (clearExisting) {
        console.log(`  🗑️ Removed ${results.removed} artists (full clear requested)`);
      } else {
        console.log(`  🗑️ Removed ${results.removed} artist(s) that are no longer being followed`);
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Added: ${results.added}`);
    console.log(`   Already exists: ${results.already_exists}`);
    if (results.removed > 0) {
      console.log(`   Removed: ${results.removed}`);
    }
    if (results.artworks_loaded > 0) {
      console.log(`   Artworks loaded: ${results.artworks_loaded}`);
    }
    console.log(`   Failed: ${results.failed}`);

    return results;

  } catch (error: any) {
    console.error(`❌ Error importing following list:`, error);
    // Provide more helpful error messages
    if (error.message.includes('net::ERR')) {
      throw new Error('Network error: Could not reach ArtStation. Check your internet connection.');
    } else if (error.message.includes('timeout')) {
      throw new Error('Request timed out. ArtStation might be slow or unreachable. Try again in a moment.');
    } else if (error.message.includes('No followed artists found')) {
      throw error; // Already a good message
    } else {
      throw new Error(error.message || 'Unknown error occurred while fetching following list');
    }
  }
}

// Fallback function to fetch from HTML page
async function fetchFollowingFromHTMLPage(browser: any, artstationUsername: string) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const followingUrl = `https://www.artstation.com/users/${artstationUsername}/following`;
  await page.goto(followingUrl, { 
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));
  await autoScroll(page);

  const artists = await page.evaluate(() => {
    const result: Array<{ username: string; name?: string; avatar?: string }> = [];
    
    try {
      // @ts-ignore - window is available in browser context
      const initialState = window.__INITIAL_STATE__;
      if (initialState && initialState.following && initialState.following.data) {
        initialState.following.data.forEach((user: any) => {
          if (user.username) {
            result.push({
              username: user.username,
              name: user.full_name || user.username,
              avatar: user.medium_avatar_url || user.small_picture_url
            });
          }
        });
      }
    } catch (e) {
      console.error('Error extracting from initial state:', e);
    }

    return result;
  });

  await page.close();
  return artists;
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        // @ts-ignore - document and window are available in browser context
        const scrollHeight = document.body.scrollHeight;
        // @ts-ignore - window is available in browser context
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > 10000) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// Clean up browser on process exit
process.on('exit', async () => {
  if (browser) {
    await browser.close();
  }
});

process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});

