const { contextBridge, ipcRenderer } = require('electron')

// Exponer APIs de forma segura al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Funciones del autoupdater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  
  // Listeners para eventos del autoupdater
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info))
  },
  
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (event, info) => callback(info))
  },
  
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info))
  },
  
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress))
  },
  
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => callback(error))
  },
  
  // Información del sistema
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => process.platform,
  
  // Utilidades
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // Gestión de credenciales seguras
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),
  
  // Auto-inicio
  setAutoStart: (enable) => ipcRenderer.invoke('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  
  // Recarga de la aplicación
  reloadApp: () => ipcRenderer.invoke('reload-app'),
  
  // 🔋 Control de prevención de suspensión (opcional - ya activo por defecto)
  getPowerSaveBlockerStatus: () => ipcRenderer.invoke('get-power-save-blocker-status'),
  
  // 🔐 OAuth: Flujo de autenticación para desktop
  startOAuth: (provider) => ipcRenderer.invoke('start-oauth', provider),
  
  // 🔐 OAuth: Listener para recibir tokens del deep link
  onOAuthCallback: (callback) => {
    ipcRenderer.on('oauth-callback', (event, tokens) => callback(tokens))
  },
  
  // 🔐 OAuth: Remover listener
  removeOAuthCallback: () => {
    ipcRenderer.removeAllListeners('oauth-callback')
  }
})
