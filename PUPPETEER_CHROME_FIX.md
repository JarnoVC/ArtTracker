# Fix Chrome Not Found Error on Render

## The Problem

Chrome is not being found at the expected path even after installation. This can happen because:
- Chrome installation failed silently during build
- Cache directory is not persistent between builds
- Path resolution is incorrect

## Solution: Use System Chrome or Better Installation

### Option 1: Use System Chrome (Fastest - Recommended)

Render may have system Chrome available. Update your code to try system Chrome first.

**Already implemented in the code!** The updated `getBrowser()` function now:
1. Tries Puppeteer's default path
2. Checks system Chrome locations (`/usr/bin/google-chrome`, `/usr/bin/chromium`, etc.)
3. Searches the cache directory
4. Falls back to Puppeteer default

### Option 2: Verify Chrome Installation in Build

Make sure Chrome is actually being installed. The build command should show:
```
✅ Chrome installed successfully at: /opt/render/.cache/puppeteer/...
```

If you don't see this, the installation is failing.

### Option 3: Use Alternative Chrome Installation

Try using `chromium` instead of `chrome` in the build command:

**Build Command:**
```
npm ci && PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chromium && npm run build
```

Chromium is smaller and may install faster.

### Option 4: Pre-install Chrome in Render (Manual)

1. Go to Render Dashboard → Your Service → **Shell** (if available)
2. Run manually:
   ```bash
   mkdir -p /opt/render/.cache/puppeteer
   export PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
   npx puppeteer browsers install chrome
   ```

However, this won't persist across deployments.

## Quick Fix: Update Build Command

Try this build command that ensures Chrome is installed and verified:

```
npm ci && mkdir -p /opt/render/.cache/puppeteer && PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chrome && npm run build
```

## Check Your Logs

After deployment, check the logs for:
1. During build:
   - `✅ Chrome installed successfully at: ...`
   
2. During runtime:
   - `✅ Found system Chrome at: ...` OR
   - `✅ Found Chrome in cache: ...` OR
   - `✅ Browser launched successfully`

If you see `❌ Failed to launch browser`, Chrome installation failed.

## Alternative: Use @sparticuz/chromium (Serverless-Optimized)

If the above doesn't work, consider using `@sparticuz/chromium` which is optimized for serverless environments:

```bash
npm install @sparticuz/chromium
```

Then update the code to use it. But this is a bigger change.

## Recommended Next Steps

1. **First, try the updated code** - it now searches multiple locations for Chrome
2. **Check Render build logs** - see if Chrome installation is actually completing
3. **Try system Chrome paths** - Render might have Chrome pre-installed
4. **If still failing**, check Render's disk space - Chrome needs ~200MB

The updated code should automatically find Chrome if it's installed anywhere on the system.

