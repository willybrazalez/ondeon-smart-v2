import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ondeon.smart',
  appName: 'Ondeon Smart',
  webDir: 'dist',
  server: {
    // Para LIVE RELOAD: descomentar url y ejecutar npm run dev en otra terminal
    // url: 'http://localhost:5173',
    cleartext: true,
    androidScheme: 'https',
    // Hostname para asociar la app con el dominio (necesario para AutoFill de contraseñas)
    hostname: 'app.ondeon.es'
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
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'ondeon-smart',
    backgroundColor: '#0a0e14',
    webContentsDebuggingEnabled: true
  },
  android: {
    backgroundColor: '#0a0e14',
    allowMixedContent: true
  }
};

export default config;
