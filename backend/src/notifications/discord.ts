import axios from 'axios';
import * as db from '../database';

export interface ArtworkNotification {
  title: string;
  artistName: string;
  artistDisplayName?: string;
  artworkUrl: string;
  thumbnailUrl?: string;
  uploadDate?: string;
}

/**
 * Send Discord notification for new artworks
 * Only sends notifications if user has discord_webhook_url configured
 */
export async function sendDiscordNotification(
  userId: number,
  artistName: string,
  artistDisplayName: string | undefined,
  artworks: ArtworkNotification[]
): Promise<boolean> {
  if (artworks.length === 0) {
    return false;
  }

  // Get user's Discord settings
  const user = await db.getUserById(userId);
  if (!user || !user.discord_webhook_url) {
    // No Discord webhook configured, skip silently
    return false;
  }

  try {
    const displayName = artistDisplayName || artistName;
    
    // If multiple artworks, send summary + individual notifications
    // If single artwork, send detailed notification
    if (artworks.length === 1) {
      const artwork = artworks[0];
      await sendSingleArtworkNotification(user, artistName, displayName, artwork);
    } else {
      // Send summary first, then individual notifications
      await sendSummaryNotification(user, artistName, displayName, artworks.length);
      
      // Send individual notifications (Discord rate limit is ~5/second, so add small delay)
      for (const artwork of artworks) {
        await sendSingleArtworkNotification(user, artistName, displayName, artwork);
        // Small delay between messages to avoid rate limiting
        if (artworks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
    }

    return true;
  } catch (error: any) {
    console.error(`❌ [Discord] Failed to send notification for user ${userId}:`, error.message);
    // Don't throw - notification failures shouldn't break scraping
    return false;
  }
}

/**
 * Send a single artwork notification to Discord
 */
async function sendSingleArtworkNotification(
  user: db.User,
  artistName: string,
  artistDisplayName: string,
  artwork: ArtworkNotification
): Promise<void> {
  const webhookUrl = user.discord_webhook_url!;
  
  // Build mention string if Discord user ID is set
  const mention = user.discord_user_id ? `<@${user.discord_user_id}>` : '';
  const mentionText = mention ? `${mention} ` : '';

  // Format date if available
  const dateText = artwork.uploadDate 
    ? ` • ${new Date(artwork.uploadDate).toLocaleDateString()}`
    : '';

  // Create Discord embed
  const embed = {
    title: artwork.title,
    description: `New artwork by **${artistDisplayName}** (@${artistName})${dateText}`,
    url: artwork.artworkUrl,
    color: 0x6366f1, // Primary color (purple/indigo)
    thumbnail: artwork.thumbnailUrl ? {
      url: artwork.thumbnailUrl
    } : undefined,
    author: {
      name: artistDisplayName,
      url: `https://www.artstation.com/${artistName}`
    },
    timestamp: new Date().toISOString(),
    footer: {
      text: 'ArtTracker'
    }
  };

  // Send webhook request
  await axios.post(webhookUrl, {
    content: `${mentionText}🎨 **New Artwork Found!**`,
    embeds: [embed],
    username: 'ArtTracker'
  }, {
    timeout: 5000,
    validateStatus: (status) => status < 500 // Accept 2xx, 3xx, 4xx
  });
}

/**
 * Send summary notification when multiple artworks are found
 */
async function sendSummaryNotification(
  user: db.User,
  artistName: string,
  artistDisplayName: string,
  count: number
): Promise<void> {
  const webhookUrl = user.discord_webhook_url!;
  const mention = user.discord_user_id ? `<@${user.discord_user_id}>` : '';
  const mentionText = mention ? `${mention} ` : '';

  await axios.post(webhookUrl, {
    content: `${mentionText}🎨 **${count} new artwork${count > 1 ? 's' : ''} found** from **${artistDisplayName}** (@${artistName})!`,
    username: 'ArtTracker'
  }, {
    timeout: 5000,
    validateStatus: (status) => status < 500
  });
}

