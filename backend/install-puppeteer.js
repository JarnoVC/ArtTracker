// Install Puppeteer browsers in production
// This ensures Chrome is available when deploying to cloud platforms like Render

const { execSync } = require('child_process');
const fs = require('fs');

// Only run in production (Render sets NODE_ENV=production)
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 Installing Puppeteer browsers for production...');
  
  try {
    // Set cache directory for Render
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
    
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      console.log(`   Created cache directory: ${cacheDir}`);
    }
    
    process.env.PUPPETEER_CACHE_DIR = cacheDir;
    console.log(`   Using cache directory: ${cacheDir}`);
    
    // Install Chrome/Chromium for Puppeteer
    console.log('   Downloading Chrome... (this may take a few minutes)');
    execSync('npx puppeteer browsers install chrome', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: cacheDir
      },
      timeout: 600000 // 10 minutes timeout
    });
    
    // Verify installation
    try {
      const result = execSync(`find ${cacheDir} -name "chrome" -type f 2>/dev/null | head -1`, { encoding: 'utf8' }).trim();
      if (result) {
        console.log(`✅ Chrome installed successfully at: ${result}`);
      } else {
        console.warn('⚠️  Chrome installation completed but executable not found');
      }
    } catch (e) {
      console.warn('⚠️  Could not verify Chrome installation');
    }
  } catch (error) {
    const errorMessage = error && error.message ? error.message : String(error);
    console.error('❌ Error installing Puppeteer browsers:', errorMessage);
    console.warn('   Chrome may be downloaded on first use, but this may fail');
    console.warn('   The build will continue - Chrome might be available via system paths');
    // Don't exit - let the build continue, Chrome might be available via system
  }
} else {
  console.log('⏭️  Skipping Puppeteer browser installation (development mode)');
}

