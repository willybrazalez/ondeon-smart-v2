import { useState, useEffect } from 'react'
import logger from '../lib/logger.js';

/**
 * Hook para manejar credenciales de forma segura en Electron
 */
export const useElectronCredentials = () => {
  const [isElectron, setIsElectron] = useState(false)
  const [autoStart, setAutoStart] = useState(false)

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
  }, [])

  // Guardar credenciales de forma segura
  const saveCredentials = async (username, password) => {
    logger.dev('🔧 saveCredentials llamado con:', { username, hasPassword: !!password, isElectron })

    // 1) Siempre persistir en localStorage como copia de seguridad
    try {
      localStorage.setItem('ondeon_saved_credentials', JSON.stringify({ username, password }))
      logger.dev('💾 Guardado en localStorage (siempre)')
    } catch (e) {
      logger.warn('⚠️ No se pudo guardar en localStorage:', e)
    }

    // 2) Si Electron está disponible en runtime, intentar guardar también allí
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null
    if (electronAPI) {
      try {
        logger.dev('💾 Intentando guardar con Electron API...')
        const success = await electronAPI.saveCredentials({ username, password })
        logger.dev('💾 Resultado Electron API:', success)
      } catch (error) {
        logger.error('❌ Error guardando credenciales en Electron:', error)
      }
    }

    return true
  }

  // Recuperar credenciales
  const getCredentials = async () => {
    logger.dev('🔍 getCredentials llamado (detección runtime)')

    // Intentar primero con Electron si está disponible
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null
    if (electronAPI) {
      try {
        const credentials = await electronAPI.getCredentials()
        if (credentials && (credentials.username || credentials.password)) {
          // Sincronizar copia en localStorage para pantallas que no vean Electron
          try {
            localStorage.setItem('ondeon_saved_credentials', JSON.stringify(credentials))
          } catch {}
          logger.dev('🔍 Credenciales obtenidas desde Electron y sincronizadas con localStorage')
          return credentials
        }
      } catch (error) {
        logger.warn('⚠️ Error obteniendo credenciales desde Electron, se usará localStorage:', error)
      }
    }

    // Fallback robusto a localStorage
    try {
      const saved = localStorage.getItem('ondeon_saved_credentials')
      const parsed = saved ? JSON.parse(saved) : null
      logger.dev('🔍 Credenciales desde localStorage:', parsed)
      return parsed
    } catch (e) {
      logger.error('❌ Error leyendo localStorage:', e)
      return null
    }
  }

  // Eliminar credenciales
  const deleteCredentials = async () => {
    // Borrar SIEMPRE la copia de localStorage
    try { localStorage.removeItem('ondeon_saved_credentials') } catch {}

    // Intentar también borrar en Electron si está disponible
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null
    if (electronAPI) {
      try {
        await electronAPI.deleteCredentials()
      } catch (error) {
        logger.error('Error eliminando credenciales en Electron:', error)
        // No consideramos esto fatal
      }
    }
    return true
  }

  // Configurar auto-inicio
  const setAutoStartEnabled = async (enabled) => {
    if (!isElectron) return false

    try {
      const success = await window.electronAPI.setAutoStart(enabled)
      if (success) {
        setAutoStart(enabled)
      }
      return success
    } catch (error) {
      logger.error('Error configurando auto-inicio:', error)
      return false
    }
  }

  // Obtener estado de auto-inicio
  const getAutoStartEnabled = async () => {
    if (!isElectron) return false

    try {
      const enabled = await window.electronAPI.getAutoStart()
      setAutoStart(enabled)
      return enabled
    } catch (error) {
      logger.error('Error obteniendo auto-inicio:', error)
      return false
    }
  }

  return {
    isElectron,
    autoStart,
    saveCredentials,
    getCredentials,
    deleteCredentials,
    setAutoStartEnabled,
    getAutoStartEnabled
  }
}

export default useElectronCredentials
