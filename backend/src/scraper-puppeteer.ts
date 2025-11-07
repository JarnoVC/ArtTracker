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

    // Set up cache directory for Puppeteer
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
    process.env.PUPPETEER_CACHE_DIR = cacheDir;
    
    // Ensure cache directory exists
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`   📁 Created cache directory: ${cacheDir}`);
      }
    } catch (e) {
      console.warn(`   ⚠️  Could not create cache directory: ${cacheDir}`);
    }

    let executablePath: string | null = null;
    
    // Method 1: Search system Chrome locations first (fastest if available)
    const systemPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ];
    
    for (const path of systemPaths) {
      try {
        if (fs.existsSync(path)) {
          executablePath = path;
          console.log(`   ✅ Found system Chrome at: ${path}`);
          break;
        }
      } catch (e) {
        // Continue searching
      }
    }

    // Method 2: Search cache directory (where we might have installed it)
    if (!executablePath) {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`find ${cacheDir} -type f \( -name "chrome" -o -name "chromium" \) 2>/dev/null | head -1`, { 
          encoding: 'utf8',
          timeout: 5000
        }).trim();
        if (result && fs.existsSync(result)) {
          executablePath = result;
          console.log(`   ✅ Found Chrome in cache: ${executablePath}`);
        }
      } catch (e) {
        // find command failed or no Chrome found
      }
    }

    // Method 3: Try Puppeteer's executablePath (might throw if Chrome not found)
    if (!executablePath) {
      try {
        const suggestedPath = puppeteer.executablePath();
        if (suggestedPath && fs.existsSync(suggestedPath)) {
          executablePath = suggestedPath;
          console.log(`   ✅ Found Chrome via Puppeteer: ${executablePath}`);
        }
      } catch (e) {
        // Puppeteer couldn't find Chrome - that's okay, we'll let it download
        console.log('   📍 Puppeteer could not locate Chrome, will attempt auto-download');
      }
    }

    // Set executable path if we found one
    if (executablePath) {
      launchOptions.executablePath = executablePath;
      console.log(`   🎯 Using Chrome at: ${executablePath}`);
    } else {
      // Don't set executablePath - let Puppeteer download Chrome automatically
      console.log('   📥 Chrome not found in any location');
      console.log('   ⏳ Puppeteer will download Chrome automatically on first launch...');
      console.log(`   📂 Cache directory: ${cacheDir}`);
      console.log('   ⏱️  This may take 2-5 minutes on first request');
    }

    // Launch browser (Puppeteer will download Chrome if needed)
    try {
      browser = await puppeteer.launch(launchOptions);
      console.log('   ✅ Browser launched successfully');
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('   ❌ Failed to launch browser:', errorMsg);
      
      // Provide helpful error message
      if (errorMsg.includes('Could not find Chrome') || errorMsg.includes('Browser was not found')) {
        throw new Error(
          `Chrome installation failed. This could be due to:\n` +
          `1. Insufficient disk space on Render (Chrome needs ~200MB)\n` +
          `2. Network issues preventing download\n` +
          `3. Cache directory permissions\n\n` +
          `Try:\n` +
          `- Check Render logs for disk space warnings\n` +
          `- Verify PUPPETEER_CACHE_DIR environment variable is set\n` +
          `- Wait a few minutes and try again (first download takes time)\n\n` +
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
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const apiUrl = `https://www.artstation.com/users/${artist.username}/projects.json?page=${currentPage}`;
      
      await page.goto(apiUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait a bit
      await delay(500);

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
          await delay(500);
        }
      } else {
        // No more data
        hasMorePages = false;
        
        // If this is the first page and we got no data, try fallback
        if (currentPage === 1) {
          console.log('  ⚠ No valid JSON data found, trying profile page...');
          return await scrapeFromProfilePage(artistId, userId, artist);
        }
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

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log(`  → Trying profile page: ${artist.profile_url}`);
  await page.goto(artist.profile_url, { 
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await delay(2000);

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

  await page.close();

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

  return {
    artist: artist.username,
    total_found: data.artworks.length,
    new_artworks: newCount
  };
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

  try {
    const apiUrl = `https://www.artstation.com/users/${artist.username}/projects.json?page=1`;
    await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(500);

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

    const apiUrl = `https://www.artstation.com/users/${artist.username}/projects.json?page=${currentPage}`;
    await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(500);

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
