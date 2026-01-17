/**
 * AudioPlayerService - Gestiona la reproducción real de audio con crossfade
 * 
 * Sistema de doble reproductor para transiciones suaves:
 * - Player A y Player B se alternan
 * - Crossfade automático al final de cada canción
 * - Nunca se detiene la reproducción
 */

import logger from '../lib/logger.js';
import { convertToCloudFrontUrl } from '../lib/cloudfrontUrls.js';

// 🔧 CONFIGURACIÓN GLOBAL - Para debuggear problemas de crossfade
const CROSSFADE_ENABLED = false; // ⚠️ Desactivado temporalmente para testing
const INTERRUPTION_CROSSFADE_ENABLED = true; // ✅ Crossfade específico para interrupciones agendadas

class AudioPlayerService {
  constructor() {
    // Reproductores alternados para crossfade
    this.playerA = null;
    this.playerB = null;
    this.currentPlayer = 'A'; // 'A' o 'B'
    
    // Control de volumen
    this.masterVolume = 0.8;
    this.musicVolume = 0.8;
    this.contentVolume = 1.0;
    
    // Reproductor de contenidos activo
    this.activeContentPlayer = null;
    
    // Estado de reproducción
    this.isPlaying = false;
    this.isPaused = false;
    this.currentSong = null;
    this.nextSong = null;
    
    // Canal actual para verificaciones
    this.currentChannelId = null;
    
    // Configuración de crossfade
    this.crossfadeDuration = 3000; // 3 segundos
    this.interruptionCrossfadeDuration = 6000; // 6 segundos para interrupciones agendadas
    this.crossfadeStartThreshold = 5; // Iniciar crossfade 5 segundos antes del final
    this.isCrossfading = false;
    this.isInterruptionCrossfade = false; // 🔧 NUEVO: Flag para crossfade de interrupción
    this.isInterruptionActive = false; // 🔧 NUEVO: Flag para interrupción activa
    
    // Estados de carga
    this.isLoading = false;
    this.nextSongLoaded = false;
    
    // 🔧 NUEVO: Flag para evitar doble emisión de onEnd
    this.endEventEmitted = false;
    
    // 🔧 NUEVO: Flag para evitar logs infinitos de crossfade
    this.crossfadeLogShown = false;
    
    // Eventos
    this.eventListeners = {
      onPlay: [],
      onPause: [],
      onEnd: [],
      onError: [],
      onTimeUpdate: [],
      onLoadStart: [],
      onLoadEnd: [],
      onSongChange: [],
      onRequestPreload: [], // Nuevo evento para solicitar precarga
      onInterruptionStart: [], // 🔧 NUEVO: Evento para inicio de interrupción
      onInterruptionEnd: [], // 🔧 NUEVO: Evento para fin de interrupción
    };

    // Throttling para eventos
    this.lastEndEvent = 0;
    this.endEventThrottle = 1000; // 🔧 REDUCIDO: De 2000ms a 1000ms para ser menos restrictivo

    // Watchdog para detectar paradas inesperadas
    this.watchdogInterval = null;
    this.lastProgressTime = 0;
    this.lastCrossfadeTime = 0; // 🔧 NUEVO: Timestamp del último crossfade
    this.lastInterruptionTime = 0; // 🔧 NUEVO: Timestamp de la última interrupción (contenidos programados)
    
    // 🔧 NUEVO: Configuración de debug para watchdog
    this.watchdogDebugMode = false; // Cambiar a true para ver logs detallados

    // 🔧 NUEVO: Poller de respaldo para detectar fin de pista en background (iOS)
    this.backgroundEndPoller = null;

    // Solo mostrar logs de inicialización si hay un usuario autenticado
    // El log se mostrará cuando se acceda por primera vez a través del proxy lazy
    // this.startWatchdog(); // Movido a inicialización lazy
  }

  /**
   * Obtener el reproductor activo actual
   */
  getActivePlayer() {
    return this.currentPlayer === 'A' ? this.playerA : this.playerB;
  }

  /**
   * Obtener el reproductor inactivo (para precargar siguiente canción)
   */
  getInactivePlayer() {
    return this.currentPlayer === 'A' ? this.playerB : this.playerA;
  }

  /**
   * Cargar y preparar una canción para reproducción
   */
  async loadSong(song, preloadNext = false) {
    try {
      const songTitle = song?.canciones?.titulo || song?.titulo || 'Sin título';
      logger.dev(`🎵 ${preloadNext ? 'Precargando siguiente' : 'Cargando'} canción:`, songTitle);
      
      if (!song?.canciones?.url_s3 && !song?.url_s3) {
        throw new Error(`No se encontró URL de audio para: ${songTitle}`);
      }

      // ✅ NUEVO MODELO: Las canciones son globales, no verificar canal_id
      logger.dev('✅ Cargando canción global:', songTitle);

      if (!preloadNext) {
        this.isLoading = true;
        this.emit('onLoadStart', song);
      }
      
      // Crear o reutilizar el mismo elemento de audio (clave para iOS en background)
      let audio = (!CROSSFADE_ENABLED && this.playerA) ? this.playerA : new Audio();
      const originalUrl = song?.canciones?.url_s3 || song?.url_s3;
      // Convertir URL de S3 a CloudFront
      const audioUrl = convertToCloudFrontUrl(originalUrl);
      logger.dev('🔗 URL convertida a CloudFront:', { original: originalUrl, cloudfront: audioUrl });
      
      // 🔧 CRÍTICO: Si reutilizamos el elemento, pausar y limpiar audio anterior
      if (!CROSSFADE_ENABLED && this.playerA) {
        try {
          logger.dev('🧹 Limpiando audio anterior antes de cargar nueva canción');
          audio.pause();
          audio.currentTime = 0;
          // Limpiar src para evitar reproducción residual
          audio.src = '';
          audio.load(); // Forzar limpieza del buffer
        } catch (e) {
          logger.warn('⚠️ Error limpiando audio anterior:', e);
        }
      }
      
      // Si reutilizamos el elemento, quitar handlers previos antes de reconfigurar
      try {
        if (audio._eventHandlers) {
          Object.entries(audio._eventHandlers).forEach(([event, handler]) => {
            audio.removeEventListener(event, handler);
          });
          delete audio._eventHandlers;
        }
      } catch (e) {}

      // Configurar CORS y propiedades
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      // 🔧 CRÍTICO: Aplicar el volumen correcto desde el inicio
      // No usar 0 fijo, sino el volumen que corresponde al tipo de contenido
      const initialVolume = this.calculateVolume(song);
      audio.volume = initialVolume;
      logger.dev('🔊 Volumen inicial aplicado al cargar:', initialVolume);
      // 🔧 CORREGIDO: NO configurar autoplay - dejar que el usuario inicie la reproducción
      try { audio.disableRemotePlayback = true; } catch (e) {}
      
      // Mejoras compatibilidad iOS/background
      try {
        audio.setAttribute('playsinline', '');
        audio.setAttribute('webkit-playsinline', '');
      } catch (e) {}

      // Configurar eventos
      this.setupAudioEvents(audio, song, preloadNext);
      
      // Establecer URL
      audio.src = audioUrl;
      try { audio.load(); } catch (e) {}
      
      // Esperar a que esté listo
      await this.waitForCanPlay(audio);
      
      // 🔧 LÓGICA SIMPLIFICADA sin crossfade
      if (!CROSSFADE_ENABLED) {
        if (preloadNext) {
          logger.dev('🚫 Precarga ignorada - crossfade desactivado');
          return true; // Simular éxito para no romper el flujo
        }
        
        // Solo usar playerA para reproducción simple (reutilizando el mismo elemento)
        this.playerA = audio;
        this.currentPlayer = 'A';
        this.currentSong = song;
        this.isLoading = false;
        // 🔧 NUEVO: Resetear flags para nueva canción
        this.endEventEmitted = false;
        this.crossfadeLogShown = false;
        this.emit('onLoadEnd', song);
        // Notificar a la UI que el audio está listo para reproducirse
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('audio-ready', { detail: { songTitle } }));
          }
        } catch (e) {}
        logger.dev('🎵 Canción cargada en reproductor único (sin crossfade):', songTitle);
        
      } else {
        // 🔧 LÓGICA ORIGINAL con crossfade
        if (preloadNext) {
          // Asignar como siguiente canción
          this.nextSong = song;
          const inactivePlayer = this.getInactivePlayer();
          if (inactivePlayer) {
            this.cleanupPlayer(inactivePlayer);
          }
          
          if (this.currentPlayer === 'A') {
            this.playerB = audio;
          } else {
            this.playerA = audio;
          }
          
          this.nextSongLoaded = true;
          logger.dev('🎵 Siguiente canción precargada:', songTitle);
        } else {
          // Configurar como canción actual
          const activePlayer = this.getActivePlayer();
          if (activePlayer) {
            this.cleanupPlayer(activePlayer);
          }
          
          if (this.currentPlayer === 'A') {
            this.playerA = audio;
          } else {
            this.playerB = audio;
          }
          
          this.currentSong = song;
          this.isLoading = false;
          // 🔧 NUEVO: Resetear flags para nueva canción
          this.endEventEmitted = false;
          this.crossfadeLogShown = false;
          this.emit('onLoadEnd', song);
          // Notificar a la UI que el audio está listo para reproducirse
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('audio-ready', { detail: { songTitle } }));
            }
          } catch (e) {}
          logger.dev('🎵 Canción cargada como actual:', songTitle);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Error cargando canción:', error);
      this.isLoading = false;
      this.emit('onError', error);
      return false;
    }
  }

  /**
   * Configurar eventos de audio con manejo mejorado
   */
  setupAudioEvents(audio, song, isPreload = false) {
    const songTitle = song?.canciones?.titulo || song?.titulo || 'Sin título';
    
    const onTimeUpdate = () => {
      const isCurrentlyActive = this.getActivePlayer() === audio;
      
      // Actualizar progreso siempre que haya reproducción (incluso durante crossfade)
      if (!isPreload && (isCurrentlyActive || this.isCrossfading)) {
        const currentTime = audio.currentTime;
        const duration = audio.duration;
        
        // Actualizar tiempo para watchdog - IMPORTANTE durante crossfade
        this.lastProgressTime = Date.now();
        
        // Solo emitir eventos del reproductor principal
        if (isCurrentlyActive) {
          this.emit('onTimeUpdate', {
            currentTime,
            duration,
            progress: duration > 0 ? (currentTime / duration) * 100 : 0
          });
        }

        // Verificar si debe iniciar crossfade (solo del reproductor principal)
        if (isCurrentlyActive) {
          this.checkForCrossfade(audio);
          
          // 🔧 CRÍTICO: NO emitir onEnd si estamos reproduciendo contenido programado
          // Cuando reutilizamos el reproductor principal para contenido programado,
          // los event listeners siguen activos pero NO deben emitir onEnd
          const isPlayingScheduledContent = this.activeContentPlayer && this.activeContentPlayer === audio;
          
          // 🔧 NUEVO: Verificar si la canción terminó en onTimeUpdate
          if (currentTime >= duration - 0.1 && duration > 0 && !isPlayingScheduledContent) {
            if (!this.endEventEmitted) {
              logger.dev('🔚 Canción terminada detectada en onTimeUpdate - emitiendo onEnd');
              this.endEventEmitted = true;
              this.emit('onEnd', song);
            }
          }
        }
      }
    };

    const onEnded = () => {
      logger.dev('🔚 Canción terminada:', songTitle, {
        isPreload,
        isActivePlayer: this.getActivePlayer() === audio,
        isCrossfading: this.isCrossfading,
        currentTime: audio.currentTime,
        duration: audio.duration,
        progress: audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0
      });
      
      // 🔧 MEJORADO: Throttling más inteligente
      const now = Date.now();
      if (now - this.lastEndEvent < this.endEventThrottle) {
        logger.dev('⚠️ Evento onEnded throttled - muy reciente');
        return;
      }
      
      // 🔧 NUEVO: Verificar si realmente terminó la canción
      if (audio.currentTime < audio.duration - 1) {
        logger.dev('⚠️ Evento onEnded ignorado - canción no terminó realmente');
        return;
      }
      
      this.lastEndEvent = now;

      // 🔧 CRÍTICO: NO emitir onEnd si estamos reproduciendo contenido programado
      const isPlayingScheduledContent = this.activeContentPlayer && this.activeContentPlayer === audio;
      
      // Solo emitir si es el reproductor activo y no estamos en crossfade
      if (!isPreload && this.getActivePlayer() === audio && !this.isCrossfading && !isPlayingScheduledContent) {
        if (!this.endEventEmitted) {
          logger.dev('✅ Emitiendo evento onEnd para AutoDJ');
          this.endEventEmitted = true;
          this.emit('onEnd', song);
        } else {
          logger.dev('⚠️ onEnd ya fue emitido para esta pista, ignorando');
        }
      } else {
        logger.dev('⚠️ No emitiendo onEnd:', {
          isPreload,
          isActivePlayer: this.getActivePlayer() === audio,
          isCrossfading: this.isCrossfading,
          isPlayingScheduledContent
        });
      }
    };

    const onError = (e) => {
      const error = e.target.error;
      let errorMessage = 'Error desconocido';
      let errorCode = 0;
      
      if (error) {
        errorCode = error.code;
        switch (error.code) {
          case 1:
            errorMessage = 'MEDIA_ERR_ABORTED: La reproducción fue abortada';
            break;
          case 2:
            errorMessage = 'MEDIA_ERR_NETWORK: Error de red';
            break;
          case 3:
            errorMessage = 'MEDIA_ERR_DECODE: Error de decodificación';
            break;
          case 4:
            errorMessage = 'MEDIA_ERR_SRC_NOT_SUPPORTED: Formato no soportado o archivo corrupto';
            break;
          default:
            errorMessage = error.message || 'Error de audio desconocido';
        }
      }
      
      logger.error(`❌ Error en audio (${songTitle}):`, {
        code: errorCode,
        message: errorMessage,
        error: error
      });
      
      if (!isPreload && this.getActivePlayer() === audio) {
        this.emit('onError', {
          error: new Error(`Error cargando audio: ${errorMessage}`),
          song: song,
          errorCode,
          errorMessage,
          songTitle,
          originalError: error
        });
      }
    };

    const onPlay = () => {
      if (!isPreload && this.getActivePlayer() === audio) {
        this.isPlaying = true;
        this.isPaused = false;
        this.emit('onPlay', song);
        // Actualizar Media Session (Chrome lockscreen)
        try {
          if ('mediaSession' in navigator) {
            const title = song?.canciones?.titulo || song?.titulo || 'Ondeon SMART';
            const artist = song?.canciones?.artista || song?.artista || '';
            navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist });
            navigator.mediaSession.playbackState = 'playing';
          }
        } catch (e) {}
        // Iniciar poller de fin en background (iOS lockscreen)
        try {
          if (this.backgroundEndPoller) clearInterval(this.backgroundEndPoller);
          this.backgroundEndPoller = setInterval(() => {
            try {
              // 🔧 CRÍTICO: NO emitir onEnd si estamos reproduciendo contenido programado
              const isPlayingScheduledContent = this.activeContentPlayer && this.activeContentPlayer === audio;
              
              if (!audio.paused && audio.duration > 0 && (audio.duration - audio.currentTime) <= 0.2 && !isPlayingScheduledContent) {
                if (!this.endEventEmitted) {
                  logger.dev('🔚 [Poller] Fin detectado en background, emitiendo onEnd');
                  this.endEventEmitted = true;
                  this.emit('onEnd', song);
                }
              }
            } catch (e) {}
          }, 1000);
        } catch (e) {}
      }
    };

    const onPause = () => {
      if (!isPreload && this.getActivePlayer() === audio) {
        this.isPlaying = false;
        this.isPaused = true;
        this.emit('onPause', song);
        try { if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'paused'; } } catch (e) {}
        try { if (this.backgroundEndPoller) { clearInterval(this.backgroundEndPoller); this.backgroundEndPoller = null; } } catch (e) {}
      }
    };

    // Agregar eventos
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    // Guardar referencias para cleanup
    audio._eventHandlers = {
      timeupdate: onTimeUpdate,
      ended: onEnded,
      error: onError,
      play: onPlay,
      pause: onPause
    };
  }

  /**
   * Verificar si debe iniciar crossfade
   */
  checkForCrossfade(audio) {
    if (this.isCrossfading) {
      return;
    }

    const timeRemaining = audio.duration - audio.currentTime;
    const progress = (audio.currentTime / audio.duration) * 100;
    
    // Debug detallado
    if (timeRemaining <= 10 && timeRemaining > 8) {
      logger.dev(`📊 Audio estado:`, {
        currentTime: audio.currentTime.toFixed(1),
        duration: audio.duration.toFixed(1),
        timeRemaining: timeRemaining.toFixed(1),
        progress: progress.toFixed(1) + '%',
        nextSongLoaded: this.nextSongLoaded,
        isCrossfading: this.isCrossfading,
        activePlayer: this.currentPlayer,
        crossfadeEnabled: CROSSFADE_ENABLED
      });
    }
    
    // 🔧 SISTEMA HÍBRIDO: Precarga JUST-IN-TIME más agresiva (20 segundos)
    if (timeRemaining <= 20 && timeRemaining > 19 && !this.nextSongLoaded) {
      logger.dev('🔄 JUST-IN-TIME: Solicitando precarga (quedan ~20 segundos)');
      this.emit('onRequestPreload');
    }
    
    // 🚫 Si crossfade está DESACTIVADO, usar transición simple
    if (!CROSSFADE_ENABLED) {
      // 🔧 CORREGIDO: Solo mostrar log una vez cuando quedan pocos segundos
      if (timeRemaining <= 5 && timeRemaining > 4.5 && !this.crossfadeLogShown) {
        logger.dev('🔚 SIN CROSSFADE: Esperando finalización natural de la canción (quedan', timeRemaining.toFixed(1), 's)');
        this.crossfadeLogShown = true;
      }
      return;
    }
    
    // ✅ CROSSFADE ACTIVADO - Lógica original
    if (!this.nextSongLoaded) {
      if (timeRemaining <= 10) {
        logger.warn('⚠️ Siguiente canción no está precargada, quedan:', timeRemaining.toFixed(1) + 's');
      }
      return;
    }

    // Iniciar crossfade cuando quedan X segundos
    if (timeRemaining <= this.crossfadeStartThreshold && timeRemaining > 0) {
      logger.dev(`🔄 Iniciando crossfade (quedan ${timeRemaining.toFixed(1)}s, progreso: ${progress.toFixed(1)}%)`);
      this.startCrossfade();
    }
  }

  /**
   * Iniciar crossfade entre reproductores (método público)
   */
  async startCrossfade() {
    if (this.isCrossfading) {
      logger.warn('⚠️ Crossfade ya en progreso, ignorando');
      return false;
    }
    
    if (!this.nextSongLoaded) {
      logger.error('❌ No hay siguiente canción precargada para crossfade');
      // Emitir evento onEnd para que AutoDJ maneje la transición manualmente
      this.emit('onEnd', this.currentSong);
      return false;
    }

    // ✅ NUEVO MODELO: Canciones globales, validación vía playlist.canal_id
    // La verificación de canal se hace al cargar la playlist, no por canción individual
    if (this.nextSong && this.nextSong.canciones) {
      const nextSongTitle = this.nextSong.canciones.titulo;
      logger.dev('✅ Crossfade autorizado - canción de playlist del canal actual:', {
        nextSongTitle
      });
    }

    logger.dev('🎭 INICIANDO CROSSFADE - Pausando watchdog');
    this.isCrossfading = true;
    const currentPlayer = this.getActivePlayer();
    const nextPlayer = this.getInactivePlayer();

    logger.dev('🔄 Ejecutando crossfade:', {
      currentPlayer: this.currentPlayer,
      currentSong: this.currentSong?.canciones?.titulo || 'Sin título',
      nextSong: this.nextSong?.canciones?.titulo || 'Sin título',
      playerA: !!this.playerA,
      playerB: !!this.playerB,
      watchdogPaused: this.isCrossfading
    });

    if (!currentPlayer || !nextPlayer) {
      logger.error('❌ No se pueden obtener reproductores para crossfade:', {
        currentPlayer: !!currentPlayer,
        nextPlayer: !!nextPlayer,
        activePlayer: this.currentPlayer
      });
      this.isCrossfading = false;
      // Fallback: emitir onEnd para transición manual
      this.emit('onEnd', this.currentSong);
      return false;
    }

          try {
        // Timeout de seguridad para crossfade
        const crossfadeTimeout = setTimeout(() => {
          logger.error('⏰ Timeout de crossfade - forzando finalización');
          this.isCrossfading = false;
          this.emit('onEnd', this.currentSong);
        }, this.crossfadeDuration + 5000); // 5 segundos extra de margen

        // Configurar volúmenes iniciales
        const currentInitialVolume = this.calculateVolume(this.currentSong);
        const nextFinalVolume = this.calculateVolume(this.nextSong);
        
        logger.dev('🎚️ Configurando volúmenes crossfade:', {
          currentInitialVolume,
          nextFinalVolume
        });
        
        nextPlayer.volume = 0;
        currentPlayer.volume = currentInitialVolume;

        // Iniciar reproducción del siguiente reproductor
        logger.dev('▶️ Iniciando reproductor siguiente');
        await nextPlayer.play();

        // Realizar crossfade gradual
        const fadeSteps = 60; // Más pasos para suavidad
        const stepDuration = this.crossfadeDuration / fadeSteps;

        logger.dev('🔄 Iniciando fade gradual:', { fadeSteps, stepDuration });

        for (let i = 0; i <= fadeSteps; i++) {
          const progress = i / fadeSteps;
          
          // Verificar que los reproductores siguen válidos
          if (!currentPlayer || !nextPlayer) {
            throw new Error('Reproductores se volvieron nulos durante crossfade');
          }
          
          // Verificar que no se haya cancelado el crossfade
          if (!this.isCrossfading) {
            logger.warn('⚠️ Crossfade cancelado durante ejecución');
            break;
          }
          
          // Fade out actual
          currentPlayer.volume = currentInitialVolume * (1 - progress);
          
          // Fade in siguiente
          nextPlayer.volume = nextFinalVolume * progress;
          
          await new Promise(resolve => setTimeout(resolve, stepDuration));
        }

        // Limpiar timeout si llegamos aquí exitosamente
        clearTimeout(crossfadeTimeout);

        // Solo finalizar si seguimos en crossfade
        if (this.isCrossfading) {
          logger.dev('✅ Finalizando crossfade');
          this.completeCrossfade();
          return true;
        } else {
          logger.warn('⚠️ Crossfade interrumpido, no finalizando');
          return false;
        }

      } catch (error) {
        logger.error('❌ Error durante crossfade:', error);
        this.isCrossfading = false;
        
        // Fallback crítico: si crossfade falla, emitir onEnd para continuar reproducción
        logger.dev('🔄 Fallback: emitiendo onEnd por error en crossfade');
        this.emit('onEnd', this.currentSong);
        return false;
      }
  }

  /**
   * Completar crossfade y cambiar reproductor activo
   */
  completeCrossfade() {
    const currentPlayer = this.getActivePlayer();
    
    logger.dev('🎭 COMPLETANDO CROSSFADE - Reactivando watchdog');
    
    // Pausar y limpiar reproductor anterior
    if (currentPlayer) {
      currentPlayer.pause();
      this.cleanupPlayer(currentPlayer);
    }

    // Cambiar reproductor activo
    const previousPlayer = this.currentPlayer;
    this.currentPlayer = this.currentPlayer === 'A' ? 'B' : 'A';
    this.currentSong = this.nextSong;
    this.nextSong = null;
    this.nextSongLoaded = false;
    this.isCrossfading = false; // IMPORTANTE: Reactivar watchdog

    logger.dev('✅ Crossfade completado:', {
      previousPlayer,
      newActivePlayer: this.currentPlayer,
      newSong: this.currentSong?.canciones?.titulo || this.currentSong?.titulo || 'Sin título',
      watchdogReactivated: !this.isCrossfading
    });
    
    // Actualizar progreso inmediatamente para watchdog
    this.lastProgressTime = Date.now();
    
    // Emitir evento de cambio de canción
    this.emit('onSongChange', this.currentSong);
  }

  /**
   * 🔧 NUEVO: Iniciar crossfade de interrupción agendada
   * Método específico para interrupciones de playlists agendadas
   */
  async startInterruptionCrossfade(interruptionSong) {
    if (!INTERRUPTION_CROSSFADE_ENABLED) {
      logger.dev('🚫 Crossfade de interrupción desactivado - reproducción directa');
      return await this.loadAndPlayInterruption(interruptionSong);
    }

    // 🔧 ELIMINADO: Verificación que causaba fallo en crossfade
    // Permitir interrupciones incluso si hay crossfade en progreso

    logger.dev('🎭 INICIANDO CROSSFADE DE INTERRUPCIÓN AGENDADA');
    this.isCrossfading = true;
    this.isInterruptionCrossfade = true;
    this.isInterruptionActive = true; // 🔧 NUEVO: Activar flag de interrupción

    try {
      // Emitir evento de inicio de interrupción
      this.emit('onInterruptionStart', {
        currentSong: this.currentSong,
        interruptionSong: interruptionSong
      });

      // Cargar canción de interrupción en el reproductor inactivo
      const inactivePlayer = this.getInactivePlayer();
      if (inactivePlayer) {
        this.cleanupPlayer(inactivePlayer);
      }

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.volume = 0; // Empezar en silencio

      // Configurar eventos básicos para la canción de interrupción
      audio.addEventListener('canplaythrough', () => {
        logger.dev('✅ Canción de interrupción lista para reproducir');
      });

      audio.addEventListener('error', (e) => {
        logger.error('❌ Error cargando canción de interrupción:', e);
        this.isCrossfading = false;
        this.isInterruptionCrossfade = false;
        this.isInterruptionActive = false; // 🔧 NUEVO: Desactivar flag de interrupción
      });

      const originalInterruptionUrl = interruptionSong?.canciones?.url_s3 || interruptionSong?.url_s3;
      const audioUrl = convertToCloudFrontUrl(originalInterruptionUrl);
      logger.dev('🔗 URL de interrupción convertida a CloudFront:', { original: originalInterruptionUrl, cloudfront: audioUrl });
      audio.src = audioUrl;

      // Esperar a que esté listo
      await this.waitForCanPlay(audio);

      // Asignar al reproductor inactivo
      if (this.currentPlayer === 'A') {
        this.playerB = audio;
      } else {
        this.playerA = audio;
      }

      const currentPlayer = this.getActivePlayer();
      const nextPlayer = this.getInactivePlayer();

      if (!currentPlayer || !nextPlayer) {
        throw new Error('No se pueden obtener reproductores para crossfade de interrupción');
      }

      // Configurar volúmenes iniciales
      const currentInitialVolume = this.calculateVolume(this.currentSong);
      const nextFinalVolume = this.calculateVolume(interruptionSong);

      logger.dev('🎚️ Configurando volúmenes crossfade de interrupción:', {
        currentInitialVolume,
        nextFinalVolume,
        duration: this.interruptionCrossfadeDuration
      });

      nextPlayer.volume = 0;
      currentPlayer.volume = currentInitialVolume;

      // Iniciar reproducción del reproductor de interrupción
      logger.dev('▶️ Iniciando reproductor de interrupción');
      await nextPlayer.play();

      // Realizar crossfade gradual más largo para interrupciones
      const fadeSteps = 120; // Más pasos para mayor suavidad
      const stepDuration = this.interruptionCrossfadeDuration / fadeSteps;

      logger.dev('🔄 Iniciando fade gradual de interrupción:', { fadeSteps, stepDuration });

      for (let i = 0; i <= fadeSteps; i++) {
        const progress = i / fadeSteps;

        // Verificar que los reproductores siguen válidos
        if (!currentPlayer || !nextPlayer) {
          throw new Error('Reproductores se volvieron nulos durante crossfade de interrupción');
        }

        // Verificar que no se haya cancelado el crossfade
        if (!this.isCrossfading) {
          logger.warn('⚠️ Crossfade de interrupción cancelado durante ejecución');
          break;
        }

        // Fade out actual
        currentPlayer.volume = currentInitialVolume * (1 - progress);

        // Fade in interrupción
        nextPlayer.volume = nextFinalVolume * progress;

        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }

      // Completar crossfade de interrupción
      if (this.isCrossfading) {
        logger.dev('✅ Finalizando crossfade de interrupción');
        this.completeInterruptionCrossfade(interruptionSong);
        return true;
      } else {
        logger.warn('⚠️ Crossfade de interrupción interrumpido');
        return false;
      }

    } catch (error) {
      logger.error('❌ Error durante crossfade de interrupción:', error);
      this.isCrossfading = false;
      this.isInterruptionCrossfade = false;
      this.isInterruptionActive = false; // 🔧 NUEVO: Desactivar flag de interrupción
      
      // Fallback: cargar interrupción directamente
      logger.dev('🔄 Fallback: cargando interrupción directamente');
      return await this.loadAndPlayInterruption(interruptionSong);
    }
  }

  /**
   * 🔧 NUEVO: Completar crossfade de interrupción
   */
  completeInterruptionCrossfade(interruptionSong) {
    const currentPlayer = this.getActivePlayer();

    logger.dev('🎭 COMPLETANDO CROSSFADE DE INTERRUPCIÓN - Reactivando watchdog');

    // Pausar y limpiar reproductor anterior
    if (currentPlayer) {
      currentPlayer.pause();
      this.cleanupPlayer(currentPlayer);
    }

    // Cambiar reproductor activo
    const previousPlayer = this.currentPlayer;
    this.currentPlayer = this.currentPlayer === 'A' ? 'B' : 'A';
    this.currentSong = interruptionSong;
    this.isCrossfading = false;
    this.isInterruptionCrossfade = false;
    this.isInterruptionActive = false; // 🔧 NUEVO: Desactivar flag de interrupción

    logger.dev('✅ Crossfade de interrupción completado:', {
      previousPlayer,
      newActivePlayer: this.currentPlayer,
      newSong: this.currentSong?.canciones?.titulo || this.currentSong?.titulo || 'Sin título',
      watchdogReactivated: !this.isCrossfading
    });

    // 🔧 MEJORADO: Resetear watchdog para nueva canción
    this.lastProgressTime = Date.now();
    this.lastCrossfadeTime = Date.now(); // 🔧 NUEVO: Actualizar timestamp del crossfade
    
    // 🔧 NUEVO: Resetear completamente el estado del watchdog
    setTimeout(() => {
      // Forzar actualización del progreso después de un breve delay
      const activePlayer = this.getActivePlayer();
      if (activePlayer && !activePlayer.paused) {
        this.lastProgressTime = Date.now();
        logger.dev('🔄 Watchdog reseteado para nueva canción después de crossfade');
        
        // 🔧 CRÍTICO: Verificar que el watchdog esté monitoreando la canción correcta
        logger.dev('🔍 Verificación watchdog post-crossfade:', {
          currentSong: this.currentSong?.canciones?.titulo || this.currentSong?.titulo,
          activePlayerCurrentTime: activePlayer.currentTime,
          activePlayerDuration: activePlayer.duration,
          lastProgressTime: this.lastProgressTime
        });
      }
    }, 2000); // Aumentado a 2 segundos para dar más tiempo

    // Emitir eventos
    this.emit('onSongChange', this.currentSong);
    this.emit('onInterruptionEnd', {
      previousSong: this.currentSong,
      currentSong: this.currentSong
    });
  }

  /**
   * 🔧 NUEVO: Cargar y reproducir interrupción directamente (fallback)
   */
  async loadAndPlayInterruption(interruptionSong) {
    logger.dev('🎵 Cargando interrupción directamente (sin crossfade)');
    
    try {
      const success = await this.loadSong(interruptionSong, false);
      if (success) {
        this.currentSong = interruptionSong;
        await this.play();
        
        // Emitir eventos de interrupción
        this.emit('onInterruptionStart', {
          currentSong: this.currentSong,
          interruptionSong: interruptionSong
        });
        this.emit('onInterruptionEnd', {
          previousSong: this.currentSong,
          currentSong: this.currentSong
        });
        
        return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Error cargando interrupción directamente:', error);
      return false;
    }
  }

  /**
   * Precargar siguiente canción para crossfade
   */
  async preloadNextSong(song) {
    if (!song) return false;
    
    // 🚫 Si crossfade está DESACTIVADO, no precargar
    if (!CROSSFADE_ENABLED) {
      logger.dev('🚫 Precarga saltada - crossfade desactivado');
      return false;
    }
    
    // ✅ NUEVO MODELO: Las canciones son globales, no verificar canal_id
    const songTitle = song?.canciones?.titulo || song?.titulo || 'Sin título';
    logger.dev('✅ Precargando canción global:', songTitle);
    
    return await this.loadSong(song, true);
  }

  /**
   * Esperar a que el audio esté listo para reproducir
   */
  waitForCanPlay(audio) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout cargando audio'));
      }, 12000);

      const cleanup = () => {
        clearTimeout(timeout);
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('loadeddata', onReady);
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('error', onError);
      };

      const onReady = () => {
        // readyState >= 3 suele ser suficiente en iOS
        if (audio.readyState >= 3) {
          cleanup();
          resolve();
        }
      };

      const onMeta = () => {
        // Si ya tenemos metadata y el buffer permite reproducir, resolver
        if (audio.readyState >= 3) {
          cleanup();
          resolve();
        }
      };

      const onError = (e) => {
        cleanup();
        reject(new Error(`Error cargando audio: ${e.message || 'desconocido'}`));
      };

      // Múltiples eventos para compatibilidad iOS
      audio.addEventListener('canplaythrough', onReady);
      audio.addEventListener('canplay', onReady);
      audio.addEventListener('loadeddata', onReady);
      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('error', onError);

      // Si el elemento ya está listo (raro, pero posible)
      if (audio.readyState >= 3) {
        cleanup();
        resolve();
      }
    });
  }

  /**
   * Reproducir audio actual
   */
  async play() {
    let activePlayer;
    
    // 🔧 LÓGICA SIMPLIFICADA sin crossfade
    if (!CROSSFADE_ENABLED) {
      activePlayer = this.playerA;
      if (!activePlayer) {
        logger.error('❌ No hay reproductor único para reproducir');
        return false;
      }
    } else {
      // 🔧 LÓGICA ORIGINAL con crossfade
      activePlayer = this.getActivePlayer();
      if (!activePlayer) {
        logger.error('❌ No hay reproductor activo para reproducir');
        return false;
      }
    }

    try {
      // 🔧 CRÍTICO: Solo aplicar volumen si no está ya configurado o si ha cambiado
      // Esto respeta el estado de muteo/volumen actual
      const calculatedVolume = this.calculateVolume(this.currentSong);
      if (activePlayer.volume !== calculatedVolume) {
        activePlayer.volume = calculatedVolume;
        logger.dev('🔊 Volumen aplicado en play():', calculatedVolume);
      }
      await activePlayer.play();
      logger.dev('▶️ Reproducción iniciada');
      return true;
    } catch (error) {
      logger.warn('⚠️ play() falló, reintentando tras load()...', error?.name || error);
      try {
        if (activePlayer.readyState < 3) {
          try { activePlayer.load(); } catch (e) {}
          await this.waitForCanPlay(activePlayer);
        }
        await activePlayer.play();
        logger.dev('✅ Reproducción iniciada tras reintento');
        return true;
      } catch (err2) {
        logger.error('❌ Error iniciando reproducción tras reintento:', err2);
        this.emit('onError', err2);
        return false;
      }
    }
  }

  /**
   * Pausar reproducción
   */
  pause() {
    let activePlayer;
    
    // 🔧 LÓGICA SIMPLIFICADA sin crossfade
    if (!CROSSFADE_ENABLED) {
      activePlayer = this.playerA;
    } else {
      // 🔧 LÓGICA ORIGINAL con crossfade
      activePlayer = this.getActivePlayer();
    }
    
    if (activePlayer) {
      activePlayer.pause();
      logger.dev('⏸️ Reproducción pausada');
    }
  }

  /**
   * Detener reproducción
   */
  stop() {
    this.pause();
    this.isPlaying = false;
    this.isPaused = false;
    logger.dev('⏹️ Reproducción detenida');
  }

  /**
   * Cambiar a siguiente canción (usado si no hay crossfade)
   */
  async playNext(nextSong) {
    if (!nextSong) return false;
    
    logger.dev('⏭️ Cambiando a siguiente canción (sin crossfade)');
    
    // Si ya está precargada, hacer crossfade inmediato
    if (this.nextSongLoaded && this.nextSong) {
      await this.startCrossfade();
      return true;
    }
    
    // Si no, carga directa (fallback)
    const success = await this.loadSong(nextSong, false);
    if (success && this.isPlaying) {
      await this.play();
    }
    
    return success;
  }

  /**
   * Calcular volumen según tipo de contenido
   */
  calculateVolume(song) {
    if (!song) return this.masterVolume;
    
    // Si es contenido publicitario, usar contentVolume
    if (song?.tipo === 'anuncio' || song?.canciones?.genero === 'anuncio') {
      return this.contentVolume * this.masterVolume;
    }
    
    // Para música normal
    const calculatedVolume = this.musicVolume * this.masterVolume;
    logger.dev('🔍 calculateVolume() - musicVolume:', this.musicVolume, 'masterVolume:', this.masterVolume, '→ resultado:', calculatedVolume);
    return calculatedVolume;
  }

  /**
   * Configurar volumen de música
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    
    // Aplicar a reproductor activo si está reproduciendo música
    const activePlayer = this.getActivePlayer();
    if (activePlayer && this.currentSong?.tipo !== 'anuncio') {
      activePlayer.volume = this.calculateVolume(this.currentSong);
    }
    
    logger.dev('🎵 Volumen música:', this.musicVolume);
  }

  /**
   * Configurar volumen de contenido
   */
  setContentVolume(volume) {
    this.contentVolume = Math.max(0, Math.min(1, volume));
    
    // Aplicar a reproductor activo si está reproduciendo anuncio
    const activePlayer = this.getActivePlayer();
    if (activePlayer && this.currentSong?.tipo === 'anuncio') {
      activePlayer.volume = this.calculateVolume(this.currentSong);
    }
    
    logger.dev('📢 Volumen contenido:', this.contentVolume);
  }

  /**
   * Configurar volumen maestro
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    
    // Aplicar a todos los reproductores activos
    if (this.playerA && !this.isCrossfading) {
      this.playerA.volume = this.calculateVolume(this.currentSong);
    }
    if (this.playerB && !this.isCrossfading) {
      this.playerB.volume = this.calculateVolume(this.currentSong);
    }
    
    logger.dev('🔊 Volumen maestro:', this.masterVolume);
  }

  /**
   * Obtener estado actual del reproductor
   */
  getState() {
    let activePlayer;
    
    // 🔧 LÓGICA SIMPLIFICADA sin crossfade
    if (!CROSSFADE_ENABLED) {
      activePlayer = this.playerA;
    } else {
      // 🔧 LÓGICA ORIGINAL con crossfade
      activePlayer = this.getActivePlayer();
    }
    // 🔧 NUEVO: Preferir el reproductor de CONTENIDO si está activo
    const visualizerElement = this.activeContentPlayer || activePlayer;

    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isLoading: this.isLoading,
      isCrossfading: CROSSFADE_ENABLED ? this.isCrossfading : false,
      isInterruptionCrossfade: this.isInterruptionCrossfade,
      crossfadeEnabled: CROSSFADE_ENABLED,
      interruptionCrossfadeEnabled: INTERRUPTION_CROSSFADE_ENABLED,
      currentSong: this.currentSong,
      nextSong: CROSSFADE_ENABLED ? this.nextSong : null,
      nextSongLoaded: CROSSFADE_ENABLED ? this.nextSongLoaded : false,
      volume: this.masterVolume,
      musicVolume: this.musicVolume,
      contentVolume: this.contentVolume,
      currentTime: visualizerElement?.currentTime || 0,
      duration: visualizerElement?.duration || 0,
      activePlayer: CROSSFADE_ENABLED ? this.currentPlayer : 'A',
      audioElement: visualizerElement, // 🎵 Elemento de audio para Web Audio API (contenido > música)
      isPlayingScheduledContent: !!this.activeContentPlayer // 🔧 CRÍTICO: Indica si hay contenido programado activo
    };
  }

  /**
   * Función de debug para monitorear estado detallado
   */
  debugState() {
    const activePlayer = this.getActivePlayer();
    const inactivePlayer = this.getInactivePlayer();
    
    logger.dev('🔍 Debug AudioPlayer:', {
      // Estado general
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      isLoading: this.isLoading,
      isCrossfading: this.isCrossfading,
      
      // Reproductores
      currentPlayer: this.currentPlayer,
      playerA_exists: !!this.playerA,
      playerB_exists: !!this.playerB,
      activePlayer_exists: !!activePlayer,
      inactivePlayer_exists: !!inactivePlayer,
      
      // Canciones
      currentSong: this.currentSong?.canciones?.titulo || 'Sin canción',
      nextSong: this.nextSong?.canciones?.titulo || 'Sin siguiente',
      nextSongLoaded: this.nextSongLoaded,
      
      // Timing
      currentTime: activePlayer?.currentTime?.toFixed(1) || 0,
      duration: activePlayer?.duration?.toFixed(1) || 0,
      timeRemaining: activePlayer?.duration ? (activePlayer.duration - activePlayer.currentTime).toFixed(1) : 0,
      progress: activePlayer?.duration ? ((activePlayer.currentTime / activePlayer.duration) * 100).toFixed(1) + '%' : '0%',
      
      // Estados de reproductores
      playerA_src: this.playerA?.src || 'Vacío',
      playerB_src: this.playerB?.src || 'Vacío',
      activePlayer_volume: activePlayer?.volume?.toFixed(2) || 0,
      inactivePlayer_volume: inactivePlayer?.volume?.toFixed(2) || 0
    });
    
    return this.getState();
  }

  /**
   * Watchdog para detectar paradas inesperadas de reproducción
   */
  startWatchdog() {
    // Watchdog habilitado: detecta finales en background (iOS/Safari)
    // y recupera reproducción si se queda colgada entre pistas.

    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
    }

    this.watchdogInterval = setInterval(() => {
      const activePlayer = this.getActivePlayer();
      
      // 🔧 MEJORADO: No verificar durante crossfade o interrupciones
      if (this.isCrossfading || this.isInterruptionCrossfade) {
        logger.dev('🔄 Watchdog pausado durante crossfade/interrupción');
        return;
      }
      
      // 🔧 NUEVO: Protección adicional después de interrupciones y crossfades
      const timeSinceProgress = Date.now() - this.lastProgressTime;
      const timeSinceCrossfade = Date.now() - this.lastCrossfadeTime;
      const timeSinceInterruption = Date.now() - this.lastInterruptionTime;
      
      // Período de gracia después de crossfades (15 segundos)
      if (timeSinceCrossfade < 15000) {
        if (this.watchdogDebugMode) logger.dev('🔄 Watchdog en período de gracia después de crossfade');
        return;
      }
      
      // Período de gracia después de contenidos programados/interrupciones (10 segundos)
      if (this.lastInterruptionTime > 0 && timeSinceInterruption < 10000) {
        if (this.watchdogDebugMode) logger.dev('🔄 Watchdog en período de gracia después de interrupción');
        return;
      }
      
      // 🔧 ELIMINADO: Período de gracia que no funciona
      // El watchdog se desactiva completamente durante interrupciones
      
      // 🔧 NUEVO: Desactivar watchdog completamente durante interrupciones agendadas
      if (this.isInterruptionCrossfade) {
        logger.dev('🔄 Watchdog desactivado durante interrupción agendada');
        return; // No verificar nada durante interrupciones agendadas
      }
      
      // 🔧 NUEVO: Desactivar watchdog también cuando hay interrupción activa
      if (this.isInterruptionActive) {
        logger.dev('🔄 Watchdog desactivado - interrupción activa');
        return;
      }
      
      // 🔧 CRÍTICO: Desactivar watchdog durante crossfade de interrupción
      if (this.isInterruptionCrossfade) {
        logger.dev('🔄 Watchdog desactivado - crossfade de interrupción activo');
        return;
      }
      
      // 🔧 MEJORADO: Solo verificar si hay un problema potencial
      const expectedSong = this.currentSong?.canciones?.titulo || this.currentSong?.titulo;
      if (!activePlayer || !expectedSong) {
        return; // No hay nada que verificar
      }
      
      // 🔧 NUEVO: Log de debug opcional
      if (this.watchdogDebugMode) {
        logger.dev('🔍 Watchdog verificando:', {
          expectedSong,
          currentTime: activePlayer.currentTime,
          duration: activePlayer.duration,
          isPlaying: this.isPlaying
        });
      }
      
      if (this.isPlaying && activePlayer && !activePlayer.paused) {
        const currentTime = activePlayer.currentTime;
        const timeSinceLastProgress = Date.now() - this.lastProgressTime;
        
        // 🔧 MEJORADO: Solo verificar si hay un problema real (más de 8 segundos sin progreso)
        if (timeSinceLastProgress > 8000 && this.lastProgressTime > 0) {
        
        // 🔧 CRÍTICO: NO emitir onEnd si estamos reproduciendo contenido programado
        const isPlayingScheduledContent = this.activeContentPlayer && this.activeContentPlayer === activePlayer;
        
        // 🔧 NUEVO: Verificar si la canción terminó antes de reportar problema
        if (activePlayer.currentTime >= activePlayer.duration - 0.5 && !isPlayingScheduledContent) {
          if (!this.endEventEmitted) {
            logger.dev('🔚 Canción terminada detectada por watchdog - emitiendo onEnd');
            this.endEventEmitted = true;
            this.emit('onEnd', this.currentSong);
          }
          return;
        }
        
        // 🔧 MEJORADO: Solo mostrar logs cuando hay un problema real
        logger.warn('🚨 Watchdog: Reproducción detenida inesperadamente');
        logger.dev('📊 Estado watchdog:', {
          expectedSong,
          isPlaying: this.isPlaying,
          isPaused: activePlayer.paused,
          currentTime: currentTime,
          timeSinceLastProgress,
          duration: activePlayer.duration,
          isCrossfading: this.isCrossfading,
          isInterruptionCrossfade: this.isInterruptionCrossfade
        });
          
                // 🔧 MEJORADO: Verificar si realmente está colgado antes de recovery
      if (activePlayer.readyState >= 3 && activePlayer.networkState === 1) {
        logger.dev('🔍 Verificando si realmente está colgado...');
        // Solo hacer recovery si realmente está colgado
        this.attemptRecovery();
      } else {
        // 🔧 MEJORADO: Solo log si hay un problema real
        if (timeSinceLastProgress > 15000) { // Solo después de 15 segundos
          logger.dev('ℹ️ Audio en estado de carga, ignorando watchdog');
        }
        // Resetear el tiempo de progreso para dar más tiempo
        this.lastProgressTime = Date.now();
      }
        }
      }
    }, 10000); // 🔧 OPTIMIZADO: Verificar cada 10 segundos (reducción 50% vs 5s) - suficiente para detectar problemas
  }

  /**
   * Intentar recuperar la reproducción
   */
  async attemptRecovery() {
    try {
      // PROTECCIÓN CRÍTICA: No intentar recovery durante crossfade
      if (this.isCrossfading) {
        logger.dev('🔄 Recovery cancelado - crossfade en progreso');
        return;
      }
      
      logger.dev('🔧 Intentando recuperar reproducción...');
      const activePlayer = this.getActivePlayer();
      
      if (!activePlayer) {
        logger.error('❌ No hay reproductor activo para recuperar');
        this.emit('onEnd', this.currentSong);
        return;
      }

      // Verificar si realmente está parado
      if (activePlayer.paused || activePlayer.ended) {
        logger.dev('🔄 Reproductor pausado/terminado, reintentando...');
        
        // Si terminó, emitir evento onEnd
        if (activePlayer.ended) {
          logger.dev('📢 Emitiendo onEnd por recuperación - canción terminada');
          this.emit('onEnd', this.currentSong);
          return;
        }
        
        // Si solo está pausado, intentar reproducir
        await activePlayer.play();
        logger.dev('✅ Reproducción recuperada desde pausa');
        return;
      }

      // Caso crítico: Audio "colgado" - dice que reproduce pero no progresa
      logger.dev('🚨 Audio colgado detectado - verificando si es falso positivo...');
      logger.dev('📊 Estado antes del reset:', {
        currentTime: activePlayer.currentTime,
        duration: activePlayer.duration,
        readyState: activePlayer.readyState,
        networkState: activePlayer.networkState,
        paused: activePlayer.paused,
        ended: activePlayer.ended,
        isCrossfading: this.isCrossfading // DEBUG: verificar estado crossfade
      });

      // 🔧 MEJORADO: Verificar si realmente está colgado o es un falso positivo
      // Después de crossfades, puede haber un breve período donde el progreso parece detenido
      if (activePlayer.readyState >= 3 && activePlayer.networkState === 1 && !activePlayer.paused) {
        // 🔧 CRÍTICO: NO emitir onEnd si estamos reproduciendo contenido programado
        const isPlayingScheduledContent = this.activeContentPlayer && this.activeContentPlayer === activePlayer;
        
        // 🔧 NUEVO: Verificar si la canción realmente terminó
        if (activePlayer.currentTime >= activePlayer.duration - 0.5 && !isPlayingScheduledContent) {
          if (!this.endEventEmitted) {
            logger.dev('🔚 Canción terminada detectada por watchdog - emitiendo onEnd');
            this.endEventEmitted = true;
            this.emit('onEnd', this.currentSong);
          }
          return;
        }
        
        // El audio parece estar bien, puede ser un falso positivo después de crossfade
        logger.dev('🔄 Posible falso positivo después de crossfade - reseteando watchdog');
        this.lastProgressTime = Date.now();
        return;
      }

      // En lugar de intentar reparar, saltar directamente a la siguiente canción
      // Esto es más confiable que intentar "reparar" un audio colgado
      logger.dev('⏭️ Forzando avance por audio colgado');
      
      // Reset completo del estado de reproducción
      this.isPlaying = false;
      this.isPaused = false;
      this.isCrossfading = false;
      
      // Limpiar el reproductor problemático
      if (activePlayer) {
        try {
          activePlayer.pause();
          activePlayer.currentTime = 0;
        } catch (e) {
          logger.warn('⚠️ Error pausando reproductor colgado:', e);
        }
      }
      
      logger.dev('📢 Emitiendo onEnd para forzar avance a siguiente canción');
      this.emit('onEnd', this.currentSong);

    } catch (error) {
      logger.error('❌ Error en recuperación:', error);
      // Fallback: siempre saltar a siguiente canción si hay problemas
      logger.dev('🔄 Fallback final: saltando a siguiente canción');
      this.isPlaying = false;
      this.emit('onEnd', this.currentSong);
    }
  }

  /**
   * Detener watchdog
   */
  stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  /**
   * 🔧 NUEVO: Activar/desactivar debug del watchdog
   */
  setWatchdogDebugMode(enabled) {
    this.watchdogDebugMode = enabled;
    logger.dev(`🔧 Watchdog debug mode: ${enabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
  }

  /**
   * Suscribirse a eventos
   */
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  /**
   * Desuscribirse de eventos
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emitir evento
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error en callback ${event}:`, error);
        }
      });
    }
  }

  /**
   * Limpiar un reproductor específico
   */
  cleanupPlayer(player) {
    if (!player) return;
    
    try {
      // Remover eventos
      if (player._eventHandlers) {
        Object.entries(player._eventHandlers).forEach(([event, handler]) => {
          player.removeEventListener(event, handler);
        });
        delete player._eventHandlers;
      }
      
      // Pausar y limpiar
      player.pause();
      player.src = '';
      player.load();
    } catch (error) {
      logger.warn('⚠️ Error limpiando reproductor:', error);
    }
  }

  /**
   * Destruir servicio y limpiar recursos
   */
  destroy() {
    logger.dev('🗑️ Destruyendo AudioPlayerService');
    
    // Detener watchdog
    this.stopWatchdog();
    
    this.cleanupPlayer(this.playerA);
    this.cleanupPlayer(this.playerB);
    
    this.playerA = null;
    this.playerB = null;
    this.currentSong = null;
    this.nextSong = null;
    this.eventListeners = {};
  }

  /**
   * Resetear posición de reproducción
   */
  resetPlayback() {
    const activePlayer = this.getActivePlayer();
    if (activePlayer) {
      activePlayer.currentTime = 0;
      this.emit('onProgress', {
        currentTime: 0,
        duration: activePlayer.duration || 0,
        progress: 0
      });
    }
  }

  /**
   * Establecer canal actual para verificaciones de consistencia
   */
  setCurrentChannel(channelId) {
    logger.dev('🎛️ AudioPlayer - Canal establecido:', channelId);
    this.currentChannelId = channelId;
  }

  /**
   * ✅ NUEVO MODELO: Limpieza de canción precargada
   * Las canciones ya están validadas al cargar playlists (playlist.canal_id)
   * Esta función se mantiene para compatibilidad pero ya no verifica canal_id
   */
  forceCleanIncorrectPreloadedSong() {
    // En el nuevo modelo, las canciones siempre son correctas porque vienen
    // de playlists filtradas por canal_id. No hay necesidad de verificar
    logger.dev('ℹ️ forceCleanIncorrectPreloadedSong: Modelo de canciones globales activo');
    return false; // No hay necesidad de limpiar
  }

  /**
   * Obtener canal actual
   */
  getCurrentChannelId() {
    return this.currentChannelId;
  }

  /**
   * Resetear completamente el estado del reproductor
   */
  reset() {
    try {
      logger.dev('🔄 Reseteando AudioPlayerService...');
      
      // Mostrar estado antes del reset para debugging
      logger.dev('📊 Estado antes del reset:', {
        currentSong: this.currentSong?.canciones?.titulo || this.currentSong?.titulo || 'Ninguna',
        nextSong: this.nextSong?.canciones?.titulo || this.nextSong?.titulo || 'Ninguna',
        nextSongLoaded: this.nextSongLoaded,
        isCrossfading: this.isCrossfading,
        currentPlayer: this.currentPlayer,
        playerA: !!this.playerA,
        playerB: !!this.playerB
      });
      
      // Detener watchdog
      this.stopWatchdog();
      
      // Limpiar reproductores con información detallada
      if (this.playerA) {
        logger.dev('🧹 Limpiando reproductor A');
        this.cleanupPlayer(this.playerA);
      }
      if (this.playerB) {
        logger.dev('🧹 Limpiando reproductor B');
        this.cleanupPlayer(this.playerB);
      }
      
      // Resetear propiedades
      this.playerA = null;
      if (CROSSFADE_ENABLED) {
        this.playerB = null;
      }
      this.currentPlayer = 'A';
      this.isPlaying = false;
      this.isPaused = false;
      this.currentSong = null;
      this.nextSong = null; // CRÍTICO: Limpiar canción precargada
      this.currentChannelId = null; // CRÍTICO: Limpiar canal actual
      this.isCrossfading = false;
      this.isLoading = false;
      this.nextSongLoaded = false; // CRÍTICO: Resetear estado de precarga
      
      // Resetear timers
      this.lastEndEvent = 0;
      this.lastProgressTime = 0;
      
      logger.dev('✅ AudioPlayerService reseteado completamente');
      logger.dev('📊 Estado después del reset:', {
        currentSong: this.currentSong,
        nextSong: this.nextSong,
        nextSongLoaded: this.nextSongLoaded,
        currentPlayer: this.currentPlayer,
        currentChannelId: this.currentChannelId,
        playerA: this.playerA,
        playerB: this.playerB
      });
      
      // Reiniciar watchdog para el próximo uso
      this.startWatchdog();
      
    } catch (error) {
      logger.error('❌ Error reseteando AudioPlayerService:', error);
    }
  }

  /**
   * Reproduce un contenido específico con fade out/in del AutoDJ
   * @param {string} contentUrl - URL del contenido a reproducir
   * @param {number} duration - Duración del contenido en segundos (opcional)
   * @param {boolean} songEndedBefore - Si la canción anterior terminó antes de reproducir el contenido
   * @returns {Promise<boolean>} - true si se reprodujo correctamente
   */
  async playContentWithFade(contentUrl, duration = null, songEndedBefore = false) {
    try {
      logger.dev('🎵 Iniciando reproducción de contenido con fade:', contentUrl, {songEndedBefore});
      
      if (!contentUrl) {
        throw new Error('URL de contenido requerida');
      }

      // 0. Detener cualquier contenido que esté reproduciéndose
      if (this.activeContentPlayer) {
        logger.dev('🛑 Deteniendo contenido anterior...');
        this.activeContentPlayer.pause();
        this.activeContentPlayer.src = '';
        this.activeContentPlayer = null;
      }

      // 🔧 CRÍTICO: Marcar inicio de interrupción para watchdog
      this.lastInterruptionTime = Date.now();
      
      // 🔧 CRÍTICO: Capturar volumen de musicVolume, NO del reproductor actual
      // para respetar el mute del usuario incluso si el reproductor tiene otro volumen
      const originalVolume = this.musicVolume * this.masterVolume;
      const mainPlayer = this.getActivePlayer();
      
      // 🍎 iOS STRATEGY: Reutilizar el reproductor principal cuando sea posible
      // En iOS, cambiar el src de un reproductor existente funciona,
      // pero crear un nuevo Audio() sin interacción del usuario falla
      const shouldReuseMainPlayer = mainPlayer && !mainPlayer.paused;
      let contentPlayer;
      
      if (shouldReuseMainPlayer) {
        logger.dev('🍎 iOS: Reutilizando reproductor principal para contenido programado');
        contentPlayer = mainPlayer;
        this.activeContentPlayer = contentPlayer; // Marcar que estamos usando el principal
        
        // Guardar el estado original para restaurar después
        this.savedSongForRestore = {
          src: mainPlayer.src,
          currentTime: mainPlayer.currentTime,
          song: this.currentSong
        };
        
        // 🔧 iOS: hacer fade out SUAVE sin pausar el reproductor
        // Pausar aquí provoca que iOS detenga el pipeline al cambiar el src
        try {
          const currentVol = contentPlayer.volume;
          const steps = 40;
          const stepMs = 50; // ~2000ms (más largo y suave)
          for (let i = 0; i < steps; i++) {
            const next = Math.max(0, currentVol - (currentVol / steps) * (i + 1));
            mainPlayer.volume = next;
            await new Promise(r => setTimeout(r, stepMs));
          }
          mainPlayer.volume = 0;
        } catch (e) {
          logger.warn('⚠️ No se pudo hacer fade-out suave en iOS:', e);
        }
        
        // Cambiar a contenido programado
        contentPlayer.src = contentUrl;
        contentPlayer.volume = 0; // Empezar en silencio
        
        // Reproducir (ya está "unlocked" por interacción previa)
        await contentPlayer.play();
        logger.dev('✅ Contenido programado iniciado (reutilizando reproductor)');
        
      } else {
        logger.dev('📱 Creando nuevo reproductor para contenido');
        // Crear nuevo reproductor (para clicks manuales)
        contentPlayer = new Audio();
        contentPlayer.preload = 'auto';
        contentPlayer.volume = 0; // Empezar en silencio para fade in
        contentPlayer.src = contentUrl;
        
        // Guardar referencia al reproductor activo
        this.activeContentPlayer = contentPlayer;
        
        // Fade out en paralelo
        this.fadeOutCurrentAudio();
        
        // Llamar a play() INMEDIATAMENTE (para iOS manual clicks)
        try {
          await contentPlayer.play();
          logger.dev('✅ Reproducción de contenido iniciada');
        } catch (playError) {
          logger.error('❌ Error iniciando reproducción:', playError);
          throw playError;
        }
      }
      
      // 2. Fade in del contenido (mientras se reproduce)
      const targetVolume = this.contentVolume * this.masterVolume;
      this.fadeInAudio(contentPlayer, targetVolume); // Fade in en paralelo

      // 🔧 MediaSession: Mostrar “Contenido”
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new window.MediaMetadata({ title: 'Contenido', artist: 'Programación' });
          navigator.mediaSession.playbackState = 'playing';
        }
      } catch (e) {}
      
      logger.dev('🔊 Volumen del contenido configurado:', {
        contentVolume: this.contentVolume,
        masterVolume: this.masterVolume,
        finalVolume: targetVolume,
        volumenInicial: 0,
        reusedMainPlayer: shouldReuseMainPlayer
      });

      // 3. Configurar eventos del contenido
      return new Promise((resolve) => {
        const handleContentEnd = async () => {
          logger.dev('✅ Contenido finalizado', {songEndedBefore, shouldRestore: !songEndedBefore});
          
          // 🔓 Desbloquear controles inmediatamente cuando termina el contenido
          if (typeof window.__clearManualPlayback === 'function') {
            try {
              window.__clearManualPlayback();
              logger.dev('🔓 Controles desbloqueados tras fin de contenido manual');
            } catch (e) {
              logger.warn('⚠️ Error desbloqueando controles:', e);
            }
          }
          
          // Limpiar eventos
          contentPlayer.removeEventListener('ended', handleContentEnd);
          contentPlayer.removeEventListener('error', handleContentError);
          
          // 🔧 CRÍTICO: Si la canción ya terminó antes del contenido, NO restaurarla
          if (songEndedBefore) {
            logger.dev('🎵 Canción anterior ya terminó - NO restaurar, esperando nueva canción del AutoDJ');
            
            // Limpiar el reproductor de contenido
            if (shouldReuseMainPlayer && this.savedSongForRestore) {
              // Limpiar el guardado sin restaurar
              this.savedSongForRestore = null;
              this.activeContentPlayer = null;
            } else {
              this.activeContentPlayer = null;
            }
            
            // Marcar como pausado para que el AutoDJ sepa que debe seleccionar nueva canción
            this.isPlaying = false;
            this.isPaused = true;
            
            resolve(true);
            return;
          }
          
          // 🍎 iOS: Si reutilizamos el reproductor principal, restaurar la canción original
          if (shouldReuseMainPlayer && this.savedSongForRestore) {
            logger.dev('🍎 iOS: Restaurando canción original en reproductor principal');
            
            // 🔧 No pausar: solo preparar volumen para reanudar
            try {
              const steps = 10;
              for (let i = 0; i < steps; i++) {
                contentPlayer.volume = Math.max(0, contentPlayer.volume - (contentPlayer.volume / steps));
                await new Promise(r => setTimeout(r, 30));
              }
              contentPlayer.volume = 0;
            } catch (e) {}
            
            // Restaurar la canción original
            contentPlayer.src = this.savedSongForRestore.src;
            contentPlayer.currentTime = this.savedSongForRestore.currentTime;
            this.currentSong = this.savedSongForRestore.song;
            
            // Limpiar el guardado
            this.savedSongForRestore = null;
            this.activeContentPlayer = null;
            
            // Reproducir y hacer fade in (sin pausar en iOS)
            // 🔧 CRÍTICO: SIEMPRE reproducir, pero respetar el mute (volumen 0)
            try {
              await contentPlayer.play();
              this.isPlaying = true;
              this.isPaused = false;
              
              // 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
              const volumenActual = this.musicVolume * this.masterVolume;
              
              if (volumenActual > 0) {
                await this.fadeInAudio(contentPlayer, volumenActual);
                logger.dev(`✅ Canción original restaurada con fade in (iOS) al ${(volumenActual * 100).toFixed(0)}%`);
              } else {
                // Mantener volumen en 0 sin hacer fade in
                contentPlayer.volume = 0;
                logger.dev('🔇 Música en MUTE - canción continúa sin sonido (iOS)');
              }
            } catch (err) {
              logger.error('❌ Error restaurando canción:', err);
            }
            
          } else {
            // Modo normal: limpiar reproductor temporal
            this.activeContentPlayer = null;
            
            // 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
            const volumenActual = this.musicVolume * this.masterVolume;
            
            // Fade in del audio original (solo si no estaba en mute)
            if (volumenActual > 0) {
              await this.fadeInCurrentAudio(volumenActual);
              logger.dev(`✅ Volumen restaurado al ${(volumenActual * 100).toFixed(0)}%`);
            } else {
              logger.dev('🔇 Música en MUTE - manteniendo silencio');
            }
          }
          
          // 🔧 CRÍTICO: Restaurar MediaSession a la canción actual
          try {
            // No actualizar metadata si hay contenido programado activo
            if ('mediaSession' in navigator && this.currentSong && !this.activeContentPlayer) {
              const title = this.currentSong?.canciones?.titulo || this.currentSong?.titulo || 'Ondeon SMART';
              const artist = this.currentSong?.canciones?.artista || this.currentSong?.artista || '';
              navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist });
              navigator.mediaSession.playbackState = 'playing';
            }
          } catch (e) {}
          
          // 🎵 La canción continúa desde donde se pausó (NO avanzar a siguiente)
          
          resolve(true);
        };

        const handleContentError = async (error) => {
          // ✅ FIX: Extraer información detallada del error de audio
          const audioElement = error.target || error;
          const mediaError = audioElement.error;
          let errorCode = 0;
          let errorMessage = 'Error desconocido';
          
          if (mediaError) {
            errorCode = mediaError.code;
            switch (mediaError.code) {
              case 1:
                errorMessage = 'MEDIA_ERR_ABORTED: La reproducción fue abortada';
                break;
              case 2:
                errorMessage = 'MEDIA_ERR_NETWORK: Error de red o conexión';
                break;
              case 3:
                errorMessage = 'MEDIA_ERR_DECODE: Error de decodificación del archivo';
                break;
              case 4:
                errorMessage = 'MEDIA_ERR_SRC_NOT_SUPPORTED: Formato no soportado o archivo corrupto';
                break;
              default:
                errorMessage = mediaError.message || 'Error de audio desconocido';
            }
          }
          
          logger.error('❌ Error reproduciendo contenido:', {
            errorCode,
            errorMessage,
            url: contentUrl,
            readyState: audioElement.readyState,
            networkState: audioElement.networkState,
            error: mediaError
          });
          
          // 🔓 Desbloquear controles inmediatamente en caso de error
          if (typeof window.__clearManualPlayback === 'function') {
            try {
              window.__clearManualPlayback();
              logger.dev('🔓 Controles desbloqueados tras error de contenido manual');
            } catch (e) {
              logger.warn('⚠️ Error desbloqueando controles:', e);
            }
          }
          
          contentPlayer.removeEventListener('ended', handleContentEnd);
          contentPlayer.removeEventListener('error', handleContentError);
          
          // 🍎 iOS: Si reutilizamos el reproductor principal, restaurar la canción original
          if (shouldReuseMainPlayer && this.savedSongForRestore) {
            logger.dev('🍎 iOS: Error en contenido, restaurando canción original');
            
            // Restaurar la canción original
            contentPlayer.src = this.savedSongForRestore.src;
            contentPlayer.currentTime = this.savedSongForRestore.currentTime;
            this.currentSong = this.savedSongForRestore.song;
            
            // Limpiar el guardado
            this.savedSongForRestore = null;
            this.activeContentPlayer = null;
            
            // Reproducir y hacer fade in
            // 🔧 CRÍTICO: SIEMPRE reproducir, pero respetar el mute (volumen 0)
            try {
              await contentPlayer.play();
              
              // 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
              const volumenActual = this.musicVolume * this.masterVolume;
              
              if (volumenActual > 0) {
                await this.fadeInAudio(contentPlayer, volumenActual);
                logger.dev(`✅ Canción restaurada tras error al ${(volumenActual * 100).toFixed(0)}%`);
              } else {
                // Mantener volumen en 0 sin hacer fade in
                contentPlayer.volume = 0;
                logger.dev('🔇 Música en MUTE - canción restaurada sin sonido (error path)');
              }
            } catch (err) {
              logger.error('❌ Error restaurando canción:', err);
            }
            
          } else {
            // Modo normal: limpiar reproductor temporal
            this.activeContentPlayer = null;
            
            // 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
            const volumenActual = this.musicVolume * this.masterVolume;
            
            // Restaurar audio original en caso de error
            if (volumenActual > 0) {
              this.fadeInCurrentAudio(volumenActual);
            } else {
              logger.dev('🔇 Música en MUTE - manteniendo silencio tras error');
            }
          }
          
          resolve(false);
        };

        contentPlayer.addEventListener('ended', handleContentEnd);
        contentPlayer.addEventListener('error', handleContentError);

        // 🔧 CRÍTICO: Actualizar MediaSession para segundo plano
        try {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new window.MediaMetadata({
              title: 'Contenido',
              artist: 'Programación',
            });
            navigator.mediaSession.playbackState = 'playing';
          }
        } catch (e) {
          logger.warn('⚠️ No se pudo actualizar MediaSession:', e);
        }

        // 4. Cargar y reproducir contenido
        logger.dev('🎵 Configurando reproductor de contenido...');
        logger.dev('🎵 URL:', contentUrl);
        logger.dev('🎵 Volúmenes actuales:', {
          contentVolume: this.contentVolume,
          masterVolume: this.masterVolume,
          finalVolume: this.contentVolume * this.masterVolume
        });
        
        contentPlayer.src = contentUrl;
        
        // 🔧 CRÍTICO: Agregar event listeners con {once: true} para evitar que afecten la siguiente canción
        // (especialmente en iOS donde se reutiliza el reproductor principal)
        contentPlayer.addEventListener('loadstart', () => {
          logger.dev('🎵 Iniciando carga del contenido...');
        }, {once: true});
        
        contentPlayer.addEventListener('canplay', () => {
          logger.dev('🎵 Contenido listo para reproducir');
          // Forzar aplicación del volumen justo antes de reproducir
          contentPlayer.volume = this.contentVolume * this.masterVolume;
          logger.dev('🔊 Volumen final aplicado al reproductor:', contentPlayer.volume);
        }, {once: true});
        
        contentPlayer.addEventListener('volumechange', () => {
          logger.dev('🔊 Cambio de volumen detectado:', contentPlayer.volume);
        }, {once: false}); // Este puede quedarse para debugging
        
        contentPlayer.play().then(() => {
          logger.dev('🎵 Reproducción de contenido iniciada exitosamente');
          logger.dev('🔊 Volumen durante reproducción:', contentPlayer.volume);
        }).catch(handleContentError);

        logger.dev('🎵 Contenido iniciado, duración estimada:', duration ? `${duration}s` : 'desconocida');
      });

    } catch (error) {
      logger.error('❌ Error en playContentWithFade:', error);
      return false;
    }
  }

  /**
   * Hace fade out del audio actual
   */
  async fadeOutCurrentAudio() {
    const currentPlayer = this.getActivePlayer();
    if (!currentPlayer) return;

    const originalVolume = currentPlayer.volume;
    const fadeSteps = 40; // 🎚️ Más pasos para transición suave
    const stepDuration = 100; // ms (total: ~4 segundos)
    const volumeStep = originalVolume / fadeSteps;

    logger.dev('🔽 Iniciando fade out del audio actual');

    for (let i = 0; i < fadeSteps; i++) {
      currentPlayer.volume = Math.max(0, originalVolume - (volumeStep * (i + 1)));
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    currentPlayer.volume = 0;
    
    // 🔧 CRÍTICO: Pausar el audio después del fade out para evitar solapamiento
    currentPlayer.pause();
    this.isPlaying = false;
    this.isPaused = true;
    
    logger.dev('✅ Fade out completado - audio pausado');
  }

  /**
   * Hace fade out de un elemento de audio específico
   * @param {HTMLAudioElement} audioElement - Elemento de audio
   */
  async fadeOutAudio(audioElement) {
    if (!audioElement) return;

    const originalVolume = audioElement.volume;
    const fadeSteps = 40; // 🎚️ Más pasos para transición suave
    const stepDuration = 100; // ms (total: ~4 segundos)
    const volumeStep = originalVolume / fadeSteps;

    logger.dev('🔽 Iniciando fade out (genérico)');

    for (let i = 0; i < fadeSteps; i++) {
      audioElement.volume = Math.max(0, originalVolume - (volumeStep * (i + 1)));
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    audioElement.volume = 0;
    logger.dev('✅ Fade out completado (genérico)');
  }

  /**
   * Hace fade in de un elemento de audio específico
   * @param {HTMLAudioElement} audioElement - Elemento de audio
   * @param {number} targetVolume - Volumen objetivo
   */
  async fadeInAudio(audioElement, targetVolume = 0.8) {
    if (!audioElement) return;

    // 🔧 iOS-safe: usar rampas más rápidas y sin pauses largos
    const fadeSteps = 20;
    const stepDuration = 40; // ~800ms total
    const volumeStep = targetVolume / fadeSteps;

    logger.dev('🔼 Iniciando fade in (genérico)');

    for (let i = 0; i < fadeSteps; i++) {
      audioElement.volume = Math.min(targetVolume, volumeStep * (i + 1));
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    audioElement.volume = targetVolume;
    logger.dev('✅ Fade in completado (genérico)');
  }

  /**
   * Hace fade in del audio actual
   */
  async fadeInCurrentAudio(targetVolume = 0.8) {
    const currentPlayer = this.getActivePlayer();
    if (!currentPlayer) return;

    // 🔧 CRÍTICO: Reanudar la reproducción SIEMPRE (incluso en mute)
    if (currentPlayer.paused) {
      try {
        await currentPlayer.play();
        this.isPlaying = true;
        this.isPaused = false;
        logger.dev('▶️ Audio reanudado para fade in');
      } catch (error) {
        logger.warn('⚠️ No se pudo reanudar el audio:', error);
        // Continuar con el fade in aunque no se pueda reanudar
      }
    }

    // 🔧 CRÍTICO: Si targetVolume es 0 (mute), mantener en 0 sin hacer fade
    if (targetVolume === 0) {
      currentPlayer.volume = 0;
      logger.dev('🔇 Volumen en mute (0) - reproducción continúa sin sonido');
      return;
    }

    const fadeSteps = 40; // 🎚️ Aumentado para transición más suave
    const stepDuration = 75; // ms (total: 3 segundos)
    const volumeStep = targetVolume / fadeSteps;

    logger.dev('🔼 Iniciando fade in del audio actual');

    for (let i = 0; i < fadeSteps; i++) {
      currentPlayer.volume = Math.min(targetVolume, volumeStep * (i + 1));
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    currentPlayer.volume = targetVolume;
    logger.dev('✅ Fade in completado');
  }

  /**
   * Establecer volumen de música (AutoDJ)
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    logger.dev('🎵 Volumen música actualizado:', this.musicVolume);
    
    // Aplicar al reproductor activo si existe
    const activePlayer = this.getActivePlayer();
    if (activePlayer) {
      activePlayer.volume = this.musicVolume * this.masterVolume;
    }
  }

  /**
   * Establecer volumen de contenidos
   */
  setContentVolume(volume) {
    const oldVolume = this.contentVolume;
    this.contentVolume = Math.max(0, Math.min(1, volume));
    
    // Si hay un contenido reproduciéndose, actualizar su volumen inmediatamente
    if (this.activeContentPlayer) {
      this.activeContentPlayer.volume = this.contentVolume * this.masterVolume;
      logger.dev('🔊 Volumen aplicado al contenido activo:', this.activeContentPlayer.volume);
    }
    
    logger.dev('🎤 Volumen contenido actualizado:', {
      anterior: oldVolume,
      nuevo: this.contentVolume,
      entrada: volume,
      porcentaje: Math.round(this.contentVolume * 100) + '%',
      aplicadoAReproductorActivo: !!this.activeContentPlayer
    });
  }

  /**
   * Obtener volumen actual de música
   */
  getMusicVolume() {
    return this.musicVolume;
  }

  /**
   * Obtener volumen actual de contenidos
   */
  getContentVolume() {
    return this.contentVolume;
  }

  // 🔎 Detección sencilla de iOS
  isIOS() {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /**
   * 🔊 NUEVO: Reproducir contenido con música de fondo (modo background)
   * La música se baja al volumen predefinido pero NO se pausa
   * @param {string} contentUrl - URL del contenido a reproducir
   * @returns {Promise<boolean>} - true si se reprodujo correctamente
   */
  async playContentWithBackground(contentUrl) {
    try {
      logger.dev('🎶 Iniciando reproducción de contenido con música de fondo:', contentUrl);
      
      if (!contentUrl) {
        throw new Error('URL de contenido requerida');
      }

      // 0. Detener cualquier contenido que esté reproduciéndose
      if (this.activeContentPlayer) {
        logger.dev('🛑 Deteniendo contenido anterior...');
        this.activeContentPlayer.pause();
        this.activeContentPlayer.src = '';
        this.activeContentPlayer = null;
      }

      // 1. Guardar volumen original de la música ANTES de bajarlo
      // 🔧 CRÍTICO: Marcar inicio de interrupción para watchdog
      this.lastInterruptionTime = Date.now();
      
      // 🔧 CRÍTICO: Guardar el volumen actual de musicVolume (NO del player, que puede estar desincronizado)
      const volumenOriginalMusica = this.musicVolume;
      logger.dev('💾 Guardando volumen original de música:', volumenOriginalMusica);
      
      // 2. VOLUMEN PREDEFINIDO para música de fondo (20% = 0.2)
      const VOLUMEN_FONDO_PREDEFINIDO = 0.2;
      
      // 3. Bajar volumen de música suavemente (NO pausar)
      const fadeMs = this.isIOS() ? 400 : 1000; // iOS necesita rampas más cortas
      await this.transicionarVolumen(VOLUMEN_FONDO_PREDEFINIDO, fadeMs);
      logger.dev(`🔽 Música bajada al ${VOLUMEN_FONDO_PREDEFINIDO * 100}% de volumen`);

      // 4. Crear nuevo reproductor temporal para el contenido
      const contentPlayer = new Audio();
      contentPlayer.preload = 'auto';
      contentPlayer.volume = this.contentVolume * this.masterVolume;
      
      // Guardar referencia al reproductor activo
      this.activeContentPlayer = contentPlayer;
      
      logger.dev('🔊 Volumen del contenido configurado:', {
        contentVolume: this.contentVolume,
        masterVolume: this.masterVolume,
        finalVolume: this.contentVolume * this.masterVolume,
        volumenReal: contentPlayer.volume
      });

      // 5. Configurar eventos del contenido
      return new Promise((resolve) => {
        const handleContentEnd = async () => {
          logger.dev('✅ Contenido finalizado, restaurando volumen de música');
          
          // 🔓 Desbloquear controles cuando termina el contenido
          if (typeof window.__clearManualPlayback === 'function') {
            try {
              window.__clearManualPlayback();
              logger.dev('🔓 Controles desbloqueados tras fin de contenido (background mode)');
            } catch (e) {
              logger.warn('⚠️ Error desbloqueando controles:', e);
            }
          }
          
          // Limpiar eventos
          contentPlayer.removeEventListener('ended', handleContentEnd);
          contentPlayer.removeEventListener('error', handleContentError);
          
          // Limpiar referencia al reproductor activo
          this.activeContentPlayer = null;
          
          // 🔧 CRÍTICO: Restaurar MediaSession a la canción actual
          try {
            if ('mediaSession' in navigator && this.currentSong) {
              const title = this.currentSong?.canciones?.titulo || this.currentSong?.titulo || 'Ondeon SMART';
              const artist = this.currentSong?.canciones?.artista || this.currentSong?.artista || '';
              navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist });
              navigator.mediaSession.playbackState = 'playing';
            }
          } catch (e) {}
          
          // 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
          const volumenActual = this.musicVolume;
          
          if (volumenActual > 0) {
            // Restaurar al volumen ACTUAL del slider
            await this.transicionarVolumen(volumenActual, 1000);
            logger.dev(`🔼 Volumen de música restaurado: ${(volumenActual * 100).toFixed(0)}%`);
          } else {
            // Si está en mute (0), mantener en silencio
            await this.transicionarVolumen(0, 0); // Asegurar que está en 0
            logger.dev('🔇 Música en MUTE - manteniendo silencio');
          }
          
          // 🎵 La canción continúa desde donde se pausó (NO avanzar a siguiente)
          
          resolve(true);
        };

        const handleContentError = async (error) => {
          // ✅ FIX: Extraer información detallada del error de audio
          const audioElement = error.target || error;
          const mediaError = audioElement.error;
          let errorCode = 0;
          let errorMessage = 'Error desconocido';
          
          if (mediaError) {
            errorCode = mediaError.code;
            switch (mediaError.code) {
              case 1:
                errorMessage = 'MEDIA_ERR_ABORTED: La reproducción fue abortada';
                break;
              case 2:
                errorMessage = 'MEDIA_ERR_NETWORK: Error de red o conexión';
                break;
              case 3:
                errorMessage = 'MEDIA_ERR_DECODE: Error de decodificación del archivo';
                break;
              case 4:
                errorMessage = 'MEDIA_ERR_SRC_NOT_SUPPORTED: Formato no soportado o archivo corrupto';
                break;
              default:
                errorMessage = mediaError.message || 'Error de audio desconocido';
            }
          }
          
          logger.error('❌ Error reproduciendo contenido (background mode):', {
            errorCode,
            errorMessage,
            url: contentUrl,
            readyState: audioElement.readyState,
            networkState: audioElement.networkState,
            error: mediaError
          });
          
          // 🔓 Desbloquear controles en caso de error
          if (typeof window.__clearManualPlayback === 'function') {
            try {
              window.__clearManualPlayback();
              logger.dev('🔓 Controles desbloqueados tras error de contenido (background mode)');
            } catch (e) {
              logger.warn('⚠️ Error desbloqueando controles:', e);
            }
          }
          
          contentPlayer.removeEventListener('ended', handleContentEnd);
          contentPlayer.removeEventListener('error', handleContentError);
          
          // Limpiar referencia al reproductor activo
          this.activeContentPlayer = null;
          
          // 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
          const volumenActual = this.musicVolume;
          
          if (volumenActual > 0) {
            await this.transicionarVolumen(volumenActual, 1000);
            logger.dev(`🔼 Volumen restaurado tras error: ${(volumenActual * 100).toFixed(0)}%`);
          } else {
            await this.transicionarVolumen(0, 0);
            logger.dev('🔇 Música en MUTE - manteniendo silencio tras error');
          }
          resolve(false);
        };

        contentPlayer.addEventListener('ended', handleContentEnd);
        contentPlayer.addEventListener('error', handleContentError);

        // 🔧 CRÍTICO: Actualizar MediaSession para segundo plano
        try {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new window.MediaMetadata({
              title: 'Contenido Programado',
              artist: 'Ondeon SMART',
              album: 'Programación'
            });
            navigator.mediaSession.playbackState = 'playing';
          }
        } catch (e) {
          logger.warn('⚠️ No se pudo actualizar MediaSession:', e);
        }

        // 6. Cargar y reproducir contenido
        contentPlayer.src = contentUrl;
        contentPlayer.play().then(() => {
          logger.dev('🎵 Reproducción de contenido con música de fondo iniciada');
        }).catch(handleContentError);
      });

    } catch (error) {
      logger.error('❌ Error en playContentWithBackground:', error);
      return false;
    }
  }

  /**
   * 🔊 NUEVO: Transicionar volumen suavemente a un valor objetivo
   * @param {number} targetVolume - Volumen objetivo (0.0 - 1.0)
   * @param {number} duration - Duración de la transición en ms
   */
  async transicionarVolumen(targetVolume, duration) {
    const currentPlayer = this.getActivePlayer();
    if (!currentPlayer) return;

    const volumenInicial = currentPlayer.volume;
    const diferencia = targetVolume - volumenInicial;
    const pasos = this.isIOS() ? 12 : 20; // menos pasos y más rápidos en iOS
    const intervalo = Math.max(20, Math.floor(duration / pasos));
    const incrementoPorPaso = diferencia / pasos;

    logger.dev(`🎚️ Transición de volumen: ${(volumenInicial * 100).toFixed(0)}% → ${(targetVolume * 100).toFixed(0)}%`);

    for (let i = 0; i < pasos; i++) {
      const nuevoVolumen = volumenInicial + (incrementoPorPaso * (i + 1));
      currentPlayer.volume = Math.max(0, Math.min(1, nuevoVolumen));
      await new Promise(resolve => setTimeout(resolve, intervalo));
    }

    currentPlayer.volume = Math.max(0, Math.min(1, targetVolume));
  }

  /**
   * 🎬 NUEVO: Reproducir programación completa (orquestador principal)
   * Esta es la función que llama scheduledContentService
   * @param {Array} contenidos - Array de objetos contenido
   * @param {string} modoAudio - 'fade_out' | 'background'
   * @param {boolean} songEndedBefore - Si la canción anterior terminó antes del contenido
   * @returns {Promise<boolean>}
   */
  async reproducirProgramacion(contenidos, modoAudio, songEndedBefore = false) {
    try {
      logger.dev('🎬 INICIANDO REPRODUCCIÓN DE PROGRAMACIÓN:', {
        totalContenidos: contenidos.length,
        modoAudio: modoAudio,
        songEndedBefore: songEndedBefore
      });

      if (!contenidos || contenidos.length === 0) {
        logger.warn('⚠️ No hay contenidos para reproducir');
        return false;
      }

      // 🔧 CRÍTICO: Trackear si al menos un contenido se reprodujo exitosamente
      let algunContenidoExitoso = false;
      
      // Reproducir cada contenido en secuencia según el modo de audio
      for (let i = 0; i < contenidos.length; i++) {
        const contenido = contenidos[i];
        // 🔧 CORREGIDO: La columna es url_s3, no url_archivo
        const originalUrl = contenido.url_s3 || contenido.url_archivo;
        
        if (!originalUrl) {
          logger.warn('⚠️ Contenido sin URL, saltando:', contenido.titulo || contenido.id);
          logger.warn('   Contenido completo:', contenido);
          continue;
        }
        
        // Convertir URL de S3 a CloudFront
        const url = convertToCloudFrontUrl(originalUrl);
        logger.dev('🔗 URL de contenido convertida a CloudFront:', { original: originalUrl, cloudfront: url });

        logger.dev(`📢 Reproduciendo contenido ${i + 1}/${contenidos.length}:`, {
          titulo: contenido.titulo || 'Sin título',
          duracion: contenido.duracion || 'desconocida',
          modoAudio: modoAudio,
          songEndedBefore: songEndedBefore
        });

        // Reproducir según modo de audio
        let success = false;
        
        if (modoAudio === 'fade_out') {
          // Modo 1: Fade out/in (silencio total durante contenido)
          success = await this.playContentWithFade(url, contenido.duracion, songEndedBefore);
        } else if (modoAudio === 'background') {
          // Modo 2: Música de fondo (contenido + música simultánea)
          success = await this.playContentWithBackground(url);
        } else {
          logger.warn('⚠️ Modo de audio desconocido:', modoAudio, '- usando fade_out por defecto');
          success = await this.playContentWithFade(url, contenido.duracion, songEndedBefore);
        }

        if (!success) {
          logger.warn('⚠️ Error reproduciendo contenido, continuando con siguiente');
        } else {
          algunContenidoExitoso = true;
        }
      }

      // 🔧 CRÍTICO: Solo retornar true si al menos un contenido se reprodujo
      if (!algunContenidoExitoso) {
        logger.error('❌ NINGÚN contenido se pudo reproducir - programación FALLIDA');
        return false;
      }

      logger.dev('✅ Programación completada - al menos un contenido se reprodujo exitosamente');
      return true;

    } catch (error) {
      logger.error('❌ Error reproduciendo programación:', error);
      return false;
    }
  }


}

// Exportar singleton PEREZOSO (lazy) para evitar efectos en login
let _audioPlayerInstance = null;
const getInstance = () => {
  if (!_audioPlayerInstance) {
    _audioPlayerInstance = new AudioPlayerService();
  }
  return _audioPlayerInstance;
};

// Proxy que crea la instancia solo al acceder a un método/propiedad
const lazyAudioPlayer = new Proxy({}, {
  get(_target, prop) {
    const inst = getInstance();
    
    // Mostrar log de inicialización solo cuando se accede por primera vez
    if (!inst._initialized) {
      logger.dev(`🎵 AudioPlayerService inicializado - Crossfade: ${CROSSFADE_ENABLED ? 'ACTIVADO' : 'DESACTIVADO'}, Interrupciones: ${INTERRUPTION_CROSSFADE_ENABLED ? 'ACTIVADO' : 'DESACTIVADO'}`);
      inst.startWatchdog();
      inst._initialized = true;
    }
    
    const value = inst[prop];
    if (typeof value === 'function') return value.bind(inst);
    return value;
  }
});

// Hacer accesible globalmente para debug en desarrollo, también lazy
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'audioPlayerDebug', {
    get() { return getInstance(); }
  });
  
  window.forceWatchdogRecovery = () => {
    logger.dev('🔧 Forzando recuperación del watchdog...');
    getInstance().attemptRecovery();
  };
  
  window.simulateAudioHang = () => {
    logger.dev('🎭 Simulando audio colgado...');
    getInstance().lastProgressTime = Date.now() - 10000; // 10 segundos atrás
  };
}

export default lazyAudioPlayer; 