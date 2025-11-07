import dotenv from 'dotenv';
import { initDatabase } from '../database';
// Switch to Puppeteer scraper for Cloudflare bypass
import { scrapeAllArtists } from '../scraper-puppeteer';

dotenv.config();

async function main() {
  console.log('🚀 Starting manual scrape...\n');
  console.log('⚠️  Note: This script requires a user ID. Use the API endpoints instead.');
  console.log('   Example: POST /api/scrape/all (requires authentication)');
  process.exit(1);
}

main();

