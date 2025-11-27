import express from 'express';
import * as db from '../database';

const router = express.Router();

router.get('/featured-artworks', async (req, res) => {
  try {
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(limitParam) ? limitParam : 10;
    const artworks = await db.getPublicFeaturedArtworks(limit);
    res.json(artworks);
  } catch (error) {
    console.error('Error fetching public featured artworks:', error);
    res.status(500).json({ error: 'Failed to fetch featured artworks' });
  }
});

export default router;

