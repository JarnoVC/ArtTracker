import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/arttracker.json';

console.log('🗑️  Clearing all data from database...');

// Create a fresh empty database
const freshDatabase = {
  users: [],
  artists: [],
  artworks: [],
  nextUserId: 1,
  nextArtistId: 1,
  nextArtworkId: 1
};

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Write fresh database
fs.writeFileSync(DB_PATH, JSON.stringify(freshDatabase, null, 2), 'utf-8');

console.log('✅ Database cleared completely!');
console.log('   All users, artists, and artworks have been removed.');
console.log('   You can now create a new account on the website.');

process.exit(0);

