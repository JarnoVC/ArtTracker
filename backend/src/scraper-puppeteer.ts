import puppeteer from 'puppeteer';
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

export async function scrapeArtist(artistId: number, userId: number) {
  const artist = await db.getArtistById(artistId, userId);
  
  if (!artist) {
    throw new Error('Artist not found');
  }

  console.log(`🔍 Scraping ${artist.username} with Puppeteer...`);

  try {
    const browser = await getBrowser();
    const artworks: ScrapedArtwork[] = [];
    
    // Fetch all pages of artworks with pagination
    let currentPage = 1;
    let hasMorePages = true;
    let userInfo: any = null;

    while (hasMorePages) {
      console.log(`  → Fetching page ${currentPage}...`);
      
      const page = await browser.newPage();
      try {
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

        const apiUrl = `https://www.artstation.com/users/${artist.username}/projects.json?page=${currentPage}`;
        
        console.log(`     Navigating to: ${apiUrl}`);
        await page.goto(apiUrl, { 
          waitUntil: 'domcontentloaded', // Less strict than networkidle2
          timeout: 180000 // 3 minutes
        });

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
        }

        // Wait for content to load after Cloudflare passes
        await delay(3000);

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

        // Check if we got valid data
        if (jsonData && jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
          console.log(`     Found ${jsonData.data.length} artworks on page ${currentPage}`);
          
          // Extract artworks from this page
          jsonData.data.forEach((project: any) => {
            if (!project.hash_id) return;

            const artwork: ScrapedArtwork = {
              artwork_id: project.hash_id,
              title: project.title || 'Untitled',
              thumbnail_url: project.cover?.thumb_url || 
                            project.cover?.small_square_url || 
                            project.cover?.url || 
                            project.smaller_square_cover_url || '',
              artwork_url: project.permalink || `https://www.artstation.com/artwork/${project.hash_id}`,
              upload_date: project.published_at || project.created_at
            };

            artworks.push(artwork);
          });

          // Save user info from first page
          if (currentPage === 1 && jsonData.data[0]?.user) {
            userInfo = jsonData.data[0].user;
          }

          // Check if there are more pages
          // ArtStation typically returns 50 items per page
          if (jsonData.data.length < 50) {
            hasMorePages = false;
          } else {
            currentPage++;
            // Add a delay between page requests
            await delay(1000);
          }
        } else {
          // No more data
          hasMorePages = false;
          
          // If this is the first page and we got no data, try fallback
          if (currentPage === 1) {
            console.log('  ⚠ No valid JSON data found, trying profile page...');
            await page.close();
            return await scrapeFromProfilePage(artistId, userId, artist);
          }
        }
      } catch (pageError: any) {
        console.error(`     Error fetching page ${currentPage}:`, pageError.message);
        hasMorePages = false;
        if (currentPage === 1 && artworks.length === 0) {
          await page.close();
          console.log('  ⚠ API failed, trying profile page fallback...');
          return await scrapeFromProfilePage(artistId, userId, artist);
        }
      } finally {
        await page.close();
      }
    }

    console.log(`  → Total: ${artworks.length} artworks across ${currentPage} page(s)`);

    // Update artist info if available
    if (userInfo) {
      if (!artist.display_name && userInfo.full_name) {
        await db.updateArtist(artistId, userId, { display_name: userInfo.full_name });
      }
      if (!artist.avatar_url && userInfo.medium_avatar_url) {
        await db.updateArtist(artistId, userId, { avatar_url: userInfo.medium_avatar_url });
      }
    }

    // Store artworks in database
    let newCount = 0;
    for (const artwork of artworks) {
      const result = await db.addArtwork(
        userId,
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
    await db.updateArtist(artistId, userId, { last_checked: new Date().toISOString() });

    console.log(`  ✓ ${newCount} new artworks added`);

    return {
      artist: artist.username,
      total_found: artworks.length,
      new_artworks: newCount
    };

  } catch (error: any) {
    console.error(`  ✗ Error scraping ${artist.username}:`, error.message);
    throw error;
  }
}

// Fallback method: scrape from profile page
async function scrapeFromProfilePage(artistId: number, userId: number, artist: any) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
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
    
    console.log(`  → Trying profile page: ${artist.profile_url}`);
    await page.goto(artist.profile_url, { 
      waitUntil: 'domcontentloaded', // Less strict than networkidle2
      timeout: 180000 // 3 minutes
    });

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
    }

    console.log(`     Page loaded, waiting for content...`);
    await delay(5000); // Wait for JavaScript to execute after Cloudflare

    const data = await page.evaluate(() => {
      const result: any = {
        artworks: [],
        displayName: null,
        avatarUrl: null
      };

      try {
        // @ts-ignore - window is available in browser context
        const initialState = window.__INITIAL_STATE__;
        
        if (initialState) {
          if (initialState.user) {
            result.displayName = initialState.user.full_name || initialState.user.username;
            result.avatarUrl = initialState.user.medium_avatar_url || initialState.user.small_picture_url;
          }
          
          if (initialState.projects && initialState.projects.data) {
            initialState.projects.data.forEach((project: any) => {
              result.artworks.push({
                artwork_id: project.hash_id || project.id?.toString() || '',
                title: project.title || 'Untitled',
                thumbnail_url: project.cover?.thumb_url || project.cover?.small_square_url || project.cover?.url || '',
                artwork_url: project.permalink || `https://www.artstation.com/artwork/${project.hash_id}`,
                upload_date: project.published_at || project.created_at
              });
            });
          }
        }
      } catch (e) {
        console.error('Error extracting from initial state:', e);
      }

      return result;
    });

    // Update artist info
    if (data.displayName && !artist.display_name) {
      await db.updateArtist(artistId, userId, { display_name: data.displayName });
    }
    if (data.avatarUrl && !artist.avatar_url) {
      await db.updateArtist(artistId, userId, { avatar_url: data.avatarUrl });
    }

    console.log(`  → Found ${data.artworks.length} artworks from profile`);

    let newCount = 0;
    for (const artwork of data.artworks) {
      const result = await db.addArtwork(
        userId,
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

    await db.updateArtist(artistId, userId, { last_checked: new Date().toISOString() });

    await page.close();

    return {
      artist: artist.username,
      total_found: data.artworks.length,
      new_artworks: newCount
    };
  } catch (error: any) {
    console.error(`     Error in scrapeFromProfilePage:`, error.message);
    await page.close();
    throw error;
  }
}

// Quick check if artist has new artworks (optimized for "Check for Updates")
export async function checkArtistForUpdates(artistId: number, userId: number): Promise<{
  hasUpdates: boolean;
  latestArtStationDate?: string;
  latestDbDate?: string;
}> {
  const artist = await db.getArtistById(artistId, userId);
  if (!artist) {
    throw new Error('Artist not found');
  }

  // Get most recent artwork from database
  const dbArtworks = await db.getAllArtworks(userId, { artist_id: artistId });
  const latestDbArtwork = dbArtworks[0]; // Already sorted newest first
  const latestDbDate = latestDbArtwork?.upload_date || latestDbArtwork?.discovered_at;

  // Fetch only first page from ArtStation (quick check)
  const browser = await getBrowser();
  const page = await browser.newPage();
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
  
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(180000);

  try {
    const apiUrl = `https://www.artstation.com/users/${artist.username}/projects.json?page=1`;
    await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
    
    // Check if we hit Cloudflare challenge and wait for it to complete (quick check, shorter timeout)
    let isCloudflare = false;
    let waitTime = 0;
    const maxWaitTime = 30000; // Wait up to 30 seconds for Cloudflare (quick check)
    const checkInterval = 2000; // Check every 2 seconds
    
    while (waitTime < maxWaitTime) {
      const pageInfo = await page.evaluate(() => {
        // @ts-ignore - document and window are available in browser context
        return {
          // @ts-ignore - document is available in browser context
          title: document.title,
          // @ts-ignore - document is available in browser context
          bodyText: document.body ? document.body.textContent?.substring(0, 200) : ''
        };
      });
      
      // Check if we're on Cloudflare challenge page
      if (pageInfo.title.includes('Just a moment') || 
          pageInfo.title.includes('Please wait') ||
          pageInfo.bodyText.includes('Please complete a security check') ||
          pageInfo.bodyText.includes('Checking your browser')) {
        if (!isCloudflare) {
          isCloudflare = true;
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        
        try {
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: checkInterval }),
            new Promise(resolve => setTimeout(resolve, checkInterval))
          ]);
        } catch (e) {
          // Ignore
        }
      } else {
        break;
      }
    }
    
    await delay(1000);

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

    // Update last_checked timestamp - this should happen regardless of whether updates are found
    // The date represents when we last checked, not when we last found updates
    await db.updateArtist(artistId, userId, { last_checked: new Date().toISOString() });

    if (!jsonData?.data || !Array.isArray(jsonData.data) || jsonData.data.length === 0) {
      return { hasUpdates: false };
    }

    // Get the most recent artwork date from ArtStation
    const latestProject = jsonData.data[0];
    const latestArtStationDate = latestProject.published_at || latestProject.created_at;

    if (!latestDbDate) {
      // No artworks in DB yet, definitely has updates
      return { hasUpdates: true, latestArtStationDate, latestDbDate };
    }

    // Compare dates
    const artStationDate = new Date(latestArtStationDate).getTime();
    const dbDate = new Date(latestDbDate).getTime();
    const hasUpdates = artStationDate > dbDate;

    return {
      hasUpdates,
      latestArtStationDate,
      latestDbDate
    };
  } catch (error: any) {
    await page.close();
    console.error(`  ⚠ Error checking updates for ${artist.username}:`, error.message);
    // Update last_checked even on error, since we did attempt to check
    await db.updateArtist(artistId, userId, { last_checked: new Date().toISOString() });
    // If check fails, assume we need to scrape (safer)
    return { hasUpdates: true };
  }
}

// Optimized scraping: Only scrape new artworks, stop when finding existing ones
export async function scrapeArtistUpdates(artistId: number, userId: number) {
  const artist = await db.getArtistById(artistId, userId);
  if (!artist) {
    throw new Error('Artist not found');
  }

  // Get existing artwork IDs for this artist (to know when to stop)
  const existingArtworks = await db.getAllArtworks(userId, { artist_id: artistId });
  const existingArtworkIds = new Set(existingArtworks.map(a => a.artwork_id));

  console.log(`🔍 Scraping updates for ${artist.username}...`);

  const browser = await getBrowser();
  const artworks: ScrapedArtwork[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  let foundExistingArtwork = false;
  let userInfo: any = null;

  while (hasMorePages && !foundExistingArtwork) {
    console.log(`  → Fetching page ${currentPage}...`);
    
    const page = await browser.newPage();
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
    
    page.setDefaultNavigationTimeout(180000);
    page.setDefaultTimeout(180000);

    const apiUrl = `https://www.artstation.com/users/${artist.username}/projects.json?page=${currentPage}`;
    await page.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
    
    // Check if we hit Cloudflare challenge and wait for it to complete
    let isCloudflare = false;
    let waitTime = 0;
    const maxWaitTime = 60000; // Wait up to 60 seconds for Cloudflare (shorter for update checks)
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
          console.log(`     ⏳ Cloudflare challenge detected, waiting...`);
        }
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
          console.log(`     ✓ Cloudflare challenge completed`);
        }
        break;
      }
    }
    
    // Wait a bit more after Cloudflare passes
    await delay(2000);

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

    if (jsonData?.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
      console.log(`     Found ${jsonData.data.length} artworks on page ${currentPage}`);
      
      // Save user info from first page
      if (currentPage === 1 && jsonData.data[0]?.user) {
        userInfo = jsonData.data[0].user;
      }

      for (const project of jsonData.data) {
        if (!project.hash_id) continue;

        // If we already have this artwork, we've caught up - stop scraping
        if (existingArtworkIds.has(project.hash_id)) {
          foundExistingArtwork = true;
          console.log(`     Found existing artwork, stopping at page ${currentPage}`);
          break;
        }

        const artwork: ScrapedArtwork = {
          artwork_id: project.hash_id,
          title: project.title || 'Untitled',
          thumbnail_url: project.cover?.thumb_url || 
                        project.cover?.small_square_url || 
                        project.cover?.url || 
                        project.smaller_square_cover_url || '',
          artwork_url: project.permalink || `https://www.artstation.com/artwork/${project.hash_id}`,
          upload_date: project.published_at || project.created_at
        };

        artworks.push(artwork);
      }

      // Check if there are more pages
      if (jsonData.data.length < 50 || foundExistingArtwork) {
        hasMorePages = false;
      } else {
        currentPage++;
        await delay(500);
      }
    } else {
      hasMorePages = false;
      
      // If this is the first page and we got no data, try fallback
      if (currentPage === 1) {
        console.log('  ⚠ No valid JSON data found, trying profile page...');
        return await scrapeFromProfilePage(artistId, userId, artist);
      }
    }
  }

  // Update artist info if available
  if (userInfo) {
    if (!artist.display_name && userInfo.full_name) {
      await db.updateArtist(artistId, userId, { display_name: userInfo.full_name });
    }
    if (!artist.avatar_url && userInfo.medium_avatar_url) {
      await db.updateArtist(artistId, userId, { avatar_url: userInfo.medium_avatar_url });
    }
  }

  // Store only new artworks
  let newCount = 0;
  for (const artwork of artworks) {
    const result = await db.addArtwork(
      userId,
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
  await db.updateArtist(artistId, userId, { last_checked: new Date().toISOString() });

  console.log(`  ✓ ${newCount} new artworks added (checked ${currentPage} page(s))`);

  return {
    artist: artist.username,
    total_found: artworks.length,
    new_artworks: newCount
  };
}

// Optimized scrape all artists: Quick check first, only scrape if updates exist
export async function scrapeAllArtists(userId: number) {
  const artists = await db.getAllArtists(userId);
  
  if (artists.length === 0) {
    return { 
      message: 'No artists to scrape', 
      completed: 0,
      skipped: 0,
      failed: 0,
      total_new_artworks: 0,
      results: [] 
    };
  }

  console.log(`\n🔄 Checking ${artists.length} artists for updates...\n`);

  const results: any[] = [];

  for (const artist of artists) {
    try {
      // Quick check: does this artist have new artworks?
      const checkResult = await checkArtistForUpdates(artist.id, userId);
      
      if (!checkResult.hasUpdates) {
        console.log(`  ⏭ Skipping @${artist.username} - no updates`);
        results.push({
          artist: artist.username,
          status: 'skipped',
          reason: 'no_updates'
        });
        // Small delay even for skipped artists
        await delay(300);
        continue;
      }

      // Has updates - scrape only new artworks
      console.log(`  🔍 @${artist.username} has updates, scraping...`);
      const scrapeResult = await scrapeArtistUpdates(artist.id, userId);
      results.push({
        ...scrapeResult,
        status: 'completed'
      });

      // Small delay between artists
      await delay(500);
    } catch (error: any) {
      console.error(`  ✗ Error checking @${artist.username}:`, error.message);
      results.push({
        artist: artist.username,
        status: 'failed',
        error: error.message
      });
    }
  }

  const completed = results.filter(r => r.status === 'completed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const totalNew = results.reduce((sum, r) => sum + (r.new_artworks || 0), 0);

  console.log(`\n✅ Check complete!`);
  console.log(`   Updated: ${completed} artists`);
  console.log(`   Skipped: ${skipped} artists (no updates)`);
  console.log(`   Failed: ${failed} artists`);
  console.log(`   Total new artworks: ${totalNew}`);

  return {
    completed,
    skipped,
    failed,
    total_new_artworks: totalNew,
    total_artists: artists.length,
    results
  };
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
