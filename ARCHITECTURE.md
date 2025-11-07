# 🏛️ Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Header    │  │  ArtistList  │  │  ArtworkGrid     │   │
│  │  Component │  │  Component   │  │  Component       │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
│         │                │                    │              │
│         └────────────────┴────────────────────┘              │
│                          │                                   │
│                     ┌────▼────┐                             │
│                     │ API Layer│                             │
│                     │ (axios)  │                             │
│                     └────┬────┘                             │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/REST
┌──────────────────────────▼──────────────────────────────────┐
│                  Backend (Express.js)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Routes                              │   │
│  │  /api/artists  /api/artworks  /api/scrape          │   │
│  └──────────────┬──────────────────┬───────────────────┘   │
│                 │                  │                         │
│         ┌───────▼──────┐   ┌──────▼────────┐               │
│         │   Database   │   │    Scraper    │               │
│         │   (SQLite)   │   │   (Cheerio)   │               │
│         └──────────────┘   └───────┬───────┘               │
└────────────────────────────────────┼─────────────────────────┘
                                     │ HTTPS
                          ┌──────────▼──────────┐
                          │   ArtStation.com    │
                          │   (Web Scraping)    │
                          └─────────────────────┘
```

## Data Flow

### Adding an Artist
1. User enters username in frontend
2. Frontend sends POST to `/api/artists`
3. Backend validates and stores in SQLite
4. Returns artist data to frontend
5. UI updates with new artist

### Scraping Artworks
1. User clicks "Check for Updates"
2. Frontend sends POST to `/api/scrape/all`
3. Backend loops through each artist
4. For each artist:
   - Fetch ArtStation page
   - Parse HTML with Cheerio
   - Extract artwork data
   - Compare with existing artworks in DB
   - Store new artworks
5. Return results to frontend
6. Frontend shows toast notifications
7. UI updates with new artworks

### Viewing Artworks
1. User navigates to artwork grid
2. Frontend fetches from `/api/artworks`
3. Backend queries SQLite with filters
4. Returns artwork list
5. Frontend renders grid with cards

## Database Schema

```sql
┌─────────────────────────────────────┐
│            artists                  │
├─────────────────────────────────────┤
│ id (PK)                             │
│ username (UNIQUE)                   │
│ display_name                        │
│ profile_url                         │
│ avatar_url                          │
│ last_checked                        │
│ created_at                          │
└────────────┬────────────────────────┘
             │ 1:N
             │
┌────────────▼────────────────────────┐
│           artworks                  │
├─────────────────────────────────────┤
│ id (PK)                             │
│ artist_id (FK)                      │
│ artwork_id (UNIQUE per artist)      │
│ title                               │
│ thumbnail_url                       │
│ artwork_url                         │
│ upload_date                         │
│ is_new (boolean flag)               │
│ discovered_at                       │
└─────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── Toaster (react-hot-toast)
├── Header
│   ├── Logo with badge
│   ├── "Check for Updates" button
│   └── "Add Artist" button
├── Main Container
│   ├── ArtistList (Sidebar)
│   │   ├── Filter button (All Artists)
│   │   └── Artist Cards
│   │       ├── Avatar
│   │       ├── Display name
│   │       └── Delete button
│   └── ArtworkGrid (Main Content)
│       ├── Header with filters
│       ├── Actions (Mark all seen, Toggle new)
│       └── Artwork Cards
│           ├── Image
│           ├── NEW badge (if new)
│           ├── Title
│           └── Artist name
└── AddArtistModal (Conditional)
    ├── Input field
    └── Action buttons
```

## Key Technologies

### Backend
- **Express.js**: RESTful API server
- **better-sqlite3**: Fast, synchronous SQLite
- **Cheerio**: jQuery-like HTML parsing
- **Axios**: HTTP client for scraping
- **TypeScript**: Type safety
- **Morgan**: Request logging
- **CORS**: Cross-origin support

### Frontend
- **React 18**: UI library
- **Vite**: Fast build tool
- **TypeScript**: Type safety
- **Axios**: API requests
- **React Hot Toast**: Notifications
- **CSS Variables**: Theming

## Scalability Considerations

### Current Implementation (Local/Small Scale)
- ✅ SQLite for simple setup
- ✅ Direct scraping from backend
- ✅ In-process task execution

### Production Scaling (If Needed)
- 🔄 PostgreSQL/MySQL for better concurrency
- 🔄 Job queue (Bull, BullMQ) for async scraping
- 🔄 Redis for caching and rate limiting
- 🔄 Separate scraper service/worker
- 🔄 CDN for artwork thumbnails
- 🔄 WebSocket for real-time updates

## Security Notes

- **Rate Limiting**: Built-in delays between scrapes
- **CORS**: Configured for specific origin
- **Input Validation**: Username/URL validation
- **No Auth (Yet)**: Single-user local deployment
- **For Multi-User**: Add JWT auth + user isolation

## Performance Optimizations

1. **Database Indexes**: On artist_id, artwork_id
2. **Lazy Loading**: Images load on scroll
3. **Efficient Queries**: SELECT with JOINs
4. **Memoization**: React components
5. **Batch Operations**: Bulk inserts for scraping
6. **Polling**: Check new count every 5 minutes

## Future Architecture Enhancements

1. **Microservices**: Separate scraper service
2. **Event-Driven**: Pub/sub for new artwork events
3. **Caching Layer**: Redis for frequently accessed data
4. **CDN Integration**: Cache thumbnails
5. **Push Notifications**: Firebase Cloud Messaging
6. **Real-time Updates**: WebSocket connection
7. **Multi-Platform**: Support for other art sites

