# 🎨 ArtTracker

A mobile-friendly web app to monitor new uploads from your favorite ArtStation creators. Get notified when your followed artists post new artwork!

![ArtTracker](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)

## ✨ Features

- 📱 **Mobile-First Design** - Fully responsive interface that works great on all devices
- 👤 **Artist Management** - Add/remove ArtStation artists by username or profile URL
- 🔍 **Smart Scraping** - Automatically detects new artworks from followed artists
- 🔔 **Notifications** - Get alerts when new artworks are discovered
- 🎯 **Filter Options** - View all artworks or just new ones
- 💾 **Local Storage** - Uses JSON file storage for simple, lightweight data persistence
- ⏱️ **Rate Limiting** - Gentle scraping with configurable delays (default 2s)

## 🏗️ Tech Stack

### Backend
- **TypeScript** + **Node.js** + **Express**
- **Cheerio** for web scraping
- **JSON file storage** (lightweight, no native compilation needed)
- **Axios** for HTTP requests

### Frontend
- **React** + **Vite**
- **TypeScript**
- **React Hot Toast** for notifications
- **CSS** with modern design patterns

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm

### Setup

1. **Clone or navigate to the project:**
```bash
cd ArtTracker
```

2. **Install dependencies:**
```bash
npm install
```

This will install dependencies for both backend and frontend (using npm workspaces).

3. **Configure backend (optional):**

The app works out of the box with default settings. If you want to customize, create `backend/.env`:
```env
PORT=3001
DATABASE_PATH=./data/arttracker.json
SCRAPE_DELAY_MS=2000
CORS_ORIGIN=http://localhost:5173
```

## 🚀 Usage

### Development Mode

Start both backend and frontend together:
```bash
npm run dev
```

Or run them separately:

**Backend only:**
```bash
npm run dev:backend
# Server runs at http://localhost:3001
```

**Frontend only:**
```bash
npm run dev:frontend
# App runs at http://localhost:5173
```

### Manual Scraping

You can manually scrape all followed artists from the command line:
```bash
npm run scrape
```

This is useful for testing or setting up a cron job.

## 📖 How to Use

1. **Open the app** at `http://localhost:5173`

2. **Add artists:**
   - Click "➕ Add Artist"
   - Enter an ArtStation username (e.g., `bobby_rebholz`) or full URL
   - Click "Add Artist"

3. **Check for updates:**
   - Click "🔄 Check for Updates" in the header
   - The app will scrape all followed artists for new artworks
   - New artworks will be highlighted with a "NEW" badge

4. **Browse artworks:**
   - View all artworks or filter by artist
   - Toggle "New Only" to see just new artworks
   - Click any artwork to open it on ArtStation

5. **Manage notifications:**
   - Mark individual artworks as seen by clicking ✓
   - Or use "Mark All as Seen" to clear all new flags

## 📁 Project Structure

```
ArtTracker/
├── backend/
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── scripts/       # CLI scripts
│   │   ├── database.ts    # SQLite setup
│   │   ├── scraper.ts     # ArtStation scraper
│   │   └── index.ts       # Express server
│   ├── data/              # SQLite database (auto-created)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── api.ts         # API client
│   │   ├── App.tsx        # Main app
│   │   └── main.tsx       # Entry point
│   ├── index.html
│   └── package.json
└── package.json           # Root workspace config
```

## 🔌 API Endpoints

### Artists
- `GET /api/artists` - Get all followed artists
- `POST /api/artists` - Add new artist
- `DELETE /api/artists/:id` - Remove artist

### Artworks
- `GET /api/artworks` - Get artworks (optionally filtered)
- `GET /api/artworks/new-count` - Get count of new artworks
- `PATCH /api/artworks/:id/mark-seen` - Mark artwork as seen
- `POST /api/artworks/mark-all-seen` - Mark all as seen

### Scraping
- `POST /api/scrape/artist/:id` - Scrape specific artist
- `POST /api/scrape/all` - Scrape all followed artists

## 🚢 Deployment

### Backend (Render / Heroku / Railway)

1. **Build the backend:**
```bash
cd backend
npm run build
```

2. **Set environment variables:**
```env
PORT=3001
DATABASE_PATH=/data/arttracker.db
SCRAPE_DELAY_MS=2000
CORS_ORIGIN=https://your-frontend-domain.com
```

3. **Start command:**
```bash
npm start
```

4. **Set up scheduled scraping** (optional):
   - Use cron job or platform scheduler
   - Run: `npm run scrape`
   - Recommended: Every 1-6 hours

### Frontend (Vercel / Netlify)

1. **Build the frontend:**
```bash
cd frontend
npm run build
```

2. **Update API endpoint:**
   - Modify `frontend/src/api.ts`
   - Change `API_BASE` to your backend URL

3. **Deploy `frontend/dist` folder**

### Docker (Optional)

You can containerize both services:

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/dist ./dist
CMD ["npm", "start"]
```

## 🛠️ Development

### Adding New Features

The codebase is organized for easy extension:

- **New API routes**: Add to `backend/src/routes/`
- **New components**: Add to `frontend/src/components/`
- **Database changes**: Modify `backend/src/database.ts`
- **Scraping logic**: Update `backend/src/scraper.ts`

### Data Structure

The app stores data in a JSON file (`backend/data/arttracker.json`):

```typescript
{
  "artists": [
    {
      "id": 1,
      "username": "wlop",
      "display_name": "WLOP",
      "profile_url": "https://www.artstation.com/wlop",
      "avatar_url": "...",
      "last_checked": "2025-11-06T12:00:00Z",
      "created_at": "2025-11-06T10:00:00Z"
    }
  ],
  "artworks": [
    {
      "id": 1,
      "artist_id": 1,
      "artwork_id": "abc123",
      "title": "Beautiful Artwork",
      "thumbnail_url": "...",
      "artwork_url": "https://www.artstation.com/artwork/abc123",
      "upload_date": "2025-11-01",
      "is_new": 1,
      "discovered_at": "2025-11-06T12:00:00Z"
    }
  ],
  "nextArtistId": 2,
  "nextArtworkId": 2
}
```

## 🔧 Troubleshooting

### Scraping Issues

**Problem:** No artworks found
- ArtStation may have changed their HTML structure
- Check network tab for actual API endpoints
- Update `backend/src/scraper.ts` accordingly

**Problem:** Rate limiting / blocked
- Increase `SCRAPE_DELAY_MS` in `.env`
- Use a VPN if blocked by IP
- Consider using proxies for production

### Build Errors

**Problem:** TypeScript errors
```bash
# Clean and rebuild (Windows)
rmdir /s /q node_modules
rmdir /s /q backend\node_modules
rmdir /s /q frontend\node_modules
npm install
npm run build
```

**Problem:** Port already in use
```bash
# Change PORT in backend/.env or set environment variable
$env:PORT=3002
npm run dev:backend
```

**Problem:** Database corruption
```bash
# Delete the JSON database file and restart
Remove-Item backend\data\arttracker.json
npm run dev
```

## 🚀 Future Enhancements

- [ ] Push notifications with Firebase Cloud Messaging
- [ ] Email notifications
- [ ] PWA support for mobile installation
- [ ] Support for other platforms (DeviantArt, Behance)
- [ ] RSS feed generation
- [ ] Discord/Slack webhooks
- [ ] Advanced filtering (by date, tags, etc.)
- [ ] Export/import followed artists list

## 📝 Notes

- **Scraping Etiquette**: The app includes 2-second delays between requests. Be respectful of ArtStation's servers.
- **Terms of Service**: Make sure your use complies with ArtStation's ToS.
- **Personal Use**: This tool is intended for personal use to follow artists you're interested in.

## 📄 License

MIT License - feel free to modify and use for your own projects!

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

Made with ❤️ for art enthusiasts

