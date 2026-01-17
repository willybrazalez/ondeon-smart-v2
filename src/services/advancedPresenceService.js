/**
 * AdvancedPresenceService - Sistema avanzado de presencia de usuarios
 * Combina heartbeat, geolocalización y métricas avanzadas
 */
import { presenceApi } from '@/lib/api';
import locationService from './locationService';
import metricsService from './metricsService';
import logger from '../lib/logger.js';
import { getCurrentVersion } from '../lib/appVersion.js';

class AdvancedPresenceService {
  constructor() {
    this.isActive = false;
    this.userId = null;
    this.heartbeatInterval = null;
    this.heartbeatIntervalMs = 30000; // 30 segundos
    this.currentState = 'offline';
    this.deviceId = this.getOrCreateDeviceId();
    // Versión se establecerá dinámicamente al iniciar presencia
    this.appVersion = null;
    
    // 🔧 NUEVO: Almacenar datos actuales para heartbeats automáticos
    this.currentChannel = null;
    this.currentSong = null;
    this.currentArtist = null;
    this.currentPage = null;
    
    // 🔧 NUEVO: Control de throttling para heartbeats
    this.lastHeartbeatTime = 0;
    this.minHeartbeatInterval = 5000; // Mínimo 5 segundos entre heartbeats inmediatos
    
    // Configuración
    this.enableLocation = true;
    this.enableMetrics = true;
    this.enableDeviceInfo = true;
    
    // Estados válidos (SIMPLIFICADOS - solo 4 estados)
    this.validStates = ['playing', 'paused', 'conectado', 'offline'];
  }

  /**
   * Actualizar canción/canal actual y enviar heartbeat inmediato (throttleado)
   */
  updateNowPlaying({ channel, currentSong, artist } = {}) {
    // Actualizar cache local
    if (channel) this.currentChannel = channel;
    if (currentSong) this.currentSong = currentSong;
    if (artist) this.currentArtist = artist;

    // Si no está activo o no hay usuario, no enviar
    if (!this.isActive || !this.userId) return;

    // Asegurar estado coherente
    const desiredState = 'playing';
    const now = Date.now();

    // Throttle: respetar intervalo mínimo entre heartbeats inmediatos
    if (now - this.lastHeartbeatTime < this.minHeartbeatInterval) {
      return;
    }

    // Actualizar estado si es distinto
    if (this.currentState !== desiredState) {
      this.currentState = desiredState;
    }

    // Enviar heartbeat inmediato con datos frescos
    this.sendHeartbeat({ channel, currentSong, artist });
    this.lastHeartbeatTime = now;
  }

  /**
   * Obtener o crear un ID único del dispositivo
   */
  getOrCreateDeviceId() {
    const storageKey = 'ondeon_device_id';
    let deviceId = localStorage.getItem(storageKey);
    
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(storageKey, deviceId);
    }
    
    return deviceId;
  }

  /**
   * Iniciar el servicio de presencia
   */
  async startPresence(userId, options = {}) {
    // 🚫 DESACTIVADO - Optimización para 62 usuarios concurrentes
    // Sistema de heartbeats desactivado para reducir Database Egress en 50%
    
    // Solo mostrar logs en desarrollo, no en producción
    if (process.env.NODE_ENV === 'development') {
      logger.dev('⚠️ Sistema de presencia/heartbeats DESACTIVADO (optimización)');
    }
    
    return; // Salir inmediatamente sin activar el servicio
    
    // ============================================================
    // CÓDIGO DESACTIVADO (mantener por si se necesita reactivar)
    // ============================================================
    
    if (this.isActive) {
      logger.warn('PresenceService ya está activo');
      return;
    }

    this.userId = userId;
    this.isActive = true;
    this.currentState = 'conectado'; // Estado inicial simplificado

    // Configurar opciones
    if (options.heartbeatInterval) {
      this.heartbeatIntervalMs = options.heartbeatInterval;
    }
    if (options.enableLocation !== undefined) {
      this.enableLocation = options.enableLocation;
    }
    if (options.enableMetrics !== undefined) {
      this.enableMetrics = options.enableMetrics;
    }

    logger.dev('🚀 Iniciando AdvancedPresenceService para usuario:', userId);

    // Establecer versión de la app (solo si es Electron, null si es web)
    this.appVersion = getCurrentVersion();

    // Obtener geolocalización si está habilitada
    if (this.enableLocation && locationService.isLocationAvailable()) {
      try {
        await locationService.getCurrentLocation();
        logger.dev('📍 Geolocalización obtenida');
      } catch (error) {
        logger.warn('⚠️ No se pudo obtener geolocalización:', error);
      }
    }

    // Iniciar heartbeat
    this.startHeartbeat();

    // Log de inicio
    metricsService.logActivity('presence_started', {
      userId,
      deviceId: this.deviceId,
      options
    });
  }

  /**
   * Detener el servicio de presencia
   */
  async stopPresence() {
    if (!this.isActive) return;

    logger.dev('🛑 Deteniendo AdvancedPresenceService');

    // Enviar un último heartbeat con estado offline ANTES de detener el servicio
    if (this.userId) {
      const previousState = this.currentState;
      this.currentState = 'offline';
      try {
        await this.sendHeartbeat();
        logger.dev('📤 Último heartbeat enviado con estado offline');
      } catch (error) {
        logger.warn('⚠️ Error enviando último heartbeat:', error);
      }

      metricsService.logActivity('presence_stopped', {
        userId: this.userId,
        sessionDuration: metricsService.getSessionMetrics().sessionDuration,
        previousState
      });
    }

    // Detener heartbeat
    this.stopHeartbeat();

    // Resetear estado
    this.isActive = false;
    this.userId = null;
    this.currentState = 'offline';
  }

  /**
   * Iniciar el heartbeat
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 🔧 CRÍTICO: No enviar heartbeat inmediato para evitar spam
    // Solo programar heartbeat periódico cada 30 segundos
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  /**
   * Detener el heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Enviar heartbeat al servidor
   */
  async sendHeartbeat(additionalData = {}) {
    if (!this.isActive || !this.userId) return;

    try {
      const heartbeatData = {
        usuarioId: this.userId,
        deviceId: this.deviceId,
        status: this.currentState,
        version: this.appVersion
      };

      // Agregar información de canal y canción si está disponible
      // Priorizar datos del additionalData, luego usar datos almacenados
      heartbeatData.channel = additionalData.channel || this.currentChannel;
      heartbeatData.song = additionalData.currentSong || this.currentSong;
      heartbeatData.artist = additionalData.artist || this.currentArtist;

      // Agregar geolocalización si está disponible
      if (this.enableLocation) {
        const location = locationService.getLocation();
        if (location) {
          heartbeatData.location = location;
        }
      }

      // Agregar métricas si están habilitadas
      if (this.enableMetrics) {
        const metrics = metricsService.getSessionMetrics();
        heartbeatData.metrics = {
          sessionDuration: metrics.sessionDuration,
          playTime: metrics.playTime,
          pauseTime: metrics.pauseTime,
          idleTime: metrics.idleTime,
          activityCount: metrics.activityCount,
          currentState: metrics.currentState,
          playPercentage: metrics.playPercentage,
          pausePercentage: metrics.pausePercentage,
          idlePercentage: metrics.idlePercentage
        };
      }

      // Agregar información del dispositivo
      if (this.enableDeviceInfo) {
        heartbeatData.deviceInfo = metricsService.getDeviceInfo();
      }

      // Enviar heartbeat usando la función RPC v2
      const result = await presenceApi.sendHeartbeat(heartbeatData);
      
      // Actualizar timestamp del último heartbeat enviado
      this.lastHeartbeatTime = Date.now();
      
      // logger.dev('💓 Heartbeat enviado:', {
      //   status: this.currentState,
      //   channel: heartbeatData.channel,
      //   song: heartbeatData.song,
      //   sessionDuration: heartbeatData.metrics?.sessionDuration,
      //   location: !!heartbeatData.location
      // });

      // Log de actividad
      metricsService.logActivity('heartbeat_sent', {
        status: this.currentState,
        result
      });

    } catch (error) {
      logger.warn('⚠️ Error enviando heartbeat:', error);
      metricsService.logActivity('heartbeat_error', {
        error: error.message,
        status: this.currentState
      });
    }
  }

  /**
   * Actualizar el estado del usuario
   */
  updateState(newState, additionalData = {}) {
    if (!this.validStates.includes(newState)) {
      logger.warn('⚠️ Estado inválido:', newState);
      return;
    }

    const previousState = this.currentState;
    const stateChanged = newState !== this.currentState;
    
    // 🔧 CORREGIDO: Siempre actualizar datos, incluso si el estado no cambia
    this.currentState = newState;
    
    // Almacenar datos actuales para heartbeats automáticos
    if (additionalData.channel) this.currentChannel = additionalData.channel;
    if (additionalData.currentSong) this.currentSong = additionalData.currentSong;
    if (additionalData.artist) this.currentArtist = additionalData.artist;
    if (additionalData.currentPage) this.currentPage = additionalData.currentPage;

    // Solo actualizar métricas si el estado cambió
    if (stateChanged) {
      metricsService.changeState(newState, additionalData);
      logger.dev('🔄 Estado actualizado:', {
        from: previousState,
        to: newState,
        ...additionalData
      });
    }

    // 🔧 CORREGIDO: Solo enviar heartbeat inmediato si el estado cambió Y ha pasado suficiente tiempo
    if (stateChanged && ['playing', 'paused', 'conectado'].includes(newState)) {
      const now = Date.now();
      if (now - this.lastHeartbeatTime >= this.minHeartbeatInterval) {
        this.sendHeartbeat(additionalData);
        this.lastHeartbeatTime = now;
      }
    }
  }

  /**
   * Obtener el estado actual
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Obtener métricas actuales
   */
  getCurrentMetrics() {
    return metricsService.getSessionMetrics();
  }

  /**
   * Obtener información del dispositivo
   */
  getDeviceInfo() {
    return {
      deviceId: this.deviceId,
      ...metricsService.getDeviceInfo()
    };
  }

  /**
   * Verificar si el servicio está activo
   */
  isPresenceActive() {
    return this.isActive;
  }

  /**
   * Actualizar configuración
   */
  updateConfig(newConfig) {
    if (newConfig.heartbeatInterval) {
      this.heartbeatIntervalMs = newConfig.heartbeatInterval;
      if (this.isActive) {
        this.startHeartbeat(); // Reiniciar con nueva configuración
      }
    }
    if (newConfig.enableLocation !== undefined) {
      this.enableLocation = newConfig.enableLocation;
    }
    if (newConfig.enableMetrics !== undefined) {
      this.enableMetrics = newConfig.enableMetrics;
    }
    if (newConfig.enableDeviceInfo !== undefined) {
      this.enableDeviceInfo = newConfig.enableDeviceInfo;
    }
  }
}

export default new AdvancedPresenceService();
