import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { initApi, channelsApi, authApi } from '@/lib/api'
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
        const { InAppBrowser } = await import('@capacitor/inappbrowser');
        await InAppBrowser.close();
        logger.dev('🔐 [OAuth] InAppBrowser cerrado');
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

// ============================================================================
// CACHÉ LOCAL - Para acceso instantáneo en sesiones existentes
// ============================================================================
const USER_CACHE_KEY = 'ondeon_user_cache_v1';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas

// Cache usando Capacitor Preferences (más confiable en iOS que localStorage)
let CapacitorPreferences = null;

// Cargar Preferences de forma síncrona si estamos en nativo
const loadPreferences = async () => {
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      CapacitorPreferences = Preferences;
      console.log('✅ [CACHE] Capacitor Preferences cargado');
    } catch (e) {
      console.log('⚠️ [CACHE] No se pudo cargar Capacitor Preferences, usando localStorage');
    }
  }
};
loadPreferences();

const userCache = {
  async save(authUserId, data) {
    try {
      const cacheData = {
        authUserId,
        data,
        timestamp: Date.now()
      };
      const jsonData = JSON.stringify(cacheData);
      
      // Usar Capacitor Preferences en nativo, localStorage en web
      if (CapacitorPreferences) {
        await CapacitorPreferences.set({ key: USER_CACHE_KEY, value: jsonData });
        console.log('💾 [CACHE_SAVE] Datos guardados en Preferences (nativo), userId:', authUserId);
      } else {
        localStorage.setItem(USER_CACHE_KEY, jsonData);
        console.log('💾 [CACHE_SAVE] Datos guardados en localStorage, userId:', authUserId);
      }
    } catch (e) {
      console.log('❌ [CACHE_SAVE_ERROR] No se pudo guardar caché:', e.message);
    }
  },
  
  async get(authUserId) {
    try {
      let cached;
      
      // Usar Capacitor Preferences en nativo, localStorage en web
      if (CapacitorPreferences) {
        const result = await CapacitorPreferences.get({ key: USER_CACHE_KEY });
        cached = result?.value;
        console.log('🔍 [CACHE_GET] Preferences (nativo) tiene datos:', !!cached);
      } else {
        cached = localStorage.getItem(USER_CACHE_KEY);
        console.log('🔍 [CACHE_GET] localStorage tiene datos:', !!cached);
      }
      
      if (!cached) return null;
      
      const { authUserId: cachedUserId, data, timestamp } = JSON.parse(cached);
      
      // Verificar que es el mismo usuario y no ha expirado
      if (cachedUserId !== authUserId) {
        console.log('⚠️ [CACHE_GET] Usuario diferente. Caché:', cachedUserId, 'Actual:', authUserId);
        return null;
      }
      
      const age = Date.now() - timestamp;
      console.log('🔍 [CACHE_GET] Edad del caché:', Math.round(age/1000), 'segundos, máximo:', Math.round(CACHE_MAX_AGE/1000), 's');
      
      if (age > CACHE_MAX_AGE) {
        console.log('⚠️ [CACHE_GET] Caché expirado');
        await this.clear();
        return null;
      }
      
      console.log('✅ [CACHE_GET] Caché válido encontrado');
      return data;
    } catch (e) {
      console.log('❌ [CACHE_GET_ERROR] Error leyendo caché:', e.message);
      return null;
    }
  },
  
  async clear() {
    try {
      if (CapacitorPreferences) {
        await CapacitorPreferences.remove({ key: USER_CACHE_KEY });
        console.log('🗑️ [CACHE_CLEAR] Caché eliminado de Preferences (nativo)');
      } else {
        localStorage.removeItem(USER_CACHE_KEY);
        console.log('🗑️ [CACHE_CLEAR] Caché eliminado de localStorage');
      }
    } catch (e) {
      console.log('❌ [CACHE_CLEAR_ERROR]:', e.message);
    }
  }
};

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
  
  // Estados de trial y acceso
  const [isTrialActive, setIsTrialActive] = useState(false)
  const [canAccessContents, setCanAccessContents] = useState(false)
  const [daysLeftInTrial, setDaysLeftInTrial] = useState(0)
  const [planTipo, setPlanTipo] = useState('trial') // 'trial' | 'free' | 'basico' | 'pro'
  
  // Acceso granular a funcionalidades
  const [canSelectChannels, setCanSelectChannels] = useState(false)
  const [canAccessChannelsPage, setCanAccessChannelsPage] = useState(false)
  const [canCreateContent, setCanCreateContent] = useState(false)
  const [canCreateAds, setCanCreateAds] = useState(false)
  const [shouldShowTrialBanner, setShouldShowTrialBanner] = useState(false)
  
  // Reproducción manual (bloquea controles)
  const [isManualPlaybackActive, setIsManualPlaybackActive] = useState(false)
  const [manualPlaybackInfo, setManualPlaybackInfo] = useState(null)
  const manualPlaybackTimeoutRef = useRef(null)
  
  // Refs para evitar múltiples cargas
  const initLoadedRef = useRef(false)
  const lastAuthUserIdRef = useRef(null)
  const loadingUserDataRef = useRef(false) // Lock para evitar cargas concurrentes
  const loadUserInitDataRef = useRef(null) // Ref para función de carga (evita problemas de orden)
  const cacheAppliedRef = useRef(false) // Flag para saber si el caché ya fue aplicado

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
        
        logger.dev('✅ [OAuth] Sesión establecida para:', data?.user?.email);
        
        // 🔑 CRÍTICO: Actualizar el estado inmediatamente para evitar race conditions
        // En apps nativas, onAuthStateChange puede tardar o ser bloqueado
        if (data?.session && data?.user) {
          setSession(data.session);
          setUser(data.user);
          
          // Liberar el lock si está activo para permitir la carga de datos
          loadingUserDataRef.current = false;
          lastAuthUserIdRef.current = null; // Forzar recarga
          
          // Esperar un momento para que los estados se actualicen
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Forzar carga de datos del usuario usando la ref
          if (loadUserInitDataRef.current) {
            logger.dev('🔄 [OAuth] Forzando carga de datos del usuario...');
            await loadUserInitDataRef.current(data.user);
          } else {
            logger.warn('⚠️ [OAuth] loadUserInitData no disponible aún');
          }
        }
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
      console.log('🚀 [INIT_START] getInitialSession iniciando, cacheAppliedRef:', cacheAppliedRef.current);
      
      // 🔑 CRÍTICO: Si el caché ya fue aplicado (por onAuthStateChange),
      // no sobrescribir loading=true
      if (cacheAppliedRef.current) {
        console.log('⚡ [INIT_SKIP] Caché ya aplicado, saltando getInitialSession');
        return;
      }
      
      console.log('🔄 [INIT_LOADING] Llamando setLoading(true)');
      setLoading(true)

      // Verificar si estamos en proceso de logout
      const isLoggingOut = sessionStorage.getItem('ondeon_logging_out')
      if (isLoggingOut) {
        logger.dev('🚫 Proceso de logout detectado - no restaurar sesión')
        sessionStorage.removeItem('ondeon_logging_out')
        // Solo limpiar claves de Supabase, NO el caché de usuario
        // El caché se limpia explícitamente en signOut()
        cleanupSupabaseStorage()
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
      
      console.log('✅ [INIT_END] getInitialSession terminando, llamando setLoading(false)');
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
          // Pasamos el usuario de la sesión directamente para evitar race conditions con getUser()
          if (session?.user?.id && session.user.id !== lastAuthUserIdRef.current) {
            lastAuthUserIdRef.current = session.user.id // Marcar inmediatamente para evitar duplicados
            await loadUserInitData(session.user)
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ============================================================================
  // CARGA DE DATOS DEL USUARIO
  // ============================================================================
  
  const loadUserInitData = async (providedUser = null) => {
    // 🔒 Lock para evitar ejecuciones concurrentes
    // Si ya hay una carga en progreso, esperar a que termine
    if (loadingUserDataRef.current) {
      logger.dev('⏳ Carga de datos ya en progreso, esperando...')
      
      // Esperar hasta que el lock se libere (máximo 65 segundos)
      const startWait = Date.now()
      while (loadingUserDataRef.current && (Date.now() - startWait) < 65000) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // Si sigue bloqueado después de 65s, algo salió mal - continuar anyway
      if (loadingUserDataRef.current) {
        logger.warn('⚠️ Lock no se liberó después de 65s, forzando nueva carga')
      } else {
        logger.dev('✅ Lock liberado, datos ya cargados')
        return
      }
    }
    
    loadingUserDataRef.current = true
    
    // Flag para asegurar que siempre establecemos registroCompleto
    let registroCompletoSet = false
    
    // 🔑 authUser definido fuera del try para estar disponible en catch
    let authUser = providedUser
    
    try {
      logger.dev('🔄 Cargando datos iniciales del usuario...')
      
      if (!authUser) {
        // Fallback: obtener usuario (para getInitialSession)
        const userResult = await supabase.auth.getUser()
        authUser = userResult?.data?.user
      }
      
      if (!authUser) {
        logger.dev('ℹ️ No hay usuario autenticado')
        setRegistroCompleto(false)
        setEmailConfirmed(false)
        registroCompletoSet = true
        return
      }
      
      logger.dev('✅ Usuario obtenido:', authUser.email)
      
      // 🔐 SEGURIDAD: Establecer estado de verificación de email
      const isEmailConfirmed = authUser.email_confirmed_at !== null
      setEmailConfirmed(isEmailConfirmed)
      logger.dev('📧 Email confirmado:', isEmailConfirmed)
      
      // ⚡ CACHÉ: Verificar si hay datos en caché para acceso instantáneo
      console.log('🔍 [CACHE_CHECK] authUserId:', authUser.id);
      const cachedData = await userCache.get(authUser.id);
      console.log('🔍 [CACHE_RESULT] hasCachedData:', !!cachedData, 'registroCompleto:', cachedData?.usuario?.registro_completo);
      // 🔑 Aplicar caché SIEMPRE que exista, incluso si registro está incompleto
      // Esto evita el "Verificando cuenta..." prolongado
      if (cachedData && cachedData.usuario) {
        const isComplete = cachedData.usuario?.registro_completo === true;
        console.log('✅ [CACHE_APPLYING] Aplicando caché, registroCompleto:', isComplete);
        
        // 🔑 Marcar que el caché fue aplicado ANTES de cualquier setState
        cacheAppliedRef.current = true;
        
        // Aplicar datos del caché inmediatamente
        setUserData(cachedData.usuario);
        setUserRole(cachedData.usuario?.rol || 'user');
        // Usar el valor real de registro_completo del caché
        setRegistroCompleto(isComplete);
        registroCompletoSet = true;
        lastAuthUserIdRef.current = cachedData.usuario?.id;
        setRecommendedChannels(cachedData.canales_recomendados || []);
        setActiveProgramaciones(cachedData.programaciones_activas || []);
        
        // 🔑 CRÍTICO: Establecer loading=false para que la UI muestre el contenido
        console.log('✅ [CACHE_SETLOADING_FALSE] Llamando setLoading(false)');
        setLoading(false);
        
        // Cargar canales e iniciar servicios inmediatamente
        loadAllChannels();
        scheduledContentService.iniciar(
          cachedData.usuario.id,
          cachedData.programaciones_activas || []
        );
        
        // Actualizar datos en background (sin bloquear)
        initApi.getUserInit().then(async freshData => {
          if (freshData && !freshData.error) {
            logger.dev('🔄 Datos actualizados desde servidor');
            setUserData(freshData.usuario);
            setRecommendedChannels(freshData.canales_recomendados || []);
            setActiveProgramaciones(freshData.programaciones_activas || []);
            
            // 🔑 CRÍTICO: Actualizar registroCompleto si cambió
            const freshRegistroCompleto = freshData.usuario?.registro_completo === true;
            console.log('🔄 [BACKGROUND_UPDATE] registroCompleto del servidor:', freshRegistroCompleto);
            setRegistroCompleto(freshRegistroCompleto);
            
            await userCache.save(authUser.id, freshData);
          }
        }).catch(e => logger.warn('⚠️ Error actualizando datos en background:', e));
        
        return; // Salir temprano - UI ya está lista
      }
      
      // Sin caché: cargar datos completos via RPC
      console.log('🌐 [RPC_START] Iniciando getUserInit (sin caché)...');
      const rpcStartTime = Date.now();
      
      // 🔑 Timeout de 30s - si tarda más, hay un problema de red/servidor
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: getUserInit tardó demasiado')), 30000)
      )
      
      const initData = await Promise.race([
        initApi.getUserInit(),
        timeoutPromise
      ])
      
      console.log('🌐 [RPC_END] getUserInit completado en', Date.now() - rpcStartTime, 'ms');
      
      if (initData?.error) {
        // Usuario autenticado pero sin registro en tabla usuarios
        console.log('⚠️ [RPC_USER_NOT_FOUND] Usuario no existe en BD');
        setRegistroCompleto(false)
        registroCompletoSet = true
        setUserRole('user')
        setUserData(null)
        
        // 🔑 Guardar en caché que el usuario NO existe (registro_completo: false)
        // Esto evita llamar al RPC lento en el próximo inicio
        await userCache.save(authUser.id, { 
          usuario: { 
            id: authUser.id, 
            email: authUser.email,
            registro_completo: false 
          },
          canales_recomendados: [],
          programaciones_activas: []
        });
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
      
      // 💾 Guardar en caché para próximos accesos (siempre, incluso si registro incompleto)
      console.log('💾 [CACHE_SAVE] Guardando caché, authUserId:', authUser.id, 'registroCompleto:', isRegistroCompleto);
      await userCache.save(authUser.id, initData);
      
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
        
        // Iniciar servicio de contenidos programados
        await scheduledContentService.iniciar(
          initData.usuario.id,
          initData.programaciones_activas || []
        )
      }
      
    } catch (error) {
      logger.error('❌ Error cargando datos iniciales:', error)
      
      // 🔑 CRÍTICO: Distinguir entre TIMEOUT y USER_NOT_FOUND
      // - TIMEOUT: El RPC está lento, NO significa que el usuario no tenga registro
      // - USER_NOT_FOUND: El usuario realmente no existe en la BD
      const isTimeoutError = error?.message?.includes('Timeout');
      const isUserNotFound = error?.code === 'USER_NOT_FOUND' || error?.message?.includes('USER_NOT_FOUND');
      
      if (isTimeoutError) {
        logger.warn('⚠️ Timeout cargando datos - el usuario puede tener registro, reintentando...')
        // NO establecer registroCompleto=false en timeout
        // Dejar en null para que la UI muestre "cargando" y no redirija
        registroCompletoSet = true
      } else {
        // Error real: usuario no encontrado, error de BD, etc.
        console.log('⚠️ [CATCH_USER_NOT_FOUND] Guardando caché para usuario sin registro');
        setRegistroCompleto(false)
        registroCompletoSet = true
        setUserRole('user')
        setUserData(null)
        
        // 🔑 Guardar en caché que el usuario NO tiene registro
        // authUser está disponible del scope superior
        if (authUser?.id) {
          await userCache.save(authUser.id, { 
            usuario: { 
              id: authUser.id, 
              email: authUser.email,
              registro_completo: false 
            },
            canales_recomendados: [],
            programaciones_activas: []
          });
        }
      }
    } finally {
      // 🔑 FALLBACK: Si por alguna razón registroCompleto no se estableció, hacerlo ahora
      if (!registroCompletoSet) {
        logger.warn('⚠️ registroCompleto no fue establecido, forzando a false')
        setRegistroCompleto(false)
      }
      
      // 🔓 Liberar lock
      loadingUserDataRef.current = false
    }
  }
  
  // 🔑 Guardar referencia a la función para uso en OAuth callback
  loadUserInitDataRef.current = loadUserInitData;

  // ============================================================================
  // VERIFICACIÓN DE TRIAL Y ACCESO
  // ============================================================================
  
  useEffect(() => {
    const checkTrialAndAccess = async () => {
      if (!userData) {
        // 🔑 Sin userData, mantener valores por defecto (NO cambiar a 'free')
        // Esto evita que se muestre el modal de trial expirado durante la carga
        setIsTrialActive(false)
        setCanAccessContents(false)
        setDaysLeftInTrial(0)
        // NO cambiar planTipo aquí - mantener el valor por defecto 'trial'
        return
      }

      try {
        // Obtener datos actualizados de la tabla usuarios
        const { data: userInfo, error: userError } = await supabase
          .from('usuarios')
          .select('trial_start_date, plan_tipo')
          .eq('id', userData.id)
          .single()

        if (userError || !userInfo) {
          logger.warn('⚠️ No se pudo obtener info de trial del usuario')
          // 🔑 Error de red/servidor - NO asumir que el trial expiró
          // Mantener valores actuales, no cambiar a 'free'
          setIsTrialActive(false)
          setCanAccessContents(false)
          setDaysLeftInTrial(0)
          // NO cambiar planTipo a 'free' en caso de error
          return
        }

        const trialStartDate = userInfo.trial_start_date ? new Date(userInfo.trial_start_date) : null
        const currentPlanTipo = userInfo.plan_tipo || 'trial'
        setPlanTipo(currentPlanTipo)

        // Calcular días restantes de trial
        let daysLeft = 0
        let trialActive = false
        
        if (trialStartDate) {
          const now = new Date()
          const trialEndDate = new Date(trialStartDate)
          trialEndDate.setDate(trialEndDate.getDate() + 7)
          
          const diffTime = trialEndDate - now
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          
          daysLeft = Math.max(0, diffDays)
          trialActive = diffDays > 0
        }

        setIsTrialActive(trialActive)
        setDaysLeftInTrial(daysLeft)

        // Calcular accesos granulares según plan
        const isPro = currentPlanTipo === 'pro'
        const isBasico = currentPlanTipo === 'basico'
        const isFree = currentPlanTipo === 'free'
        const isTrial = currentPlanTipo === 'trial'

        // Acceso a contenidos: Trial activo O plan pro
        const hasContentAccess = trialActive || isPro
        setCanAccessContents(hasContentAccess)

        // Seleccionar canales: Trial activo O plan básico/pro (NO free)
        const canSelectCh = trialActive || isBasico || isPro
        setCanSelectChannels(canSelectCh)

        // Acceder a página de canales: Trial activo O plan básico/pro (NO free)
        const canAccessCh = trialActive || isBasico || isPro
        setCanAccessChannelsPage(canAccessCh)

        // Crear contenidos: Solo plan pro
        const canCreateCont = isPro
        setCanCreateContent(canCreateCont)

        // Crear anuncios: Plan básico o pro (NO trial ni free)
        const canCreateAd = isBasico || isPro
        setCanCreateAds(canCreateAd)

        // Mostrar banner de trial: Si está en trial O es free
        const showBanner = trialActive || isFree
        setShouldShowTrialBanner(showBanner)

        logger.dev('✅ Estado de acceso calculado:', {
          trialActive,
          daysLeft,
          planTipo: currentPlanTipo,
          canAccessContents: hasContentAccess,
          canSelectChannels: canSelectCh,
          canAccessChannelsPage: canAccessCh,
          canCreateContent: canCreateCont,
          canCreateAds: canCreateAd,
          shouldShowTrialBanner: showBanner
        })

      } catch (error) {
        logger.error('❌ Error verificando trial y acceso:', error)
        setIsTrialActive(false)
        setCanAccessContents(false)
        setDaysLeftInTrial(0)
      }
    }

    checkTrialAndAccess()
  }, [userData?.id])

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
    
    // Limpiar estados
    resetAuthState()
    
    // Limpiar storage
    await cleanupAllStorage()
    
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
    loadingUserDataRef.current = false
    cacheAppliedRef.current = false
  }

  // Limpiar solo claves de Supabase (para proceso de logout detectado en init)
  const cleanupSupabaseStorage = () => {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  // Limpiar todo el storage (para logout explícito)
  const cleanupAllStorage = async () => {
    // Limpiar caché de usuario
    await userCache.clear();
    // Limpiar claves de Supabase
    cleanupSupabaseStorage();
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
    
    // Trial y acceso
    isTrialActive,         // true si el trial de 7 días está activo
    canAccessContents,     // true si puede acceder a contenidos (trial activo o plan pro)
    daysLeftInTrial,       // días restantes del trial
    planTipo,              // 'trial' | 'free' | 'basico' | 'pro'
    
    // Acceso granular a funcionalidades
    canSelectChannels,     // true si puede cambiar de canal (trial, basico, pro)
    canAccessChannelsPage, // true si puede ver página de canales (trial, basico, pro)
    canCreateContent,      // true si puede crear contenidos (solo pro)
    canCreateAds,          // true si puede crear anuncios (basico, pro)
    shouldShowTrialBanner, // true si debe mostrar el banner de trial (trial o free)
    
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
