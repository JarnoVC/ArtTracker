import express from 'express';
// Switch to Puppeteer scraper for Cloudflare bypass
import { scrapeArtist, scrapeAllArtists, scrapeArtistUpdates, checkArtistForUpdates } from '../scraper-puppeteer';
import * as db from '../database';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Scrape a specific artist (full scrape - used for initial imports)
router.post('/artist/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const artistId = parseInt(req.params.id);
    const optimized = req.query.optimized === 'true';
    
    console.log(`📥 Scrape request: artistId=${artistId}, userId=${req.user.id}, optimized=${optimized}`);
    
    // Verify artist belongs to user
    const artist = await db.getArtistById(artistId, req.user.id);
    if (!artist) {
      console.log(`❌ Artist ${artistId} not found for user ${req.user.id}`);
      return res.status(404).json({ error: 'Artist not found' });
    }
    
    console.log(`✓ Found artist: ${artist.username} (ID: ${artistId})`);
    
    // Use optimized scraping if requested (default for "Check for Updates")
    if (optimized) {
      console.log(`  → Using optimized scraping (check first, then scrape if updates exist)`);
      // First check if there are updates
      const checkResult = await checkArtistForUpdates(artistId, req.user.id);
      console.log(`  → Check result: hasUpdates=${checkResult.hasUpdates}`);
      
      if (!checkResult.hasUpdates) {
        console.log(`  → No updates, skipping scrape`);
        return res.json({
          artist: artist.username,
          status: 'skipped',
          reason: 'no_updates',
          total_found: 0,
          new_artworks: 0
        });
      }
      
      // Has updates, use optimized scraping
      console.log(`  → Has updates, starting optimized scrape...`);
      const result = await scrapeArtistUpdates(artistId, req.user.id);
      console.log(`  → Optimized scrape complete: ${result.new_artworks} new artworks`);
      res.json(result);
    } else {
      // Full scrape (for initial imports)
      console.log(`  → Using full scrape (for initial imports)`);
      const result = await scrapeArtist(artistId, req.user.id);
      console.log(`  → Full scrape complete: ${result.total_found} total, ${result.new_artworks} new`);
      res.json(result);
    }
  } catch (error: any) {
    console.error('Error scraping artist:', error);
    res.status(500).json({ error: error.message || 'Failed to scrape artist' });
  }
});

// Check if artist has updates (quick check only)
router.get('/artist/:id/check', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const artistId = parseInt(req.params.id);
    
    // Verify artist belongs to user
    const artist = await db.getArtistById(artistId, req.user.id);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    
    const result = await checkArtistForUpdates(artistId, req.user.id);
    res.json(result);
  } catch (error: any) {
    console.error('Error checking artist:', error);
    res.status(500).json({ error: error.message || 'Failed to check artist' });
  }
});

// Scrape all artists (optimized - checks first, only scrapes if updates exist)
router.post('/all', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const results = await scrapeAllArtists(req.user.id);
    res.json(results);
  } catch (error: any) {
    console.error('Error scraping all artists:', error);
    res.status(500).json({ error: error.message || 'Failed to scrape artists' });
  }
});

export default router;

