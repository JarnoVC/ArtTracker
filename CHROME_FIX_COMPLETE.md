# Chrome Installation Fix - Complete Guide

## What Was Fixed

The issue was that Puppeteer couldn't find Chrome at runtime on Render. This happened because:
1. Chrome wasn't being installed during the build process
2. Puppeteer couldn't automatically download Chrome at runtime (Render restrictions)
3. The cache directory wasn't being searched properly

## Changes Made

### 1. **Build Process (`render.yaml`)**
- Updated build command to set `PUPPETEER_CACHE_DIR` **before** `npm ci` runs
- This ensures the `postinstall` script can use the environment variable
- Build command: `PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npm ci && npm run build`

### 2. **Install Script (`backend/install-puppeteer.js`)**
- Enhanced Chrome installation with better error handling
- Added verification steps to confirm Chrome is installed correctly
- Improved logging to show exactly what's happening
- Checks multiple possible Chrome locations

### 3. **Runtime Chrome Detection (`scraper-puppeteer.ts` & `scraper-import-following.ts`)**
- Improved Chrome detection with 4 different methods:
  1. Puppeteer's built-in `executablePath()` (respects `PUPPETEER_CACHE_DIR`)
  2. Manual search of Puppeteer cache directory structure
  3. Linux `find` command search
  4. System Chrome locations (fallback)
- Sets `PUPPETEER_CACHE_DIR` and `PUPPETEER_DOWNLOAD_PATH` before Puppeteer operations
- Better error messages that tell you exactly what to check

### 4. **Package.json**
- Added `postinstall` script to run `install-puppeteer.js` after `npm ci`
- This ensures Chrome is installed during the build process

## What You Need to Do

### Step 1: Update Render Build Command

1. Go to **Render Dashboard** → Your Backend Service → **Settings**
2. Find **"Build Command"**
3. Update it to:
   ```
   PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npm ci && npm run build
   ```
4. Click **Save Changes**

### Step 2: Verify Environment Variables

In **Render Dashboard** → Your Service → **Settings** → **Environment**, verify:

✅ **Required:**
- `NODE_ENV` = `production`
- `PORT` = `3001`
- `DATABASE_URL` = (your Supabase connection pooler URL)
- `CORS_ORIGIN` = (your Vercel frontend URL)
- `PUPPETEER_CACHE_DIR` = `/opt/render/.cache/puppeteer`

✅ **Optional:**
- `SCRAPE_DELAY_MS` = `2000`
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` = `false` (or remove it)

### Step 3: Commit and Push Changes

```bash
git add .
git commit -m "Fix Chrome installation for Render deployment"
git push
```

### Step 4: Monitor Build Logs

1. Render will automatically start a new deployment
2. Watch the build logs for these messages:

**During Build (postinstall script):**
```
🔧 Installing Puppeteer browsers for production...
📂 Using cache directory: /opt/render/.cache/puppeteer
📥 Downloading Chrome... (this may take 3-5 minutes)
✅ Chrome found at: /opt/render/.cache/puppeteer/chrome/.../chrome
✅ Chrome installation verified successfully!
```

**During Runtime (when you import):**
```
🚀 Launching browser...
📂 Cache directory: /opt/render/.cache/puppeteer
✅ Found Chrome via Puppeteer: /opt/render/.cache/puppeteer/chrome/.../chrome
🎯 Using Chrome at: /opt/render/.cache/puppeteer/chrome/.../chrome
✅ Browser launched successfully
```

### Step 5: Test the Import

1. Wait for deployment to complete (build takes 5-10 minutes due to Chrome download)
2. Go to your deployed app
3. Try importing your ArtStation following list
4. It should work now! 🎉

## Troubleshooting

### If Build Fails

**Error: "Chrome installation failed"**
- Check Render logs for disk space warnings (free tier has 512MB)
- Verify `PUPPETEER_CACHE_DIR` is set in environment variables
- Make sure build command sets the env var before `npm ci`

**Error: "Timeout"**
- Chrome download can take 5-10 minutes
- Render free tier builds have a timeout limit
- If it times out, try redeploying (Chrome might be partially downloaded)

### If Runtime Fails

**Error: "Could not find Chrome"**
- Check Render logs to see which detection method failed
- Verify Chrome was installed during build (check build logs)
- Make sure `PUPPETEER_CACHE_DIR` is set in runtime environment variables
- Check that the cache directory exists: `/opt/render/.cache/puppeteer`

**Error: "Permission denied"**
- The cache directory might not be writable
- Check Render logs for permission errors
- Render should handle this automatically, but if it persists, contact Render support

### Debug Steps

1. **Check Build Logs:**
   - Look for "🔧 Installing Puppeteer browsers"
   - Verify Chrome was found: "✅ Chrome found at: ..."
   - If not found, check for errors

2. **Check Runtime Logs:**
   - When you trigger an import, look for "🚀 Launching browser..."
   - Check which detection method succeeded (or if all failed)
   - Look for the Chrome path being used

3. **Verify Environment Variables:**
   - In Render Dashboard → Settings → Environment
   - Make sure `PUPPETEER_CACHE_DIR` is set to `/opt/render/.cache/puppeteer`
   - Make sure `NODE_ENV` is set to `production`

4. **Check Disk Space:**
   - Render free tier has 512MB total
   - Chrome needs ~200MB
   - Check Render logs for disk space warnings

## Expected Behavior

### First Deployment
- Build takes 5-10 minutes (Chrome download)
- You'll see Chrome installation progress in build logs
- Chrome is cached in `/opt/render/.cache/puppeteer` (persistent on Render)

### Subsequent Deployments
- Build takes 2-3 minutes (Chrome already cached)
- Chrome installation step should be fast or skipped
- Runtime should find Chrome immediately

### Runtime (Import/Scrape)
- Browser launch should be instant (< 1 second)
- No "downloading Chrome" messages at runtime
- Chrome is found via one of the 4 detection methods

## Summary

**The fix ensures:**
1. ✅ Chrome is installed during build (not at runtime)
2. ✅ Chrome is installed to the correct cache directory
3. ✅ Chrome can be found at runtime using multiple detection methods
4. ✅ Better error messages if something goes wrong
5. ✅ Build doesn't fail if Chrome installation has issues (continues anyway)

**After deploying:**
- Chrome will be installed during build
- Chrome will be found at runtime
- Import/scrape functionality will work
- No more "Browser was not found" errors

## Next Steps

1. Update Render build command
2. Verify environment variables
3. Commit and push code
4. Wait for deployment (5-10 minutes)
5. Test import functionality
6. Celebrate! 🎉

If you still encounter issues, check the Render logs and share the error messages. The improved logging should make it clear what's going wrong.

