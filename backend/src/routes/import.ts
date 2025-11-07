import express from 'express';
import { importFollowingFromUser } from '../scraper-import-following';
import { requireAuth } from '../middleware/auth';
import * as db from '../database';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Import followed artists from an ArtStation user (replaces existing artists)
router.post('/following', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { username, clearExisting, skipArtworkScraping } = req.body;
    
    // Use ArtStation username from user profile if not provided, otherwise use provided username
    let artstationUsername = username?.trim() || req.user.artstation_username;
    
    if (!artstationUsername) {
      return res.status(400).json({ error: 'ArtStation username is required. Please provide it in the import form or set it during registration.' });
    }

    // Extract username from URL if full URL provided
    let cleanUsername = artstationUsername;
    if (artstationUsername.includes('artstation.com')) {
      const match = artstationUsername.match(/artstation\.com\/users\/([^\/\?]+)/);
      if (match) {
        cleanUsername = match[1];
      } else {
        const match2 = artstationUsername.match(/artstation\.com\/([^\/\?]+)/);
        if (match2) {
          cleanUsername = match2[1];
        }
      }
    }

    // Update user's ArtStation username if provided
    if (username && username !== req.user.artstation_username) {
      await db.updateUser(req.user.id, { artstation_username: cleanUsername });
    }

    const results = await importFollowingFromUser(req.user.id, cleanUsername, clearExisting === true, skipArtworkScraping === true);
    res.json(results);
  } catch (error: any) {
    console.error('Error importing following:', error);
    res.status(500).json({ error: error.message || 'Failed to import following list' });
  }
});

export default router;

