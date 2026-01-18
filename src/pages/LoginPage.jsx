import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import WaveBackground from '@/components/player/WaveBackground';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
// Ruta post-login simplificada - todos los usuarios van al reproductor
const getPostLoginRoute = () => '/';

export default function LoginPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const { signIn, signInWithUsuarios, signInWithGoogle, signInWithApple, subscriptionRequired, clearSubscriptionRequired } = useAuth();
  
  // Electron ya no está soportado - siempre false
  const isElectron = false;

  // 🔧 NUEVO: Estado para controlar si ya se cargaron las credenciales
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  // 🔧 NUEVO: Estado para detectar si el usuario está escribiendo
  const [userIsTyping, setUserIsTyping] = useState(false);
  
  // 🔐 Estado para el modal de cambio de contraseña
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [userType, setUserType] = useState(null); // 'legacy' | 'supabase' | null
  const [checkingUserType, setCheckingUserType] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    skipCurrentPasswordCheck: false, // Para usuarios legacy que olvidaron su contraseña
  });
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  // 🌙 CRÍTICO: Forzar tema oscuro en la página de login
  useEffect(() => {
    // Guardar el tema actual
    const previousTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    
    // Forzar tema oscuro
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    logger.dev('🌙 Tema oscuro forzado en LoginPage');
    
    // Restaurar el tema original al salir de la página
    return () => {
      if (previousTheme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        logger.dev('☀️ Tema restaurado al salir de LoginPage');
      }
    };
  }, []);

  // 🔑 CRÍTICO: Procesar tokens de OAuth en el hash de la URL
  // Cuando Google/Apple redirige de vuelta, los tokens vienen en #access_token=...
  useEffect(() => {
    const processOAuthTokens = async () => {
      const hash = window.location.hash;
      if (!hash || !hash.includes('access_token')) {
        return; // No hay tokens en la URL
      }

      logger.dev('🔐 [OAuth] Detectados tokens en URL hash');
      setLoading(true);

      try {
        // Extraer tokens del hash
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken) {
          logger.warn('⚠️ [OAuth] No se encontró access_token en hash');
          return;
        }

        logger.dev('🔐 [OAuth] Estableciendo sesión con tokens...');
        
        // Establecer sesión en Supabase
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          logger.error('❌ [OAuth] Error estableciendo sesión:', error);
          setError('Error al iniciar sesión con OAuth. Intenta de nuevo.');
          return;
        }

        if (data?.user) {
          logger.dev('✅ [OAuth] Sesión establecida para:', data.user.email);
          
          // Limpiar el hash de la URL
          window.history.replaceState(null, '', window.location.pathname);
          
          // Verificar si el registro está completo
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('registro_completo, rol_id')
            .eq('auth_user_id', data.user.id)
            .single();
          
          if (userError) {
            logger.warn('⚠️ [OAuth] Error obteniendo datos de usuario:', userError);
          }
          
          // Si el registro no está completo, redirigir a completarlo
          if (!userData?.registro_completo) {
            logger.dev('🔄 [OAuth] Usuario no completó registro, redirigiendo a /registro');
            navigate('/registro?continue=true');
            return;
          }
          
          // Registro completo, redirigir según rol
          const targetRoute = getPostLoginRoute(userData?.rol_id || 2);
          logger.dev('✅ [OAuth] Redirigiendo a:', targetRoute);
          navigate(targetRoute, { replace: true });
        }
      } catch (err) {
        logger.error('❌ [OAuth] Error procesando tokens:', err);
        setError('Error procesando autenticación. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    processOAuthTokens();
  }, [navigate]);

  // Cargar credenciales guardadas al iniciar - SOLO UNA VEZ
  useEffect(() => {
    if (credentialsLoaded) return; // Evitar ejecuciones múltiples

    const loadSavedCredentials = async () => {
      try {
        logger.dev('🔍 Intentando cargar credenciales guardadas...');
        const savedCredentials = await getCredentials();
        logger.dev('🔍 Credenciales obtenidas:', savedCredentials ? 'SÍ' : 'NO', savedCredentials);
        
        if (savedCredentials && !userIsTyping) {
          // 🔧 NUEVO: Solo prerellenar si el usuario NO está escribiendo
          setForm({
            email: savedCredentials.username || '',
            password: savedCredentials.password || ''
          });
          setRememberMe(true);
          logger.dev('✅ Credenciales recuperadas y campos prerellenados:', {
            username: savedCredentials.username,
            hasPassword: !!savedCredentials.password
          });
          
          // 🔧 CORREGIDO: Solo prerellenar campos, NO hacer auto-login
          // El usuario debe hacer clic en "Iniciar sesión" manualmente
          logger.dev('ℹ️ Campos prerellenados - esperando acción del usuario');
        } else if (userIsTyping) {
          logger.dev('ℹ️ Usuario escribiendo - no sobrescribir campos');
        } else if (!savedCredentials) {
          logger.dev('ℹ️ No hay credenciales guardadas - campos vacíos');
        }
        setCredentialsLoaded(true); // Marcar como cargadas
      } catch (error) {
        logger.error('Error cargando credenciales:', error);
        setCredentialsLoaded(true); // Marcar como intentadas aunque fallen
      }
    };

    loadSavedCredentials();
  }, []); // 🔧 CORREGIDO: Sin dependencias para ejecutar solo una vez

  const handleChange = (e) => {
    // 🔧 NUEVO: Marcar que el usuario está escribiendo
    setUserIsTyping(true);
    setForm({ ...form, [e.target.name]: e.target.value });
    
    // 🔧 NUEVO: Log para debugging (se puede quitar después)
    logger.dev('📝 Usuario escribiendo en campo:', e.target.name, 'Valor:', e.target.value);
  };

  // 🔧 NUEVO: Función para limpiar campos si el usuario lo desea
  const handleClearFields = () => {
    setForm({ email: '', password: '' });
    setUserIsTyping(true);
    setRememberMe(false);
    logger.dev('🧹 Campos limpiados por el usuario');
  };

  // 🔧 ELIMINADO: Función handleAutoLogin ya no es necesaria
  // El login solo ocurre cuando el usuario hace clic en "Iniciar sesión"

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    
    try {
      // Primero intentar login legacy con tabla usuarios
      try {
        const userData = await signInWithUsuarios(form.email, form.password);
        logger.dev('✅ Login legacy exitoso');
        
        
        // Guardar credenciales si el usuario lo solicita
        if (rememberMe) {
          logger.dev('💾 Intentando guardar credenciales (legacy)...', {
            rememberMe,
            email: form.email,
            hasPassword: !!form.password,
            isElectron
          });
          
          const saveResult = await saveCredentials(form.email, form.password);
          logger.dev('💾 Resultado del guardado (legacy):', saveResult);
          
          // Verificar que se guardaron correctamente
          const testCredentials = await getCredentials();
          logger.dev('🔍 Verificación inmediata de credenciales guardadas (legacy):', testCredentials);
          
          if (testCredentials) {
            logger.dev('✅ Credenciales guardadas y verificadas correctamente (legacy)');
          } else {
            logger.error('❌ ERROR: Las credenciales no se guardaron correctamente (legacy)');
          }
          
          // Configurar auto-inicio en Windows
          if (isElectron) {
            await setAutoStartEnabled(true);
            logger.dev('✅ Auto-inicio configurado');
          }
        } else {
          logger.dev('ℹ️ RememberMe NO marcado - no guardando credenciales (legacy)');
        }
        
        // 🌐 Navegar según rol y plataforma
        const userRoleId = userData?.rol_id || userData?.role_id || ROLES.BASICO;
        const targetRoute = getPostLoginRoute(userRoleId);
        logger.dev('🧭 Navegando a:', targetRoute, '(rol_id:', userRoleId, ', isWeb:', getIsWebPlatform(), ')');
        navigate(targetRoute);
        return;
      } catch (legacyError) {
        logger.dev('❌ Login legacy falló, intentando Supabase:', legacyError.message);
        
        // Si falla el login legacy, intentar con Supabase Auth
        const supabaseData = await signIn(form.email, form.password);
        logger.dev('✅ Login Supabase exitoso', supabaseData);
        
        // 🔑 CRÍTICO: Obtener el usuario de la sesión actual si supabaseData no tiene user
        const authUserId = supabaseData?.user?.id || supabaseData?.session?.user?.id;
        
        if (!authUserId) {
          // Si no hay user en supabaseData, obtener de la sesión actual
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) {
            throw new Error('No se pudo obtener el usuario autenticado');
          }
          logger.dev('📌 Usuario obtenido de sesión actual:', currentUser.id);
          
          // Verificar datos del usuario
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('registro_completo, rol_id')
            .eq('auth_user_id', currentUser.id)
            .single();
          
          if (userError) {
            logger.warn('⚠️ Error obteniendo datos de usuario:', userError);
          }
          
          if (!userData?.registro_completo) {
            logger.dev('🔄 Usuario no completó registro, redirigiendo a /registro');
            navigate('/registro?continue=true');
            return;
          }
          
          const userRoleId = userData?.rol_id || currentUser?.user_metadata?.rol_id || ROLES.GESTOR;
          const targetRoute = getPostLoginRoute(userRoleId);
          logger.dev('🧭 Navegando a:', targetRoute);
          navigate(targetRoute);
          return;
        }
        
        // 🔑 CRÍTICO: Verificar si el usuario completó el registro
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('registro_completo, rol_id')
          .eq('auth_user_id', authUserId)
          .single();
        
        if (userError) {
          logger.warn('⚠️ Error obteniendo datos de usuario:', userError);
        }
        
        // Si el usuario no completó el registro, redirigir a completar onboarding
        if (!userData?.registro_completo) {
          logger.dev('🔄 Usuario no completó registro, redirigiendo a /registro');
          navigate('/registro?continue=true');
          return;
        }
        
        // Guardar credenciales si el usuario lo solicita
        if (rememberMe) {
          logger.dev('💾 Intentando guardar credenciales (Supabase)...', {
            rememberMe,
            email: form.email,
            hasPassword: !!form.password,
            isElectron
          });
          
          const saveResult = await saveCredentials(form.email, form.password);
          logger.dev('💾 Resultado del guardado (Supabase):', saveResult);
          
          // Verificar que se guardaron correctamente
          const testCredentials = await getCredentials();
          logger.dev('🔍 Verificación inmediata de credenciales guardadas (Supabase):', testCredentials);
          
          if (testCredentials) {
            logger.dev('✅ Credenciales guardadas y verificadas correctamente (Supabase)');
          } else {
            logger.error('❌ ERROR: Las credenciales no se guardaron correctamente (Supabase)');
          }
          
          // Configurar auto-inicio en Windows
          if (isElectron) {
            await setAutoStartEnabled(true);
            logger.dev('✅ Auto-inicio configurado');
          }
        } else {
          logger.dev('ℹ️ RememberMe NO marcado - no guardando credenciales (Supabase)');
        }
        
        // 🌐 Usuario con registro completo - navegar según rol y plataforma
        const userRoleId = userData?.rol_id || supabaseData?.user?.user_metadata?.rol_id || ROLES.GESTOR;
        const targetRoute = getPostLoginRoute(userRoleId);
        logger.dev('🧭 Navegando a:', targetRoute, '(rol_id:', userRoleId, ', isWeb:', getIsWebPlatform(), ')');
        navigate(targetRoute);
        return;
      }
    } catch (err) {
      logger.error('Error en login:', err);
      
      
      if (err.message.includes('Invalid login credentials')) {
        setError(t('auth.invalidCredentials'));
      } else if (err.message.includes('Email not confirmed')) {
        setError(t('auth.emailNotConfirmed'));
      } else {
        setError(t('auth.loginError') + ': ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔐 Estado para código OAuth manual (desarrollo)
  const [showOAuthCodeInput, setShowOAuthCodeInput] = useState(false);
  const [oauthCode, setOauthCode] = useState('');
  const [waitingForWebRegistration, setWaitingForWebRegistration] = useState(false);

  // 🔐 Función para procesar tokens OAuth
  const handleOAuthTokens = async (tokens) => {
    logger.dev('🔐 [OAuth] Tokens recibidos');
    setLoading(true);
    setError('');

    try {
      // Establecer la sesión con los tokens recibidos
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });

      if (error) throw error;

      logger.dev('🔐 [OAuth] Sesión establecida exitosamente');
      logger.dev('🔐 [OAuth] Usuario ID:', data.user?.id, 'Email:', data.user?.email);
      setShowOAuthCodeInput(false);
      
      // Esperar un momento para que la sesión se propague correctamente
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 🔑 CRÍTICO: Verificar si el usuario completó el registro
      // Usar maybeSingle() en lugar de single() para evitar error 406
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('registro_completo, rol_id')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      
      logger.dev('🔐 [OAuth] Datos de usuario:', { userData, userError: userError?.message });
      
      if (userError) {
        logger.warn('⚠️ [OAuth] Error obteniendo datos de usuario:', userError);
      }
      
      // Si el usuario no completó el registro, redirigir a completar onboarding
      if (!userData?.registro_completo) {
        logger.dev('🔄 [OAuth] Usuario no completó registro');
        
        // 🌐 En Electron, abrir el registro en el NAVEGADOR (para checkout de Stripe)
        if (isElectron) {
          logger.dev('🌐 [OAuth] Abriendo registro en navegador externo...');
          const isDev = import.meta.env.DEV;
          const provider = data.user?.app_metadata?.provider || 'oauth';
          const registerUrl = isDev 
            ? `http://localhost:5173/registro?continue=true&from=electron&provider=${provider}`
            : `https://main.dnpo8nagdov1i.amplifyapp.com/registro?continue=true&from=electron&provider=${provider}`;
          
          setError('');
          setLoading(false);
          
          // Mostrar pantalla de espera en Electron
          setWaitingForWebRegistration(true);
          
          // Abrir en navegador externo
          window.electronAPI?.openExternal(registerUrl);
          
          // NO hacer signOut aquí - el usuario deberá autenticarse de nuevo en el navegador
          // porque la sesión de Electron no se comparte con el navegador
          
          return;
        }
        
        // En web, navegar normalmente
        navigate('/registro?continue=true');
        return;
      }
      
      // 🌐 Usuario con registro completo - navegar según rol y plataforma
      const userRoleId = userData?.rol_id || data?.user?.user_metadata?.rol_id || ROLES.GESTOR;
      const targetRoute = getPostLoginRoute(userRoleId);
      logger.dev('🧭 [OAuth] Navegando a:', targetRoute, '(rol_id:', userRoleId, ')');
      navigate(targetRoute);
    } catch (err) {
      logger.error('🔐 [OAuth] Error estableciendo sesión:', err);
      setError('Error al completar la autenticación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔐 Procesar código OAuth manual (para desarrollo)
  const handleOAuthCodeSubmit = async () => {
    if (!oauthCode.trim()) return;
    
    try {
      setLoading(true);
      const decoded = JSON.parse(atob(oauthCode.trim()));
      if (decoded.a && decoded.r) {
        await handleOAuthTokens({
          access_token: decoded.a,
          refresh_token: decoded.r,
        });
      } else {
        throw new Error('Código inválido');
      }
    } catch (err) {
      logger.error('🔐 [OAuth] Error procesando código:', err);
      setError('Código de autenticación inválido. Copia el código completo de la página web.');
    } finally {
      setLoading(false);
    }
  };

  // 🔐 Escuchar OAuth callback desde Electron (deep link)
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onOAuthCallback) return;

    logger.dev('🔐 [OAuth] Configurando listener para deep links...');

    // Listener para deep links de Electron
    window.electronAPI.onOAuthCallback(handleOAuthTokens);

    // Fallback: listener para postMessage (método manual de copia/pega)
    const handlePostMessage = (event) => {
      if (event.data?.type === 'OAUTH_TOKENS' && event.data?.tokens) {
        logger.dev('🔐 [OAuth] Tokens recibidos via postMessage');
        handleOAuthTokens(event.data.tokens);
      }
    };
    window.addEventListener('message', handlePostMessage);

    // Cleanup
    return () => {
      if (window.electronAPI?.removeOAuthCallback) {
        window.electronAPI.removeOAuthCallback();
      }
      window.removeEventListener('message', handlePostMessage);
    };
  }, [isElectron, navigate]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    
    try {
      if (isElectron && window.electronAPI?.startOAuth) {
        // En Electron: abrir navegador con flujo OAuth
        logger.dev('🔐 [OAuth] Iniciando flujo Google en Electron...');
        const result = await window.electronAPI.startOAuth('google');
        if (!result.success) {
          throw new Error(result.error || 'Error iniciando OAuth');
        }
        // El loading se mantendrá hasta que llegue el callback
        // Mostrar mensaje al usuario
        logger.dev('🔐 [OAuth] Navegador abierto, esperando autenticación...');
      } else {
        // En web: usar flujo normal de Supabase
        await signInWithGoogle();
      }
    } catch (err) {
      logger.error('Error con Google:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(t('auth.googleError') + ': ' + err.message);
      }
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      if (isElectron && window.electronAPI?.startOAuth) {
        // En Electron: abrir navegador con flujo OAuth
        logger.dev('🔐 [OAuth] Iniciando flujo Apple en Electron...');
        const result = await window.electronAPI.startOAuth('apple');
        if (!result.success) {
          throw new Error(result.error || 'Error iniciando OAuth');
        }
        logger.dev('🔐 [OAuth] Navegador abierto, esperando autenticación...');
      } else {
        // En web: usar flujo normal de Supabase
        await signInWithApple();
      }
    } catch (err) {
      logger.error('Error con Apple:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(t('auth.appleError') + ': ' + err.message);
      }
      setLoading(false);
    }
  };

  // 🔐 Funciones para el modal de cambio de contraseña
  const handleOpenChangePasswordModal = async (e) => {
    e.preventDefault();
    setCheckingUserType(true);
    setChangePasswordError('');
    setChangePasswordSuccess('');
    setUserType(null);
    
    const identifier = form.email || '';
    
    // Prellenar campos
    setChangePasswordForm({
      username: identifier,
      email: identifier,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      skipCurrentPasswordCheck: false,
    });
    
    // Intentar detectar el tipo de usuario
    try {
      // Primero intentar verificar si es usuario legacy
      const { data: legacyUser, error: legacyError } = await supabase
        .from('usuarios')
        .select('id, username')
        .eq('username', identifier)
        .maybeSingle();
      
      if (legacyUser && !legacyError) {
        setUserType('legacy');
        logger.dev('✅ Usuario legacy detectado');
      } else if (identifier.includes('@')) {
        // Si es un email, podría ser Supabase Auth
        // Por ahora, permitir que el usuario elija o asumir Supabase Auth
        setUserType('supabase');
        logger.dev('✅ Asumiendo usuario Supabase Auth (es email)');
      } else {
        // Si no es email, asumir legacy
        setUserType('legacy');
        logger.dev('✅ Asumiendo usuario legacy (no es email)');
      }
    } catch (error) {
      logger.error('Error detectando tipo de usuario:', error);
      // Por defecto, asumir legacy
      setUserType('legacy');
    } finally {
      setCheckingUserType(false);
      setShowChangePasswordModal(true);
    }
  };

  const handleCloseChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setUserType(null);
    setChangePasswordForm({
      username: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      skipCurrentPasswordCheck: false,
    });
    setChangePasswordError('');
    setChangePasswordSuccess('');
  };

  const handleChangePasswordFormChange = (e) => {
    setChangePasswordForm({ ...changePasswordForm, [e.target.name]: e.target.value });
    // Limpiar mensajes al escribir
    if (changePasswordError) setChangePasswordError('');
    if (changePasswordSuccess) setChangePasswordSuccess('');
  };

  const validateChangePasswordForm = () => {
    if (userType === 'supabase') {
      // Validación para Supabase Auth
      if (!changePasswordForm.email || !changePasswordForm.email.includes('@')) {
        setChangePasswordError(t('password.email'));
        return false;
      }
      return true; // Para Supabase Auth, solo necesitamos el email
    } else {
      // Validación para usuarios legacy
      if (!changePasswordForm.username) {
        setChangePasswordError(t('password.username'));
        return false;
      }

      if (!changePasswordForm.skipCurrentPasswordCheck && !changePasswordForm.currentPassword) {
        setChangePasswordError(t('password.currentPassword'));
        return false;
      }

      if (!changePasswordForm.newPassword) {
        setChangePasswordError(t('password.newPassword'));
        return false;
      }

      if (changePasswordForm.newPassword.length < 6) {
        setChangePasswordError(t('password.passwordMinLength'));
        return false;
      }

      if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
        setChangePasswordError(t('password.passwordsDoNotMatch'));
        return false;
      }

      if (changePasswordForm.currentPassword && changePasswordForm.currentPassword === changePasswordForm.newPassword) {
        setChangePasswordError(t('password.passwordMustBeDifferent'));
        return false;
      }

      return true;
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
    
    if (!validateChangePasswordForm()) {
      return;
    }

    setChangePasswordLoading(true);
    
    try {
      if (userType === 'supabase') {
        // Flujo para usuarios de Supabase Auth
        logger.dev('🔐 Enviando email de recuperación para usuario Supabase Auth:', changePasswordForm.email);
        
        const { error } = await supabase.auth.resetPasswordForEmail(changePasswordForm.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
          throw error;
        }

        logger.dev('✅ Email de recuperación enviado exitosamente');
        setChangePasswordSuccess(t('password.recoveryEmailSent'));
        
        // Cerrar modal después de 3 segundos
        setTimeout(() => {
          handleCloseChangePasswordModal();
        }, 3000);
        
      } else {
        // Flujo para usuarios legacy
        logger.dev('🔐 Cambiando contraseña para usuario legacy:', changePasswordForm.username);
        
        await authApi.changePasswordLegacyEdge(
          changePasswordForm.username,
          changePasswordForm.currentPassword || null,
          changePasswordForm.newPassword,
          changePasswordForm.skipCurrentPasswordCheck
        );

        logger.dev('✅ Contraseña cambiada exitosamente');
        
        setChangePasswordSuccess(t('password.passwordChanged'));
        
        // Limpiar formulario después de 2 segundos y cerrar modal
        setTimeout(() => {
          handleCloseChangePasswordModal();
          // Actualizar el campo password del formulario principal si el username coincide
          if (form.email === changePasswordForm.username) {
            setForm({ ...form, password: '' });
          }
        }, 2000);
      }
      
    } catch (err) {
      logger.error('❌ Error al cambiar contraseña:', err);
      if (userType === 'supabase') {
        setChangePasswordError(err.message || t('password.recoveryEmailSent'));
      } else {
        setChangePasswordError(err.message || t('password.passwordChanged'));
      }
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // 🌐 Pantalla de espera mientras el usuario completa el registro en el navegador
  if (waitingForWebRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-2">
        <WaveBackground isPlaying={false} />
        <div className="w-full max-w-md mx-auto z-10">
          <Card className="p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/90 backdrop-blur-md">
            <img 
              src={`${import.meta.env.BASE_URL || ''}assets/icono-ondeon.png`} 
              alt="Logo Ondeón" 
              className="h-12 sm:h-14 mb-4"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-2">
              Completa tu registro
            </h2>
            
            <p className="text-center text-muted-foreground mb-6 text-sm">
              Se ha abierto el navegador para que completes tu registro y actives tu suscripción.
            </p>
            
            <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <p className="text-blue-400 text-sm text-center">
                💡 Una vez completado el registro, vuelve aquí e inicia sesión nuevamente.
              </p>
            </div>
            
            <button
              onClick={() => setWaitingForWebRegistration(false)}
              className="w-full h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-[#00A7B5] to-[#00C9B7] hover:opacity-90 text-white transition-all"
            >
              Volver a iniciar sesión
            </button>
            
            <button
              onClick={() => {
                const isDev = import.meta.env.DEV;
                const registerUrl = isDev 
                  ? 'http://localhost:5173/registro?continue=true'
                  : 'https://main.dnpo8nagdov1i.amplifyapp.com/registro?continue=true';
                window.electronAPI?.openExternal(registerUrl);
              }}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Abrir navegador de nuevo
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-2">
      <WaveBackground isPlaying={true} />
      <div className="w-full max-w-md mx-auto z-10">
        <Card className="p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/90 backdrop-blur-md">
          <img 
            src={`${import.meta.env.BASE_URL || ''}assets/icono-ondeon.png`} 
            alt="Logo Ondeón" 
            className="h-12 sm:h-14 mb-2"
            onError={(e) => {
              console.error('Error al cargar el logo en LoginPage');
              e.target.style.display = 'none';
            }}
          />
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-1">{t('auth.login')}</h2>
          <p className="text-center text-gray-700 mb-4 text-sm sm:text-base">
            {t('auth.noAccount')}{' '}
            {isElectron ? (
              // En Electron (app desktop), abrir navegador con URL según entorno
              <button
                type="button"
                onClick={() => {
                  const isDev = import.meta.env.DEV;
                  const registerUrl = isDev 
                    ? 'http://localhost:5173/registro'
                    : 'https://main.dnpo8nagdov1i.amplifyapp.com/registro';
                  window.electronAPI?.openExternal(registerUrl);
                }}
                className="underline text-primary hover:text-primary/80 transition-colors"
              >
                {t('auth.register')}
              </button>
            ) : (
              // En web/local, navegar a la ruta interna
              <Link to="/registro" className="underline text-primary hover:text-primary/80 transition-colors">
                {t('auth.register')}
              </Link>
            )}
          </p>
          {/* 🔒 Banner de suscripción requerida */}
          {subscriptionRequired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative mb-6 overflow-hidden"
            >
              <div className="relative rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent backdrop-blur-sm shadow-lg">
                {/* Efecto de brillo sutil */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent" />
                
                <div className="relative p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white mb-1.5 tracking-tight">
                        Suscripción requerida
                      </h3>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        Para usar el reproductor necesitas una suscripción activa. Hemos abierto tu panel de gestión en el navegador donde puedes renovarla.
                      </p>
                      
                      <button 
                        onClick={clearSubscriptionRequired}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors group"
                      >
                        <span className="underline decoration-amber-400/50 group-hover:decoration-amber-300">
                          Cerrar mensaje
                        </span>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Borde decorativo inferior */}
                <div className="h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />
              </div>
            </motion.div>
          )}
          {error && <div className="text-red-600 text-xs mb-2 text-center">{error}</div>}
          <form className="w-full flex flex-col gap-4 mt-2" onSubmit={handleSubmit}>
            <div>
              <Label>{t('auth.email')}</Label>
              <Input 
                name="email" 
                type="text" 
                value={form.email} 
                onChange={handleChange} 
                required 
                disabled={loading}
              />
            </div>
            <div className="relative">
              <Label>{t('auth.password')}</Label>
              <Input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="absolute right-2 top-8 text-xs text-gray-500 hover:text-primary"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                disabled={loading}
              >
                {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              </button>
            </div>
            
            {/* Checkbox para recordar credenciales - Solo en Electron */}
            {isElectron && (
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="rememberMe" className="text-xs text-gray-600">
                  {t('auth.rememberCredentials')}
                </label>
              </div>
            )}
            
            <button
              type="button"
              onClick={handleOpenChangePasswordModal}
              className="text-xs text-primary underline mb-2 self-end hover:text-primary/80 transition-colors"
            >
              {t('auth.forgotPassword')}
            </button>
            <Button 
              className="w-full bg-black text-white text-sm sm:text-base py-2 sm:py-2.5" 
              type="submit"
              disabled={loading}
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
          <div className="w-full flex flex-col gap-3 mt-4">
            <Button
              className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-card text-black text-sm sm:text-base py-2 sm:py-2.5"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <FcGoogle size={20} /> {t('auth.continueWithGoogle')}
            </Button>
            <Button
              className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-black text-white text-sm sm:text-base py-2 sm:py-2.5"
              onClick={handleAppleLogin}
              disabled={loading}
            >
              <FaApple size={20} /> {t('auth.continueWithApple')}
            </Button>
          </div>
        </Card>
      </div>

      {/* 🔐 Modal de Cambio de Contraseña */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background rounded-xl shadow-2xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">
                      {userType === 'supabase' ? t('password.recoverPassword') : t('password.changePassword')}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userType === 'supabase' 
                        ? t('password.passwordRecoveryInstructions')
                        : checkingUserType 
                          ? t('password.detectingUserType')
                          : t('password.enterCurrentPassword')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseChangePasswordModal}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {checkingUserType && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">{t('password.detectingUserType')}</p>
                  </div>
                )}

                {!checkingUserType && (
                  <>
                    {changePasswordError && (
                      <Alert variant="destructive" className="mb-4">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>{changePasswordError}</AlertDescription>
                      </Alert>
                    )}

                    {changePasswordSuccess && (
                      <Alert className="mb-4 border-green-500 bg-green-50 dark:bg-green-900/20">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                          {changePasswordSuccess}
                        </AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                      {userType === 'supabase' ? (
                        // Formulario para usuarios de Supabase Auth
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="changePasswordEmail">{t('password.email')}</Label>
                            <Input
                              id="changePasswordEmail"
                              name="email"
                              type="email"
                              value={changePasswordForm.email}
                              onChange={handleChangePasswordFormChange}
                              required
                              disabled={changePasswordLoading}
                              placeholder="tu@email.com"
                              className="w-full"
                            />
                            <p className="text-xs text-muted-foreground">
                              {t('password.passwordRecoveryInstructions')}
                            </p>
                          </div>
                        </>
                      ) : (
                        // Formulario para usuarios legacy
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="changePasswordUsername">{t('password.username')}</Label>
                            <Input
                              id="changePasswordUsername"
                              name="username"
                              type="text"
                              value={changePasswordForm.username}
                              onChange={handleChangePasswordFormChange}
                              required
                              disabled={changePasswordLoading}
                              placeholder={t('password.username')}
                              className="w-full"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="changePasswordCurrent">{t('password.currentPassword')}</Label>
                            <Input
                              id="changePasswordCurrent"
                              name="currentPassword"
                              type="password"
                              value={changePasswordForm.currentPassword}
                              onChange={handleChangePasswordFormChange}
                              required={!changePasswordForm.skipCurrentPasswordCheck}
                              disabled={changePasswordLoading || changePasswordForm.skipCurrentPasswordCheck}
                              placeholder={changePasswordForm.skipCurrentPasswordCheck ? t('password.currentPassword') : t('password.currentPassword')}
                              className="w-full"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="skipCurrentPasswordCheck"
                              name="skipCurrentPasswordCheck"
                              checked={changePasswordForm.skipCurrentPasswordCheck}
                              onChange={(e) => {
                                setChangePasswordForm({
                                  ...changePasswordForm,
                                  skipCurrentPasswordCheck: e.target.checked,
                                  currentPassword: e.target.checked ? '' : changePasswordForm.currentPassword
                                });
                              }}
                              disabled={changePasswordLoading}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor="skipCurrentPasswordCheck" className="text-xs text-muted-foreground">
                              {t('password.forgotCurrentPassword')}
                            </label>
                          </div>

                          {changePasswordForm.skipCurrentPasswordCheck && (
                            <Alert variant="destructive" className="mb-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                <strong>{t('common.error')}:</strong> {t('password.skipPasswordWarning')}
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="changePasswordNew">{t('password.newPassword')}</Label>
                            <Input
                              id="changePasswordNew"
                              name="newPassword"
                              type="password"
                              value={changePasswordForm.newPassword}
                              onChange={handleChangePasswordFormChange}
                              required
                              disabled={changePasswordLoading}
                              placeholder={t('password.passwordMinLength')}
                              className="w-full"
                              minLength={6}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t('password.passwordMinLength')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="changePasswordConfirm">{t('password.confirmPassword')}</Label>
                            <Input
                              id="changePasswordConfirm"
                              name="confirmPassword"
                              type="password"
                              value={changePasswordForm.confirmPassword}
                              onChange={handleChangePasswordFormChange}
                              required
                              disabled={changePasswordLoading}
                              placeholder={t('password.confirmPassword')}
                              className="w-full"
                            />
                          </div>
                        </>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={handleCloseChangePasswordModal}
                          disabled={changePasswordLoading}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={changePasswordLoading}
                        >
                          {changePasswordLoading 
                            ? (userType === 'supabase' ? t('password.sending') : t('password.changing')) 
                            : (userType === 'supabase' ? t('password.sendEmail') : t('password.changePasswordButton'))}
                        </Button>
                      </div>
                    </form>

                    <div className="mt-4 pt-4 border-t">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs text-muted-foreground">
                          {userType === 'supabase' ? (
                            <>
                              <strong>{t('password.supabaseUserInfo')}</strong>
                            </>
                          ) : (
                            <>
                              <strong>{t('password.legacyUserInfo')}</strong>
                            </>
                          )}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 