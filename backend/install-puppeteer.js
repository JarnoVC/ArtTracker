// Install Puppeteer browsers in production
// This ensures Chrome is available when deploying to cloud platforms like Render

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Only run in production (Render sets NODE_ENV=production)
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 Installing Puppeteer browsers for production...');
  
  try {
    // Set cache directory for Render
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer';
    
    // Ensure cache directory exists with proper permissions
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true, mode: 0o755 });
      console.log(`   📁 Created cache directory: ${cacheDir}`);
    }
    
    // Verify write permissions
    try {
      fs.accessSync(cacheDir, fs.constants.W_OK);
      console.log(`   ✅ Cache directory is writable: ${cacheDir}`);
    } catch (e) {
      console.warn(`   ⚠️  Cache directory may not be writable: ${cacheDir}`);
    }
    
    // Set environment variables for Puppeteer
    process.env.PUPPETEER_CACHE_DIR = cacheDir;
    process.env.PUPPETEER_DOWNLOAD_PATH = cacheDir;
    console.log(`   📂 Using cache directory: ${cacheDir}`);
    
    // Install Chrome/Chromium for Puppeteer
    console.log('   📥 Downloading Chrome... (this may take 3-5 minutes)');
    console.log('   ⏳ Please wait, this is a one-time setup...');
    
    execSync('npx puppeteer browsers install chrome', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: cacheDir,
        PUPPETEER_DOWNLOAD_PATH: cacheDir,
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'false'
      },
      timeout: 600000 // 10 minutes timeout
    });
    
    // Verify installation by checking multiple possible locations
    console.log('   🔍 Verifying Chrome installation...');
    let chromeFound = false;
    
    // Method 1: Use find command
    try {
      const result = execSync(
        `find "${cacheDir}" -type f -name "chrome" -executable 2>/dev/null | head -1`,
        { encoding: 'utf8', timeout: 10000 }
      ).trim();
      if (result && fs.existsSync(result)) {
        console.log(`   ✅ Chrome found at: ${result}`);
        chromeFound = true;
      }
    } catch (e) {
      // find failed, try other methods
    }
    
    // Method 2: Check Puppeteer cache structure
    if (!chromeFound) {
      try {
        const chromeCacheDir = path.join(cacheDir, 'chrome');
        if (fs.existsSync(chromeCacheDir)) {
          const entries = fs.readdirSync(chromeCacheDir);
          for (const entry of entries) {
            const platformDir = path.join(chromeCacheDir, entry);
            if (fs.statSync(platformDir).isDirectory()) {
              const subEntries = fs.readdirSync(platformDir);
              for (const subEntry of subEntries) {
                if (subEntry.startsWith('chrome-')) {
                  const chromeDir = path.join(platformDir, subEntry);
                  const chromeExe = path.join(chromeDir, 'chrome');
                  if (fs.existsSync(chromeExe)) {
                    console.log(`   ✅ Chrome found in cache structure: ${chromeExe}`);
                    chromeFound = true;
                    break;
                  }
                }
              }
              if (chromeFound) break;
            }
          }
        }
      } catch (e) {
        // Directory structure check failed
      }
    }
    
    if (chromeFound) {
      console.log('   ✅ Chrome installation verified successfully!');
    } else {
      console.warn('   ⚠️  Chrome installation completed but executable not found in expected location');
      console.warn('   💡 Chrome may still work if Puppeteer can locate it at runtime');
    }
  } catch (error) {
    const errorMessage = error && error.message ? error.message : String(error);
    console.error('   ❌ Error installing Puppeteer browsers:', errorMessage);
    console.error('   ⚠️  Build will continue, but Chrome may not be available at runtime');
    console.error('   💡 You may need to install Chrome manually or check disk space');
    // Don't exit - let the build continue
    process.exitCode = 0; // Ensure build doesn't fail
  }
} else {
  console.log('⏭️  Skipping Puppeteer browser installation (development mode)');
  console.log('   💡 Chrome will be downloaded automatically when needed');
}

