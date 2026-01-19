import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ondeon.smart',
  appName: 'Ondeon Smart',
  webDir: 'dist',
  server: {
    // LIVE RELOAD ACTIVADO - Comentar para producción
    url: 'http://localhost:5173',
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#0a0e14',
      showSpinner: true,
      spinnerColor: '#A2D9F7',
      spinnerStyle: 'small',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
      // iOS específico
      iosSpinnerStyle: 'small',
    },
    StatusBar: {
      style: 'Dark',
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
    scheme: 'ondeon-smart',
    backgroundColor: '#0a0e14',
    // WebView con fondo oscuro
    webContentsDebuggingEnabled: true
  },
  android: {
    backgroundColor: '#0a0e14',
    allowMixedContent: true
  }
};

export default config;
