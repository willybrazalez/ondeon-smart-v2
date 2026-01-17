/**
 * MetricsService - Maneja métricas de sesión y actividad del usuario
 */
class MetricsService {
  constructor() {
    this.sessionStart = Date.now();
    this.activityLog = [];
    this.playTime = 0;
    this.pauseTime = 0;
    this.idleTime = 0;
    this.lastActivityTime = Date.now();
    this.currentState = 'idle';
    this.stateStartTime = Date.now();
  }

  /**
   * Registrar una actividad
   */
  logActivity(type, data = {}) {
    const activity = {
      type,
      timestamp: new Date().toISOString(),
      data,
      sessionTime: Date.now() - this.sessionStart
    };

    this.activityLog.push(activity);
    this.lastActivityTime = Date.now();

    // Limitar el log a las últimas 100 actividades para evitar memoria excesiva
    if (this.activityLog.length > 100) {
      this.activityLog = this.activityLog.slice(-100);
    }
  }

  /**
   * Cambiar estado y calcular tiempos
   */
  changeState(newState, additionalData = {}) {
    const now = Date.now();
    const timeInPreviousState = now - this.stateStartTime;

    // Acumular tiempo en el estado anterior
    switch (this.currentState) {
      case 'playing':
        this.playTime += timeInPreviousState;
        break;
      case 'paused':
        this.pauseTime += timeInPreviousState;
        break;
      case 'idle':
        this.idleTime += timeInPreviousState;
        break;
    }

    // Log del cambio de estado
    this.logActivity('state_change', {
      from: this.currentState,
      to: newState,
      timeInPreviousState,
      ...additionalData
    });

    // Actualizar estado actual
    this.currentState = newState;
    this.stateStartTime = now;
  }

  /**
   * Obtener métricas de la sesión actual
   */
  getSessionMetrics() {
    const now = Date.now();
    const sessionDuration = now - this.sessionStart;
    const timeSinceLastActivity = now - this.lastActivityTime;

    return {
      sessionDuration,
      playTime: this.playTime,
      pauseTime: this.pauseTime,
      idleTime: this.idleTime,
      activityCount: this.activityLog.length,
      currentState: this.currentState,
      timeInCurrentState: now - this.stateStartTime,
      timeSinceLastActivity,
      lastActivity: this.activityLog[this.activityLog.length - 1] || null,
      // Estadísticas adicionales
      playPercentage: sessionDuration > 0 ? (this.playTime / sessionDuration) * 100 : 0,
      pausePercentage: sessionDuration > 0 ? (this.pauseTime / sessionDuration) * 100 : 0,
      idlePercentage: sessionDuration > 0 ? (this.idleTime / sessionDuration) * 100 : 0
    };
  }

  /**
   * Obtener resumen de actividad reciente
   */
  getRecentActivity(minutes = 10) {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return this.activityLog.filter(activity => 
      new Date(activity.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Obtener estadísticas de actividad por tipo
   */
  getActivityStats() {
    const stats = {};
    this.activityLog.forEach(activity => {
      stats[activity.type] = (stats[activity.type] || 0) + 1;
    });
    return stats;
  }

  /**
   * Resetear métricas (para nueva sesión)
   */
  reset() {
    this.sessionStart = Date.now();
    this.activityLog = [];
    this.playTime = 0;
    this.pauseTime = 0;
    this.idleTime = 0;
    this.lastActivityTime = Date.now();
    this.currentState = 'idle';
    this.stateStartTime = Date.now();
  }

  /**
   * Obtener información del dispositivo
   */
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
      screenResolution: `${screen.width}x${screen.height}`,
      screenColorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      // Información adicional del navegador
      browserInfo: this.getBrowserInfo()
    };
  }

  /**
   * Detectar información del navegador
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';

    if (ua.includes('Chrome')) {
      browser = 'Chrome';
      version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
      version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Safari';
      version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Edge')) {
      browser = 'Edge';
      version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
    }

    return { browser, version };
  }
}

export default new MetricsService();
