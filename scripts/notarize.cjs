const { notarize } = require('@electron/notarize');
const path = require('path');

async function packageTask() {
  // Package app here, and code sign with hardened runtime
  console.log('Starting notarization process...');
  
  const appPath = path.join(__dirname, '..', 'release', 'mac', 'Ondeon Smart.app');
  
  try {
    await notarize({
      tool: 'notarytool',
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    
    console.log('✅ Notarization completed successfully!');
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  packageTask();
}

module.exports = packageTask;
