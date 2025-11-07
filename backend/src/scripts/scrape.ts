import dotenv from 'dotenv';
import { initDatabase } from '../database';
// Switch to Puppeteer scraper for Cloudflare bypass
import { scrapeAllArtists } from '../scraper-puppeteer';

dotenv.config();

async function main() {
  console.log('🚀 Starting manual scrape...\n');
  
  initDatabase();
  
  try {
    const results = await scrapeAllArtists();
    
    console.log('\n✅ Scraping complete!');
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  }
}

main();

