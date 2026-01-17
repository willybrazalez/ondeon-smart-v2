import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { userApi, authApi } from '@/lib/api'
import { channelsApi } from '@/lib/api'
import optimizedPresenceService from '@/services/optimizedPresenceService'
import lightweightHeartbeatService from '@/services/lightweightHeartbeatService'
import logger from '@/lib/logger'

// 🌐 Helper para detectar si estamos en versión web (no Electron/Desktop)
const isWebPlatform = () => {
  if (typeof window === 'undefined') return false;
  return window.location.protocol !== 'file:' && !window.electronAPI;
};

// Constantes de roles
const ROLES = {
  BASICO: 1,
  GESTOR: 2,
  ADMINISTRADOR: 3
};

// Lazy loader para playbackLogger (evita importación circular)
let playbackLoggerLazy = null;

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isLegacyUser, setIsLegacyUser] = useState(false)
  const [userChannels, setUserChannels] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [userRole, setUserRole] = useState(null)
  
  // 🔑 Estado de registro completo (para usuarios de Supabase Auth)
  // null = no verificado, true = completo, false = pendiente
  const [registroCompleto, setRegistroCompleto] = useState(null)
  
  // 🎵 Estado global de reproducción manual (bloquea todos los controles)
  const [isManualPlaybackActive, setIsManualPlaybackActive] = useState(false)
  const [manualPlaybackInfo, setManualPlaybackInfo] = useState(null) // {contentId, contentName, startTime, duration}
  
  // 🔧 Usar ref para mantener el ID del timeout sin depender de closures
  const manualPlaybackTimeoutRef = React.useRef(null)

  useEffect(() => {
    const getInitialSession = async () => {
      setLoading(true)

      // 🔧 CRÍTICO: Si estamos en proceso de logout, NO restaurar sesión
      const isLoggingOut = sessionStorage.getItem('ondeon_logging_out');
      if (isLoggingOut) {
        logger.dev('🚫 Proceso de logout detectado - no restaurar sesión');
        sessionStorage.removeItem('ondeon_logging_out');
        
        // Limpiar TODO: legacy y Supabase/OAuth
        localStorage.removeItem('ondeon_legacy_user');
        localStorage.removeItem('ondeon_edge_token');
        
        // Limpiar todas las claves de Supabase
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          logger.dev(`🗑️ Limpiado: ${key}`);
        });
        
        setLoading(false);
        return;
      }

      // Verificar si hay usuario legacy en localStorage
      const legacyUserStr = localStorage.getItem('ondeon_legacy_user')
      if (legacyUserStr) {
        try {
          let legacyUser = JSON.parse(legacyUserStr)
          logger.dev('🔄 Usuario legacy encontrado en localStorage:', legacyUser);
          
          // 🔧 MIGRACIÓN: Si no tiene username pero tiene email, extraer username del email
          if (legacyUser && !legacyUser.username && !legacyUser.nombre_usuario && legacyUser.email) {
            legacyUser.username = legacyUser.email.split('@')[0]; // Usar parte antes del @
            localStorage.setItem('ondeon_legacy_user', JSON.stringify(legacyUser));
            logger.dev('🔧 Username generado desde email:', legacyUser.username);
          }
          
          setUser(legacyUser)
          setIsLegacyUser(true)
          setRegistroCompleto(true) // Usuarios legacy siempre tienen registro completo

          // 🔧 ARREGLADO: Consultar rol desde BD si no está en localStorage
          let rolId = legacyUser.rol_id || legacyUser.role_id;
          
          if (!rolId && legacyUser.id) {
            logger.dev('⚠️ LocalStorage no tiene rol_id, consultando BD...');
            try {
              const { data: userData, error } = await supabase
                .from('usuarios')
                .select('rol_id')
                .eq('id', legacyUser.id)
                .single();
              
              if (error) {
                logger.error('❌ Error consultando rol:', error);
                rolId = 1;
              } else {
                rolId = userData.rol_id || 1;
                logger.dev('✅ Rol obtenido desde BD:', rolId);
                
                // Actualizar localStorage con el rol correcto
                legacyUser.rol_id = rolId;
                localStorage.setItem('ondeon_legacy_user', JSON.stringify(legacyUser));
              }
            } catch (e) {
              logger.error('❌ Excepción consultando rol:', e);
              rolId = 1;
            }
          }
          
          if (!rolId) rolId = 1; // Fallback final
          
          setUserRole(rolId)
          logger.dev('🔄 Rol del usuario desde localStorage:', rolId)
            logger.dev('🔄 Usuario completo desde localStorage:', legacyUser)
            
            // 🚫 BLOQUEO WEB: No iniciar servicios de presencia para usuarios básicos en web
            const isWeb = isWebPlatform();
            const isBasicUser = rolId === ROLES.BASICO;
            
            if (isWeb && isBasicUser) {
              logger.dev('🚫 Usuario básico en web - NO se iniciarán servicios de presencia ni reproductor');
              // NO cargar canales ni iniciar servicios - solo establecer el usuario para la página de descarga
              logger.dev('ℹ️ Usuario básico en web establecido - mostrando página de descarga desktop');
            } else {
              // 🚀 SISTEMA OPTIMIZADO: Con heartbeats ligeros, consumo ~7 GB/mes para 500 usuarios
              const userId = legacyUser?.id || legacyUser?.usuario_id || legacyUser?.user_id;
              if (userId) {
                try {
                  const { getAppVersion } = await import('@/lib/appVersion');
                  const appVersion = await getAppVersion();
                  await optimizedPresenceService.startPresence(userId, {
                    appVersion,
                    deviceInfo: {
                      userAgent: navigator.userAgent,
                      platform: navigator.platform
                    }
                  });
                  logger.dev('✅ Servicio de presencia OPTIMIZADO iniciado desde localStorage');
                  
                  // 💓 Iniciar heartbeat ligero para detección de desconexiones
                  lightweightHeartbeatService.start(userId);
                  logger.dev('💓 Heartbeat ligero iniciado - detectará desconexiones en 2-3 min');
                } catch (e) {
                  logger.warn('⚠️ No se pudo iniciar servicio de presencia:', e);
                }
              }
            
              // NO cargar canales automáticamente - solo establecer el usuario
              // Los canales se cargarán cuando el usuario navegue a una página que los requiera
              logger.dev('ℹ️ Usuario legacy establecido - canales se cargarán bajo demanda');
            };
          
          setLoading(false)
          return
        } catch (error) {
          logger.error('❌ Error parseando usuario legacy:', error)
          localStorage.removeItem('ondeon_legacy_user')
        }
      }

      // Si no hay usuario legacy, verificar Supabase
      // 🔑 CRÍTICO: Usar getUser() en lugar de getSession() para verificar contra el servidor
      // getSession() solo lee el cache local, getUser() valida el token con Supabase
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      // Detectar si estamos en Electron
      const isElectronApp = typeof window !== 'undefined' && (window.location.protocol === 'file:' || !!window.electronAPI);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.jsx:getInitialSession',message:'Supabase auth check',data:{hasAuthUser:!!authUser,authError:authError?.message,email:authUser?.email,isElectronApp},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v3',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      
      // Si el token es inválido o el usuario no existe, limpiar sesión
      if (authError || !authUser) {
        logger.dev('ℹ️ No hay usuario válido en Supabase Auth');
        // Limpiar cualquier sesión residual
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setIsLegacyUser(false)
        setUserRole(null)
        setUserPlan(null)
        setRegistroCompleto(null)
        setLoading(false)
        return
      }
      
      // Obtener sesión para tokens
      const { data: { session } } = await supabase.auth.getSession()
      
      // 🔧 Cargar rol para usuarios de Supabase Auth
      if (authUser?.id) {
        logger.dev('ℹ️ Sesión Supabase encontrada - verificando usuario...');
        try {
          // Buscar usuario en public.usuarios por auth_user_id
          // Usar maybeSingle() para evitar error 406 si el usuario aún no tiene registro
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('id, rol_id, registro_completo, email')
            .eq('auth_user_id', authUser.id)
            .maybeSingle()
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.jsx:getInitialSession:userData',message:'User data loaded',data:{hasUserData:!!userData,userError:userError?.message,rol_id:userData?.rol_id,registro_completo:userData?.registro_completo,isElectronApp},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v3',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          
          if (userData && !userError) {
            // 🔑 CRÍTICO: Si es gestor en Electron, verificar suscripción ANTES de establecer sesión
            const isGestor = userData.rol_id === ROLES.GESTOR;
            
            if (isGestor && isElectronApp && userData.registro_completo) {
              logger.dev('🔍 Gestor en Electron con registro completo - verificando suscripción...');
              
              // Verificar suscripción activa o en trial
              const { data: subscriptionData, error: subError } = await supabase
                .from('suscripciones')
                .select('estado')
                .eq('usuario_id', userData.id)
                .in('estado', ['active', 'trialing'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.jsx:getInitialSession:subscription',message:'Subscription check for gestor in Electron',data:{hasActiveSub:!!subscriptionData,subError:subError?.message,estado:subscriptionData?.estado},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v3',hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
              
              // Si NO tiene suscripción activa, NO establecer sesión
              if (!subscriptionData) {
                logger.dev('⚠️ Gestor sin suscripción activa en Electron - NO permitir acceso');
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.jsx:getInitialSession:blocked',message:'BLOCKING gestor - no subscription',data:{reason:'no_active_subscription'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v3',hypothesisId:'H3'})}).catch(()=>{});
                // #endregion
                
                // Cerrar sesión de Supabase
                await supabase.auth.signOut();
                
                // Abrir dashboard web para renovar
                if (window.electronAPI?.openExternal) {
                  const webDashboardUrl = 'https://main.dnpo8nagdov1i.amplifyapp.com/gestor';
                  window.electronAPI.openExternal(webDashboardUrl);
                }
                
                // NO establecer sesión - el usuario verá la pantalla de login
                setSession(null)
                setUser(null)
                setIsLegacyUser(false)
                setUserRole(null)
                setUserPlan(null)
                setRegistroCompleto(null)
                setLoading(false)
                return;
              }
              
              logger.dev('✅ Gestor con suscripción activa - permitiendo acceso al reproductor');
            }
            
            // Usuario válido encontrado (y tiene suscripción si es gestor en Electron)
            setSession(session)
            setUser(session?.user ?? null)
            setIsLegacyUser(false)
            setUserRole(userData.rol_id || 2)
            // 🔑 CRÍTICO: Establecer estado de registro completo
            setRegistroCompleto(userData.registro_completo === true)
            logger.dev('✅ Rol de usuario Supabase Auth:', userData.rol_id, '- registro_completo:', userData.registro_completo)
          } else {
            // 🔑 CRÍTICO: Sesión existe pero NO hay registro en public.usuarios
            // Esto puede pasar si es un usuario OAuth NUEVO que aún no completó registro
            // NO hacer signOut - dejar que el flujo de registro lo maneje
            logger.dev('ℹ️ Usuario sin registro en BD, asumiendo: Gestor, registro_completo: false');
            
            // Mantener la sesión pero marcar como registro incompleto
            setSession(session)
            setUser(session?.user ?? null)
            setIsLegacyUser(false)
            setUserRole(2) // Asumir gestor para nuevos usuarios
            setRegistroCompleto(false) // 🔑 Esto activará la redirección a /registro en App.jsx
          }
        } catch (e) {
          logger.warn('⚠️ Error verificando usuario Supabase:', e)
          // En caso de error, mantener la sesión pero asumir gestor
          setSession(session)
          setUser(session?.user ?? null)
          setIsLegacyUser(false)
          setUserRole(2) // Fallback a gestor
        }
      } else {
        // No hay sesión
        setSession(null)
        setUser(null)
        setIsLegacyUser(false)
      }
      
      setLoading(false)
    }

    getInitialSession()

    // Escuchar cambios de autenticación de Supabase
    // 🔑 CRÍTICO: NO usar async/await aquí - causa problemas con el estado de React
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Solo actualizar si no hay usuario legacy activo
        if (!isLegacyUser) {
          logger.dev('ℹ️ Sesión Supabase actualizada - event:', event);
          setSession(session)
          setUser(session?.user ?? null)
          
          // Limpiar estados si no hay sesión
          if (!session?.user?.id) {
            setUserChannels([]);
            setUserRole(null);
            setUserPlan(null);
            setRegistroCompleto(null);
            logger.dev('🧹 Estados limpiados - usuario deslogueado');
          }
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [isLegacyUser])

  // 🔑 CRÍTICO: Cargar datos del usuario (rol, registro_completo) cuando user cambie
  // Esto está SEPARADO de onAuthStateChange para evitar problemas con async/await
  // 🔒 También verifica suscripción para gestores en Electron
  const subscriptionCheckDoneRef = React.useRef(false);
  const lastCheckedUserIdRef = React.useRef(null);
  
  // 🔒 Estado para mostrar mensaje de suscripción requerida
  const [subscriptionRequired, setSubscriptionRequired] = React.useState(false);
  
  // 💰 Estado para guardar el plan del usuario (Ondeón Básico / Ondeón Pro)
  const [userPlan, setUserPlan] = React.useState(null);
  
  useEffect(() => {
    const loadUserData = async () => {
      // Solo para usuarios de Supabase Auth (no legacy)
      if (!user?.id || isLegacyUser) {
        // 🔑 Resetear el flag cuando no hay usuario (logout)
        if (!user?.id && lastCheckedUserIdRef.current) {
          subscriptionCheckDoneRef.current = false;
          lastCheckedUserIdRef.current = null;
          logger.dev('🔄 [loadUserData] Ref reseteado - usuario deslogueado');
        }
        return;
      }
      
      // 🔑 Si es un usuario diferente, resetear el flag
      if (lastCheckedUserIdRef.current !== user.id) {
        subscriptionCheckDoneRef.current = false;
        lastCheckedUserIdRef.current = user.id;
      }

      // Detectar si estamos en Electron
      const isElectronApp = typeof window !== 'undefined' && (window.location.protocol === 'file:' || !!window.electronAPI);

      try {
        // Usar maybeSingle() para evitar error 406 si el usuario aún no tiene registro
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('id, rol_id, registro_completo')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.jsx:loadUserData',message:'User data loaded via onAuthStateChange path',data:{hasUserData:!!userData,rol_id:userData?.rol_id,registro_completo:userData?.registro_completo,isElectronApp,subscriptionCheckDone:subscriptionCheckDoneRef.current,lastCheckedUserId:lastCheckedUserIdRef.current,currentUserId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v5',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion

        if (userData && !userError) {
          // 🔑 CRÍTICO: Si es gestor en Electron con registro completo, verificar suscripción
          const isGestor = userData.rol_id === ROLES.GESTOR;
          
          if (isGestor && isElectronApp && userData.registro_completo && !subscriptionCheckDoneRef.current) {
            subscriptionCheckDoneRef.current = true;
            logger.dev('🔍 [loadUserData] Gestor en Electron - verificando suscripción...');
            
            // Verificar suscripción activa o en trial y obtener el plan
            const { data: subscriptionData, error: subError } = await supabase
              .from('suscripciones')
              .select('estado, plan_nombre')
              .eq('usuario_id', userData.id)
              .in('estado', ['active', 'trialing'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            // 💰 Guardar el plan del usuario si existe
            if (subscriptionData?.plan_nombre) {
              setUserPlan(subscriptionData.plan_nombre);
              logger.dev('💰 Plan del usuario:', subscriptionData.plan_nombre);
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.jsx:loadUserData:subscription',message:'Subscription check in loadUserData',data:{hasActiveSub:!!subscriptionData,subError:subError?.message,estado:subscriptionData?.estado},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v5',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
            
            // Si NO tiene suscripción activa, cerrar sesión y abrir dashboard web
            if (!subscriptionData) {
              logger.dev('⚠️ [loadUserData] Gestor sin suscripción activa en Electron - cerrando sesión');
              
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AuthContext.jsx:loadUserData:blocked',message:'BLOCKING gestor - closing session',data:{reason:'no_active_subscription'},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v5',hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
              
              // 🔔 Marcar que se requiere suscripción para mostrar mensaje
              setSubscriptionRequired(true);
              
              // Abrir dashboard web para renovar ANTES de cerrar sesión
              if (window.electronAPI?.openExternal) {
                const webDashboardUrl = 'https://main.dnpo8nagdov1i.amplifyapp.com/gestor';
                window.electronAPI.openExternal(webDashboardUrl);
              }
              
              // Resetear ref para la próxima verificación
              subscriptionCheckDoneRef.current = false;
              lastCheckedUserIdRef.current = null;
              
              // Cerrar sesión - esto limpiará el estado y mostrará login
              await supabase.auth.signOut();
              return;
            }
            
            logger.dev('✅ [loadUserData] Gestor con suscripción activa - permitiendo acceso');
          }
          
          setUserRole(userData.rol_id || ROLES.GESTOR);
          setRegistroCompleto(userData.registro_completo === true);
          logger.dev('✅ Datos de usuario cargados:', userData.rol_id, '- registro_completo:', userData.registro_completo);
          
          // 🚀 Iniciar servicio de presencia para usuarios Supabase Auth (no legacy)
          // Solo si tiene registro completo y está en desktop
          // 🔑 CRÍTICO: Usar userData.id (ID de tabla usuarios) NO user.id (auth_user_id)
          if (userData.registro_completo && isElectronApp) {
            try {
              const { getAppVersion } = await import('@/lib/appVersion');
              const appVersion = await getAppVersion();
              await optimizedPresenceService.startPresence(userData.id, {
                appVersion,
                deviceInfo: {
                  userAgent: navigator.userAgent,
                  platform: navigator.platform
                }
              });
              logger.dev('✅ Servicio de presencia iniciado para usuario Supabase Auth');
              
              // 💓 Iniciar heartbeat ligero - también debe usar userData.id
              lightweightHeartbeatService.start(userData.id);
              logger.dev('💓 Heartbeat ligero iniciado para usuario Supabase Auth');
            } catch (e) {
              logger.warn('⚠️ No se pudo iniciar servicio de presencia:', e);
            }
          }
        } else {
          // Usuario OAuth sin registro en usuarios = Gestor, registro incompleto
          const metadataRol = user.user_metadata?.rol_id;
          setUserRole(metadataRol || ROLES.GESTOR);
          setRegistroCompleto(false);
          logger.dev('ℹ️ Usuario sin registro en BD, asumiendo: Gestor, registro_completo: false');
        }
      } catch (e) {
        logger.warn('⚠️ Error cargando datos de usuario:', e);
        setUserRole(ROLES.GESTOR);
        setRegistroCompleto(false);
      }
    };

    loadUserData();
  }, [user?.id, isLegacyUser]);

  // Funciones de autenticación
  const signUp = async (email, password) => {
    const { data, error } = await authApi.signUpWithEmail(email, password)
    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await authApi.signInWithEmail(email, password)
    if (error) throw error
    
    // 🚫 DESACTIVADO TEMPORALMENTE - Sistema de presencia/heartbeat
    // Causa alto consumo de Egress (99.8% Database Egress)
    /*
    if (data?.user?.id) {
      await advancedPresenceService.startPresence(data.user.id, {
        enableLocation: true,
        enableMetrics: true,
        heartbeatInterval: 30000
      });
      logger.dev('🚀 Servicios iniciados tras login exitoso');
    }
    */
    
    // Cargar canales activos después del login exitoso
    if (data?.user?.id) {
      await loadUserActiveChannels(data.user.id);
    }
    
    return data
  }

  // Login legacy usando Edge Function segura
  const signInWithUsuarios = async (username, password) => {
    try {
      logger.dev('🔐 Iniciando login legacy (Edge Function)...');
      const data = await authApi.signInLegacyEdge(username, password)
      
      logger.dev('📦 Respuesta del Edge Function:', data);

      // Estructura esperada: { user, token? }
      let userPayload = data?.user || { username, legacy: true }
      const token = data?.token || data?.access_token || null

      // 🔧 NUEVO: Asegurar que el username esté presente
      if (userPayload && !userPayload.username && !userPayload.nombre_usuario) {
        userPayload.username = username; // Usar el username que se usó para hacer login
      }

      logger.dev('👤 User payload extraído:', userPayload);
      logger.dev('🔑 Token extraído:', token ? 'SÍ' : 'NO');
      logger.dev('🔍 Username final:', userPayload?.username);
      logger.dev('🎭 rol_id en payload:', userPayload?.rol_id);
      logger.dev('🎭 Tipo de rol_id:', typeof userPayload?.rol_id);

      // Guardar en localStorage para persistencia mínima
      if (token) localStorage.setItem('ondeon_edge_token', token)
      localStorage.setItem('ondeon_legacy_user', JSON.stringify(userPayload))

      setUser(userPayload)
      setIsLegacyUser(true)
      setRegistroCompleto(true) // Usuarios legacy siempre tienen registro completo

      // 🔧 ARREGLADO: Si el Edge Function no retorna rol_id, consultarlo desde BD
      let rolId = userPayload.rol_id || userPayload.role_id;
      
      if (!rolId && userPayload.id) {
        logger.dev('⚠️ Edge Function no retornó rol_id, consultando BD...');
        try {
          const { data: userData, error } = await supabase
            .from('usuarios')
            .select('rol_id')
            .eq('id', userPayload.id)
            .single();
          
          if (error) {
            logger.error('❌ Error consultando rol:', error);
            rolId = 1; // Fallback a usuario base
          } else {
            rolId = userData.rol_id || 1;
            logger.dev('✅ Rol obtenido desde BD:', rolId);
          }
        } catch (e) {
          logger.error('❌ Excepción consultando rol:', e);
          rolId = 1;
        }
      }
      
      if (!rolId) rolId = 1; // Fallback final
      
      setUserRole(rolId)
      logger.dev('🔐 Rol del usuario establecido:', rolId)
      logger.dev('🔐 Valor original rol_id en payload:', userPayload.rol_id)
      logger.dev('🔐 Valor original role_id en payload:', userPayload.role_id)
      
      // 🚫 DESACTIVADO TEMPORALMENTE - Sistema de presencia/heartbeat
      // Causa alto consumo de Egress (99.8% Database Egress)
      const userId = userPayload?.id || userPayload?.usuario_id || userPayload?.user_id;
      logger.dev('🆔 UserId extraído:', userId);
      logger.dev('🔍 Campos disponibles en userPayload:', Object.keys(userPayload));
      
      if (userId) {
        // 🚫 BLOQUEO WEB: No iniciar servicios para usuarios básicos en web
        const isWeb = isWebPlatform();
        const isBasicUser = rolId === ROLES.BASICO;
        
        if (isWeb && isBasicUser) {
          logger.dev('🚫 Usuario básico en web - NO se cargarán canales ni servicios tras login');
          // NO cargar canales ni iniciar servicios - solo retornar el payload
        } else {
          logger.dev('✅ UserId encontrado, cargando canales...');
          await loadUserActiveChannels(userId);
          
          // 🚀 Iniciar servicio de presencia optimizado
          try {
            const { getAppVersion } = await import('@/lib/appVersion');
            const appVersion = await getAppVersion();
            await optimizedPresenceService.startPresence(userId, {
              appVersion,
              deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform
              }
            });
            logger.dev('✅ Servicio de presencia iniciado tras login legacy');
            
            // 💓 Iniciar heartbeat ligero para detección de desconexiones
            lightweightHeartbeatService.start(userId);
            logger.dev('💓 Heartbeat ligero iniciado - detectará desconexiones en 2-3 min');
          } catch (e) {
            logger.warn('⚠️ No se pudo iniciar servicio de presencia:', e);
          }
        }
      } else {
        logger.error('❌ No se pudo extraer userId del payload');
        logger.error('🔍 Payload completo:', userPayload);
      }
      
      return userPayload
    } catch (error) {
      logger.error('❌ Error en signInWithUsuarios:', error);
      throw error
    }
  }

  const signInWithGoogle = async () => {
    const { data, error } = await authApi.signInWithGoogle()
    if (error) throw error
    
    // 🚫 DESACTIVADO TEMPORALMENTE - Sistema de presencia/heartbeat
    // Causa alto consumo de Egress (99.8% Database Egress)
    /*
    if (data?.user?.id) {
      await advancedPresenceService.startPresence(data.user.id, {
        enableLocation: true,
        enableMetrics: true,
        heartbeatInterval: 30000
      });
      logger.dev('🚀 Servicios iniciados tras login con Google');
    }
    */
    
    return data
  }

  const signInWithApple = async () => {
    const { data, error } = await authApi.signInWithApple()
    if (error) throw error
    
    // 🚫 DESACTIVADO TEMPORALMENTE - Sistema de presencia/heartbeat
    // Causa alto consumo de Egress (99.8% Database Egress)
    /*
    if (data?.user?.id) {
      await advancedPresenceService.startPresence(data.user.id, {
        enableLocation: true,
        enableMetrics: true,
        heartbeatInterval: 30000
      });
      logger.dev('🚀 Servicios iniciados tras login con Apple');
    }
    */
    
    return data
  }

  const signOut = async () => {
    logger.dev('🚪 AuthContext.signOut iniciado...');
    
    // 🛑 Detener sistema de presencia optimizado
    try {
      await optimizedPresenceService.stopPresence();
      logger.dev('✅ Sistema de presencia detenido');
    } catch (e) {
      logger.warn('⚠️ Error deteniendo servicio de presencia:', e)
    }
    
    // 🛑 Detener heartbeat ligero
    try {
      lightweightHeartbeatService.stop();
      logger.dev('✅ Heartbeat ligero detenido');
    } catch (e) {
      logger.warn('⚠️ Error deteniendo heartbeat:', e)
    }

    // 🔧 CRÍTICO: Marcar que estamos en proceso de logout para evitar restauración
    sessionStorage.setItem('ondeon_logging_out', 'true');

    if (isLegacyUser) {
      logger.dev('🔐 Cerrando sesión legacy...');
      
      // 🔧 CRÍTICO: Extraer userId ANTES de eliminar datos
      const legacyUserStr = localStorage.getItem('ondeon_legacy_user')
      const legacyUser = legacyUserStr ? JSON.parse(legacyUserStr) : null
      const userId = legacyUser?.id || legacyUser?.usuario_id || legacyUser?.user_id
      
      // 🔧 CRÍTICO: Limpiar PRIMERO todos los datos de sesión
      localStorage.removeItem('ondeon_legacy_user')
      localStorage.removeItem('ondeon_edge_token')
      logger.dev('✅ localStorage limpiado');
      
      // Limpiar estados de React inmediatamente
      setUser(null)
      setIsLegacyUser(false)
      setUserRole(null)
      setUserPlan(null)
      setRegistroCompleto(null)
      setUserChannels([])
      
      // Log de logout en background (no bloquea)
      if (userId) {
        import('@/services/playbackLogger.js').then(mod => {
          mod.default.iniciar(userId, true).then(() => {
            mod.default.logLogout({ method: 'legacy' })
            mod.default.detener()
          }).catch(() => {})
        }).catch(() => {})
      }
      
      logger.dev('✅ Sesión legacy cerrada completamente');
    } else {
      logger.dev('🔐 Cerrando sesión Supabase/OAuth...');
      
      // 🔧 CRÍTICO: Extraer userId ANTES de limpiar
      const userId = user?.id || user?.usuario_id || user?.user_id;
      
      // 🔧 CRÍTICO: Limpiar estados de React PRIMERO
      setUser(null)
      setSession(null)
      setUserRole(null)
      setUserPlan(null)
      setRegistroCompleto(null)
      setUserChannels([])
      logger.dev('✅ Estados de React limpiados');
      
      // 🔧 CRÍTICO para OAuth: Limpiar MANUALMENTE todas las claves de Supabase del localStorage
      // Esto es necesario porque signOut puede fallar o no completarse a tiempo
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        logger.dev(`🗑️ Eliminado localStorage: ${key}`);
      });
      logger.dev('✅ localStorage de Supabase limpiado manualmente');
      
      // Logout de Supabase con scope: 'global' y timeout
      try {
        logger.dev('🔄 Llamando a supabase.auth.signOut({ scope: global })...');
        const signOutPromise = supabase.auth.signOut({ scope: 'global' });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        await Promise.race([signOutPromise, timeoutPromise]);
        logger.dev('✅ signOut completado');
      } catch (signOutError) {
        logger.warn('⚠️ Error/Timeout en signOut (ignorando):', signOutError?.message);
      }
      
      // Registrar logout en background (no bloquea)
      if (userId) {
        import('@/services/playbackLogger.js').then(mod => {
          mod.default.iniciar(userId, true).then(() => {
            mod.default.logLogout({ method: 'supabase/oauth' })
            mod.default.detener()
          }).catch(() => {})
        }).catch(() => {})
      }
      
      logger.dev('✅ Sesión Supabase/OAuth cerrada completamente');
    }
    
    logger.dev('✅ AuthContext.signOut completado');
  }

  // Cargar canales activos del usuario autenticado (bajo demanda)
  const loadUserActiveChannels = async (userId) => {
    if (!userId) {
      logger.dev('⚠️ No hay userId para cargar canales');
      return;
    }
    
    try {
      setChannelsLoading(true);
      logger.dev('🔐 Cargando canales activos para usuario (bajo demanda):', userId);
      
      const canalesActivos = await channelsApi.getUserActiveChannelsHierarchy(userId);
      
      logger.dev('📊 Canales activos obtenidos:', canalesActivos);
      logger.dev('📊 Cantidad de canales:', canalesActivos.length);
      
      // 🔧 CRÍTICO: Forzar nueva referencia del array para que React detecte el cambio
      setUserChannels([...canalesActivos]);
      logger.dev(`📊 ${canalesActivos.length} canales activos cargados para el usuario`);
      logger.dev('✅ Estado userChannels actualizado - componentes deberían re-renderizarse');
      
      // Seleccionar automáticamente un canal aleatorio SOLO si aún no hay canal activo y no se está recargando por Realtime
      if (canalesActivos.length > 0 && !window.currentPlayerChannelId && !window.suppressAutoSelect) {
        const canalAleatorio = canalesActivos[Math.floor(Math.random() * canalesActivos.length)];
        logger.dev('🎲 Canal aleatorio seleccionado:', canalAleatorio);
        
        // Emitir evento personalizado para notificar la selección automática con un pequeño delay
        setTimeout(() => {
          const event = new CustomEvent('canalAutoSeleccionado', {
            detail: { canal: canalAleatorio }
          });
          window.dispatchEvent(event);
          logger.dev('📡 Evento canalAutoSeleccionado enviado');
        }, 500); // Delay de 500ms para asegurar que los componentes estén listos
      } else {
        logger.dev('⚠️ No hay canales disponibles para seleccionar automáticamente');
      }
      
      return canalesActivos;
    } catch (error) {
      logger.error('❌ Error cargando canales activos:', error);
      logger.error('🔍 Detalles del error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      setUserChannels([]);
      return [];
    } finally {
      setChannelsLoading(false);
    }
  };

  // Función simplificada - solo carga si realmente no hay canales
  const ensureChannelsLoaded = async () => {
    // ✅ Si hay suscripción Realtime pero AÚN no hay canales, cargar de todos modos
    if (window.channelsRealtimeActive && userChannels.length > 0) {
      logger.dev('🔄 Suscripción Realtime activa - canales ya presentes, no recargar');
      return userChannels;
    }

    if (!user || channelsLoading) {
      return userChannels;
    }

    if (userChannels.length === 0) {
      const userId = user?.id || user?.usuario_id || user?.user_id;
      if (userId) {
        logger.dev('🔄 ensureChannelsLoaded → No hay canales en memoria, cargando para usuario:', userId);
        return await loadUserActiveChannels(userId);
      }
      return [];
    }

    return userChannels;
  };


  // Suscripción Realtime centralizada para cambios en canales del usuario
  useEffect(() => {
    const userId = user?.id || user?.usuario_id || user?.user_id;
    if (!userId) return;

    logger.dev('🔄 AuthContext: Configurando suscripción Realtime de canales para usuario:', userId);
    window.channelsRealtimeActive = true;

    const channelName = `realtime-canales-context-${userId}`;
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
          logger.dev('📡 AuthContext: Cambio Realtime en canales:', payload?.eventType);
          try {
            // 🔧 CRÍTICO: Invalidar cache antes de recargar
            channelsApi.invalidateChannelsCache(userId);
            
            // Recargar canales desde la BD (sin cache)
            const canales = await loadUserActiveChannels(userId);
            
            // Notificar a vistas que dependan de este listado
            try {
              window.dispatchEvent(new CustomEvent('canalesActualizados', { detail: { canales } }));
            } catch (e) {}
          } catch (error) {
            logger.warn('⚠️ AuthContext: Error sincronizando canales tras Realtime:', error);
          }
        }
      )
      .subscribe();

    return () => {
      logger.dev('🧹 AuthContext: Limpiando suscripción Realtime de canales');
      window.channelsRealtimeActive = false;
      try { supabase.removeChannel(subscription); } catch {}
    };
  }, [user]);

  // 🔧 NUEVO: Función para forzar sincronización manual
  const forceSyncChannels = async () => {
    const userId = user?.id || user?.usuario_id || user?.user_id;
    if (userId) {
      logger.dev('🔄 Forzando sincronización manual de canales...');
      await loadUserActiveChannels(userId);
    }
  };

  // 🎵 Funciones para manejar reproducción manual (bloquea todos los controles)
  const startManualPlayback = React.useCallback((contentId, contentName, durationSeconds) => {
    // 🔧 CRÍTICO: Limpiar cualquier timeout previo antes de crear uno nuevo
    if (manualPlaybackTimeoutRef.current) {
      logger.dev('🧹 Limpiando timeout previo antes de iniciar nueva reproducción');
      clearTimeout(manualPlaybackTimeoutRef.current);
      manualPlaybackTimeoutRef.current = null;
    }
    
    const info = {
      contentId,
      contentName,
      startTime: Date.now(),
      duration: durationSeconds * 1000, // convertir a milisegundos
    };
    
    // Auto-desbloquear después de la duración del contenido (fallback)
    const timeoutId = setTimeout(() => {
      logger.dev('⏰ Timeout de reproducción manual alcanzado - desbloqueando controles');
      // 🔧 Verificar que este timeout siga siendo el activo antes de desbloquear
      if (manualPlaybackTimeoutRef.current === timeoutId) {
        clearManualPlayback();
      } else {
        logger.dev('⏭️ Timeout obsoleto ignorado - ya se limpió antes');
      }
    }, info.duration + 1000); // +1s de margen por seguridad
    
    // Guardar en ref para acceso directo sin closures
    manualPlaybackTimeoutRef.current = timeoutId;
    
    setManualPlaybackInfo(info);
    setIsManualPlaybackActive(true);
    logger.dev('🎵 Reproducción manual iniciada - controles bloqueados:', {
      ...info,
      timeoutId
    });
  }, []);

  const clearManualPlayback = React.useCallback(() => {
    // 🔧 CRÍTICO: Verificar si ya está limpio para evitar doble limpieza
    if (!manualPlaybackTimeoutRef.current && !isManualPlaybackActive) {
      logger.dev('⏭️ clearManualPlayback llamado pero ya estaba limpio - ignorando');
      return;
    }
    
    logger.dev('🔓 Reproducción manual finalizada - controles desbloqueados');
    
    // Limpiar timeout usando ref (siempre tiene el valor actual)
    if (manualPlaybackTimeoutRef.current) {
      clearTimeout(manualPlaybackTimeoutRef.current);
      manualPlaybackTimeoutRef.current = null;
      logger.dev('✅ Timeout de reproducción manual limpiado correctamente');
    }
    
    setIsManualPlaybackActive(false);
    setManualPlaybackInfo(null);
  }, [isManualPlaybackActive]);
  
  // Exponer funciones globalmente con refs actualizadas
  useEffect(() => {
    window.__startContentPlayback = startManualPlayback;
    window.__clearManualPlayback = clearManualPlayback;
    
    return () => {
      // Limpiar al desmontar
      delete window.__startContentPlayback;
      delete window.__clearManualPlayback;
      
      // Asegurar limpieza de timeouts al desmontar
      if (manualPlaybackTimeoutRef.current) {
        clearTimeout(manualPlaybackTimeoutRef.current);
        manualPlaybackTimeoutRef.current = null;
      }
    };
  }, [startManualPlayback, clearManualPlayback]);

  // 📝 Cargar perfil completo del usuario desde la tabla usuarios
  const loadUserProfile = async () => {
    const authUserId = user?.id;
    if (!authUserId) {
      logger.warn('⚠️ No hay usuario autenticado para cargar perfil');
      return null;
    }

    try {
      const { data: userData, error } = await supabase
        .from('usuarios')
        .select('id, nombre, email, telefono, establecimiento, ultimo_cambio_establecimiento, direccion, localidad, provincia, codigo_postal, pais, sector_id, notas')
        .eq('auth_user_id', authUserId)
        .single();

      if (error) {
        logger.error('❌ Error cargando perfil de usuario:', error);
        return null;
      }

      logger.dev('✅ Perfil de usuario cargado:', userData);
      return userData;
    } catch (e) {
      logger.error('❌ Error en loadUserProfile:', e);
      return null;
    }
  };

  // 📝 Actualizar perfil del usuario en la tabla usuarios
  // Si cambió el establecimiento, actualiza también establecimiento_updated_at
  const updateUserProfile = async (profileData, options = {}) => {
    const authUserId = user?.id;
    if (!authUserId) {
      logger.warn('⚠️ No hay usuario autenticado para actualizar perfil');
      return { success: false, error: 'No hay usuario autenticado' };
    }

    try {
      logger.dev('🔄 Actualizando perfil de usuario...');
      
      // Preparar datos a actualizar (solo campos definidos)
      const updateData = {};
      
      if (profileData.nombre !== undefined) updateData.nombre = profileData.nombre;
      if (profileData.telefono !== undefined) updateData.telefono = profileData.telefono;
      if (profileData.direccion !== undefined) updateData.direccion = profileData.direccion;
      if (profileData.localidad !== undefined) updateData.localidad = profileData.localidad;
      if (profileData.provincia !== undefined) updateData.provincia = profileData.provincia;
      if (profileData.codigo_postal !== undefined) updateData.codigo_postal = profileData.codigo_postal;

      // Si cambió el establecimiento, incluirlo (el trigger de BD maneja la fecha automáticamente)
      if (options.establecimientoChanged) {
        updateData.establecimiento = profileData.establecimiento;
        logger.dev('📢 Establecimiento modificado - se regenerarán indicativos');
      }

      // Actualizar en public.usuarios
      const { error: updateError } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('auth_user_id', authUserId);

      if (updateError) {
        logger.error('❌ Error actualizando perfil:', updateError);
        return { success: false, error: updateError.message };
      }

      // También actualizar metadata en Supabase Auth (no bloqueante)
      supabase.auth.updateUser({
        data: {
          nombre: profileData.nombre,
          telefono: profileData.telefono,
          establecimiento: profileData.establecimiento,
        }
      }).catch(e => logger.warn('⚠️ Error actualizando metadata auth:', e));

      logger.dev('✅ Perfil actualizado correctamente');
      return { success: true, establecimientoChanged: options.establecimientoChanged };
    } catch (e) {
      logger.error('❌ Error en updateUserProfile:', e);
      return { success: false, error: e.message };
    }
  };

  const value = {
    user,
    session,
    loading,
    isLegacyUser,
    userChannels,
    channelsLoading,
    userRole,
    userPlan, // 💰 Plan del usuario (Ondeón Básico / Ondeón Pro)
    registroCompleto, // 🔑 Estado de registro completo para usuarios Supabase
    subscriptionRequired, // 🔒 True si se bloqueó acceso por falta de suscripción
    clearSubscriptionRequired: () => setSubscriptionRequired(false), // Para limpiar el mensaje
    signUp,
    signIn,
    signInWithUsuarios,
    signInWithGoogle,
    signInWithApple,
    signOut,
    loadUserActiveChannels,
    ensureChannelsLoaded,
    forceSyncChannels,
    // 🎵 Control de reproducción manual
    isManualPlaybackActive,
    manualPlaybackInfo,
    startManualPlayback,
    clearManualPlayback,
    // 📝 Gestión de perfil de usuario
    loadUserProfile,
    updateUserProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext 