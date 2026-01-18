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
  const navigate = useNavigate();
  const { signIn, signInWithUsuarios, signInWithGoogle, signInWithApple, subscriptionRequired, clearSubscriptionRequired } = useAuth();
  
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
    skipCurrentPasswordCheck: false,
  });
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  // 🌙 CRÍTICO: Forzar tema oscuro en la página de login
  useEffect(() => {
    const previousTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    logger.dev('🌙 Tema oscuro forzado en LoginPage');
    
    return () => {
      if (previousTheme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        logger.dev('☀️ Tema restaurado al salir de LoginPage');
      }
    };
  }, []);

  // 🔑 CRÍTICO: Procesar tokens de OAuth en el hash de la URL
  useEffect(() => {
    const processOAuthTokens = async () => {
      const hash = window.location.hash;
      if (!hash || !hash.includes('access_token')) {
        return;
      }

      logger.dev('🔐 [OAuth] Detectados tokens en URL hash');
      setLoading(true);

      try {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken) {
          logger.warn('⚠️ [OAuth] No se encontró access_token en hash');
          return;
        }

        logger.dev('🔐 [OAuth] Estableciendo sesión con tokens...');
        
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
          
          window.history.replaceState(null, '', window.location.pathname);
          
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('registro_completo, rol_id')
            .eq('auth_user_id', data.user.id)
            .single();
          
          if (userError) {
            logger.warn('⚠️ [OAuth] Error obteniendo datos de usuario:', userError);
          }
          
          if (!userData?.registro_completo) {
            logger.dev('🔄 [OAuth] Usuario no completó registro, redirigiendo a /registro');
            navigate('/registro?continue=true');
            return;
          }
          
          const targetRoute = getPostLoginRoute();
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Primero intentar login legacy con tabla usuarios
      try {
        const userData = await signInWithUsuarios(form.email, form.password);
        logger.dev('✅ Login legacy exitoso');
        
        const targetRoute = getPostLoginRoute();
        logger.dev('🧭 Navegando a:', targetRoute);
        navigate(targetRoute);
        return;
      } catch (legacyError) {
        logger.dev('❌ Login legacy falló, intentando Supabase:', legacyError.message);
        
        const supabaseData = await signIn(form.email, form.password);
        logger.dev('✅ Login Supabase exitoso', supabaseData);
        
        const authUserId = supabaseData?.user?.id || supabaseData?.session?.user?.id;
        
        if (!authUserId) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) {
            throw new Error('No se pudo obtener el usuario autenticado');
          }
          logger.dev('📌 Usuario obtenido de sesión actual:', currentUser.id);
          
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
          
          const targetRoute = getPostLoginRoute();
          logger.dev('🧭 Navegando a:', targetRoute);
          navigate(targetRoute);
          return;
        }
        
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('registro_completo, rol_id')
          .eq('auth_user_id', authUserId)
          .single();
        
        if (userError) {
          logger.warn('⚠️ Error obteniendo datos de usuario:', userError);
        }
        
        if (!userData?.registro_completo) {
          logger.dev('🔄 Usuario no completó registro, redirigiendo a /registro');
          navigate('/registro?continue=true');
          return;
        }
        
        const targetRoute = getPostLoginRoute();
        logger.dev('🧭 Navegando a:', targetRoute);
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

  // 🔐 Función para procesar tokens OAuth
  const handleOAuthTokens = async (tokens) => {
    logger.dev('🔐 [OAuth] Tokens recibidos');
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });

      if (error) throw error;

      logger.dev('🔐 [OAuth] Sesión establecida exitosamente');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('registro_completo, rol_id')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      
      logger.dev('🔐 [OAuth] Datos de usuario:', { userData, userError: userError?.message });
      
      if (userError) {
        logger.warn('⚠️ [OAuth] Error obteniendo datos de usuario:', userError);
      }
      
      if (!userData?.registro_completo) {
        logger.dev('🔄 [OAuth] Usuario no completó registro');
        navigate('/registro?continue=true');
        return;
      }
      
      const targetRoute = getPostLoginRoute();
      logger.dev('🧭 [OAuth] Navegando a:', targetRoute);
      navigate(targetRoute);
    } catch (err) {
      logger.error('🔐 [OAuth] Error estableciendo sesión:', err);
      setError('Error al completar la autenticación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      await signInWithGoogle();
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
      await signInWithApple();
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
    
    setChangePasswordForm({
      username: identifier,
      email: identifier,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      skipCurrentPasswordCheck: false,
    });
    
    try {
      const { data: legacyUser, error: legacyError } = await supabase
        .from('usuarios')
        .select('id, username')
        .eq('username', identifier)
        .maybeSingle();
      
      if (legacyUser && !legacyError) {
        setUserType('legacy');
        logger.dev('✅ Usuario legacy detectado');
      } else if (identifier.includes('@')) {
        setUserType('supabase');
        logger.dev('✅ Asumiendo usuario Supabase Auth (es email)');
      } else {
        setUserType('legacy');
        logger.dev('✅ Asumiendo usuario legacy (no es email)');
      }
    } catch (error) {
      logger.error('Error detectando tipo de usuario:', error);
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
    if (changePasswordError) setChangePasswordError('');
    if (changePasswordSuccess) setChangePasswordSuccess('');
  };

  const validateChangePasswordForm = () => {
    if (userType === 'supabase') {
      if (!changePasswordForm.email || !changePasswordForm.email.includes('@')) {
        setChangePasswordError(t('password.email'));
        return false;
      }
      return true;
    } else {
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
        logger.dev('🔐 Enviando email de recuperación para usuario Supabase Auth:', changePasswordForm.email);
        
        const { error } = await supabase.auth.resetPasswordForEmail(changePasswordForm.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
          throw error;
        }

        logger.dev('✅ Email de recuperación enviado exitosamente');
        setChangePasswordSuccess(t('password.recoveryEmailSent'));
        
        setTimeout(() => {
          handleCloseChangePasswordModal();
        }, 3000);
        
      } else {
        logger.dev('🔐 Cambiando contraseña para usuario legacy:', changePasswordForm.username);
        
        await authApi.changePasswordLegacyEdge(
          changePasswordForm.username,
          changePasswordForm.currentPassword || null,
          changePasswordForm.newPassword,
          changePasswordForm.skipCurrentPasswordCheck
        );

        logger.dev('✅ Contraseña cambiada exitosamente');
        
        setChangePasswordSuccess(t('password.passwordChanged'));
        
        setTimeout(() => {
          handleCloseChangePasswordModal();
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
            <Link to="/registro" className="underline text-primary hover:text-primary/80 transition-colors">
              {t('auth.register')}
            </Link>
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
                              placeholder={t('password.currentPassword')}
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
                            <strong>{t('password.supabaseUserInfo')}</strong>
                          ) : (
                            <strong>{t('password.legacyUserInfo')}</strong>
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
