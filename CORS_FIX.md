# CORS Fix for Render Deployment

## Problem
You're getting CORS errors because the backend isn't allowing requests from your frontend domain.

## Solution

### Step 1: Get Your Exact Frontend URL
Your frontend URL is: `https://art-tracker-frontend.vercel.app`

**Important**: Make sure to include `https://` at the beginning!

### Step 2: Update CORS_ORIGIN in Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your backend service (`arttracker-backend`)
3. Go to **Environment** tab
4. Find the `CORS_ORIGIN` environment variable
5. Update it to: `https://art-tracker-frontend.vercel.app`
   - **Make sure it starts with `https://`**
   - **No trailing slash**
   - **Exactly match your Vercel domain**

6. Click **Save Changes**
7. Render will automatically restart your service (wait ~30 seconds)

### Step 3: Verify the Fix

After the restart:
1. Go to your frontend: `https://art-tracker-frontend.vercel.app`
2. Try to register/login again
3. Check the browser console - CORS errors should be gone

### Step 4: If It Still Doesn't Work

If you're still getting CORS errors:

1. **Check the exact origin** in the error message
   - The error will show exactly what origin is being rejected
   - Make sure `CORS_ORIGIN` matches EXACTLY (including `https://`)

2. **Check backend logs in Render**:
   - Go to Render Dashboard → Your Service → Logs
   - Look for `CORS: Blocked request from origin:` messages
   - This will show you exactly what origin is being sent

3. **Common mistakes**:
   - ❌ `art-tracker-frontend.vercel.app` (missing https://)
   - ❌ `https://art-tracker-frontend.vercel.app/` (trailing slash)
   - ❌ `http://art-tracker-frontend.vercel.app` (wrong protocol)
   - ✅ `https://art-tracker-frontend.vercel.app` (correct!)

4. **For multiple environments**, you can use comma-separated values:
   ```
   https://art-tracker-frontend.vercel.app,https://arttracker.vercel.app
   ```

## Testing CORS Locally

If you want to test with localhost during development, you can set:
```
CORS_ORIGIN=http://localhost:5173,https://art-tracker-frontend.vercel.app
```

This allows both local development and production.

