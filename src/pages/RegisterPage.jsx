import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { CreditCard, Check, Loader2, User, Sparkles, Music, Mail, RefreshCw, ArrowLeft } from 'lucide-react';
import WaveBackground from '@/components/player/WaveBackground';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { usuariosApi } from '@/lib/api';
import logger from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';

// Hook para detectar si es móvil
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

// Sectores por defecto (se cargan dinámicamente desde BD)
const DEFAULT_SECTORES = [
  { id: 'otro', nombre: 'Otro' } // Fallback si no carga la BD
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    telefono: '',
    establecimiento: '', // Nombre del negocio
    sectorId: '', // ID del sector seleccionado
    sectorOtro: '', // Sector personalizado si elige "Otro"
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userCreated, setUserCreated] = useState(null);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [isOAuthUser, setIsOAuthUser] = useState(false); // Detecta si viene de OAuth
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  // 📱 Estado para la vista móvil tipo Spotify
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState('buttons'); // 'buttons' | 'email-form' (solo para paso 1)
  
  // Resetear vista móvil al montar el componente (evita flash al navegar)
  useEffect(() => {
    setMobileView('buttons');
  }, []);
  
  // Sectores cargados desde BD
  const [sectores, setSectores] = useState(DEFAULT_SECTORES);
  
  // Ref para evitar que re-renders interrumpan el guardado
  const isSavingRef = useRef(false);
  
  // Ref para evitar procesar tokens múltiples veces
  const processedTokensRef = useRef(false);
  
  // 🔑 Estado para indicar que estamos procesando tokens (bloquea otros useEffect)
  const [processingTokens, setProcessingTokens] = useState(() => {
    // Inicializar como true si hay tokens en el hash (para bloquear otros useEffect desde el inicio)
    const hash = window.location.hash;
    return hash && (hash.includes('access_token') || hash.includes('type='));
  });
  
  // 🔑 CRÍTICO: Procesar tokens de verificación de email en el hash de la URL
  // Cuando el usuario pulsa el link del email, Supabase redirige aquí con tokens
  // Este useEffect tiene PRIORIDAD sobre los demás
  useEffect(() => {
    const processEmailVerificationTokens = async () => {
      // Evitar procesar múltiples veces
      if (processedTokensRef.current) return;
      
      const hash = window.location.hash;
      if (!hash) {
        setProcessingTokens(false);
        return;
      }
      
      // Verificar si hay tokens de verificación
      // Los links de verificación contienen: #access_token=...&type=signup o type=email_change
      if (!hash.includes('access_token') && !hash.includes('type=')) {
        setProcessingTokens(false);
        return;
      }
      
      processedTokensRef.current = true;
      setProcessingTokens(true);
      logger.dev('📧 [Verificación Email] Detectados tokens en URL hash');
      
      try {
        setLoading(true);
        setError('');
        
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const errorParam = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        // Manejar errores de Supabase
        if (errorParam) {
          logger.error('❌ [Verificación Email] Error de Supabase:', errorParam, errorDescription);
          // Si el error es de token expirado, mostrar mensaje amigable
          if (errorDescription?.includes('expired') || errorParam === 'access_denied') {
            setError('El enlace de verificación ha expirado. Por favor, solicita uno nuevo.');
            setStep(1);
          } else {
            setError(`Error de verificación: ${errorDescription || errorParam}`);
          }
          setLoading(false);
          setProcessingTokens(false);
          // Limpiar hash
          if (window.history?.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          return;
        }
        
        logger.dev('📧 [Verificación Email] Tipo:', type, 'Token presente:', !!accessToken);
        
        if (accessToken) {
          // Establecer la sesión con los tokens
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });
          
          if (sessionError) {
            logger.error('❌ [Verificación Email] Error estableciendo sesión:', sessionError);
            setError('El enlace de verificación ha expirado o es inválido. Por favor, solicita uno nuevo.');
            setStep(1);
            setLoading(false);
            setProcessingTokens(false);
            // Limpiar hash
            if (window.history?.replaceState) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
            return;
          }
          
          logger.dev('✅ [Verificación Email] Sesión establecida:', data?.user?.email);
          
          // Verificar que el email está confirmado
          const user = data?.user;
          if (user?.email_confirmed_at) {
            logger.dev('✅ [Verificación Email] Email verificado correctamente:', user.email_confirmed_at);
            setUserCreated(user);
            setForm(prev => ({ 
              ...prev, 
              email: user.email || prev.email,
              nombre: user.user_metadata?.full_name || user.user_metadata?.name || prev.nombre
            }));
            
            // 🔑 Verificar si ya tiene registro completo en la BD
            const { data: userData } = await supabase
              .from('usuarios')
              .select('registro_completo, establecimiento, telefono')
              .eq('auth_user_id', user.id)
              .maybeSingle();
            
            if (userData?.registro_completo) {
              logger.dev('✅ [Verificación Email] Usuario ya tiene registro completo, redirigiendo a home');
              // Limpiar hash antes de redirigir
              if (window.history?.replaceState) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
              window.location.href = '/';
              return;
            }
            
            setStep(4); // Ir al paso de completar perfil
          } else {
            logger.warn('⚠️ [Verificación Email] Email aún no verificado después de setSession');
            // Intentar refrescar la sesión
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.user?.email_confirmed_at) {
              setUserCreated(refreshData.user);
              setForm(prev => ({ ...prev, email: refreshData.user.email || prev.email }));
              setStep(4);
            } else {
              setError('El email no se pudo verificar. Por favor, intenta de nuevo.');
              setStep(1);
            }
          }
        }
        
        // Limpiar el hash de la URL para evitar reprocesamiento
        if (window.history?.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          logger.dev('🧹 [Verificación Email] Hash limpiado de la URL');
        }
        
      } catch (err) {
        logger.error('❌ [Verificación Email] Error procesando tokens:', err);
        setError('Error al procesar la verificación: ' + err.message);
      } finally {
        setLoading(false);
        setProcessingTokens(false);
      }
    };
    
    processEmailVerificationTokens();
  }, []);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithGoogle, signInWithApple, registroCompleto, loading: authLoading, loadUserInitData } = useAuth();
  
  // Verificar si volvió del checkout cancelado o viene de login con registro incompleto
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      setError('El proceso de pago fue cancelado. Puedes intentarlo de nuevo.');
    }
  }, [searchParams]);
  
  // 🔑 CRÍTICO: Si AuthContext ya sabe que el registro está completo, redirigir inmediatamente
  // Esto evita la race condition donde RegisterPage consulta la BD de forma independiente
  useEffect(() => {
    // Esperar a que se procesen los tokens primero
    if (processingTokens) return;
    
    if (!authLoading && registroCompleto === true) {
      logger.dev('✅ [RegisterPage] AuthContext confirma registro completo, redirigiendo...');
      navigate('/', { replace: true });
    }
  }, [authLoading, registroCompleto, navigate, processingTokens]);

  // Estado para usuarios que vienen de Electron sin sesión
  const [needsReAuth, setNeedsReAuth] = useState(false);
  const [reAuthProvider, setReAuthProvider] = useState('');

  // 🔑 CRÍTICO: Verificar sesión al cargar (para usuarios que vuelven de OAuth o login)
  // ⚠️ IMPORTANTE: NO redirigir a / o /gestor aquí si el usuario tiene registro completo
  // La redirección la maneja el useEffect de registroCompleto para evitar race conditions
  useEffect(() => {
    // 🔑 CRÍTICO: Esperar a que se procesen los tokens del hash primero
    if (processingTokens) {
      logger.dev('🔄 [RegisterPage] Esperando procesamiento de tokens...');
      return;
    }
    
    // Si AuthContext ya confirmó registro completo, no hacer nada aquí
    // El useEffect de arriba se encargará de la redirección
    if (registroCompleto === true) {
      logger.dev('🔄 [RegisterPage] registroCompleto=true, useEffect de arriba manejará redirección');
      return;
    }
    
    const checkSessionOnLoad = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // 🌐 Caso especial: Usuario viene de Electron sin sesión
        const fromElectron = searchParams.get('from') === 'electron';
        const continueRegistration = searchParams.get('continue') === 'true';
        const providerParam = searchParams.get('provider');
        
        if (fromElectron && continueRegistration && !session) {
          logger.dev('🌐 Usuario viene de Electron, necesita re-autenticarse');
          setNeedsReAuth(true);
          setReAuthProvider(providerParam || 'google');
          return;
        }
        
        if (session?.user) {
          const user = session.user;
          logger.dev('✅ Usuario ya autenticado detectado:', user.email);
          
          // Limpiar estado de re-autenticación si estaba activo
          if (needsReAuth) {
            setNeedsReAuth(false);
            // Limpiar parámetros de URL para evitar confusión
            window.history.replaceState({}, '', '/registro');
          }
          
          // Detectar si es OAuth (Google, Apple, etc.)
          const provider = user.app_metadata?.provider;
          const isOAuth = provider && provider !== 'email';
          setIsOAuthUser(isOAuth);
          logger.dev('🔐 Proveedor de autenticación:', provider, '- Es OAuth:', isOAuth);
          
          // 🔑 CRÍTICO: Verificar si el usuario ya tiene registro completo
          // PERO no redirigir desde aquí - esperar a que AuthContext lo haga
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('id, registro_completo, establecimiento, telefono, sector_id, rol')
            .eq('auth_user_id', user.id)
            .single();
          
          // 🔑 Si tiene registro completo, NO redirigir aquí
          // Esperar a que AuthContext se sincronice y el useEffect de registroCompleto lo maneje
          // Esto EVITA el loop infinito de redirecciones
          if (!userError && userData?.registro_completo) {
            logger.dev('✅ [RegisterPage] BD dice registro completo, esperando AuthContext...');
            // NO hacer navigate aquí - el useEffect de registroCompleto lo manejará
            return;
          }
          
          setUserCreated(user);
          setForm(prev => ({
            ...prev,
            email: user.email || '',
            nombre: user.user_metadata?.full_name || 
                    user.user_metadata?.nombre || 
                    user.user_metadata?.name || ''
          }));
          
          // 🔑 Si viene de login con ?continue=true, verificar qué paso le falta
          if (continueRegistration) {
            logger.dev('🔄 Usuario viene de login para continuar registro');
            
            // Si no tiene datos de perfil completos, ir al paso 4
            if (!userData?.establecimiento || !userData?.telefono) {
              logger.dev('📝 Faltan datos de perfil, ir al paso 4');
              setStep(4);
            } else {
              // Si tiene datos pero no pagó, ir al paso 5
              logger.dev('💳 Datos completos, falta pago, ir al paso 5');
              setStep(5);
            }
            return;
          }
          
          // Si el email está verificado (OAuth siempre lo tiene), ir al paso 4
          if (user.email_confirmed_at) {
            logger.dev('📧 Email verificado, saltando al paso 4');
            setStep(4);
          } else {
            // Si no está verificado (registro por email), ir al paso 3
            setStep(3);
          }
        }
      } catch (err) {
        logger.error('Error verificando sesión:', err);
      }
    };
    
    checkSessionOnLoad();
  }, [searchParams, navigate, registroCompleto, needsReAuth, processingTokens]);


  // 🌙 CRÍTICO: Forzar tema oscuro en la página de registro
  useEffect(() => {
    // Guardar el tema actual
    const previousTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    
    // Forzar tema oscuro
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    logger.dev('🌙 Tema oscuro forzado en RegisterPage');
    
    // Restaurar el tema original al salir de la página
    return () => {
      if (previousTheme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        logger.dev('☀️ Tema restaurado al salir de RegisterPage');
      }
    };
  }, []);

  // 📂 Cargar sectores desde la BD
  useEffect(() => {
    const loadSectores = async () => {
      try {
        const data = await usuariosApi.getSectores();
        if (data && data.length > 0) {
          // Agregar opción "Otro" al final
          setSectores([...data, { id: 'otro', nombre: 'Otro' }]);
          logger.dev(`✅ ${data.length} sectores cargados desde BD`);
        }
      } catch (error) {
        logger.warn('⚠️ No se pudieron cargar sectores, usando fallback');
      }
    };
    loadSectores();
  }, []);

  // 📧 DETECCIÓN AUTOMÁTICA DE VERIFICACIÓN DE EMAIL (Paso 3)
  // Detecta cuando el usuario verifica su email desde otra pestaña/app
  useEffect(() => {
    // Solo ejecutar en el paso 3 (verificación de email)
    if (step !== 3) return;
    
    let pollInterval = null;
    let authSubscription = null;
    let capacitorAppListener = null;
    
    logger.dev('📧 [Verificación] Iniciando detección automática de verificación de email');
    
    // Helper para verificar y avanzar
    // 🔑 CRÍTICO: Usar múltiples estrategias para detectar la verificación
    const checkAndAdvance = async (source) => {
      try {
        // Estrategia 1: Forzar refresh de la sesión
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!refreshError && refreshData?.user?.email_confirmed_at) {
          logger.dev(`✅ [Verificación] Email verificado via ${source} (refreshSession)`);
          setUserCreated(refreshData.user);
          setStep(4);
          return true;
        }
        
        // Estrategia 2: getUser si refreshSession falla
        if (refreshError) {
          logger.warn('⚠️ [Verificación] Error en refreshSession:', refreshError.message);
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email_confirmed_at) {
            logger.dev(`✅ [Verificación] Email verificado via ${source} (getUser)`);
            setUserCreated(user);
            setStep(4);
            return true;
          }
        }
        
        // 🔑 Estrategia 3: Si no hay sesión válida pero tenemos credenciales guardadas,
        // intentar hacer login (el login funcionará si el email está verificado)
        if (form.email && form.password) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password
          });
          
          if (!loginError && loginData?.user?.email_confirmed_at) {
            logger.dev(`✅ [Verificación] Email verificado via ${source} (login automático)`);
            setUserCreated(loginData.user);
            setStep(4);
            return true;
          }
        }
        
        return false;
      } catch (e) {
        logger.warn('⚠️ [Verificación] Error verificando estado:', e);
      }
      return false;
    };
    
    // 1. Listener de cambios de auth (detecta USER_UPDATED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'USER_UPDATED' && session?.user?.email_confirmed_at) {
          logger.dev('✅ [Verificación] Email verificado via onAuthStateChange');
          setUserCreated(session.user);
          setStep(4);
        }
        // También detectar SIGNED_IN por si el login automático funcionó
        if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
          logger.dev('✅ [Verificación] Email verificado via SIGNED_IN');
          setUserCreated(session.user);
          setStep(4);
        }
      }
    );
    authSubscription = subscription;
    
    // 2. Polling como fallback (cada 5 segundos)
    pollInterval = setInterval(() => {
      checkAndAdvance('polling');
    }, 5000);
    
    // 3. Verificar al volver a la app (Page Visibility API)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        logger.dev('👁️ [Verificación] App visible, verificando estado...');
        await checkAndAdvance('visibilitychange');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 4. Verificar al enfocar la ventana (útil para navegadores de escritorio)
    const handleFocus = async () => {
      logger.dev('🎯 [Verificación] Ventana enfocada, verificando estado...');
      await checkAndAdvance('focus');
    };
    window.addEventListener('focus', handleFocus);
    
    // 5. Soporte para Capacitor (iOS/Android) - detectar cuando vuelve de background
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      import('@capacitor/app').then(({ App }) => {
        capacitorAppListener = App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            logger.dev('📱 [Verificación] App nativa activa, verificando estado...');
            await checkAndAdvance('capacitor-appStateChange');
          }
        });
        logger.dev('✅ [Verificación] Listener de Capacitor configurado');
      }).catch(e => {
        logger.warn('⚠️ [Verificación] No se pudo cargar @capacitor/app:', e);
      });
    }
    
    // Cleanup al salir del paso 3 o desmontar
    return () => {
      logger.dev('🧹 [Verificación] Limpiando listeners de verificación');
      if (authSubscription) authSubscription.unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (capacitorAppListener) capacitorAppListener.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.email, form.password]);

  // Títulos por paso
  const stepTitles = [
    '',
    'Empieza tu prueba gratis',
    'Crea tu cuenta',
    'Verifica tu correo',
    'Completa tu perfil',
  ];

  const stepDescriptions = [
    '',
    '7 días gratis, sin tarjeta',
    'Usa tu correo electrónico',
    'Revisa tu bandeja de entrada',
    'Cuéntanos sobre ti',
  ];

  // Indicador de pasos
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-4">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`w-2 h-2 rounded-full transition-all ${
            s === step 
              ? 'w-6 bg-primary' 
              : s < step 
                ? 'bg-green-500' 
                : 'bg-gray-300 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  );

  // Autenticación con Google (usa InAppBrowser en iOS)
  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithGoogle();
      // En nativo, el InAppBrowser manejará el callback
      // En web, habrá redirección
    } catch (err) {
      logger.error('Error con Google:', err);
      setError('Error con Google: ' + err.message);
      setLoading(false);
    }
  };

  // Autenticación con Apple (usa InAppBrowser en iOS)
  const handleAppleAuth = async () => {
    setError('');
    setLoading(true);
    
    try {
      await signInWithApple();
      // En nativo, el InAppBrowser manejará el callback
      // En web, habrá redirección
    } catch (err) {
      logger.error('Error con Apple:', err);
      setError('Error con Apple: ' + err.message);
      setLoading(false);
    }
  };

  // Paso a formulario de email/contraseña
  const handleCorreo = () => {
    setError('');
    setStep(2);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Registro con correo y contraseña (incluye metadata de gestor)
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!form.email || !form.password) {
      setError('El correo y la contraseña son obligatorios.');
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      setLoading(false);
      return;
    }
    
    try {
      // 🔑 CRÍTICO: Usar Universal Links para redirección
      // Universal Links (https://ondeon.es) funcionan mejor que custom schemes
      // porque iOS abre la app directamente sin pasar por Safari
      const isDev = import.meta.env.DEV;
      
      let emailRedirectUrl;
      if (isDev) {
        emailRedirectUrl = 'http://localhost:5173/registro';
      } else {
        // 📱 Universal Link: funciona tanto en web como en app nativa
        emailRedirectUrl = 'https://app.ondeon.es/registro';
        logger.dev('🔗 [Registro] Usando Universal Link para redirección:', emailRedirectUrl);
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            rol: 'user',
            nombre: form.email.split('@')[0]
          },
          emailRedirectTo: emailRedirectUrl
        }
      });

      if (error) throw error;

      if (data?.user) {
        const user = data.user;
        
        // 🔑 CASO 1: Usuario ya existía (identities vacío = OAuth previo)
        const isExistingOAuthUser = !user.identities || user.identities.length === 0;
        
        // 🔑 CASO 2: Usuario existe con email pero NO verificado
        // Supabase devuelve el usuario existente cuando signUp con email ya registrado
        const isUnverifiedEmailUser = user.identities?.length > 0 && !user.email_confirmed_at;
        
        logger.dev('📧 [Registro] Estado del usuario:', {
          email: user.email,
          identities: user.identities?.length,
          email_confirmed_at: user.email_confirmed_at,
          isExistingOAuthUser,
          isUnverifiedEmailUser
        });
        
        // 🔑 CASO 2: Usuario con email sin verificar - reenviar correo y ir a paso 3
        if (isUnverifiedEmailUser) {
          logger.dev('📧 [Registro] Usuario existe pero email NO verificado, reenviando correo...');
          
          // Reenviar correo de verificación
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: form.email,
            options: {
              emailRedirectTo: emailRedirectUrl
            }
          });
          
          if (resendError) {
            logger.warn('⚠️ Error reenviando correo:', resendError.message);
            // Continuar de todos modos al paso 3
          } else {
            logger.dev('✅ Correo de verificación reenviado');
          }
          
          setUserCreated(user);
          setStep(3); // Ir a verificar email
          return;
        }
        
        // 🔑 CASO 1: Usuario OAuth existente
        if (isExistingOAuthUser) {
          logger.dev('⚠️ Usuario OAuth ya existe, verificando estado...');
          
          // Verificar si ya tiene registro completo
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('id, registro_completo, rol')
            .eq('auth_user_id', user.id)
            .maybeSingle();
          
          if (userData?.registro_completo) {
            logger.dev('✅ Usuario existente con registro completo, redirigiendo...');
            const targetRoute = userData.rol === 'admin' ? '/gestor' : '/';
            setError('');
            navigate(targetRoute, { replace: true });
            return;
          } else if (userData && !userData.registro_completo) {
            logger.dev('🔄 Usuario existente sin registro completo, continuando...');
            setUserCreated(user);
            setIsOAuthUser(true);
            setStep(4);
            return;
          } else {
            setError('Este correo ya está registrado. Intenta iniciar sesión con Google o Apple.');
            return;
          }
        }
        
        // 🔑 CASO 3: Usuario nuevo con email verificado (raro pero posible)
        if (user.email_confirmed_at) {
          logger.dev('✅ Usuario nuevo con email ya verificado, saltando a paso 4');
          setUserCreated(user);
          setStep(4);
          return;
        }
        
        // 🔑 CASO 4: Usuario completamente nuevo - ir a verificar email
        setUserCreated(user);
        setStep(3);
        logger.dev('✅ Usuario nuevo creado:', user.id);
      }
    } catch (err) {
      logger.error('Error en registro:', err);
      if (err.message.includes('already registered')) {
        setError('Este correo ya está registrado. Intenta iniciar sesión.');
      } else if (err.message.includes('User already registered')) {
        setError('Este correo ya está registrado. Intenta iniciar sesión.');
      } else {
        setError('Error en el registro: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Comprobar si el usuario ha verificado el email
  const handleCheckVerification = async () => {
    setError('');
    setCheckingVerification(true);
    setResendSuccess(false);
    
    try {
      // 🔑 CRÍTICO: El problema es que cuando el usuario verifica en el navegador,
      // la sesión de la app no se actualiza automáticamente.
      // Necesitamos forzar una actualización completa de la sesión.
      logger.dev('🔄 [Verificación] Verificando estado del email...');
      
      let user = null;
      let emailConfirmed = false;
      const email = form.email;
      const password = form.password;
      
      // Estrategia 1: Forzando refresh de sesión
      logger.dev('🔄 [Verificación] Estrategia 1: Forzando refresh de sesión...');
      
      // Primero intentamos refreshSession que debería obtener un nuevo JWT
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (!refreshError && refreshData?.user) {
        user = refreshData.user;
        emailConfirmed = !!user.email_confirmed_at;
        logger.dev('📧 [Verificación] refreshSession resultado:', {
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          emailConfirmed
        });
      } else {
        logger.dev('⚠️ [Verificación] refreshSession error o sin usuario:', refreshError?.message);
      }
      
      // Estrategia 2: getUser() hace llamada directa al servidor
      if (!emailConfirmed && !user) {
        logger.dev('🔄 [Verificación] Estrategia 2: getUser (llamada al servidor)...');
        const { data: userData, error: getUserError } = await supabase.auth.getUser();
        
        if (!getUserError && userData?.user) {
          user = userData.user;
          emailConfirmed = !!user.email_confirmed_at;
          logger.dev('📧 [Verificación] getUser resultado:', {
            email: user.email,
            email_confirmed_at: user.email_confirmed_at,
            emailConfirmed
          });
        } else {
          logger.dev('⚠️ [Verificación] getUser error:', getUserError?.message);
        }
      }
      
      // 🔑 Estrategia 3: Si no tenemos sesión válida PERO tenemos email/password,
      // intentar hacer login (el login funcionará si el email está verificado)
      if (!emailConfirmed && !user && email && password) {
        logger.dev('🔄 [Verificación] Estrategia 3: Intentando login con credenciales guardadas...');
        
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (!loginError && loginData?.user) {
          user = loginData.user;
          emailConfirmed = !!user.email_confirmed_at;
          logger.dev('📧 [Verificación] Login exitoso:', {
            email: user.email,
            email_confirmed_at: user.email_confirmed_at,
            emailConfirmed
          });
          
          if (emailConfirmed) {
            logger.dev('✅ [Verificación] Email verificado via login!');
            setUserCreated(user);
            setStep(4);
            return;
          }
        } else {
          // Si el login falla con "Email not confirmed", el email no está verificado aún
          if (loginError?.message?.includes('Email not confirmed')) {
            logger.dev('⚠️ [Verificación] Email aún no confirmado según Supabase');
            setError(
              'El correo aún no ha sido verificado. ' +
              'Haz clic en el enlace del email que te enviamos y luego vuelve aquí.'
            );
            return;
          }
          logger.dev('⚠️ [Verificación] Login error:', loginError?.message);
        }
      }
      
      // 🔑 Estrategia 4: Si no hay sesión ni credenciales, mostrar mensaje más amigable
      if (!emailConfirmed && !user) {
        logger.dev('🔄 [Verificación] No hay sesión ni credenciales guardadas');
        setError(
          'Haz clic en el enlace de verificación del correo. ' +
          'Cuando lo hagas, esta página se actualizará automáticamente.'
        );
        return;
      }
      
      // Estrategia 5: Esperar propagación y reintentar
      if (!emailConfirmed && user) {
        logger.dev('🔄 [Verificación] Estrategia 5: Esperando 3s y reintentando...');
        setError('Verificando... espera un momento.');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Reintentar con getUser
        const { data: retryData } = await supabase.auth.getUser();
        if (retryData?.user?.email_confirmed_at) {
          user = retryData.user;
          emailConfirmed = true;
          logger.dev('📧 [Verificación] Reintento exitoso:', user.email_confirmed_at);
        }
        
        setError('');
      }
      
      if (emailConfirmed && user) {
        logger.dev('✅ [Verificación] Email CONFIRMADO:', user.email_confirmed_at);
        setUserCreated(user);
        setStep(4); // Ir al paso de datos del perfil
      } else {
        logger.dev('❌ [Verificación] Email NO verificado. Estado actual:', {
          userExists: !!user,
          email: user?.email,
          email_confirmed_at: user?.email_confirmed_at
        });
        setError(
          'El correo aún no ha sido verificado. ' +
          'Asegúrate de pulsar el enlace del correo y luego vuelve aquí. ' +
          'Si ya lo hiciste, espera unos segundos e inténtalo de nuevo.'
        );
      }
    } catch (err) {
      logger.error('❌ [Verificación] Error:', err);
      setError('Error al verificar: ' + err.message);
    } finally {
      setCheckingVerification(false);
    }
  };

  // Reenviar email de verificación
  const handleResendVerification = async () => {
    setError('');
    setResendingEmail(true);
    setResendSuccess(false);
    
    try {
      // 🔑 Usar Universal Links para redirección
      const isDev = import.meta.env.DEV;
      
      let emailRedirectUrl;
      if (isDev) {
        emailRedirectUrl = 'http://localhost:5173/registro';
      } else {
        // 📱 Universal Link: funciona tanto en web como en app nativa
        emailRedirectUrl = 'https://app.ondeon.es/registro';
      }
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: form.email,
        options: {
          emailRedirectTo: emailRedirectUrl
        }
      });
      
      if (error) throw error;
      
      setResendSuccess(true);
      logger.dev('✅ Email de verificación reenviado a:', form.email);
    } catch (err) {
      logger.error('Error reenviando email:', err);
      setError('Error al reenviar el correo: ' + err.message);
    } finally {
      setResendingEmail(false);
    }
  };

  // Completar perfil - Ya NO requiere pago, se activa trial automáticamente
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validaciones
    if (!isOAuthUser && !form.nombre) {
      setError('El nombre es obligatorio.');
      setLoading(false);
      return;
    }

    if (!form.establecimiento) {
      setError('El nombre del establecimiento es obligatorio.');
      setLoading(false);
      return;
    }

    if (!form.sectorId) {
      setError('Por favor selecciona un sector.');
      setLoading(false);
      return;
    }

    if (form.sectorId === 'otro' && !form.sectorOtro) {
      setError('Por favor indica tu sector.');
      setLoading(false);
      return;
    }

    if (!form.telefono) {
      setError('El teléfono es obligatorio.');
      setLoading(false);
      return;
    }

    try {
      // Marcar que estamos en proceso de guardado
      isSavingRef.current = true;
      
      const authUserId = userCreated?.id;
      const userEmail = userCreated?.email || form.email;
      logger.dev('📝 Guardando perfil - auth_user_id:', authUserId);
      
      if (!authUserId) {
        throw new Error('No se encontró el ID del usuario');
      }
      
      logger.dev('🔄 Creando/actualizando public.usuarios con trial automático...');
      
      // 🔑 sector_id ahora es UUID (o null si eligió "otro")
      const sectorIdValue = form.sectorId && form.sectorId !== 'otro' ? form.sectorId : null;
      
      const userData = {
        auth_user_id: authUserId,
        email: userEmail,
        nombre: form.nombre || userCreated?.user_metadata?.full_name || userCreated?.user_metadata?.name,
        telefono: form.telefono || null,
        establecimiento: form.establecimiento,
        sector_id: sectorIdValue,
        notas: form.sectorId === 'otro' ? `Sector: ${form.sectorOtro}` : null,
        rol: 'user',
        registro_completo: true, // ✅ Se marca true inmediatamente (trial de 7 días)
        trial_start_date: new Date().toISOString(), // ✅ Inicia trial ahora
        plan_tipo: 'trial' // ✅ Usuario en periodo de prueba
      };
      
      const { data: upsertedUser, error: upsertError } = await supabase
        .from('usuarios')
        .upsert(userData, {
          onConflict: 'auth_user_id',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      if (upsertError) {
        logger.warn('❌ Error en upsert de usuarios:', upsertError);
        throw upsertError;
      }
      logger.dev('✅ Usuario creado con trial de 7 días:', upsertedUser?.id);

      // Actualizar metadata en Supabase Auth
      logger.dev('🔄 Actualizando metadata en Supabase Auth...');
      supabase.auth.updateUser({
        data: {
          nombre: form.nombre || userCreated?.user_metadata?.full_name,
          telefono: form.telefono,
          establecimiento: form.establecimiento,
          sector_id: sectorIdValue,
          sector_otro: form.sectorId === 'otro' ? form.sectorOtro : null,
          rol: 'user'
        }
      }).then(({ error: authUpdateError }) => {
        if (authUpdateError) {
          logger.warn('⚠️ Error en auth.updateUser:', authUpdateError);
        } else {
          logger.dev('✅ Metadata actualizada en Supabase Auth');
        }
      });

      // Recargar datos del usuario en AuthContext
      await loadUserInitData();

      logger.dev('✅ Registro completado - Trial de 7 días activado');
      logger.dev('➡️ Redirigiendo al reproductor...');
      
      // Guardar flag para mostrar modal de bienvenida
      localStorage.setItem('ondeon_show_welcome_modal', 'true');
      
      // Redirigir al reproductor (home)
      navigate('/');
      
    } catch (err) {
      logger.error('Error completando registro:', err);
      setError('Error guardando los datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
      isSavingRef.current = false;
    }
  };

  // 🌐 Pantalla especial: Usuario viene de Electron y necesita re-autenticarse
  if (needsReAuth) {
    const providerName = reAuthProvider === 'apple' ? 'Apple' : 'Google';
    const ProviderIcon = reAuthProvider === 'apple' ? FaApple : FcGoogle;
    
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 safe-area-top safe-area-bottom">
        <WaveBackground isPlaying={true} />
        <div className="w-full max-w-md mx-auto z-10">
          <Card className="p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/90 backdrop-blur-md">
            <img 
              src="/assets/icono-ondeon.png" 
              alt="Logo Ondeón" 
              className="h-14 sm:h-16 mb-4"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">
              Completa tu registro
            </h2>
            
            <p className="text-center text-muted-foreground mb-6 text-sm">
              Ya tienes una cuenta creada. Inicia sesión con {providerName} para continuar con tu registro.
            </p>
            
            {error && (
              <div className="w-full mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                {error}
              </div>
            )}
            
            <Button
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  if (reAuthProvider === 'apple') {
                    await signInWithApple();
                  } else {
                    await signInWithGoogle();
                  }
                  // Después de OAuth exitoso, el useEffect detectará la sesión
                  // y redirigirá al paso correcto
                } catch (err) {
                  setError('Error al conectar con ' + providerName);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className={`w-full h-12 rounded-xl font-semibold text-base flex items-center justify-center gap-3 ${
                reAuthProvider === 'apple' 
                  ? 'bg-black hover:bg-gray-800 text-white' 
                  : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-300'
              }`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ProviderIcon className={`${reAuthProvider === 'apple' ? 'text-white' : ''} text-xl`} />
                  Continuar con {providerName}
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Después de iniciar sesión, podrás completar tu perfil y activar tu suscripción.
            </p>
            
            <div className="mt-6 pt-4 border-t border-gray-700 w-full text-center">
              <Link 
                to="/login" 
                className="text-sm text-primary hover:underline"
              >
                ← Volver al inicio
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Paso 1: Elección de método de registro
  if (step === 1) {
    // 📱 Vista móvil tipo Spotify
    if (isMobile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6 py-8 safe-area-top safe-area-bottom">
          <WaveBackground isPlaying={true} />
          
          {/* Contenido principal - centrado */}
          <div className="w-full max-w-md z-10">
            <Card className="p-6 rounded-3xl shadow-2xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/95 backdrop-blur-xl border border-white/5">
              
              {/* Logo - siempre visible */}
              <img 
                src="/assets/icono-ondeon.png" 
                alt="Logo Ondeón" 
                className="h-16 mb-4"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              
              {/* Indicador de pasos - siempre visible */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-6 bg-primary' : 'w-1.5 bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              
              {/* Título - siempre visible */}
              <h1 className="text-2xl font-bold text-center text-white mb-1">
                {stepTitles[step]}
              </h1>
              <p className="text-center text-gray-400 text-sm mb-4">
                {stepDescriptions[step]}
              </p>
              
              {/* Banner de trial - siempre visible */}
              <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-white">7 días de prueba gratis</span>
                    <p className="text-xs text-gray-400">Sin tarjeta, acceso completo</p>
                  </div>
                </div>
              </div>
              
              {/* Link a login - siempre visible */}
              <p className="text-center text-gray-400 text-sm mb-4">
                ¿Ya tienes una cuenta?{' '}
                <Link to="/login" onClick={() => setMobileView('buttons')} className="underline text-primary font-medium">Inicia sesión</Link>
              </p>
              
              {error && (
                <div className="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}
              
              <AnimatePresence mode="wait">
                {mobileView === 'buttons' ? (
                  <motion.div
                    key="buttons"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full flex flex-col items-center overflow-hidden"
                  >
                    {/* Botones de registro */}
                    <div className="w-full flex flex-col gap-3">
                      <Button
                        onClick={handleGoogleAuth}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 h-14 rounded-full border border-white/20 bg-transparent hover:bg-white/10 text-white font-medium text-base transition-all active:scale-[0.98]"
                        variant="outline"
                      >
                        <FcGoogle size={24} /> 
                        <span>Continuar con Google</span>
                      </Button>
                      
                      <Button
                        onClick={handleAppleAuth}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 h-14 rounded-full bg-white text-black hover:bg-white/90 font-medium text-base transition-all active:scale-[0.98]"
                      >
                        <FaApple size={24} /> 
                        <span>Continuar con Apple</span>
                      </Button>
                      
                      {/* Separador */}
                      <div className="w-full flex items-center gap-4 my-2">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-gray-500 uppercase tracking-wider">o</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                      
                      <Button
                        onClick={() => { setError(''); setMobileView('email-form'); }}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 h-14 rounded-full bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base transition-all active:scale-[0.98] shadow-lg shadow-[#A2D9F7]/20"
                      >
                        <Mail size={20} />
                        <span>Continuar con correo</span>
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="email-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full flex flex-col items-center overflow-hidden"
                  >
                    {/* Formulario de email */}
                    <form className="w-full flex flex-col gap-4" onSubmit={handleEmailRegister}>
                      <div className="space-y-2">
                        <Label className="text-gray-300 text-sm font-medium">Correo electrónico</Label>
                        <Input 
                          name="email" 
                          type="email" 
                          value={form.email} 
                          onChange={handleChange} 
                          required 
                          disabled={loading}
                          placeholder="tu@email.com"
                          autoComplete="username"
                          className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-gray-300 text-sm font-medium">Contraseña</Label>
                        <Input 
                          name="password" 
                          type="password" 
                          value={form.password} 
                          onChange={handleChange} 
                          required 
                          disabled={loading}
                          placeholder="Mínimo 6 caracteres"
                          minLength={6}
                          autoComplete="new-password"
                          className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                        />
                        <p className="text-xs text-gray-500">
                          La contraseña debe tener al menos 6 caracteres
                        </p>
                      </div>
                      
                      <Button 
                        className="w-full h-14 mt-2 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base rounded-full shadow-lg shadow-[#A2D9F7]/20 hover:shadow-[#A2D9F7]/40 transition-all active:scale-[0.98]" 
                        type="submit"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creando cuenta...
                          </>
                        ) : 'Continuar'}
                      </Button>
                      
                      <button
                        type="button"
                        onClick={() => { setError(''); setMobileView('buttons'); }}
                        className="text-sm text-gray-400 hover:text-white transition-colors mt-2"
                      >
                        ← Volver
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        </div>
      );
    }

    // 🖥️ Vista desktop (original)
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 safe-area-top safe-area-bottom">
        <WaveBackground isPlaying={true} />
        <div className="w-full max-w-md mx-auto z-10">
          <Card className="p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/90 backdrop-blur-md">
            <img 
              src="/assets/icono-ondeon.png" 
              alt="Logo Ondeón" 
              className="h-14 sm:h-16 mb-3"
              onError={(e) => {
                console.error('Error al cargar el logo en RegisterPage');
                e.target.style.display = 'none';
              }}
            />
            <StepIndicator />
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-1">{stepTitles[step]}</h2>
            <p className="text-center text-muted-foreground mb-4 text-sm">
              {stepDescriptions[step]}
            </p>
            
            {/* Banner de trial */}
            <div className="w-full bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">7 días de prueba gratis</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sin tarjeta, acceso completo
              </p>
            </div>
            
            <p className="text-center text-muted-foreground mb-4 text-sm">
              ¿Ya tienes una cuenta? <Link to="/login" className="underline text-primary">Inicia sesión</Link>
            </p>
            {error && <div className="text-red-600 text-xs mb-4 text-center w-full">{error}</div>}
            <div className="w-full flex flex-col gap-3">
              <Button 
                className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-card text-foreground text-sm sm:text-base py-2 sm:py-2.5" 
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                <FcGoogle size={20} /> Continuar con Google
              </Button>
              <Button 
                className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-black text-white text-sm sm:text-base py-2 sm:py-2.5" 
                onClick={handleAppleAuth}
                disabled={loading}
              >
                <FaApple size={20} /> Continuar con Apple
              </Button>
              <div className="relative my-2">
                <hr className="border-gray-300 dark:border-gray-700" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background dark:bg-[#181c24] px-4 text-xs text-gray-500">o</span>
              </div>
              <Button 
                className="w-full bg-black text-white text-sm sm:text-base py-2 sm:py-2.5" 
                onClick={handleCorreo}
                disabled={loading}
              >
                Continuar con correo
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Paso 2: Formulario de email y contraseña
  if (step === 2) {
    // 📱 Vista móvil
    if (isMobile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6 py-8 safe-area-top safe-area-bottom">
          <WaveBackground isPlaying={true} />
          
          <div className="w-full max-w-md z-10">
            <Card className="p-6 rounded-3xl shadow-2xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/95 backdrop-blur-xl border border-white/5">
              {/* Logo */}
              <img 
                src="/assets/icono-ondeon.png" 
                alt="Logo Ondeón" 
                className="h-14 mb-3"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              
              {/* Header con botón de volver */}
              <div className="w-full flex items-center justify-center mb-2">
                <button
                  onClick={() => setStep(1)}
                  className="absolute left-6 p-2 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-bold text-center text-white">
                  {stepTitles[step]}
                </h2>
              </div>
              
              {/* Indicador de pasos */}
              <div className="flex items-center justify-center gap-1.5 mb-6">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-6 bg-primary' : s < step ? 'w-1.5 bg-green-500' : 'w-1.5 bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <div className="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <form className="w-full flex flex-col gap-4" onSubmit={handleEmailRegister}>
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">Correo electrónico</Label>
                  <Input 
                    name="email" 
                    type="email" 
                    value={form.email} 
                    onChange={handleChange} 
                    required 
                    disabled={loading}
                    placeholder="tu@email.com"
                    autoComplete="username"
                    className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">Contraseña</Label>
                  <Input 
                    name="password" 
                    type="password" 
                    value={form.password} 
                    onChange={handleChange} 
                    required 
                    disabled={loading}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    autoComplete="new-password"
                    className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                  />
                  <p className="text-xs text-gray-500">
                    La contraseña debe tener al menos 6 caracteres
                  </p>
                </div>
                
                <Button 
                  className="w-full h-14 mt-2 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base rounded-full shadow-lg shadow-[#A2D9F7]/20 transition-all active:scale-[0.98]" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : 'Continuar'}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      );
    }

    // 🖥️ Vista desktop (original)
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
        <WaveBackground isPlaying={true} />
        <div className="w-full max-w-md mx-auto z-10">
          <Card className="p-8 rounded-2xl shadow-2xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/95 backdrop-blur-xl border border-white/5">
            <img 
              src="/assets/icono-ondeon.png" 
              alt="Logo Ondeón" 
              className="h-12 sm:h-14 mb-3"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <StepIndicator />
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold tracking-tight mb-1">{stepTitles[step]}</h2>
              <p className="text-gray-400 text-sm">
                {stepDescriptions[step]}
              </p>
            </div>

            {error && (
              <div className="w-full mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form className="w-full space-y-5" onSubmit={handleEmailRegister}>
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm font-medium">Correo electrónico</Label>
                <Input 
                  name="email" 
                  type="email" 
                  value={form.email} 
                  onChange={handleChange} 
                  required 
                  disabled={loading}
                  placeholder="tu@email.com"
                  autoComplete="username"
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm font-medium">Contraseña</Label>
                <Input 
                  name="password" 
                  type="password" 
                  value={form.password} 
                  onChange={handleChange} 
                  required 
                  disabled={loading}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  autoComplete="new-password"
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500">
                  La contraseña debe tener al menos 6 caracteres
                </p>
              </div>
              
              <div className="pt-2">
                <Button 
                  className="w-full h-12 bg-gradient-to-r from-[#7eb8da] to-[#a8d0e6] hover:from-[#6ba8ca] hover:to-[#98c0d6] text-[#1a1e26] font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-200" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : 'Continuar'}
                </Button>
              </div>
            </form>

            <button
              onClick={() => setStep(1)}
              className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              disabled={loading}
            >
              ← Volver
            </button>
          </Card>
        </div>
      </div>
    );
  }

  // Paso 3: Verificación de email
  if (step === 3) {
    // 📱 Vista móvil
    if (isMobile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6 py-8 safe-area-top safe-area-bottom">
          <WaveBackground isPlaying={true} />
          
          <div className="w-full max-w-md z-10">
            <Card className="p-6 rounded-3xl shadow-2xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/95 backdrop-blur-xl border border-white/5">
              {/* Logo */}
              <img 
                src="/assets/icono-ondeon.png" 
                alt="Logo Ondeón" 
                className="h-14 mb-3"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              
              {/* Header con botón de volver */}
              <div className="w-full flex items-center justify-center relative mb-2">
                <button
                  onClick={() => setStep(2)}
                  className="absolute left-0 p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-bold text-center text-white">
                  {stepTitles[step]}
                </h2>
              </div>
              
              {/* Indicador de pasos */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-6 bg-primary' : s < step ? 'w-1.5 bg-green-500' : 'w-1.5 bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              {/* Icono de email */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mb-3 border border-emerald-500/20">
                <Mail className="w-7 h-7 text-emerald-400" />
              </div>

              <div className="text-center mb-4 space-y-2">
                <p className="text-gray-300 text-sm">
                  Hemos enviado un correo de verificación a:
                </p>
                <p className="font-semibold text-white bg-white/5 px-4 py-2 rounded-xl border border-white/10 text-sm">
                  {form.email}
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  Haz clic en el enlace del correo y luego vuelve aquí.
                </p>
              </div>

              {resendSuccess && (
                <div className="w-full mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-emerald-400 text-sm text-center">✓ Correo reenviado</p>
                </div>
              )}

              {error && (
                <div className="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <div className="w-full space-y-3">
                <Button 
                  className="w-full h-14 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base rounded-full shadow-lg shadow-[#A2D9F7]/20 transition-all active:scale-[0.98]" 
                  onClick={handleCheckVerification}
                  disabled={checkingVerification}
                >
                  {checkingVerification ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : 'Ya verifiqué mi correo'}
                </Button>

                <button
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reenviando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Reenviar correo
                    </>
                  )}
                </button>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    // 🖥️ Vista desktop (original)
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
        <WaveBackground isPlaying={true} />
        <div className="w-full max-w-md mx-auto z-10">
          <Card className="p-8 rounded-2xl shadow-2xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/95 backdrop-blur-xl border border-white/5">
            <img 
              src="/assets/icono-ondeon.png" 
              alt="Logo Ondeón" 
              className="h-12 sm:h-14 mb-3"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <StepIndicator />
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold tracking-tight mb-1">{stepTitles[step]}</h2>
              <p className="text-gray-400 text-sm">
                {stepDescriptions[step]}
              </p>
            </div>

            {/* Icono de email animado */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mb-6 border border-emerald-500/20">
              <Mail className="w-10 h-10 text-emerald-400" />
            </div>

            <div className="text-center mb-6 space-y-2">
              <p className="text-gray-300 text-sm">
                Hemos enviado un correo de verificación a:
              </p>
              <p className="font-semibold text-white bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                {form.email}
              </p>
              <p className="text-gray-500 text-xs mt-3">
                Haz clic en el enlace del correo y luego vuelve aquí.
              </p>
            </div>

            {/* Mensaje de éxito al reenviar */}
            {resendSuccess && (
              <div className="w-full mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-emerald-400 text-sm text-center">
                  ✓ Correo reenviado correctamente
                </p>
              </div>
            )}

            {/* Mensaje de error */}
            {error && (
              <div className="w-full mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <div className="w-full space-y-3">
              <Button 
                className="w-full h-12 bg-gradient-to-r from-[#7eb8da] to-[#a8d0e6] hover:from-[#6ba8ca] hover:to-[#98c0d6] text-[#1a1e26] font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-200" 
                onClick={handleCheckVerification}
                disabled={checkingVerification}
              >
                {checkingVerification ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : 'Ya verifiqué mi correo'}
              </Button>

              <button
                onClick={handleResendVerification}
                disabled={resendingEmail}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Reenviar correo de verificación
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Cambiar correo
            </button>
          </Card>
        </div>
      </div>
    );
  }

  // Paso 4: Completar perfil
  if (step === 4) {
    // 📱 Vista móvil
    if (isMobile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6 py-8 safe-area-top safe-area-bottom">
          <WaveBackground isPlaying={true} />
          
          <div className="w-full max-w-md z-10">
            <Card className="p-6 rounded-3xl shadow-2xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/95 backdrop-blur-xl border border-white/5">
              {/* Logo */}
              <img 
                src="/assets/icono-ondeon.png" 
                alt="Logo Ondeón" 
                className="h-14 mb-3"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              
              {/* Header con botón de volver */}
              <div className="w-full flex items-center justify-center relative mb-2">
                <button
                  onClick={() => setStep(1)}
                  className="absolute left-0 p-2 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-bold text-center text-white">
                  {stepTitles[step]}
                </h2>
              </div>
              
              {/* Indicador de pasos */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-6 bg-primary' : s < step ? 'w-1.5 bg-green-500' : 'w-1.5 bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <div className="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <form className="w-full flex flex-col gap-4" onSubmit={handleCompleteProfile}>
                {/* Nombre */}
                {isOAuthUser ? (
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-sm font-medium">Nombre</Label>
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-white flex-1 text-sm">{form.nombre || 'Usuario'}</span>
                      <span className="text-xs text-emerald-400 font-medium">✓</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm font-medium">Nombre completo *</Label>
                    <Input
                      name="nombre"
                      type="text"
                      value={form.nombre}
                      onChange={handleChange}
                      required
                      placeholder="Tu nombre"
                      autoComplete="name"
                      className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                    />
                  </div>
                )}

                {/* Establecimiento */}
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">Establecimiento *</Label>
                  <Input
                    name="establecimiento"
                    type="text"
                    value={form.establecimiento}
                    onChange={handleChange}
                    required
                    placeholder="Nombre de tu negocio"
                    className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                  />
                </div>

              {/* Sector */}
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm font-medium">Sector *</Label>
                <select
                  name="sectorId"
                  value={form.sectorId}
                  onChange={handleChange}
                  className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base"
                  required
                >
                  <option value="" className="bg-[#1a1e26]">Selecciona un sector...</option>
                  {sectores.map((sector) => (
                    <option key={sector.id} value={sector.id} className="bg-[#1a1e26]">
                      {sector.nombre}{sector.descripcion ? ` (${sector.descripcion})` : ''}
                    </option>
                  ))}
                </select>
                {/* Mostrar descripción del sector seleccionado */}
                {form.sectorId && form.sectorId !== 'otro' && sectores.find(s => s.id === form.sectorId)?.descripcion && (
                  <p className="text-xs text-gray-400 mt-1 px-1">
                    Incluye: {sectores.find(s => s.id === form.sectorId)?.descripcion}
                  </p>
                )}
              </div>

                {/* Sector personalizado */}
                {form.sectorId === 'otro' && (
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm font-medium">Indica tu sector *</Label>
                    <Input
                      name="sectorOtro"
                      type="text"
                      value={form.sectorOtro}
                      onChange={handleChange}
                      required
                      placeholder="Ej: Gimnasio, Veterinaria..."
                      className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                    />
                  </div>
                )}

                {/* Teléfono */}
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">Teléfono *</Label>
                  <Input
                    name="telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={handleChange}
                    required
                    placeholder="600 000 000"
                    autoComplete="tel"
                    className="h-14 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500 text-base"
                  />
                </div>

                <Button 
                  className="w-full h-14 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base rounded-full shadow-lg shadow-[#A2D9F7]/20 transition-all active:scale-[0.98]" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : 'Continuar'}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      );
    }

    // 🖥️ Vista desktop (original)
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
        <WaveBackground isPlaying={true} />
        <div className="w-full max-w-md mx-auto z-10">
          <Card className="p-8 rounded-2xl shadow-2xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/95 backdrop-blur-xl border border-white/5">
            <img
              src="/assets/icono-ondeon.png"
              alt="Logo Ondeón"
              className="h-12 sm:h-14 mb-3"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <StepIndicator />
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold tracking-tight mb-1">{stepTitles[step]}</h2>
              <p className="text-gray-400 text-sm">
                {stepDescriptions[step]}
              </p>
            </div>

            {error && (
              <div className="w-full mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form className="w-full space-y-5" onSubmit={handleCompleteProfile}>
              {/* Nombre: Solo editable si NO es OAuth */}
              {isOAuthUser ? (
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm font-medium">Nombre</Label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-white flex-1">{form.nombre || 'Usuario'}</span>
                    <span className="text-xs text-emerald-400 font-medium">✓ Verificado</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">Nombre completo *</Label>
                  <Input
                    name="nombre"
                    type="text"
                    value={form.nombre}
                    onChange={handleChange}
                    required
                    placeholder="Tu nombre completo"
                    autoComplete="name"
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500"
                  />
                </div>
              )}

              {/* Establecimiento (obligatorio) */}
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm font-medium">Nombre de tu establecimiento *</Label>
                <Input
                  name="establecimiento"
                  type="text"
                  value={form.establecimiento}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Cafetería Central, Farmacia López..."
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500"
                />
              </div>

              {/* Sector */}
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm font-medium">Sector de tu negocio *</Label>
                <select
                  name="sectorId"
                  value={form.sectorId}
                  onChange={handleChange}
                  className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                >
                  <option value="" className="bg-[#1a1e26]">Selecciona un sector...</option>
                  {sectores.map((sector) => (
                    <option key={sector.id} value={sector.id} className="bg-[#1a1e26]">
                      {sector.nombre}{sector.descripcion ? ` (${sector.descripcion})` : ''}
                    </option>
                  ))}
                </select>
                {/* Mostrar descripción del sector seleccionado */}
                {form.sectorId && form.sectorId !== 'otro' && sectores.find(s => s.id === form.sectorId)?.descripcion && (
                  <p className="text-xs text-gray-400 mt-1 px-1">
                    Incluye: {sectores.find(s => s.id === form.sectorId)?.descripcion}
                  </p>
                )}
              </div>

              {/* Campo para sector personalizado si elige "Otro" */}
              {form.sectorId === 'otro' && (
                <div className="space-y-2">
                  <Label className="text-gray-300 text-sm font-medium">Indica tu sector *</Label>
                  <Input
                    name="sectorOtro"
                    type="text"
                    value={form.sectorOtro}
                    onChange={handleChange}
                    required
                    placeholder="Ej: Gimnasio, Veterinaria, Clínica dental..."
                    className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500"
                  />
                </div>
              )}

              {/* Teléfono (obligatorio) */}
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm font-medium">Teléfono *</Label>
                <Input
                  name="telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={handleChange}
                  required
                  placeholder="600 000 000"
                  autoComplete="tel"
                  className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 focus:ring-primary/20 placeholder:text-gray-500"
                />
              </div>

              <div className="pt-2">
                <Button 
                  className="w-full h-12 bg-gradient-to-r from-[#7eb8da] to-[#a8d0e6] hover:from-[#6ba8ca] hover:to-[#98c0d6] text-[#1a1e26] font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-200" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : 'Continuar'}
                </Button>
              </div>
            </form>

            <button
              onClick={() => setStep(1)}
              className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              disabled={loading}
            >
              ← Empezar de nuevo
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
