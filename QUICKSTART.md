# 🚀 Quick Start Guide

Get ArtTracker running in 3 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

This installs everything for both backend and frontend.

## Step 2: Start the App

```bash
npm run dev
```

This starts both servers:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173

## Step 3: Add Your First Artist

1. Open http://localhost:5173
2. Click "➕ Add Artist"
3. Enter an ArtStation username (try: `wlop` or `rossdraws`)
4. Click "Add Artist"

## Step 4: Get Artworks

Click "🔄 Check for Updates" to scrape artworks from your followed artists.

---

## Common Commands

```bash
# Start both backend & frontend
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Manual scrape from command line
npm run scrape

# Build for production
npm run build
```

## Troubleshooting

**Port already in use?**
Edit `backend/.env` and change the PORT.

**No artworks showing?**
Click "Check for Updates" to scrape. First scrape may take a few seconds.

**Database errors?**
Delete `backend/data/arttracker.db` and restart.

---

That's it! 🎉 Check the main README.md for more details.

