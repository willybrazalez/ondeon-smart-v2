import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ondeon.smart',
  appName: 'Ondeon Smart',
  webDir: 'dist',
  server: {
    // Para desarrollo local, descomentar:
    // url: 'http://localhost:5173',
    // cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0e14',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e14'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Ondeon Smart'
  },
  android: {
    backgroundColor: '#0a0e14',
    allowMixedContent: true
  }
};

export default config;
