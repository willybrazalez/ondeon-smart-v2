import { useState, useEffect, useCallback, useRef } from 'react';
import autoDj from '../services/autoDjService.js';
import scheduledContentService from '../services/scheduledContentService.js';
import { getSongDuration } from '../lib/utils.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import logger from '../lib/logger.js';

/**
 * Hook personalizado para gestionar el AutoDJ de Ondeón
 * Proporciona estado reactivo y controles para la reproducción automática
 * 
 * Compatible con el nuevo sistema de:
 * - Playlists de rotación (ponderadas por peso)
 * - Playlists de intervalo (cada X canciones) 
 * - Playlists agendadas (fecha/hora específica)
 * - Sistema de prioridades y franjas horarias
 */
export const useAutoDj = (options = {}) => {
  const enabled = options?.enabled !== false;
  const { user } = useAuth();
  const [djState, setDjState] = useState({
    // Estado general
    isActive: false,
    currentChannel: null,
    
    // Estado de reproducción
    currentPlaylist: null,
    currentSong: null,
    isPlaying: false,
    
    // Contadores del sistema
    globalRotationCounter: 0,
    
    // Estado de interrupciones
    isInInterrupt: false,
    interruptType: null,
    
    // Estadísticas de playlists
    playlistsLoaded: {
      rotacion: 0,
      intervalo: 0,
      agendada: 0
    },
    
    // Estado del reproductor de audio
    audioState: null,
    
    // Estado del hook
    isInitialized: false,
    error: null
  });

  const [isLoading, setIsLoading] = useState(false);

  // Actualizar estado del DJ
  const updateDjState = useCallback(() => {
    if (!enabled) return;
    try {
      const newState = autoDj.getState();
      setDjState(prev => ({
        ...prev,
        ...newState,
        isInitialized: !!newState.currentChannel && newState.isActive
      }));
    } catch (error) {
      logger.error('❌ Error actualizando estado DJ:', error);
      setDjState(prev => ({
        ...prev,
        error: error.message
      }));
    }
  }, [enabled]);

  // Inicializar AutoDJ para un canal
  const initGuardRef = useRef({ lastChannelId: null, initializing: false });

  const initializeChannel = useCallback(async (channel) => {
    if (!channel) {
      logger.warn('⚠️ No se proporcionó canal para inicializar');
      return false;
    }

    try {
      // Permitir cambios de canal incluso si hay una inicialización en curso
      if (initGuardRef.current.initializing && initGuardRef.current.lastChannelId === channel.id) {
        logger.dev('⏸️ Misma inicialización ya en curso, ignorando');
        return false;
      }
      
      // Solo ignorar si es exactamente el mismo canal Y está activo
      if (initGuardRef.current.lastChannelId === channel.id && djState.isActive && !initGuardRef.current.initializing) {
        logger.dev('⏭️ Canal ya inicializado y activo en hook, ignorando');
        return true;
      }
      
      // Marcar como inicializando para este canal específico
      initGuardRef.current.initializing = true;
      initGuardRef.current.lastChannelId = channel.id;

      setIsLoading(true);
      setDjState(prev => ({ ...prev, error: null }));
      
      // Sistema de presencia se inicia en AuthContext
      logger.dev('✅ Sistema de presencia activo (manejado en AuthContext)');
      
      logger.dev('🎛️ Inicializando AutoDJ desde hook para:', channel.nombre || channel.name || channel.id);
      
      const success = await autoDj.initializeChannel(channel);
      
      if (success) {
        updateDjState();
        logger.dev('✅ AutoDJ inicializado exitosamente desde hook');
        
        // 📅 NUEVO: Iniciar servicio de contenidos programados
        if (user) {
          const usuarioId = user?.id || user?.usuario_id || user?.user_id;
          if (usuarioId) {
            logger.dev('📅 Iniciando servicio de contenidos programados...');
            const scheduledSuccess = await scheduledContentService.iniciar(usuarioId);
            if (scheduledSuccess) {
              logger.dev('✅ Servicio de contenidos programados iniciado');
            } else {
              logger.warn('⚠️ Error iniciando servicio de contenidos programados');
            }
          }
        }
      } else {
        throw new Error('Error inicializando AutoDJ');
      }
      
      return success;
    } catch (error) {
      logger.error('❌ Error en useAutoDj.initializeChannel:', error);
      setDjState(prev => ({ 
        ...prev, 
        error: error.message,
        isInitialized: false 
      }));
      return false;
    } finally {
      setIsLoading(false);
      initGuardRef.current.initializing = false;
    }
  }, [updateDjState, djState.isActive]);

  // Controles de reproducción
  const togglePlayPause = useCallback(async () => {
    try {
      logger.dev('🎮 Toggle play/pause desde hook');
      
      // Actualizar estado inmediatamente de forma optimista
      setDjState(prev => ({
        ...prev,
        isPlaying: !prev.isPlaying,
        isPaused: prev.isPlaying // Si estaba reproduciendo, ahora está pausado
      }));
      
      // Ejecutar la acción real
      await autoDj.togglePlayPause();
      
      // Sincronizar con el estado real después de un breve delay
      setTimeout(() => {
        updateDjState();
      }, 100);
      
    } catch (error) {
      logger.error('❌ Error en togglePlayPause:', error);
      // Si hay error, revertir al estado real
      updateDjState();
    }
  }, [updateDjState]);

  const stop = useCallback(() => {
    try {
      logger.dev('⏹️ Deteniendo AutoDJ desde hook');
      autoDj.stop();
      
      // 📅 Detener servicio de contenidos programados
      logger.dev('📅 Deteniendo servicio de contenidos programados...');
      scheduledContentService.detener();
      
      // Sistema de presencia se detiene en AuthContext
      logger.dev('✅ Sistema de presencia se detendrá en logout');
      
      updateDjState();
    } catch (error) {
      logger.error('❌ Error deteniendo AutoDJ:', error);
    }
  }, [updateDjState]);

  const next = useCallback(async () => {
    try {
      logger.dev('⏭️ Avanzando a siguiente canción desde hook');
      const nextSong = await autoDj.next();
      updateDjState();
      return nextSong;
    } catch (error) {
      logger.error('❌ Error avanzando canción:', error);
      return null;
    }
  }, [updateDjState]);

  // Obtener información de la pista actual
  const getCurrentTrackInfo = useCallback(() => {
    // Si hay una canción cargada en el AutoDJ, usar esa información
    if (djState.currentSong?.canciones) {
      const song = djState.currentSong.canciones;
      const computedTitle = (song.titulo && song.titulo.trim())
        || (song.artista && song.artista.trim())
        || (song.nombre && song.nombre.trim())
        || 'Sin título';
      const computedArtist = (song.artista && song.artista.trim()) || '';
      return {
        title: computedTitle,
        artist: computedArtist,
        playlist: djState.currentPlaylist?.nombre || null,
        playlistType: djState.currentPlaylist?.tipo || null,
        duration: getSongDuration(djState.currentSong),
        fileName: song.url_s3?.split('/').pop() || null,
        hasTrack: true,
        isInterrupt: djState.isInInterrupt,
        interruptType: djState.interruptType
      };
    }

    // Si hay canción directa (sin subcampo canciones)
    if (djState.currentSong?.titulo || djState.currentSong?.artista || djState.currentSong?.nombre) {
      const s = djState.currentSong;
      const computedTitle = (s.titulo && s.titulo.trim())
        || (s.artista && s.artista.trim())
        || (s.nombre && s.nombre.trim())
        || 'Sin título';
      const computedArtist = (s.artista && s.artista.trim()) || '';
      return {
        title: computedTitle,
        artist: computedArtist,
        playlist: djState.currentPlaylist?.nombre || null,
        playlistType: djState.currentPlaylist?.tipo || null,
        duration: getSongDuration(djState.currentSong),
        fileName: s.url_s3?.split('/').pop() || null,
        hasTrack: true,
        isInterrupt: djState.isInInterrupt,
        interruptType: djState.interruptType
      };
    }

    // 🔧 MEJORADO: Si está reproduciendo pero no hay canción válida, mostrar estado de carga
    if (djState.isPlaying && !djState.currentSong) {
      return {
        title: 'Cargando...',
        artist: djState.currentChannel?.nombre || djState.currentChannel?.name || 'Canal desconocido',
        playlist: djState.currentPlaylist?.nombre || null,
        playlistType: djState.currentPlaylist?.tipo || null,
        hasTrack: false,
        isInterrupt: djState.isInInterrupt,
        interruptType: djState.interruptType,
        isLoading: true
      };
    }

    // Fallback: mostrar columnas de canciones (titulo/artista/nombre) si hubiera datos residuales
    return {
      title: (djState.currentSong?.canciones?.titulo && djState.currentSong.canciones.titulo.trim())
        || (djState.currentSong?.canciones?.artista && djState.currentSong.canciones.artista.trim())
        || (djState.currentSong?.canciones?.nombre && djState.currentSong.canciones.nombre.trim())
        || (djState.currentSong?.titulo && djState.currentSong.titulo.trim())
        || (djState.currentSong?.artista && djState.currentSong.artista.trim())
        || (djState.currentSong?.nombre && djState.currentSong.nombre.trim())
        || 'Sin título',
      artist: (djState.currentSong?.canciones?.artista && djState.currentSong.canciones.artista.trim())
        || (djState.currentSong?.artista && djState.currentSong.artista.trim())
        || '',
      playlist: djState.currentPlaylist?.nombre || null,
      playlistType: djState.currentPlaylist?.tipo || null,
      hasTrack: false,
      isInterrupt: djState.isInInterrupt,
      interruptType: djState.interruptType
    };
  }, [djState.currentSong, djState.currentChannel, djState.currentPlaylist, djState.isInInterrupt, djState.interruptType, djState.isPlaying]);

  // Obtener estadísticas del AutoDJ
  const getStats = useCallback(() => {
    const totalPlaylists = djState.playlistsLoaded.rotacion + 
                          djState.playlistsLoaded.intervalo + 
                          djState.playlistsLoaded.agendada;

    return {
      // Estadísticas de playlists
      playlistsLoaded: totalPlaylists,
      rotationPlaylists: djState.playlistsLoaded.rotacion,
      intervalPlaylists: djState.playlistsLoaded.intervalo,
      scheduledPlaylists: djState.playlistsLoaded.agendada,
      
      // Estado actual
      currentPlaylist: djState.currentPlaylist?.nombre || null,
      playlistType: djState.currentPlaylist?.tipo || null,
      playlistWeight: djState.currentPlaylist?.peso || null,
      playlistOrder: djState.currentPlaylist?.orden || null,
      
      // Contadores
      globalRotationCounter: djState.globalRotationCounter,
      
      // Estado de interrupciones
      isInInterrupt: djState.isInInterrupt,
      interruptType: djState.interruptType,
      
      // Estado de reproducción
      isActive: djState.isActive,
      isPlaying: djState.isPlaying,
      
      // Estado del audio
      audioProgress: djState.audioState?.currentTime && djState.audioState?.duration 
        ? (djState.audioState.currentTime / djState.audioState.duration) * 100 
        : 0,
      audioCurrentTime: djState.audioState?.currentTime || 0,
      audioDuration: djState.audioState?.duration || 0,
      isCrossfading: djState.audioState?.isCrossfading || false,
      nextSongLoaded: djState.audioState?.nextSongLoaded || false,
      activePlayer: djState.audioState?.activePlayer || null
    };
  }, [djState]);

  // Obtener información de franjas horarias
  const getTimeFrameInfo = useCallback(() => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    return {
      currentTime: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
      currentMinutes: currentTime,
      date: now.toLocaleDateString(),
      dayOfWeek: now.toLocaleDateString('es-ES', { weekday: 'long' })
    };
  }, []);

  // Verificar si hay contenido disponible
  const hasContent = djState.isInitialized && djState.currentSong;

  // Verificar si el sistema está listo
  const isReady = djState.isInitialized && !isLoading && djState.isActive;



  // Obtener información de debugging
  const getDebugInfo = useCallback(() => {
    if (!djState.isInitialized) return null;

    return {
      // Estados principales
      isActive: djState.isActive,
      isPlaying: djState.isPlaying,
      isInInterrupt: djState.isInInterrupt,
      interruptType: djState.interruptType,
      
      // Información del canal
      channelId: djState.currentChannel?.id,
      channelName: djState.currentChannel?.nombre || djState.currentChannel?.name,
      
      // Información de playlist
      playlistId: djState.currentPlaylist?.id,
      playlistName: djState.currentPlaylist?.nombre,
      playlistType: djState.currentPlaylist?.tipo,
      playlistWeight: djState.currentPlaylist?.peso,
      
      // Información de canción
      songId: djState.currentSong?.id || djState.currentSong?.canciones?.id,
      songTitle: djState.currentSong?.canciones?.titulo || djState.currentSong?.titulo,
      
      // Contadores y estado
      globalRotationCounter: djState.globalRotationCounter,
      
      // Estado del audio
      audioState: djState.audioState,
      
      // Estadísticas
      playlistsLoaded: djState.playlistsLoaded
    };
  }, [djState]);

  // 🔧 OPTIMIZADO: Auto-actualización con polling (autoDj no tiene API de eventos)
  useEffect(() => {
    if (!enabled || !djState.isInitialized) return;
    
    let interval = null;

    // 🔄 POLLING: Actualización periódica de estado
    if (djState.isActive) {
      // Más frecuente cuando está activo (cada 2s para UX responsiva)
      interval = setInterval(() => {
        updateDjState();
      }, 2000); // 🔧 2 segundos para UI más responsiva
    } else {
      // Menos frecuente cuando está pausado (cada 30s)
      interval = setInterval(() => {
        updateDjState();
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [enabled, djState.isInitialized, djState.isActive, updateDjState]);

  // 🔧 NUEVO: Mantener el servicio de programaciones activo si el AutoDJ está inicializado
  useEffect(() => {
    if (!enabled || !djState.isInitialized) return;
    
    const checkScheduledService = async () => {
      try {
        // Si el AutoDJ está inicializado pero el servicio de programaciones NO está activo, reiniciarlo
        if (!scheduledContentService.isActive && user) {
          const usuarioId = user?.id || user?.usuario_id || user?.user_id;
          if (usuarioId) {
            logger.dev('🔄 Reiniciando servicio de contenidos programados...');
            const success = await scheduledContentService.iniciar(usuarioId);
            if (success) {
              logger.dev('✅ Servicio de contenidos programados reiniciado');
            }
          }
        }
      } catch (error) {
        logger.error('❌ Error verificando servicio de programaciones:', error);
      }
    };

    // Verificar cada 30 segundos si el servicio sigue activo
    const interval = setInterval(checkScheduledService, 30000);
    checkScheduledService(); // Ejecutar inmediatamente

    return () => clearInterval(interval);
  }, [enabled, djState.isInitialized, user]);

  // Limpiar al desmontar (SOLO cuando el componente realmente se desmonta)
  useEffect(() => {
    // Solo limpiar cuando el hook realmente se desmonte (no en cada re-render)
    return () => {
      logger.dev('🧹 Limpiando AutoDJ hook (desmontaje real del componente)');
      
      // 📅 Detener servicio de contenidos programados solo al desmontar el componente
      if (scheduledContentService.isActive) {
        logger.dev('📅 Deteniendo servicio de contenidos programados (desmontaje del componente)...');
        scheduledContentService.detener();
        }
        
        // 📊 NO detener logger de historial - debe persistir entre cambios de canal
        // El logger solo se detendrá en el logout completo desde App.jsx
        logger.dev('📊 Logger de historial manteniéndose activo para el siguiente canal...');
      };
    }, []); // ⚠️ Array vacío = solo se ejecuta al montar/desmontar el componente, NO en re-renders

  // 🔧 OPTIMIZACIÓN: Logging reducido para mejor rendimiento
  // Ref para rastrear la última canción loggeada y evitar duplicados
  const lastLoggedSongRef = useRef(null);
  
  useEffect(() => {
    if (!enabled) return;
    if (djState.currentSong && djState.isInitialized) {
      // Obtener ID único de la canción actual
      const currentSongId = djState.currentSong?.canciones?.id || djState.currentSong?.id;
      
      // Solo loggear si cambió el ID de la canción
      if (currentSongId && currentSongId !== lastLoggedSongRef.current) {
        const trackInfo = getCurrentTrackInfo();
        if (trackInfo.title && trackInfo.title !== 'Cargando...') {
          logger.dev('🎵 Nueva canción:', trackInfo.title);
          lastLoggedSongRef.current = currentSongId;
        }
      }
    }
  }, [enabled, djState.currentSong, djState.isInitialized, getCurrentTrackInfo]);

  useEffect(() => {
    if (!enabled) return;
    if (djState.isInInterrupt !== undefined) {
      logger.dev('🔄 Hook detecta cambio en interrupción:', {
        isInInterrupt: djState.isInInterrupt,
        interruptType: djState.interruptType
      });
    }
  }, [enabled, djState.isInInterrupt, djState.interruptType]);

  return {
    // Estado principal
    state: djState,
    isLoading,
    hasContent,
    isReady,
    
    // Controles de reproducción
    initializeChannel,
    togglePlayPause,
    stop,
    next,
    
    // Información detallada
    getCurrentTrackInfo,
    getStats,
    getTimeFrameInfo,
    getDebugInfo,
    
    // Utilidades
    updateDjState,
    error: djState.error,
    
    // Estados derivados para fácil acceso
    isPlaying: djState.isPlaying,
    isActive: djState.isActive,
    currentChannel: djState.currentChannel,
    currentPlaylist: djState.currentPlaylist,
    currentSong: djState.currentSong,
    globalRotationCounter: djState.globalRotationCounter,
    isInInterrupt: djState.isInInterrupt,
    interruptType: djState.interruptType
  };
};

export default useAutoDj; 