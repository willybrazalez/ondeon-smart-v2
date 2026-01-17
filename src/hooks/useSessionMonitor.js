/**
 * useSessionMonitor - Hook para detectar cuando la sesión fue cerrada en otro dispositivo
 * Monitorea cambios en user_current_state para detectar desconexiones forzadas
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

export function useSessionMonitor(userId, deviceId, isActive = true) {
  const [sessionClosed, setSessionClosed] = useState(false);
  const [closedReason, setClosedReason] = useState(null);

  const handleSessionClosed = useCallback(() => {
    logger.warn('🚫 Sesión cerrada detectada - Usuario conectado en otro dispositivo');
    setSessionClosed(true);
    setClosedReason('new_login_detected');
  }, []);

  useEffect(() => {
    if (!userId || !deviceId || !isActive) {
      return;
    }

    let subscription = null;
    let checkInterval = null;

    const setupMonitoring = async () => {
      logger.dev('👁️ Iniciando monitoreo de sesión única para:', { userId, deviceId });

      // ============================================================
      // MÉTODO 1: Suscripción a cambios en user_current_state
      // ============================================================
      try {
        subscription = supabase
          .channel(`session_monitor_${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_current_state',
              filter: `usuario_id=eq.${userId}`
            },
            (payload) => {
              const newData = payload.new;
              const oldData = payload.old;

              logger.dev('📡 Cambio detectado en user_current_state:', {
                is_online: newData.is_online,
                device_id: newData.device_id,
                current_device: deviceId
              });

              // Detectar si pasó de online a offline Y el device_id cambió
              if (
                oldData.is_online === true &&
                newData.is_online === false &&
                oldData.device_id === deviceId
              ) {
                logger.warn('🚫 Sesión cerrada: Usuario hizo login en otro dispositivo');
                handleSessionClosed();
              }

              // Detectar si el device_id cambió mientras seguía online
              if (
                newData.is_online === true &&
                oldData.device_id === deviceId &&
                newData.device_id !== deviceId
              ) {
                logger.warn('🚫 Device ID cambió: Usuario hizo login en otro dispositivo');
                handleSessionClosed();
              }
            }
          )
          .subscribe((status) => {
            logger.dev('📡 Estado de suscripción session_monitor:', status);
          });
      } catch (error) {
        logger.error('❌ Error configurando suscripción de sesión:', error);
      }

      // ============================================================
      // MÉTODO 2: Verificación periódica (backup si Realtime falla)
      // 🔋 Con prevención de sleep, Realtime debería funcionar siempre
      // ============================================================
      let consecutiveFailures = 0;
      checkInterval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('user_current_state')
            .select('is_online, device_id, current_session_id')
            .eq('usuario_id', userId)
            .single();

          if (error) {
            logger.warn('⚠️ Error verificando estado de sesión:', error);
            return;
          }

          // Verificar si el dispositivo actual ya no es el activo
          if (data) {
            const isMyDeviceActive = data.is_online && data.device_id === deviceId;
            
            // 🔧 FIX: Solo cerrar sesión después de MÚLTIPLES verificaciones consecutivas fallidas
            // Esto evita logouts falsos por reconexiones temporales o errores de red momentáneos
            if (!isMyDeviceActive && data.is_online) {
              consecutiveFailures++;
              logger.warn(`⚠️ Verificación periódica: Otro dispositivo parece activo (${consecutiveFailures}/2)`);
              
              // Solo cerrar sesión después de 2 verificaciones consecutivas (10 minutos)
              // El Realtime (método principal) detecta al instante, esto es solo backup
              if (consecutiveFailures >= 2) {
                logger.warn('🚫 CONFIRMADO: Otro dispositivo está activo (2 verificaciones consecutivas)');
                handleSessionClosed();
              }
            } else {
              // Resetear contador si la verificación pasa
              if (consecutiveFailures > 0) {
                logger.dev('✅ Verificación OK - reseteando contador de fallos');
                consecutiveFailures = 0;
              }
            }
          }
        } catch (error) {
          logger.warn('⚠️ Error en verificación periódica de sesión:', error);
        }
      }, 300000); // ⚡ Verificar cada 5 minutos (antes: 30s) - Realtime es el método principal
    };

    setupMonitoring();

    // Cleanup al desmontar
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        logger.dev('🔌 Desuscrito de session_monitor');
      }
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [userId, deviceId, isActive, handleSessionClosed]);

  // Función para resetear el estado (útil para testing o después de manejar el cierre)
  const resetSessionState = useCallback(() => {
    setSessionClosed(false);
    setClosedReason(null);
  }, []);

  return {
    sessionClosed,
    closedReason,
    resetSessionState
  };
}

