import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { CreditCard, Check, Loader2, User, Sparkles, Music, Mail, RefreshCw } from 'lucide-react';
import WaveBackground from '@/components/player/WaveBackground';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { usuariosApi } from '@/lib/api';
import { stripeApi, STRIPE_PRICES } from '@/lib/stripeApi';
import logger from '@/lib/logger';

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
  
  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState('pro'); // 'basico' o 'pro'
  const [billingInterval, setBillingInterval] = useState('anual'); // 'mensual' o 'anual' - Por defecto anual para mostrar mejor precio
  
  // Sectores cargados desde BD
  const [sectores, setSectores] = useState(DEFAULT_SECTORES);
  
  // Ref para evitar que re-renders interrumpan el guardado
  const isSavingRef = useRef(false);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithGoogle, signInWithApple } = useAuth();
  // Verificar si volvió del checkout cancelado o viene de login con registro incompleto
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      setError('El proceso de pago fue cancelado. Puedes intentarlo de nuevo.');
    }
  }, [searchParams]);

  // Estado para usuarios que vienen de Electron sin sesión
  const [needsReAuth, setNeedsReAuth] = useState(false);
  const [reAuthProvider, setReAuthProvider] = useState('');

  // 🔑 CRÍTICO: Verificar sesión al cargar (para usuarios que vuelven de OAuth o login)
  useEffect(() => {
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
          
          // 🔑 CRÍTICO: Verificar si el usuario ya tiene registro completo y suscripción activa
          // Si es así, redirigir directamente al dashboard (no mostrar formulario)
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('id, registro_completo, establecimiento, telefono, sector_id, rol')
            .eq('auth_user_id', user.id)
            .single();
          
          
          if (!userError && userData?.registro_completo) {
            logger.dev('✅ Usuario con registro completo detectado, verificando suscripción...');
            
            // 🔑 CRÍTICO: Verificar suscripción activa antes de permitir acceso
            const { data: subscriptionData, error: subError } = await supabase
              .from('suscripciones')
              .select('estado')
              .eq('usuario_id', userData.id)
              .in('estado', ['active', 'trialing'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            
            // Si tiene suscripción activa/trial
            if (subscriptionData) {
              logger.dev('✅ Suscripción activa detectada, permitiendo acceso');
              navigate('/', { replace: true });
              return;
            }
            
            // Sin suscripción activa - redirigir al dashboard
            logger.dev('⚠️ Sin suscripción activa, redirigiendo al dashboard');
            navigate('/gestor', { replace: true });
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
          const continueRegistration = searchParams.get('continue') === 'true';
          
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
  }, [searchParams, navigate]);


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

  // Títulos por paso
  const stepTitles = [
    '',
    'Empieza tu prueba gratis',
    'Crea tu cuenta',
    'Verifica tu correo',
    'Completa tu perfil',
    'Activa tu suscripción',
  ];

  const stepDescriptions = [
    '',
    '7 días gratis, cancela cuando quieras',
    'Usa tu correo electrónico',
    'Revisa tu bandeja de entrada',
    'Cuéntanos sobre ti',
    'Solo necesitas tu tarjeta',
  ];

  // Indicador de pasos
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-4">
      {[1, 2, 3, 4, 5].map((s) => (
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

  // Autenticación con Google
  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/registro`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          data: {
            rol: 'user' // v2: rol es texto
          }
        }
      });

      if (error) throw error;
    } catch (err) {
      logger.error('Error con Google:', err);
      setError('Error con Google: ' + err.message);
      setLoading(false);
    }
  };

  // Autenticación con Apple
  const handleAppleAuth = async () => {
    setError('');
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/registro`,
          data: {
            rol: 'user' // v2: rol es texto
          }
        }
      });
      
      if (error) throw error;
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
      // Registrar usuario nuevo
      // 🔑 CRÍTICO: Usar URL de producción para emailRedirectTo
      // En Electron, window.location.origin puede ser file:// o localhost
      // El usuario verificará en el navegador y luego volverá a la app
      const isDev = import.meta.env.DEV;
      const emailRedirectUrl = isDev 
        ? 'http://localhost:5173/registro'
        : 'https://main.dnpo8nagdov1i.amplifyapp.com/registro';
      
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            rol: 'user', // v2: rol es texto
            nombre: form.email.split('@')[0]
          },
          emailRedirectTo: emailRedirectUrl
        }
      });

      if (error) throw error;

      if (data?.user) {
        // 🔑 CRÍTICO: Verificar si el usuario ya existía
        // Si identities está vacío, el usuario ya existía con otro método (OAuth)
        const isExistingUser = !data.user.identities || data.user.identities.length === 0;
        
        if (isExistingUser) {
          logger.dev('⚠️ Usuario ya existe, verificando estado...');
          
          // Verificar si ya tiene registro completo
          const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('id, registro_completo, rol')
            .eq('auth_user_id', data.user.id)
            .maybeSingle();
          
          if (userData?.registro_completo) {
            logger.dev('✅ Usuario existente con registro completo, redirigiendo...');
            // Usuario ya registrado completamente, redirigir al player o dashboard
            const targetRoute = userData.rol === 'admin' ? '/gestor' : '/';
            setError('');
            navigate(targetRoute, { replace: true });
            return;
          } else if (userData && !userData.registro_completo) {
            // Usuario existe pero no completó registro, continuar desde donde quedó
            logger.dev('🔄 Usuario existente sin registro completo, continuando...');
            setUserCreated(data.user);
            setIsOAuthUser(true); // El email ya está verificado
            setStep(4); // Ir directo a completar perfil
            return;
          } else {
            // No hay registro en usuarios, pero el email ya existe en auth
            // Esto pasa si se registró con OAuth
            setError('Este correo ya está registrado. Intenta iniciar sesión con Google o Apple.');
            return;
          }
        }
        
        // Usuario nuevo, continuar con verificación de email
        setUserCreated(data.user);
        setStep(3); // Ir a verificar email
        logger.dev('✅ Usuario gestor creado:', data.user.id);
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
      // Recargar los datos del usuario de Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && user.email_confirmed_at) {
        setUserCreated(user);
        setStep(4); // Ir al paso de datos del perfil
      } else {
        setError('El correo aún no ha sido verificado. Revisa tu bandeja de entrada.');
      }
    } catch (err) {
      setError('Error al verificar el correo: ' + err.message);
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
      const isDev = import.meta.env.DEV;
      const emailRedirectUrl = isDev 
        ? 'http://localhost:5173/registro'
        : 'https://main.dnpo8nagdov1i.amplifyapp.com/registro';
      
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

  // Completar perfil y pasar a pago
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
      
      // 🔑 CRÍTICO: Usar UPSERT para crear el usuario si no existe
      // Esto soluciona el problema donde el registro nunca se creaba antes del checkout
      logger.dev('🔄 Creando/actualizando public.usuarios con UPSERT...');
      
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
        rol: 'user', // v2: rol es texto ('admin', 'user')
        registro_completo: false, // Se marcará true después del pago exitoso
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
      logger.dev('✅ Usuario creado/actualizado en public.usuarios:', upsertedUser?.id);
      // NOTA: user_current_state se crea automáticamente al primer heartbeat via rpc_heartbeat

      // SEGUNDO: Actualizar metadata en Supabase Auth (puede disparar re-render)
      // Lo hacemos en segundo lugar y NO esperamos a que termine antes de avanzar
      logger.dev('🔄 Actualizando metadata en Supabase Auth...');
      supabase.auth.updateUser({
        data: {
          nombre: form.nombre || userCreated?.user_metadata?.full_name,
          telefono: form.telefono,
          establecimiento: form.establecimiento,
          sector_id: sectorIdValue,
          sector_otro: form.sectorId === 'otro' ? form.sectorOtro : null,
          rol: 'user' // v2: rol es texto
        }
      }).then(({ error: authUpdateError }) => {
        if (authUpdateError) {
          logger.warn('⚠️ Error en auth.updateUser:', authUpdateError);
        } else {
          logger.dev('✅ Metadata actualizada en Supabase Auth');
        }
      });

      logger.dev('➡️ Avanzando al paso 5 (pago)');
      setStep(5); // Ir a pago
    } catch (err) {
      logger.error('Error actualizando perfil:', err);
      setError('Error guardando los datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
      isSavingRef.current = false;
    }
  };

  // Obtener precio actual basado en selección
  const getCurrentPrice = (planKey = selectedPlan) => {
    const plan = STRIPE_PRICES[planKey];
    return billingInterval === 'mensual' 
      ? { price_id: plan.mensual, amount: plan.precioMensual, label: `€${plan.precioMensual}/mes` }
      : { price_id: plan.anual, amount: plan.precioAnual, label: `€${plan.precioMensualAnual}/mes (€${plan.precioAnual}/año)` };
  };

  // Iniciar checkout de Stripe
  // planKey: 'basico' o 'pro' - se pasa explícitamente para evitar problemas con state async
  const handleStartCheckout = async (planKey = selectedPlan) => {
    setError('');
    setLoading(true);

    try {
      let currentUser = userCreated;
      
      if (!currentUser?.id) {
        // Verificar sesión actual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Sesión no válida. Por favor, inicia sesión de nuevo.');
          setStep(1);
          setLoading(false);
          return;
        }
        currentUser = user;
        setUserCreated(user);
      }

      const priceInfo = getCurrentPrice(planKey);
      const planInfo = STRIPE_PRICES[planKey];
      
      logger.dev('💳 Iniciando checkout para:', currentUser.id, {
        plan: planInfo.nombre,
        interval: billingInterval,
        price_id: priceInfo.price_id,
        planKey: planKey
      });

      // Obtener token de sesión para autenticar la llamada
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión de nuevo.');
      }

      // Crear sesión de checkout via Edge Function
      const { checkout_url } = await stripeApi.createCheckoutSession({
        auth_user_id: currentUser.id,
        email: currentUser.email || form.email,
        nombre: form.nombre || currentUser.user_metadata?.nombre,
        price_id: priceInfo.price_id,
        plan_nombre: planInfo.nombre,
        telefono: form.telefono,
        nombre_negocio: form.nombreNegocio,
        success_url: `${window.location.origin}/gestor?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/registro?cancelled=true`,
        access_token: accessToken
      });

      // Redirigir a Stripe Checkout
      window.location.href = checkout_url;

    } catch (err) {
      logger.error('Error iniciando checkout:', err);
      setError('Error al procesar el pago: ' + err.message);
    } finally {
      setLoading(false);
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
                <CreditCard className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">7 días gratis</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                No se te cobrará hasta que termine tu prueba
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
                      {sector.nombre}
                    </option>
                  ))}
                </select>
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

  // Paso 5: Selección de Plan y Checkout
  if (step === 5) {
    const priceInfo = getCurrentPrice();
    const planInfo = STRIPE_PRICES[selectedPlan];
    
    // Color accent igual que la web
    const accentColor = '#A2D9F7';
    
    // Características por plan
    const planFeatures = {
      basico: [
        '28 Canales de música tematizados',
        'Licencia Comercial',
        'Certificado libre de regalías',
        'Indicativos de Voz para tu Marca',
        'Soporte Técnico',
        'Actualización Mensual de canales',
        '1 zona de reproducción',
        'Sin permanencia'
      ],
      pro: [
        'Todo lo incluido en el plan BÁSICO',
        'Audio Marketing',
        'Indicativos de tu marca',
        'Campañas publicitarias (Cuñas, Menciones)',
        'Anuncios inmediatos con IA',
        'Sin permanencia'
      ]
    };

    // Precios para mostrar
    const displayPrices = {
      basico: billingInterval === 'anual' 
        ? STRIPE_PRICES.basico.precioMensualAnual 
        : STRIPE_PRICES.basico.precioMensual,
      pro: billingInterval === 'anual' 
        ? STRIPE_PRICES.pro.precioMensualAnual 
        : STRIPE_PRICES.pro.precioMensual
    };
    
    // Totales anuales para mostrar
    const annualTotals = {
      basico: STRIPE_PRICES.basico.precioAnual,
      pro: STRIPE_PRICES.pro.precioAnual
    };

    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
        <WaveBackground isPlaying={true} />
        <div className="w-full max-w-3xl mx-auto z-10">
          {/* Header persuasivo */}
          <div className="text-center mb-8">
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 border animate-pulse"
              style={{ 
                backgroundColor: `${accentColor}15`, 
                borderColor: `${accentColor}40`,
                boxShadow: `0 0 20px ${accentColor}20`
              }}
            >
              <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
              <span className="text-sm font-bold" style={{ color: accentColor }}>
                <span className="text-white">7 días</span> GRATIS
              </span>
              <span className="text-gray-400 text-xs">· Sin compromiso</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
              Prueba Ondeón{' '}
              <span 
                className="relative inline-block"
                style={{ color: accentColor }}
              >
                gratis
                <span 
                  className="absolute -bottom-1 left-0 w-full h-0.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              </span>
              {' '}durante{' '}
              <span 
                className="relative inline-block"
                style={{ color: accentColor }}
              >
                7 días
                <span 
                  className="absolute -bottom-1 left-0 w-full h-0.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              </span>
            </h2>
            <p className="text-gray-400 text-sm md:text-base">
              Descubre el sonido perfecto para tu negocio. Cancela cuando quieras.
            </p>
          </div>

          {/* Toggle Mensual/Anual */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className={`text-sm font-medium transition-colors ${billingInterval === 'mensual' ? 'text-white' : 'text-gray-500'}`}>
              Mensual
            </span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'mensual' ? 'anual' : 'mensual')}
              className="relative w-12 h-7 rounded-full transition-all duration-300"
              style={{ backgroundColor: billingInterval === 'anual' ? accentColor : '#374151' }}
              aria-label="Toggle pricing period"
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 ${
                  billingInterval === 'anual' ? 'left-6' : 'left-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${billingInterval === 'anual' ? 'text-white' : 'text-gray-500'}`}>
              Anual
            </span>
            {billingInterval === 'anual' && (
              <span 
                className="px-2 py-0.5 text-xs font-semibold rounded-full border"
                style={{ 
                  backgroundColor: `${accentColor}20`, 
                  color: accentColor,
                  borderColor: `${accentColor}30`
                }}
              >
                -22%
              </span>
            )}
          </div>

          {/* Plan Cards - 2 columnas compactas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Plan Básico */}
            <div
              onClick={() => setSelectedPlan('basico')}
              className="cursor-pointer relative bg-[#A2D9F7]/5 border border-[#A2D9F7]/10 hover:border-[#A2D9F7]/30 backdrop-blur-sm rounded-xl p-5 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-lg font-bold text-white mb-1">Ondeón Básico</div>
              <p className="text-gray-400 text-xs mb-4">Perfecto para comenzar</p>
              
              <div className="mb-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">€{displayPrices.basico}</span>
                  <span className="text-gray-400 text-sm">/mes</span>
                </div>
                {billingInterval === 'anual' && (
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-gray-400 font-medium">€{annualTotals.basico}/año</span> · facturado anualmente
                  </p>
                )}
              </div>
              
              <div className="mb-4">
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  IVA incluido
                </span>
              </div>
              
              <ul className="space-y-2 mb-5">
                {planFeatures.basico.slice(0, 5).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div 
                      className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${accentColor}20` }}
                    >
                      <Check className="w-2 h-2" style={{ color: accentColor }} strokeWidth={3} />
                    </div>
                    <span className="text-gray-300 text-xs leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan('basico');
                  handleStartCheckout('basico'); // Pasar plan explícitamente
                }}
                disabled={loading && selectedPlan === 'basico'}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-white/5 text-white hover:bg-white/10 border border-white/10"
              >
                {loading && selectedPlan === 'basico' ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  <>Empezar <span className="font-black">7 días GRATIS</span></>
                )}
              </button>
            </div>

            {/* Plan Pro - Destacado */}
            <div
              onClick={() => setSelectedPlan('pro')}
              className="cursor-pointer relative bg-[#A2D9F7]/5 backdrop-blur-sm rounded-xl p-5 transition-all duration-300 hover:-translate-y-1"
              style={{ borderColor: accentColor, borderWidth: '2px', borderStyle: 'solid', boxShadow: `0 20px 40px -12px ${accentColor}25` }}
            >
              {/* Badge Más popular */}
              <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 z-10">
                <div 
                  className="px-3 py-1 rounded-full text-xs font-bold shadow-lg"
                  style={{ backgroundColor: accentColor, color: '#1a1c20' }}
                >
                  Más popular
                </div>
              </div>
              
              <div className="text-lg font-bold text-white mb-1 mt-1">Ondeón Pro</div>
              <p className="text-gray-400 text-xs mb-4">Para negocios en crecimiento</p>
              
              <div className="mb-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">€{displayPrices.pro}</span>
                  <span className="text-gray-400 text-sm">/mes</span>
                </div>
                {billingInterval === 'anual' && (
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-gray-400 font-medium">€{annualTotals.pro}/año</span> · facturado anualmente
                  </p>
                )}
              </div>
              
              <div className="mb-4">
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  IVA incluido
                </span>
              </div>
              
              <ul className="space-y-2 mb-5">
                {planFeatures.pro.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div 
                      className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${accentColor}20` }}
                    >
                      <Check className="w-2 h-2" style={{ color: accentColor }} strokeWidth={3} />
                    </div>
                    <span className="text-gray-300 text-xs leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan('pro');
                  handleStartCheckout('pro'); // Pasar plan explícitamente
                }}
                disabled={loading && selectedPlan === 'pro'}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-95 text-[#1a1c20] shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                {loading && selectedPlan === 'pro' ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  <>Empezar <span className="font-black">7 días GRATIS</span></>
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-gray-400 text-xs">
              Todos los planes incluyen certificado libre de regalías y licencia comercial
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Sin permanencia • Cancela cuando quieras
            </p>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <div className="text-center mt-4">
            <button
              onClick={() => setStep(4)}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              disabled={loading}
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
