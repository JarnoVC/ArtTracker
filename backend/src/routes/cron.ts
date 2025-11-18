import express from 'express';
import { runSyncAllUsers, runCheckAllUsersArtworks } from '../scheduler';

const router = express.Router();

// API key for cron jobs (set via CRON_API_KEY environment variable)
const CRON_API_KEY = process.env.CRON_API_KEY;

/**
 * Middleware to authenticate cron requests
 * Either uses API key or can be called from Render Cron Jobs (which will have proper auth)
 */
const authenticateCron = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // If CRON_API_KEY is set, require it in headers or query
  if (CRON_API_KEY) {
    const providedKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (providedKey !== CRON_API_KEY) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing API key. Provide it as header: X-API-Key or query param: ?api_key=...'
      });
    }
  }
  
  // If no API key is set, allow the request (for Render Cron Jobs which handle auth)
  next();
};

// Apply authentication middleware
router.use(authenticateCron);

/**
 * POST /api/cron/sync
 * Manually trigger sync for all users (useful for external cron services)
 * 
 * Query params or header:
 * - api_key: API key (if CRON_API_KEY is set)
 * 
 * Example:
 *   curl -X POST https://your-api.com/api/cron/sync?api_key=your-key
 *   curl -X POST https://your-api.com/api/cron/sync -H "X-API-Key: your-key"
 */
router.post('/sync', async (req, res) => {
  try {
    console.log('📥 [Cron API] Manual sync trigger received');
    const results = await runSyncAllUsers();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    console.error('Error in cron sync:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to sync users' 
    });
  }
});

/**
 * POST /api/cron/check-artworks
 * Manually trigger artwork check for all users (useful for external cron services)
 * 
 * Query params or header:
 * - api_key: API key (if CRON_API_KEY is set)
 * 
 * Example:
 *   curl -X POST https://your-api.com/api/cron/check-artworks?api_key=your-key
 *   curl -X POST https://your-api.com/api/cron/check-artworks -H "X-API-Key: your-key"
 */
router.post('/check-artworks', async (req, res) => {
  try {
    console.log('📥 [Cron API] Manual artwork check trigger received');
    const results = await runCheckAllUsersArtworks();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    console.error('Error in cron artwork check:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to check artworks' 
    });
  }
});

/**
 * GET /api/cron/health
 * Health check for cron endpoints
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cron_enabled: process.env.ENABLE_SCHEDULER === 'true',
    api_key_required: !!CRON_API_KEY,
    timestamp: new Date().toISOString()
  });
});

export default router;

