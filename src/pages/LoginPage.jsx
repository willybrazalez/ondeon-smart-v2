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
  const { signIn, signInWithGoogle, signInWithApple, subscriptionRequired, clearSubscriptionRequired } = useAuth();
  
  // 🔐 Estado para el modal de recuperación de contraseña (solo email)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
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

  // 🔑 CRÍTICO: Detectar usuarios autenticados y redirigir según estado de registro
  // Esto soluciona el caso donde OAuth completa pero el usuario no está registrado en la BD
  useEffect(() => {
    const checkAuthenticatedUser = async () => {
      // No hacer nada si estamos procesando tokens OAuth (el otro useEffect lo maneja)
      if (window.location.hash?.includes('access_token')) return;
      
      // No hacer nada si ya estamos en proceso de carga
      if (loading) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          logger.dev('🔐 [LoginPage] Usuario ya autenticado detectado:', session.user.email);
          
          // 🔐 SEGURIDAD: Verificar primero si el email está confirmado
          if (!session.user.email_confirmed_at) {
            logger.dev('📧 [LoginPage] Email NO verificado, redirigiendo a verificación');
            navigate('/registro?continue=true&verify=true');
            return;
          }
          
          // Verificar estado de registro en la BD
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('registro_completo')
            .eq('auth_user_id', session.user.id)
            .maybeSingle();
          
          if (userError) {
            logger.warn('⚠️ [LoginPage] Error verificando usuario:', userError);
          }
          
          if (!userData?.registro_completo) {
            // Usuario autenticado pero sin registro completo -> ir a registro
            logger.dev('🔄 [LoginPage] Usuario sin registro completo, redirigiendo a /registro');
            navigate('/registro?continue=true');
          } else {
            // Usuario con registro completo -> ir al reproductor
            logger.dev('✅ [LoginPage] Usuario con registro completo, redirigiendo a home');
            navigate(getPostLoginRoute(), { replace: true });
          }
        }
      } catch (err) {
        logger.error('❌ [LoginPage] Error verificando sesión:', err);
      }
    };
    
    checkAuthenticatedUser();
  }, [navigate, loading]);

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
          
          // 🔐 SEGURIDAD: Verificar primero si el email está confirmado
          // Nota: OAuth providers (Google, Apple) siempre tienen email verificado
          if (!data.user.email_confirmed_at) {
            logger.dev('📧 [OAuth] Email NO verificado, redirigiendo a verificación');
            navigate('/registro?continue=true&verify=true');
            return;
          }
          
          // 🔑 Usar maybeSingle() para evitar error cuando el usuario no existe en la BD
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('registro_completo, rol')
            .eq('auth_user_id', data.user.id)
            .maybeSingle();
          
          if (userError) {
            logger.warn('⚠️ [OAuth] Error obteniendo datos de usuario:', userError);
          }
          
          // Si no hay datos o registro_completo es false/null -> redirigir a registro
          if (!userData || !userData.registro_completo) {
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
      // v2: Solo usar Supabase Auth
      const supabaseData = await signIn(form.email, form.password);
      logger.dev('✅ Login Supabase exitoso', supabaseData);
      
      // Obtener usuario actual
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('No se pudo obtener el usuario autenticado');
      }
      
      // 🔐 SEGURIDAD: Verificar si el email está confirmado ANTES de cualquier navegación
      if (!currentUser.email_confirmed_at) {
        logger.dev('📧 [Seguridad] Email NO verificado, redirigiendo a verificación');
        navigate('/registro?continue=true&verify=true');
        return;
      }
      
      // Verificar si completó registro
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('registro_completo, rol')
        .eq('auth_user_id', currentUser.id)
        .maybeSingle();
      
      if (userError && userError.code !== 'PGRST116') {
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
      
      // 🔐 SEGURIDAD: Verificar primero si el email está confirmado
      if (!data.user.email_confirmed_at) {
        logger.dev('📧 [OAuth] Email NO verificado, redirigiendo a verificación');
        navigate('/registro?continue=true&verify=true');
        return;
      }
      
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('registro_completo, rol')
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

  // 🔐 Funciones para el modal de recuperación de contraseña (v2: solo email)
  const handleOpenChangePasswordModal = (e) => {
    e.preventDefault();
    setRecoveryEmail(form.email || '');
    setChangePasswordError('');
    setChangePasswordSuccess('');
    setShowChangePasswordModal(true);
  };

  const handleCloseChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setRecoveryEmail('');
    setChangePasswordError('');
    setChangePasswordSuccess('');
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
    
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
      setChangePasswordError(t('password.email'));
      return;
    }

    setChangePasswordLoading(true);
    
    try {
      logger.dev('🔐 Enviando email de recuperación:', recoveryEmail);
      
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      logger.dev('✅ Email de recuperación enviado');
      setChangePasswordSuccess(t('password.recoveryEmailSent'));
      
      setTimeout(() => {
        handleCloseChangePasswordModal();
      }, 3000);
      
    } catch (err) {
      logger.error('❌ Error enviando email:', err);
      setChangePasswordError(err.message || 'Error al enviar el email');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 safe-area-top safe-area-bottom">
      <WaveBackground isPlaying={true} />
      <div className="w-full max-w-md mx-auto z-10">
        <Card className="p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/90 backdrop-blur-md">
          <img 
            src={`${import.meta.env.BASE_URL || ''}assets/icono-ondeon.png`} 
            alt="Logo Ondeón" 
            className="h-14 sm:h-16 mb-3"
            onError={(e) => {
              console.error('Error al cargar el logo en LoginPage');
              e.target.style.display = 'none';
            }}
          />
          <h2 className="text-2xl sm:text-2xl font-bold text-center mb-1">{t('auth.login')}</h2>
          <p className="text-center text-foreground/60 mb-4 text-sm sm:text-base">
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
                type="email" 
                value={form.email} 
                onChange={handleChange} 
                required 
                disabled={loading}
                autoComplete="username"
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
                autoComplete="current-password"
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
              className="w-full bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base h-12 rounded-xl shadow-lg shadow-[#A2D9F7]/20 hover:shadow-[#A2D9F7]/40 transition-all active:scale-[0.98]" 
              type="submit"
              disabled={loading}
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
          
          {/* Separador */}
          <div className="w-full flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-foreground/10" />
            <span className="text-xs text-foreground/40 uppercase tracking-wider">{t('auth.or', 'o')}</span>
            <div className="flex-1 h-px bg-foreground/10" />
          </div>
          
          <div className="w-full flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border-foreground/10 bg-white/5 hover:bg-white/10 text-foreground transition-all active:scale-[0.98]"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <FcGoogle size={22} /> 
              <span className="font-medium">{t('auth.continueWithGoogle')}</span>
            </Button>
            <Button
              className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-white text-black hover:bg-white/90 transition-all active:scale-[0.98]"
              onClick={handleAppleLogin}
              disabled={loading}
            >
              <FaApple size={22} /> 
              <span className="font-medium">{t('auth.continueWithApple')}</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* 🔐 Modal de Recuperación de Contraseña (v2: solo email) */}
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
                    <h3 className="text-xl font-bold">{t('password.recoverPassword')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('password.passwordRecoveryInstructions')}
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
                  <div className="space-y-2">
                    <Label htmlFor="recoveryEmail">{t('password.email')}</Label>
                    <Input
                      id="recoveryEmail"
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      required
                      disabled={changePasswordLoading}
                      placeholder="tu@email.com"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                  </div>

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
                      {changePasswordLoading ? t('password.sending') : t('password.sendEmail')}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
