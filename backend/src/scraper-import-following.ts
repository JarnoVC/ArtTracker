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
      headless: true, // Headless mode (use true for compatibility)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled', // Remove automation flags (helps bypass Cloudflare)
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
        '--start-maximized'
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
    // Make browser look more realistic to avoid Cloudflare detection
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Remove webdriver property (Cloudflare detects this)
    await page.evaluateOnNewDocument(() => {
      // @ts-ignore - navigator is available in browser context
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Add realistic browser headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });
    
    // Set longer timeouts for Cloudflare
    page.setDefaultNavigationTimeout(180000); // 3 minutes
    page.setDefaultTimeout(180000);
    
    // Set up response interception BEFORE navigating (to catch ALL API calls)
    const apiResponses: any[] = [];
    const responseHandler = async (response: any) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      // Intercept ALL JSON responses from ArtStation (Cloudflare might block specific patterns)
      if (url.includes('artstation.com') && contentType.includes('application/json')) {
        try {
          const json = await response.json();
          
          // Check if this JSON contains user/following data
          const hasUserData = json.data && Array.isArray(json.data) && json.data.length > 0 && 
                             json.data[0] && (json.data[0].username || json.data[0].id);
          
          // Also check for following-related URLs
          const isFollowingUrl = url.includes('/following') || 
                                url.includes('/users/') && url.includes(artstationUsername) ||
                                url.includes('page=');
          
          if (hasUserData || isFollowingUrl) {
            apiResponses.push({ url, data: json, status: response.status() });
            console.log(`     ✓ Intercepted API response: ${url} (status: ${response.status()})`);
            
            if (hasUserData) {
              console.log(`     ✓ Found ${json.data.length} users in response`);
            }
          }
        } catch (e) {
          // Not JSON or couldn't parse - that's okay
        }
      }
    };
    page.on('response', responseHandler);
    
    const followingUrl = `https://www.artstation.com/users/${artstationUsername}/following`;
    console.log(`     Navigating to: ${followingUrl}`);
    
    // Navigate to page
    await page.goto(followingUrl, { 
      waitUntil: 'domcontentloaded', // Don't wait for all resources
      timeout: 180000 // 3 minutes
    });

    console.log(`     Page loaded, checking for Cloudflare...`);
    
    // Check if we hit Cloudflare challenge and wait for it to complete
    let isCloudflare = false;
    let waitTime = 0;
    const maxWaitTime = 90000; // Wait up to 90 seconds for Cloudflare
    const checkInterval = 3000; // Check every 3 seconds
    
    while (waitTime < maxWaitTime) {
      const pageInfo = await page.evaluate(() => {
        // @ts-ignore - document and window are available in browser context
        return {
          // @ts-ignore - document is available in browser context
          title: document.title,
          // @ts-ignore - window is available in browser context
          url: window.location.href,
          // @ts-ignore - document is available in browser context
          bodyText: document.body ? document.body.textContent?.substring(0, 500) : ''
        };
      });
      
      // Check if we're on Cloudflare challenge page
      if (pageInfo.title.includes('Just a moment') || 
          pageInfo.title.includes('Please wait') ||
          pageInfo.bodyText.includes('Please complete a security check') ||
          pageInfo.bodyText.includes('Checking your browser') ||
          pageInfo.bodyText.includes('DDoS protection by Cloudflare')) {
        if (!isCloudflare) {
          isCloudflare = true;
          console.log(`     ⏳ Cloudflare challenge detected, waiting for it to complete...`);
        }
        console.log(`     ⏳ Still waiting... (${Math.round(waitTime/1000)}s/${Math.round(maxWaitTime/1000)}s)`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        
        // Try to wait for navigation (Cloudflare might redirect)
        try {
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: checkInterval }),
            new Promise(resolve => setTimeout(resolve, checkInterval))
          ]);
        } catch (e) {
          // Navigation might not happen, that's okay
        }
      } else {
        // We're past Cloudflare
        if (isCloudflare) {
          console.log(`     ✓ Cloudflare challenge completed after ${Math.round(waitTime/1000)}s!`);
        }
        break;
      }
    }
    
    if (isCloudflare && waitTime >= maxWaitTime) {
      console.log(`     ⚠️  Cloudflare challenge timed out after ${maxWaitTime/1000}s`);
      console.log(`     💡 The page might be permanently blocked or require manual verification`);
    }
    
    // Wait for JavaScript to execute and API calls to complete after Cloudflare
    console.log(`     Waiting for page content to load...`);
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds for content
    
    // Check if page loaded correctly
    const pageInfo = await page.evaluate(() => {
      // @ts-ignore - document and window are available in browser context
      return {
        // @ts-ignore - document is available in browser context
        title: document.title,
        // @ts-ignore - window is available in browser context
        url: window.location.href,
        // @ts-ignore - document is available in browser context
        hasBody: !!document.body,
        // @ts-ignore - document is available in browser context
        bodyTextLength: document.body ? document.body.textContent?.length : 0,
        // @ts-ignore - window is available in browser context
        hasInitialState: typeof (window as any).__INITIAL_STATE__ !== 'undefined'
      };
    });
    console.log(`     Page info:`, JSON.stringify(pageInfo, null, 2));
    console.log(`     Total API responses intercepted: ${apiResponses.length}`);
    
    // Try to extract from initial state and API responses
    console.log(`     Extracting data from page...`);
    let artists: Array<{ username: string; name?: string; avatar?: string }> = [];
    
    // Check if we got any API responses first (most reliable)
    if (apiResponses.length > 0) {
      console.log(`     Found ${apiResponses.length} API response(s), extracting data...`);
      
      for (const apiResponse of apiResponses) {
        const apiData = apiResponse.data;
        
        // Try different data structures - based on your JSON: { data: [...], total_count: ... }
        if (apiData && apiData.data && Array.isArray(apiData.data)) {
          apiData.data.forEach((user: any) => {
            if (user && user.username && !artists.find((a: any) => a.username === user.username)) {
              artists.push({
                username: user.username,
                name: user.full_name || user.display_name || user.username,
                avatar: user.medium_avatar_url || user.small_avatar_url || user.large_avatar_url || user.avatar_url
              });
            }
          });
          console.log(`     ✓ Extracted ${apiData.data.length} users from API response data array`);
        }
        
        // Try items array
        if (apiData && apiData.items && Array.isArray(apiData.items)) {
          apiData.items.forEach((user: any) => {
            if (user && user.username && !artists.find((a: any) => a.username === user.username)) {
              artists.push({
                username: user.username,
                name: user.full_name || user.display_name || user.username,
                avatar: user.medium_avatar_url || user.small_avatar_url || user.large_avatar_url || user.avatar_url
              });
            }
          });
        }
        
        // Try users array
        if (apiData && apiData.users && Array.isArray(apiData.users)) {
          apiData.users.forEach((user: any) => {
            if (user && user.username && !artists.find((a: any) => a.username === user.username)) {
              artists.push({
                username: user.username,
                name: user.full_name || user.display_name || user.username,
                avatar: user.medium_avatar_url || user.small_avatar_url || user.large_avatar_url || user.avatar_url
              });
            }
          });
        }
        
        // If apiData itself is an array (unlikely but possible)
        if (Array.isArray(apiData)) {
          apiData.forEach((user: any) => {
            if (user && user.username && !artists.find((a: any) => a.username === user.username)) {
              artists.push({
                username: user.username,
                name: user.full_name || user.display_name || user.username,
                avatar: user.medium_avatar_url || user.small_avatar_url || user.large_avatar_url || user.avatar_url
              });
            }
          });
        }
      }
      
      if (artists.length > 0) {
        console.log(`     ✓ Successfully extracted ${artists.length} artists from API responses`);
        page.off('response', responseHandler);
        return artists;
      } else {
        console.log(`     ⚠️  API responses found but no user data extracted`);
        // Log response structure for debugging
        if (apiResponses.length > 0) {
          console.log(`     Sample response URL: ${apiResponses[0].url}`);
          console.log(`     Sample response keys:`, Object.keys(apiResponses[0].data || {}).join(', '));
          if (apiResponses[0].data) {
            console.log(`     Sample response data type:`, Array.isArray(apiResponses[0].data) ? 'array' : typeof apiResponses[0].data);
            if (typeof apiResponses[0].data === 'object' && !Array.isArray(apiResponses[0].data)) {
              const sampleKeys = Object.keys(apiResponses[0].data).slice(0, 10);
              console.log(`     Sample response data keys:`, sampleKeys.join(', '));
            }
          }
        }
      }
    } else {
      console.log(`     ⚠️  No API responses intercepted - Cloudflare might be blocking requests`);
    }

    // Try to extract from initial state
    const extractedData = await page.evaluate(() => {
      const result: Array<{ username: string; name?: string; avatar?: string }> = [];
      
      // Debug: Log what's available
      const debugInfo: any = {
        // @ts-ignore - window is available in browser context
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
          // @ts-ignore - script is an Element with textContent in browser context
          const text = (script as any).textContent || '';
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
      
      // If still no data, try extracting from DOM - look for actual user profile links
      if (artists.length === 0) {
        console.log(`     Trying DOM extraction...`);
        const domArtists = await page.evaluate((artstationUsername) => {
          const result: Array<{ username: string; name?: string; avatar?: string }> = [];
          const seenUsernames = new Set<string>();
          
          try {
            // ArtStation following page has links to user profiles
            // Look for all links that match the pattern /username (simple user profile URL)
            // @ts-ignore - document is available in browser context
            const allLinks = document.querySelectorAll('a[href]');
            
            allLinks.forEach((link: any) => {
              const href = link.getAttribute('href');
              if (!href) return;
              
              // Match user profile URLs: /username (not /username/projects, etc.)
              // This is the pattern ArtStation uses for user profiles
              const userProfileMatch = href.match(/^\/([^\/\?#\.]+)\/?$/);
              if (userProfileMatch) {
                const username = userProfileMatch[1];
                
                // Skip the current user and common non-user paths
                if (username && 
                    username !== artstationUsername &&
                    username.length > 0 &&
                    !username.match(/^\d+$/) && // Skip numeric-only IDs
                    !['projects', 'following', 'followers', 'about', 'blog', 'shop', 'artwork', 
                      'challenges', 'marketplace', 'jobs', 'learn', 'contests', 'help', 
                      'api', 'search', 'login', 'signup', 'logout'].includes(username.toLowerCase()) &&
                    !seenUsernames.has(username)) {
                  
                  seenUsernames.add(username);
                  
                  // Try to find name and avatar in the link's context
                  let name: string | undefined;
                  let avatar: string | undefined;
                  
                  // Look in parent elements for user info
                  const parent = link.closest('div, article, section, li, span');
                  if (parent) {
                    // Try to find name
                    const nameSelectors = [
                      '.user-name', 
                      '[class*="name"]', 
                      'h3', 'h4', 'h5',
                      '[class*="full-name"]',
                      '[class*="display-name"]',
                      '.username',
                      'span'
                    ];
                    
                    for (const selector of nameSelectors) {
                      try {
                        const nameEl = parent.querySelector(selector);
                        if (nameEl && nameEl.textContent && nameEl.textContent.trim() && nameEl.textContent.trim().length < 100) {
                          name = nameEl.textContent.trim();
                          break;
                        }
                      } catch (e) {
                        // Continue to next selector
                      }
                    }
                    
                    // Try to find avatar image
                    const avatarSelectors = [
                      'img[class*="avatar"]',
                      'img[class*="picture"]',
                      'img[class*="profile"]',
                      'img[src*="avatar"]',
                      'img[src*="cdn.artstation"]',
                      'img'
                    ];
                    
                    for (const selector of avatarSelectors) {
                      try {
                        const avatarEl = parent.querySelector(selector);
                        if (avatarEl) {
                          const src = avatarEl.src || avatarEl.getAttribute('src');
                          if (src && (src.includes('avatar') || src.includes('artstation'))) {
                            avatar = src;
                            break;
                          }
                        }
                      } catch (e) {
                        // Continue to next selector
                      }
                    }
                  }
                  
                  result.push({
                    username: username,
                    name: name,
                    avatar: avatar
                  });
                }
              }
            });
            
            console.log(`DOM extraction found ${result.length} potential users`);
          } catch (e: any) {
            console.error('Error in DOM extraction:', e?.message || String(e));
          }
          
          return result;
        }, artstationUsername);
        
        if (domArtists.length > 0) {
          console.log(`     Found ${domArtists.length} artists via DOM extraction`);
          // If we found a reasonable number of users (not too many which would indicate nav links)
          if (domArtists.length > 0 && domArtists.length < 100) {
            artists = domArtists;
            console.log(`     ✓ Using ${artists.length} artists from DOM extraction`);
          } else if (domArtists.length >= 100) {
            console.log(`     ⚠️  Found ${domArtists.length} links - likely picking up navigation, filtering...`);
            // Filter to only links with avatars or names (more likely to be actual users)
            const filtered = domArtists.filter(a => a.avatar || a.name);
            if (filtered.length > 0 && filtered.length < domArtists.length) {
              artists = filtered;
              console.log(`     ✓ Filtered to ${artists.length} likely users`);
            }
          }
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

