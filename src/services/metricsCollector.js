import logger from '../lib/logger.js';

/**
 * Metrics Collector - Sistema de recolección de métricas en tiempo real
 * Monitorea rendimiento, errores y uso de recursos
 */

class MetricsCollector {
  constructor() {
    this.metrics = {
      // Contadores totales
      apiCalls: 0,
      errors: 0,
      warnings: 0,
      
      // Métricas de tiempo
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      
      // Usuarios y sesiones
      activeUsers: 0,
      totalSessions: 0,
      
      // Específicas de la aplicación
      heartbeats: 0,
      songsPlayed: 0,
      channelChanges: 0,
      
      // Arrays para métricas por minuto
      lastMinuteApiCalls: [],
      lastMinuteErrors: [],
      lastMinuteResponseTimes: [],
      
      // Cache
      cacheHits: 0,
      cacheMisses: 0,
      
      // Inicio de sesión
      sessionStart: Date.now()
    };
    
    // Limpiar métricas antiguas cada minuto
    setInterval(() => this.cleanupOldMetrics(), 60000);
    
    // Emitir métricas cada 10 segundos para dashboard
    setInterval(() => this.emitMetrics(), 10000);
    
    logger.dev('📊 MetricsCollector inicializado');
  }
  
  /**
   * Registrar llamada a API
   */
  recordApiCall(endpoint, duration, success = true) {
    this.metrics.apiCalls++;
    
    // Actualizar tiempos de respuesta
    if (duration !== undefined && duration !== null) {
      this.metrics.avgResponseTime = 
        (this.metrics.avgResponseTime * (this.metrics.apiCalls - 1) + duration) / this.metrics.apiCalls;
      this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, duration);
      this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, duration);
      
      this.metrics.lastMinuteResponseTimes.push({
        timestamp: Date.now(),
        duration,
        endpoint
      });
    }
    
    this.metrics.lastMinuteApiCalls.push({
      timestamp: Date.now(),
      endpoint,
      success,
      duration
    });
    
    // Alerta si hay más de 500 llamadas/minuto
    if (this.metrics.lastMinuteApiCalls.length > 500) {
      logger.error('🚨 ALERTA: Más de 500 llamadas API/minuto');
      this.emitAlert('high_api_calls', {
        count: this.metrics.lastMinuteApiCalls.length,
        threshold: 500
      });
    }
    
    // Alerta si el tiempo de respuesta promedio supera 2 segundos
    if (this.metrics.avgResponseTime > 2000) {
      logger.warn('⚠️ ALERTA: Tiempo de respuesta promedio > 2s');
      this.emitAlert('slow_response', {
        avgResponseTime: this.metrics.avgResponseTime,
        threshold: 2000
      });
    }
  }
  
  /**
   * Registrar error
   */
  recordError(error, context = {}) {
    this.metrics.errors++;
    
    this.metrics.lastMinuteErrors.push({
      timestamp: Date.now(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      context
    });
    
    // Alerta si hay más de 50 errores/minuto
    if (this.metrics.lastMinuteErrors.length > 50) {
      logger.error('🚨 ALERTA: Más de 50 errores/minuto');
      this.emitAlert('high_error_rate', {
        count: this.metrics.lastMinuteErrors.length,
        threshold: 50
      });
    }
    
    // Calcular tasa de error
    const errorRate = (this.metrics.errors / this.metrics.apiCalls) * 100;
    if (errorRate > 10) {
      logger.error(`🚨 ALERTA: Tasa de error ${errorRate.toFixed(2)}% (> 10%)`);
      this.emitAlert('high_error_rate_percentage', {
        errorRate,
        threshold: 10
      });
    }
  }
  
  /**
   * Registrar advertencia
   */
  recordWarning(message, context = {}) {
    this.metrics.warnings++;
    logger.warn('⚠️', message, context);
  }
  
  /**
   * Registrar uso de cache
   */
  recordCacheHit() {
    this.metrics.cacheHits++;
  }
  
  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }
  
  /**
   * Registrar evento de aplicación
   */
  recordEvent(eventType, data = {}) {
    switch (eventType) {
      case 'heartbeat':
        this.metrics.heartbeats++;
        break;
      case 'song_played':
        this.metrics.songsPlayed++;
        break;
      case 'channel_change':
        this.metrics.channelChanges++;
        break;
      case 'user_login':
        this.metrics.totalSessions++;
        this.metrics.activeUsers++;
        break;
      case 'user_logout':
        this.metrics.activeUsers = Math.max(0, this.metrics.activeUsers - 1);
        break;
    }
  }
  
  /**
   * Obtener métricas actuales
   */
  getMetrics() {
    const now = Date.now();
    const sessionDuration = (now - this.metrics.sessionStart) / 1000; // en segundos
    
    // Calcular tasa de cache hit
    const totalCacheAccess = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheAccess > 0 
      ? (this.metrics.cacheHits / totalCacheAccess) * 100 
      : 0;
    
    // Calcular tasa de error
    const errorRate = this.metrics.apiCalls > 0
      ? (this.metrics.errors / this.metrics.apiCalls) * 100
      : 0;
    
    return {
      ...this.metrics,
      // Métricas calculadas
      apiCallsPerMinute: this.metrics.lastMinuteApiCalls.length,
      errorsPerMinute: this.metrics.lastMinuteErrors.length,
      errorRate: errorRate.toFixed(2),
      cacheHitRate: cacheHitRate.toFixed(2),
      sessionDurationMinutes: (sessionDuration / 60).toFixed(1),
      
      // Métricas de tiempo de respuesta del último minuto
      recentAvgResponseTime: this.calculateRecentAvgResponseTime(),
      
      // Estado general
      healthStatus: this.getHealthStatus()
    };
  }
  
  /**
   * Calcular tiempo de respuesta promedio del último minuto
   */
  calculateRecentAvgResponseTime() {
    if (this.metrics.lastMinuteResponseTimes.length === 0) return 0;
    
    const sum = this.metrics.lastMinuteResponseTimes.reduce((acc, item) => acc + item.duration, 0);
    return sum / this.metrics.lastMinuteResponseTimes.length;
  }
  
  /**
   * Obtener estado de salud general
   */
  getHealthStatus() {
    const errorRate = this.metrics.apiCalls > 0
      ? (this.metrics.errors / this.metrics.apiCalls) * 100
      : 0;
    
    const avgResponseTime = this.metrics.avgResponseTime;
    
    if (errorRate > 10 || avgResponseTime > 3000) {
      return 'critical';
    } else if (errorRate > 5 || avgResponseTime > 2000) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }
  
  /**
   * Limpiar métricas antiguas (> 1 minuto)
   */
  cleanupOldMetrics() {
    const oneMinuteAgo = Date.now() - 60000;
    
    this.metrics.lastMinuteApiCalls = this.metrics.lastMinuteApiCalls
      .filter(call => call.timestamp > oneMinuteAgo);
    
    this.metrics.lastMinuteErrors = this.metrics.lastMinuteErrors
      .filter(error => error.timestamp > oneMinuteAgo);
    
    this.metrics.lastMinuteResponseTimes = this.metrics.lastMinuteResponseTimes
      .filter(time => time.timestamp > oneMinuteAgo);
  }
  
  /**
   * Emitir métricas para dashboard
   */
  emitMetrics() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metrics-updated', {
        detail: this.getMetrics()
      }));
    }
  }
  
  /**
   * Emitir alerta
   */
  emitAlert(type, data) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metrics-alert', {
        detail: {
          type,
          data,
          timestamp: new Date()
        }
      }));
    }
  }
  
  /**
   * Resetear métricas
   */
  reset() {
    this.metrics = {
      apiCalls: 0,
      errors: 0,
      warnings: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      activeUsers: 0,
      totalSessions: 0,
      heartbeats: 0,
      songsPlayed: 0,
      channelChanges: 0,
      lastMinuteApiCalls: [],
      lastMinuteErrors: [],
      lastMinuteResponseTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      sessionStart: Date.now()
    };
    
    logger.dev('📊 Métricas reseteadas');
  }
  
  /**
   * Obtener reporte resumido
   */
  getSummary() {
    const metrics = this.getMetrics();
    
    return {
      'Llamadas API': metrics.apiCalls,
      'Errores': metrics.errors,
      'Tasa de Error': `${metrics.errorRate}%`,
      'Tiempo Respuesta Promedio': `${metrics.avgResponseTime.toFixed(0)}ms`,
      'Usuarios Activos': metrics.activeUsers,
      'API Calls/min': metrics.apiCallsPerMinute,
      'Cache Hit Rate': `${metrics.cacheHitRate}%`,
      'Estado de Salud': metrics.healthStatus
    };
  }
}

// Crear singleton
const metricsCollector = new MetricsCollector();

// Exponer globalmente para debugging
if (typeof window !== 'undefined') {
  window.metricsCollector = metricsCollector;
  
  window.getMetrics = () => metricsCollector.getMetrics();
  window.getMetricsSummary = () => metricsCollector.getSummary();
  window.resetMetrics = () => metricsCollector.reset();
  
  logger.dev('📊 MetricsCollector disponible en window.metricsCollector');
  logger.dev('💡 Usa window.getMetrics() para ver métricas actuales');
  logger.dev('💡 Usa window.getMetricsSummary() para ver resumen');
}

export default metricsCollector;

