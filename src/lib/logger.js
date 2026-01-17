/**
 * Sistema de Logging Inteligente
 * 
 * - En DESARROLLO: Muestra todos los logs
 * - En PRODUCCIÓN: Solo muestra errores y advertencias críticas
 */

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
  /**
   * Log de desarrollo (solo en dev)
   * Usar para: debugging, información de flujo, estado interno
   */
  dev(...args) {
    if (isDevelopment) {
      console.log(...args);
    }
  }

  /**
   * Log informativo (solo en dev)
   * Usar para: confirmaciones, operaciones completadas
   */
  info(...args) {
    if (isDevelopment) {
      console.log('ℹ️', ...args);
    }
  }

  /**
   * Log de éxito (solo en dev)
   * Usar para: operaciones exitosas importantes
   */
  success(...args) {
    if (isDevelopment) {
      console.log('✅', ...args);
    }
  }

  /**
   * Advertencia (siempre visible pero discreta)
   * Usar para: problemas no críticos, deprecaciones
   */
  warn(...args) {
    console.warn('⚠️', ...args);
  }

  /**
   * Error (siempre visible)
   * Usar para: errores que el usuario puede reportar
   */
  error(...args) {
    console.error('❌', ...args);
  }

  /**
   * Error crítico (siempre visible con stack trace)
   * Usar para: errores que rompen la funcionalidad
   */
  critical(message, error) {
    console.error('🚨 ERROR CRÍTICO:', message);
    if (error) {
      console.error(error);
    }
  }

  /**
   * Log de grupo (solo en dev)
   * Útil para agrupar logs relacionados
   */
  group(label, callback) {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }

  /**
   * Tabla (solo en dev)
   * Útil para mostrar arrays/objetos de forma legible
   */
  table(data) {
    if (isDevelopment) {
      console.table(data);
    }
  }
}

// Exportar singleton
const logger = new Logger();

// Exponer globalmente para debugging en producción si es necesario
if (typeof window !== 'undefined') {
  window.logger = logger;
}

export default logger;

// También exportar como named exports para importación flexible
export const { dev, info, success, warn, error, critical, group, table } = logger;

