import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import logger from '@/lib/logger';

/**
 * Componente para manejar actualizaciones automáticas de la aplicación
 */
export const UpdateChecker = () => {
  const [updateStatus, setUpdateStatus] = useState('idle') // idle, checking, available, downloading, ready, error
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const { toast } = useToast()

  // Verificar si estamos en Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  useEffect(() => {
    if (!isElectron) return

    // Escuchar eventos del autoupdater
    const handleUpdateAvailable = (info) => {
      setUpdateStatus('available')
      setUpdateInfo(info)
      toast({
        title: 'Actualización Disponible',
        description: `Nueva versión ${info.version} disponible`,
        duration: 5000
      })
    }

    const handleUpdateDownloaded = (info) => {
      setUpdateStatus('ready')
      setUpdateInfo(info)
      toast({
        title: 'Actualización Lista',
        description: 'La actualización se ha descargado y está lista para instalar',
        duration: 0 // No auto-dismiss
      })
    }

    const handleDownloadProgress = (progress) => {
      setUpdateStatus('downloading')
      setDownloadProgress(progress.percent)
    }

    const handleUpdateError = (error) => {
      setUpdateStatus('error')
      logger.error('Error de actualización:', error)
      toast({
        title: 'Error de Actualización',
        description: 'No se pudo descargar la actualización',
        variant: 'destructive'
      })
    }

    // Registrar listeners (si están disponibles)
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable?.(handleUpdateAvailable)
      window.electronAPI.onUpdateDownloaded?.(handleUpdateDownloaded)
      window.electronAPI.onDownloadProgress?.(handleDownloadProgress)
      window.electronAPI.onUpdateError?.(handleUpdateError)
    }

    return () => {
      // Cleanup listeners si es necesario
    }
  }, [isElectron, toast])

  const checkForUpdates = async () => {
    if (!isElectron) return

    setUpdateStatus('checking')
    try {
      const result = await window.electronAPI?.checkForUpdates?.()
      if (!result) {
        setUpdateStatus('idle')
        toast({
          title: 'Sin Actualizaciones',
          description: 'Ya tienes la versión más reciente',
          duration: 3000
        })
      }
    } catch (error) {
      setUpdateStatus('error')
      logger.error('Error verificando actualizaciones:', error)
    }
  }

  const installUpdate = async () => {
    if (!isElectron) return
    
    try {
      await window.electronAPI?.quitAndInstall?.()
    } catch (error) {
      logger.error('Error instalando actualización:', error)
    }
  }

  // No mostrar nada si no estamos en Electron
  if (!isElectron) return null

  return (
    <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {updateStatus === 'checking' && (
            <>
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-sm font-medium">Verificando actualizaciones...</span>
            </>
          )}
          
          {updateStatus === 'available' && (
            <>
              <Download className="h-5 w-5 text-blue-600" />
              <div>
                <span className="text-sm font-medium">Actualización Disponible</span>
                {updateInfo && (
                  <p className="text-xs text-gray-600">Versión {updateInfo.version}</p>
                )}
              </div>
            </>
          )}
          
          {updateStatus === 'downloading' && (
            <>
              <Download className="h-5 w-5 text-blue-600 animate-pulse" />
              <div>
                <span className="text-sm font-medium">Descargando...</span>
                <p className="text-xs text-gray-600">{downloadProgress.toFixed(1)}%</p>
              </div>
            </>
          )}
          
          {updateStatus === 'ready' && (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <span className="text-sm font-medium">Actualización Lista</span>
                <p className="text-xs text-gray-600">Reinicia para aplicar</p>
              </div>
            </>
          )}
          
          {updateStatus === 'error' && (
            <>
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-600">Error en actualización</span>
            </>
          )}
          
          {updateStatus === 'idle' && (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">Aplicación actualizada</span>
            </>
          )}
        </div>
        
        <div className="flex space-x-2">
          {updateStatus === 'idle' && (
            <Button variant="outline" size="sm" onClick={checkForUpdates}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Verificar
            </Button>
          )}
          
          {updateStatus === 'ready' && (
            <Button size="sm" onClick={installUpdate}>
              Reiniciar e Instalar
            </Button>
          )}
        </div>
      </div>
      
      {updateStatus === 'downloading' && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
    </Card>
  )
}

export default UpdateChecker
