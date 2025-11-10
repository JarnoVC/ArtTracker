// Install Puppeteer browsers in production
// NOTE: On Render free tier, Chrome installation during build may timeout.
// This script skips Chrome installation during build to avoid timeouts.
// Chrome will be installed at runtime on first use instead.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Only run in production (Render sets NODE_ENV=production)
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 Checking Chrome availability...');
  
  // Set cache directory for Render
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
  
  // Ensure cache directory exists
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true, mode: 0o755 });
      console.log(`   📁 Created cache directory: ${cacheDir}`);
    }
  } catch (e) {
    console.warn(`   ⚠️  Could not create cache directory: ${cacheDir}`);
  }
  
  // Check if system Chrome is available (fastest option)
  const systemChromes = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];
  
  let systemChromeFound = false;
  for (const chromePath of systemChromes) {
    try {
      if (fs.existsSync(chromePath)) {
        console.log(`   ✅ System Chrome found at: ${chromePath}`);
        systemChromeFound = true;
        break;
      }
    } catch (e) {
      // Continue checking
    }
  }
  
  // Check if Chrome is already installed in cache
  let cachedChromeFound = false;
  if (!systemChromeFound) {
    try {
      const chromeCacheDir = path.join(cacheDir, 'chrome');
      if (fs.existsSync(chromeCacheDir)) {
        // Quick check if Chrome exists in cache
        const result = execSync(
          `find "${cacheDir}" -type f -name "chrome" -executable 2>/dev/null | head -1`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        if (result && fs.existsSync(result)) {
          console.log(`   ✅ Cached Chrome found at: ${result}`);
          cachedChromeFound = true;
        }
      }
    } catch (e) {
      // No cached Chrome found - that's okay
    }
  }
  
  if (systemChromeFound || cachedChromeFound) {
    console.log('   ✅ Chrome is available for use');
    console.log('   💡 Chrome will be used at runtime');
  } else {
    console.log('   ⚠️  Chrome not found during build');
    console.log('   💡 Chrome will be installed at runtime on first use');
    console.log('   📝 This is expected on Render free tier to avoid build timeouts');
  }
  
  // Don't install Chrome during build to avoid timeouts
  // Chrome will be installed at runtime when needed
  console.log('   ✅ Build can continue - Chrome installation skipped');
  
} else {
  console.log('⏭️  Skipping Chrome check (development mode)');
  console.log('   💡 Chrome will be downloaded automatically when needed');
}

