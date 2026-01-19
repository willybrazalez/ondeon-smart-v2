import { playlistsApi, songsApi } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import audioPlayer from './audioPlayerService.js';
import presence from './advancedPresenceService.js';
import logger from '../lib/logger.js';

/**
 * AutoDJ Service - Sistema completo de reproducción automática para Ondeón
 * 
 * Funcionalidades principales:
 * - Maneja 2 tipos de playlist: rotación, intervalo
 * - Sistema de prioridades: intervalos disparados > rotación
 * - Selección ponderada por peso para rotaciones
 * - Contador global para intervalos
 * - Manejo de franjas horarias
 * - Retorno automático después de interrupciones
 */
class AutoDjService {
  constructor() {
    // Estado del canal
    this.currentChannel = null;
    this.isActive = false;
    
    // Playlists cargadas por tipo
    this.rotationPlaylists = [];
    this.intervalPlaylists = [];
    this.scheduledPlaylists = [];
    
    // Estado de reproducción actual
    this.currentPlaylist = null;
    this.currentSong = null;
    this.currentSongIndex = 0;
    this.playQueue = [];
    
    // Contadores
    this.globalRotationCounter = 0; // Deprecated: mantenido para compatibilidad de logs

    // Contadores por playlist de intervalo y cola de ejecución
    this.intervalCounters = new Map();
    this.pendingIntervalQueue = [];
    
    // 🎯 NUEVO: Contador de selecciones por playlist para distribución balanceada
    this.playlistSelectionCounts = new Map();
    
    // Estado de interrupciones
    this.isInInterrupt = false;
    this.interruptType = null; // 'interval' | 'scheduled'
    this.previousRotationState = null;
    
    // 🔧 NUEVO: Cache para evitar logs repetitivos
    this.timeFrameCache = {};
    
    // 🔧 NUEVO: Sistema de debouncing para evitar cambios excesivos de canción
    this.lastSongChangeTime = 0;
    this.minSongChangeInterval = 5000; // Mínimo 5 segundos entre cambios
    
    // 🔧 NUEVO: Flag para evitar ejecución múltiple de playlists agendadas
    this.executedScheduledPlaylists = new Set(); // Set de playlists ya ejecutadas hoy
    
    // Timers para verificaciones automáticas
    this.schedulingTimer = null;
    this.clockTimer = null;
    
    // Protección contra bucles infinitos
    this.lastErrorTime = 0;
    this.errorCount = 0;
    this.maxErrors = 5;
    this.errorResetTime = 10000; // 10 segundos
    this.isInErrorState = false;
    this.requiresUserInteraction = false;
    this.isRecoveringFromError = false; // 🔧 NUEVO: Flag para omitir protección de tiempo en recuperación
    
    // 🔧 SISTEMA HÍBRIDO: Control de precarga inteligente
    this.userHasStartedPlaying = false; // Solo precargar después de primera interacción
    this.smartPreloadEnabled = false;   // Activar precarga automática tras primer play
    
    // Configuración
    this.config = {
      schedulingCheckInterval: 300000, // Verificar cada 5 minutos (en lugar de 30 segundos)
      clockCheckInterval: 1000, // Verificar reloj cada segundo
      maxHistorySize: 100
    };

    // Control de precarga
    this.lastPreloadAttempt = 0;
    this.preloadErrorCount = 0;
    
    // 🔧 NUEVO: Flag de protección contra ejecuciones concurrentes
    this.isHandlingSongEnd = false;
    
    // 🔧 CRÍTICO: Flag para bloquear AutoDJ cuando contenido programado tiene prioridad
    this.blockedByScheduledContent = false;

    // 🔧 OPTIMIZACIÓN: Sistema de sincronización en tiempo real con Supabase
    this.realtimeSubscriptions = new Map(); // Mapa de suscripciones por tabla
    this.lastSyncTime = Date.now();
    this.syncInterval = 600000; // Sincronizar cada 10 minutos como respaldo (menos agresivo)
    this.syncTimer = null;
    this.realtimeEnabled = false; // 🔧 OPTIMIZACIÓN DISK I/O: Deshabilitado para reducir I/O

    // 🔧 NUEVO: Sistema de "bolsa" para evitar repetición de canciones
    this.recentlyPlayedSongs = []; // Historial global para logs
    
    // 🔧 NUEVO: Flag para mantener estado de reproducción durante cambio de canal
    this.wasPlayingBeforeChannelChange = false;
    this.maxRecentSongs = 50; // Máximo número de canciones a recordar en historial global
    
    // 🎰 Sistema de bolsa por playlist: garantiza que TODAS las canciones suenen antes de repetir
    this.playlistBags = new Map(); // Map<playlistId, Set<songId>> - Canciones pendientes por playlist
    this.playlistTotalSongs = new Map(); // Map<playlistId, number> - Total de canciones por playlist

    // Flag para inicialización lazy de eventos de audio
    this._audioEventsSetup = false;

    // logger.dev('🎵 AutoDJ Service (Ondeón) inicializado con sistema híbrido');
  }

  /**
   * 🔧 NUEVO: Agregar canción al historial para evitar repeticiones
   */
  addSongToHistory(song) {
    if (!song) return;
    
    const songId = song?.canciones?.id || song?.id;
    const songTitle = song?.canciones?.titulo || song?.titulo;
    
    if (!songId) return;
    
    // Agregar al inicio del array
    this.recentlyPlayedSongs.unshift({
      id: songId,
      title: songTitle,
      timestamp: Date.now()
    });
    
    // Mantener solo las canciones más recientes
    if (this.recentlyPlayedSongs.length > this.maxRecentSongs) {
      this.recentlyPlayedSongs = this.recentlyPlayedSongs.slice(0, this.maxRecentSongs);
    }
    
    logger.dev('📝 Canción agregada al historial:', {
      title: songTitle,
      historySize: this.recentlyPlayedSongs.length
    });
  }

  /**
   * 📊 Registrar canción en historial de reproducción (Supabase)
   */
  async logSongToHistory(song) {
    try {
      // Importar optimizedPresenceService dinámicamente (lazy)
      const { default: optimizedPresenceService } = await import('./optimizedPresenceService.js');
      
      if (!song || !this.currentChannel) return;
      
      const songData = song?.canciones || song;
      const title = songData?.titulo || songData?.nombre || 'Sin título';
      const artist = songData?.artista || 'Artista Desconocido';
      const duration = Math.floor(songData?.duracion || 180); // segundos
      
      // Enviar evento de cambio de canción
      await optimizedPresenceService.sendSongChanged({
        song: title,
        artist,
        channelId: this.currentChannel.id,
        channelName: this.currentChannel.nombre || this.currentChannel.name,
        duration,
        songId: songData?.id || null,
        playlistId: this.currentPlaylist?.id || null
      });
      
      logger.dev('📊 Evento de canción enviado:', title);
    } catch (error) {
      // Error silencioso - no afecta la reproducción
      console.debug('⚠️ No se pudo registrar canción en historial:', error.message);
    }
  }

  /**
   * 🎰 Sistema de bolsa: Inicializar o rellenar la bolsa de una playlist
   */
  initializePlaylistBag(playlistId, songs) {
    if (!playlistId || !Array.isArray(songs) || songs.length === 0) return;
    
    // Crear un Set con todos los IDs de las canciones
    const songIds = new Set(songs.map(song => song?.canciones?.id || song?.id).filter(Boolean));
    
    this.playlistBags.set(playlistId, songIds);
    this.playlistTotalSongs.set(playlistId, songIds.size);
    
    logger.dev('🎰 Bolsa inicializada para playlist:', {
      playlistId,
      totalSongs: songIds.size,
      songsInBag: songIds.size
    });
  }

  /**
   * 🔀 Mezclar array usando algoritmo Fisher-Yates para verdadera aleatoriedad
   */
  shuffleArray(array) {
    const shuffled = [...array]; // Crear copia para no mutar el original
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 🎰 Sistema de bolsa: Obtener canciones disponibles de la bolsa
   */
  getSongsFromBag(playlistId, allSongs) {
    if (!playlistId || !Array.isArray(allSongs) || allSongs.length === 0) {
      return allSongs;
    }
    
    // Si no existe la bolsa, inicializarla
    if (!this.playlistBags.has(playlistId)) {
      this.initializePlaylistBag(playlistId, allSongs);
    }
    
    const bag = this.playlistBags.get(playlistId);
    
    // Si la bolsa está vacía, rellenarla (todas las canciones se reprodujeron)
    if (bag.size === 0) {
      logger.dev('🔄 Bolsa vacía, rellenando con todas las canciones de la playlist');
      this.initializePlaylistBag(playlistId, allSongs);
      // 🔀 Mezclar antes de devolver para garantizar orden aleatorio diferente cada vez
      return this.shuffleArray(allSongs);
    }
    
    // Filtrar canciones que aún están en la bolsa
    const availableSongs = allSongs.filter(song => {
      const songId = song?.canciones?.id || song?.id;
      return bag.has(songId);
    });
    
    const totalSongs = this.playlistTotalSongs.get(playlistId) || allSongs.length;
    
    logger.dev('🎰 Canciones disponibles en bolsa:', {
      playlistId,
      totalSongs,
      remainingInBag: bag.size,
      availableSongs: availableSongs.length,
      alreadyPlayed: totalSongs - bag.size
    });
    
    // 🔀 CRÍTICO: Mezclar las canciones disponibles antes de devolverlas
    // Esto garantiza que cada sesión tenga un orden diferente, incluso si las canciones
    // vienen en el mismo orden de la base de datos
    const shuffledSongs = availableSongs.length > 0 
      ? this.shuffleArray(availableSongs) 
      : this.shuffleArray(allSongs);
    
    return shuffledSongs;
  }

  /**
   * 🎰 Sistema de bolsa: Marcar canción como reproducida (sacarla de la bolsa)
   */
  removeSongFromBag(playlistId, song) {
    if (!playlistId || !song) return;
    
    const songId = song?.canciones?.id || song?.id;
    if (!songId) return;
    
    const bag = this.playlistBags.get(playlistId);
    if (bag && bag.has(songId)) {
      bag.delete(songId);
      
      const totalSongs = this.playlistTotalSongs.get(playlistId) || 0;
      
      logger.dev('🎰 Canción sacada de la bolsa:', {
        playlistId,
        songTitle: song?.canciones?.titulo || song?.titulo,
        remainingInBag: bag.size,
        progress: `${totalSongs - bag.size}/${totalSongs}`
      });
    }
  }

  /**
   * 🔧 NUEVO: Configurar sincronización en tiempo real con Supabase
   */
  setupRealtimeSync() {
    if (!this.currentChannel) {
      logger.dev('⚠️ No hay canal activo para sincronización en tiempo real');
      return;
    }

    logger.dev('🔄 Configurando sincronización en tiempo real para canal:', this.currentChannel.id);

    // Limpiar suscripciones anteriores
    this.cleanupRealtimeSubscriptions();

    // Suscribirse a cambios en playlists del canal actual
    const playlistSubscription = supabase
      .channel(`playlists-${this.currentChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'playlists',
          filter: `canal_id=eq.${this.currentChannel.id}`
        },
        (payload) => {
          logger.dev('🔄 Cambio detectado en playlists:', payload);
          this.handlePlaylistChange(payload);
        }
      )
      .subscribe();

    // Suscribirse a cambios en canciones del canal actual
    const songsSubscription = supabase
      .channel(`songs-${this.currentChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canciones',
          filter: `canal_id=eq.${this.currentChannel.id}`
        },
        (payload) => {
          logger.dev('🔄 Cambio detectado en canciones:', payload);
          this.handleSongChange(payload);
        }
      )
      .subscribe();

    // Guardar referencias a las suscripciones
    this.realtimeSubscriptions.set('playlists', playlistSubscription);
    this.realtimeSubscriptions.set('songs', songsSubscription);

    // Timer de respaldo para sincronización periódica
    this.syncTimer = setInterval(() => {
      this.forceSync();
    }, this.syncInterval);

    logger.dev('✅ Sincronización en tiempo real configurada');
  }

  /**
   * 🔧 NUEVO: Limpiar suscripciones en tiempo real
   */
  cleanupRealtimeSubscriptions() {
    logger.dev('🧹 Limpiando suscripciones en tiempo real...');
    
    this.realtimeSubscriptions.forEach((subscription, key) => {
      if (subscription) {
        supabase.removeChannel(subscription);
        logger.dev(`🗑️ Suscripción ${key} eliminada`);
      }
    });
    
    this.realtimeSubscriptions.clear();

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 🔧 NUEVO: Manejar cambios en playlists
   */
  async handlePlaylistChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    logger.dev(`🔄 Playlist ${eventType}:`, {
      eventType,
      playlistId: newRecord?.id || oldRecord?.id,
      playlistName: newRecord?.nombre || oldRecord?.nombre
    });

    // Aplicar cambios inmediatamente (realtime): recargar y recalcular estado
    // Si estamos en una interrupción, igualmente actualizamos el estado en memoria
    void this.reloadPlaylists();
  }

  /**
   * 🔧 NUEVO: Manejar cambios en canciones
   */
  async handleSongChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    logger.dev(`🔄 Canción ${eventType}:`, {
      eventType,
      songId: newRecord?.id || oldRecord?.id,
      songTitle: newRecord?.titulo || oldRecord?.titulo
    });

    // Si la canción actual fue modificada, recargar
    // Solo si no estamos en una interrupción
    if (this.currentSong && !this.isInInterrupt &&
        (newRecord?.id === this.currentSong.id || oldRecord?.id === this.currentSong.id)) {
      logger.dev('🔄 Canción actual modificada - recargando...');
      setTimeout(async () => {
        await this.reloadPlaylists();
      }, 3000); // 3 segundos para evitar recargas excesivas
    }
  }

  /**
   * 🔧 NUEVO: Recargar playlists desde la base de datos
   */
  async reloadPlaylists() {
    if (!this.currentChannel) {
      logger.dev('⚠️ No hay canal activo para recargar playlists');
      return;
    }

    logger.dev('🔄 Recargando playlists desde Supabase...');
    
    // 🔧 CORREGIDO: Limpiar cache de timeframes al recargar
    this.timeFrameCache = {};
    
    try {
      // Recargar playlists del canal
      await this.loadChannelPlaylists();
      
      // Reconstruir contadores y limpiar cola según nuevas playlists/horarios
      this.rebuildIntervalCounters();
      // Reconfigurar contadores de intervalos para playlists actuales
      this.rebuildIntervalCounters();
      
      // Actualizar timestamp de última sincronización
      this.lastSyncTime = Date.now();
      
      logger.dev('✅ Playlists recargadas exitosamente');
      
      // Si hay una canción cargada, verificar si sigue siendo válida
      // Solo validar si no estamos en una interrupción para evitar conflictos
      if (this.currentSong && !this.isInInterrupt) {
        try {
          const isValid = await this.validateCurrentSong();
          if (!isValid) {
            logger.dev('⚠️ Canción actual ya no es válida - seleccionando nueva...');
            await this.selectNextSong();
          }
        } catch (error) {
          logger.warn('⚠️ Error en validación de canción actual (ignorando):', error.message);
          // No forzar selección de nueva canción si hay error en validación
        }
      }
      
      // Aplicar efectos inmediatos de franjas horarias activadas/desactivadas
      this.applyImmediateTimeFrameEffects();
    } catch (error) {
      logger.error('❌ Error al recargar playlists:', error);
    }
  }

  /**
   * 🔧 NUEVO: Validar si la canción actual sigue siendo válida
   */
  async validateCurrentSong() {
    if (!this.currentSong || !this.currentPlaylist) {
      return false;
    }

    try {
      // Verificar si la playlist actual sigue activa
      const playlist = this.rotationPlaylists
        .concat(this.intervalPlaylists)
        .find(p => p.id === this.currentPlaylist.id);

      if (!playlist || !playlist.activa) {
        logger.dev('⚠️ Playlist actual ya no está activa');
        return false;
      }

      // Verificar si la canción sigue en la playlist (pasando canalId para usar cache de RPC)
      const songs = await songsApi.getPlaylistSongs(this.currentPlaylist.id, this.currentChannelId);
      // 🔧 FIX: Normalizar formato - la canción puede venir de RPC (plano) o fallback (anidado)
      const songExists = songs.some(song => {
        const songId = song?.canciones?.id || song?.id;
        const currentId = this.currentSong?.canciones?.id || this.currentSong?.id;
        return songId === currentId;
      });
      
      if (!songExists) {
        logger.dev('⚠️ Canción actual ya no está en la playlist');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('❌ Error al validar canción actual:', error);
      // En caso de error, asumir que la canción es válida para evitar interrupciones
      return true;
    }
  }

  /**
   * 🔧 NUEVO: Forzar sincronización manual
   */
  async forceSync() {
    logger.dev('🔄 Forzando sincronización manual...');
    await this.reloadPlaylists();
  }



  /**
   * Reconstruir contadores de intervalos tras recarga de playlists
   */
  rebuildIntervalCounters() {
    const newMap = new Map();
    for (const p of this.intervalPlaylists) {
      const prev = this.intervalCounters.get(p.id) ?? 0;
      newMap.set(p.id, Math.max(0, prev));
    }
    this.intervalCounters = newMap;
    // Limpiar cola de intervalos no válidos
    this.pendingIntervalQueue = this.pendingIntervalQueue.filter(p => this.intervalCounters.has(p.id));
  }

  /**
   * Incrementar contadores de todas las playlists de intervalo activas (operacionales ahora)
   */
  incrementIntervalCounters() {
    // Incrementar el contador de TODAS las playlists de intervalo activas, estén o no en franja.
    // Esto permite reglas como "cada 3 canciones" de forma consistente, incluso si
    // una playlist entra en franja más tarde: disparará solo cuando el contador >= repetir_cada.
    for (const p of this.intervalPlaylists) {
      const current = Number(this.intervalCounters.get(p.id) ?? 0);
      this.intervalCounters.set(p.id, current + 1);
    }
  }

  /**
   * Determinar si una playlist está activa (activa=true) y dentro de franja local
   */
  isPlaylistOperationalNow(playlist) {
    const isActiveFlag = playlist?.activa === true || playlist?.activa === 1;
    return !!isActiveFlag && this.isInActiveTimeFrame(playlist);
  }

  /**
   * Aplicar efectos inmediatos de cambios de franja horaria/activa
   */
  applyImmediateTimeFrameEffects() {
    // Si la playlist actual dejó de ser operativa, finalizar interrupción y volver a rotación
    if (this.currentPlaylist && !this.isPlaylistOperationalNow(this.currentPlaylist)) {
      logger.dev('⏱️ Playlist actual dejó de estar operativa, retornando a rotación');
      this.endInterrupt();
    }
  }

  /**
   * Chequear transiciones de franja horaria cada segundo
   */
  checkTimeFrameTransitions() {
    try {
      // Construir cola si alguna playlist entra en franja y su contador cumple
      const newlyTriggered = [];
      for (const p of this.intervalPlaylists) {
        const was = p.__wasOperational || false;
        const now = this.isPlaylistOperationalNow(p);
        if (!was && now) {
          const count = this.intervalCounters.get(p.id) ?? 0;
          if (p.repetir_unidad === 'canciones' && count >= p.repetir_cada) {
            newlyTriggered.push(p);
            this.intervalCounters.set(p.id, 0);
          }
        }
        p.__wasOperational = now;
      }
      if (newlyTriggered.length > 0) {
        newlyTriggered.sort((a, b) => (a.repetir_cada || 0) - (b.repetir_cada || 0));
        this.pendingIntervalQueue.push(...newlyTriggered);
      }
    } catch (e) {
      logger.warn('⚠️ Error en checkTimeFrameTransitions:', e);
    }
  }

  /**
   * Configurar eventos del reproductor de audio (lazy - solo una vez)
   */
  setupAudioEvents() {
    // Solo configurar una vez
    if (this._audioEventsSetup) {
      return;
    }
    
    // Limpiar eventos previos
    this.clearAudioEvents();
    
    this._audioEventsSetup = true;
    
    // Evento principal: cuando termina una canción
    this.onEndHandler = (song) => {
      logger.dev('🔚 AutoDJ: Evento onEnd recibido para:', song?.canciones?.titulo || song?.titulo);
      // Seguridad: revalidar que no estemos en pausa y que no haya sido duplicado
      const st = audioPlayer.getState();
      if (st.isPaused) {
        logger.dev('⏸️ onEnd ignorado porque el reproductor está en pausa');
        return;
      }
      // Si terminó una canción de rotación, incrementar contadores por playlist de intervalo
      if (!this.isInInterrupt) {
        this.globalRotationCounter++;
        this.incrementIntervalCounters();
      }
      this.handleSongEnd();
    };
    audioPlayer.on('onEnd', this.onEndHandler);

    // Eventos de estado
    this.onPlayHandler = (song) => {
      logger.dev('▶️ AutoDJ: Reproducción iniciada:', song?.canciones?.titulo || song?.titulo);
      if (!this.userHasStartedPlaying) {
        this.userHasStartedPlaying = true;
        this.smartPreloadEnabled = true;
        logger.dev('🎯 PRIMERA REPRODUCCIÓN: Activando precarga automática inteligente');
        setTimeout(() => {
          this.preloadNextSong();
        }, 2000);
      }
    };
    audioPlayer.on('onPlay', this.onPlayHandler);

    this.onPauseHandler = (song) => {
      logger.dev('⏸️ AutoDJ: Reproducción pausada:', song?.canciones?.titulo || song?.titulo);
    };
    audioPlayer.on('onPause', this.onPauseHandler);

    this.onRequestPreloadHandler = () => {
      if (!this.smartPreloadEnabled) {
        logger.dev('📡 Precarga JUST-IN-TIME solicitada (usuario no ha reproducido aún)');
        this.preloadNextSong();
      } else {
        logger.dev('📡 Precarga JUST-IN-TIME ignorada (precarga automática ya activa)');
      }
    };
    audioPlayer.on('onRequestPreload', this.onRequestPreloadHandler);

    this.onErrorHandler = (errorData) => {
      const now = Date.now();
      const errorMessage = errorData.message || errorData.error?.message || 'Error desconocido';
      const errorCode = errorData.errorCode;
      const songTitle = errorData.songTitle || 'Canción desconocida';
      
      logger.error('❌ AutoDJ: Error en reproductor:', {
        message: errorMessage,
        code: errorCode,
        song: songTitle,
        error: errorData
      });
      
      if (errorMessage.includes('NotAllowedError') || 
          errorMessage.includes('user didn\'t interact') ||
          errorMessage.includes('autoplay')) {
        logger.warn('🚫 Error de autoplay detectado - se requiere interacción del usuario');
        this.requiresUserInteraction = true;
        this.isInErrorState = true;
        this.stopErrorLoop();
        return;
      }
      if (errorMessage.includes('crossfade desactivado') || 
          errorMessage.includes('Precarga saltada')) {
        logger.dev('ℹ️ Error de precarga ignorado - crossfade desactivado (comportamiento normal)');
        return;
      }
      
      // 🔧 NUEVO: Manejo específico para errores de archivos corruptos
      if (errorCode === 4 || errorMessage.includes('DEMUXER_ERROR') || 
          errorMessage.includes('SRC_NOT_SUPPORTED') || 
          errorMessage.includes('Formato no soportado')) {
        logger.warn('⚠️ Archivo de audio corrupto o no soportado:', songTitle);
        logger.warn('🔄 Intentando siguiente canción automáticamente...');
        
        // 🔧 CRÍTICO: Activar flag de recuperación para omitir protección de tiempo
        this.isRecoveringFromError = true;
        
        // Limpiar canción actual que falló
        this.currentSong = null;
        
        if (!this.isInErrorState && !this.requiresUserInteraction) {
          setTimeout(() => {
            this.handleSongEnd();
          }, 500); // Reducido a 500ms para recuperación más rápida
        }
        return;
      }
      
      if (now - this.lastErrorTime < 1000) {
        this.errorCount++;
      } else {
        this.errorCount = 1;
      }
      this.lastErrorTime = now;
      if (this.errorCount >= this.maxErrors) {
        logger.error('🚨 Demasiados errores consecutivos, pausando AutoDJ');
        this.isInErrorState = true;
        this.stopErrorLoop();
        setTimeout(() => {
          this.resetErrorState();
        }, this.errorResetTime);
        return;
      }
      if (!this.isInErrorState && !this.requiresUserInteraction) {
        setTimeout(() => {
          this.handleSongEnd();
        }, 2000);
      }
    };
    audioPlayer.on('onError', this.onErrorHandler);

    // 🔔 Nuevo: notificar presencia al cambiar de canción
    this.onSongChangeHandler = (song) => {
      try {
        const channelName = this.currentChannel?.nombre || this.currentChannel?.name || null;
        const title = song?.canciones?.titulo || song?.titulo || null;
        const artist = song?.canciones?.artista || song?.artista || null;
        presence.updateNowPlaying({ channel: channelName, currentSong: title, artist });
      } catch (e) {
        // Silenciar errores de presencia para no afectar reproducción
      }
    };
    audioPlayer.on('onSongChange', this.onSongChangeHandler);

    // 🔧 NUEVO: Eventos de interrupción agendada
    this.onInterruptionStartHandler = (data) => {
      logger.dev('🎭 AutoDJ: Inicio de interrupción agendada:', {
        currentSong: data.currentSong?.canciones?.titulo || data.currentSong?.titulo,
        interruptionSong: data.interruptionSong?.canciones?.titulo || data.interruptionSong?.titulo
      });
    };
    audioPlayer.on('onInterruptionStart', this.onInterruptionStartHandler);
  }

  /**
   * Limpiar eventos del reproductor de audio
   */
  clearAudioEvents() {
    if (this.onEndHandler) {
      audioPlayer.off('onEnd', this.onEndHandler);
      audioPlayer.off('onPlay', this.onPlayHandler);
      audioPlayer.off('onPause', this.onPauseHandler);
      audioPlayer.off('onError', this.onErrorHandler);
      audioPlayer.off('onRequestPreload', this.onRequestPreloadHandler);
      audioPlayer.off('onInterruptionStart', this.onInterruptionStartHandler);
      audioPlayer.off('onInterruptionEnd', this.onInterruptionEndHandler);
    }
  }

  /**
   * Limpieza suave para cambios de canal (deteniendo reproducción actual)
   */
  async cleanupForChannelChange() {
    logger.dev('🔄 Limpieza suave para cambio de canal...');
    
    // 🔧 CORREGIDO: Detener y limpiar audio del canal anterior para evitar reproducción residual
    const wasPlaying = audioPlayer.getState().isPlaying;
    logger.dev('🎵 Manteniendo estado de reproducción durante cambio de canal:', wasPlaying ? 'REPRODUCIENDO' : 'PARADO');
    
    // 🔧 CRÍTICO: Limpiar audio del canal anterior para evitar que se reproduzca
    try {
      await audioPlayer.stop();
      await audioPlayer.reset();
      logger.dev('🧹 Audio del canal anterior limpiado');
    } catch (error) {
      logger.warn('⚠️ Error limpiando audio anterior:', error);
    }
    
    // Limpiar timers y suscripciones
    this.stopTimers();
    
    try {
      this.cleanupRealtimeSubscriptions();
    } catch (error) {
      logger.warn('⚠️ Error limpiando suscripciones realtime:', error);
    }
    
    // Resetear estado de playlists pero mantener canal activo
    this.rotationPlaylists = [];
    this.intervalPlaylists = [];
    this.scheduledPlaylists = [];
    this.currentPlaylist = null;
    this.currentSong = null; // 🔧 CORREGIDO: Limpiar canción actual
    this.playQueue = [];
    
    // Resetear contadores pero mantener estado activo
    this.globalRotationCounter = 0;
    this.intervalCounters.clear();
    this.pendingIntervalQueue = [];
    
    // Limpiar estado de interrupciones
    this.isInInterrupt = false;
    this.interruptType = null;
    this.previousRotationState = null;
    
    // Resetear flag de protección pero mantener activo
    this.isHandlingSongEnd = false;
    
    // 🔧 CORREGIDO: Guardar estado de reproducción para restaurarlo después
    this.wasPlayingBeforeChannelChange = wasPlaying;
    
    // CRÍTICO: Mantener isActive = true para indicar que seguimos funcionando
    logger.dev('✅ Limpieza suave completada - manteniendo estado activo');
  }

  /**
   * Inicializar AutoDJ para un canal específico
   */
  async initializeChannel(channel) {
    try {
      // 🔧 LAZY: Configurar eventos de audio la primera vez que se usa
      this.setupAudioEvents();
      
      logger.dev('🎛️ Inicializando AutoDJ para canal:', channel?.nombre || channel?.name || channel?.id);
      
      
      // Evitar reinicializar si ya estamos activos en el mismo canal
      if (this.isActive && this.currentChannel?.id && channel?.id && this.currentChannel.id === channel.id) {
        logger.dev('⏭️ AutoDJ ya inicializado para este canal, ignorando reinicialización');
        return true;
      }
      
      // 🔥 MEJORADO: Detección de cambio de canal vs inicialización completa
      const isChannelChange = this.isActive && this.currentChannel?.id && channel?.id && this.currentChannel.id !== channel.id;
      const wasPlaying = audioPlayer.getState().isPlaying;
      
      if (isChannelChange) {
        logger.dev('🔄 Cambiando canal de', this.currentChannel.nombre || this.currentChannel.name, 'a', channel.nombre || channel.name);
        logger.dev('🎵 Estado de reproducción antes del cambio:', wasPlaying ? 'REPRODUCIENDO' : 'PARADO');
        
        // Para cambios de canal, solo limpiar estado sin afectar reproducción
        await this.cleanupForChannelChange();
      } else {
        logger.dev('🧹 Inicialización completa - limpiando estado anterior...');
        this.stop(); // Limpieza completa solo para inicializaciones nuevas
      }
      
      // 🎯 Resetear contadores de distribución de playlists
      this.playlistSelectionCounts.clear();
      logger.dev('🔄 Contadores de distribución reseteados para nuevo canal');
      
      // PASO 2: Pequeña pausa para asegurar limpieza completa
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // PASO 3: Configurar nuevo canal
      this.currentChannel = channel;
      
      // PASO 3.1: CRÍTICO - Establecer canal en audioPlayerService para verificaciones
      audioPlayer.setCurrentChannel(channel.id);
      
      // PASO 3.2: EMERGENCIA - Limpiar cualquier canción precargada incorrecta
      const cleaned = audioPlayer.forceCleanIncorrectPreloadedSong();
      if (cleaned) {
        logger.dev('🧹 Canción precargada incorrecta eliminada durante inicialización');
      }
      
      // PASO 4: Resetear estado para nuevo canal
      this.resetState();
      
      // PASO 5: Cargar todas las playlists del canal
      logger.dev('📂 Cargando playlists del nuevo canal...');
      await this.loadChannelPlaylists();
      
      // PASO 6: 🔧 OPTIMIZACIÓN: Configurar sincronización en tiempo real solo si está habilitada
      if (this.realtimeEnabled) {
        logger.dev('🔄 Configurando sincronización en tiempo real...');
        this.setupRealtimeSync();
      } else {
        logger.dev('⚡ Sincronización en tiempo real deshabilitada para mejor rendimiento');
      }
      
      // PASO 7: Iniciar reproducción automática
      logger.dev('🚀 Iniciando sistema AutoDJ...');
      await this.start();
      
      // PASO 8: Si era un cambio de canal y estaba reproduciendo, continuar automáticamente
      // 🔧 CORREGIDO: Usar el estado guardado en cleanupForChannelChange
      const shouldContinuePlaying = isChannelChange && (wasPlaying || this.wasPlayingBeforeChannelChange);
      if (shouldContinuePlaying) {
        logger.dev('▶️ Era cambio de canal y estaba reproduciendo - continuando automáticamente...');
        setTimeout(async () => {
          try {
            // Forzar reproducción directamente en el audioPlayer
            await audioPlayer.play();
            logger.dev('✅ Reproducción continuada exitosamente tras cambio de canal');
          } catch (error) {
            logger.error('❌ Error continuando reproducción tras cambio de canal:', error);
            // Fallback: intentar con togglePlayPause
            try {
              await this.togglePlayPause();
              logger.dev('✅ Reproducción iniciada con toggle como fallback');
            } catch (fallbackError) {
              logger.error('❌ Error en fallback toggle:', fallbackError);
            }
          }
        }, 800); // Mayor delay para asegurar que todo esté completamente listo
      }
      
      // 🔧 Limpiar flag temporal
      this.wasPlayingBeforeChannelChange = false;
      
      // PASO 9: Iniciar timers de verificación
      this.startTimers();
      
      logger.dev('✅ AutoDJ inicializado exitosamente para:', channel?.nombre || channel?.name);
      return true;
    } catch (error) {
      logger.error('❌ Error inicializando AutoDJ:', error);
      logger.error('🔍 Detalles del error:', {
        channelId: channel?.id,
        channelName: channel?.nombre || channel?.name,
        errorMessage: error.message,
        errorStack: error.stack
      });
      
      // En caso de error, asegurar limpieza
      try {
        this.stop();
      } catch (cleanupError) {
        logger.error('❌ Error en limpieza tras fallo:', cleanupError);
      }
      
      return false;
    }
  }

  /**
   * Resetear estado interno
   */
  resetState() {
    logger.dev('🧹 Reseteando estado interno del AutoDJ...');
    
    // Resetear listas de playlists
    this.rotationPlaylists = [];
    this.intervalPlaylists = [];
    this.scheduledPlaylists = [];
    
    // Resetear estado de reproducción
    this.currentPlaylist = null;
    this.currentSong = null;
    this.currentSongIndex = 0;
    this.playQueue = [];
    
    // Resetear contadores
    this.globalRotationCounter = 0;
    
    // Resetear interrupciones
    this.isInInterrupt = false;
    this.interruptType = null;
    this.previousRotationState = null;
    
    // 🔧 SISTEMA HÍBRIDO: Resetear estado de precarga inteligente
    this.userHasStartedPlaying = false;
    this.smartPreloadEnabled = false;
    logger.dev('🔄 Sistema híbrido reseteado - volverá a just-in-time hasta primera reproducción');
    
    // Resetear control de precarga
    this.lastPreloadAttempt = 0;
    this.preloadErrorCount = 0;
    
    // 🔧 NUEVO: Resetear flag de protección contra ejecuciones concurrentes
    this.isHandlingSongEnd = false;
    
    // Resetear flag de playlists agendadas ejecutadas
    this.executedScheduledPlaylists.clear();
    
    // Detener timers
    this.stopTimers();
    
    logger.dev('✅ Estado interno reseteado completamente');
  }

  /**
   * Detener completamente el AutoDJ y limpiar todo
   */
  stop() {
    try {
      logger.dev('⏹️ Deteniendo AutoDJ completamente...');
      
      // Marcar como inactivo
      this.isActive = false;
      
      // Detener timers
      this.stopTimers();
      
      // Limpiar estado de error
      this.resetErrorState();
      
      // Detener y limpiar audioPlayer
      this.cleanupAudioPlayer();
      
      // Limpiar eventos del audioPlayer
      this.clearAudioEvents();
      
      // 🔧 NUEVO: Limpiar suscripciones en tiempo real
      this.cleanupRealtimeSubscriptions();
      
      // Resetear estado interno (sin llamar a stop nuevamente)
      this.rotationPlaylists = [];
      this.intervalPlaylists = [];
      this.scheduledPlaylists = [];
      this.currentPlaylist = null;
      this.currentSong = null;
      this.currentSongIndex = 0;
      this.playQueue = [];
      this.globalRotationCounter = 0;
      this.isInInterrupt = false;
      this.interruptType = null;
      this.previousRotationState = null;
      
      // Resetear control de precarga
      this.lastPreloadAttempt = 0;
      this.preloadErrorCount = 0;
      
      // 🔧 NUEVO: Resetear flag de protección
      this.isHandlingSongEnd = false;
      
      // Resetear flag de playlists agendadas ejecutadas
      this.executedScheduledPlaylists.clear();
      
      logger.dev('✅ AutoDJ detenido completamente');
    } catch (error) {
      logger.error('❌ Error deteniendo AutoDJ:', error);
    }
  }

  /**
   * Limpiar completamente el audioPlayer
   */
  cleanupAudioPlayer() {
    try {
      logger.dev('🧹 Limpiando AudioPlayer...');
      
      // Mostrar estado antes de limpiar
      const audioState = audioPlayer.getState();
      logger.dev('📊 Estado AudioPlayer antes de limpiar:', {
        isPlaying: audioState.isPlaying,
        currentSong: audioState.currentSong?.canciones?.titulo || audioState.currentSong?.titulo || 'Ninguna',
        nextSong: audioState.nextSong?.canciones?.titulo || audioState.nextSong?.titulo || 'Ninguna',
        nextSongLoaded: audioState.nextSongLoaded,
        isCrossfading: audioState.isCrossfading
      });
      
      // Usar el nuevo método reset del audioPlayerService
      audioPlayer.reset();
      
      // Verificar que se limpió correctamente
      const audioStateAfter = audioPlayer.getState();
      logger.dev('📊 Estado AudioPlayer después de limpiar:', {
        isPlaying: audioStateAfter.isPlaying,
        currentSong: audioStateAfter.currentSong,
        nextSong: audioStateAfter.nextSong,
        nextSongLoaded: audioStateAfter.nextSongLoaded,
        isCrossfading: audioStateAfter.isCrossfading
      });
      
      // Verificación crítica
      if (audioStateAfter.nextSong || audioStateAfter.nextSongLoaded) {
        logger.error('❌ CRÍTICO: AudioPlayer no se limpió completamente!', {
          nextSong: audioStateAfter.nextSong,
          nextSongLoaded: audioStateAfter.nextSongLoaded
        });
      } else {
        logger.dev('✅ AudioPlayer limpiado completamente - sin canciones residuales');
      }
      
    } catch (error) {
      logger.warn('⚠️ Error limpiando AudioPlayer:', error);
    }
  }

  /**
   * Cargar todas las playlists del canal clasificadas por tipo
   */
  async loadChannelPlaylists() {
    try {
      logger.dev('📂 Cargando playlists del canal...');
      
      const allPlaylists = await playlistsApi.getChannelPlaylists(this.currentChannel.id);
      
      logger.dev('📂 Playlists del canal:', allPlaylists?.length || 0);
      logger.dev('🔍 DEBUG - Todas las playlists cargadas:', allPlaylists?.map(p => ({
        nombre: p.nombre,
        tipo: p.tipo,
        activa: p.activa,
        canal_id: p.canal_id,
        fecha_activa_desde: p.fecha_activa_desde,
        fecha_activa_hasta: p.fecha_activa_hasta,
        activa_desde: p.activa_desde,
        activa_hasta: p.activa_hasta
      })));
      
      // Filtrar usando la estructura real de la base de datos
      // La API ya filtra por 'activa = true', pero por si acaso verificamos también
      this.rotationPlaylists = allPlaylists.filter(p => {
        const isCorrectType = (p.tipo === 'rotacion' || p.tipo === 'general');
        const isActive = (p.activa === true || p.activa === 1);
        const belongsToChannel = !p.canal_id || p.canal_id === this.currentChannel.id;
        
        if (!belongsToChannel) {
          logger.warn('🚫 Playlist de rotación filtrada (canal incorrecto):', {
            nombre: p.nombre,
            playlistCanalId: p.canal_id,
            currentChannelId: this.currentChannel.id
          });
        }
        
        return isCorrectType && isActive && belongsToChannel;
      });
      
      this.intervalPlaylists = allPlaylists.filter(p => {
        const isCorrectType = p.tipo === 'intervalo';
        const isActive = (p.activa === true || p.activa === 1);
        const belongsToChannel = !p.canal_id || p.canal_id === this.currentChannel.id;
        
        if (!belongsToChannel) {
          logger.warn('🚫 Playlist de intervalo filtrada (canal incorrecto):', {
            nombre: p.nombre,
            playlistCanalId: p.canal_id,
            currentChannelId: this.currentChannel.id
          });
        }
        
        if (!isActive) {
          logger.warn('🚫 Playlist de intervalo filtrada (inactiva):', {
            nombre: p.nombre,
            activa: p.activa
          });
        }
        
        logger.dev(`📋 Playlist de intervalo "${p.nombre}": tipo=${isCorrectType}, activa=${isActive}, canal=${belongsToChannel} -> ${isCorrectType && isActive && belongsToChannel ? 'INCLUIDA' : 'FILTRADA'}`);
        
        return isCorrectType && isActive && belongsToChannel;
      });
      
      // Eliminar soporte de playlists agendadas
      this.scheduledPlaylists = [];
      
      logger.dev('📊 Playlists clasificadas (solo rotación/intervalo):', {
        rotacion: this.rotationPlaylists.length,
        intervalo: this.intervalPlaylists.length
      });
      
      // Si aún no hay playlists de rotación, usar todas las disponibles como fallback
              if (this.rotationPlaylists.length === 0) {
        logger.error('❌ No hay playlists de rotación válidas en este canal');
        throw new Error(`No hay playlists de rotación válidas en el canal "${this.currentChannel?.nombre || this.currentChannel?.id}". Verificar configuración.`);
      }
      
      // Validar que hay al menos una playlist
      if (this.rotationPlaylists.length === 0) {
        logger.error('❌ No hay playlists disponibles en el canal');
        throw new Error('No hay playlists disponibles en el canal. Verificar configuración de la base de datos.');
      } else {
        logger.dev('✅ Playlists de rotación encontradas:', this.rotationPlaylists.map(p => p.nombre));
      }
      
    } catch (error) {
      logger.error('❌ Error cargando playlists:', error);
      logger.dev('🔍 DEBUG - Detalles del error:', {
        message: error.message,
        stack: error.stack,
        channelId: this.currentChannel?.id,
        channelName: this.currentChannel?.nombre || this.currentChannel?.name
      });
      
      // Verificar si es un error de la API
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('API')) {
        logger.warn('⚠️ Parece ser un error de conexión con la API');
        throw new Error('Error de conexión con el servidor. Verificar conectividad.');
      }
      
      throw error;
    }
  }

  /**
   * Iniciar reproducción automática
   */
  async start() {
    try {
      logger.dev('🚀 Iniciando reproducción automática...');
      this.isActive = true;
      
      // Resetear estado de error
      this.resetErrorState();
      
      // Seleccionar primera canción
      const firstSong = await this.selectNextSong();
      if (firstSong) {
        // Cargar canción pero no reproducir automáticamente (por políticas de autoplay)
        await this.loadSongOnly(firstSong);
        logger.dev('📼 Canción cargada. Haz clic en play para iniciar la reproducción.');
      } else {
        throw new Error('No se pudo seleccionar primera canción');
      }
      
    } catch (error) {
      logger.error('❌ Error iniciando reproducción:', error);
      
      // Si es error de autoplay, no relanzar error
      if (error.message && error.message.includes('NotAllowedError')) {
        logger.warn('🚫 Reproducción automática bloqueada por el navegador');
        this.requiresUserInteraction = true;
        return; // No relanzar el error
      }
      
      throw error;
    }
  }

  /**
   * Detener AutoDJ
   */
  stop() {
    logger.dev('⏹️ Deteniendo AutoDJ...');
    this.isActive = false;
    this.stopTimers();
    audioPlayer.stop();
  }

  /**
   * Pausar/reanudar reproducción
   */
  async togglePlayPause() {
    try {
      // Si es la primera interacción del usuario, permitir reproducción
      if (this.requiresUserInteraction) {
        this.allowPlaybackAfterInteraction();
      }

      const audioState = audioPlayer.getState();

      // Si ya está reproduciendo, pausar
      if (audioState.isPlaying) {
        audioPlayer.pause();
        
        // 📊 Registrar cambio de estado a pausado
        const optimizedPresenceService = (await import('./optimizedPresenceService.js')).default;
        await optimizedPresenceService.sendPlaybackStateChanged({
          state: 'paused',
          previousState: 'playing',
          channelId: this.currentChannelId,
          channelName: this.currentChannelName
        });
        
        return;
      }

      // Asegurar que exista un reproductor con una canción cargada antes de play()
      const hasLoadedAudio = (audioState.duration || 0) > 0;

      if (!hasLoadedAudio) {
        // No hay reproductor listo aún; cargar canción actual o seleccionar una nueva
        if (this.currentSong) {
          logger.dev('ℹ️ No hay reproductor activo aún. Cargando canción actual antes de reproducir...');
          const loaded = await audioPlayer.loadSong(this.currentSong, false);
          if (!loaded) {
            logger.warn('⚠️ No se pudo cargar la canción actual. Intentando seleccionar una nueva...');
            const next = await this.selectNextSong();
            if (next) {
              const loadedNext = await audioPlayer.loadSong(next, false);
              if (loadedNext) {
                this.currentSong = next;
              }
            }
          }
        } else {
          logger.dev('ℹ️ No hay canción actual. Seleccionando y cargando...');
          const next = await this.selectNextSong();
          if (next) {
            const loadedNext = await audioPlayer.loadSong(next, false);
            if (loadedNext) {
              this.currentSong = next;
            }
          }
        }
      }

      // Intentar reproducir
      let playSucceeded = await audioPlayer.play();
      if (playSucceeded) {
        logger.dev('▶️ Reproducción iniciada por interacción del usuario');
        
        // 📊 Registrar cambio de estado a reproduciendo
        const optimizedPresenceService = (await import('./optimizedPresenceService.js')).default;
        await optimizedPresenceService.sendPlaybackStateChanged({
          state: 'playing',
          previousState: 'paused',
          channelId: this.currentChannelId,
          channelName: this.currentChannelName
        });
      } else {
        logger.warn('⚠️ Reproducción no pudo iniciarse; reintentando tras recarga...');
        if (this.currentSong) {
          const reloaded = await audioPlayer.loadSong(this.currentSong, false);
          if (reloaded) {
            playSucceeded = await audioPlayer.play();
            if (playSucceeded) {
              logger.dev('▶️ Reproducción iniciada tras recarga');
            }
          }
        }
      }
    } catch (error) {
      logger.error('❌ Error en togglePlayPause:', error);
      
      // Si es error de autoplay aún, mantener el estado
      if (error.message && error.message.includes('NotAllowedError')) {
        logger.warn('🚫 Aún se requiere más interacción del usuario');
        this.requiresUserInteraction = true;
      }
    }
  }

  /**
   * Avanzar manualmente a siguiente canción
   */
  async next() {
    logger.dev('⏭️ Avance manual solicitado');
    return await this.handleSongEnd();
  }

  /**
   * Seleccionar siguiente canción según prioridades
   */
  async selectNextSong() {
    try {
      logger.dev('🎯 Seleccionando siguiente canción...');
      logger.dev('🔍 DEBUG - Estado actual del AutoDJ:', {
        isInInterrupt: this.isInInterrupt,
        interruptType: this.interruptType,
        globalRotationCounter: this.globalRotationCounter,
        rotationPlaylistsCount: this.rotationPlaylists.length,
        intervalPlaylistsCount: this.intervalPlaylists.length
      });

      // 0) Verificar si algún intervalo debe dispararse ahora (según contadores)
      const intervalImmediate = await this.checkIntervalTrigger();
      if (intervalImmediate) {
        return intervalImmediate;
      }

      // 1) PRIORIDAD: Si hay intervalos pendientes, reproducir en orden (A → B)
      if (this.pendingIntervalQueue.length > 0) {
        const nextInterval = this.pendingIntervalQueue.shift();
        logger.dev('🎯 Intervalo pendiente detectado, playlist:', nextInterval?.nombre || nextInterval?.id);
        return await this.selectSongFromInterval(nextInterval);
      }

      // 2) PRIORIDAD BASE: Seleccionar de rotación general
      logger.dev('🔍 Seleccionando de rotación general...');
      const rotationSong = await this.selectFromRotation();
      if (rotationSong) {
        logger.dev('✅ Canción seleccionada de playlist ROTACIÓN:', rotationSong?.canciones?.titulo || rotationSong?.titulo);
        logger.dev('📊 Playlist de origen:', {
          id: this.currentPlaylist?.id,
          nombre: this.currentPlaylist?.nombre,
          tipo: this.currentPlaylist?.tipo
        });
        return rotationSong;
      }
      
      logger.error('❌ No se pudo seleccionar ninguna canción de ninguna categoría');
      return null;
      
    } catch (error) {
      logger.error('❌ Error seleccionando siguiente canción:', error);
      // Fallback: intentar rotación general
      logger.dev('🔄 Fallback: intentando solo rotación general...');
      return await this.selectFromRotation();
    }
  }

  /**
   * Verificar si hay playlists agendadas activas
   */
  async checkScheduledPlaylists() { return null; }

  /**
   * Verificar si una playlist agendada está activa
   */
  isScheduledPlaylistActive() { return false; }

  /**
   * Formatear fecha para comparación (DD/MM/YYYY -> YYYY-MM-DD)
   */
  formatDateForComparison(dateString) {
    if (!dateString) return null;
    
    // Si ya está en formato YYYY-MM-DD, retornar tal cual
    if (dateString.includes('-') && dateString.length === 10) {
      return dateString;
    }
    
    // Si está en formato DD/MM/YYYY, convertir
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return dateString;
  }

  /**
   * Verificar si debe activarse una playlist de intervalo
   */
  async checkIntervalTrigger() {
    // Nuevo flujo: usar contadores por playlist y construir cola de ejecución
    if (this.isInInterrupt) return null;
    
    const triggered = [];
    for (const playlist of this.intervalPlaylists) {
      // 🔧 DEBUG específico para MUSICA EN CHINO
      if (playlist.nombre === 'MUSICA EN CHINO') {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const isOperational = this.isPlaylistOperationalNow(playlist);
        
        logger.dev('🎵 DEBUG MUSICA EN CHINO en checkIntervalTrigger:', {
          nombre: playlist.nombre,
          // Fechas de activación
          fecha_activa_desde: playlist.fecha_activa_desde,
          fecha_activa_hasta: playlist.fecha_activa_hasta,
          // Franja horaria (HH:MM:SS)
          franja_horaria_inicio: playlist.activa_desde,
          franja_horaria_fin: playlist.activa_hasta,
          // Hora actual
          hora_local_actual: currentTime,
          // Estado
          isOperational: isOperational,
          repetir_cada: playlist.repetir_cada,
          repetir_unidad: playlist.repetir_unidad,
          contador_actual: this.intervalCounters.get(playlist.id) || 0,
          resultado: !isOperational ? '❌ INACTIVA' : '✅ ACTIVA'
        });
      }
      
      if (!this.isPlaylistOperationalNow(playlist)) continue;
      const count = Number(this.intervalCounters.get(playlist.id) ?? 0);
      const unidad = (playlist.repetir_unidad || '').toString().toLowerCase();
      const threshold = Number(playlist.repetir_cada ?? 0);
      if (!Number.isFinite(threshold) || threshold <= 0) continue;
      if (unidad === 'canciones' && count >= threshold) {
        logger.dev('🎯 Intervalo listo para disparar:', {
          playlist: playlist.nombre,
          count,
          threshold
        });
        triggered.push(playlist);
      }
    }

    if (triggered.length > 0) {
      // Ordenar por repetir_cada ascendente para A → B
      triggered.sort((a, b) => (a.repetir_cada || 0) - (b.repetir_cada || 0));
      this.pendingIntervalQueue.push(...triggered);
      // Resetear contadores de los que entran a cola
      triggered.forEach(p => this.intervalCounters.set(p.id, 0));
      const nextInterval = this.pendingIntervalQueue.shift();
      logger.dev('🔁 Activando playlist de intervalo:', nextInterval?.nombre);
      return await this.selectSongFromInterval(nextInterval);
    }
    return null;
  }

  /**
   * Verificar si debe activarse un intervalo específico
   */
  shouldTriggerInterval() { return false; }

  /**
   * Obtener razón por la que no se activa una playlist de intervalo
   */
  getIntervalTriggerReason(playlist) {
    // Verificar franja horaria si está habilitada
    if (playlist.usar_franja_horaria && !this.isInActiveTimeFrame(playlist)) {
      return `Fuera de franja horaria (${playlist.franja_inicio} - ${playlist.franja_fin})`;
    }
    
    // Verificar contador según unidad
    if (playlist.repetir_unidad === 'canciones') {
      const faltan = playlist.repetir_cada - this.globalRotationCounter;
      return `Contador insuficiente (${this.globalRotationCounter}/${playlist.repetir_cada}, faltan ${faltan} canciones)`;
    }
    
    return `Unidad no soportada: ${playlist.repetir_unidad}`;
  }

  /**
   * Verificar si una playlist está en su franja horaria activa
   * NUEVA LÓGICA:
   * - fecha_activa_desde/fecha_activa_hasta: Define CUÁNDO está activa (fechas)
   * - activa_desde/activa_hasta: Define A QUÉ HORAS del día está activa (franjas horarias)
   */
  isInActiveTimeFrame(playlist) {
    const now = new Date();
    
    // 🔧 PASO 1: Validar fechas de activación (CUÁNDO está activa)
    const hasFechaActivacion = playlist.fecha_activa_desde || playlist.fecha_activa_hasta;
    
    if (hasFechaActivacion) {
      const fechaDesde = playlist.fecha_activa_desde ? new Date(playlist.fecha_activa_desde) : null;
      const fechaHasta = playlist.fecha_activa_hasta ? new Date(playlist.fecha_activa_hasta) : null;
      
      // Normalizar fechas a medianoche para comparación solo de días
      const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (fechaDesde) {
        const desde = new Date(fechaDesde.getFullYear(), fechaDesde.getMonth(), fechaDesde.getDate());
        if (hoy < desde) {
          logger.dev(`📅 Playlist "${playlist.nombre}" no activa todavía (inicia ${fechaDesde.toLocaleDateString()})`);
          return false;
        }
      }
      
      if (fechaHasta) {
        const hasta = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth(), fechaHasta.getDate());
        if (hoy > hasta) {
          logger.dev(`📅 Playlist "${playlist.nombre}" ya no está activa (terminó ${fechaHasta.toLocaleDateString()})`);
          return false;
        }
      }
      
      logger.dev(`✅ Playlist "${playlist.nombre}" activa por rango de fechas`);
    }
    
    // 🔧 PASO 2: Validar franja horaria (A QUÉ HORAS del día está activa)
    const hasFranjaHoraria = playlist.activa_desde || playlist.activa_hasta;
    
    if (hasFranjaHoraria) {
      // activa_desde y activa_hasta ahora son strings de hora "HH:MM:SS" o "HH:MM"
      const timeToMinutes = (timeString) => {
        if (!timeString) return null;
        const parts = timeString.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return hours * 60 + minutes;
      };
      
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = timeToMinutes(playlist.activa_desde);
      const endMinutes = timeToMinutes(playlist.activa_hasta);
      
      // Si solo hay una definida, validar el límite
      if (startMinutes !== null && endMinutes === null) {
        if (currentMinutes < startMinutes) {
          logger.dev(`🕐 Playlist "${playlist.nombre}" fuera de franja horaria (inicia a las ${playlist.activa_desde})`);
          return false;
        }
      } else if (startMinutes === null && endMinutes !== null) {
        if (currentMinutes > endMinutes) {
          logger.dev(`🕐 Playlist "${playlist.nombre}" fuera de franja horaria (termina a las ${playlist.activa_hasta})`);
          return false;
        }
      } else if (startMinutes !== null && endMinutes !== null) {
        // Ambas definidas
        let isInRange = false;
        
        if (startMinutes <= endMinutes) {
          // Franja normal (ej: 08:00 - 18:00)
          isInRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
          // Franja que cruza medianoche (ej: 22:00 - 06:00)
          isInRange = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
        
        if (!isInRange) {
          logger.dev(`🕐 Playlist "${playlist.nombre}" fuera de franja horaria (${playlist.activa_desde} - ${playlist.activa_hasta})`);
          return false;
        }
      }
      
      logger.dev(`✅ Playlist "${playlist.nombre}" activa en franja horaria`);
    }
    
    // 🔧 PASO 3: Si no hay restricciones, siempre activa
    if (!hasFechaActivacion && !hasFranjaHoraria) {
      logger.dev(`✅ Playlist "${playlist.nombre}" siempre activa (sin restricciones)`);
      return true;
    }
    
    // Si pasó todas las validaciones, está activa
    return true;
  }

  /**
   * Convertir tiempo HH:MM a minutos desde medianoche
   */
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Seleccionar canción de playlist agendada
   */
  async selectSongFromScheduled(playlist) {
    logger.dev('📅 Seleccionando de playlist agendada:', playlist.nombre);
    
    // Guardar estado de rotación para retorno
    this.saveRotationState();
    this.isInInterrupt = true;
    this.interruptType = 'scheduled';
    
    return await this.loadPlaylistAndSelectSong(playlist);
  }

  /**
   * Seleccionar canción de playlist de intervalo
   */
  async selectSongFromInterval(playlist) {
    logger.dev('🔁 Seleccionando de playlist de intervalo:', playlist.nombre);
    
    // Guardar estado de rotación para retorno
    this.saveRotationState();
    this.isInInterrupt = true;
    this.interruptType = 'interval';
    
    // Reiniciar contador de rotación
    this.globalRotationCounter = 0;
    logger.dev('🔄 Contador de rotación reiniciado');
    
    return await this.loadPlaylistAndSelectSong(playlist);
  }

  /**
   * Seleccionar canción de rotación general (ponderada por peso)
   */
  async selectFromRotation() {
    logger.dev('🌀 Seleccionando de rotación general...');
    
    // Si estamos saliendo de una interrupción, restaurar estado
    if (this.isInInterrupt) {
      this.restoreRotationState();
    }
    
    // Obtener playlists de rotación activas en franja horaria actual
    let activePlaylists = this.getActiveRotationPlaylists();
    
    // 🔧 FALLBACK: Si no hay playlists activas en franja horaria, usar todas las activas
    if (activePlaylists.length === 0) {
      logger.dev('⚠️ No hay playlists de rotación en franja horaria, usando fallback...');
      activePlaylists = this.rotationPlaylists.filter(playlist => playlist?.activa === true || playlist?.activa === 1);
      
      if (activePlaylists.length === 0) {
        throw new Error('No hay playlists de rotación activas en este canal');
      }
      
      logger.dev('🔄 Fallback: usando playlists activas sin restricción horaria:', activePlaylists.map(p => p.nombre));
    }
    
    // Seleccionar playlist ponderada por peso
    const selectedPlaylist = this.selectPlaylistByWeight(activePlaylists);
    logger.dev('🎯 Playlist seleccionada:', selectedPlaylist.nombre, 'peso:', selectedPlaylist.peso);
    
    return await this.loadPlaylistAndSelectSong(selectedPlaylist);
  }

  /**
   * Obtener playlists de rotación activas en la franja horaria actual
   */
  getActiveRotationPlaylists() {
    return this.rotationPlaylists.filter(playlist => this.isPlaylistOperationalNow(playlist));
  }

  /**
   * Seleccionar playlist usando distribución ponderada por peso
   * Implementa un algoritmo de distribución balanceada que evita rachas largas
   */
  selectPlaylistByWeight(playlists) {
    if (playlists.length === 0) return null;
    if (playlists.length === 1) return playlists[0];
    
    // Calcular peso total
    const totalWeight = playlists.reduce((sum, playlist) => sum + playlist.peso, 0);
    
    // Calcular el total de selecciones realizadas
    const totalSelections = Array.from(this.playlistSelectionCounts.values()).reduce((sum, count) => sum + count, 0);
    
    // Calcular "déficit" de cada playlist (cuánto debería haber sonado vs cuánto ha sonado)
    const playlistsWithDeficit = playlists.map(playlist => {
      const currentCount = this.playlistSelectionCounts.get(playlist.id) || 0;
      const expectedCount = (playlist.peso / totalWeight) * totalSelections;
      const deficit = expectedCount - currentCount;
      
      return {
        playlist,
        deficit,
        currentCount,
        expectedCount
      };
    });
    
    // Si es la primera selección o todas tienen el mismo déficit, usar algoritmo aleatorio puro
    if (totalSelections === 0 || playlistsWithDeficit.every(p => p.deficit === playlistsWithDeficit[0].deficit)) {
      const random = Math.floor(Math.random() * totalWeight) + 1;
      let weightSum = 0;
      for (const playlist of playlists) {
        weightSum += playlist.peso;
        if (random <= weightSum) {
          // Incrementar contador
          this.playlistSelectionCounts.set(playlist.id, (this.playlistSelectionCounts.get(playlist.id) || 0) + 1);
          logger.dev('🎲 Selección aleatoria inicial:', playlist.nombre, 'peso:', playlist.peso);
          return playlist;
        }
      }
      return playlists[0];
    }
    
    // Seleccionar la playlist con mayor déficit (que más "debe" sonar)
    // Si hay empate en déficit, usar peso como desempate
    playlistsWithDeficit.sort((a, b) => {
      if (Math.abs(a.deficit - b.deficit) < 0.01) {
        // Empate en déficit, desempatar por peso
        return b.playlist.peso - a.playlist.peso;
      }
      return b.deficit - a.deficit;
    });
    
    const selectedPlaylist = playlistsWithDeficit[0].playlist;
    
    // Incrementar contador
    this.playlistSelectionCounts.set(selectedPlaylist.id, (this.playlistSelectionCounts.get(selectedPlaylist.id) || 0) + 1);
    
    // Log de debug
    logger.dev('🎯 Distribución balanceada:', {
      seleccionada: selectedPlaylist.nombre,
      peso: selectedPlaylist.peso,
      veces: this.playlistSelectionCounts.get(selectedPlaylist.id),
      esperadas: playlistsWithDeficit[0].expectedCount.toFixed(1),
      deficit: playlistsWithDeficit[0].deficit.toFixed(2)
    });
    
    return selectedPlaylist;
  }

  /**
   * Cargar playlist y seleccionar canción según configuración
   */
  async loadPlaylistAndSelectSong(playlist) {
    try {
      if (process.env.NODE_ENV === 'development') {
        logger.dev('🎵 Cargando canciones de playlist:', playlist.nombre, `(${playlist.peso}% peso)`);
      }
      
      // 🚨 VERIFICACIÓN CRÍTICA: ¿La playlist pertenece al canal actual?
      const currentChannelId = this.currentChannel?.id;
      if (playlist.canal_id && playlist.canal_id !== currentChannelId) {
        logger.error('🚨 ERROR CRÍTICO - Playlist de canal incorrecto:', {
          playlistNombre: playlist.nombre,
          playlistCanalId: playlist.canal_id,
          currentChannelId: currentChannelId,
          currentChannelName: this.currentChannel?.nombre
        });
        throw new Error(`Playlist "${playlist.nombre}" pertenece al canal ${playlist.canal_id}, no al canal actual ${currentChannelId}`);
      }
      
      // Cargar canciones de la playlist (pasando canalId para usar cache de RPC)
      const songs = await songsApi.getPlaylistSongs(playlist.id, currentChannelId);
      
      // 🔧 OPTIMIZACIÓN DISK I/O: Log solo en desarrollo
      if (process.env.NODE_ENV === 'development' && songs?.length > 0) {
        logger.dev('📂 Playlist cargada:', playlist.nombre, `(${songs.length} canciones)`);
      }
      
      if (!songs || songs.length === 0) {
        logger.warn('⚠️ Playlist vacía:', playlist.nombre);
        logger.warn('🔍 DEBUG - Playlist vacía detalles:', {
          playlistId: playlist.id,
          apiResponse: songs,
          reason: 'No songs returned from API'
        });
        return null;
      }

      // ✅ NUEVO MODELO: Las canciones son globales, pertenencia vía playlists
      logger.dev('✅ Usando modelo de canciones globales - playlist ya filtrada por canal');
      
      // Todas las canciones de la playlist son válidas (playlist.canal_id ya las filtra)
      // 🔧 FIX: Normalizar formato - las canciones pueden venir de RPC (plano) o fallback (anidado)
      const filteredSongs = songs.filter(song => {
        // Normalizar: song puede ser {titulo, url_s3} (RPC) o {canciones: {titulo, url_s3}} (fallback)
        const songData = song?.canciones || song;
        const hasValidData = songData?.titulo && songData?.url_s3;
        
        if (!hasValidData) {
          logger.warn('🚫 Canción filtrada (datos incompletos):', {
            songTitle: songData?.titulo || 'Sin título',
            hasUrl: !!songData?.url_s3,
            hasTitle: !!songData?.titulo
          });
        }
        
        return hasValidData;
      });

      // 🔧 OPTIMIZACIÓN: Log simplificado
      if (filteredSongs.length !== songs.length) {
        logger.dev('📊 Filtradas:', songs.length - filteredSongs.length, 'canciones inválidas');
      }
      
      if (filteredSongs.length === 0) {
        logger.error('❌ No hay canciones válidas en playlist:', playlist.nombre);
        logger.error('🔍 DEBUG - Información de playlist:', {
          playlistId: playlist.id,
          playlistName: playlist.nombre,
          playlistCanalId: playlist.canal_id,
          currentChannelId,
          totalSongs: songs.length
        });
        return null;
      }
      
      this.currentPlaylist = playlist;
      this.playQueue = filteredSongs; // Usar canciones filtradas
      
      // Seleccionar canción según orden configurado (nuevo esquema usa orden_reproduccion)
      let selectedSong;
      const ordenReproduccion = playlist.orden_reproduccion || playlist.orden || 'aleatorio';
      
      if (ordenReproduccion === 'aleatorio') {
        // 🎰 SISTEMA DE BOLSA: Obtener solo canciones que no se han reproducido aún
        const songsFromBag = this.getSongsFromBag(playlist.id, filteredSongs);
        
        // Selección aleatoria de las canciones disponibles en la bolsa
        const randomIndex = Math.floor(Math.random() * songsFromBag.length);
        selectedSong = songsFromBag[randomIndex];
        
        // Encontrar el índice original en la lista completa para mantener compatibilidad
        this.currentSongIndex = filteredSongs.findIndex(song => 
          (song?.canciones?.id || song?.id) === (selectedSong?.canciones?.id || selectedSong?.id)
        );
        
        // 🎰 Sacar la canción de la bolsa (marcarla como reproducida)
        this.removeSongFromBag(playlist.id, selectedSong);
        
        if (process.env.NODE_ENV === 'development') {
          logger.dev('🎲 Canción aleatoria:', selectedSong?.canciones?.titulo || selectedSong?.titulo);
        }
      } else {
        // Selección secuencial
        if (this.currentSongIndex >= filteredSongs.length) {
          this.currentSongIndex = 0; // Reiniciar al principio
          logger.dev('🔄 Reiniciando índice secuencial al principio');
        }
        selectedSong = filteredSongs[this.currentSongIndex];
        if (process.env.NODE_ENV === 'development') {
          logger.dev('📋 Canción secuencial:', selectedSong?.canciones?.titulo || selectedSong?.titulo);
        }
      }
      
      // ✅ NUEVO MODELO: Canciones globales validadas por playlist.canal_id
      // La canción siempre es correcta porque viene de una playlist filtrada por canal
      logger.dev('✅ Canción seleccionada de playlist del canal actual:', {
        song: selectedSong?.canciones?.titulo || selectedSong?.titulo,
        playlist: playlist.nombre,
        playlistCanalId: playlist.canal_id
      });
      
      // 🔧 NUEVO: Agregar la canción seleccionada al historial para evitar futuras repeticiones
      this.addSongToHistory(selectedSong);
      
      // 🔧 CORRECCIÓN: Actualizar estado inmediatamente para sincronización con UI
      this.currentSong = selectedSong;
      
      // 🔧 CRÍTICO: Emitir evento de cambio de canción para actualizar UI inmediatamente
      if (audioPlayer && audioPlayer.emit) {
        audioPlayer.emit('onSongChange', selectedSong);
      }
      
      // 📊 NUEVO: Registrar canción en historial de reproducción
      this.logSongToHistory(selectedSong);
      
      return selectedSong;
      
    } catch (error) {
      logger.error('❌ Error cargando playlist:', error);
      logger.error('🔍 DEBUG - Error detalles:', {
        playlistId: playlist?.id,
        playlistName: playlist?.nombre,
        errorMessage: error.message,
        errorStack: error.stack
      });
      return null;
    }
  }

  /**
   * FUNCIÓN DE EMERGENCIA: Limpiar completamente el estado cuando se detectan errores de canal
   */
  async emergencyChannelCleanup(reason) {
    logger.error('🚨 ACTIVANDO LIMPIEZA DE EMERGENCIA:', reason);
    
    // 1. Limpiar estado del reproductor de audio
    const cleaned = audioPlayer.forceCleanIncorrectPreloadedSong();
    if (cleaned) {
      logger.dev('🧹 Canción precargada incorrecta eliminada');
    }
    
    // 2. Limpiar queue actual
    this.playQueue = [];
    this.currentSong = null;
    this.currentSongIndex = 0;
    
    // 3. Forzar recarga de playlists del canal
    logger.dev('🔄 Forzando recarga de playlists del canal actual...');
    await this.loadChannelPlaylists();
    
    // 4. Seleccionar nueva canción limpia
    logger.dev('🎯 Seleccionando nueva canción después de limpieza...');
    const newSong = await this.selectNextSong();
    
    if (newSong) {
      await this.loadAndPlaySong(newSong);
      logger.dev('✅ Canción limpia cargada exitosamente');
    } else {
      logger.error('❌ No se pudo cargar canción después de limpieza de emergencia');
    }
  }

  /**
   * Cargar canción sin reproducir automáticamente
   */
  async loadSongOnly(song) {
    if (!song) return false;

    try {
      const songTitle = song?.canciones?.titulo || 'Sin título';
      logger.dev('🎵 Cargando canción:', songTitle);
      
      // Cargar canción en el reproductor
      const success = await audioPlayer.loadSong(song, false);
      
      if (success) {
        this.currentSong = song;
        
        // ✅ OPTIMIZACIÓN: NO precarga automática - solo just-in-time cuando sea necesario
        logger.dev('📼 Canción cargada SIN precarga automática (just-in-time activado)');
        
        return true;
      } else {
        logger.warn('⚠️ Error cargando canción');
        return false;
      }
      
    } catch (error) {
      logger.error('❌ Error en loadSongOnly:', error);
      return false;
    }
  }

  /**
   * Cargar y reproducir canción seleccionada
   */
  async loadAndPlaySong(song) {
    if (!song) return false;

    // 🔧 CORREGIDO: Implementar debouncing para evitar cambios excesivos
    // EXCEPTO cuando estamos recuperándonos de un error de audio
    const now = Date.now();
    const timeSinceLastChange = now - this.lastSongChangeTime;
    
    if (timeSinceLastChange < this.minSongChangeInterval && !this.isRecoveringFromError) {
      logger.dev(`⏱️ Cambio de canción demasiado rápido (${timeSinceLastChange}ms < ${this.minSongChangeInterval}ms) - ignorando`);
      return false;
    }
    
    // 🔧 NUEVO: Si estamos en recuperación de error, permitir cambio inmediato
    if (this.isRecoveringFromError) {
      logger.dev('🚑 Recuperación de error activa - omitiendo protección de tiempo');
    }

    // Si requerimos interacción del usuario, solo cargar
    if (this.requiresUserInteraction) {
      logger.dev('🚫 Se requiere interacción del usuario, solo cargando canción');
      return await this.loadSongOnly(song);
    }

    try {
      const songTitle = song?.canciones?.titulo || 'Sin título';
      logger.dev('🎵 Cargando y reproduciendo:', songTitle);
      
      // 🔧 CORREGIDO: Actualizar timestamp del último cambio
      this.lastSongChangeTime = now;
      
      // Cargar canción en el reproductor
      const success = await audioPlayer.loadSong(song, false);
      
      if (success) {
        this.currentSong = song;
        
        // 🔧 CRÍTICO: Desactivar flag de recuperación tras éxito
        if (this.isRecoveringFromError) {
          logger.dev('✅ Recuperación de error exitosa - restableciendo protección de tiempo');
          this.isRecoveringFromError = false;
        }
        
        // 🔧 SISTEMA HÍBRIDO: Precarga automática si ya está activada, just-in-time si no
        if (this.smartPreloadEnabled) {
          logger.dev('🎯 Canción cargada - Precarga automática ACTIVADA');
          // 🔧 NUEVO: Precarga con manejo de errores mejorado
          setTimeout(async () => {
            try {
              await this.preloadNextSong();
            } catch (preloadError) {
              logger.dev('ℹ️ Error en precarga automática (no crítico):', preloadError.message);
              // No afectar la reproducción por errores de precarga
            }
          }, 1500); // Precarga automática tras carga exitosa
        } else {
          logger.dev('📼 Canción cargada - Just-in-time STANDBY (esperando primera reproducción)');
        }
        
        // 🔧 MEJORADO: Iniciar reproducción automáticamente cuando se carga una nueva canción
        // desde handleSongEnd (transición automática)
        if (!this.requiresUserInteraction) {
          logger.dev('▶️ Iniciando reproducción automática de nueva canción');
          await audioPlayer.play();
        } else {
          logger.dev('ℹ️ Canción cargada pero esperando interacción del usuario para reproducir');
        }
        
        return true;
      } else {
        logger.warn('⚠️ Error cargando canción, intentando siguiente...');
        // 🔧 CRÍTICO: Mantener flag de recuperación para intentar siguiente canción
        if (!this.isInErrorState) {
          return await this.handleSongEnd();
        }
        // Si estamos en estado de error, desactivar flag de recuperación
        this.isRecoveringFromError = false;
        return false;
      }
      
    } catch (error) {
      logger.error('❌ Error en loadAndPlaySong:', error);
      if (!this.isInErrorState) {
        return await this.handleSongEnd();
      }
      // Si estamos en estado de error, desactivar flag de recuperación
      this.isRecoveringFromError = false;
      return false;
    }
  }

  /**
   * Precargar siguiente canción para crossfade
   */
  async preloadNextSong() {
    try {
      // 🔧 NUEVO: Verificar si el crossfade está habilitado antes de intentar precargar
      const audioState = audioPlayer.getState();
      if (!audioState.crossfadeEnabled) {
        logger.dev('ℹ️ Precarga saltada - crossfade desactivado (no es necesario precargar)');
        return;
      }
      
      // Determinar razón de la precarga
      const preloadReason = this.smartPreloadEnabled ? 'AUTO (usuario activo)' : 'JUST-IN-TIME';
      logger.dev(`🔄 Iniciando precarga (${preloadReason})...`);
      
      // No precargar si estamos en estado de error
      if (this.isInErrorState || this.requiresUserInteraction) {
        logger.dev('⏸️ Precarga pausada: estado de error o se requiere interacción');
        return;
      }

      // Throttling para evitar bucles de precarga
      const now = Date.now();
      if (this.lastPreloadAttempt && (now - this.lastPreloadAttempt) < 3000) {
        logger.dev('⏸️ Precarga throttled - demasiados intentos recientes');
        return;
      }
      this.lastPreloadAttempt = now;
      
      // Si ya hay siguiente canción precargada, no hacer nada
      if (audioState.nextSongLoaded) {
        logger.dev('📀 Siguiente canción ya está precargada');
        return;
      }

      const nextSong = await this.peekNextSong();
      if (!nextSong) {
        logger.dev('📭 No hay siguiente canción para precargar');
        return;
      }

      const nextTitle = nextSong?.canciones?.titulo || nextSong?.titulo || 'Sin título';
      logger.dev(`🎵 Precargando (${preloadReason}):`, nextTitle);
      
      const success = await audioPlayer.preloadNextSong(nextSong);
      if (success) {
        logger.dev(`✅ Precarga ${preloadReason} exitosa:`, nextTitle);
        // Resetear contador de errores si la precarga fue exitosa
        this.preloadErrorCount = 0;
      } else {
        // 🔧 NUEVO: Manejo inteligente de errores de precarga
        logger.warn(`⚠️ Error en precarga ${preloadReason}:`, nextTitle);
        
        // 🔧 MEJORADO: Verificar si el crossfade está desactivado en audioPlayerService
        const audioState = audioPlayer.getState();
        if (!audioState.crossfadeEnabled) {
          logger.dev('ℹ️ Error de precarga ignorado - crossfade desactivado (comportamiento normal)');
          this.preloadErrorCount = 0; // Resetear contador ya que es un error esperado
          return;
        }
        
        // Incrementar contador de errores de precarga solo para errores reales
        this.preloadErrorCount = (this.preloadErrorCount || 0) + 1;
        if (this.preloadErrorCount >= 3) {
          logger.warn('🚫 Demasiados errores de precarga, pausando precargas por 30 segundos');
          this.lastPreloadAttempt = now + 25000; // Pausar 30 segundos adicionales
          this.preloadErrorCount = 0;
        }
      }
    } catch (error) {
      logger.warn('⚠️ Error en preloadNextSong:', error);
      // No propagar el error para evitar bucles
      this.preloadErrorCount = (this.preloadErrorCount || 0) + 1;
    }
  }

  /**
   * Obtener siguiente canción sin avanzar índice (para precarga)
   */
  async peekNextSong() {
    try {
      // Lógica simplificada para obtener la siguiente canción
      // Sin modificar el estado actual del AutoDJ
      
      const currentChannelId = this.currentChannel?.id;
      if (!currentChannelId) {
        logger.warn('⚠️ No hay canal actual para peekNextSong');
        return null;
      }
      
      // Si tenemos una playlist actual con canciones, usar la siguiente de esa playlist
      if (this.currentPlaylist && this.playQueue && this.playQueue.length > 0) {
        const nextIndex = (this.currentSongIndex + 1) % this.playQueue.length;
        const nextSong = this.playQueue[nextIndex];
        
        // ✅ NUEVO MODELO: La canción siempre es correcta porque viene de playlist validada
        logger.dev('🔍 peekNextSong - Siguiente de playlist actual:', {
          title: nextSong?.canciones?.titulo,
          playlist: this.currentPlaylist?.nombre,
          playlistCanalId: this.currentPlaylist?.canal_id,
          currentChannelId
        });
        
        logger.dev('✅ peekNextSong - Siguiente autorizada (de playlist del canal actual)');
        return nextSong;
      }

      // Si no hay playlist actual o se acabó, intentar seleccionar de rotación
      if (this.rotationPlaylists && this.rotationPlaylists.length > 0) {
        // Seleccionar playlist aleatoria ponderada (simplificado)
        const randomPlaylist = this.rotationPlaylists[Math.floor(Math.random() * this.rotationPlaylists.length)];
        
        logger.dev('🔍 peekNextSong - Cargando de playlist de rotación:', {
          playlistName: randomPlaylist.nombre,
          playlistId: randomPlaylist.id
        });
        
        // Cargar canciones de esa playlist (pasando canalId para usar cache de RPC)
        const songs = await songsApi.getPlaylistSongs(randomPlaylist.id, this.currentChannelId);
        if (songs && songs.length > 0) {
          // ✅ NUEVO MODELO: Canciones globales, no filtrar por canal_id
          // 🔧 FIX: Normalizar formato - las canciones pueden venir de RPC (plano) o fallback (anidado)
          const filteredSongs = songs.filter(song => {
            const songData = song?.canciones || song;
            const hasValidData = songData?.titulo && songData?.url_s3;
            
            if (!hasValidData) {
              logger.warn('🚫 peekNextSong - Canción filtrada (datos incompletos):', {
                songTitle: songData?.titulo || 'Sin título',
                hasUrl: !!songData?.url_s3
              });
            }
            
            return hasValidData;
          });
          
          logger.dev('📊 peekNextSong - Filtrado de canciones:', {
            originalCount: songs.length,
            filteredCount: filteredSongs.length,
            playlistName: randomPlaylist.nombre
          });
          
          if (filteredSongs.length > 0) {
            // 🔀 Mezclar canciones para garantizar verdadera aleatoriedad
            const shuffledSongs = this.shuffleArray(filteredSongs);
            const randomSong = shuffledSongs[Math.floor(Math.random() * shuffledSongs.length)];
            
            // ✅ NUEVO MODELO: Canción siempre correcta porque viene de playlist del canal
            logger.dev('✅ peekNextSong - Canción seleccionada de rotación:', {
              title: randomSong?.canciones?.titulo,
              playlist: randomPlaylist.nombre,
              playlistCanalId: randomPlaylist.canal_id,
              currentChannelId
            });
            
            return randomSong;
          } else {
            logger.warn('⚠️ peekNextSong - No hay canciones válidas en playlist:', randomPlaylist.nombre);
          }
        }
      }

      logger.warn('📭 peekNextSong - No se pudo encontrar siguiente canción del canal actual');
      return null;
    } catch (error) {
      logger.warn('⚠️ Error en peekNextSong:', error);
      return null;
    }
  }

  /**
   * Guardar estado actual para peek
   */
  saveCurrentState() {
    return {
      currentSongIndex: this.currentSongIndex,
      globalRotationCounter: this.globalRotationCounter,
      isInInterrupt: this.isInInterrupt,
      interruptType: this.interruptType
    };
  }

  /**
   * Restaurar estado después de peek
   */
  restoreCurrentState(state) {
    this.currentSongIndex = state.currentSongIndex;
    this.globalRotationCounter = state.globalRotationCounter;
    this.isInInterrupt = state.isInInterrupt;
    this.interruptType = state.interruptType;
  }

  /**
   * Manejar fin de canción y avanzar
   */
  async handleSongEnd() {
    // 🔧 CRÍTICO: Verificar si está bloqueado por contenido programado
    if (this.blockedByScheduledContent) {
      logger.dev('🚫 handleSongEnd bloqueado - contenido programado tiene prioridad');
      return;
    }
    
    // 🔧 NUEVO: Protección contra ejecuciones concurrentes
    if (this.isHandlingSongEnd) {
      logger.dev('⏸️ handleSongEnd ya en ejecución, saltando...');
      return;
    }
    
    this.isHandlingSongEnd = true;
    
    try {
      // No procesar si estamos en estado de error o requerimos interacción
      if (this.isInErrorState || this.requiresUserInteraction) {
        logger.dev('⏸️ handleSongEnd pausado por estado de error o requerimiento de interacción');
        return;
      }
      
      logger.dev('🎵 AutoDJ: handleSongEnd iniciado');
      
      // Avanzar índice de canción actual
      this.currentSongIndex++;
      
      // Verificar si debe terminar interrupción
      if (this.isInInterrupt && this.shouldEndInterrupt()) {
        logger.dev('🔚 Finalizando interrupción, volviendo a rotación general');
        this.endInterrupt();
      }
      
      // Seleccionar siguiente canción
      const nextSong = await this.selectNextSong();
      if (nextSong) {
        await this.loadAndPlaySong(nextSong);
      } else {
        logger.error('❌ No se pudo seleccionar siguiente canción');
      }
      
    } catch (error) {
      logger.error('❌ Error en handleSongEnd:', error);
      
      // Evitar bucles infinitos en handleSongEnd
      this.errorCount++;
      if (this.errorCount >= this.maxErrors) {
        this.stopErrorLoop();
      }
    } finally {
      // 🔧 NUEVO: Siempre resetear el flag al finalizar
      this.isHandlingSongEnd = false;
    }
  }

  /**
   * Verificar si debe terminar la interrupción actual
   */
  shouldEndInterrupt() {
    if (!this.isInInterrupt || !this.currentPlaylist) return false;
    
    const playlist = this.currentPlaylist;
    
    if (playlist.tipo === 'intervalo') {
      // Para intervalos, terminar según estilo_reproduccion
      if (playlist.estilo_reproduccion === 'aleatorio') {
        return true; // Solo una canción
      } else {
        return this.currentSongIndex >= this.playQueue.length; // Todas las canciones
      }
    }
    
    if (playlist.tipo === 'agendada') {
      // 🔧 MEJORADO: Lógica específica para interrupciones agendadas
      logger.dev('📅 Verificando fin de interrupción agendada:', {
        playlist: playlist.nombre,
        currentSongIndex: this.currentSongIndex,
        playQueueLength: this.playQueue.length,
        estilo_reproduccion: playlist.estilo_reproduccion
      });
      
      if (playlist.estilo_reproduccion === 'aleatorio') {
        // Si es aleatorio, solo una canción
        logger.dev('🎲 Interrupción agendada aleatoria - terminando después de una canción');
        return true;
      } else {
        // Si es secuencial, todas las canciones de la playlist
        const shouldEnd = this.currentSongIndex >= this.playQueue.length;
        logger.dev('📋 Interrupción agendada secuencial:', {
          shouldEnd,
          currentSongIndex: this.currentSongIndex,
          playQueueLength: this.playQueue.length
        });
        return shouldEnd;
      }
    }
    
    return false;
  }

  /**
   * Guardar estado de rotación antes de interrupción
   */
  saveRotationState() {
    this.previousRotationState = {
      playlist: this.currentPlaylist,
      songIndex: this.currentSongIndex,
      playQueue: [...this.playQueue]
    };
    
    logger.dev('💾 Estado de rotación guardado');
  }

  /**
   * Restaurar estado de rotación después de interrupción
   */
  restoreRotationState() {
    if (this.previousRotationState) {
      logger.dev('🔄 Restaurando estado de rotación');
      // No restaurar exactamente, sino continuar con algoritmo normal
      this.isInInterrupt = false;
      this.interruptType = null;
      this.previousRotationState = null;
    }
  }

  /**
   * Finalizar interrupción
   */
  endInterrupt() {
    logger.dev('🔚 Finalizando interrupción:', this.interruptType);
    
    // 🔧 CRÍTICO: Si es interrupción de intervalo, limpiar cola para evitar duplicaciones
    if (this.interruptType === 'interval') {
      logger.dev('🧹 Limpiando cola de intervalos tras finalizar interrupción de intervalo');
      this.pendingIntervalQueue = [];
    }
    
    this.isInInterrupt = false;
    this.interruptType = null;
    this.currentPlaylist = null;
    this.playQueue = [];
    this.currentSongIndex = 0;
    this.previousRotationState = null;
    
    // Reportar estado final
    if (this.pendingIntervalQueue.length > 0) {
      logger.dev('📦 Intervalos en cola restantes:', this.pendingIntervalQueue.length);
    }
  }

  /**
   * Iniciar timers de verificación automática
   */
  startTimers() {
    this.stopTimers(); // Limpiar anteriores
    
    // Timer de reloj local para detectar transiciones de franja horaria
    // OPTIMIZADO: 15s en vez de 1s original (reducción 93% de operaciones)
    // Los cambios de franja horaria no requieren detección al segundo
    this.clockTimer = setInterval(() => {
      if (this.isActive) {
        this.checkTimeFrameTransitions();
      }
    }, 15000); // 15 segundos - balance perfecto entre responsividad y eficiencia
    
    logger.dev('⏰ Timers iniciados (reloj local: 15s optimizado, sync: 5min)');
  }

  /**
   * Detener timers
   */
  stopTimers() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  /**
   * 🔧 NUEVO: Verificar playlists agendadas para interrupciones con crossfade
   */
  async checkScheduledPlaylistsForInterruption() {
    // No verificar si estamos en estado de error o ya en una interrupción
    if (this.isInErrorState || this.isInInterrupt) {
      return;
    }
    
    // Protección: no ejecutar si hay selección de canción en curso
    if (this.isHandlingSongEnd) {
      logger.dev('⏸️ Verificación de agendadas pospuesta - selección de canción en curso');
      return;
    }
    
    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const currentDate = now.toISOString().split('T')[0];
      
      logger.dev('📅 Verificando playlists agendadas para interrupción:', {
        currentDate,
        currentTime: `${Math.floor(currentTime / 60)}:${currentTime % 60}`,
        totalScheduled: this.scheduledPlaylists.length
      });
      
      if (this.scheduledPlaylists.length === 0) {
        return;
      }
      
      for (const playlist of this.scheduledPlaylists) {
        logger.dev('🔍 Analizando playlist agendada para interrupción:', {
          nombre: playlist.nombre,
          fecha: playlist.fecha,
          hora: playlist.hora,
          repetir_programacion: playlist.repetir_programacion,
          activa: playlist.activa,
          puede_interrumpirse: playlist.puede_interrumpirse
        });
        
        // Solo verificar playlists que pueden interrumpir
        if (playlist.puede_interrumpirse && this.isScheduledPlaylistActive(playlist, now, currentTime, currentDate)) {
          logger.dev('🎭 ACTIVANDO INTERRUPCIÓN AGENDADA CON CROSSFADE:', playlist.nombre);
          
          // Guardar estado de rotación
          this.saveRotationState();
          this.isInInterrupt = true;
          this.interruptType = 'scheduled';
          
          // Seleccionar canción de la playlist agendada
          const selectedSong = await this.selectSongFromScheduledPlaylist(playlist);
          
          if (selectedSong) {
            logger.dev('🎵 Canción de interrupción seleccionada:', selectedSong?.canciones?.titulo || selectedSong?.titulo);
            
            // Iniciar crossfade de interrupción
            const success = await audioPlayer.startInterruptionCrossfade(selectedSong);
            
            if (success) {
              logger.dev('✅ Crossfade de interrupción iniciado exitosamente');
              this.currentSong = selectedSong;
              this.currentPlaylist = playlist;
              return; // Solo una interrupción a la vez
            } else {
              logger.warn('⚠️ Fallo en crossfade de interrupción, restaurando estado');
              this.restoreRotationState();
            }
          } else {
            logger.warn('⚠️ No se pudo seleccionar canción de interrupción, restaurando estado');
            this.restoreRotationState();
          }
        }
      }
      
    } catch (error) {
      logger.error('❌ Error verificando playlists agendadas para interrupción:', error);
    }
  }

  /**
   * 🔧 NUEVO: Seleccionar canción de playlist agendada para interrupción
   */
  async selectSongFromScheduledPlaylist(playlist) {
    try {
      logger.dev('📅 Seleccionando canción de playlist agendada para interrupción:', playlist.nombre);
      
      // Cargar canciones de la playlist (pasando canalId para usar cache de RPC)
      const songs = await songsApi.getPlaylistSongs(playlist.id, this.currentChannelId);
      
      if (!songs || songs.length === 0) {
        logger.warn('⚠️ Playlist agendada vacía:', playlist.nombre);
        return null;
      }
      
      // ✅ NUEVO MODELO: Todas las canciones de la playlist son válidas
      // 🔧 FIX: Normalizar formato - las canciones pueden venir de RPC (plano) o fallback (anidado)
      const filteredSongs = songs.filter(song => {
        const songData = song?.canciones || song;
        return songData?.titulo && songData?.url_s3;
      });
      
      if (filteredSongs.length === 0) {
        logger.error('❌ No hay canciones con datos válidos en playlist agendada:', playlist.nombre);
        return null;
      }
      
      // Seleccionar canción según orden configurado (nuevo esquema usa orden_reproduccion)
      let selectedSong;
      const ordenReproduccion = playlist.orden_reproduccion || playlist.orden || 'aleatorio';
      
      if (ordenReproduccion === 'aleatorio') {
        // 🔀 Mezclar canciones para garantizar verdadera aleatoriedad
        const shuffledSongs = this.shuffleArray(filteredSongs);
        const randomIndex = Math.floor(Math.random() * shuffledSongs.length);
        selectedSong = shuffledSongs[randomIndex];
      } else {
        // Selección secuencial
        if (this.currentSongIndex >= filteredSongs.length) {
          this.currentSongIndex = 0;
        }
        selectedSong = filteredSongs[this.currentSongIndex];
      }
      
      logger.dev('✅ Canción de interrupción seleccionada:', {
        playlist: playlist.nombre,
        songTitle: selectedSong?.canciones?.titulo || selectedSong?.titulo,
        songArtist: selectedSong?.canciones?.artista || selectedSong?.artista
      });
      
      return selectedSong;
      
    } catch (error) {
      logger.error('❌ Error seleccionando canción de playlist agendada:', error);
      return null;
    }
  }

  /**
   * Verificación periódica de scheduling
   */
  async checkScheduling() {
    // No hacer nada si estamos en estado de error
    if (this.isInErrorState) return;
    
    // Protección: no ejecutar si hay selección de canción en curso
    if (this.isHandlingSongEnd) {
      logger.dev('⏸️ Verificación de scheduling pospuesta - selección de canción en curso');
      return;
    }
    try {
      logger.dev('🕐 Verificación de scheduling automática');
      // 🔧 NUEVO: Limpiar playlists ejecutadas si cambió de día
      this.cleanupExecutedPlaylists();
      // 🔧 NUEVO: Recargar playlists del canal para detectar cambios
      if (this.currentChannel) {
        logger.dev('🔄 Recargando playlists del canal para detectar cambios...');
        await this.loadChannelPlaylists();
        // Log de estadísticas actualizadas
        logger.dev('📊 Playlists actualizadas:', {
          rotacion: this.rotationPlaylists.length,
          intervalo: this.intervalPlaylists.length,
          agendada: this.scheduledPlaylists.length
        });
      }
    } catch (error) {
      logger.warn('⚠️ Error en verificación de scheduling:', error);
    }
  }

  /**
   * Limpiar playlists ejecutadas cuando cambie de día
   */
  cleanupExecutedPlaylists() {
    const today = new Date().toISOString().split('T')[0];
    const currentKeys = Array.from(this.executedScheduledPlaylists);
    
    for (const key of currentKeys) {
      const keyDate = key.split('_')[1]; // Obtener fecha del key
      if (keyDate !== today) {
        this.executedScheduledPlaylists.delete(key);
        logger.dev('🧹 Limpiando playlist ejecutada de otro día:', key);
      }
    }
  }

  /**
   * Detener bucle infinito de errores
   */
  stopErrorLoop() {
    logger.dev('🛑 Deteniendo bucle de errores');
    this.isActive = false;
    this.stopTimers();
    
    // Mostrar mensaje al usuario
    logger.warn('🚫 AutoDJ pausado debido a errores. Haz clic en el botón de reproducción para continuar.');
  }

  /**
   * Resetear estado de error
   */
  resetErrorState() {
    logger.dev('🔄 Reseteando estado de error');
    this.errorCount = 0;
    this.lastErrorTime = 0;
    this.isInErrorState = false;
    // No resetear requiresUserInteraction aquí - debe hacerse manualmente
  }

  /**
   * Permitir reproducción después de interacción del usuario
   */
  allowPlaybackAfterInteraction() {
    logger.dev('🎯 Interacción del usuario recibida - permitiendo reproducción');
    this.requiresUserInteraction = false;
    this.resetErrorState();
  }

  /**
   * Obtener estado actual del AutoDJ
   */
  getState() {
    const audioState = audioPlayer.getState();
    
    return {
      // Estado general
      isActive: this.isActive,
      currentChannel: this.currentChannel,
      
      // Estado de reproducción
      currentPlaylist: this.currentPlaylist,
      currentSong: this.currentSong,
      isPlaying: audioState.isPlaying,
      
      // Contadores
      globalRotationCounter: this.globalRotationCounter,
      
      // Estado de interrupciones
      isInInterrupt: this.isInInterrupt,
      interruptType: this.interruptType,
      
      // Estado de errores
      isInErrorState: this.isInErrorState,
      requiresUserInteraction: this.requiresUserInteraction,
      errorCount: this.errorCount,
      
      // 🔧 SISTEMA HÍBRIDO: Control de precarga inteligente
      userHasStartedPlaying: this.userHasStartedPlaying,
      smartPreloadEnabled: this.smartPreloadEnabled,
      
      // Estadísticas de playlists
      playlistsLoaded: {
        rotacion: this.rotationPlaylists.length,
        intervalo: this.intervalPlaylists.length,
        agendada: this.scheduledPlaylists.length
      },
      
      // Estado del reproductor
      audioState: audioState
    };
  }

  /**
   * Destruir servicio y limpiar recursos
   */
  destroy() {
    logger.dev('🗑️ Destruyendo AutoDJ Service');
    
    this.stop();
    this.clearAudioEvents();
    this.cleanupRealtimeSubscriptions();
    this.resetState();
  }
}

// Exportar singleton
const autoDj = new AutoDjService();

// 🔧 NUEVO: Hacer disponible globalmente para comunicación con scheduledContentService
if (typeof window !== 'undefined') {
  window.autoDjInstance = autoDj;
  logger.dev('🎛️ AutoDJ disponible globalmente en window.autoDjInstance');
}

export default autoDj; 