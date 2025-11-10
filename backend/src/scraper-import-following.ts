import puppeteer from 'puppeteer';
import * as db from './database';
import { scrapeArtist } from './scraper-puppeteer';

let browser: any = null;

async function getBrowser() {
  if (!browser) {
    console.log('🚀 Launching browser...');
    
    const fs = require('fs');
    const path = require('path');
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--single-process'
      ]
    };

    // Set up cache directory for Puppeteer (must be set before Puppeteer operations)
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
    
    // CRITICAL: Set environment variable BEFORE any Puppeteer operations
    // This ensures Puppeteer knows where to look for Chrome
    if (!process.env.PUPPETEER_CACHE_DIR) {
      process.env.PUPPETEER_CACHE_DIR = cacheDir;
    }
    
    // Also set Puppeteer's cache directory environment variable
    process.env.PUPPETEER_DOWNLOAD_PATH = cacheDir;
    
    console.log(`   📂 Cache directory: ${cacheDir}`);
    
    // Ensure cache directory exists
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`   📁 Created cache directory: ${cacheDir}`);
      }
      // Verify write permissions
      fs.accessSync(cacheDir, fs.constants.W_OK);
      console.log(`   ✅ Cache directory is writable`);
    } catch (e: any) {
      console.warn(`   ⚠️  Cache directory issue: ${e.message}`);
    }

    let executablePath: string | null = null;
    
    // Method 1: Try Puppeteer's executablePath first (respects PUPPETEER_CACHE_DIR)
    // This is the most reliable method if Chrome was installed via 'puppeteer browsers install'
    try {
      const suggestedPath = puppeteer.executablePath();
      if (suggestedPath && fs.existsSync(suggestedPath)) {
        executablePath = suggestedPath;
        console.log(`   ✅ Found Chrome via Puppeteer: ${executablePath}`);
      }
    } catch (e) {
      console.log('   ⚠️  Puppeteer.executablePath() failed, searching manually...');
    }

    // Method 2: Search Puppeteer cache directory structure
    // Puppeteer stores Chrome as: {cacheDir}/chrome/{platform}-{revision}/chrome-{platform}/chrome
    if (!executablePath) {
      try {
        const chromeCacheDir = path.join(cacheDir, 'chrome');
        if (fs.existsSync(chromeCacheDir)) {
          // Look for chrome directories
          const entries = fs.readdirSync(chromeCacheDir);
          for (const entry of entries) {
            const platformDir = path.join(chromeCacheDir, entry);
            if (fs.statSync(platformDir).isDirectory()) {
              // Look for chrome-* directories
              const subEntries = fs.readdirSync(platformDir);
              for (const subEntry of subEntries) {
                if (subEntry.startsWith('chrome-')) {
                  const chromeDir = path.join(platformDir, subEntry);
                  // Chrome executable is usually in the root of chrome-* directory
                  const chromeExe = path.join(chromeDir, 'chrome');
                  if (fs.existsSync(chromeExe)) {
                    executablePath = chromeExe;
                    console.log(`   ✅ Found Chrome in cache structure: ${executablePath}`);
                    break;
                  }
                }
              }
              if (executablePath) break;
            }
          }
        }
      } catch (e: any) {
        console.log(`   ⚠️  Error searching cache structure: ${e.message}`);
      }
    }

    // Method 3: Use find command as fallback (works on Linux)
    if (!executablePath) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(
          `find "${cacheDir}" -type f \( -name "chrome" -o -name "chromium" \) -executable 2>/dev/null | head -1`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        if (result && fs.existsSync(result)) {
          executablePath = result;
          console.log(`   ✅ Found Chrome via find: ${executablePath}`);
        }
      } catch (e) {
        // find command failed or no Chrome found
      }
    }

    // Method 4: Search system Chrome locations (fastest if available)
    if (!executablePath) {
      const systemPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
      ];
      
      for (const systemPath of systemPaths) {
        try {
          if (fs.existsSync(systemPath)) {
            executablePath = systemPath;
            console.log(`   ✅ Found system Chrome at: ${systemPath}`);
            break;
          }
        } catch (e) {
          // Continue searching
        }
      }
    }

    // Set executable path if we found one
    if (executablePath) {
      launchOptions.executablePath = executablePath;
      console.log(`   🎯 Using Chrome at: ${executablePath}`);
    } else {
      // Chrome not found - try to install it at runtime
      console.log('   📥 Chrome not found in any location');
      console.log('   ⏳ Attempting to install Chrome at runtime...');
      console.log(`   📂 Cache directory: ${cacheDir}`);
      console.log('   ⏱️  This may take 3-5 minutes on first request');
      
      // Don't set executablePath - let Puppeteer download Chrome
      // This will use PUPPETEER_CACHE_DIR if set
      try {
        // Try to install Chrome using Puppeteer's browser installer
        const { execSync } = require('child_process');
        console.log('   🔄 Installing Chrome via Puppeteer...');
        execSync('npx puppeteer browsers install chrome', {
          env: {
            ...process.env,
            PUPPETEER_CACHE_DIR: cacheDir,
            PUPPETEER_DOWNLOAD_PATH: cacheDir,
            PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'false'
          },
          stdio: 'inherit',
          timeout: 600000 // 10 minutes timeout for runtime installation
        });
        console.log('   ✅ Chrome installation completed');
        
        // Try to find Chrome again after installation
        try {
          const result = execSync(
            `find "${cacheDir}" -type f -name "chrome" -executable 2>/dev/null | head -1`,
            { encoding: 'utf8', timeout: 5000 }
          ).trim();
          if (result && fs.existsSync(result)) {
            executablePath = result;
            launchOptions.executablePath = executablePath;
            console.log(`   ✅ Found Chrome after installation: ${executablePath}`);
          } else {
            // Try Puppeteer's executablePath after installation
            try {
              const suggestedPath = puppeteer.executablePath();
              if (suggestedPath && fs.existsSync(suggestedPath)) {
                executablePath = suggestedPath;
                launchOptions.executablePath = executablePath;
                console.log(`   ✅ Found Chrome via Puppeteer: ${executablePath}`);
              }
            } catch (e) {
              // Still not found, but let Puppeteer try to launch anyway
            }
          }
        } catch (e) {
          console.warn('   ⚠️  Could not verify Chrome installation');
        }
      } catch (installError: any) {
        const installErrorMsg = installError?.message || String(installError);
        console.warn(`   ⚠️  Chrome installation failed: ${installErrorMsg}`);
        console.warn('   💡 Trying to launch browser anyway - Puppeteer may handle it');
        // Continue to launch attempt - Puppeteer might still work
      }
    }

    // Launch browser
    try {
      browser = await puppeteer.launch(launchOptions);
      console.log('   ✅ Browser launched successfully');
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('   ❌ Failed to launch browser:', errorMsg);
      
      // Provide helpful error message with retry suggestion
      if (errorMsg.includes('Could not find Chrome') || errorMsg.includes('Browser was not found')) {
        throw new Error(
          `Chrome not found and installation failed.\n` +
          `This can happen on Render free tier due to:\n` +
          `1. Disk space limitations (Chrome needs ~200MB)\n` +
          `2. Network timeouts during download\n` +
          `3. Build timeout preventing Chrome installation\n\n` +
          `Solutions:\n` +
          `- Wait a few minutes and try again (first install takes time)\n` +
          `- Check Render logs for disk space warnings\n` +
          `- Verify PUPPETEER_CACHE_DIR is set: ${process.env.PUPPETEER_CACHE_DIR || 'not set'}\n` +
          `- Consider upgrading to Render paid tier for faster builds\n\n` +
          `Error: ${errorMsg}`
        );
      }
      throw error;
    }
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

    // Try HTML page first (more reliable than JSON endpoint)
    console.log(`  → Fetching following list from HTML page...`);
    try {
      followedArtists = await fetchFollowingFromHTMLPage(browser, artstationUsername);
      console.log(`  → Successfully fetched ${followedArtists.length} artists from HTML page`);
    } catch (htmlError: any) {
      console.warn(`  → HTML page fetch failed: ${htmlError.message}`);
      console.log(`  → Trying JSON API endpoint as fallback...`);
      
      // Fallback to JSON API endpoint
      while (hasMorePages) {
        console.log(`  → Fetching page ${currentPage}...`);
        
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: 1920, height: 1080 });
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          
          // Set longer timeout and less strict wait condition
          page.setDefaultNavigationTimeout(90000); // 90 seconds
          page.setDefaultTimeout(90000);

          const apiUrl = `https://www.artstation.com/users/${artstationUsername}/following.json?page=${currentPage}`;
          
          console.log(`     Navigating to: ${apiUrl}`);
          await page.goto(apiUrl, { 
            waitUntil: 'domcontentloaded', // Less strict than networkidle2
            timeout: 90000 // 90 seconds
          });

          // Wait for content to load
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Extract the JSON data
          const jsonData = await page.evaluate(() => {
            // @ts-ignore - document is available in browser context
            const preElement = document.querySelector('pre');
            if (preElement) {
              try {
                return JSON.parse(preElement.textContent || '{}');
              } catch (e) {
                return null;
              }
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
            if (jsonData.data.length < 20) {
              hasMorePages = false;
            } else {
              currentPage++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            hasMorePages = false;
            if (currentPage === 1) {
              console.warn(`     No data found in JSON response`);
            }
          }
        } catch (pageError: any) {
          console.error(`     Error fetching page ${currentPage}:`, pageError.message);
          hasMorePages = false;
          if (currentPage === 1 && followedArtists.length === 0) {
            throw new Error(`Failed to fetch following list: ${pageError.message}`);
          }
        } finally {
          await page.close();
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

// Fetch from HTML page (more reliable than JSON endpoint)
async function fetchFollowingFromHTMLPage(browser: any, artstationUsername: string) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set longer timeouts
    page.setDefaultNavigationTimeout(120000); // 2 minutes
    page.setDefaultTimeout(120000);
    
    const followingUrl = `https://www.artstation.com/users/${artstationUsername}/following`;
    console.log(`     Navigating to: ${followingUrl}`);
    
    // Use 'load' instead of 'networkidle2' - less strict, works better with slow connections
    await page.goto(followingUrl, { 
      waitUntil: 'load', // Wait for page load, not network idle
      timeout: 120000 // 2 minutes
    });

    console.log(`     Page loaded, waiting for content...`);
    // Wait for JavaScript to execute and populate the page
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to extract from initial state first (fastest)
    console.log(`     Extracting data from page...`);
    let artists = await page.evaluate(() => {
      const result: Array<{ username: string; name?: string; avatar?: string }> = [];
      
      try {
        // @ts-ignore - window is available in browser context
        const initialState = window.__INITIAL_STATE__;
        if (initialState && initialState.following && initialState.following.data) {
          initialState.following.data.forEach((user: any) => {
            if (user && user.username) {
              result.push({
                username: user.username,
                name: user.full_name || user.username,
                avatar: user.medium_avatar_url || user.small_picture_url || user.large_avatar_url
              });
            }
          });
        }
      } catch (e) {
        console.error('Error extracting from initial state:', e);
      }

      // Note: DOM extraction fallback removed - rely on initial state only
      // ArtStation's following page structure makes DOM extraction unreliable

      return result;
    });

    // If we didn't get data from initial state, try scrolling to load more
    if (artists.length === 0) {
      console.log(`     No data from initial state, trying to scroll and load more...`);
      await autoScroll(page);
      
      // Wait a bit more after scrolling
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try extracting again
      artists = await page.evaluate(() => {
        const result: Array<{ username: string; name?: string; avatar?: string }> = [];
        
        try {
          // @ts-ignore - window is available in browser context
          const initialState = window.__INITIAL_STATE__;
          if (initialState && initialState.following && initialState.following.data) {
            initialState.following.data.forEach((user: any) => {
              if (user && user.username) {
                result.push({
                  username: user.username,
                  name: user.full_name || user.username,
                  avatar: user.medium_avatar_url || user.small_picture_url || user.large_avatar_url
                });
              }
            });
          }
        } catch (e) {
          console.error('Error extracting after scroll:', e);
        }

        return result;
      });
    }

    console.log(`     Extracted ${artists.length} artists from page`);
    return artists;
  } catch (error: any) {
    console.error(`     Error in fetchFollowingFromHTMLPage:`, error.message);
    throw error;
  } finally {
    await page.close();
  }
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

