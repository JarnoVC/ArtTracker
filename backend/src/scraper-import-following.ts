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
      console.log(`  → Trying direct JSON API endpoint...`);
      
      // Try direct JSON API endpoint as fallback
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        page.setDefaultNavigationTimeout(90000);
        page.setDefaultTimeout(90000);

        while (hasMorePages) {
          console.log(`  → Fetching page ${currentPage} from JSON API...`);
          
          const apiUrl = `https://www.artstation.com/users/${artstationUsername}/following.json?page=${currentPage}`;
          console.log(`     Navigating to: ${apiUrl}`);
          
          await page.goto(apiUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 90000
          });

          await new Promise(resolve => setTimeout(resolve, 3000));

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
              if (user && user.username) {
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
              console.warn(`     No data found in JSON response - page might require authentication`);
            }
          }
        }
        
        await page.close();
      } catch (apiError: any) {
        console.error(`  → JSON API also failed: ${apiError.message}`);
        // Continue - we'll throw an error if no artists were found
      }
    }

    console.log(`  → Total found: ${followedArtists.length} followed artists`);

    if (followedArtists.length === 0) {
      // Provide more helpful error message
      const errorMessage = 
        `No followed artists found for username: ${artstationUsername}\n\n` +
        `Possible reasons:\n` +
        `1. The username might be incorrect\n` +
        `2. The profile's following list might be private\n` +
        `3. ArtStation might require authentication to view following lists\n` +
        `4. The profile might not be following anyone\n` +
        `5. ArtStation's page structure might have changed\n\n` +
        `💡 Try:\n` +
        `- Verify the username is correct (case-sensitive)\n` +
        `- Check if the following page is accessible in a browser: https://www.artstation.com/users/${artstationUsername}/following\n` +
        `- Make sure the profile is public\n` +
        `- Check Render logs for detailed debug information`;
      
      throw new Error(errorMessage);
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
    
    // Set up response interception BEFORE navigating (to catch API calls)
    const apiResponses: any[] = [];
    const responseHandler = async (response: any) => {
      const url = response.url();
      if (url.includes('/following') && (url.includes('.json') || url.includes('page=') || response.headers()['content-type']?.includes('application/json'))) {
        try {
          const json = await response.json();
          apiResponses.push({ url, data: json });
          console.log(`     ✓ Intercepted API response: ${url}`);
        } catch (e) {
          // Not JSON or couldn't parse
        }
      }
    };
    page.on('response', responseHandler);
    
    const followingUrl = `https://www.artstation.com/users/${artstationUsername}/following`;
    console.log(`     Navigating to: ${followingUrl}`);
    
    // Use 'load' instead of 'networkidle2' - less strict, works better with slow connections
    await page.goto(followingUrl, { 
      waitUntil: 'load', // Wait for page load, not network idle
      timeout: 120000 // 2 minutes
    });

    console.log(`     Page loaded, waiting for content...`);
    
    // Check if page loaded correctly
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasBody: !!document.body,
        bodyTextLength: document.body ? document.body.textContent?.length : 0,
        hasInitialState: typeof (window as any).__INITIAL_STATE__ !== 'undefined'
      };
    });
    console.log(`     Page info:`, JSON.stringify(pageInfo, null, 2));
    
    // Wait for JavaScript to execute and populate the page, and for API calls to complete
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Try to extract from initial state and API responses
    console.log(`     Extracting data from page...`);
    let artists: Array<{ username: string; name?: string; avatar?: string }> = [];
    
    // Check if we got any API responses first (most reliable)
    if (apiResponses.length > 0) {
      console.log(`     Found ${apiResponses.length} API response(s), extracting data...`);
      
      for (const apiResponse of apiResponses) {
        const apiData = apiResponse.data;
        if (apiData && apiData.data && Array.isArray(apiData.data)) {
          apiData.data.forEach((user: any) => {
            if (user && user.username && !artists.find(a => a.username === user.username)) {
              artists.push({
                username: user.username,
                name: user.full_name || user.username,
                avatar: user.medium_avatar_url || user.small_picture_url || user.large_avatar_url
              });
            }
          });
        }
      }
      
      if (artists.length > 0) {
        console.log(`     ✓ Extracted ${artists.length} artists from API responses`);
        page.off('response', responseHandler);
        return artists;
      }
    }

    // Try to extract from initial state
    const extractedData = await page.evaluate(() => {
      const result: Array<{ username: string; name?: string; avatar?: string }> = [];
      
      // Debug: Log what's available
      const debugInfo: any = {
        hasWindow: typeof window !== 'undefined',
        hasInitialState: false,
        initialStateKeys: [],
        hasFollowing: false,
        pageTitle: '',
        bodyText: ''
      };
      
      try {
        // @ts-ignore - window is available in browser context
        debugInfo.pageTitle = document.title;
        // @ts-ignore - document is available in browser context
        debugInfo.bodyText = document.body ? document.body.textContent?.substring(0, 200) : 'no body';
        
        // @ts-ignore - window is available in browser context
        if (window.__INITIAL_STATE__) {
          // @ts-ignore - window is available in browser context
          const initialState = window.__INITIAL_STATE__;
          debugInfo.hasInitialState = true;
          debugInfo.initialStateKeys = Object.keys(initialState || {});
          
          if (initialState.following) {
            debugInfo.hasFollowing = true;
            if (initialState.following.data && Array.isArray(initialState.following.data)) {
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
          }
          
          // Try alternative locations in initial state
          if (result.length === 0) {
            // Maybe it's in a different structure
            if (initialState.users && Array.isArray(initialState.users)) {
              initialState.users.forEach((user: any) => {
                if (user && user.username) {
                  result.push({
                    username: user.username,
                    name: user.full_name || user.username,
                    avatar: user.medium_avatar_url || user.small_picture_url || user.large_avatar_url
                  });
                }
              });
            }
            
            // Try data property directly
            if (initialState.data && Array.isArray(initialState.data)) {
              initialState.data.forEach((user: any) => {
                if (user && user.username) {
                  result.push({
                    username: user.username,
                    name: user.full_name || user.username,
                    avatar: user.medium_avatar_url || user.small_picture_url || user.large_avatar_url
                  });
                }
              });
            }
          }
        }
        
        // Try to find data in script tags (sometimes ArtStation embeds data in script tags)
        // @ts-ignore - document is available in browser context
        const scripts = document.querySelectorAll('script');
        for (const script of Array.from(scripts)) {
          const text = script.textContent || '';
          if (text.includes('__INITIAL_STATE__') || text.includes('following')) {
            try {
              // Try to extract JSON from script tag
              const jsonMatch = text.match(/\{.*"following".*\}/s);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.following && parsed.following.data) {
                  parsed.following.data.forEach((user: any) => {
                    if (user && user.username && !result.find(r => r.username === user.username)) {
                      result.push({
                        username: user.username,
                        name: user.full_name || user.username,
                        avatar: user.medium_avatar_url || user.small_picture_url || user.large_avatar_url
                      });
                    }
                  });
                }
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
        
        // Return both result and debug info
        return { artists: result, debug: debugInfo };
      } catch (e) {
        debugInfo.error = String(e);
        return { artists: result, debug: debugInfo };
      }
    });
    
    // Extract artists and debug info
    const debugInfo = (extractedData as any).debug;
    const extractedArtists = (extractedData as any).artists || [];
    
    // Log debug information
    console.log(`     Debug info:`, JSON.stringify(debugInfo, null, 2));
    console.log(`     Found ${extractedArtists.length} artists in initial state extraction`);
    
    // Add artists from initial state if found
    if (extractedArtists.length > 0) {
      artists = extractedArtists;
    }
    
    // If we have debug info, check if the page might be private or require login
    if (artists.length === 0 && debugInfo.hasInitialState) {
      console.log(`     ⚠️  Page has initial state but no following data - might be private or empty`);
      console.log(`     💡 Check if the profile's following list is public`);
    } else if (artists.length === 0 && !debugInfo.hasInitialState) {
      console.log(`     ⚠️  Page doesn't have initial state - might be blocked or require authentication`);
    }

    // If we still don't have data from API responses or initial state, try scrolling to trigger more API calls
    if (artists.length === 0) {
      console.log(`     No data yet, scrolling to trigger lazy loading...`);
      await autoScroll(page);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check API responses again after scrolling
      if (apiResponses.length > 0 && artists.length === 0) {
        console.log(`     Re-checking ${apiResponses.length} API response(s) after scroll...`);
        for (const apiResponse of apiResponses) {
          const apiData = apiResponse.data;
          if (apiData && apiData.data && Array.isArray(apiData.data)) {
            apiData.data.forEach((user: any) => {
              if (user && user.username && !artists.find((a: any) => a.username === user.username)) {
                artists.push({
                  username: user.username,
                  name: user.full_name || user.username,
                  avatar: user.medium_avatar_url || user.small_picture_url || user.large_avatar_url
                });
              }
            });
          }
        }
      }
      
      // If still no data, try extracting from DOM as last resort
      if (artists.length === 0) {
        console.log(`     Trying DOM extraction as last resort...`);
        const domArtists = await page.evaluate(() => {
          const result: Array<{ username: string; name?: string; avatar?: string }> = [];
          
          try {
            // Look for user profile links in the following page
            // ArtStation following page typically has user cards
            // @ts-ignore - document is available in browser context
            const userCards = document.querySelectorAll('[class*="user"], [class*="profile"], [class*="follower"]');
            const seenUsernames = new Set<string>();
            
            userCards.forEach((card: any) => {
              const link = card.querySelector('a[href^="/"]');
              if (link) {
                const href = link.getAttribute('href');
                if (href && href.match(/^\/[^\/]+\/?$/)) {
                  const username = href.replace(/^\//, '').replace(/\/$/, '');
                  // Skip common non-user paths and the current user
                  if (username && 
                      !username.includes('.') && 
                      !['projects', 'following', 'followers', 'about', 'blog', 'shop', 'artwork'].includes(username) &&
                      !seenUsernames.has(username)) {
                    seenUsernames.add(username);
                    const nameEl = card.querySelector('.user-name, [class*="name"], h3, h4, [class*="full-name"]');
                    const avatarEl = card.querySelector('img, [class*="avatar"], [class*="picture"]');
                    result.push({
                      username: username,
                      name: nameEl ? nameEl.textContent?.trim() : undefined,
                      avatar: avatarEl ? (avatarEl.src || avatarEl.getAttribute('src')) : undefined
                    });
                  }
                }
              }
            });
            
            // Also try direct links if user cards didn't work
            if (result.length === 0) {
              // @ts-ignore - document is available in browser context
              const links = document.querySelectorAll('a[href^="/"]');
              links.forEach((link: any) => {
                const href = link.getAttribute('href');
                if (href && href.match(/^\/[^\/]+\/?$/)) {
                  const username = href.replace(/^\//, '').replace(/\/$/, '');
                  if (username && 
                      !username.includes('.') && 
                      !['projects', 'following', 'followers', 'about', 'blog', 'shop', 'artwork'].includes(username) &&
                      !seenUsernames.has(username)) {
                    seenUsernames.add(username);
                    result.push({
                      username: username,
                      name: undefined,
                      avatar: undefined
                    });
                  }
                }
              });
            }
          } catch (e) {
            console.error('Error in DOM extraction:', e);
          }
          
          return result;
        });
        
        if (domArtists.length > 0) {
          console.log(`     Found ${domArtists.length} artists via DOM extraction`);
          artists = domArtists;
        }
      }
    }
    
    // Remove response handler
    page.off('response', responseHandler);

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

