# ArtTracker

Monitor your favorite ArtStation creators, catch brand-new uploads within minutes, and keep a weekly audit trail of anything they edit. ArtTracker is a full-stack PWA built for “set‑and‑forget” fans: add your artists once and the scheduler handles the rest.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)

---

## Table of Contents
1. [Why ArtTracker?](#why-arttracker)
2. [Feature Overview](#feature-overview)
3. [Architecture](#architecture)
4. [Quick Start](#quick-start)
5. [Daily Workflow](#daily-workflow)
6. [Scheduler & Cron Jobs](#scheduler--cron-jobs)
7. [Notifications](#notifications)
8. [Deployment Guide](#deployment-guide)
9. [Troubleshooting](#troubleshooting)
10. [Roadmap](#roadmap)

---

## Why ArtTracker?

- **Never miss a post** – Incremental scrapes run every 6 hours and finish in seconds.
- **Know when something changed** – A weekly deep scan re-checks every stored project and silently updates metadata if the artist edits an older post.
- **Low friction** – Install ArtTracker as a PWA on your phone, browse cached data offline, and manage everything from a single UI.
- **Respectful automation** – Puppeteer, throttling, and Cloudflare handling keep you under ArtStation’s radar.

---

## Feature Overview

| Category | Highlights |
| --- | --- |
| Mobile & PWA | Installable, offline cache for artists/artworks, home-screen icon |
| Artist management | Add/remove by username or full URL, per-user ArtStation handle |
| Scraping | Fast incremental check (stop at first known ID), weekly full rescan for edits |
| Storage | JSON (dev) or PostgreSQL/Supabase (prod). Migrations included. |
| Scheduler | Daily follow sync (09:00 UTC), incremental check (every 6 h), full rescan (Sunday 00:00 UTC) |
| Notifications | Discord webhook with optional @mention; “updated artwork” vs “new artwork” labels |
| UI niceties | “New only” toggle, latest-per-artist mode, mark-as-seen, toast feedback |

---

## Architecture

```
ArtTracker/
├── backend/ (Node + Express + Puppeteer)
│   ├── src/
│   │   ├── routes/        REST API
│   │   ├── scraper-*.ts   Scraping flows (incremental + rescan)
│   │   ├── scheduler.ts   Cron orchestration
│   │   ├── notifications/ Discord webhooks
│   │   └── database.ts    JSON + Postgres adapters
├── frontend/ (React + Vite)
│   ├── src/
│   │   ├── components/    UI
│   │   ├── App.tsx        Main shell
│   │   └── api.ts         REST client
└── shared/                Cross-cutting types
```

**Backend:** TypeScript, Express, Puppeteer, Axios.  
**Frontend:** React (TS), React Hot Toast, service worker + manifest for PWA.

---

## Quick Start

### 1. Clone + Install
```bash
git clone https://github.com/<you>/ArtTracker.git
cd ArtTracker
npm install
```

### 2. Choose storage
- **Local dev:** do nothing (JSON file at `backend/data/arttracker.json`)
- **Postgres / Supabase:** set `DATABASE_URL` and run migrations
  ```bash
  cd backend
  npm run build
  psql $DATABASE_URL -f migrations/001_init.sql
  psql $DATABASE_URL -f migrations/002_add_discord_fields.sql
  psql $DATABASE_URL -f migrations/003_add_artwork_updated_at.sql
  ```

### 3. Env vars (`backend/.env`)
```env
PORT=3001
ENABLE_SCHEDULER=true
SCRAPE_DELAY_MS=2000
CORS_ORIGIN=http://localhost:5173
# DATABASE_URL=postgres://...
# PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer    # recommended on Render
```

### 4. Run locally
```bash
npm run dev            # concurrent frontend + backend
# or
npm run dev:backend
npm run dev:frontend
```

Frontend: http://localhost:5173  
Backend/API: http://localhost:3001

---

## Daily Workflow

1. **Log in / create user** (token stored in localStorage).  
2. **Add artists** via username or profile URL.  
3. **Sync & check**  
   - `🔄 Check for Updates` = incremental scrape (fast, new posts + edits near the top).  
   - Scheduler repeats this automatically every 6 hours.  
4. **Review artworks**  
   - Filter by artist, toggle “New only,” click thumbnails to open ArtStation.  
   - Mark items as seen or clear an entire artist.
5. **Discord alerts**  
   - Configure webhook + optional mention in Settings.  
   - Receive “New Artwork” or “Updated Artwork” messages only when something actually changes.

---

## Scheduler & Cron Jobs

| Job | Default cron | Purpose |
| --- | --- | --- |
| Follow sync | `0 9 * * *` | Syncs ArtStation following list (adds/removes artists) |
| Incremental check | `0 */6 * * *` | Scrapes for new posts fast, notifies on new/updated ones |
| Weekly rescan | `0 0 * * 0` | Full sweep to refresh metadata/updated_at without notifications |

Override with env vars (`CRON_SYNC_SCHEDULE`, `CRON_ARTWORK_CHECK_SCHEDULE`, `CRON_FULL_RESCAN_SCHEDULE`).

Manual scripts:
```bash
cd backend
npm run scrape                                    # incremental
npm run ts-node src/scripts/scrape.ts -- --task rescan-all
```

---

## Notifications

- **Discord:** set `discord_webhook_url` + `discord_user_id` on your profile.  
- Incremental job: “New Artwork” / “Updated Artwork” messages with embeds.  
- Weekly rescan: updates DB silently, no notifications, no `is_new` flips.

---

## Deployment Guide

### Backend (Render / Railway)
```bash
cd backend
npm run build
```
Set env vars:
```env
PORT=3001
ENABLE_SCHEDULER=true
DATAB
