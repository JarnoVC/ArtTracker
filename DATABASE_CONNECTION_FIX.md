# Database Connection Fix

## Error: `ENETUNREACH` with IPv6 Address

This error means the backend can't connect to your PostgreSQL database. The IPv6 address suggests a connection string issue.

## Solutions

### Solution 1: Check Your Database is Running (Supabase)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Check if the database is **paused** (free tier databases pause after inactivity)
4. If paused, click **"Resume"** or **"Unpause"**
5. Wait ~1 minute for it to start

### Solution 2: Use the Correct Connection String

**For Supabase:**

1. Go to **Settings** → **Database**
2. Scroll to **Connection string**
3. Select **URI** format
4. Copy the connection string (it should look like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
5. **Important**: Replace `[YOUR-PASSWORD]` with your actual database password

### Solution 3: Use Connection Pooling (Recommended for Render)

Supabase provides a connection pooler that works better with serverless/free tier hosting:

1. In Supabase, go to **Settings** → **Database**
2. Scroll to **Connection pooling**
3. Use the **Transaction** mode connection string (port 6543)
4. It will look like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### Solution 4: Update DATABASE_URL in Render

1. Go to **Render Dashboard** → Your Backend Service
2. Go to **Environment** tab
3. Find `DATABASE_URL`
4. Update it with one of the connection strings above
5. Make sure to:
   - Replace `[YOUR-PASSWORD]` with your actual password
   - Use the **pooler** URL (port 6543) if available
   - Keep the full URL on one line (no line breaks)
6. Save and wait for service to restart

### Solution 5: If Using Render PostgreSQL

If you created a PostgreSQL database on Render:

1. Go to **Render Dashboard** → Your Database
2. Go to **Info** tab
3. Copy the **Internal Database URL** (for services on the same account)
4. Or use the **External Database URL** (if needed)
5. Paste into `DATABASE_URL` environment variable

### Solution 6: Test Connection

After updating, check Render logs:

1. Go to **Render Dashboard** → Your Backend Service → **Logs**
2. Look for: `✅ Database initialized (PostgreSQL)`
3. If you see: `❌ Database connection error`, the connection string is still wrong

## Common Issues

**Issue**: Database is paused
- **Fix**: Resume it in Supabase dashboard

**Issue**: Wrong password
- **Fix**: Use the correct password (the one you set when creating the project)

**Issue**: IPv6 connection problems
- **Fix**: Use the connection pooler URL (port 6543) instead of direct connection

**Issue**: SSL/TLS problems
- **Fix**: The code already handles SSL with `rejectUnauthorized: false`

## Quick Checklist

- [ ] Database is running (not paused)
- [ ] `DATABASE_URL` is set in Render environment variables
- [ ] Connection string includes your actual password
- [ ] Using connection pooler URL (port 6543) if available
- [ ] Connection string is on one line (no breaks)
- [ ] Backend service has been restarted after updating `DATABASE_URL`

## Still Having Issues?

1. **Check Render logs** for the exact error message
2. **Verify your database password** is correct
3. **Try the connection pooler URL** (port 6543)
4. **Make sure your database isn't paused** (Supabase free tier)

