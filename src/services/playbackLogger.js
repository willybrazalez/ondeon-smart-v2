/**
 * PlaybackLogger - Sistema escalable de registro de historial
 * 
 * Características:
 * - Batch inserts (acumula eventos antes de guardar)
 * - Logging opcional por usuario
 * - Solo registra: canciones, cambios de canal, contenidos programados
 * - Auto-flush periódico
 * - Manejo de errores graceful
 */

import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

class PlaybackLogger {
  constructor() {
    // Estado
    this.currentUserId = null;
    this.historyEnabled = false;
    this.isActive = false;
    
    // Buffer de eventos (batch)
    this.eventBuffer = [];
    this.maxBufferSize = 50; // 🚀 OPTIMIZADO: Acumular 50 eventos (reducción 90% escrituras vs 5)
    this.flushInterval = 90000; // 🚀 OPTIMIZADO: Flush cada 90 segundos (balance perfecto)
    this.flushTimer = null;
    
    // Configuración de retención
    this.retentionHours = 48; // 🔧 Retención de solo 48 horas (2 días)
    
    // Stats para debug
    this.stats = {
      totalEvents: 0,
      totalFlushed: 0,
      lastFlush: null,
      errors: 0
    };
  }

  /**
   * Iniciar logger para un usuario
   */
  async iniciar(usuarioId, historyEnabled = true) {
    try {
      logger.dev('📊 Iniciando PlaybackLogger para usuario:', usuarioId);
      
      this.currentUserId = usuarioId;
      this.historyEnabled = historyEnabled;
      this.isActive = true;
      
      // Verificar si el usuario tiene historial habilitado en BD
      // Nota: usuarioId puede ser el id de usuarios O el auth_user_id (para OAuth)
      if (historyEnabled) {
        // Intentar primero por id, luego por auth_user_id (para usuarios OAuth)
        let userData = null;
        let error = null;
        
        // Intento 1: buscar por id
        const result1 = await supabase
          .from('usuarios')
          .select('history_enabled')
          .eq('id', usuarioId)
          .maybeSingle();
        
        if (result1.data) {
          userData = result1.data;
        } else {
          // Intento 2: buscar por auth_user_id (usuarios OAuth)
          const result2 = await supabase
            .from('usuarios')
            .select('history_enabled')
            .eq('auth_user_id', usuarioId)
            .maybeSingle();
          
          userData = result2.data;
          error = result2.error;
        }
        
        if (!userData && error) {
          logger.warn('⚠️ No se pudo verificar history_enabled, asumiendo true');
        } else if (userData) {
          this.historyEnabled = userData?.history_enabled ?? true;
        }
      }
      
      if (!this.historyEnabled) {
        logger.dev('📊 Historial deshabilitado para este usuario');
        return;
      }
      
      // Iniciar auto-flush periódico
      this.startAutoFlush();
      
      logger.dev(`✅ PlaybackLogger iniciado - Buffer: ${this.maxBufferSize} eventos, Flush: ${this.flushInterval/1000}s`);
      
    } catch (error) {
      logger.error('❌ Error iniciando PlaybackLogger:', error);
      this.isActive = false;
    }
  }

  /**
   * Detener logger
   */
  async detener() {
    logger.dev('⏹️ Deteniendo PlaybackLogger...');
    
    // Flush eventos pendientes antes de detener
    await this.flush();
    
    // Detener auto-flush
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Resetear estado
    this.currentUserId = null;
    this.historyEnabled = false;
    this.isActive = false;
    this.eventBuffer = [];
    
    logger.dev('✅ PlaybackLogger detenido');
  }

  /**
   * Registrar una canción reproducida
   */
  logSong({ title, artist, channelId, channelName, duration }) {
    if (!this.shouldLog()) return;
    
    this.addEvent({
      event_type: 'song',
      title,
      artist: artist || 'Artista Desconocido',
      canal_id: channelId,
      channel_name: channelName,
      duration_seconds: duration || null,
      metadata: null
    });
  }

  /**
   * Registrar un cambio de canal
   */
  logChannelChange({ fromChannel, toChannel, toChannelId }) {
    if (!this.shouldLog()) return;
    
    this.addEvent({
      event_type: 'channel_change',
      title: `Cambio a ${toChannel}`,
      artist: null,
      canal_id: toChannelId,
      channel_name: toChannel,
      duration_seconds: null,
      metadata: {
        from_channel: fromChannel
      }
    });
  }

  /**
   * Registrar un contenido programado
   */
  logScheduledContent({ 
    title, 
    tipoContenido,
    programacionId, 
    channelId, 
    channelName, 
    duration,
    modoAudio,
    descripcionProg 
  }) {
    if (!this.shouldLog()) return;
    
    this.addEvent({
      event_type: 'scheduled_content',
      title: title || 'Contenido Programado',
      artist: tipoContenido || 'Contenido', // Guardar tipo_contenido en artist
      canal_id: channelId,
      channel_name: channelName,
      programacion_id: programacionId,
      duration_seconds: duration || null,
      metadata: {
        modo_audio: modoAudio,
        descripcion_prog: descripcionProg,
        tipo_contenido: tipoContenido
      }
    });
  }

  /**
   * Registrar inicio de sesión
   */
  logLogin({ method, metadata } = {}) {
    if (!this.shouldLog()) return;

    this.addEvent({
      event_type: 'login',
      title: 'Inicio de sesión',
      artist: method || 'auth',
      canal_id: null,
      channel_name: 'Sistema', // ✅ Valor por defecto en vez de null
      duration_seconds: null,
      metadata: metadata || null
    });
  }

  /**
   * Registrar cierre de sesión
   */
  logLogout({ method, metadata } = {}) {
    // Permitir registrar logout incluso si historyEnabled cambia, siempre que haya usuario activo
    if (!this.currentUserId || !this.isActive) return;

    this.addEvent({
      event_type: 'logout',
      title: 'Cierre de sesión',
      artist: method || 'auth',
      canal_id: null,
      channel_name: 'Sistema', // ✅ Valor por defecto en vez de null
      duration_seconds: null,
      metadata: metadata || null
    });
  }

  /**
   * Verificar si se debe registrar
   */
  shouldLog() {
    if (!this.isActive || !this.historyEnabled || !this.currentUserId) {
      return false;
    }
    return true;
  }

  /**
   * Agregar evento al buffer
   */
  addEvent(event) {
    this.eventBuffer.push({
      usuario_id: this.currentUserId,
      created_at: new Date().toISOString(),
      ...event
    });

    this.stats.totalEvents++;

    // Flush si el buffer está lleno
    if (this.eventBuffer.length >= this.maxBufferSize) {
      logger.dev('📊 Buffer lleno - flushing eventos...');
      this.flush();
    }
  }

  /**
   * Guardar eventos acumulados en BD (batch insert)
   */
  async flush() {
    if (this.eventBuffer.length === 0) return;

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = []; // Limpiar buffer inmediatamente

    try {
      logger.dev(`📊 Guardando ${eventsToFlush.length} eventos en batch...`);

      const { error } = await supabase
        .from('playback_history')
        .insert(eventsToFlush);

      if (error) {
        logger.error('❌ Error guardando eventos:', error);
        this.stats.errors++;
        
        // Re-agregar eventos al buffer para reintentar
        this.eventBuffer.push(...eventsToFlush);
      } else {
        this.stats.totalFlushed += eventsToFlush.length;
        this.stats.lastFlush = new Date().toISOString();
        logger.dev(`✅ ${eventsToFlush.length} eventos guardados - Total flushed: ${this.stats.totalFlushed}`);
      }

    } catch (error) {
      logger.error('❌ Error crítico en flush:', error);
      this.stats.errors++;
      
      // Re-agregar eventos al buffer
      this.eventBuffer.push(...eventsToFlush);
    }
  }

  /**
   * Iniciar auto-flush periódico
   */
  startAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        logger.dev(`⏰ Auto-flush: ${this.eventBuffer.length} eventos pendientes`);
        this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Obtener estadísticas del logger
   */
  getStats() {
    return {
      ...this.stats,
      bufferSize: this.eventBuffer.length,
      isActive: this.isActive,
      historyEnabled: this.historyEnabled
    };
  }
}

// Singleton
let _loggerInstance = null;

const getInstance = () => {
  if (!_loggerInstance) {
    _loggerInstance = new PlaybackLogger();
  }
  return _loggerInstance;
};

// Exportar singleton con Proxy para lazy initialization
const lazyLogger = new Proxy({}, {
  get(_target, prop) {
    const inst = getInstance();
    
    // Log de inicialización
    if (!inst._initialized) {
      logger.dev('📊 PlaybackLogger inicializado (lazy)');
      inst._initialized = true;
      
      // Hacer accesible para debug
      if (typeof window !== 'undefined') {
        window.playbackLogger = inst;
        logger.dev('🔧 PlaybackLogger: Debug disponible en window.playbackLogger');
        logger.dev('🔧 Comandos disponibles:');
        logger.dev('   - window.playbackLogger.flush() → Guardar eventos pendientes');
        logger.dev('   - window.playbackLogger.getStats() → Ver estadísticas');
      }
    }
    
    const value = inst[prop];
    if (typeof value === 'function') return value.bind(inst);
    return value;
  }
});

export default lazyLogger;

