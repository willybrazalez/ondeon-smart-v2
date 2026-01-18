/**
 * OptimizedPresenceService v2 - Sistema simplificado de presencia
 * 
 * ============================================================================
 * ONDEON SMART v2 - Presencia y Estado del Usuario
 * ============================================================================
 * 
 * Características:
 * ✅ Usa rpc_heartbeat para actualizar estado (canal, canción, estado)
 * ✅ Usa rpc_user_logout para marcar offline
 * ✅ Transmite eventos en tiempo real vía Supabase Realtime (para dashboard)
 * ✅ Simplificado: sin buffer de eventos ni sesiones complejas
 * ✅ Todo el estado se guarda en user_current_state vía RPC
 */

import { supabase } from '../lib/supabase.js';
import { presenceApi } from '../lib/api.js';
import logger from '../lib/logger.js';

class OptimizedPresenceService {
  constructor() {
    // Estado del servicio
    this.isActive = false;
    this.userId = null;
    this.deviceId = this.getOrCreateDeviceId();
    this.appVersion = null;
    
    // Canal de Realtime para broadcast
    this.eventsChannel = null;
    this.eventsChannelName = 'user-events';
    
    // Estado actual (mirror local)
    this.currentState = {
      playbackState: 'idle',
      canalId: null,
      canalNombre: null,
      cancionTitulo: null,
      cancionArtista: null
    };
    
    // Control de throttling
    this.lastHeartbeatTime = 0;
    this.minHeartbeatInterval = 5000; // 5 segundos mínimo entre heartbeats
    
    // Listeners externos
    this.eventListeners = new Map();
    
    // Estadísticas
    this.stats = {
      heartbeatsSent: 0,
      errors: 0,
      connectionStatus: 'disconnected'
    };
  }

  /**
   * Obtener o crear ID único del dispositivo
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
   * Iniciar servicio de presencia
   */
  async startPresence(userId, options = {}) {
    if (this.isActive) {
      logger.warn('⚠️ PresenceService ya está activo');
      return;
    }

    try {
      logger.dev('🚀 Iniciando PresenceService para usuario:', userId);
      
      this.userId = userId;
      this.appVersion = options.appVersion || null;
      this.isActive = true;
      
      // Conectar canal de Realtime para broadcast
      await this.connectRealtimeChannel();
      
      // Enviar heartbeat inicial
      await this.sendHeartbeat({ playbackState: 'idle' });
      
      // Configurar visibilidad de página
      this.setupPageVisibility();
      
      logger.dev('✅ PresenceService iniciado correctamente');
      
    } catch (error) {
      logger.error('❌ Error iniciando PresenceService:', error);
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Detener servicio de presencia
   */
  async stopPresence() {
    if (!this.isActive) {
      return;
    }

    try {
      logger.dev('🛑 Deteniendo PresenceService...');
      
      // Marcar como offline usando RPC
      await presenceApi.logout();
      
      // Desconectar canal de Realtime
      await this.disconnectRealtimeChannel();
      
      // Limpiar listener de visibilidad
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.visibilityHandler = null;
      }
      
      // Resetear estado
      this.isActive = false;
      this.userId = null;
      this.currentState = {
        playbackState: 'idle',
        canalId: null,
        canalNombre: null,
        cancionTitulo: null,
        cancionArtista: null
      };
      
      logger.dev('✅ PresenceService detenido');
      
    } catch (error) {
      logger.error('❌ Error deteniendo PresenceService:', error);
    }
  }

  /**
   * Conectar canal de Realtime para broadcast
   */
  async connectRealtimeChannel() {
    try {
      this.eventsChannel = supabase.channel(this.eventsChannelName);
      
      // Configurar listener para eventos broadcast
      this.eventsChannel.on('broadcast', { event: '*' }, (payload) => {
        this.handleBroadcastEvent(payload);
      });
      
      await new Promise((resolve, reject) => {
        this.eventsChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.stats.connectionStatus = 'connected';
            logger.dev('✅ Canal de eventos conectado');
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error(`Events channel error: ${status}`));
          }
        });
      });
      
    } catch (error) {
      logger.error('❌ Error conectando canal Realtime:', error);
      throw error;
    }
  }

  /**
   * Desconectar canal de Realtime
   */
  async disconnectRealtimeChannel() {
    if (this.eventsChannel) {
      try {
        await supabase.removeChannel(this.eventsChannel);
        logger.dev('✅ Canal de eventos desconectado');
      } catch (error) {
        logger.warn('⚠️ Error desconectando canal:', error.message);
      }
      this.eventsChannel = null;
    }
    this.stats.connectionStatus = 'disconnected';
  }

  /**
   * Enviar heartbeat usando RPC
   */
  async sendHeartbeat(options = {}) {
    if (!this.isActive) return;

    // Throttling
    const now = Date.now();
    if (!options.force && (now - this.lastHeartbeatTime) < this.minHeartbeatInterval) {
      return;
    }
    this.lastHeartbeatTime = now;

    try {
      const result = await presenceApi.sendHeartbeat({
        canalId: options.canalId || this.currentState.canalId,
        canalNombre: options.canalNombre || this.currentState.canalNombre,
        cancionTitulo: options.cancionTitulo || this.currentState.cancionTitulo,
        cancionArtista: options.cancionArtista || this.currentState.cancionArtista,
        playbackState: options.playbackState || this.currentState.playbackState,
        deviceId: this.deviceId,
        appVersion: this.appVersion
      });

      if (result?.success) {
        this.stats.heartbeatsSent++;
        
        // Actualizar estado local
        if (options.canalId !== undefined) this.currentState.canalId = options.canalId;
        if (options.canalNombre !== undefined) this.currentState.canalNombre = options.canalNombre;
        if (options.cancionTitulo !== undefined) this.currentState.cancionTitulo = options.cancionTitulo;
        if (options.cancionArtista !== undefined) this.currentState.cancionArtista = options.cancionArtista;
        if (options.playbackState !== undefined) this.currentState.playbackState = options.playbackState;
      }

    } catch (error) {
      this.stats.errors++;
      logger.warn('⚠️ Error en heartbeat:', error.message);
    }
  }

  /**
   * Transmitir evento via Realtime broadcast
   */
  async broadcastEvent(eventType, payload) {
    if (!this.eventsChannel) return;

    try {
      await this.eventsChannel.send({
        type: 'broadcast',
        event: eventType,
        payload: {
          ...payload,
          usuario_id: this.userId,
          timestamp: Date.now()
        }
      });
      
      logger.dev(`📡 Evento broadcast: ${eventType}`);
      
    } catch (error) {
      logger.warn('⚠️ Error en broadcast:', error.message);
    }
  }

  // ============================================================================
  // EVENTOS ESPECÍFICOS
  // ============================================================================

  /**
   * Evento: Cambio de canción
   */
  async sendSongChanged({ song, artist, channelId, channelName, duration, songId, playlistId }) {
    // Actualizar estado via RPC
    await this.sendHeartbeat({
      canalId: channelId,
      canalNombre: channelName,
      cancionTitulo: song,
      cancionArtista: artist,
      playbackState: 'playing',
      force: true
    });
    
    // Broadcast para dashboard en tiempo real
    await this.broadcastEvent('song_changed', {
      song,
      artist,
      channel_id: channelId,
      channel_name: channelName,
      duration,
      song_id: songId,
      playlist_id: playlistId
    });
  }

  /**
   * Evento: Cambio de canal
   */
  async sendChannelChanged({ fromChannel, toChannel, fromChannelId, toChannelId }) {
    await this.sendHeartbeat({
      canalId: toChannelId,
      canalNombre: toChannel,
      force: true
    });
    
    await this.broadcastEvent('channel_changed', {
      from_channel: fromChannel,
      to_channel: toChannel,
      from_channel_id: fromChannelId,
      to_channel_id: toChannelId
    });
  }

  /**
   * Evento: Cambio de estado de reproducción
   */
  async sendPlaybackStateChanged({ state, previousState, channelId, channelName }) {
    await this.sendHeartbeat({
      playbackState: state,
      canalId: channelId,
      canalNombre: channelName,
      force: true
    });
    
    await this.broadcastEvent('playback_state_changed', {
      state,
      previous_state: previousState,
      channel_id: channelId,
      channel_name: channelName
    });
  }

  /**
   * Evento: Inicio de contenido programado
   */
  async sendScheduledContentStarted({ title, type, programacionId, channelId, channelName, duration, modoAudio }) {
    await this.broadcastEvent('scheduled_content_started', {
      title,
      tipo_contenido: type,
      programacion_id: programacionId,
      channel_id: channelId,
      channel_name: channelName,
      duration,
      modo_audio: modoAudio
    });
  }

  /**
   * Evento: Fin de contenido programado
   */
  async sendScheduledContentEnded({ title, type, programacionId, channelId, channelName }) {
    await this.broadcastEvent('scheduled_content_ended', {
      title,
      tipo_contenido: type,
      programacion_id: programacionId,
      channel_id: channelId,
      channel_name: channelName
    });
  }

  /**
   * Evento: Error de reproducción
   */
  async sendPlaybackError({ errorType, errorMessage, channelId, channelName, songTitle }) {
    await this.broadcastEvent('playback_error', {
      error_type: errorType,
      error_message: errorMessage,
      channel_id: channelId,
      channel_name: channelName,
      song_title: songTitle
    });
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * Handler: Evento broadcast recibido
   */
  handleBroadcastEvent(payload) {
    const { event, payload: data } = payload;
    
    // No procesar eventos propios
    if (data?.usuario_id === this.userId) {
      return;
    }
    
    logger.dev(`📨 Evento recibido: ${event}`);
    
    // Notificar a listeners externos
    this.notifyListeners(event, data);
  }

  // ============================================================================
  // SISTEMA DE LISTENERS
  // ============================================================================

  /**
   * Registrar listener para eventos
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    this.eventListeners.get(eventType).push(callback);
    
    return () => {
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notificar a listeners
   */
  notifyListeners(eventType, data) {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`Error en listener de ${eventType}:`, error);
      }
    });
  }

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  /**
   * Configurar Page Visibility para manejar segundo plano
   */
  setupPageVisibility() {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = async () => {
      if (!document.hidden && this.isActive) {
        // App visible - enviar heartbeat para confirmar presencia
        logger.dev('📱 App visible - enviando heartbeat');
        await this.sendHeartbeat({ force: true });
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Actualizar "Now Playing" (alias para sendSongChanged simplificado)
   */
  async updateNowPlaying({ channel, currentSong, artist }) {
    if (!this.isActive) return;
    
    await this.sendHeartbeat({
      canalNombre: channel,
      cancionTitulo: currentSong,
      cancionArtista: artist,
      playbackState: 'playing'
    });
  }

  /**
   * Obtener estado actual del servicio
   */
  getCurrentState() {
    return {
      isActive: this.isActive,
      userId: this.userId,
      deviceId: this.deviceId,
      ...this.currentState
    };
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive
    };
  }

  /**
   * Verificar si el servicio está activo
   */
  isPresenceActive() {
    return this.isActive;
  }
}

// Exportar singleton
const optimizedPresenceService = new OptimizedPresenceService();

// Debug en desarrollo
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.optimizedPresence = optimizedPresenceService;
}

export default optimizedPresenceService;
