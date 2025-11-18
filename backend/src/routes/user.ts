import express from 'express';
import * as db from '../database';
import { requireAuth } from '../middleware/auth';
import { sendDiscordNotification } from '../notifications/discord';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * PATCH /api/user
 * Update current user's profile settings (Discord webhook, etc.)
 */
router.patch('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { discord_webhook_url, discord_user_id } = req.body;

    const updates: Partial<db.User> = {};

    // Validate Discord webhook URL if provided
    if (discord_webhook_url !== undefined) {
      if (discord_webhook_url === null || discord_webhook_url === '') {
        // Allow clearing the webhook
        updates.discord_webhook_url = undefined;
      } else if (typeof discord_webhook_url === 'string') {
        // Basic validation - should be a Discord webhook URL
        if (!discord_webhook_url.startsWith('https://discord.com/api/webhooks/') &&
            !discord_webhook_url.startsWith('https://discordapp.com/api/webhooks/')) {
          return res.status(400).json({ 
            error: 'Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/' 
          });
        }
        updates.discord_webhook_url = discord_webhook_url;
      }
    }

    // Discord user ID (optional, for @mentions)
    if (discord_user_id !== undefined) {
      if (discord_user_id === null || discord_user_id === '') {
        updates.discord_user_id = undefined;
      } else if (typeof discord_user_id === 'string') {
        // Discord user IDs are numeric strings, typically 17-19 digits
        if (!/^\d{17,19}$/.test(discord_user_id)) {
          return res.status(400).json({ 
            error: 'Invalid Discord user ID. Must be a numeric string (17-19 digits).' 
          });
        }
        updates.discord_user_id = discord_user_id;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const success = await db.updateUser(req.user.id, updates);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return updated user data
    const updatedUser = await db.getUserById(req.user.id);
    res.json({
      success: true,
      user: {
        id: updatedUser?.id,
        username: updatedUser?.username,
        artstation_username: updatedUser?.artstation_username,
        discord_webhook_url: updatedUser?.discord_webhook_url || null,
        discord_user_id: updatedUser?.discord_user_id || null
      }
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

/**
 * GET /api/user
 * Get current user's profile
 */
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data (without sensitive token)
    res.json({
      id: user.id,
      username: user.username,
      artstation_username: user.artstation_username,
      discord_webhook_url: user.discord_webhook_url || null,
      discord_user_id: user.discord_user_id || null,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /api/user/test-discord
 * Send a test Discord notification using the latest artwork from "Latest from All Artists"
 */
router.post('/test-discord', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.discord_webhook_url) {
      return res.status(400).json({ 
        error: 'Discord webhook URL not configured. Please set it in Settings first.' 
      });
    }

    // Get latest artwork from "Latest from All Artists" (latest per artist, sorted by date)
    let artworks = await db.getArtworksWithArtistInfo(req.user.id, {});
    
    // Get latest per artist (same logic as the artworks route)
    const latestByArtist = new Map<number, any>();
    artworks.forEach((artwork: any) => {
      const existing = latestByArtist.get(artwork.artist_id);
      const artworkDate = new Date(artwork.upload_date || artwork.discovered_at);
      const existingDate = existing ? new Date(existing.upload_date || existing.discovered_at) : null;
      
      if (!existing || (existingDate && artworkDate > existingDate)) {
        latestByArtist.set(artwork.artist_id, artwork);
      }
    });
    
    // Sort by upload_date (newest first) and get the first one
    const latestArtworks = Array.from(latestByArtist.values())
      .sort((a, b) => {
        const dateA = new Date(a.upload_date || a.discovered_at).getTime();
        const dateB = new Date(b.upload_date || b.discovered_at).getTime();
        return dateB - dateA; // Newest first
      });

    if (latestArtworks.length === 0) {
      return res.status(400).json({ 
        error: 'No artworks found. Add some artists and artworks first.' 
      });
    }

    // Get the latest artwork (first in the sorted list)
    const latestArtwork = latestArtworks[0];

    // Send test notification with the latest artwork
    const success = await sendDiscordNotification(
      req.user.id,
      latestArtwork.username || 'unknown-artist',
      latestArtwork.display_name || latestArtwork.username,
      [{
        title: latestArtwork.title,
        artistName: latestArtwork.username || 'unknown-artist',
        artistDisplayName: latestArtwork.display_name || latestArtwork.username,
        artworkUrl: latestArtwork.artwork_url,
        thumbnailUrl: latestArtwork.thumbnail_url,
        uploadDate: latestArtwork.upload_date || latestArtwork.discovered_at
      }]
    );

    if (success) {
      res.json({ 
        success: true, 
        message: 'Test notification sent successfully! Check your Discord channel.',
        artwork: {
          title: latestArtwork.title,
          artist: latestArtwork.display_name || latestArtwork.username
        }
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send test notification. Check server logs for details.' 
      });
    }
  } catch (error: any) {
    console.error('Error sending test Discord notification:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to send test notification' 
    });
  }
});

export default router;

