import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  HomeIcon, 
  Radio, 
  BookOpen, 
  PlusCircle, 
  History as HistoryIcon, 
  MessageSquare, 
  Settings as SettingsIcon, 
  LogOut, 
  Circle,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Music,
  Mic,
  Lock,
  CreditCard,
  ExternalLink,
  User
} from 'lucide-react';
import { Toaster } from './components/ui/toaster';
import PlayerPage from '@/pages/PlayerPage';
import ChannelsPage from '@/pages/ChannelsPage';
import NewAdPage from '@/pages/NewAdPage';
import AdHistoryPage from '@/pages/AdHistoryPage';
import RegisterPage from './pages/RegisterPage';
import GestorDashboard from './pages/gestor/GestorDashboard';
// ✅ ELIMINADO: OAuth ahora usa servidor HTTP local en Electron
// import OAuthCallbackPage from './pages/OAuthCallbackPage';
// import OAuthResultPage from './pages/OAuthResultPage';
import LoginPage from './pages/LoginPage';
import { Button } from '@/components/ui/button';
import DynamicBackground from '@/components/layout/DynamicBackground';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
// Componentes de desktop eliminados
import { useRole } from '@/hooks/useRole';
import { PermissionGated } from '@/components/RoleProtectedRoute';
import ReactivePlayButton from '@/components/player/ReactivePlayButton';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { channelsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAutoDj } from './hooks/useAutodjHook';
import autoDj from './services/autoDjService';
import { contentAssignmentsApi } from '@/lib/api';
import advancedPresenceService from '@/services/advancedPresenceService';
import scheduledContentService from '@/services/scheduledContentService';
import logger from '@/lib/logger';
import { useSessionMonitor } from '@/hooks/useSessionMonitor';
import SessionClosedModal from '@/components/SessionClosedModal';
import optimizedPresenceService from '@/services/optimizedPresenceService';
import { PlayerProvider } from '@/contexts/PlayerContext';
// DesktopOnlyPage eliminado

// Siempre es plataforma web/móvil (Electron eliminado)
export const getIsWebPlatform = () => true;
export const isWebPlatform = true;

// Función para obtener elementos de navegación
const getNavItemsForRole = (hasPermission, t) => {
  return [
    { path: '/', label: t('nav.player'), icon: HomeIcon, permission: 'canAccessPlayer' },
    { path: '/canales', label: t('nav.channels'), icon: Radio, permission: 'canAccessChannels' },
    { path: '/historial-anuncios', label: t('nav.history'), icon: HistoryIcon, permission: 'canAccessHistory' },
    { path: '/anuncio-nuevo', label: t('nav.createAd'), icon: PlusCircle, permission: 'canCreateImmediateAds' },
  ].filter(item => !item.permission || hasPermission(item.permission));
};

// Componente PlayerControls mejorado con AutoDJ
const PlayerControls = ({ 
  currentTrackInfo, 
  onPrevChannel, 
  onNextChannel, 
  djStats,
  channelName,
  channelImage,
  isPlayingScheduledContent = false
}) => {
  const { t } = useTranslation();
  // 🔒 Obtener estado de reproducción manual para bloquear controles
  const { isManualPlaybackActive, manualPlaybackInfo } = useAuth();
  const isBlocked = isPlayingScheduledContent || isManualPlaybackActive;
  const blockMessage = isManualPlaybackActive 
    ? `${t('player.manualPlayback')}: ${manualPlaybackInfo?.contentName || t('player.content')}`
    : isPlayingScheduledContent ? t('player.scheduledContentPlaying') : undefined;
  
  // 🔧 Mostrar "Contenido" cuando hay contenido programado o manual reproduciéndose
  const displayTitle = (isPlayingScheduledContent || isManualPlaybackActive) ? t('player.content') : currentTrackInfo.title;
  const displayArtist = (isPlayingScheduledContent || isManualPlaybackActive) ? t('player.content') : currentTrackInfo.artist;

  // 🎨 Referencias y estado para efecto marquee
  const titleRef = React.useRef(null);
  const artistRef = React.useRef(null);
  const [titleNeedsScroll, setTitleNeedsScroll] = React.useState(false);
  const [artistNeedsScroll, setArtistNeedsScroll] = React.useState(false);

  // 🔍 Verificar si los textos necesitan scroll
  React.useEffect(() => {
    // Pequeño delay para asegurar que el DOM está renderizado
    const checkOverflow = () => {
      if (titleRef.current) {
        const element = titleRef.current;
        const parent = element.parentElement;
        
        // Forzar inline-block temporalmente para obtener el ancho real del texto
        const originalDisplay = element.style.display;
        element.style.display = 'inline-block';
        element.style.width = 'auto';
        
        const textWidth = element.scrollWidth;
        const containerWidth = parent?.clientWidth || 0;
        const needsScroll = textWidth > containerWidth - 32; // -32px por el padding
        
        // Restaurar display
        element.style.display = originalDisplay;
        
        setTitleNeedsScroll(needsScroll);
        logger.dev(`🎨 Título necesita scroll: ${needsScroll} (texto: ${textWidth}px, contenedor: ${containerWidth - 32}px)`);
      }
      
      if (artistRef.current) {
        const element = artistRef.current;
        const parent = element.parentElement;
        
        // Forzar inline-block temporalmente para obtener el ancho real del texto
        const originalDisplay = element.style.display;
        element.style.display = 'inline-block';
        element.style.width = 'auto';
        
        const textWidth = element.scrollWidth;
        const containerWidth = parent?.clientWidth || 0;
        const needsScroll = textWidth > containerWidth - 32; // -32px por el padding
        
        // Restaurar display
        element.style.display = originalDisplay;
        
        setArtistNeedsScroll(needsScroll);
        logger.dev(`🎨 Artista necesita scroll: ${needsScroll} (texto: ${textWidth}px, contenedor: ${containerWidth - 32}px)`);
      }
    };

    // Ejecutar después de que el DOM se actualice
    const timeoutId = setTimeout(checkOverflow, 100);
    
    return () => clearTimeout(timeoutId);
  }, [displayTitle, displayArtist]);

  return (
    <>
      {/* Información de la canción y controles */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-30 flex flex-col items-center gap-4 w-full max-w-md px-4">
        {/* Control de canal con imagen */}
        <div className="flex items-center gap-3 mb-4">
          <motion.button
            onClick={onPrevChannel}
            whileHover={isBlocked ? {} : { scale: 1.1 }}
            whileTap={isBlocked ? {} : { scale: 0.95 }}
            disabled={isBlocked}
            title={blockMessage || t('player.previousChannel')}
            className={`w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 backdrop-blur-lg
                      hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300
                      shadow-[0_0_15px_rgba(162,217,247,0.2)] dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]
                      hover:shadow-[0_0_20px_rgba(162,217,247,0.3)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]
                      ${isBlocked ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <ChevronLeft className="w-6 h-6 text-black/70 dark:text-white/70" />
          </motion.button>

          {/* Imagen y nombre del canal */}
          <motion.div 
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/5 dark:bg-white/5 backdrop-blur-lg
                      shadow-[0_0_20px_rgba(162,217,247,0.2)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {channelImage && (
              <img 
                src={channelImage} 
                alt={channelName}
                className="w-8 h-8 rounded-full object-cover shadow-md"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <span className="text-sm font-sans font-light tracking-wider text-black/80 dark:text-white/80">
              {channelName || t('player.loading')}
            </span>
          </motion.div>

          <motion.button
            onClick={onNextChannel}
            whileHover={isBlocked ? {} : { scale: 1.1 }}
            whileTap={isBlocked ? {} : { scale: 0.95 }}
            disabled={isBlocked}
            title={blockMessage || t('player.nextChannel')}
            className={`w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 backdrop-blur-lg
                      hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300
                      shadow-[0_0_15px_rgba(162,217,247,0.2)] dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]
                      hover:shadow-[0_0_20px_rgba(162,217,247,0.3)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]
                      ${isBlocked ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <ChevronRight className="w-6 h-6 text-black/70 dark:text-white/70" />
          </motion.button>
        </div>

        {/* Título de la canción con efecto marquee */}
        <div className="overflow-hidden w-full px-4">
          {titleNeedsScroll ? (
            <div className="flex animate-marquee-slow hover:animation-paused">
        <motion.h1 
                ref={titleRef}
          key={`title-${displayTitle}`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-sans font-light tracking-wide text-black/90 dark:text-white/90 whitespace-nowrap pr-12"
        >
          {displayTitle}
        </motion.h1>
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-sans font-light tracking-wide text-black/90 dark:text-white/90 whitespace-nowrap pr-12"
              >
                {displayTitle}
              </motion.h1>
            </div>
          ) : (
            <motion.h1 
              ref={titleRef}
              key={`title-${displayTitle}`}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-sans font-light tracking-wide text-black/90 dark:text-white/90 text-center truncate"
            >
              {displayTitle}
            </motion.h1>
          )}
        </div>
        
        {/* Artista con efecto marquee */}
        <div className="overflow-hidden w-full px-4">
          {artistNeedsScroll ? (
            <div className="flex animate-marquee-slow hover:animation-paused">
        <motion.h2 
                ref={artistRef}
          key={`artist-${displayArtist}`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
                className="text-lg font-sans font-extralight tracking-wider text-black/70 dark:text-white/70 whitespace-nowrap pr-12"
        >
          {displayArtist}
        </motion.h2>
              <motion.h2 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg font-sans font-extralight tracking-wider text-black/70 dark:text-white/70 whitespace-nowrap pr-12"
              >
                {displayArtist}
              </motion.h2>
            </div>
          ) : (
            <motion.h2 
              ref={artistRef}
              key={`artist-${displayArtist}`}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg font-sans font-extralight tracking-wider text-black/70 dark:text-white/70 text-center truncate"
            >
              {displayArtist}
            </motion.h2>
          )}
        </div>

      </div>
    </>
  );
};

const VolumeControl = ({ side, icon: Icon, value, onChange, disabled = false }) => {
  const { t } = useTranslation();
  const [lastNonZero, setLastNonZero] = React.useState(value || 80);

  const handleChange = (e) => {
    if (disabled) return; // 🔒 Bloquear si está deshabilitado
    const v = parseInt(e.target.value);
    if (Number.isFinite(v) && v > 0) setLastNonZero(v);
    onChange(e);
  };

  const toggleMute = () => {
    if (disabled) return; // 🔒 Bloquear si está deshabilitado
    const newVal = value > 0 ? 0 : (lastNonZero || 80);
    onChange({ target: { value: String(newVal) } });
  };

  const horizontalBg = {
    background: `linear-gradient(90deg, #A2D9F7 ${value}%, rgba(180,180,180,0.35) ${value}%)`
  };

  return (
    <>
      {/* Escritorio: sliders verticales con burbuja y mute */}
      <div className={`flex fixed top-1/2 -translate-y-1/2 flex-col items-center gap-2 p-4 z-30 ${side === 'left' ? 'volume-left' : 'volume-right'}`}>
        <div className="relative h-40 flex flex-col items-center">
          <div className="absolute -top-6 text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-md">
            {value}%
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={handleChange}
            disabled={disabled}
            aria-label={side === 'left' ? t('player.musicVolume') : t('player.contentVolume')}
            className={`volume-slider ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            style={{ 
              writingMode: 'vertical-lr',
              direction: 'rtl',
              width: '26px',
              height: '160px'
            }}
          />
          <button
            onClick={toggleMute}
            disabled={disabled}
            title={disabled ? t('player.lockedDuringManual') : (value > 0 ? t('player.mute') : t('player.unmute'))}
            className={`mt-3 rounded-full p-2 bg-black/5 dark:bg-white/5 backdrop-blur-lg transition-all duration-300 shadow-[0_0_15px_rgba(128,128,128,0.15)] dark:shadow-[0_0_15px_rgba(128,128,128,0.1)] ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
          >
            <Icon className={`w-5 h-5 ${value === 0 ? 'text-[#A2D9F7]' : 'text-gray-500 dark:text-gray-400'}`} />
          </button>
          
          {/* 🔒 Indicador visual de bloqueo */}
          {disabled && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Lock className="w-6 h-6 text-[#A2D9F7] opacity-60" />
            </div>
          )}
        </div>
      </div>

      {/* Móvil: sin controles aquí (panel combinado más abajo) */}
    </>
  );
};

// Componente interno que usa useLocation
function AppContent() {
  const location = useLocation();
  
  // 🔧 Helper para normalizar rutas (quitar trailing slash excepto para '/')
  // Esto evita problemas cuando la URL viene con trailing slash (ej: /login/ vs /login)
  const normalizePath = (path) => path === '/' ? path : path.replace(/\/$/, '');
  const currentPath = normalizePath(location.pathname);
  
  // 🌐 Detectar plataforma web en tiempo de ejecución (importante para Electron dev mode)
  const isWeb = getIsWebPlatform();
  
  // 🔍 DEBUG: Log para verificar detección de plataforma y rol
  React.useEffect(() => {
    console.log('🌐 [Platform Debug]', {
      isWeb,
      protocol: window.location.protocol,
      pathname: location.pathname,
      currentPath // ruta normalizada
    });
  }, [isWeb, location.pathname, currentPath]);
  
  // 🔧 Usar currentPath (normalizado) para todas las comparaciones de rutas
  const isAuthRoute = currentPath === '/login' ||
                       currentPath.startsWith('/registro') ||
                       currentPath === '/descarga' ||
                       currentPath === '/solo-desktop';
  
  // 🌐 Rutas especiales en web que tienen su propia UI (no usan header/nav del reproductor)
  const isWebDashboardRoute = currentPath.startsWith('/gestor') || currentPath.startsWith('/admin');
  const { t } = useTranslation();
  
  const { theme } = useTheme();
  const { user, loading: authLoading, userChannels, channelsLoading, signOut, ensureChannelsLoaded, loadUserActiveChannels, isManualPlaybackActive, manualPlaybackInfo, registroCompleto, isLegacyUser } = useAuth();
  const { roleName, hasPermission, uiConfig, userRole } = useRole();
  const navigate = useNavigate();
  
  // Todos los usuarios autenticados pueden usar el reproductor
  const shouldEnablePlayer = !!user;

  // 🔑 CRÍTICO: Redirigir a registro si el usuario no completó el onboarding
  React.useEffect(() => {
    // Solo aplicar si:
    // 1. Hay usuario autenticado
    // 2. No estamos cargando
    // 3. registroCompleto es explícitamente false (no null/undefined)
    // 4. No estamos ya en la página de registro
    // 5. Es un usuario de Supabase Auth (no legacy)
    const isRegistroRoute = currentPath.startsWith('/registro');
    const isLoginRoute = currentPath === '/login';
    const isAuthRouteLocal = isRegistroRoute || isLoginRoute || currentPath === '/descarga';
    
    
    if (user && !authLoading && registroCompleto === false && !isAuthRouteLocal) {
      console.log('🔄 [Registro] Usuario sin registro completo, redirigiendo a /registro');
      navigate('/registro?continue=true');
    }
  }, [user, authLoading, registroCompleto, currentPath, navigate, isLegacyUser, userRole, isWeb]);

  // 🔑 NOTA: La verificación de suscripción para gestores en Electron se hace en AuthContext
  // Si el gestor no tiene suscripción activa, AuthContext NO establece la sesión y abre el dashboard web
  
  // 🔐 Monitoreo de sesión única - SOLO si el reproductor está habilitado
  const userId = user?.id || user?.usuario_id || user?.user_id;
  const deviceId = optimizedPresenceService.deviceId;
  const { sessionClosed } = useSessionMonitor(userId, deviceId, shouldEnablePlayer);
  
  // Hook del AutoDJ - DESHABILITADO para usuarios básicos en web
  const {
    state: djState,
    isLoading: djLoading,
    hasContent: djHasContent,
    initializeChannel: initializeDjChannel,
    togglePlayPause,
    next: nextTrack,
    getCurrentTrackInfo,
    getStats: getDjStats,
    isReady: djIsReady,
    error: djError
  } = useAutoDj({ enabled: shouldEnablePlayer });
  
  const [currentChannel, setCurrentChannel] = useState(null);
  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
  const [musicVolume, setMusicVolume] = useState(80);
  const [contentVolume, setContentVolume] = useState(100);
  const [autoDjInitialized, setAutoDjInitialized] = useState(false);
  const [isPlayingScheduledContent, setIsPlayingScheduledContent] = useState(false);
  const [audioElement, setAudioElement] = useState(null); // 🎵 Elemento de audio para visualizador
  const [appVersion, setAppVersion] = useState(null); // Versión de la aplicación
  const isInitializingRef = useRef(false);
  const volumesInitializedRef = useRef(false); // 🔧 Para evitar re-aplicación de volúmenes
  const currentChannelRef = useRef(null); // 🔧 Para callbacks sin causar re-renders
  const userChannelsRef = useRef([]); // 🔧 Para callbacks sin causar re-renders
  const realtimeSubscriptionRef = useRef(null); // 🔧 Para mantener suscripción activa sin recrearla
  
  // Cargar versión de la aplicación
  useEffect(() => {
    const loadAppVersion = async () => {
      try {
        const { getAppVersion } = await import('@/lib/appVersion');
        const version = await getAppVersion();
        setAppVersion(version);
      } catch (error) {
        logger.warn('No se pudo cargar la versión de la app:', error);
        // Fallback a versión síncrona
        const { getCurrentVersion } = await import('@/lib/appVersion');
        setAppVersion(getCurrentVersion());
      }
    };
    loadAppVersion();
  }, []);

  // 🔧 Actualizar refs para callbacks sin causar re-renders
  useEffect(() => {
    currentChannelRef.current = currentChannel;
    userChannelsRef.current = userChannels;
  }, [currentChannel, userChannels]);

  // 🔧 CRÍTICO: Limpiar estados cuando no hay usuario (después de logout)
  useEffect(() => {
    if (!user) {
      setCurrentChannel(null);
      setAutoDjInitialized(false);
      setCurrentChannelIndex(0);
      volumesInitializedRef.current = false; // 🔧 Resetear flag de volúmenes
      realtimeSubscriptionRef.current = null; // 🔧 Resetear suscripción para nuevo usuario
      logger.dev('🧹 Estados limpiados - usuario deslogueado');
    }
  }, [user]);

  // 🔧 Actualizar estado de contenido programado - SOLO si el reproductor está habilitado
  useEffect(() => {
    if (!shouldEnablePlayer) return;
    
    const checkScheduledContent = () => {
      try {
        const isPlaying = scheduledContentService.isPlayingScheduledContent || false;
        setIsPlayingScheduledContent(prevState => {
          // Solo actualizar si hay cambio para evitar re-renders innecesarios
          if (prevState !== isPlaying) {
            logger.dev(`🎯 Estado contenido programado: ${isPlaying ? 'REPRODUCIENDO' : 'NORMAL'}`);
            return isPlaying;
          }
          return prevState;
        });
      } catch (error) {
        // Si el servicio no está inicializado, asegurarse de que esté en false
        setIsPlayingScheduledContent(false);
      }
    };

    // Verificar cada 100ms para tener feedback más rápido
    const interval = setInterval(checkScheduledContent, 100);
    checkScheduledContent(); // Ejecutar inmediatamente

    return () => clearInterval(interval);
  }, [shouldEnablePlayer]);
  
  // Estado optimista para el botón play/pause
  const [optimisticPlayState, setOptimisticPlayState] = useState(null);
  const [isChangingChannel, setIsChangingChannel] = useState(false);
  const [wasPlayingBeforeChange, setWasPlayingBeforeChange] = useState(false);
  const pendingChannelChangeIdRef = useRef(null);
  
  // Limpiar estado optimista cuando el estado real cambie
  useEffect(() => {
    // Solo limpiar estado optimista si el estado real coincide Y no estamos en cambio de canal
    if (optimisticPlayState !== null && djState && !isChangingChannel) {
      // Si el estado real coincide con el optimista, limpiar después de un delay
      const stateMatches = 
        (optimisticPlayState === 'playing' && djState.isPlaying) ||
        (optimisticPlayState === 'paused' && !djState.isPlaying);
      
      if (stateMatches) {
        const timer = setTimeout(() => {
          if (!isChangingChannel && !wasPlayingBeforeChange) {
            setOptimisticPlayState(null);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [djState?.isPlaying, optimisticPlayState, isChangingChannel, wasPlayingBeforeChange]);

  // Escuchar evento de configuración del canal actual
  useEffect(() => {
    const handleConfigurarCanalActual = (event) => {
      const { canal } = event.detail;
      logger.dev('🎛️ Configurando canal actual desde evento:', canal);
      setCurrentChannel(canal);
      
      // Encontrar el índice del canal en userChannels
      if (userChannels && userChannels.length > 0) {
        const index = userChannels.findIndex(ch => ch.id === canal.id);
        if (index !== -1) {
          setCurrentChannelIndex(index);
          logger.dev('📊 Índice del canal actualizado:', index);
        } else {
          logger.dev('⚠️ Canal no encontrado en userChannels, usando índice 0');
          setCurrentChannelIndex(0);
        }
      } else {
        logger.dev('⚠️ userChannels no disponible, usando índice 0');
        setCurrentChannelIndex(0);
      }
    };

    window.addEventListener('configurarCanalActual', handleConfigurarCanalActual);
    
    // Nuevo: escuchar selección automática tras login
    const handleCanalAutoSeleccionado = (event) => {
      const { canal } = event.detail || {};
      if (!canal) return;
      // No cambiar de canal si ya hay uno activo (p. ej., está reproduciendo)
      if (currentChannel?.id) {
        logger.dev('⏭️ Ignorando auto-selección: ya hay un canal activo:', currentChannel.name);
        return;
      }
      logger.dev('🎲 Canal auto-seleccionado recibido:', canal);
      const channelFormatted = {
        id: canal.id,
        name: canal.nombre || canal.name,
        type: canal.tipo,
        description: canal.descripcion,
        streamUrl: canal.stream_url,
        songTitle: canal.nombre || canal.name,
        artist: canal.tipo || 'Radio Online',
        imagen_url: canal.imagen_url || canal.imageUrl
      };
      setCurrentChannel(channelFormatted);
      // Exponer canal actual globalmente para que AuthContext pueda saber si hay uno activo
      window.currentPlayerChannelId = channelFormatted.id;
      window.currentPlayerChannelName = channelFormatted.name || channelFormatted.songTitle || t('common.unknownChannel');
      if (userChannels && userChannels.length > 0) {
        const index = userChannels.findIndex(ch => ch.id === canal.id);
        if (index !== -1) {
          setCurrentChannelIndex(index);
        }
      }
    };
    window.addEventListener('canalAutoSeleccionado', handleCanalAutoSeleccionado);
    
    // 🔧 SIMPLIFICADO: Usar la misma lógica de Realtime que ChannelsPage
    const handleCanalesActualizados = (event) => {
      const { canales } = event.detail || {};
      if (!canales) return;
      
      logger.dev('🔄 Reproductor: Canales actualizados, verificando canal actual:', currentChannel?.id);
      
      // Verificar si el canal actual sigue disponible
      if (currentChannel) {
        const canalActualDisponible = canales.find(c => c.id === currentChannel.id);
        if (!canalActualDisponible) {
          logger.dev('⚠️ Reproductor: Canal actual ya no está disponible, seleccionando nuevo canal');
          
          if (canales.length > 0) {
            // Seleccionar el primer canal disponible
            const nuevoCanal = canales[0];
            const channelFormatted = {
              id: nuevoCanal.id,
              name: nuevoCanal.nombre || nuevoCanal.name,
              type: nuevoCanal.tipo,
              description: nuevoCanal.descripcion,
              streamUrl: nuevoCanal.stream_url,
              songTitle: nuevoCanal.nombre || nuevoCanal.name,
              artist: nuevoCanal.tipo || 'Radio Online',
              imagen_url: nuevoCanal.imagen_url || nuevoCanal.imageUrl
            };
            setCurrentChannel(channelFormatted);
            window.currentPlayerChannelId = channelFormatted.id;
            window.currentPlayerChannelName = channelFormatted.name || channelFormatted.songTitle || 'Canal Desconocido';
            setCurrentChannelIndex(0);
            logger.dev('✅ Reproductor: Nuevo canal seleccionado:', nuevoCanal.nombre);
          } else {
            // No hay canales disponibles
            setCurrentChannel(null);
            setCurrentChannelIndex(0);
            logger.dev('⚠️ Reproductor: No hay canales disponibles');
          }
        }
      }
    };
      window.addEventListener('canalesActualizados', handleCanalesActualizados);
    
    return () => {
      window.removeEventListener('configurarCanalActual', handleConfigurarCanalActual);
      window.removeEventListener('canalAutoSeleccionado', handleCanalAutoSeleccionado);
      window.removeEventListener('canalesActualizados', handleCanalesActualizados);
    };
  }, [userChannels, currentChannel]);

  // 🔧 SIMPLIFICADO: Suscripción Realtime (solo sincroniza AuthContext para evitar doble recarga)
  // 🚫 DESHABILITADO para usuarios básicos en web
  useEffect(() => {
    if (!shouldEnablePlayer) return;
    
    const userId = user?.id || user?.usuario_id || user?.user_id;
    if (!userId) return;

    // 🔧 CRÍTICO: Solo crear suscripción si no existe ya
    if (realtimeSubscriptionRef.current) {
      logger.dev('♻️ Reproductor: Suscripción Realtime ya activa - reutilizando');
      return;
    }

    logger.dev('🔄 Reproductor: Configurando suscripción Realtime para canales del usuario:', userId);

    const channelName = `realtime-canales-reproductor-${userId}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reproductor_usuario_canales',
          filter: `usuario_id=eq.${userId}`
        },
        async (payload) => {
          logger.dev('🔄 Reproductor: Cambio detectado en reproductor_usuario_canales:', payload);
          
          try {
            // 🔧 CRÍTICO: Invalidar cache antes de recargar
            channelsApi.invalidateChannelsCache(userId);
            
            // Solo sincronizar el contexto global (evita doble recarga en ChannelsPage)
            logger.dev('🔄 Reproductor: Sincronizando canales con AuthContext...');
            await loadUserActiveChannels(userId);
            logger.dev('✅ Reproductor: AuthContext sincronizado');
            
            // Verificar si el canal actual sigue disponible (usando refs para evitar dependencias)
            if (currentChannelRef.current) {
              const canalActualDisponible = userChannelsRef.current.find(c => c.id === currentChannelRef.current.id);
              if (!canalActualDisponible) {
                logger.dev('⚠️ Reproductor: Canal actual ya no está disponible, seleccionando nuevo canal');
                
                if (userChannelsRef.current.length > 0) {
                  // Seleccionar el primer canal disponible
                  const nuevoCanal = userChannelsRef.current[0];
                  const channelFormatted = {
                    id: nuevoCanal.id,
                    name: nuevoCanal.nombre || nuevoCanal.name,
                    type: nuevoCanal.tipo,
                    description: nuevoCanal.descripcion,
                    streamUrl: nuevoCanal.stream_url,
                    songTitle: nuevoCanal.nombre || nuevoCanal.name,
                    artist: nuevoCanal.tipo || 'Radio Online',
                    imagen_url: nuevoCanal.imagen_url || nuevoCanal.imageUrl
                  };
                  setCurrentChannel(channelFormatted);
                  window.currentPlayerChannelId = channelFormatted.id;
                  window.currentPlayerChannelName = channelFormatted.name || channelFormatted.songTitle || t('common.unknownChannel');
                  setCurrentChannelIndex(0);
                  logger.dev('✅ Reproductor: Nuevo canal seleccionado:', nuevoCanal.nombre);
                } else {
                  // No hay canales disponibles
            setCurrentChannel(null);
            window.currentPlayerChannelId = null;
            window.currentPlayerChannelName = null;
                  setCurrentChannelIndex(0);
                  logger.dev('⚠️ Reproductor: No hay canales disponibles');
                }
              } else {
                logger.dev('✅ Reproductor: Canal actual sigue disponible');
              }
            }
          } catch (error) {
            logger.error('❌ Reproductor: Error recargando canales en tiempo real:', error);
          }
        }
      )
      .subscribe();

    realtimeSubscriptionRef.current = subscription; // Guardar referencia
    logger.dev('✅ Reproductor: Suscripción Realtime configurada para usuario:', userId);

    return () => {
      logger.dev('🧹 Reproductor: Limpiando suscripción Realtime para usuario:', userId);
      supabase.removeChannel(subscription);
      realtimeSubscriptionRef.current = null; // Limpiar referencia
    };
  }, [shouldEnablePlayer, user]); // 🔧 CRÍTICO: Depende de shouldEnablePlayer y usuario

  // Obtener información actual del track (hooks ya declarados arriba)
  const currentTrackInfo = getCurrentTrackInfo();
  const djStats = getDjStats();

  // Cargar canales bajo demanda desde cualquier ruta - SOLO si el reproductor está habilitado
  useEffect(() => {
    if (!shouldEnablePlayer) return;
    
    // Cargar canales si no hay suscripción Realtime activa y no hay canales
    if (!window.channelsRealtimeActive && userChannels.length === 0) {
      logger.dev('🔄 App.jsx - Cargando canales del usuario');
      ensureChannelsLoaded();
    }
  }, [shouldEnablePlayer, ensureChannelsLoaded, userChannels.length]);

  // 🔧 NUEVO: Actualizar estado de presencia según actividad del reproductor
  // 🚫 DESHABILITADO para usuarios básicos en web
  useEffect(() => {
    if (!shouldEnablePlayer || !advancedPresenceService.isPresenceActive() || !djState) return;
    
    // 🔧 CRÍTICO: No actualizar estado de presencia durante cambio de canal
    // Esto evita que el botón cambie de estado temporalmente
    if (isChangingChannel || wasPlayingBeforeChange) {
      return;
    }

    if (djState.isPlaying) {
      advancedPresenceService.updateState('playing', {
        currentSong: currentTrackInfo?.title,
        artist: currentTrackInfo?.artist,
        channel: currentChannel?.name
      });
    } else if (djState.isPaused) {
      advancedPresenceService.updateState('paused', {
        channel: currentChannel?.name,
        currentSong: currentTrackInfo?.title,
        artist: currentTrackInfo?.artist
      });
    } else {
      // Si no está reproduciendo ni pausado, el usuario está "conectado"
      advancedPresenceService.updateState('conectado', {
        currentPage: location.pathname,
        channel: currentChannel?.name,
        currentSong: currentTrackInfo?.title,
        artist: currentTrackInfo?.artist
      });
    }
  }, [shouldEnablePlayer, djState?.isPlaying, djState?.isPaused, currentTrackInfo, currentChannel, location.pathname, isChangingChannel, wasPlayingBeforeChange]);

  // 🔧 OPTIMIZACIÓN: Inicialización del AutoDJ con debouncing
  // 🚫 DESHABILITADO para usuarios básicos en web
  useEffect(() => {
    if (!shouldEnablePlayer || !currentChannel || !initializeDjChannel) return;

    const needsInit = !autoDjInitialized || (djState?.currentChannel?.id && djState.currentChannel.id !== currentChannel.id);
    if (!needsInit) return;
    if (isInitializingRef.current) return;

    // 🔧 OPTIMIZACIÓN: Debouncing para evitar inicializaciones múltiples
    const timeoutId = setTimeout(() => {
      isInitializingRef.current = true;
      const channelName = currentChannel?.name;
      const wasPlaying = djState?.isPlaying;
      
      logger.dev('🚀 Inicializando AutoDJ para canal:', channelName);
      
      initializeDjChannel(currentChannel)
        .then((ok) => {
          if (ok) {
            setAutoDjInitialized(true);
            
            // 🔧 CORREGIDO: No intentar continuar reproducción aquí
            // El autoDjService.js ya maneja la continuación automática en línea 794
            if (wasPlaying) {
              logger.dev('▶️ Continuando reproducción tras cambio de canal...');
              // Solo mantener el estado optimista
              setOptimisticPlayState('playing');
            }
          }
        })
        .finally(() => {
          isInitializingRef.current = false;
        });
    }, 100); // 🔧 OPTIMIZACIÓN: Debouncing de 100ms

    return () => clearTimeout(timeoutId);
  }, [user, currentChannel, initializeDjChannel, autoDjInitialized, djState?.currentChannel?.id, djState?.isPlaying, togglePlayPause]);

  // Sincronizar volúmenes con audioPlayer solo cuando se accede al reproductor
  useEffect(() => {
    if (user && currentPath === '/' && !volumesInitializedRef.current) {
      // Importación lazy de audioPlayer solo cuando realmente se necesita
      import('./services/audioPlayerService').then(({ default: audioPlayer }) => {
        // Aplicar volúmenes iniciales solo una vez por sesión
        audioPlayer.setMusicVolume(musicVolume / 100);
        audioPlayer.setContentVolume(contentVolume / 100);
        volumesInitializedRef.current = true;
        logger.dev('🔊 Volúmenes inicializados - Música:', musicVolume, 'Contenido:', contentVolume);
      });
    }
  }, [user, currentPath]); // 🔧 CRÍTICO: Removidas dependencias de volumen para evitar re-aplicación

  // 🎵 Obtener elemento de audio para el visualizador
  // 🚫 DESHABILITADO para usuarios básicos en web
  useEffect(() => {
    if (!shouldEnablePlayer || currentPath !== '/') return;

    let intervalId;
    let lastAudioSrc = null;
    let lastAudioElementRef = null; // 🔧 Usar referencia local en lugar de comparar con state
    
    import('./services/audioPlayerService').then(({ default: audioPlayer }) => {
      const updateAudioElement = () => {
        const state = audioPlayer.getState();
        const currentSrc = state.audioElement?.src;
        
        // 🔧 CRÍTICO: NO actualizar audioElement si hay contenido programado reproduciéndose
        // Esto previene que la reconexión del visualizador interrumpa el contenido
        if (state.isPlayingScheduledContent) {
          // logger.dev('⏸️ Saltando actualización de audioElement - contenido programado en reproducción');
          return;
        }
        
        // Actualizar SOLO si el elemento cambió O si el src cambió
        if (state.audioElement && (state.audioElement !== lastAudioElementRef || currentSrc !== lastAudioSrc)) {
          if (state.audioElement !== lastAudioElementRef) {
            logger.dev('🎵 App.jsx - audioElement cambió (nueva instancia)');
          } else if (currentSrc !== lastAudioSrc) {
            logger.dev('🎵 App.jsx - src cambió:', currentSrc);
          }
          setAudioElement(state.audioElement);
          lastAudioElementRef = state.audioElement; // 🔧 Guardar referencia LOCAL
          lastAudioSrc = currentSrc;
        }
      };

      // Intentar obtener el elemento inmediatamente
      updateAudioElement();

      // Y luego cada 100ms para detectar cambios rápidos
      intervalId = setInterval(updateAudioElement, 100);
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [shouldEnablePlayer, currentPath, djState?.isPlaying, djState?.currentSong, currentChannel]); // 🔧 Removido audioElement de dependencias

  const handleLogout = async () => {
    logger.dev('🚪 Iniciando proceso de logout...');
    
    // 🔧 CRÍTICO: Marcar que estamos haciendo logout ANTES de todo
    sessionStorage.setItem('ondeon_logging_out', 'true');
    
    // 🔧 Helper para ejecutar con timeout (evita bloqueos)
    const withTimeout = (promise, ms = 2000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
      ]).catch(() => {}); // Silenciar errores
    };
    
    // 🧹 Limpiar estados locales INMEDIATAMENTE (no bloquea)
    setCurrentChannel(null);
    setAutoDjInitialized(false);
    
    // 🧹 Limpiar variables globales INMEDIATAMENTE
    window.currentPlayerChannelId = null;
    window.currentPlayerChannelName = null;
    window.channelsRealtimeActive = false;
    window.suppressAutoSelect = false;
    delete window.scheduledContentDebug;
    delete window.forceWatchdogRecovery;
    delete window.simulateAudioHang;
    
    // 🔧 Detener servicios en paralelo (con timeout de 2 segundos cada uno)
    try {
      // Importar audioPlayer
      const audioPlayerModule = await withTimeout(import('./services/audioPlayerService'), 1000);
      const audioPlayer = audioPlayerModule?.default;
      
      // Ejecutar limpieza en paralelo
      await Promise.allSettled([
        withTimeout(advancedPresenceService.stopPresence?.(), 2000),
        withTimeout(autoDj?.stop?.(), 1000),
        audioPlayer?.stop?.(),
        audioPlayer?.reset?.(),
        autoDj?.reset?.(),
      ]);
      
      logger.dev('✅ Servicios detenidos');
    } catch (e) {
      logger.warn('⚠️ Error parcial deteniendo servicios:', e);
    }
    
    // Ejecutar cleanup del servicio de presencia si existe
    try {
      if (typeof window.__presence_cleanup === 'function') {
        window.__presence_cleanup();
        delete window.__presence_cleanup;
      }
    } catch (e) {}
    
    // 🔧 CRÍTICO: Limpiar localStorage ANTES del signOut
    localStorage.removeItem('ondeon_legacy_user');
    localStorage.removeItem('ondeon_edge_token');
    
    // 🔧 CRÍTICO para OAuth: Limpiar TODAS las claves de Supabase
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    logger.dev('✅ localStorage limpiado (legacy + Supabase)');
    
    // 🔐 Cerrar sesión (con timeout de 5 segundos)
    logger.dev('🔐 Cerrando sesión...');
    try {
      await withTimeout(signOut(), 5000);
      logger.dev('✅ Sesión cerrada');
    } catch (e) {
      logger.warn('⚠️ Timeout en signOut, forzando recarga...');
    }
    
    // ✅ Navegar a /login
    logger.dev('🔁 Navegando a /login...');
    setTimeout(() => window.location.replace('/login'), 300);
  };

  const handlePlayPause = () => {
    if (djIsReady && togglePlayPause && djState) {
      // 🔧 MEJORADO: Durante cambios de canal, no cambiar estado optimista
      if (!isChangingChannel && !wasPlayingBeforeChange) {
        // Estado optimista: cambiar inmediatamente la UI
        const newState = !djState.isPlaying;
        setOptimisticPlayState(newState ? 'playing' : 'paused');
        
        // Resetear el estado optimista después de un tiempo
        setTimeout(() => {
          setOptimisticPlayState(null);
        }, 800); // 800ms para que se sincronice el estado real
      }
      
      // Ejecutar la acción real
      togglePlayPause();
    } else {
      logger.warn('⚠️ AutoDJ no está listo para reproducir:', {
        djIsReady,
        hasToggleFunction: !!togglePlayPause,
        hasDjState: !!djState,
        isChangingChannel
      });
    }
  };

  // Cambiar al siguiente canal
  const handleNextChannel = () => {
    if (!userChannels || userChannels.length === 0) {
      logger.warn('⚠️ No hay canales disponibles para cambiar');
      return;
    }

    const currentIndex = userChannels.findIndex(channel => channel.id === currentChannel?.id);
    const nextIndex = currentIndex < userChannels.length - 1 ? currentIndex + 1 : 0;
    const nextChannel = userChannels[nextIndex];

    if (nextChannel) {
      logger.dev('➡️ Cambiando al siguiente canal:', nextChannel.nombre);
      handleChannelChange(nextChannel);
    }
  };

  // Cambiar al canal anterior
  const handlePrevChannel = () => {
    if (!userChannels || userChannels.length === 0) {
      logger.warn('⚠️ No hay canales disponibles para cambiar');
      return;
    }

    const currentIndex = userChannels.findIndex(channel => channel.id === currentChannel?.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : userChannels.length - 1;
    const prevChannel = userChannels[prevIndex];

    if (prevChannel) {
      logger.dev('⬅️ Cambiando al canal anterior:', prevChannel.nombre);
      handleChannelChange(prevChannel);
    }
  };

  // 🔧 OPTIMIZACIÓN: Función para cambiar canal con estado optimista
  const handleChannelChange = async (channel) => {
    try {
      setIsChangingChannel(true);
      
      // 🔧 CRÍTICO: Guardar estado de reproducción antes del cambio
      const wasPlaying = djState?.isPlaying || optimisticPlayState === 'playing';
      setWasPlayingBeforeChange(wasPlaying);
      if (wasPlaying) {
        setOptimisticPlayState('playing'); // Mantener UI como "playing"
      }
      
      logger.dev('🎛️ Cambiando canal a:', channel.nombre, '- Estaba reproduciendo:', wasPlaying);
      
      // 📊 Enviar evento de cambio de canal
      try {
        const { default: optimizedPresenceService } = await import('./services/optimizedPresenceService.js');
        await optimizedPresenceService.sendChannelChanged({
          fromChannel: currentChannel?.name || currentChannel?.nombre || 'Ninguno',
          toChannel: channel.nombre || channel.name,
          fromChannelId: currentChannel?.id || null,
          toChannelId: channel.id
        });
        logger.dev('📊 Evento de cambio de canal enviado:', `${currentChannel?.name || 'Ninguno'} → ${channel.nombre}`);
      } catch (error) {
        logger.warn('⚠️ No se pudo enviar evento de cambio de canal:', error.message);
      }
      
      // 🔧 OPTIMIZACIÓN: Estado optimista - actualizar UI inmediatamente
      const channelFormatted = {
        id: channel.id,
        name: channel.nombre,
        type: channel.tipo,
        description: channel.descripcion,
        streamUrl: channel.stream_url,
        songTitle: channel.nombre,
        artist: channel.tipo || "Radio Online",
        imagen_url: channel.imagen_url || channel.imageUrl
      };
      
      // Actualizar estado inmediatamente para mejor UX
      setCurrentChannel(channelFormatted);
      // Guardar el objetivo del cambio para limpiar flags cuando se confirme
      pendingChannelChangeIdRef.current = channel.id;
      
      // Actualizar el índice del canal
      const newIndex = userChannels.findIndex(ch => ch.id === channel.id);
      if (newIndex !== -1) {
        setCurrentChannelIndex(newIndex);
      }
      
    } catch (error) {
      logger.error('❌ Error cambiando canal:', error);
      setIsChangingChannel(false);
    }
  };

  // 🔧 NUEVO: Limpiar flags solo cuando el nuevo canal esté activo y reproduciendo (si venía reproduciendo)
  useEffect(() => {
    if (!isChangingChannel) return;
    const targetChannelId = pendingChannelChangeIdRef.current;
    if (!targetChannelId) return;

    const djChannelId = djState?.currentChannel?.id;
    if (djChannelId !== targetChannelId) return; // Aún no ha conmutado el canal en el DJ

    if (wasPlayingBeforeChange) {
      // Veníamos reproduciendo: esperar a que vuelva a estado playing
      if (djState?.isPlaying) {
        setWasPlayingBeforeChange(false);
        setOptimisticPlayState(null);
        setIsChangingChannel(false);
        pendingChannelChangeIdRef.current = null;
      }
    } else {
      // No veníamos reproduciendo: podemos limpiar al confirmar el canal
      setIsChangingChannel(false);
      pendingChannelChangeIdRef.current = null;
    }
  }, [djState?.currentChannel?.id, djState?.isPlaying, isChangingChannel, wasPlayingBeforeChange]);

  // Detectar si estamos en una ruta de admin
  const isAdminRoute = currentPath.startsWith('/admin');

  // 🔑 CRÍTICO: Mostrar loading mientras se determina registroCompleto para usuarios de Supabase Auth
  // Esto evita el flash del reproductor antes de la redirección a /registro
  if (user && !isLegacyUser && registroCompleto === null && !isAuthRoute && isWeb) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e14]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#A2D9F7]/30 border-t-[#A2D9F7] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/40 text-sm">Verificando cuenta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen text-foreground flex flex-col bg-background font-sans`}>
      {/* 🔐 Modal de sesión cerrada */}
      <SessionClosedModal isOpen={sessionClosed} />
      
      {/* 🖥️ Background dinámico solo en desktop y en rutas del reproductor */}
      {user && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute && !isWeb && (
        <DynamicBackground 
          isPlaying={djState?.isPlaying || false} 
          theme={theme}
        />
      )}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Header flotante (solo con usuario autenticado, fuera de auth, admin y dashboards web) */}
        {user && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute && (
          <header className={`fixed top-0 left-0 right-0 w-full px-8 py-6 z-[60] transition-all duration-300
            ${currentPath !== '/' 
              ? 'backdrop-blur-lg bg-background/80' 
              : 'backdrop-blur-lg bg-background/70 sm:bg-transparent sm:backdrop-blur-0'}`}>
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/icono-ondeon.png"
                  alt="Ondeón Logo"
                  className="h-16 w-16 sm:h-14 sm:w-14 drop-shadow-lg"
                  style={{ maxWidth: 'none' }}
                  onError={(e) => {
                    console.error('Error al cargar el logo');
                    e.target.style.display = 'none';
                  }}
                />
                {/* Mostrar texto SMART junto al logo en todas las versiones */}
                <span className="text-2xl tracking-[0.2em] font-light text-[#A2D9F7] font-sans">SMART</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 px-2 py-1 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-md border border-white/10 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)] ml-auto">
                <span className="text-sm text-[#A2D9F7] flex items-center gap-2 px-2">
                  {user?.user_metadata?.establecimiento || user?.establecimiento || user?.user_metadata?.username || user?.username || user?.nombre_usuario || user?.email || t('common.user')}
                  <Circle size={8} className="fill-green-500 text-green-500" />
                </span>

                <div>
                  <ThemeToggle />
                </div>
                
                {/* Dashboard con efecto rainbow - Para administradores (rol_id = 3) */}
                <PermissionGated permissions={['showAdminPanelInSettings']}>
                  <Link to="/admin/dashboard" title={t('nav.dashboard')}>
                    <Button variant="ghost" size="icon" className="relative overflow-visible group">
                      <SettingsIcon 
                        size={20} 
                        className="rainbow-icon transition-transform group-hover:rotate-90 duration-300"
                      />
                    </Button>
                  </Link>
                </PermissionGated>
                
                {/* Engranaje de configuración eliminado para gestores - solo lo tienen admins (rainbow) */}
                
                {/* Profile para gestores (rol_id = 2) - Acceso a /gestor desde desktop */}
                {userRole === ROLES.GESTOR && (
                  <Link to="/gestor" title={t('nav.myAccount', 'Mi cuenta')}>
                    <Button variant="ghost" size="icon" className="text-foreground/60 hover:text-[#A2D9F7]">
                      <User size={20} />
                    </Button>
                  </Link>
                )}
                
                <Button variant="ghost" size="icon" className="text-foreground/60 hover:text-[#A2D9F7]" onClick={handleLogout} title={t('nav.logout')}>
                  <LogOut size={20} />
                </Button>
              </div>
            </div>
          </header>
        )}

        <div className={`flex-1 relative ${(isAuthRoute || !user || isAdminRoute || isWebDashboardRoute) ? 'pt-0' : 'pt-28'}`}>
          <main className={`${(isAuthRoute || !user || isAdminRoute || isWebDashboardRoute) ? 'w-full mx-0 px-0 py-0 pb-0 max-w-none' : 'w-full max-w-5xl mx-auto px-16 sm:px-20 md:px-24 py-6 pb-32'}`}>
            <PlayerProvider value={{ isPlaying: djState?.isPlaying || false, currentChannel: currentChannel || djState?.currentChannel, currentSong: djState?.currentSong }}>
            <Routes>
              {user ? (
                <>
                  {/* Rutas principales para usuarios autenticados */}
                  <Route path="/" element={<PlayerPage />} />
                  <Route path="/canales" element={
                    <ChannelsPage 
                      setCurrentChannel={setCurrentChannel} 
                      initializeDjChannel={initializeDjChannel} 
                      currentChannel={currentChannel} 
                      isPlaying={djState?.isPlaying} 
                      togglePlayPause={togglePlayPause} 
                    />
                  } />
                  <Route path="/anuncio-nuevo" element={<NewAdPage />} />
                  <Route path="/historial-anuncios" element={<AdHistoryPage />} />
                  <Route path="/gestor" element={<GestorDashboard />} />
                  <Route path="/registro" element={<RegisterPage />} />
                  
                  {/* Redirigir /login a home si ya está autenticado */}
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              ) : (
                <>
                  {/* Rutas para usuarios no autenticados */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/registro" element={<RegisterPage />} />
                  <Route path="*" element={<LoginPage />} />
                </>
              )}
            </Routes>
            </PlayerProvider>
          </main>

          {/* Elementos del reproductor solo en la página principal Y con usuario autenticado Y fuera de admin */}
          {currentPath === '/' && user && !channelsLoading && !isAuthRoute && !isAdminRoute && (
            <>
              <PlayerControls
                currentTrackInfo={currentTrackInfo}
                onPrevChannel={() => handlePrevChannel()}
                onNextChannel={() => handleNextChannel()}
                djStats={djStats}
                channelName={currentChannel?.name}
                channelImage={currentChannel?.imagen_url || currentChannel?.imageUrl}
                isPlayingScheduledContent={isPlayingScheduledContent}
              />

              <VolumeControl
                side="left"
                icon={Music}
                value={musicVolume}
                disabled={isManualPlaybackActive}
                onChange={(e) => {
                  const newVolume = parseInt(e.target.value);
                  setMusicVolume(newVolume);
                  // Convertir de 0-100 a 0-1 para audioPlayer (lazy import)
                  import('./services/audioPlayerService').then(({ default: audioPlayer }) => {
                    audioPlayer.setMusicVolume(newVolume / 100);
                    logger.dev('🎵 Volumen música ajustado a:', newVolume);
                  });
                }}
              />
              <VolumeControl
                side="right"
                icon={Mic}
                value={contentVolume}
                onChange={(e) => {
                  const newVolume = parseInt(e.target.value);
                  setContentVolume(newVolume);
                  // Convertir de 0-100 a 0-1 para audioPlayer (lazy import)
                  import('./services/audioPlayerService').then(({ default: audioPlayer }) => {
                    audioPlayer.setContentVolume(newVolume / 100);
                    logger.dev('🎤 Volumen contenido ajustado a:', newVolume);
                  });
                }}
              />

              {/* Ajuste de separación entre sliders en pantallas grandes */}
              <style>{`
                .volume-left { left: 3.5rem; }
                .volume-right { right: 3.5rem; }
                
                @media (min-width: 1280px) {
                  .volume-left { left: 20% !important; }
                  .volume-right { right: 20% !important; }
                }
                @media (min-width: 1536px) {
                  .volume-left { left: 23% !important; }
                  .volume-right { right: 23% !important; }
                }
              `}</style>

              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                {/* Botón reactivo con ondas y anillo visualizador de audio */}
                <ReactivePlayButton
                  isPlaying={optimisticPlayState === 'playing' || (optimisticPlayState === null && (djState?.isPlaying || wasPlayingBeforeChange))}
                  onPlayPause={handlePlayPause}
                  disabled={!djIsReady || isManualPlaybackActive}
                  bpm={djState?.currentSong?.bpm}
                  audioElement={audioElement}
                  currentTrack={djState?.currentSong?.title || djState?.currentSong?.id}
                  blockMessage={isManualPlaybackActive ? `${t('player.manualPlayback')}: ${manualPlaybackInfo?.contentName || t('player.content')}` : undefined}
                  isManualPlaybackActive={isManualPlaybackActive}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer translúcido para evitar superposición (solo con usuario autenticado, fuera de admin y fuera de dashboards web) */}
        {user && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute && (
          <footer className="fixed bottom-0 left-0 right-0 w-full h-32 z-40 pointer-events-none
            bg-gradient-to-t from-background/80 via-background/40 to-transparent backdrop-blur-sm">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
              <p className="text-xs text-muted-foreground/70 text-center">
                {t('footer.version')} {appVersion ? `v${appVersion}` : 'Web'}
              </p>
            </div>
          </footer>
        )}

        {/* Navegación inferior (responsiva): versión móvil y versión escritorio - Solo en desktop, fuera de admin y dashboards web */}
        {user && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute && (
        <>
          {/* Móvil: barra flotante original (idéntica a navegador) */}
          <div 
            className="sm:hidden fixed left-1/2 -translate-x-1/2 z-50 bottom-16"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-5 px-3 py-2 rounded-2xl backdrop-blur-lg bg-black/10 dark:bg-white/10 shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              {getNavItemsForRole(hasPermission, t, userRole, ROLES, isWeb).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`flex items-center justify-center rounded-xl transition-transform duration-150 ${currentPath === item.path ? 'text-primary scale-110' : 'text-foreground/80 hover:text-primary hover:scale-105'}`}
                  style={{ width: '40px', height: '40px' }}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Escritorio: botones flotantes como antes */}
          <div className="hidden sm:flex fixed bottom-20 left-1/2 -translate-x-1/2 justify-center gap-12 z-50">
            <AnimatePresence>
              {getNavItemsForRole(hasPermission, t, userRole, ROLES, isWeb).map((item, index) => (
                <motion.div 
                  key={item.path} 
                  className="group relative animate-float"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.5,
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 100
                  }}
                >
                  <Link
                    to={item.path}
                    className={`flex flex-col items-center justify-center rounded-2xl transition-all duration-300 backdrop-blur-lg overflow-hidden p-3
                      ${currentPath === item.path 
                        ? 'bg-black/5 dark:bg-white/5 text-black dark:text-white shadow-[0_0_35px_rgba(162,217,247,0.5)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] scale-110' 
                        : 'bg-black/3 dark:bg-white/3 text-black/90 dark:text-white/90 hover:bg-black/5 dark:hover:bg-white/5 hover:scale-105'}`}
                    style={{
                      minHeight: '64px',
                      minWidth: '72px',
                    }}
                  >
                    <motion.div
                      className="flex flex-col items-center justify-center gap-1 w-full"
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <item.icon className="w-6 h-6 flex-shrink-0" />
                      <span className="text-xs font-medium text-center leading-tight">
                        {item.label}
                      </span>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

// Componente principal con providers
const App = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppContent />
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;