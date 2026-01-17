/**
 * afterPack hook for electron-builder
 * Clears extended attributes from ALL files AND directories
 */
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  if (process.platform !== 'darwin' || context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = context.appOutDir;
  const appName = context.packager.appInfo.productFilename;
  const appFullPath = path.join(appPath, `${appName}.app`);
  
  console.log(`[afterPack] Starting cleanup for: ${appFullPath}`);
  
  try {
    // Step 1: Run dot_clean
    console.log('[afterPack] Step 1: Running dot_clean...');
    execSync(`dot_clean "${appFullPath}"`, { stdio: 'inherit' });
    
    // Step 2: Clear xattr from entire bundle (files AND directories)
    console.log('[afterPack] Step 2: Clearing xattr from entire bundle...');
    execSync(`xattr -cr "${appFullPath}"`, { stdio: 'inherit' });
    
    // Step 3: CRITICAL - Clear xattr from all .app directories specifically
    console.log('[afterPack] Step 3: Clearing xattr from all .app directories...');
    const findResult = execSync(`find "${appFullPath}" -name "*.app" -type d`, { encoding: 'utf8' });
    const appDirs = findResult.trim().split('\n').filter(d => d);
    
    for (const appDir of appDirs) {
      console.log(`[afterPack] Cleaning .app directory: ${path.basename(appDir)}`);
      // Clear xattr from the directory itself
      execSync(`xattr -c "${appDir}"`, { stdio: 'inherit' });
      // Also clear from all contents
      execSync(`xattr -cr "${appDir}"`, { stdio: 'inherit' });
    }
    
    // Step 4: Clear xattr from all directories recursively
    console.log('[afterPack] Step 4: Clearing xattr from ALL directories...');
    execSync(`find "${appFullPath}" -type d -exec xattr -c {} \\; 2>/dev/null || true`, { stdio: 'inherit' });
    
    // Step 5: Clear xattr from all files
    console.log('[afterPack] Step 5: Clearing xattr from ALL files...');
    execSync(`find "${appFullPath}" -type f -exec xattr -c {} \\; 2>/dev/null || true`, { stdio: 'inherit' });
    
    // Step 6: Remove ._ files
    console.log('[afterPack] Step 6: Removing ._ files...');
    execSync(`find "${appFullPath}" -name '._*' -delete 2>/dev/null || true`, { stdio: 'inherit' });
    
    // Step 7: Final pass on the entire bundle
    console.log('[afterPack] Step 7: Final xattr cleanup...');
    execSync(`xattr -cr "${appFullPath}"`, { stdio: 'inherit' });
    
    // Step 8: Verify GPU Helper .app directory is clean
    const gpuHelperApp = path.join(appFullPath, 'Contents/Frameworks/Ondeon-Smart Helper (GPU).app');
    if (fs.existsSync(gpuHelperApp)) {
      console.log('[afterPack] Step 8: Verifying GPU Helper .app directory...');
      
      // Clear it one more time to be sure
      execSync(`xattr -c "${gpuHelperApp}"`, { stdio: 'inherit' });
      
      const xattrResult = spawnSync('xattr', [gpuHelperApp], { encoding: 'utf8' });
      if (xattrResult.stdout.trim()) {
        console.log(`[afterPack] WARNING: GPU Helper .app still has xattrs: ${xattrResult.stdout}`);
        // Force remove specific problematic attributes
        execSync(`xattr -d com.apple.FinderInfo "${gpuHelperApp}" 2>/dev/null || true`, { stdio: 'inherit' });
        execSync(`xattr -d com.apple.fileprovider.fpfs#P "${gpuHelperApp}" 2>/dev/null || true`, { stdio: 'inherit' });
      } else {
        console.log('[afterPack] GPU Helper .app directory is CLEAN');
      }
    }
    
    console.log('[afterPack] Cleanup completed successfully');
  } catch (error) {
    console.error('[afterPack] Error:', error.message);
  }
};
