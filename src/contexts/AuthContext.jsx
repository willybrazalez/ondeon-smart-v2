import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { initApi, channelsApi, presenceApi, authApi } from '@/lib/api'
import scheduledContentService from '@/services/scheduledContentService'
import logger from '@/lib/logger'

// ============================================================================
// CAPACITOR DEEP LINK HANDLER - Para OAuth callback
// ============================================================================
// Flag para evitar procesar múltiples veces la misma URL
let processedLaunchUrl = false;
let processedHashUrl = false;

// 🔑 Función para procesar OAuth tokens desde cualquier URL
const processOAuthUrl = async (url, handleOAuthCallback, closeBrowser = true) => {
  if (!url) return false;
  
  // Verificar si es un callback de OAuth
  if (url.includes('access_token=') || url.includes('error=') || url.includes('code=')) {
    logger.dev('🔐 [OAuth] Procesando URL con tokens:', url.substring(0, 50) + '...');
    
    // Cerrar el browser in-app si está abierto
    if (closeBrowser) {
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
        logger.dev('🔐 [OAuth] Browser cerrado');
      } catch (e) {
        // Ignorar si no hay browser abierto
      }
    }
    
    // Procesar el callback
    await handleOAuthCallback(url);
    return true;
  }
  return false;
};

const setupDeepLinkHandler = async (handleOAuthCallback) => {
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
  logger.dev('🔧 [DeepLink] Configurando handler - isNative:', isNative);
  
  if (isNative) {
    try {
      const { App } = await import('@capacitor/app');
      
      // 🔑 CRÍTICO: Verificar si la app fue abierta con un deep link (launch URL)
      if (!processedLaunchUrl) {
        processedLaunchUrl = true;
        try {
          const launchUrl = await App.getLaunchUrl();
          logger.dev('🚀 [DeepLink] Launch URL resultado:', launchUrl);
          
          if (launchUrl?.url) {
            const processed = await processOAuthUrl(launchUrl.url, handleOAuthCallback);
            if (processed) {
              logger.dev('✅ [DeepLink] Launch URL procesada como OAuth');
              return;
            }
          }
        } catch (e) {
          logger.warn('⚠️ [DeepLink] Error obteniendo launch URL:', e);
        }
      }
      
      // Escuchar deep links futuros (OAuth callback)
      App.addListener('appUrlOpen', async ({ url }) => {
        logger.dev('🔗 [DeepLink] appUrlOpen evento recibido:', url);
        await processOAuthUrl(url, handleOAuthCallback);
      });
      
      logger.dev('✅ [DeepLink] Handler configurado para plataforma nativa');
    } catch (e) {
      logger.warn('⚠️ [DeepLink] No se pudo configurar handler:', e);
    }
  }
  
  // 🔑 FALLBACK: Verificar si hay tokens en el hash de la URL actual
  // Esto funciona tanto en web como en nativo si Capacitor pasa los tokens via hash
  if (!processedHashUrl && typeof window !== 'undefined') {
    processedHashUrl = true;
    const currentUrl = window.location.href;
    const hash = window.location.hash;
    
    if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
      logger.dev('🔐 [DeepLink] Tokens detectados en URL hash actual');
      await processOAuthUrl(currentUrl, handleOAuthCallback, false);
      
      // Limpiar el hash de la URL para evitar reprocesamiento
      if (window.history?.replaceState) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
        logger.dev('🧹 [DeepLink] Hash limpiado de URL');
      }
    }
  }
};

// ============================================================================
// ONDEON SMART v2 - AUTH CONTEXT
// ============================================================================
// Sistema de autenticación simplificado usando solo Supabase Auth.
// Los datos del usuario se obtienen via rpc_get_user_init.
// ============================================================================

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  // Estados principales
  const [user, setUser] = useState(null)                    // Usuario de Supabase Auth
  const [userData, setUserData] = useState(null)            // Datos de tabla usuarios (via rpc_get_user_init)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Canales
  const [userChannels, setUserChannels] = useState([])      // Todos los canales disponibles
  const [recommendedChannels, setRecommendedChannels] = useState([]) // Canales recomendados por sector
  const [channelsLoading, setChannelsLoading] = useState(false)
  
  // Programaciones activas (propias + sector)
  const [activeProgramaciones, setActiveProgramaciones] = useState([])
  
  // Estado de registro
  const [registroCompleto, setRegistroCompleto] = useState(null) // null=no verificado, true/false
  const [userRole, setUserRole] = useState(null)             // 'admin' | 'user'
  const [emailConfirmed, setEmailConfirmed] = useState(null)  // null=no verificado, true/false
  
  // Reproducción manual (bloquea controles)
  const [isManualPlaybackActive, setIsManualPlaybackActive] = useState(false)
  const [manualPlaybackInfo, setManualPlaybackInfo] = useState(null)
  const manualPlaybackTimeoutRef = useRef(null)
  
  // Refs para evitar múltiples cargas
  const initLoadedRef = useRef(false)
  const lastAuthUserIdRef = useRef(null)

  // ============================================================================
  // OAUTH CALLBACK HANDLER (para deep links en apps nativas)
  // ============================================================================
  
  const handleOAuthCallback = useCallback(async (url) => {
    try {
      logger.dev('🔐 [OAuth] Procesando callback:', url?.substring(0, 100));
      
      if (!url) {
        logger.warn('⚠️ [OAuth] URL vacía');
        return;
      }
      
      // Extraer tokens del URL - manejar múltiples formatos
      let params;
      
      // Formato 1: ondeon-smart://login#access_token=...
      // Formato 2: https://app.com/callback#access_token=...
      // Formato 3: capacitor://localhost/#access_token=...
      
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const hashPart = url.substring(hashIndex + 1);
        params = new URLSearchParams(hashPart);
        logger.dev('🔐 [OAuth] Tokens extraídos del hash');
      } else {
        // Intentar como query params
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          const queryPart = url.substring(queryIndex + 1);
          params = new URLSearchParams(queryPart);
          logger.dev('🔐 [OAuth] Tokens extraídos de query params');
        } else {
          logger.warn('⚠️ [OAuth] No se encontraron tokens en la URL');
          return;
        }
      }
      
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      
      if (error) {
        logger.error('❌ Error en OAuth:', error, errorDescription);
        throw new Error(errorDescription || error);
      }
      
      if (accessToken && refreshToken) {
        logger.dev('✅ Tokens OAuth recibidos, estableciendo sesión...');
        
        // Establecer la sesión en Supabase
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (setSessionError) {
          throw setSessionError;
        }
        
        logger.dev('✅ Sesión OAuth establecida correctamente');
        // El onAuthStateChange listener se encargará del resto
      } else {
        logger.warn('⚠️ OAuth callback sin tokens válidos');
      }
    } catch (e) {
      logger.error('❌ Error procesando OAuth callback:', e);
    }
  }, []);

  // Configurar deep link handler al montar
  useEffect(() => {
    setupDeepLinkHandler(handleOAuthCallback);
  }, [handleOAuthCallback]);

  // ============================================================================
  // INICIALIZACIÓN
  // ============================================================================
  
  useEffect(() => {
    const getInitialSession = async () => {
      setLoading(true)

      // Verificar si estamos en proceso de logout
      const isLoggingOut = sessionStorage.getItem('ondeon_logging_out')
      if (isLoggingOut) {
        logger.dev('🚫 Proceso de logout detectado - no restaurar sesión')
        sessionStorage.removeItem('ondeon_logging_out')
        cleanupAllStorage()
        setLoading(false)
        return
      }

      // Verificar sesión de Supabase Auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        logger.dev('ℹ️ No hay usuario autenticado')
        await supabase.auth.signOut()
        resetAuthState()
        setLoading(false)
        return
      }

      // Obtener sesión para tokens
      const { data: { session: authSession } } = await supabase.auth.getSession()
      setSession(authSession)
      setUser(authUser)
      
      // Cargar datos completos del usuario
      await loadUserInitData()
      
      setLoading(false)
    }

    getInitialSession()

    // Listener de cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.dev('🔄 Auth state change:', event)
        
        if (event === 'SIGNED_OUT') {
          resetAuthState()
          return
        }
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session)
          setUser(session?.user ?? null)
          
          // Cargar datos si es un nuevo usuario
          if (session?.user?.id && session.user.id !== lastAuthUserIdRef.current) {
            await loadUserInitData()
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ============================================================================
  // CARGA DE DATOS DEL USUARIO
  // ============================================================================
  
  const loadUserInitData = async () => {
    // Flag para asegurar que siempre establecemos registroCompleto
    let registroCompletoSet = false
    
    try {
      logger.dev('🔄 Cargando datos iniciales del usuario...')
      
      // 🚀 OPTIMIZACIÓN: Verificación RÁPIDA con timeout de 5 segundos
      // Si Supabase tarda más de 5s (cold start), asumimos usuario sin registro
      const QUICK_TIMEOUT = 5000
      
      // Helper para crear timeout
      const withTimeout = (promise, ms, fallback) => {
        return Promise.race([
          promise,
          new Promise((resolve) => setTimeout(() => {
            logger.dev(`⏱️ Timeout de ${ms}ms alcanzado`)
            resolve(fallback)
          }, ms))
        ])
      }
      
      // Obtener usuario con timeout
      const userResult = await withTimeout(
        supabase.auth.getUser(),
        QUICK_TIMEOUT,
        { data: { user: null } }
      )
      
      const authUser = userResult?.data?.user
      if (!authUser) {
        logger.dev('ℹ️ No hay usuario autenticado o timeout')
        setRegistroCompleto(false)
        setEmailConfirmed(false)
        registroCompletoSet = true
        return
      }
      
      // 🔐 SEGURIDAD: Establecer estado de verificación de email
      const isEmailConfirmed = authUser.email_confirmed_at !== null
      setEmailConfirmed(isEmailConfirmed)
      logger.dev('📧 Email confirmado:', isEmailConfirmed)
      
      // Consulta directa RÁPIDA para verificar estado de registro (con timeout)
      const quickCheckResult = await withTimeout(
        supabase
          .from('usuarios')
          .select('id, registro_completo, rol')
          .eq('auth_user_id', authUser.id)
          .maybeSingle(),
        QUICK_TIMEOUT,
        { data: null, error: { message: 'Quick check timeout' } }
      )
      
      const { data: quickCheck, error: quickError } = quickCheckResult
      
      // Si timeout, error, no existe el usuario, o registro_completo es false -> redirigir YA
      if (quickError || !quickCheck || !quickCheck.registro_completo) {
        logger.dev('⚡ Verificación rápida: usuario sin registro completo, redirigiendo...')
        setRegistroCompleto(false)
        registroCompletoSet = true
        setUserRole(quickCheck?.rol || 'user')
        setUserData(quickCheck || null)
        return // 🔑 NO esperar al RPC lento, redirigir inmediatamente
      }
      
      logger.dev('✅ Usuario con registro completo, cargando datos completos...')
      
      // Solo si tiene registro completo, cargar datos completos via RPC
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: getUserInit tardó demasiado')), 30000)
      )
      
      const initData = await Promise.race([
        initApi.getUserInit(),
        timeoutPromise
      ])
      
      if (initData?.error) {
        // Usuario autenticado pero sin registro en tabla usuarios
        logger.dev('ℹ️ Usuario sin registro completo en BD:', initData.error)
        setRegistroCompleto(false)
        registroCompletoSet = true
        setUserRole('user')
        setUserData(null)
        return
      }
      
      // Guardar datos del usuario
      setUserData(initData.usuario)
      setUserRole(initData.usuario?.rol || 'user')
      
      // 🔑 CRÍTICO: Establecer registroCompleto basado en los datos
      const isRegistroCompleto = initData.usuario?.registro_completo === true
      setRegistroCompleto(isRegistroCompleto)
      registroCompletoSet = true
      logger.dev('📋 registroCompleto establecido a:', isRegistroCompleto)
      
      lastAuthUserIdRef.current = initData.usuario?.id
      
      // Guardar canales recomendados por sector
      setRecommendedChannels(initData.canales_recomendados || [])
      
      // Guardar programaciones activas
      setActiveProgramaciones(initData.programaciones_activas || [])
      
      logger.dev('✅ Datos iniciales cargados:', {
        usuario: initData.usuario?.email,
        rol: initData.usuario?.rol,
        registro_completo: initData.usuario?.registro_completo,
        canales_recomendados: initData.canales_recomendados?.length || 0,
        programaciones: initData.programaciones_activas?.length || 0
      })
      
      // Si el registro está completo, cargar canales e iniciar servicios
      if (initData.usuario?.registro_completo) {
        await loadAllChannels()
        await startPresenceService(initData.usuario.id)
        
        // Iniciar servicio de contenidos programados
        await scheduledContentService.iniciar(
          initData.usuario.id,
          initData.programaciones_activas || []
        )
      }
      
    } catch (error) {
      logger.error('❌ Error cargando datos iniciales:', error)
      
      // Cualquier error significa que el usuario no tiene registro completo
      // (puede ser USER_NOT_FOUND, RPC no existe, error de BD, timeout, etc.)
      setRegistroCompleto(false)
      registroCompletoSet = true
      setUserRole('user')
      setUserData(null)
      logger.dev('ℹ️ Usuario sin datos en BD - requiere completar registro')
    } finally {
      // 🔑 FALLBACK: Si por alguna razón registroCompleto no se estableció, hacerlo ahora
      if (!registroCompletoSet) {
        logger.warn('⚠️ registroCompleto no fue establecido, forzando a false')
        setRegistroCompleto(false)
      }
    }
  }

  // ============================================================================
  // CANALES
  // ============================================================================
  
  const loadAllChannels = async (forceRefresh = false) => {
    if (channelsLoading) return userChannels
    
    try {
      setChannelsLoading(true)
      logger.dev('🔄 Cargando todos los canales...')
      
      const canales = await channelsApi.getAllChannels(forceRefresh)
      setUserChannels(canales)
      
      logger.dev(`✅ ${canales.length} canales cargados`)
      
      // Seleccionar canal aleatorio si no hay uno activo
      if (canales.length > 0 && !window.currentPlayerChannelId) {
        const canalAleatorio = canales[Math.floor(Math.random() * canales.length)]
        logger.dev('🎲 Canal aleatorio seleccionado:', canalAleatorio.nombre)
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('canalAutoSeleccionado', {
            detail: { canal: canalAleatorio }
          }))
        }, 500)
      }
      
      return canales
    } catch (error) {
      logger.error('❌ Error cargando canales:', error)
      setUserChannels([])
      return []
    } finally {
      setChannelsLoading(false)
    }
  }

  const ensureChannelsLoaded = useCallback(async () => {
    if (channelsLoading) return userChannels
    if (userChannels.length > 0) return userChannels
    return await loadAllChannels()
  }, [channelsLoading, userChannels])

  // ============================================================================
  // PRESENCIA
  // ============================================================================
  
  const startPresenceService = async (usuarioId) => {
    if (!usuarioId) return
    
    try {
      const { getAppVersion } = await import('@/lib/appVersion')
      const appVersion = await getAppVersion()
      
      // Enviar heartbeat inicial
      await presenceApi.sendHeartbeat({
        playbackState: 'idle',
        appVersion
      })
      
      logger.dev('✅ Presencia iniciada')
    } catch (e) {
      logger.warn('⚠️ No se pudo iniciar presencia:', e)
    }
  }

  // ============================================================================
  // AUTENTICACIÓN
  // ============================================================================
  
  const signUp = async (email, password) => {
    const data = await authApi.signUpWithEmail(email, password)
    return data
  }

  const signIn = async (email, password) => {
    const data = await authApi.signInWithEmail(email, password)
    
    // La carga de datos se hará automáticamente via onAuthStateChange
    return data
  }

  const signInWithGoogle = async () => {
    const data = await authApi.signInWithGoogle()
    return data
  }

  const signInWithApple = async () => {
    const data = await authApi.signInWithApple()
    return data
  }

  const signOut = async () => {
    logger.dev('🚪 Iniciando logout...')
    
    // Marcar proceso de logout
    sessionStorage.setItem('ondeon_logging_out', 'true')
    
    // Detener servicio de contenidos programados
    scheduledContentService.detener()
    
    // Marcar como offline
    try {
      await presenceApi.logout()
    } catch (e) {
      logger.warn('⚠️ Error marcando offline:', e)
    }
    
    // Limpiar estados
    resetAuthState()
    
    // Limpiar storage
    cleanupAllStorage()
    
    // Logout de Supabase
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch (e) {
      logger.warn('⚠️ Error en signOut:', e)
    }
    
    logger.dev('✅ Logout completado')
  }

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  const resetAuthState = () => {
    setUser(null)
    setUserData(null)
    setSession(null)
    setUserChannels([])
    setRecommendedChannels([])
    setActiveProgramaciones([])
    setUserRole(null)
    setRegistroCompleto(null)
    setEmailConfirmed(null)
    initLoadedRef.current = false
    lastAuthUserIdRef.current = null
  }

  const cleanupAllStorage = () => {
    // Limpiar claves de Supabase del localStorage
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  // ============================================================================
  // REPRODUCCIÓN MANUAL
  // ============================================================================
  
  const startManualPlayback = useCallback((contentId, contentName, durationSeconds) => {
    if (manualPlaybackTimeoutRef.current) {
      clearTimeout(manualPlaybackTimeoutRef.current)
      manualPlaybackTimeoutRef.current = null
    }
    
    const info = {
      contentId,
      contentName,
      startTime: Date.now(),
      duration: durationSeconds * 1000
    }
    
    const timeoutId = setTimeout(() => {
      if (manualPlaybackTimeoutRef.current === timeoutId) {
        clearManualPlayback()
      }
    }, info.duration + 1000)
    
    manualPlaybackTimeoutRef.current = timeoutId
    setManualPlaybackInfo(info)
    setIsManualPlaybackActive(true)
    
    logger.dev('🎵 Reproducción manual iniciada:', contentName)
  }, [])

  const clearManualPlayback = useCallback(() => {
    if (!manualPlaybackTimeoutRef.current && !isManualPlaybackActive) {
      return
    }
    
    if (manualPlaybackTimeoutRef.current) {
      clearTimeout(manualPlaybackTimeoutRef.current)
      manualPlaybackTimeoutRef.current = null
    }
    
    setIsManualPlaybackActive(false)
    setManualPlaybackInfo(null)
    logger.dev('🔓 Reproducción manual finalizada')
  }, [isManualPlaybackActive])

  // Exponer funciones globalmente
  useEffect(() => {
    window.__startContentPlayback = startManualPlayback
    window.__clearManualPlayback = clearManualPlayback
    
    return () => {
      delete window.__startContentPlayback
      delete window.__clearManualPlayback
      if (manualPlaybackTimeoutRef.current) {
        clearTimeout(manualPlaybackTimeoutRef.current)
      }
    }
  }, [startManualPlayback, clearManualPlayback])

  // ============================================================================
  // SUSCRIPCIÓN REALTIME A CANALES
  // ============================================================================
  
  useEffect(() => {
    if (!userData?.id || !registroCompleto) return

    logger.dev('🔄 Configurando Realtime para canales')

    const subscription = supabase
      .channel('realtime-canales')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'canales' },
        async (payload) => {
          logger.dev('📡 Cambio en canales:', payload.eventType)
          channelsApi.invalidateCache()
          await loadAllChannels(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [userData?.id, registroCompleto])

  // ============================================================================
  // LISTENER PARA CAMBIOS EN PROGRAMACIONES
  // ============================================================================
  
  useEffect(() => {
    // Cuando cambien las programaciones activas, actualizar el servicio
    if (userData?.id && registroCompleto && activeProgramaciones) {
      scheduledContentService.setProgramaciones(activeProgramaciones)
    }
  }, [activeProgramaciones, userData?.id, registroCompleto])

  // Listener para evento de programaciones cambiadas desde Realtime
  useEffect(() => {
    const handleProgramacionesChanged = async () => {
      logger.dev('🔔 Evento programacionesChanged recibido - recargando datos')
      await loadUserInitData()
    }

    window.addEventListener('programacionesChanged', handleProgramacionesChanged)
    
    return () => {
      window.removeEventListener('programacionesChanged', handleProgramacionesChanged)
    }
  }, [])

  // ============================================================================
  // PERFIL DE USUARIO
  // ============================================================================
  
  const loadUserProfile = async () => {
    if (!user?.id) return null
    
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()
      
      if (error) throw error
      return data
    } catch (e) {
      logger.error('❌ Error cargando perfil:', e)
      return null
    }
  }

  const updateUserProfile = async (profileData) => {
    if (!user?.id) return { success: false, error: 'No autenticado' }
    
    try {
      const { error } = await supabase
        .from('usuarios')
        .update(profileData)
        .eq('auth_user_id', user.id)
      
      if (error) throw error
      
      // Recargar datos del usuario
      await loadUserInitData()
      
      return { success: true }
    } catch (e) {
      logger.error('❌ Error actualizando perfil:', e)
      return { success: false, error: e.message }
    }
  }

  // ============================================================================
  // PROGRAMACIONES DE SECTOR
  // ============================================================================
  
  const toggleProgramacionSector = async (programacionId, desactivar) => {
    try {
      const { contenidosApi } = await import('@/lib/api')
      await contenidosApi.toggleProgramacionSector(programacionId, desactivar)
      
      // Recargar programaciones
      await loadUserInitData()
      
      return { success: true }
    } catch (e) {
      logger.error('❌ Error toggling programación:', e)
      return { success: false, error: e.message }
    }
  }

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================
  
  const value = {
    // Auth state
    user,
    userData,           // Datos completos del usuario (tabla usuarios)
    session,
    loading,
    
    // Canales
    userChannels,       // Todos los canales disponibles
    recommendedChannels, // Canales recomendados por sector
    channelsLoading,
    loadAllChannels,
    ensureChannelsLoaded,
    
    // Programaciones
    activeProgramaciones,
    toggleProgramacionSector,
    
    // Estados
    userRole,           // 'admin' | 'user'
    registroCompleto,
    emailConfirmed,     // true si email_confirmed_at no es null
    
    // Auth methods
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    logout: signOut, // Alias para compatibilidad
    
    // Profile
    loadUserProfile,
    updateUserProfile,
    loadUserInitData,   // Para recargar datos tras registro
    
    // Manual playback control
    isManualPlaybackActive,
    manualPlaybackInfo,
    startManualPlayback,
    clearManualPlayback,
    
    // Compatibilidad con código existente
    isLegacyUser: false, // Ya no hay usuarios legacy
    userPlan: null,      // Se puede implementar después
    subscriptionRequired: false,
    clearSubscriptionRequired: () => {},
    loadUserActiveChannels: loadAllChannels, // Alias para compatibilidad
    forceSyncChannels: () => loadAllChannels(true)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
