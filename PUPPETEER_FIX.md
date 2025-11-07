# Fix Puppeteer Chrome Installation on Render

## The Problem

Puppeteer can't find Chrome because it's not installed in the Render environment. This happens because:
- Render's free tier doesn't include Chrome by default
- Puppeteer needs Chrome to be installed before it can run
- The cache directory needs to be configured

## The Solution

I've updated the code to automatically install Chrome during the build process. However, you need to update your Render configuration.

### Step 1: Update Render Build Command

1. Go to **Render Dashboard** → Your Backend Service
2. Go to **Settings** tab
3. Find **"Build Command"**
4. Update it to:
   ```
   npm ci && PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chrome && npm run build
   ```
   
   **Note**: If your root directory is set to `backend` in Render, use the command above. If your root directory is the project root (not `backend`), use:
   ```
   cd backend && npm ci && PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chrome && npm run build
   ```
5. Click **Save Changes**

### Step 2: Add Environment Variables

1. Still in **Settings** → **Environment**
2. Add these environment variables:

   **Variable 1:**
   - Key: `PUPPETEER_CACHE_DIR`
   - Value: `/opt/render/.cache/puppeteer`

   **Variable 2:**
   - Key: `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`
   - Value: `false`

3. Click **Save Changes**

### Step 3: Redeploy

1. Render will automatically restart after saving
2. Wait for the build to complete (this may take 5-10 minutes the first time as it downloads Chrome)
3. Check the logs to see if Chrome was installed successfully

### Step 4: Verify

After deployment, check the logs for:
- `✅ Puppeteer browsers installed successfully`
- `✅ Found Chrome at: ...`
- `✅ Browser launched successfully`

## Alternative: Use Render's System Chrome (Faster)

If the above doesn't work, you can try using system Chrome (if available):

1. Add environment variable:
   - Key: `PUPPETEER_EXECUTABLE_PATH`
   - Value: `/usr/bin/google-chrome` or `/usr/bin/chromium-browser`

2. This tells Puppeteer to use system Chrome instead of downloading its own

## Build Time Note

**Important**: The first build after adding Chrome installation will take **5-10 minutes** because it needs to download Chrome (~200MB). Subsequent builds will be faster.

## If It Still Doesn't Work

1. **Check Render logs** for the exact error
2. **Verify build command** includes the Chrome installation step
3. **Check disk space** - Render free tier has limited space (512MB), Chrome needs ~200MB
4. **Try using Chromium** instead: Change `chrome` to `chromium` in the build command

## Quick Checklist

- [ ] Build command updated to include Chrome installation
- [ ] `PUPPETEER_CACHE_DIR` environment variable set
- [ ] Service has been redeployed
- [ ] Checked logs for Chrome installation success
- [ ] First build completed (takes 5-10 minutes)

