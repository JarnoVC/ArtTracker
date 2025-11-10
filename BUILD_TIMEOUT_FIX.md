# Build Timeout Fix - Chrome Installation

## Problem

Render free tier has a **15-minute build timeout**. Chrome installation during build was taking longer than this, causing builds to fail.

## Solution

**Chrome installation is now skipped during build** and will happen at runtime on first use instead. This prevents build timeouts.

### Changes Made

1. **`install-puppeteer.js`** - Now only checks for existing Chrome, doesn't install during build
2. **`scraper-puppeteer.ts`** - Installs Chrome at runtime if not found
3. **`scraper-import-following.ts`** - Same runtime installation logic
4. **`render.yaml`** - Simplified build command (removed Chrome installation)

## How It Works Now

### During Build
- ✅ Build completes quickly (2-3 minutes)
- ✅ No Chrome installation (skipped to avoid timeout)
- ✅ Cache directory is created
- ✅ System Chrome is checked (if available)

### At Runtime (First Request)
- ⏳ Chrome installation happens when you trigger an import/scrape
- ⏱️ First request takes 3-5 minutes (Chrome downloading)
- ✅ Subsequent requests are fast (Chrome is cached)
- 📂 Chrome is installed to `/opt/render/.cache/puppeteer` (persistent)

## What You Need to Do

### 1. Update Render Build Command

In **Render Dashboard** → Your Service → **Settings**:

**Build Command:**
```
npm ci && npm run build
```

(Remove any Chrome installation commands)

### 2. Verify Environment Variables

Make sure these are set in Render:
- `PUPPETEER_CACHE_DIR` = `/opt/render/.cache/puppeteer`
- `NODE_ENV` = `production`
- Other required variables (DATABASE_URL, CORS_ORIGIN, etc.)

### 3. Commit and Push

```bash
git add .
git commit -m "Fix build timeout - skip Chrome installation during build"
git push
```

### 4. Wait for Deployment

- Build should complete in 2-3 minutes now
- No more timeout errors! ✅

### 5. Test Import (First Time)

- **First import request will take 3-5 minutes** (Chrome installing)
- **Be patient** - this is a one-time setup
- **Watch Render logs** to see Chrome installation progress
- **Subsequent requests will be fast** (Chrome is cached)

## Expected Behavior

### Build Logs
```
🔧 Checking Chrome availability...
📁 Created cache directory: /opt/render/.cache/puppeteer
⚠️  Chrome not found during build
💡 Chrome will be installed at runtime on first use
📝 This is expected on Render free tier to avoid build timeouts
✅ Build can continue - Chrome installation skipped
```

### Runtime Logs (First Request)
```
🚀 Launching browser...
📂 Cache directory: /opt/render/.cache/puppeteer
📥 Chrome not found in any location
⏳ Attempting to install Chrome at runtime...
⏱️  This may take 3-5 minutes on first request
🔄 Installing Chrome via Puppeteer...
✅ Chrome installation completed
✅ Found Chrome after installation: /opt/render/.cache/puppeteer/chrome/.../chrome
✅ Browser launched successfully
```

### Runtime Logs (Subsequent Requests)
```
🚀 Launching browser...
📂 Cache directory: /opt/render/.cache/puppeteer
✅ Found Chrome via Puppeteer: /opt/render/.cache/puppeteer/chrome/.../chrome
🎯 Using Chrome at: /opt/render/.cache/puppeteer/chrome/.../chrome
✅ Browser launched successfully
```

## Important Notes

### First Request is Slow
- ⚠️ **First import/scrape request will take 3-5 minutes**
- ⏱️ This is because Chrome is being downloaded
- ✅ **This only happens once** - Chrome is cached after installation
- 📝 **Subsequent requests are fast** (< 1 second to launch browser)

### Request Timeout
- Your frontend/API might timeout if it waits for the response
- Consider increasing timeout on your API client
- Or implement a background job system (future improvement)

### Disk Space
- Chrome needs ~200MB of disk space
- Render free tier has 512MB total
- Make sure you have enough space available
- Check Render logs for disk space warnings

## Troubleshooting

### If First Request Times Out

**Problem:** Request takes longer than your API timeout

**Solutions:**
1. Increase API timeout in your frontend/client
2. Wait for Chrome installation to complete, then retry
3. Check Render logs to see if Chrome installation succeeded
4. Subsequent requests should work fine

### If Chrome Installation Fails at Runtime

**Problem:** Chrome installation fails due to disk space or network issues

**Solutions:**
1. Check Render logs for error messages
2. Verify disk space is available
3. Wait a few minutes and try again
4. Check that `PUPPETEER_CACHE_DIR` is set correctly

### If Build Still Times Out

**Problem:** Build is still taking too long

**Solutions:**
1. Verify build command is: `npm ci && npm run build`
2. Check that `postinstall` script doesn't install Chrome
3. Look at build logs to see what's taking time
4. Consider upgrading to Render paid tier (no build timeout)

## Summary

✅ **Build completes quickly** (2-3 minutes, no timeout)
✅ **Chrome installs at runtime** (on first request)
⏱️ **First request is slow** (3-5 minutes, one-time)
✅ **Subsequent requests are fast** (Chrome cached)
✅ **No more build timeout errors**

## Next Steps

1. Update Render build command
2. Verify environment variables
3. Commit and push code
4. Wait for deployment (2-3 minutes)
5. Test import (first request will be slow)
6. Enjoy fast subsequent requests! 🎉

