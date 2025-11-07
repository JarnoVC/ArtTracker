// Install Puppeteer browsers in production
// This ensures Chrome is available when deploying to cloud platforms like Render

const { execSync } = require('child_process');

// Only run in production (Render sets NODE_ENV=production)
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 Installing Puppeteer browsers for production...');
  
  try {
    // Set cache directory for Render
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
    process.env.PUPPETEER_CACHE_DIR = cacheDir;
    
    console.log(`   Cache directory: ${cacheDir}`);
    
    // Install Chrome/Chromium for Puppeteer
    execSync('npx puppeteer browsers install chrome', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: cacheDir
      }
    });
    console.log('✅ Puppeteer browsers installed successfully');
  } catch (error) {
    console.warn('⚠️  Warning: Failed to install Puppeteer browsers:', error.message);
    console.warn('   Chrome will be downloaded on first use');
  }
} else {
  console.log('⏭️  Skipping Puppeteer browser installation (development mode)');
}

