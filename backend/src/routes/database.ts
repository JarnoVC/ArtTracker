import express from 'express';
import * as db from '../database';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Clear all data from database (only for current user)
router.post('/clear', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get counts before deletion
    const artists = await db.getAllArtists(req.user.id);
    const artworks = await db.getAllArtworks(req.user.id);
    const deletedArtists = artists.length;
    const deletedArtworks = artworks.length;
    
    // Delete all artworks and artists for this user (deleteAllArtists also deletes artworks)
    await db.deleteAllArtists(req.user.id);
    
    console.log(`🗑️ Database cleared for user ${req.user.username}: ${deletedArtists} artists, ${deletedArtworks} artworks`);
    
    res.json({ 
      success: true,
      deleted_artists: deletedArtists,
      deleted_artworks: deletedArtworks
    });
  } catch (error: any) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: error.message || 'Failed to clear database' });
  }
});

export default router;

