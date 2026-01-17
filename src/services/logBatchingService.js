/**
 * Log Batching Service - Agrupa logs para envío eficiente a la base de datos
 * Reduce el número de escrituras individuales, mejorando rendimiento y reduciendo Egress
 */

import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

class LogBatchingService {
  constructor() {
    this.logQueue = [];
    this.flushInterval = 30000; // Enviar logs cada 30 segundos
    this.maxBatchSize = 50; // Máximo de logs por batch
    this.isFlushingInProgress = false;
    this.totalLogsSent = 0;
    this.totalBatchesSent = 0;
    this.failedBatches = 0;
    
    // Iniciar flush periódico
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
    
    logger.dev('📦 LogBatchingService inicializado:', {
      flushInterval: `${this.flushInterval/1000}s`,
      maxBatchSize: this.maxBatchSize
    });
  }
  
  /**
   * Agregar log a la cola
   */
  addLog(logType, logData) {
    const log = {
      type: logType,
      data: logData,
      timestamp: new Date().toISOString(),
      clientTimestamp: Date.now()
    };
    
    this.logQueue.push(log);
    
    // Si alcanzamos el tamaño máximo, enviar inmediatamente
    if (this.logQueue.length >= this.maxBatchSize) {
      logger.dev('📦 Batch lleno, enviando logs inmediatamente...');
      this.flush();
    }
  }
  
  /**
   * Agregar log de reproducción de canción
   */
  addSongPlayLog(songData) {
    this.addLog('song_play', {
      song_id: songData.songId,
      song_title: songData.title,
      song_artist: songData.artist,
      channel_id: songData.channelId,
      channel_name: songData.channelName,
      duration: songData.duration,
      user_id: songData.userId
    });
  }
  
  /**
   * Agregar log de evento de usuario
   */
  addUserEventLog(eventType, eventData) {
    this.addLog('user_event', {
      event_type: eventType,
      event_data: eventData,
      user_id: eventData.userId
    });
  }
  
  /**
   * Agregar log de error
   */
  addErrorLog(error, context = {}) {
    this.addLog('error', {
      message: error.message || 'Unknown error',
      stack: error.stack,
      context,
      error_code: error.code
    });
  }
  
  /**
   * Enviar batch de logs a la base de datos
   */
  async flush() {
    // Prevenir flush concurrente
    if (this.isFlushingInProgress) {
      logger.dev('⏸️ Flush ya en progreso, saltando...');
      return;
    }
    
    // Si no hay logs, no hacer nada
    if (this.logQueue.length === 0) {
      return;
    }
    
    this.isFlushingInProgress = true;
    
    // Extraer batch de logs
    const batch = this.logQueue.splice(0, this.maxBatchSize);
    const batchSize = batch.length;
    
    logger.dev(`📤 Enviando batch de ${batchSize} logs a la BD...`);
    
    try {
      // Dividir por tipo de log para enviar a tablas correctas
      const songPlayLogs = batch.filter(log => log.type === 'song_play');
      const userEventLogs = batch.filter(log => log.type === 'user_event');
      const errorLogs = batch.filter(log => log.type === 'error');
      
      // Enviar logs de reproducción de canciones
      if (songPlayLogs.length > 0) {
        const songPlayData = songPlayLogs.map(log => ({
          usuario_id: log.data.user_id,
          canal_id: log.data.channel_id,
          canal_nombre: log.data.channel_name,
          cancion_titulo: log.data.song_title,
          cancion_artista: log.data.song_artist,
          duracion_segundos: log.data.duration,
          timestamp: log.timestamp,
          tipo_evento: 'song_played'
        }));
        
        const { error: songPlayError } = await supabase
          .from('playback_history')
          .insert(songPlayData);
        
        if (songPlayError) {
          logger.error('❌ Error enviando logs de reproducción:', songPlayError);
          // Reintroducir logs fallidos a la cola
          this.logQueue.unshift(...songPlayLogs);
          this.failedBatches++;
        } else {
          logger.dev(`✅ ${songPlayData.length} logs de reproducción enviados`);
        }
      }
      
      // Enviar logs de eventos de usuario
      if (userEventLogs.length > 0) {
        const userEventData = userEventLogs.map(log => ({
          usuario_id: log.data.user_id,
          tipo_evento: log.data.event_type,
          datos_evento: log.data.event_data,
          timestamp: log.timestamp
        }));
        
        const { error: userEventError } = await supabase
          .from('playback_history')
          .insert(userEventData);
        
        if (userEventError) {
          logger.error('❌ Error enviando logs de eventos:', userEventError);
          this.logQueue.unshift(...userEventLogs);
          this.failedBatches++;
        } else {
          logger.dev(`✅ ${userEventData.length} logs de eventos enviados`);
        }
      }
      
      // Enviar logs de errores (opcional, si tienes tabla de errores)
      if (errorLogs.length > 0) {
        logger.dev(`⚠️ ${errorLogs.length} logs de error (no enviados, solo registrados localmente)`);
        // Aquí podrías enviar a una tabla de errores si la tienes
      }
      
      // Actualizar estadísticas
      this.totalLogsSent += batchSize;
      this.totalBatchesSent++;
      
      logger.dev(`✅ Batch enviado exitosamente. Total logs enviados: ${this.totalLogsSent}`);
      
    } catch (error) {
      logger.error('❌ Error crítico en flush de logs:', error);
      
      // Reintroducir TODOS los logs del batch a la cola
      this.logQueue.unshift(...batch);
      this.failedBatches++;
      
    } finally {
      this.isFlushingInProgress = false;
    }
  }
  
  /**
   * Obtener estadísticas del servicio
   */
  getStats() {
    return {
      queueSize: this.logQueue.length,
      totalLogsSent: this.totalLogsSent,
      totalBatchesSent: this.totalBatchesSent,
      failedBatches: this.failedBatches,
      avgBatchSize: this.totalBatchesSent > 0 
        ? (this.totalLogsSent / this.totalBatchesSent).toFixed(1)
        : 0,
      successRate: this.totalBatchesSent > 0
        ? ((this.totalBatchesSent - this.failedBatches) / this.totalBatchesSent * 100).toFixed(1) + '%'
        : '0%'
    };
  }
  
  /**
   * Forzar flush inmediato
   */
  async forceFlush() {
    logger.dev('🔄 Flush forzado manualmente...');
    await this.flush();
  }
  
  /**
   * Limpiar y destruir servicio
   */
  destroy() {
    logger.dev('🗑️ Destruyendo LogBatchingService...');
    
    // Detener timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Enviar logs pendientes
    if (this.logQueue.length > 0) {
      logger.dev(`📤 Enviando ${this.logQueue.length} logs pendientes antes de destruir...`);
      this.flush();
    }
    
    logger.dev('✅ LogBatchingService destruido');
  }
}

// Crear singleton
const logBatchingService = new LogBatchingService();

// Exponer globalmente para debugging
if (typeof window !== 'undefined') {
  window.logBatchingService = logBatchingService;
  
  window.getLogBatchingStats = () => logBatchingService.getStats();
  window.forceFlushLogs = () => logBatchingService.forceFlush();
  
  logger.dev('📦 LogBatchingService disponible en window.logBatchingService');
  logger.dev('💡 Usa window.getLogBatchingStats() para ver estadísticas');
  logger.dev('💡 Usa window.forceFlushLogs() para enviar logs inmediatamente');
  
  // Asegurar flush antes de cerrar la ventana
  window.addEventListener('beforeunload', () => {
    logBatchingService.forceFlush();
  });
}

export default logBatchingService;

