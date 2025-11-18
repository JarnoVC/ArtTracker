import cron from 'node-cron';
import * as db from './database';
import { importFollowingFromUser } from './scraper-import-following';
import { scrapeAllArtists } from './scraper-puppeteer';

// Schedule configuration
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === 'true';
const CRON_SYNC_SCHEDULE = process.env.CRON_SYNC_SCHEDULE || '0 9 * * *'; // Daily at 9 AM UTC
const CRON_ARTWORK_CHECK_SCHEDULE = process.env.CRON_ARTWORK_CHECK_SCHEDULE || '0 */6 * * *'; // Every 6 hours

interface ScheduledTaskResult {
  userId: number;
  username: string;
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Sync all users' ArtStation following lists
 * Runs daily to check for new artists they're following
 */
async function syncAllUsersFollowing(): Promise<ScheduledTaskResult[]> {
  console.log('🔄 [Scheduler] Starting daily sync for all users...');
  const users = await db.getAllUsers();
  const results: ScheduledTaskResult[] = [];

  for (const user of users) {
    if (!user.artstation_username) {
      console.log(`  ⏭ Skipping user ${user.username} - no ArtStation username set`);
      continue;
    }

    try {
      console.log(`  → Syncing following list for user ${user.username} (${user.artstation_username})...`);
      
      // Sync following list (clearExisting = false, skipArtworkScraping = true)
      // We'll check for new artworks separately
      const importResults = await importFollowingFromUser(
        user.id,
        user.artstation_username,
        false, // Don't clear existing, just sync
        true   // Skip artwork scraping (we'll do that in artwork check)
      );

      results.push({
        userId: user.id,
        username: user.username,
        success: true,
        details: {
          added: importResults.added || 0,
          removed: importResults.removed || 0,
          already_exists: importResults.already_exists || 0
        }
      });

      console.log(`    ✓ Sync complete: +${importResults.added || 0} added, -${importResults.removed || 0} removed`);
    } catch (error: any) {
      console.error(`    ✗ Error syncing user ${user.username}:`, error.message);
      results.push({
        userId: user.id,
        username: user.username,
        success: false,
        error: error.message
      });
    }
  }

  console.log(`✅ [Scheduler] Daily sync complete. Processed ${results.length} users.`);
  return results;
}

/**
 * Check all users' artists for new artworks
 * Runs every 6 hours (configurable)
 */
async function checkAllUsersArtworks(): Promise<ScheduledTaskResult[]> {
  console.log('🔍 [Scheduler] Starting artwork check for all users...');
  const users = await db.getAllUsers();
  const results: ScheduledTaskResult[] = [];

  for (const user of users) {
    try {
      const artists = await db.getAllArtists(user.id);
      
      if (artists.length === 0) {
        console.log(`  ⏭ Skipping user ${user.username} - no artists to check`);
        continue;
      }

      console.log(`  → Checking ${artists.length} artists for user ${user.username}...`);
      
      // Use optimized scraping (checks first, only scrapes if updates exist)
      const scrapeResults = await scrapeAllArtists(user.id);

      // Handle both return types: with results array or message (no artists)
      const resultsArray = Array.isArray(scrapeResults.results) ? scrapeResults.results : [];
      const totalNew = scrapeResults.total_new_artworks || 0;
      const updated = scrapeResults.completed || 0;

      results.push({
        userId: user.id,
        username: user.username,
        success: true,
        details: {
          artists_checked: artists.length,
          artists_updated: updated,
          new_artworks: totalNew
        }
      });

      console.log(`    ✓ Check complete: ${updated} artists updated, ${totalNew} new artworks found`);
    } catch (error: any) {
      console.error(`    ✗ Error checking artworks for user ${user.username}:`, error.message);
      results.push({
        userId: user.id,
        username: user.username,
        success: false,
        error: error.message
      });
    }
  }

  console.log(`✅ [Scheduler] Artwork check complete. Processed ${results.length} users.`);
  return results;
}

/**
 * Initialize the scheduler
 */
export function initScheduler(): void {
  if (!ENABLE_SCHEDULER) {
    console.log('⏸️  [Scheduler] Disabled (ENABLE_SCHEDULER=false)');
    return;
  }

  console.log('📅 [Scheduler] Initializing scheduled tasks...');
  console.log(`   Sync schedule: ${CRON_SYNC_SCHEDULE} (daily sync)`);
  console.log(`   Artwork check schedule: ${CRON_ARTWORK_CHECK_SCHEDULE} (artwork updates)`);

  // Schedule daily sync (check for new artists)
  cron.schedule(CRON_SYNC_SCHEDULE, async () => {
    console.log(`\n⏰ [Scheduler] Running scheduled sync at ${new Date().toISOString()}`);
    try {
      await syncAllUsersFollowing();
    } catch (error: any) {
      console.error('❌ [Scheduler] Error in scheduled sync:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Schedule artwork checking (every 6 hours by default)
  cron.schedule(CRON_ARTWORK_CHECK_SCHEDULE, async () => {
    console.log(`\n⏰ [Scheduler] Running scheduled artwork check at ${new Date().toISOString()}`);
    try {
      await checkAllUsersArtworks();
    } catch (error: any) {
      console.error('❌ [Scheduler] Error in scheduled artwork check:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('✅ [Scheduler] Scheduled tasks initialized');
}

/**
 * Manual trigger functions (for testing or external cron services)
 */
export async function runSyncAllUsers(): Promise<ScheduledTaskResult[]> {
  return await syncAllUsersFollowing();
}

export async function runCheckAllUsersArtworks(): Promise<ScheduledTaskResult[]> {
  return await checkAllUsersArtworks();
}

