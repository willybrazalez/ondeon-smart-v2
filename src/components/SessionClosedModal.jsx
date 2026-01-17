/**
 * SessionClosedModal - Modal que se muestra cuando la sesión fue cerrada en otro dispositivo
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

export default function SessionClosedModal({ isOpen }) {
  const { signOut } = useAuth();
  const isClosingRef = useRef(false);
  const [countdown, setCountdown] = useState(5);

  const handleClose = async () => {
    // Prevenir múltiples ejecuciones
    if (isClosingRef.current) {
      logger.warn('⏭️ Ya se está cerrando la sesión, ignorando...');
      return;
    }

    isClosingRef.current = true;
    logger.warn('🔄 Cerrando sesión por detección de inicio en otro dispositivo...');
    
    try {
      // 1. DETENER el audio PRIMERO
      if (window.autoDjInstance) {
        logger.warn('⏹️ Deteniendo reproducción...');
        try {
          await window.autoDjInstance.stop();
        } catch (err) {
          logger.error('❌ Error deteniendo audio:', err);
        }
      }
      
      // 2. Hacer logout completo
      await signOut();
      
      // 3. Forzar recarga completa - Compatible con Electron y navegador web
      logger.warn('🔄 Forzando recarga completa...');
      
      // ✅ En Electron: usar IPC para recargar desde el proceso principal
      if (window.electronAPI?.reloadApp) {
        logger.warn('🔄 Recargando aplicación Electron...');
        setTimeout(() => {
          window.electronAPI.reloadApp();
        }, 300);
      } else {
        // ✅ En navegador web: redireccionar con router
        window.location.href = '/login';
      }
    } catch (error) {
      logger.error('❌ Error al cerrar sesión:', error);
      // Forzar recarga de todos modos
      if (window.electronAPI?.reloadApp) {
        setTimeout(() => {
          window.electronAPI.reloadApp();
        }, 300);
      } else {
        window.location.href = '/login';
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      logger.warn('🚫 Mostrando modal de sesión cerrada');
      isClosingRef.current = false;
      setCountdown(5);
      
      // Cuenta regresiva
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Auto-cerrar después de 5 segundos
      const closeTimer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => {
        clearInterval(countdownInterval);
        clearTimeout(closeTimer);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-card dark:bg-gray-800 rounded-lg shadow-2xl p-6 sm:p-8 max-w-md mx-4 animate-scale-in">
        {/* Icono */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-yellow-600 dark:text-yellow-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
        </div>

        {/* Título */}
        <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-900 dark:text-white mb-3">
          Sesión Cerrada
        </h2>

        {/* Mensaje */}
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.
        </p>

        {/* Cuenta regresiva */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {countdown}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirigiendo al inicio de sesión...
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

