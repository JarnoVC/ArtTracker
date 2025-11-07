# Fix Supabase Database Connection on Render

## The Problem

You're getting `ENETUNREACH` error with an IPv6 address. This happens because:
- Supabase's direct connection (port 5432) uses IPv6
- Render's free tier doesn't support IPv6 connections well
- The connection string format might be incorrect

## The Solution: Use Supabase Connection Pooler

Supabase provides a **connection pooler** that works much better with Render and other cloud providers.

### Step-by-Step Fix

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Get Connection Pooler URL**
   - Go to **Settings** → **Database**
   - Scroll down to **"Connection pooling"** section
   - Find **"Transaction mode"** (or "Session mode" if Transaction isn't available)
   - Click **"Copy"** next to the connection string
   - It should look like:
     ```
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
   - **Notice**: Port is **6543** (not 5432), and it uses `pooler.supabase.com`

3. **Replace [YOUR-PASSWORD]**
   - The connection string will have `[YOUR-PASSWORD]` placeholder
   - Replace it with your **actual database password**
   - This is the password you set when creating the Supabase project
   - If you forgot it, you can reset it in Supabase Settings → Database

4. **Update DATABASE_URL in Render**
   - Go to **Render Dashboard** → Your Backend Service
   - Go to **Environment** tab
   - Find `DATABASE_URL`
   - **Delete the old value** (the one with IPv6)
   - **Paste the new connection pooler URL** (with your password replaced)
   - Make sure it's all on **one line** (no line breaks)
   - Click **Save Changes**

5. **Wait for Restart**
   - Render will automatically restart your service
   - Wait ~30-60 seconds
   - Check the logs to see if connection succeeds

6. **Verify It Works**
   - Go to **Render Dashboard** → Your Service → **Logs**
   - Look for: `✅ Database initialized (PostgreSQL)`
   - If you see this, the connection is working!

## Example Connection String Format

**❌ Wrong (Direct connection - causes IPv6 issues):**
```
postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

**✅ Correct (Connection pooler - works with Render):**
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Key differences:**
- Uses `pooler.supabase.com` instead of `db.xxxxx.supabase.co`
- Port is **6543** instead of 5432
- Format: `postgres.[PROJECT-REF]` instead of `postgres`

## If You Don't See Connection Pooling Option

If you don't see the connection pooling section in Supabase:
1. Make sure your project is not paused
2. Try refreshing the page
3. Connection pooling should be available on all Supabase projects (including free tier)

## Alternative: Use Render PostgreSQL

If Supabase continues to have issues, you can use Render's own PostgreSQL:

1. In Render Dashboard, click **"New +"** → **"PostgreSQL"**
2. Fill in:
   - **Name**: `arttracker-db`
   - **Database**: `arttracker`
   - **User**: `arttracker`
   - **Plan**: Free
3. Click **"Create Database"**
4. Once created, go to **Info** tab
5. Copy the **"Internal Database URL"**
6. Use this as your `DATABASE_URL` in Render

**Note**: Render PostgreSQL free tier also pauses after inactivity, but it's easier to manage since it's in the same dashboard.

## Still Having Issues?

1. **Check Supabase project status** - Make sure it's not paused
2. **Verify password** - Make sure you're using the correct database password
3. **Check Render logs** - Look for the exact error message
4. **Try Session mode** - If Transaction mode doesn't work, try Session mode pooler
5. **Contact support** - If nothing works, the issue might be with Supabase/Render compatibility

## Quick Checklist

- [ ] Using connection pooler URL (port 6543)
- [ ] Password is replaced in connection string (not `[YOUR-PASSWORD]`)
- [ ] Connection string is on one line
- [ ] Supabase project is running (not paused)
- [ ] `DATABASE_URL` updated in Render environment variables
- [ ] Service restarted after updating environment variable
- [ ] Checked Render logs for success message

