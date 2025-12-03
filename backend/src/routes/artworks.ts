import express from 'express';
import * as db from '../database';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get all artworks (optionally filtered by artist)
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { artist_id, new_only, favorites_only, latest_per_artist } = req.query;
    
    const filters: { artist_id?: number; new_only?: boolean; favorites_only?: boolean } = {};
    
    if (artist_id) {
      filters.artist_id = parseInt(artist_id as string);
    }
    
    if (new_only === 'true') {
      filters.new_only = true;
    }
    
    if (favorites_only === 'true') {
      filters.favorites_only = true;
    }
    
    let artworks = await db.getArtworksWithArtistInfo(req.user.id, filters);
    
    // If latest_per_artist is true, return only the most recent artwork per artist
    if (latest_per_artist === 'true' && !artist_id) {
      const latestByArtist = new Map<number, any>();
      
      artworks.forEach(artwork => {
        const existing = latestByArtist.get(artwork.artist_id);
        const artworkDate = new Date(artwork.upload_date || artwork.discovered_at);
        const existingDate = existing ? new Date(existing.upload_date || existing.discovered_at) : null;
        
        if (!existing || (existingDate && artworkDate > existingDate)) {
          latestByArtist.set(artwork.artist_id, artwork);
        }
      });
      
      // Sort by upload_date (newest first)
      artworks = Array.from(latestByArtist.values())
        .sort((a, b) => {
          const dateA = new Date(a.upload_date || a.discovered_at).getTime();
          const dateB = new Date(b.upload_date || b.discovered_at).getTime();
          return dateB - dateA; // Newest first
        });
    }
    
    res.json(artworks);
  } catch (error) {
    console.error('Error fetching artworks:', error);
    res.status(500).json({ error: 'Failed to fetch artworks' });
  }
});

// Mark artwork as seen
router.patch('/:id/mark-seen', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const success = await db.markArtworkSeen(parseInt(req.params.id), req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    res.json({ message: 'Artwork marked as seen' });
  } catch (error) {
    console.error('Error marking artwork as seen:', error);
    res.status(500).json({ error: 'Failed to mark artwork as seen' });
  }
});

// Mark all artworks as seen
router.post('/mark-all-seen', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { artist_id } = req.body;
    
    const count = await db.markAllArtworksSeen(req.user.id, artist_id ? parseInt(artist_id) : undefined);
    
    res.json({ message: `Marked ${count} artworks as seen` });
  } catch (error) {
    console.error('Error marking artworks as seen:', error);
    res.status(500).json({ error: 'Failed to mark artworks as seen' });
  }
});

// Get new artworks count
router.get('/new-count', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const count = await db.getNewArtworksCount(req.user.id);
    res.json({ count });
  } catch (error) {
    console.error('Error getting new count:', error);
    res.status(500).json({ error: 'Failed to get new artworks count' });
  }
});

// Toggle favorite status
router.patch('/:id/toggle-favorite', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const success = await db.toggleFavorite(parseInt(req.params.id), req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    res.json({ message: 'Favorite status toggled' });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

export default router;
