# 🚀 ArtTracker Deployment Guide

This guide will walk you through deploying ArtTracker to Render (backend) and Vercel (frontend) for free.

## Prerequisites

- GitHub account (to host your code)
- Render account (free tier for backend)
- Vercel account (free tier for frontend)
- Supabase account (free tier for PostgreSQL database, recommended) OR Render PostgreSQL (free tier)

## Step 1: Set Up Database

### Option A: Supabase (Recommended - More Reliable)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Fill in:
   - **Project Name**: `arttracker` (or any name you like)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project" and wait ~2 minutes
5. Once created, go to **Settings** → **Database**
6. Scroll to "Connection string" and copy the **URI** format:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` with your database password
7. Save this connection string - you'll need it for Step 3

### Option B: Render PostgreSQL (Alternative)

1. Go to [render.com](https://render.com) and create an account
2. Click "New +" → "PostgreSQL"
3. Fill in:
   - **Name**: `arttracker-db`
   - **Database**: `arttracker`
   - **User**: `arttracker`
   - **Region**: Choose closest to you
   - **Plan**: Free
4. Click "Create Database"
5. Wait for it to be created (~1 minute)
6. Copy the **Internal Database URL** (you'll use this later)

## Step 2: Run Database Migration

You need to create the database tables. You have two options:

### Option A: Using Supabase SQL Editor (Easiest)

1. In Supabase, go to **SQL Editor**
2. Click "New query"
3. Copy the contents of `backend/migrations/001_init.sql`
4. Paste into the editor
5. Click "Run" (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

### Option B: Using psql (Command Line)

If you have `psql` installed:

```bash
psql [YOUR_DATABASE_URL] < backend/migrations/001_init.sql
```

Replace `[YOUR_DATABASE_URL]` with your connection string from Step 1.

## Step 3: Deploy Backend to Render

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Go to Render Dashboard**: [dashboard.render.com](https://dashboard.render.com)

3. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `ArtTracker` repository

4. **Configure the service**:
   - **Name**: `arttracker-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Set Environment Variables**:
   Click "Advanced" and add these environment variables:
   
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=[YOUR_DATABASE_URL_FROM_STEP_1]
   CORS_ORIGIN=[YOUR_FRONTEND_URL_WILL_GO_HERE]
   SCRAPE_DELAY_MS=2000
   ```
   
   **Important**: 
   - Replace `[YOUR_DATABASE_URL_FROM_STEP_1]` with your database connection string
   - Leave `CORS_ORIGIN` empty for now - you'll update it after deploying the frontend
   
6. **Deploy**:
   - Click "Create Web Service"
   - Wait for the build to complete (~3-5 minutes)
   - Once deployed, copy your backend URL (e.g., `https://arttracker-backend.onrender.com`)

## Step 4: Deploy Frontend to Vercel

1. **Go to Vercel**: [vercel.com](https://vercel.com)

2. **Sign in** with your GitHub account

3. **Import your project**:
   - Click "Add New..." → "Project"
   - Select your `ArtTracker` repository
   - Click "Import"

4. **Configure the project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (should auto-detect)
   - **Output Directory**: `dist` (should auto-detect)

5. **Set Environment Variables**:
   Click "Environment Variables" and add:
   
   ```
   VITE_API_BASE=[YOUR_BACKEND_URL_FROM_STEP_3]
   ```
   
   Replace `[YOUR_BACKEND_URL_FROM_STEP_3]` with your Render backend URL (e.g., `https://arttracker-backend.onrender.com`)

6. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete (~2-3 minutes)
   - Once deployed, copy your frontend URL (e.g., `https://arttracker.vercel.app`)

## Step 5: Update CORS in Backend

1. **Go back to Render Dashboard**
2. **Select your backend service**
3. **Go to "Environment"** tab
4. **Update `CORS_ORIGIN`** to your Vercel frontend URL (e.g., `https://arttracker.vercel.app`)
5. **Save changes** - Render will automatically restart your service

## Step 6: Test Your Deployment

1. **Visit your frontend URL** (from Step 4)
2. **Register a new user** (or login if you already have one)
3. **Import your ArtStation following list**
4. **Test the "Check for Updates" feature**

## Troubleshooting

### Backend Issues

**Problem**: Build fails with "Cannot find module 'pg'"
- **Solution**: Make sure `pg` is in `backend/package.json` dependencies (it should be)

**Problem**: Database connection errors
- **Solution**: 
  - Double-check your `DATABASE_URL` is correct
  - For Supabase: Make sure you're using the URI format with `[YOUR-PASSWORD]` replaced
  - Check that your database is accessible (not paused)

**Problem**: Backend goes to sleep (Render free tier)
- **Solution**: This is normal for Render's free tier. The first request after ~15 minutes of inactivity will be slow (~30 seconds). Subsequent requests are fast. Consider upgrading to a paid plan if this is an issue.

### Frontend Issues

**Problem**: "Cannot connect to backend" errors
- **Solution**: 
  - Check that `VITE_API_BASE` is set correctly in Vercel
  - Make sure your backend is running (check Render dashboard)
  - Verify CORS is configured correctly (Step 5)

**Problem**: 401 Unauthorized errors
- **Solution**: This is normal if you're not logged in. Register/login first.

### Database Issues

**Problem**: "relation 'users' does not exist"
- **Solution**: You forgot to run the migration (Step 2). Go back and run `001_init.sql`

**Problem**: Migration fails
- **Solution**: 
  - Check that you copied the entire SQL file
  - Make sure you're connected to the correct database
  - Try running the SQL commands one at a time

## Cost Summary

- **Supabase**: Free (up to 500MB database, 2GB bandwidth/month)
- **Render**: Free (sleeps after 15 min inactivity, slow first request)
- **Vercel**: Free (excellent performance, no sleep)
- **Total**: **$0/month** 🎉

## Next Steps

- **Custom Domain**: Add a custom domain to Vercel (free)
- **Monitoring**: Set up error tracking (e.g., Sentry - free tier)
- **Backups**: Supabase automatically backs up your database (7 days retention on free tier)

## Support

If you run into issues:
1. Check the Render logs (Dashboard → Your Service → Logs)
2. Check the Vercel logs (Dashboard → Your Project → Deployments → Click deployment → Functions/Logs)
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly

---

**Congratulations!** Your ArtTracker app is now live and accessible to your friends! 🎉

