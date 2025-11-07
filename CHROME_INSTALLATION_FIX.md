# Chrome Installation Fix - Step by Step Guide

## What I Fixed

I've updated the code to allow Puppeteer to automatically download Chrome at runtime if it's not found. This is more reliable than trying to install Chrome during the build process.

## Changes Made

1. **Updated `scraper-puppeteer.ts`** - Improved Chrome detection and auto-download logic
2. **Updated `scraper-import-following.ts`** - Same improvements for consistency
3. **Removed build-time Chrome installation** - Chrome will download on first use instead
4. **Removed `install-puppeteer.js` script** - No longer needed

## What You Need to Do in Render Dashboard

### Step 1: Update Build Command (IMPORTANT)

1. Go to **Render Dashboard** → Your Backend Service
2. Click on **Settings** tab
3. Find **"Build Command"**
4. Change it to (remove Chrome installation):
   ```
   npm ci && npm run build
   ```
5. Click **Save Changes**

### Step 2: Verify Environment Variables

Make sure these environment variables are set in Render:

1. Still in **Settings** → **Environment**
2. Verify these variables exist:

   **Required:**
   - `PUPPETEER_CACHE_DIR` = `/opt/render/.cache/puppeteer`
   - `NODE_ENV` = `production`
   - `PORT` = `3001`
   - `DATABASE_URL` = (your Supabase connection pooler URL)
   - `CORS_ORIGIN` = (your Vercel frontend URL)

   **Optional:**
   - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` = `false` (or remove it)
   - `SCRAPE_DELAY_MS` = `2000`

3. Click **Save Changes** if you made any changes

### Step 3: Deploy and Test

1. **Push your code changes to GitHub** (if you haven't already)
   - The code changes are already in your files
   - Commit and push them:
     ```bash
     git add .
     git commit -m "Fix Chrome installation - use auto-download"
     git push
     ```

2. **Render will automatically deploy** when it detects the push

3. **Wait for deployment to complete** (usually 2-5 minutes)

4. **Test the import functionality:**
   - Go to your deployed app
   - Try importing your ArtStation following list
   - **First request will take 2-5 minutes** (Chrome downloading)
   - Subsequent requests will be fast

### Step 4: Monitor the Logs

1. Go to **Render Dashboard** → Your Service → **Logs**
2. Look for these messages:

   **Success messages:**
   - `✅ Found system Chrome at: ...` (if system Chrome exists)
   - `✅ Found Chrome in cache: ...` (if cached Chrome found)
   - `📥 Chrome not found in any location` (normal - will download)
   - `⏳ Puppeteer will download Chrome automatically...`
   - `✅ Browser launched successfully`

   **If you see errors:**
   - `❌ Failed to launch browser` - Check error message for details
   - Disk space issues - Render free tier has limited space
   - Network issues - First download might timeout

## How It Works Now

1. **On first request:**
   - Code searches for Chrome in system paths and cache
   - If not found, Puppeteer automatically downloads Chrome (~200MB)
   - Download takes 2-5 minutes
   - Chrome is cached for future use

2. **On subsequent requests:**
   - Code finds Chrome in cache
   - Browser launches immediately (no download)

## Troubleshooting

### If Chrome download fails:

1. **Check disk space:**
   - Render free tier has 512MB total
   - Chrome needs ~200MB
   - Check Render logs for disk space warnings

2. **Check network:**
   - First download might timeout
   - Wait a few minutes and try again
   - Check Render logs for network errors

3. **Check cache directory:**
   - Verify `PUPPETEER_CACHE_DIR` is set correctly
   - Should be `/opt/render/.cache/puppeteer`
   - Check Render logs for permission errors

### If it still doesn't work:

1. **Check Render logs** for the exact error message
2. **Verify environment variables** are set correctly
3. **Try waiting 10 minutes** and trying again (download might still be in progress)
4. **Check Render service status** - make sure it's not paused

## Expected Behavior

- ✅ First import request: Takes 2-5 minutes (Chrome downloading)
- ✅ Subsequent requests: Fast (uses cached Chrome)
- ✅ No build-time errors about Chrome
- ✅ Clear log messages about what's happening

## Summary

**You need to:**
1. Update build command in Render to remove Chrome installation
2. Verify environment variables are set
3. Push code changes and wait for deployment
4. Test import functionality (first request will be slow)

The code will now automatically handle Chrome installation at runtime, which is more reliable than build-time installation on Render's free tier.

