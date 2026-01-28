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
import ContentsPage from '@/pages/ContentsPage';
import NewAdPage from '@/pages/NewAdPage';
import AdHistoryPage from '@/pages/AdHistoryPage';
import AccountPage from '@/pages/AccountPage';
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
// Tema oscuro único - ThemeToggle eliminado
// Componentes de desktop eliminados
import { useRole } from '@/hooks/useRole';
import { PermissionGated } from '@/components/RoleProtectedRoute';
import ReactivePlayButton from '@/components/player/ReactivePlayButton';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { channelsApi } from '@/lib/api';
import SplashScreen from '@/components/SplashScreen';
import { supabase } from '@/lib/supabase';
import { useAutoDj } from './hooks/useAutodjHook';
import autoDj from './services/autoDjService';
import scheduledContentService from '@/services/scheduledContentService';
import logger from '@/lib/logger';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileLayout from '@/layouts/MobileLayout';
import BottomNavigation from '@/components/mobile/BottomNavigation';

// Detectar si estamos en web o en Capacitor nativo
export const getIsWebPlatform = () => {
  // En Capacitor nativo (iOS/Android), esto devuelve false
  // En web browser, esto devuelve true
  return !(window.Capacitor?.isNativePlatform?.());
};
export const isWebPlatform = getIsWebPlatform();

// Función para obtener elementos de navegación
const getNavItemsForRole = (hasPermission, t) => {
  return [
    { path: '/', label: t('nav.player'), icon: HomeIcon, permission: 'canAccessPlayer' },
    { path: '/canales', label: t('nav.channels'), icon: Radio, permission: 'canAccessChannels' },
    { path: '/contenidos', label: t('nav.contents', 'Contenidos'), icon: BookOpen, permission: 'canAccessHistory' },
    { path: '/historial-anuncios', label: t('nav.history'), icon: HistoryIcon, permission: 'canAccessHistory' },
    { path: '/anuncio-nuevo', label: t('nav.createAd'), icon: PlusCircle, permission: 'canCreateImmediateAds' },
  ].filter(item => !item.permission || hasPermission(item.permission));
};

// Componente PlayerControls mejorado - Diseño moderno móvil
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
  const { isManualPlaybackActive, manualPlaybackInfo } = useAuth();
  const isBlocked = isPlayingScheduledContent || isManualPlaybackActive;
  const blockMessage = isManualPlaybackActive 
    ? `${t('player.manualPlayback')}: ${manualPlaybackInfo?.contentName || t('player.content')}`
    : isPlayingScheduledContent ? t('player.scheduledContentPlaying') : undefined;
  
  const displayTitle = (isPlayingScheduledContent || isManualPlaybackActive) ? t('player.content') : currentTrackInfo.title;
  const displayArtist = (isPlayingScheduledContent || isManualPlaybackActive) ? t('player.content') : currentTrackInfo.artist;

  const titleRef = React.useRef(null);
  const artistRef = React.useRef(null);
  const [titleNeedsScroll, setTitleNeedsScroll] = React.useState(false);
  const [artistNeedsScroll, setArtistNeedsScroll] = React.useState(false);

  React.useEffect(() => {
    const checkOverflow = () => {
      if (titleRef.current) {
        const element = titleRef.current;
        const parent = element.parentElement;
        const originalDisplay = element.style.display;
        element.style.display = 'inline-block';
        element.style.width = 'auto';
        const textWidth = element.scrollWidth;
        const containerWidth = parent?.clientWidth || 0;
        const needsScroll = textWidth > containerWidth - 32;
        element.style.display = originalDisplay;
        setTitleNeedsScroll(needsScroll);
        logger.dev(`🎨 Título necesita scroll: ${needsScroll} (texto: ${textWidth}px, contenedor: ${containerWidth - 32}px)`);
      }
      
      if (artistRef.current) {
        const element = artistRef.current;
        const parent = element.parentElement;
        const originalDisplay = element.style.display;
        element.style.display = 'inline-block';
        element.style.width = 'auto';
        const textWidth = element.scrollWidth;
        const containerWidth = parent?.clientWidth || 0;
        const needsScroll = textWidth > containerWidth - 32;
        element.style.display = originalDisplay;
        setArtistNeedsScroll(needsScroll);
        logger.dev(`🎨 Artista necesita scroll: ${needsScroll} (texto: ${textWidth}px, contenedor: ${containerWidth - 32}px)`);
      }
    };
    const timeoutId = setTimeout(checkOverflow, 100);
    return () => clearTimeout(timeoutId);
  }, [displayTitle, displayArtist]);

  return (
    <>
      {/* Contenedor principal - posición adaptativa móvil/desktop */}
      <div className="fixed left-1/2 top-[18%] md:top-[20%] -translate-x-1/2 z-30 flex flex-col items-center gap-4 md:gap-4 w-full max-w-md px-6">
        
        {/* Selector de canal - Diseño card moderno */}
        <motion.div 
          className="w-full"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative flex items-center justify-center gap-3">
            {/* Botón anterior */}
            <motion.button
              onClick={onPrevChannel}
              whileTap={isBlocked ? {} : { scale: 0.9 }}
              disabled={isBlocked}
              title={blockMessage || t('player.previousChannel')}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center 
                        bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl
                        active:bg-white/[0.12] transition-all duration-200
                        ${isBlocked ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <ChevronLeft className="w-6 h-6 text-white/70" />
            </motion.button>

            {/* Card del canal */}
            <motion.div 
              className="flex-1 max-w-[200px] flex items-center gap-3 px-4 py-3 rounded-2xl 
                        bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              {/* Avatar del canal */}
              <div className="relative flex-shrink-0">
                {channelImage ? (
                  <img 
                    src={channelImage} 
                    alt={channelName}
                    className="w-10 h-10 rounded-xl object-cover ring-2 ring-[#A2D9F7]/30"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A2D9F7]/30 to-[#A2D9F7]/10 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-[#A2D9F7]/70" />
                  </div>
                )}
                {/* Indicador de reproducción */}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0e14]" />
              </div>
              
              {/* Info del canal */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#A2D9F7]/70 font-medium uppercase tracking-wider">Canal</p>
                <p className="text-sm text-white font-medium truncate">
                  {channelName || t('player.loading')}
                </p>
              </div>
            </motion.div>

            {/* Botón siguiente */}
            <motion.button
              onClick={onNextChannel}
              whileTap={isBlocked ? {} : { scale: 0.9 }}
              disabled={isBlocked}
              title={blockMessage || t('player.nextChannel')}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center 
                        bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl
                        active:bg-white/[0.12] transition-all duration-200
                        ${isBlocked ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <ChevronRight className="w-6 h-6 text-white/70" />
            </motion.button>
          </div>
        </motion.div>

        {/* Información de la canción - Tipografía elegante */}
        <div className="w-full text-center mt-2">
          {/* Título */}
          <div className="overflow-hidden w-full">
            {titleNeedsScroll ? (
              <div className="flex animate-marquee-slow hover:animation-paused">
                <motion.h1 
                  ref={titleRef}
                  key={`title-${displayTitle}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-2xl md:text-2xl font-semibold text-white whitespace-nowrap pr-12"
                >
                  {displayTitle}
                </motion.h1>
                <motion.h1 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-2xl md:text-2xl font-semibold text-white whitespace-nowrap pr-12"
                >
                  {displayTitle}
                </motion.h1>
              </div>
            ) : (
              <motion.h1 
                ref={titleRef}
                key={`title-${displayTitle}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl md:text-2xl font-semibold text-white truncate"
              >
                {displayTitle}
              </motion.h1>
            )}
          </div>
          
          {/* Artista */}
          <div className="overflow-hidden w-full mt-1">
            {artistNeedsScroll ? (
              <div className="flex animate-marquee-slow hover:animation-paused">
                <motion.h2 
                  ref={artistRef}
                  key={`artist-${displayArtist}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-base text-white/50 font-light whitespace-nowrap pr-12"
                >
                  {displayArtist}
                </motion.h2>
                <motion.h2 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-base text-white/50 font-light whitespace-nowrap pr-12"
                >
                  {displayArtist}
                </motion.h2>
              </div>
            ) : (
              <motion.h2 
                ref={artistRef}
                key={`artist-${displayArtist}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-base text-white/50 font-light truncate"
              >
                {displayArtist}
              </motion.h2>
            )}
          </div>
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
      {/* Escritorio: sliders verticales con burbuja y mute - Oculto en móvil */}
      <div className={`hidden md:flex fixed top-1/2 -translate-y-1/2 flex-col items-center gap-2 p-4 z-30 ${side === 'left' ? 'volume-left' : 'volume-right'}`}>
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
    </>
  );
};

// Componente interno que usa useLocation
function AppContent() {
  const location = useLocation();
  
  // 🎬 Estado del splash screen
  const [showSplash, setShowSplash] = useState(true);
  
  // 📜 Ref para el contenedor principal de scroll
  const scrollContainerRef = useRef(null);
  
  // 📱 Detectar dispositivo móvil
  const { isMobile, isTablet, isTouchDevice } = useIsMobile();
  
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
  
  // 📜 Resetear scroll al navegar entre páginas
  React.useEffect(() => {
    // Usar el ref directamente - más confiable que querySelector
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    // Resetear el scroll del window y document
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentPath]);
  
  // 🔧 Usar currentPath (normalizado) para todas las comparaciones de rutas
  const isAuthRoute = currentPath === '/login' ||
                       currentPath.startsWith('/registro') ||
                       currentPath === '/descarga' ||
                       currentPath === '/solo-desktop';
  
  // 🌐 Rutas especiales en web que tienen su propia UI (no usan header/nav del reproductor)
  const isWebDashboardRoute = currentPath.startsWith('/gestor') || currentPath.startsWith('/admin');
  const { t } = useTranslation();
  
  const theme = 'dark'; // Tema oscuro único
  const { user, loading: authLoading, userChannels, channelsLoading, signOut, ensureChannelsLoaded, loadUserActiveChannels, isManualPlaybackActive, manualPlaybackInfo, registroCompleto } = useAuth();
  const { roleName, hasPermission, uiConfig, userRole } = useRole();
  const navigate = useNavigate();
  
  // 🔐 SEGURIDAD: Usuario completamente autenticado = tiene user + registro completo
  // Solo usuarios con isFullyAuthenticated pueden acceder al Player Dashboard
  const isFullyAuthenticated = user && registroCompleto === true;
  
  // Solo usuarios completamente autenticados pueden usar el reproductor
  const shouldEnablePlayer = isFullyAuthenticated;

  // 🔑 CRÍTICO: Redirigir a registro si el usuario no completó el onboarding
  React.useEffect(() => {
    // Solo aplicar si:
    // 1. Hay usuario autenticado
    // 2. No estamos cargando
    // 3. registroCompleto es explícitamente false (no null/undefined)
    // 4. No estamos ya en la página de registro
    // 5. NO estamos en plataforma nativa (en nativo el flujo es diferente)
    const isRegistroRoute = currentPath.startsWith('/registro');
    const isLoginRoute = currentPath === '/login';
    const isAuthRouteLocal = isRegistroRoute || isLoginRoute || currentPath === '/descarga';
    
    // Detectar si es plataforma nativa (Capacitor)
    const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
    
    // 🔑 En apps nativas, NO redirigir automáticamente - AuthContext maneja el flujo
    if (user && !authLoading && registroCompleto === false && !isAuthRouteLocal && !isNative) {
      console.log('🔄 [Registro] Usuario sin registro completo, redirigiendo a /registro');
      navigate('/registro?continue=true');
    }
  }, [user, authLoading, registroCompleto, currentPath, navigate]);

  // 🔑 FALLBACK: Si registroCompleto es explícitamente FALSE después de un timeout, redirigir a registro
  // Esto evita que el usuario se quede atascado en "Verificando cuenta..."
  // También actúa como red de seguridad si el redirect normal falla
  // ⚠️ IMPORTANTE: NO aplicar si registroCompleto es null (aún cargando)
  // Solo aplicar si es explícitamente false (ya verificado y sin registro)
  React.useEffect(() => {
    const isRegistroRoute = currentPath.startsWith('/registro');
    const isLoginRoute = currentPath === '/login';
    const isAuthRouteLocal = isRegistroRoute || isLoginRoute || currentPath === '/descarga';
    
    // Detectar si es plataforma nativa (Capacitor)
    const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
    
    // 🔑 CRÍTICO: Solo aplicar fallback si:
    // 1. Hay usuario
    // 2. No estamos en ruta de auth
    // 3. registroCompleto es EXPLÍCITAMENTE false (no null)
    // 4. No estamos cargando
    // 5. Es entorno web (no nativo - en nativo AuthContext maneja todo)
    if (user && !isAuthRouteLocal && registroCompleto === false && !authLoading && isWeb && !isNative) {
      console.log('⏳ [Fallback] registroCompleto=false (verificado), iniciando timeout de seguridad (3s)...');
      
      const timeoutId = setTimeout(() => {
        // Después de 3 segundos, si aún no es true, redirigir a registro
        console.log('⚠️ [Fallback] Timeout alcanzado - registroCompleto:', registroCompleto, '- redirigiendo a /registro');
        navigate('/registro?continue=true');
      }, 3000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, registroCompleto, authLoading, currentPath, navigate, isWeb]);

  // 🔑 NOTA: La verificación de suscripción para gestores en Electron se hace en AuthContext
  // Si el gestor no tiene suscripción activa, AuthContext NO establece la sesión y abre el dashboard web
  
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

  // 📱 UNIVERSAL LINKS & DEEP LINKING: Capturar tokens de verificación de email
  // Soporta tanto Universal Links (https://app.ondeon.es) como custom schemes (ondeon-smart://)
  useEffect(() => {
    const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
    if (!isNative) return;

    let appUrlOpenListener = null;

    const setupDeepLinkListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        
        // Listener para cuando la app se abre via Universal Link o custom scheme
        appUrlOpenListener = await App.addListener('appUrlOpen', async ({ url }) => {
          logger.dev('📱 [Universal Link] App abierta con URL:', url);
          
          // Verificar si es un link de verificación de email con tokens
          // Supabase envía los tokens en hash (#) o query (?)
          if (url.includes('access_token') || url.includes('type=signup') || url.includes('type=email')) {
            logger.dev('🔐 [Universal Link] Detectados tokens de verificación');
            
            try {
              const urlObj = new URL(url);
              let hashParams = null;
              
              // Supabase puede enviar tokens en hash (#) o query (?)
              if (urlObj.hash) {
                hashParams = new URLSearchParams(urlObj.hash.substring(1));
              } else if (urlObj.search) {
                hashParams = new URLSearchParams(urlObj.search.substring(1));
              }
              
              if (hashParams) {
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                
                if (accessToken) {
                  logger.dev('🔐 [Universal Link] Procesando tokens de sesión...');
                  
                  const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || ''
                  });
                  
                  if (error) {
                    logger.error('❌ [Universal Link] Error estableciendo sesión:', error);
                  } else {
                    logger.dev('✅ [Universal Link] Sesión establecida:', data.user?.email);
                    navigate('/registro?continue=true&verified=true');
                  }
                }
              }
            } catch (parseError) {
              logger.error('❌ [Universal Link] Error parseando URL:', parseError);
            }
          } 
          // Universal Links: https://app.ondeon.es/registro
          else if (url.includes('app.ondeon.es/registro')) {
            logger.dev('📱 [Universal Link] Navegando a registro');
            navigate('/registro?continue=true');
          }
          else if (url.includes('app.ondeon.es/login')) {
            logger.dev('📱 [Universal Link] Navegando a login');
            navigate('/login');
          }
          // Fallback: custom scheme ondeon-smart://
          else if (url.includes('ondeon-smart://registro')) {
            logger.dev('📱 [Deep Link] Navegando a registro (custom scheme)');
            navigate('/registro?continue=true');
          }
          else if (url.includes('ondeon-smart://login')) {
            logger.dev('📱 [Deep Link] Navegando a login (custom scheme)');
            navigate('/login');
          }
        });
        
        logger.dev('✅ [Universal Link] Listener de appUrlOpen configurado');
        
        // Verificar si la app fue lanzada con un Universal Link
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          logger.dev('🚀 [Universal Link] App lanzada con URL:', launchUrl.url);
          // Disparar el evento manualmente para procesar la URL de lanzamiento
          if (launchUrl.url.includes('app.ondeon.es') || launchUrl.url.includes('ondeon-smart://')) {
            // El callback de appUrlOpen se llamará automáticamente
          }
        }
      } catch (e) {
        logger.warn('⚠️ [Universal Link] No se pudo configurar listener:', e);
      }
    };

    setupDeepLinkListener();

    return () => {
      if (appUrlOpenListener) {
        appUrlOpenListener.remove();
      }
    };
  }, [navigate]);

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

  // Ref para evitar múltiples cargas de canales
  const channelsLoadAttemptedRef = React.useRef(false);
  
  // Cargar canales bajo demanda desde cualquier ruta - SOLO si el reproductor está habilitado
  useEffect(() => {
    if (!shouldEnablePlayer) return;
    
    // Solo intentar cargar una vez - evitar loop infinito
    if (channelsLoadAttemptedRef.current) return;
    
    // Cargar canales si no hay suscripción Realtime activa, no hay canales, y no estamos cargando
    if (!window.channelsRealtimeActive && userChannels.length === 0 && !channelsLoading) {
      channelsLoadAttemptedRef.current = true;
      logger.dev('🔄 App.jsx - Cargando canales del usuario');
      ensureChannelsLoaded();
    }
  }, [shouldEnablePlayer, userChannels.length, channelsLoading]);
  
  // Resetear el flag cuando el usuario cambia
  useEffect(() => {
    channelsLoadAttemptedRef.current = false;
  }, [user?.id]);


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
        withTimeout(autoDj?.stop?.(), 1000),
        audioPlayer?.stop?.(),
        audioPlayer?.reset?.(),
        autoDj?.reset?.()
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

  // 🔐 SEGURIDAD: Mostrar loading mientras verificamos el estado del usuario
  // Esto PREVIENE el flash del dashboard antes de la redirección
  // Se muestra cuando:
  // 1. Hay usuario autenticado
  // 2. registroCompleto aún es null/undefined (cargando) o es false
  // 3. No estamos en ruta de autenticación (login/registro)
  // ⚠️ IMPORTANTE: Aplica a TODAS las plataformas (web + nativo)
  if (user && registroCompleto !== true && !isAuthRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e14]">
        <div className="text-center space-y-6">
          {/* Logo */}
          <div className="relative mb-8">
            <div className="absolute inset-0 blur-2xl bg-[#A2D9F7]/20 rounded-full scale-150 animate-pulse" />
            <img
              src="/assets/icono-ondeon.png"
              alt="Ondeon"
              className="relative w-20 h-20 mx-auto drop-shadow-2xl animate-[float_3s_ease-in-out_infinite]"
            />
          </div>
          
          {/* Spinner moderno */}
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-[#A2D9F7]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-[#A2D9F7] rounded-full animate-spin"></div>
          </div>
          
          {/* Texto con animación */}
          <div className="space-y-2">
            <p className="text-white text-base font-medium">Verificando cuenta</p>
            <p className="text-white/40 text-sm animate-pulse">Esto solo tomará unos segundos...</p>
          </div>
          
          {/* Barra de progreso animada */}
          <div className="w-64 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#A2D9F7] to-[#7AB8E0] rounded-full animate-[progress_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </div>
    );
  }

  // Determinar si mostrar UI móvil
  const showMobileUI = isMobile || isTablet;
  // 🔐 Solo mostrar header/navegación para usuarios COMPLETAMENTE autenticados
  const showHeader = isFullyAuthenticated && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute;
  const showNavigation = isFullyAuthenticated && !isAuthRoute && !isAdminRoute;

  return (
    <div className={`relative min-h-screen text-foreground flex flex-col bg-background font-sans`}>
      {/* 🎬 Splash Screen */}
      {showSplash && (
        <SplashScreen 
          minDuration={2500} 
          onFinish={() => setShowSplash(false)} 
        />
      )}
      
      {/* 🖥️ Background dinámico en rutas del reproductor (desktop y móvil) */}
      {isFullyAuthenticated && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute && currentPath === '/' && (
        <DynamicBackground 
          isPlaying={djState?.isPlaying || false} 
          theme={theme}
        />
      )}
      <div className="relative z-10 flex flex-col flex-1">
        {/* 📱 Header - Versión móvil moderna */}
        {showHeader && showMobileUI && (
          <header className="fixed top-0 left-0 right-0 z-[60] safe-area-top">
            {/* Fondo transparente con blur sutil */}
            <div className="absolute inset-0 bg-transparent backdrop-blur-md" />
            
            <div className="relative flex items-center justify-between h-16 px-4">
              {/* Logo grande + Smart */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#A2D9F7]/25 rounded-full blur-2xl scale-150" />
                  <img
                    src="/assets/icono-ondeon.png"
                    alt="Ondeón Smart"
                    className="relative h-14 w-14 drop-shadow-[0_0_15px_rgba(162,217,247,0.4)]"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <span className="text-lg tracking-[0.2em] font-light text-[#A2D9F7]">SMART</span>
              </div>
              
              {/* Nombre establecimiento con acceso a cuenta */}
              <Link 
                to="/cuenta"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.12] transition-all duration-200 active:scale-95"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-sm text-white/90 font-medium">
                  {user?.user_metadata?.establecimiento || user?.establecimiento || user?.user_metadata?.username || user?.username || user?.nombre_usuario || user?.email?.split('@')[0] || t('common.user')}
                </span>
                <ChevronRight size={16} className="text-white/40" />
              </Link>
            </div>
          </header>
        )}

        {/* 🖥️ Header - Versión desktop */}
        {showHeader && !showMobileUI && (
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
                <span className="text-2xl tracking-[0.2em] font-light text-[#A2D9F7] font-sans">SMART</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 px-2 py-1 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-md border border-white/10 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)] ml-auto">
                <span className="text-sm text-[#A2D9F7] flex items-center gap-2 px-2">
                  {user?.user_metadata?.establecimiento || user?.establecimiento || user?.user_metadata?.username || user?.username || user?.nombre_usuario || user?.email || t('common.user')}
                  <Circle size={8} className="fill-green-500 text-green-500" />
                </span>
                
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
                
                {/* Acceso a Mi Cuenta / Dashboard */}
                <Link to="/gestor" title={t('nav.myAccount', 'Mi cuenta')}>
                  <Button variant="ghost" size="icon" className="text-foreground/60 hover:text-[#A2D9F7]">
                    <User size={20} />
                  </Button>
                </Link>
                
                <Button variant="ghost" size="icon" className="text-foreground/60 hover:text-[#A2D9F7]" onClick={handleLogout} title={t('nav.logout')}>
                  <LogOut size={20} />
                </Button>
              </div>
            </div>
          </header>
        )}

        <div 
          ref={scrollContainerRef}
          data-scroll-container
          className={`flex-1 relative overflow-y-auto overflow-x-hidden ${(isAuthRoute || !isFullyAuthenticated || isAdminRoute || isWebDashboardRoute) ? '' : showMobileUI ? '' : 'pt-28'} ${showMobileUI && showNavigation ? 'pb-28' : ''}`} 
          style={{ 
            overscrollBehavior: 'none',
            paddingTop: (isAuthRoute || !isFullyAuthenticated || isAdminRoute || isWebDashboardRoute) ? 0 : showMobileUI ? 'calc(env(safe-area-inset-top, 0px) + 56px)' : undefined
          }}
        >
          <main className={`${(isAuthRoute || !isFullyAuthenticated || isAdminRoute || isWebDashboardRoute) 
            ? 'w-full mx-0 px-0 py-0 pb-0 max-w-none' 
            : showMobileUI 
              ? 'w-full px-0 py-0' 
              : 'w-full max-w-5xl mx-auto px-16 sm:px-20 md:px-24 py-6 pb-32'}`}>
            <PlayerProvider value={{ isPlaying: djState?.isPlaying || false, currentChannel: currentChannel || djState?.currentChannel, currentSong: djState?.currentSong }}>
            <Routes>
              {isFullyAuthenticated ? (
                <>
                  {/* 🔐 Rutas PROTEGIDAS - Solo para usuarios con registro completo */}
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
                  <Route path="/contenidos" element={<ContentsPage />} />
                  <Route path="/anuncio-nuevo" element={<NewAdPage />} />
                  <Route path="/historial-anuncios" element={<AdHistoryPage />} />
                  <Route path="/cuenta" element={<AccountPage />} />
                  <Route path="/gestor" element={<GestorDashboard />} />
                  <Route path="/registro" element={<RegisterPage />} />
                  
                  {/* Redirigir /login a home si ya está completamente autenticado */}
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              ) : user ? (
                <>
                  {/* 🔄 Usuario autenticado pero SIN registro completo - solo acceso a registro */}
                  <Route path="/registro" element={<RegisterPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  {/* Cualquier otra ruta redirige a registro */}
                  <Route path="*" element={<Navigate to="/registro?continue=true" replace />} />
                </>
              ) : (
                <>
                  {/* 🔓 Rutas públicas - usuarios no autenticados */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/registro" element={<RegisterPage />} />
                  <Route path="*" element={<LoginPage />} />
                </>
              )}
            </Routes>
            </PlayerProvider>
          </main>

          {/* Elementos del reproductor solo en la página principal Y con usuario COMPLETAMENTE autenticado Y fuera de admin */}
          {currentPath === '/' && isFullyAuthenticated && !channelsLoading && !isAuthRoute && !isAdminRoute && (
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

        {/* Footer translúcido para evitar superposición (solo con usuario COMPLETAMENTE autenticado, fuera de admin y fuera de dashboards web) */}
        {isFullyAuthenticated && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute && (
          <footer className="fixed bottom-0 left-0 right-0 w-full h-32 z-40 pointer-events-none
            bg-gradient-to-t from-background/80 via-background/40 to-transparent backdrop-blur-sm">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
              <p className="text-xs text-muted-foreground/70 text-center">
                {t('footer.version')} {appVersion ? `v${appVersion}` : 'Web'}
              </p>
            </div>
          </footer>
        )}

        {/* 📱 Navegación inferior MÓVIL - Nuevo diseño tipo app */}
        {showNavigation && showMobileUI && (
          <BottomNavigation />
        )}

        {/* 🖥️ Navegación inferior DESKTOP - Botones flotantes */}
        {isFullyAuthenticated && !isAuthRoute && !isAdminRoute && !isWebDashboardRoute && !showMobileUI && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex justify-center gap-12 z-50">
            <AnimatePresence>
              {getNavItemsForRole(hasPermission, t).map((item, index) => (
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