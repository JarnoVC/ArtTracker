import express from 'express';
import * as db from '../database';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get all followed artists
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const artists = await db.getAllArtists(req.user.id);
    res.json(artists);
  } catch (error) {
    console.error('Error fetching artists:', error);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// Get single artist
router.get('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const artist = await db.getArtistById(parseInt(req.params.id), req.user.id);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    res.json(artist);
  } catch (error) {
    console.error('Error fetching artist:', error);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// Add new artist
router.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Extract username from URL if full URL provided
    let cleanUsername = username;
    if (username.includes('artstation.com')) {
      const match = username.match(/artstation\.com\/([^\/\?]+)/);
      if (match) {
        cleanUsername = match[1];
      }
    }

    const profile_url = `https://www.artstation.com/${cleanUsername}`;

    const newArtist = await db.addArtist(req.user.id, cleanUsername, profile_url);
    
    res.status(201).json(newArtist);
  } catch (error: any) {
    if (error.message === 'ARTIST_EXISTS') {
      return res.status(409).json({ error: 'Artist already exists' });
    }
    console.error('Error adding artist:', error);
    res.status(500).json({ error: 'Failed to add artist' });
  }
});

// Delete artist
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const deleted = await db.deleteArtist(parseInt(req.params.id), req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    
    res.json({ message: 'Artist deleted successfully' });
  } catch (error) {
    console.error('Error deleting artist:', error);
    res.status(500).json({ error: 'Failed to delete artist' });
  }
});

export default router;
