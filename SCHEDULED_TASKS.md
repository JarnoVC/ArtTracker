# 📅 Scheduled Tasks / Daily Checkups

ArtTracker can automatically sync your following list and check for new artworks on a schedule, so you don't have to do it manually!

## 🚀 Quick Setup

### Option 1: Built-in Scheduler (Recommended for Free Tier)

The backend includes a built-in scheduler using `node-cron` that runs automatically when enabled.

**Enable it:**
1. Set environment variable: `ENABLE_SCHEDULER=true`
2. Configure schedules (optional):
   - `CRON_SYNC_SCHEDULE`: When to sync following lists (default: `0 9 * * *` = daily at 9 AM UTC)
   - `CRON_ARTWORK_CHECK_SCHEDULE`: When to check for new artworks (default: `0 */6 * * *` = every 6 hours)

**On Render:**
- The `render.yaml` already includes these settings
- Just set `ENABLE_SCHEDULER=true` in your Render dashboard
- That's it! It will start running automatically

### Option 2: Render Cron Jobs (Recommended for Paid Tier)

If you're on Render's paid plan, you can use Render's native Cron Jobs for better reliability:

1. In Render dashboard, go to "Cron Jobs"
2. Create two cron jobs:

   **Daily Sync:**
   - Name: `daily-sync`
   - Schedule: `0 9 * * *` (daily at 9 AM UTC)
   - Command: `curl -X POST https://your-app.onrender.com/api/cron/sync`
   
   **Artwork Check:**
   - Name: `artwork-check`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Command: `curl -X POST https://your-app.onrender.com/api/cron/check-artworks`

3. If you set `CRON_API_KEY`, include it:
   - `curl -X POST "https://your-app.onrender.com/api/cron/sync?api_key=your-key"`
   - Or use header: `curl -X POST -H "X-API-Key: your-key" https://your-app.onrender.com/api/cron/sync`

### Option 3: External Cron Service

You can use any external cron service (EasyCron, cron-job.org, etc.) to call the cron endpoints:

**Endpoints:**
- Sync: `POST /api/cron/sync`
- Artwork Check: `POST /api/cron/check-artworks`
- Health Check: `GET /api/cron/health`

**Authentication:**
If `CRON_API_KEY` is set, include it as:
- Query param: `?api_key=your-key`
- Or header: `X-API-Key: your-key`

**Example:**
```bash
curl -X POST "https://your-app.onrender.com/api/cron/sync?api_key=your-secret-key"
```

## 📋 What Gets Scheduled?

### Daily Sync (Default: 9 AM UTC)
- Syncs each user's ArtStation following list
- Adds new artists they're following
- Removes artists they've unfollowed
- Does NOT load artworks (that's done separately)

### Artwork Check (Default: Every 6 Hours)
- Checks all artists for new artworks
- Uses optimized scraping (only scrapes if updates exist)
- Loads new artworks into the database

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_SCHEDULER` | `false` | Enable/disable the built-in scheduler |
| `CRON_SYNC_SCHEDULE` | `0 9 * * *` | Cron schedule for daily sync |
| `CRON_ARTWORK_CHECK_SCHEDULE` | `0 */6 * * *` | Cron schedule for artwork checks |
| `CRON_API_KEY` | (none) | API key for external cron services (optional) |

### Cron Schedule Format

Cron schedules use standard cron syntax:
```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, 0 and 7 = Sunday)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
```

**Common Examples:**
- `0 9 * * *` - Daily at 9:00 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 0,12 * * *` - Twice daily (midnight and noon)
- `0 9 * * 1-5` - Weekdays at 9 AM
- `30 2 * * *` - Daily at 2:30 AM

## 🔍 Monitoring

The scheduler logs all activity to the console:

```
📅 [Scheduler] Initializing scheduled tasks...
   Sync schedule: 0 9 * * * (daily sync)
   Artwork check schedule: 0 */6 * * * (artwork updates)
✅ [Scheduler] Scheduled tasks initialized

⏰ [Scheduler] Running scheduled sync at 2025-01-15T09:00:00.000Z
🔄 [Scheduler] Starting daily sync for all users...
  → Syncing following list for user johndoe (john_doe_art)...
    ✓ Sync complete: +2 added, -1 removed
✅ [Scheduler] Daily sync complete. Processed 3 users.
```

Check your Render logs to see scheduled task execution and results.

## 🛡️ Security

- The built-in scheduler runs internally and doesn't expose any endpoints
- The `/api/cron/*` endpoints are optional and only needed for external cron services
- If you set `CRON_API_KEY`, external requests must include it
- Without `CRON_API_KEY`, the cron endpoints are open (fine if only called from Render Cron Jobs)

## ⚠️ Important Notes

1. **User Requirements**: Users must have an `artstation_username` set in their profile for sync to work
2. **Rate Limiting**: The scheduler respects `SCRAPE_DELAY_MS` delays between requests
3. **Multiple Users**: All users are processed sequentially to avoid overwhelming ArtStation
4. **Errors**: If one user's sync fails, others will still be processed
5. **Free Tier Limitations**: Render free tier services may sleep after inactivity. Consider:
   - Using a paid plan for better reliability
   - Setting shorter intervals to keep the service awake
   - Using external cron services to ping your service

## 🧪 Testing

To test the scheduler manually:

```bash
# Test sync
curl -X POST http://localhost:3001/api/cron/sync

# Test artwork check
curl -X POST http://localhost:3001/api/cron/check-artworks

# Health check
curl http://localhost:3001/api/cron/health
```

If `CRON_API_KEY` is set, include it:
```bash
curl -X POST "http://localhost:3001/api/cron/sync?api_key=test-key"
```

