const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')
const path = require('path')
const fs = require('fs')
const http = require('http')
const isDev = process.env.NODE_ENV === 'development'

// 🔧 CRÍTICO: Capturar errores EPIPE globalmente para evitar crashes
// Este error ocurre cuando stdout/stderr se cierra (pipe roto)
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE' || error.message?.includes('EPIPE')) {
    // Ignorar errores EPIPE - no son críticos
    return
  }
  // Para otros errores, mostrar en el log de electron
  log.error('Uncaught Exception:', error)
})

process.stdout?.on('error', (err) => {
  if (err.code === 'EPIPE') return // Ignorar EPIPE
})

process.stderr?.on('error', (err) => {
  if (err.code === 'EPIPE') return // Ignorar EPIPE
})

// 🔧 Usar electron-log en lugar de console para evitar problemas de pipe
const safeLog = (...args) => {
  try {
    if (isDev) {
      console.log(...args)
    }
    log.info(...args)
  } catch (e) {
    // Silenciar errores
  }
}
const safeWarn = (...args) => {
  try {
    if (isDev) {
      console.warn(...args)
    }
    log.warn(...args)
  } catch (e) {}
}
const safeError = (...args) => {
  try {
    if (isDev) {
      console.error(...args)
    }
    log.error(...args)
  } catch (e) {}
}

// 🔐 Servidor HTTP local para OAuth en desarrollo
let oauthServer = null
const OAUTH_SERVER_PORT = 54321 // Puerto fijo para OAuth callback

// ============================================================================
// DEEP LINKS - Protocolo ondeon:// para OAuth
// ============================================================================
const PROTOCOL = 'ondeon'

// Registrar protocolo personalizado para deep links (OAuth callback)
if (process.defaultApp) {
  // En desarrollo, necesitamos pasar la ruta del script
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  // En producción
  app.setAsDefaultProtocolClient(PROTOCOL)
}

// Variable para almacenar deep link pendiente (si la app no estaba abierta)
let pendingDeepLink = null

// Función para procesar deep links de OAuth
function handleOAuthDeepLink(url) {
  log.info('🔐 [DEEP LINK] Recibido:', url)
  log.info('🔐 [DEEP LINK] mainWindow existe:', !!mainWindow)
  
  if (!url || !url.startsWith(`${PROTOCOL}://`)) {
    log.warn('🔐 [DEEP LINK] URL inválida:', url)
    return
  }
  
  try {
    // Parsear la URL: ondeon://auth/callback?access_token=xxx&refresh_token=xxx
    const urlObj = new URL(url)
    log.info('🔐 [DEEP LINK] Pathname:', urlObj.pathname)
    log.info('🔐 [DEEP LINK] Search params:', urlObj.search)
    
    // Reconocer múltiples formatos de URL:
    // - ondeon://auth/callback → host='auth', pathname='/callback'
    // - ondeon://callback → host='callback', pathname='/'
    // - ondeon:///auth/callback → host='', pathname='/auth/callback'
    const isCallbackPath = 
      (urlObj.hostname === 'auth' && urlObj.pathname === '/callback') ||  // ondeon://auth/callback
      urlObj.pathname === '//auth/callback' ||
      urlObj.pathname === '/auth/callback' ||
      urlObj.pathname === '/callback' ||
      urlObj.pathname === '//callback';
    
    log.info('🔐 [DEEP LINK] hostname:', urlObj.hostname, 'isCallbackPath:', isCallbackPath);
    
    if (isCallbackPath) {
      const accessToken = urlObj.searchParams.get('access_token')
      const refreshToken = urlObj.searchParams.get('refresh_token')
      const expiresIn = urlObj.searchParams.get('expires_in')
      const tokenType = urlObj.searchParams.get('token_type')
      
      log.info('🔐 [DEEP LINK] accessToken existe:', !!accessToken)
      log.info('🔐 [DEEP LINK] refreshToken existe:', !!refreshToken)
      
      if (accessToken && refreshToken) {
        log.info('🔐 [DEEP LINK] Tokens extraídos correctamente')
        
        // Enviar tokens al renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          log.info('🔐 [DEEP LINK] Enviando tokens al renderer...')
          mainWindow.webContents.send('oauth-callback', {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: expiresIn ? parseInt(expiresIn) : 3600,
            token_type: tokenType || 'bearer'
          })
          
          // Enfocar la ventana
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
          
          log.info('🔐 [DEEP LINK] Tokens enviados al renderer ✅')
        } else {
          // La ventana no está lista, guardar para después
          pendingDeepLink = { accessToken, refreshToken, expiresIn, tokenType }
          log.info('🔐 [DEEP LINK] Tokens guardados para cuando la ventana esté lista (mainWindow no disponible)')
        }
      } else {
        log.error('🔐 [DEEP LINK] Faltan tokens en la URL - accessToken:', !!accessToken, 'refreshToken:', !!refreshToken)
        log.error('🔐 [DEEP LINK] URL completa:', url)
      }
    } else {
      log.warn('🔐 [DEEP LINK] Ruta no reconocida:', urlObj.pathname)
    }
  } catch (error) {
    log.error('🔐 [DEEP LINK] Error procesando URL:', error)
  }
}

// macOS: Manejar deep links cuando la app ya está abierta
app.on('open-url', (event, url) => {
  event.preventDefault()
  log.info('🔐 [macOS] open-url evento:', url)
  handleOAuthDeepLink(url)
})

// Windows/Linux: Usar single instance lock para manejar deep links
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Otra instancia ya está corriendo, cerrar esta
  app.quit()
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    log.info('🔐 [Windows] Segunda instancia detectada, argv:', argv)
    
    // Buscar deep link en los argumentos
    const deepLink = argv.find(arg => arg.startsWith(`${PROTOCOL}://`))
    if (deepLink) {
      handleOAuthDeepLink(deepLink)
    }
    
    // Enfocar ventana existente (verificar que no esté destruida)
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    } else {
      log.warn('⚠️ Segunda instancia: mainWindow no disponible o destruida, creando nueva ventana...')
      createWindow()
    }
  })
}

// Verificar si la app fue iniciada con un deep link (Windows)
if (process.platform === 'win32') {
  const deepLinkArg = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`))
  if (deepLinkArg) {
    pendingDeepLink = deepLinkArg
    log.info('🔐 [Windows] App iniciada con deep link:', deepLinkArg)
  }
}

// ✅ LOGS VISIBLES EN PRODUCCIÓN (igual que desarrollo)
log.transports.console.level = 'debug'
log.transports.file.level = 'debug'
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log')

// ✅ Conectar autoUpdater con electron-log
autoUpdater.logger = log

if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/../node_modules/electron`)
  });
}

function createWindow() {
  // #region agent log - Electron startup
  const http = require('http');
  const logData = JSON.stringify({location:'main.cjs:createWindow',message:'Electron window creation started',data:{isDev,platform:process.platform,arch:process.arch,nodeVersion:process.version,electronVersion:process.versions.electron},timestamp:Date.now(),sessionId:'debug-session',runId:'production-debug-v1',hypothesisId:'H1'});
  const req = http.request({hostname:'127.0.0.1',port:7242,path:'/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',method:'POST',headers:{'Content-Type':'application/json'}},()=>{});
  req.on('error',()=>{});
  req.write(logData);
  req.end();
  // #endregion
  
  // ✅ SOLUCIÓN: Configurar la sesión para permitir localStorage y conexiones HTTPS
  const { session } = require('electron');
  
  // 🔐 CRÍTICO: Evitar diálogos constantes del Keychain en macOS
  // Configurar certificateVerifyProc para aceptar certificados sin pedir keychain
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    // Para Supabase y otros servicios HTTPS conocidos, confiar automáticamente
    const trustedHosts = [
      'supabase.co',
      'nazlyvhndymalevkfpnl.supabase.co',
      'githubusercontent.com'
    ];
    
    try {
      // Validar que request.url existe y es una URL válida
      if (!request.url || typeof request.url !== 'string') {
        callback(-2); // Usar validación por defecto
        return;
      }
      
      const hostname = new URL(request.url).hostname;
      const isTrusted = trustedHosts.some(host => hostname.includes(host));
      
      if (isTrusted) {
        // Confiar sin validación adicional (evita pedir keychain)
        callback(0); // 0 = success
      } else {
        // Para otros hosts, usar validación por defecto
        callback(-2); // -2 = usar validación por defecto
      }
    } catch (error) {
      // Si hay error parseando la URL, usar validación por defecto
      log.warn('Error parsing URL in certificateVerifyProc:', request.url, error.message);
      callback(-2);
    }
  });
  
  // ✅ CRÍTICO: Deshabilitar CSP completamente para Electron
  // En Electron, CSP puede causar más problemas que beneficios
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Eliminar cualquier CSP existente y permitir todas las conexiones necesarias
    const responseHeaders = { ...details.responseHeaders };
    
    // Eliminar CSP headers que puedan estar bloqueando
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['x-content-security-policy'];
    delete responseHeaders['X-Content-Security-Policy'];
    
    callback({ 
      responseHeaders 
    });
  });

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1280,
      minHeight: 720,
      resizable: true,
      show: false, // No mostrar hasta que esté listo
      autoHideMenuBar: true, // Ocultar la barra de menú automáticamente
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // ✅ CRÍTICO: Deshabilitar webSecurity en Electron (desarrollo Y producción)
      // Es seguro porque es una app de escritorio, no un navegador web
      // Permite WebSockets a Supabase sin restricciones CSP
      webSecurity: false,
      preload: path.join(__dirname, 'preload.cjs'),
      // Configuraciones específicas para Windows
      enableRemoteModule: false,
      experimentalFeatures: false,
      backgroundThrottling: false,
      // ✅ Habilitar almacenamiento local para persistencia en Windows
      partition: 'persist:ondeon',
      // ✅ Permitir carga de recursos locales
      allowRunningInsecureContent: false,
      // ✅ Habilitar APIs web necesarias
      enableWebSQL: false
    }
  })

  // Mostrar ventana cuando esté lista para evitar pantalla en blanco
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log.info('✅ Ventana lista y mostrada');
    
    // 🔐 Enviar deep link pendiente si existe
    if (pendingDeepLink) {
      if (typeof pendingDeepLink === 'string') {
        // Windows: el deep link es una URL string
        handleOAuthDeepLink(pendingDeepLink)
      } else {
        // Ya parseado
        mainWindow.webContents.send('oauth-callback', {
          access_token: pendingDeepLink.accessToken,
          refresh_token: pendingDeepLink.refreshToken,
          expires_in: pendingDeepLink.expiresIn ? parseInt(pendingDeepLink.expiresIn) : 3600,
          token_type: pendingDeepLink.tokenType || 'bearer'
        })
      }
      pendingDeepLink = null
      log.info('🔐 [DEEP LINK] Deep link pendiente procesado')
    }
    
    // 🔋 CRÍTICO: Prevenir que la pantalla se apague mientras la app esté abierta
    // Esto mantiene los WebSockets SIEMPRE activos (sesiones duplicadas, presencia, programaciones)
    const { powerSaveBlocker } = require('electron');
    try {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
      log.info('🔋 Prevención de apagado de pantalla ACTIVADA');
      log.info(`   → Bloqueador ID: ${powerSaveBlockerId}`);
      log.info('   → La pantalla permanecerá encendida mientras la app esté abierta');
      log.info('   → WebSockets SIEMPRE activos: sesiones duplicadas, presencia y programaciones en TIEMPO REAL');
      log.info('   → Garantiza detección instantánea de eventos (sin depender de polling)');
    } catch (error) {
      log.warn('⚠️ No se pudo activar powerSaveBlocker:', error.message);
    }
    
    // 🔍 DevTools: presiona Ctrl+Shift+I dentro de la app para verlos
  });

  // Manejar errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log.error('❌ Error cargando página:', errorCode, errorDescription, validatedURL);
  });

  // Log cuando la página termine de cargar
  mainWindow.webContents.on('did-finish-load', () => {
    log.info('✅ Página cargada completamente');
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // DevTools solo se abrirán manualmente si el usuario lo desea
  } else {
    // ✅ SOLUCIÓN: Los archivos dist/ están desempaquetados con asarUnpack
    // Ruta: app.asar.unpacked/dist/ (junto al app.asar)
    const unpackedPath = path.join(__dirname, '../dist/index.html').replace('app.asar', 'app.asar.unpacked');
    const regularPath = path.join(__dirname, '../dist/index.html');
    
    safeLog('📁 Intentando cargar desde app.asar.unpacked:', unpackedPath);
    safeLog('📂 __dirname:', __dirname);
    safeLog('📂 process.resourcesPath:', process.resourcesPath);
    
    // Verificar primero en app.asar.unpacked (prioridad)
    if (fs.existsSync(unpackedPath)) {
      safeLog('✅ Archivo index.html encontrado en app.asar.unpacked');
      
      mainWindow.loadFile(unpackedPath).then(() => {
        safeLog('✅ Archivo cargado exitosamente desde app.asar.unpacked');
      }).catch((error) => {
        safeError('❌ Error cargando archivo:', error);
      });
    } else if (fs.existsSync(regularPath)) {
      // Fallback: ruta regular dentro del asar
      safeLog('✅ Archivo index.html encontrado en app.asar (ruta regular)');
      
      mainWindow.loadFile(regularPath).then(() => {
        safeLog('✅ Archivo cargado exitosamente desde app.asar');
      }).catch((error) => {
        safeError('❌ Error cargando archivo:', error);
      });
    } else {
      safeError('❌ Archivo index.html no encontrado en ninguna ubicación');
      safeError('   Intentado:', unpackedPath);
      safeError('   Intentado:', regularPath);
    }
  }

  // Detectar si se inició con argumento de startup
  const isStartup = process.argv.includes('--startup');
  if (isStartup) {
    safeLog('🚀 Aplicación iniciada automáticamente con Windows');
  }
}

// Configuración del AutoUpdater
let mainWindow;
let powerSaveBlockerId = null; // ID del bloqueador de suspensión

// Configurar autoupdater
if (!isDev) {
  // ✅ Instalar automáticamente al cerrar si hay actualización pendiente
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Configurar el servidor de actualizaciones (GitHub Releases - Repositorio PÚBLICO)
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ondeon',
    repo: 'ondeon-smart-releases'
  });

  // Helper para enviar logs a DevTools
  const sendLog = (message, type = 'info') => {
    console.log(message);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript(`console.${type}("${message.replace(/"/g, '\\"')}")`);
    }
  };

  // Eventos del autoupdater
  autoUpdater.on('checking-for-update', () => {
    sendLog('🔍 [AUTO-UPDATE] Verificando actualizaciones en GitHub...');
  });

  autoUpdater.on('update-available', (info) => {
    sendLog(`📦 [AUTO-UPDATE] Actualización disponible: ${info.version}`);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Actualización Disponible',
        message: `Se encontró una nueva versión: ${info.version}`,
        detail: 'La actualización se descargará automáticamente.',
        buttons: ['OK']
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    sendLog(`✅ [AUTO-UPDATE] Aplicación actualizada: ${info.version}`);
    // No mostrar diálogo para no molestar al usuario cada vez que abre la app
  });

  autoUpdater.on('error', (err) => {
    sendLog(`❌ [AUTO-UPDATE] Error: ${err.message || String(err)}`, 'error');
    
    // Mostrar error visualmente
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Error de Actualización',
        message: 'Error al verificar actualizaciones',
        detail: `${err.message || String(err)}\n\nRepositorio: ondeon/ondeon-smart-releases`,
        buttons: ['OK']
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = progressObj.percent.toFixed(2);
    sendLog(`📥 [AUTO-UPDATE] Descargando: ${percent}% (${progressObj.transferred}/${progressObj.total})`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendLog(`✅ [AUTO-UPDATE] Actualización descargada: ${info.version} - Reiniciando en 3 segundos...`);
    if (mainWindow) {
      // Mostrar mensaje informativo sin opciones
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Actualización Descargada',
        message: `La versión ${info.version} se ha descargado correctamente.`,
        detail: 'La aplicación se reiniciará automáticamente en 3 segundos para aplicar la actualización.',
        buttons: ['OK']
      }).then(() => {
        // Reiniciar después de 3 segundos
        log.info('🔄 Reiniciando aplicación para aplicar actualización...');
        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 3000);
      });
    } else {
      // Si no hay ventana, reiniciar inmediatamente
      setTimeout(() => {
        autoUpdater.quitAndInstall();
      }, 3000);
    }
  });
}

// Manejar comunicación con el renderer para actualizaciones manuales
ipcMain.handle('check-for-updates', async () => {
  if (!isDev) {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result;
    } catch (error) {
      console.error('Error verificando actualizaciones:', error);
      return null;
    }
  }
  return null;
});

ipcMain.handle('quit-and-install', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
});

// Handlers adicionales para la UI
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

// 🔐 OAuth: Variable para ventana de OAuth (solo en desarrollo)
let oauthWindow = null;

// 🔐 OAuth: Iniciar flujo de autenticación
// ✅ UNIFICADO: Tanto desarrollo como producción usan servidor HTTP local
ipcMain.handle('start-oauth', async (event, provider) => {
  try {
    log.info('🔐 [OAuth] Iniciando flujo para:', provider);
    
    // ✅ SIEMPRE usar servidor HTTP local (mismo flujo en dev y prod)
    {
      // Usar servidor HTTP local para recibir tokens
      log.info('🔐 [OAuth] Iniciando servidor local para OAuth');
      
      // Crear servidor HTTP temporal para recibir el callback
      if (oauthServer) {
        try { oauthServer.close(); } catch (e) {}
      }
      
      return new Promise((resolve) => {
        oauthServer = http.createServer((req, res) => {
          const url = new URL(req.url, `http://localhost:${OAUTH_SERVER_PORT}`);
          
          log.info('🔐 [OAuth Server] Request:', url.pathname);
          
          // Ruta principal de callback - Supabase redirige aquí con tokens en el HASH
          // El hash no llega al servidor, así que servimos una página que lo extrae
          if (url.pathname === '/callback') {
            log.info('🔐 [OAuth Server] Sirviendo página extractora de tokens...');
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html lang="es">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Ondeón</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: 'Quicksand', -apple-system, sans-serif; 
                    background: #262626;
                    color: #fafafa; 
                    min-height: 100vh;
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                  }
                  .container {
                    text-align: center;
                    padding: 40px 24px;
                    max-width: 380px;
                  }
                  .logo {
                    width: 64px;
                    height: 64px;
                    margin: 0 auto 32px;
                    border-radius: 16px;
                  }
                  .spinner {
                    width: 32px;
                    height: 32px;
                    border: 2px solid #333;
                    border-top-color: #ccc;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 20px;
                  }
                  @keyframes spin { to { transform: rotate(360deg); } }
                  h1 { 
                    font-size: 22px; 
                    font-weight: 600; 
                    margin-bottom: 8px;
                    color: #fafafa;
                  }
                  p { 
                    color: #a3a3a3; 
                    font-size: 14px;
                    line-height: 1.5;
                    font-weight: 500;
                  }
                  .check {
                    width: 48px;
                    height: 48px;
                    border: 2px solid #22c55e;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    color: #22c55e;
                    font-size: 24px;
                  }
                  .error-icon {
                    width: 48px;
                    height: 48px;
                    border: 2px solid #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    color: #ef4444;
                    font-size: 24px;
                  }
                  .hidden { display: none !important; }
                  .hint {
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid #333;
                    color: #737373;
                    font-size: 12px;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <img src="https://main.dnpo8nagdov1i.amplifyapp.com/assets/icono-ondeon.png" alt="Ondeón" class="logo" onerror="this.style.display='none'">
                  
                  <div id="loading">
                    <div class="spinner"></div>
                    <h1>Verificando</h1>
                    <p>Un momento...</p>
                  </div>
                  
                  <div id="success" class="hidden">
                    <div class="check">✓</div>
                    <h1>Listo</h1>
                    <p>Vuelve a la aplicación Ondeón</p>
                    <p class="hint">Puedes cerrar esta pestaña</p>
                  </div>
                  
                  <div id="error" class="hidden">
                    <div class="error-icon">✕</div>
                    <h1>Error</h1>
                    <p id="errorMessage">No se pudo completar la autenticación</p>
                  </div>
                </div>
                
                <script>
                  function showState(state) {
                    document.getElementById('loading').classList.add('hidden');
                    document.getElementById('success').classList.add('hidden');
                    document.getElementById('error').classList.add('hidden');
                    document.getElementById(state).classList.remove('hidden');
                  }
                  
                  const hash = window.location.hash.substring(1);
                  const params = new URLSearchParams(hash);
                  const accessToken = params.get('access_token');
                  const refreshToken = params.get('refresh_token');
                  
                  if (accessToken && refreshToken) {
                    fetch('/tokens', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        showState('success');
                        // Intentar abrir deep link - el navegador preguntará si abrir la app
                        setTimeout(() => {
                          window.location.href = 'ondeon://auth/success';
                        }, 500);
                      } else {
                        throw new Error(data.error || 'Error');
                      }
                    })
                    .catch(err => {
                      document.getElementById('errorMessage').textContent = err.message;
                      showState('error');
                    });
                  } else {
                    document.getElementById('errorMessage').textContent = 'Tokens no encontrados';
                    showState('error');
                  }
                </script>
              </body>
              </html>
            `);
            return;
          }
          
          // Ruta para recibir tokens via POST desde el JavaScript del navegador
          if (url.pathname === '/tokens' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const tokens = JSON.parse(body);
                log.info('🔐 [OAuth Server] Tokens recibidos via POST!');
                
                // Enviar tokens al renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('oauth-callback', {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_in: 3600,
                    token_type: 'bearer'
                  });
                  mainWindow.focus();
                  log.info('🔐 [OAuth Server] Tokens enviados al renderer ✅');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                
                // Cerrar servidor después de un momento
                setTimeout(() => {
                  try { oauthServer.close(); oauthServer = null; } catch (e) {}
                }, 2000);
                
              } catch (err) {
                log.error('🔐 [OAuth Server] Error parseando tokens:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
          
          // 404 para otras rutas
          res.writeHead(404);
          res.end('Not found');
        });
        
        oauthServer.listen(OAUTH_SERVER_PORT, '127.0.0.1', () => {
          log.info('🔐 [OAuth Server] Escuchando en puerto', OAUTH_SERVER_PORT);
          
          // Abrir navegador con OAuth
          // El redirectTo apunta al servidor local
          const SUPABASE_URL = 'https://nazlyvhndymalevkfpnl.supabase.co';
          const redirectUrl = `http://localhost:${OAUTH_SERVER_PORT}/callback`;
          // prompt=select_account fuerza a Google a mostrar selector de cuentas
          const oauthUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}&prompt=select_account`;
          
          log.info('🔐 [OAuth] Abriendo navegador:', oauthUrl);
          shell.openExternal(oauthUrl);
          
          resolve({ success: true });
        });
        
        oauthServer.on('error', (err) => {
          log.error('🔐 [OAuth Server] Error:', err);
          resolve({ success: false, error: err.message });
        });
        
        // Timeout después de 5 minutos
        setTimeout(() => {
          if (oauthServer) {
            try { oauthServer.close(); oauthServer = null; } catch (e) {}
          }
        }, 300000);
      });
    }
  } catch (error) {
    log.error('🔐 [OAuth] Error:', error);
    return { success: false, error: error.message };
  }
});

// 🔐 OAuth: Función para manejar redirecciones OAuth en desarrollo
function handleOAuthRedirectInDev(url) {
  // Buscar tokens en la URL (pueden estar en hash o query params)
  if (url.includes('access_token=') || url.includes('#access_token=')) {
    log.info('🔐 [OAuth Dev] Tokens detectados en URL');
    
    try {
      // Los tokens pueden venir en el hash (#) o como query params (?)
      let tokenString = '';
      if (url.includes('#')) {
        tokenString = url.split('#')[1];
      } else if (url.includes('?')) {
        tokenString = url.split('?')[1];
      }
      
      const params = new URLSearchParams(tokenString);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresIn = params.get('expires_in');
      const tokenType = params.get('token_type');
      
      if (accessToken && refreshToken) {
        log.info('🔐 [OAuth Dev] Tokens extraídos correctamente');
        
        // Enviar tokens al renderer principal
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth-callback', {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: expiresIn ? parseInt(expiresIn) : 3600,
            token_type: tokenType || 'bearer'
          });
          mainWindow.focus();
          log.info('🔐 [OAuth Dev] Tokens enviados al renderer ✅');
        }
        
        // Cerrar ventana de OAuth
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close();
        }
      }
    } catch (error) {
      log.error('🔐 [OAuth Dev] Error extrayendo tokens:', error);
    }
  }
}

ipcMain.handle('show-message-box', async (event, options) => {
  if (mainWindow) {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  }
  return null;
});

// Gestión segura de credenciales
const credentialsPath = path.join(app.getPath('userData'), 'credentials.enc');

ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      safeWarn('⚠️ Encriptación no disponible, guardando en localStorage');
      return false;
    }
    
    const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
    fs.writeFileSync(credentialsPath, encrypted);
    safeLog('✅ Credenciales guardadas de forma segura');
    return true;
  } catch (error) {
    safeError('❌ Error guardando credenciales:', error);
    return false;
  }
});

ipcMain.handle('get-credentials', async () => {
  try {
    if (!fs.existsSync(credentialsPath)) {
      return null;
    }
    
    if (!safeStorage.isEncryptionAvailable()) {
      safeWarn('⚠️ Encriptación no disponible');
      return null;
    }
    
    const encrypted = fs.readFileSync(credentialsPath);
    const decrypted = safeStorage.decryptString(encrypted);
    safeLog('✅ Credenciales recuperadas');
    return JSON.parse(decrypted);
  } catch (error) {
    safeError('❌ Error recuperando credenciales:', error);
    return null;
  }
});

ipcMain.handle('delete-credentials', async () => {
  try {
    if (fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
      safeLog('✅ Credenciales eliminadas');
    }
    return true;
  } catch (error) {
    safeError('❌ Error eliminando credenciales:', error);
    return false;
  }
});

// Auto-inicio
ipcMain.handle('set-auto-start', async (event, enable) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: false,
      path: process.execPath,
      args: enable ? ['--startup'] : []
    });
    safeLog(`✅ Auto-inicio ${enable ? 'activado' : 'desactivado'}`);
    return true;
  } catch (error) {
    safeError('❌ Error configurando auto-inicio:', error);
    return false;
  }
});

ipcMain.handle('get-auto-start', async () => {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch (error) {
    safeError('❌ Error obteniendo configuración auto-inicio:', error);
    return false;
  }
});

// ✅ Recargar la aplicación (para logout limpio)
ipcMain.handle('reload-app', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      log.info('🔄 Recargando aplicación tras logout...');
      mainWindow.reload();
      return true;
    }
    return false;
  } catch (error) {
    log.error('❌ Error recargando aplicación:', error);
    return false;
  }
});

// 🔋 Obtener estado de prevención de suspensión
ipcMain.handle('get-power-save-blocker-status', async () => {
  try {
    const { powerSaveBlocker } = require('electron');
    const isActive = powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId);
    return {
      active: isActive,
      blockerId: powerSaveBlockerId
    };
  } catch (error) {
    log.error('❌ Error obteniendo estado de power save blocker:', error);
    return { active: false, blockerId: null };
  }
});

app.whenReady().then(() => {
  // Configurar auto-inicio en Windows basado en el registro del instalador
  if (process.platform === 'win32') {
    // Verificar si el usuario seleccionó auto-inicio durante la instalación
    const { app: electronApp } = require('electron');
    const { execSync } = require('child_process');
    
    try {
      // Leer el registro de Windows para ver si el auto-inicio está configurado
      const regPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
      const regValue = 'Ondeon Smart';
      
      // Verificar si existe la entrada en el registro
      const result = execSync(`reg query "${regPath}" /v "${regValue}"`, { encoding: 'utf8' });
      
      if (result.includes(regValue)) {
        // El usuario seleccionó auto-inicio durante la instalación
        safeLog('✅ Auto-inicio configurado por el instalador');
        app.setLoginItemSettings({
          openAtLogin: true,
          openAsHidden: false,
          path: process.execPath,
          args: ['--startup']
        });
      } else {
        // El usuario NO seleccionó auto-inicio durante la instalación
        safeLog('ℹ️ Auto-inicio NO configurado por el instalador');
        app.setLoginItemSettings({
          openAtLogin: false,
          openAsHidden: false
        });
      }
    } catch (error) {
      // Si hay error leyendo el registro, no configurar auto-inicio
      safeLog('⚠️ No se pudo leer configuración del registro, auto-inicio desactivado');
      app.setLoginItemSettings({
        openAtLogin: false,
        openAsHidden: false
      });
    }
  }

  // Forzar User-Agent completo para todas las peticiones (crítico para Supabase)
  const ses = require('electron').session;
  ses.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // ✅ User-Agent completo y realista para evitar bloqueos de Supabase
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
  
  // ✅ CRÍTICO: Interceptar peticiones de assets para corregir rutas absolutas
  // Esto permite que /assets/... funcione correctamente en producción
  if (!isDev) {
    const { protocol } = require('electron');
    protocol.interceptFileProtocol('file', (request, callback) => {
      let url = request.url.substr(7); // Quitar 'file://'
      
      // Normalizar la URL (decodificar caracteres especiales)
      url = decodeURIComponent(url);
      
      // Si la petición contiene /assets/, redirigir a app.asar.unpacked
      if (url.includes('/assets/') || url.includes('/models/')) {
        // Extraer solo la parte de /assets/... o /models/...
        let assetPath;
        if (url.includes('/assets/')) {
          const assetsIndex = url.indexOf('/assets/');
          assetPath = url.substring(assetsIndex);
        } else if (url.includes('/models/')) {
          const modelsIndex = url.indexOf('/models/');
          assetPath = url.substring(modelsIndex);
        }
        
        // Ruta correcta en app.asar.unpacked
        const basePath = __dirname.replace('app.asar', 'app.asar.unpacked');
        const correctPath = path.join(basePath, '..', 'dist', assetPath);
        console.log('🔗 Interceptando asset:', assetPath, '→', correctPath);
        callback({ path: correctPath });
      } else {
        // Para otros archivos, usar la ruta tal cual
        callback({ path: path.normalize(url) });
      }
    });
  }
  
  createWindow()

  // ✅ CRÍTICO: Verificar actualizaciones automáticamente al iniciar
  if (!isDev) {
    // Esperar 5 segundos después de abrir la ventana para verificar actualizaciones
    setTimeout(() => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(`
          console.log('%c🔄 [AUTO-UPDATE] Iniciando verificación de actualizaciones...', 'color: #4CAF50; font-weight: bold');
          console.log('%c📍 [AUTO-UPDATE] Versión actual: ${app.getVersion()}', 'color: #2196F3');
          console.log('%c📍 [AUTO-UPDATE] Repositorio: ondeon/ondeon-smart-releases (público)', 'color: #2196F3');
        `);
      }
      
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        if (mainWindow && mainWindow.webContents) {
          const errorMsg = (err.message || String(err)).replace(/"/g, '\\"').replace(/\n/g, '\\n');
          mainWindow.webContents.executeJavaScript(`
            console.error('%c❌ [AUTO-UPDATE] Error al verificar: ${errorMsg}', 'color: #f44336; font-weight: bold');
          `);
        }
      });
    }, 5000);
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  // 🔋 Detener prevención de suspensión al cerrar la app
  if (powerSaveBlockerId !== null) {
    const { powerSaveBlocker } = require('electron');
    if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      log.info('🔋 Prevención de suspensión DESACTIVADA - sistema puede dormir normalmente');
    }
    powerSaveBlockerId = null;
  }
  
  if (process.platform !== 'darwin') app.quit()
}) 