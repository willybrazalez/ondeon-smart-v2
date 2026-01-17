/**
 * ⚡ Servicio de Heartbeat Ligero
 * 
 * Actualiza periódicamente un timestamp en user_current_state para permitir
 * la detección automática de desconexiones.
 * 
 * ¿Por qué este servicio?
 * - El sistema completo de heartbeats (advancedPresenceService) está desactivado
 *   por consumo de recursos
 * - Este servicio SOLO actualiza un timestamp (muy ligero)
 * - Permite detectar cuando un usuario cierra la app sin hacer logout
 * 
 * Consumo estimado:
 * - 1 update cada 90 segundos por usuario (OPTIMIZADO para reducir egress)
 * - ~100 bytes por update
 * - Con 62 usuarios: ~0.4 GB/mes | Con 500 usuarios: ~1.4 GB/mes (66% ahorro vs 60s)
 * 
 * @version 1.0.0
 * @date 2025-10-21
 */

import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

class LightweightHeartbeatService {
  constructor() {
    this.userId = null;
    this.heartbeatInterval = null;
    this.intervalMs = 90000; // 90 segundos (1.5 minutos) - OPTIMIZADO para reducir 66% de tráfico
    this.isActive = false;
    this.failureCount = 0;
    this.maxFailures = 5; // Detener después de 5 fallos consecutivos
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // Máximo 10 intentos de reconexión
    this.isReconnecting = false;
    this.reconnectTimer = null;
  }

  /**
   * Iniciar heartbeat ligero
   * 
   * @param {string} userId - ID del usuario autenticado
   */
  start(userId) {
    if (this.isActive) {
      logger.warn('⚠️ Heartbeat ligero ya está activo');
      return;
    }

    if (!userId) {
      logger.error('❌ No se puede iniciar heartbeat sin userId');
      return;
    }

    this.userId = userId;
    this.isActive = true;
    this.failureCount = 0;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;

    // Limpiar timer de reconexión si existe
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    logger.dev('💓 Iniciando heartbeat ligero (cada 90s - optimizado)');
    logger.dev('   → Actualizará "last_seen_at" para mantener usuario como online');
    logger.dev('   → Ahorra 66% de tráfico vs 60s (crítico para reducir egress)');
    logger.dev('   → Reconexión automática habilitada (hasta 10 intentos)');

    // Primer heartbeat inmediato
    this.sendHeartbeat();

    // Heartbeat periódico
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);

    // Exponer método de cleanup global (para limpieza desde App.jsx)
    window.__heartbeat_cleanup = () => this.stop();
  }

  /**
   * Enviar heartbeat (solo actualiza timestamp)
   * 
   * ⚡ MUY LIGERO: Solo hace 1 UPDATE, no lee datos
   */
  async sendHeartbeat() {
    if (!this.userId || !this.isActive) {
      return;
    }

    try {
      const now = new Date().toISOString();

      // 🔧 CRÍTICO: Actualizar last_seen_at (no last_heartbeat)
      // El dashboard usa last_seen_at para determinar si está online
      const { error } = await supabase
        .from('user_current_state')
        .update({ 
          last_seen_at: now  // ✅ Campo correcto
        })
        .eq('usuario_id', this.userId);

      if (error) {
        this.failureCount++;
        logger.warn(`⚠️ Error enviando heartbeat (${this.failureCount}/${this.maxFailures}):`, error.message);

        // Detener después de muchos fallos (probablemente desconectado)
        if (this.failureCount >= this.maxFailures) {
          logger.error('❌ Demasiados fallos en heartbeat - iniciando reconexión automática');
          this.startReconnection();
        }
      } else {
        // Reset contador de fallos si fue exitoso
        this.failureCount = 0;
        
        // Log cada minuto (primera vez después de iniciar)
        logger.dev(`💓 Heartbeat OK - last_seen_at actualizado`);
      }
    } catch (error) {
      this.failureCount++;
      logger.error('❌ Error en heartbeat:', error);

      if (this.failureCount >= this.maxFailures) {
        logger.error('❌ Demasiados fallos en heartbeat - iniciando reconexión automática');
        this.startReconnection();
      }
    }
  }

  /**
   * Iniciar proceso de reconexión automática
   * Usa backoff exponencial: 5s, 10s, 20s, 40s, 80s, máx 5min
   */
  startReconnection() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Backoff exponencial: 5s inicial, máximo 5 minutos
    const baseDelay = 5000; // 5 segundos
    const maxDelay = 300000; // 5 minutos máximo
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);
    
    logger.dev(`🔄 Reconectando heartbeat en ${delay/1000}s (intento #${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    this.reconnectTimer = setTimeout(() => {
      if (!this.isActive) return;
      
      logger.dev('🔌 Intentando reconectar heartbeat...');
      this.attemptReconnection();
    }, delay);
  }

  /**
   * Intentar reconexión del heartbeat
   */
  async attemptReconnection() {
    if (!this.isActive || !this.userId) {
      this.isReconnecting = false;
      return;
    }

    try {
      // Probar conexión con un heartbeat de prueba
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('user_current_state')
        .update({ last_seen_at: now })
        .eq('usuario_id', this.userId);

      if (error) {
        logger.warn(`⚠️ Reconexión fallida (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.startReconnection();
        } else {
          logger.error('❌ Máximo de intentos de reconexión alcanzado - deteniendo servicio');
          this.stop();
        }
      } else {
        logger.dev('✅ Heartbeat reconectado exitosamente');
        this.resetReconnection();
        this.restartHeartbeat();
      }
    } catch (error) {
      logger.error('❌ Error en reconexión:', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.startReconnection();
      } else {
        logger.error('❌ Máximo de intentos de reconexión alcanzado - deteniendo servicio');
        this.stop();
      }
    }
  }

  /**
   * Resetear estado de reconexión
   */
  resetReconnection() {
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.failureCount = 0;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Reiniciar el heartbeat después de reconexión exitosa
   */
  restartHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);

    logger.dev('💓 Heartbeat reiniciado después de reconexión');
  }

  /**
   * Detener heartbeat
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.userId = null;
    this.isActive = false;
    this.failureCount = 0;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    logger.dev('🛑 Heartbeat ligero detenido');

    // Limpiar cleanup global
    if (window.__heartbeat_cleanup) {
      delete window.__heartbeat_cleanup;
    }
  }

  /**
   * Cambiar intervalo de heartbeat (para testing)
   * 
   * @param {number} intervalMs - Nuevo intervalo en milisegundos
   */
  setInterval(intervalMs) {
    if (intervalMs < 10000) {
      logger.warn('⚠️ Intervalo muy corto (< 10s) - podría aumentar consumo de BD');
    }

    this.intervalMs = intervalMs;

    // Si ya está activo, reiniciar con nuevo intervalo
    if (this.isActive) {
      const userId = this.userId;
      this.stop();
      this.start(userId);
    }

    logger.dev(`⏱️ Intervalo de heartbeat cambiado a ${intervalMs}ms`);
  }

  /**
   * Verificar si el servicio está activo
   * 
   * @returns {boolean}
   */
  isRunning() {
    return this.isActive;
  }

  /**
   * Obtener estadísticas del servicio
   * 
   * @returns {object}
   */
  getStats() {
    return {
      isActive: this.isActive,
      userId: this.userId,
      intervalMs: this.intervalMs,
      failureCount: this.failureCount,
      uptime: this.isActive ? 'Running' : 'Stopped'
    };
  }
}

// Exportar instancia singleton
const lightweightHeartbeatService = new LightweightHeartbeatService();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.lightweightHeartbeat = lightweightHeartbeatService;
}

export default lightweightHeartbeatService;


