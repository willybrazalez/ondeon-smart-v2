import logger from '../lib/logger.js';

/**
 * Circuit Breaker Pattern - Protección contra cascadas de fallos
 * 
 * Estados:
 * - CLOSED: Funcionamiento normal, todas las peticiones pasan
 * - OPEN: Sistema degradado, rechaza peticiones inmediatamente
 * - HALF_OPEN: Modo de prueba, permite algunas peticiones para verificar recuperación
 */

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000, name = 'default') {
    this.name = name;
    this.failureCount = 0;
    this.successCount = 0;
    this.threshold = threshold; // Número de fallos antes de abrir el circuito
    this.timeout = timeout; // Tiempo antes de intentar recuperación
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
    
    // Métricas
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      lastFailureTime: null,
      lastSuccessTime: null
    };
  }
  
  /**
   * Ejecutar función protegida por circuit breaker
   */
  async execute(fn, fallback = null) {
    this.metrics.totalCalls++;
    
    // Estado OPEN: rechazar inmediatamente
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        logger.warn(`🔴 Circuit breaker [${this.name}] is OPEN - rechazando petición`);
        this.metrics.rejectedCalls++;
        
        // Ejecutar fallback si existe
        if (fallback && typeof fallback === 'function') {
          return fallback();
        }
        
        throw new Error(`Circuit breaker [${this.name}] is OPEN`);
      }
      
      // Tiempo cumplido, intentar recuperación
      logger.dev(`🟡 Circuit breaker [${this.name}] entrando en HALF_OPEN`);
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // Ejecutar fallback si existe
      if (fallback && typeof fallback === 'function') {
        try {
          return fallback();
        } catch (fallbackError) {
          logger.error(`❌ Fallback también falló en [${this.name}]:`, fallbackError);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Manejar éxito de operación
   */
  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    this.metrics.successfulCalls++;
    this.metrics.lastSuccessTime = Date.now();
    
    // En HALF_OPEN, después de N éxitos, volver a CLOSED
    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= 2) {
        logger.dev(`🟢 Circuit breaker [${this.name}] recuperado → CLOSED`);
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }
  
  /**
   * Manejar fallo de operación
   */
  onFailure(error) {
    this.failureCount++;
    this.metrics.failedCalls++;
    this.metrics.lastFailureTime = Date.now();
    
    logger.warn(`⚠️ Circuit breaker [${this.name}] fallo ${this.failureCount}/${this.threshold}:`, error.message);
    
    // Si alcanzamos el umbral, abrir el circuito
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      
      logger.error(`🔴 Circuit breaker [${this.name}] ABIERTO - próximo intento en ${this.timeout/1000}s`);
      
      // Emitir evento para monitoreo
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('circuit-breaker-opened', {
          detail: {
            name: this.name,
            failureCount: this.failureCount,
            nextAttempt: new Date(this.nextAttempt)
          }
        }));
      }
    }
  }
  
  /**
   * Obtener estado actual
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      threshold: this.threshold,
      nextAttempt: new Date(this.nextAttempt),
      metrics: { ...this.metrics }
    };
  }
  
  /**
   * Resetear manualmente el circuit breaker
   */
  reset() {
    logger.dev(`🔄 Circuit breaker [${this.name}] reseteado manualmente`);
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }
  
  /**
   * Forzar apertura del circuito (para testing o emergencias)
   */
  forceOpen(duration = this.timeout) {
    logger.warn(`⚠️ Circuit breaker [${this.name}] forzado a OPEN por ${duration/1000}s`);
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + duration;
  }
}

// Crear instancias para diferentes servicios
export const dbCircuitBreaker = new CircuitBreaker(5, 60000, 'database');
export const apiCircuitBreaker = new CircuitBreaker(5, 30000, 'api');
export const s3CircuitBreaker = new CircuitBreaker(3, 120000, 's3-audio');

// Exponer globalmente para debugging
if (typeof window !== 'undefined') {
  window.circuitBreakers = {
    db: dbCircuitBreaker,
    api: apiCircuitBreaker,
    s3: s3CircuitBreaker
  };
  
  // Helper para ver estado de todos los circuit breakers
  window.getCircuitBreakersStatus = () => {
    return {
      database: dbCircuitBreaker.getState(),
      api: apiCircuitBreaker.getState(),
      s3: s3CircuitBreaker.getState()
    };
  };
  
  logger.dev('🔌 Circuit Breakers disponibles en window.circuitBreakers');
}

export default CircuitBreaker;

