import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initDatabase } from './database';
import { initScheduler } from './scheduler';
import authRoutes from './routes/auth';
import artistRoutes from './routes/artists';
import artworkRoutes from './routes/artworks';
import scrapeRoutes from './routes/scrape';
import importRoutes from './routes/import';
import databaseRoutes from './routes/database';
import cronRoutes from './routes/cron';
import userRoutes from './routes/user';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS configuration - support multiple origins for production
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

// Initialize database
initDatabase();

// Initialize scheduler (if enabled)
initScheduler();

// Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (no authentication required)
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/user', userRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/database', databaseRoutes);

// Cron endpoints (require API key if CRON_API_KEY is set)
app.use('/api/cron', cronRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 ArtTracker backend running on http://localhost:${PORT}`);
});

