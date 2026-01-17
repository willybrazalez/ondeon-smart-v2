import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User,
  CreditCard, 
  FileText,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  X,
  Building,
  Globe,
  Edit2,
  Save,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  Circle,
  Receipt,
  RefreshCw,
  XCircle,
  Wallet,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_STATUS } from '@/hooks/useSubscription';
import { stripeApi } from '@/lib/stripeApi';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

// Lista de provincias españolas
const PROVINCIAS_ESPANA = [
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
  'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón',
  'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Guipúzcoa',
  'Huelva', 'Huesca', 'Illes Balears', 'Jaén', 'La Rioja', 'Las Palmas', 'León',
  'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Palencia',
  'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria',
  'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza'
];

// URLs de descarga directa desde GitHub Releases v0.0.35
const GITHUB_DOWNLOAD_BASE = 'https://github.com/ondeon/ondeon-smart-releases/releases/download/v0.0.35';
const DOWNLOAD_URLS = {
  windows: `${GITHUB_DOWNLOAD_BASE}/Ondeon-Smart-0.0.35.exe`,
  mac: `${GITHUB_DOWNLOAD_BASE}/Ondeon.Smart.dmg`,
};

// Iconos SVG reales de Windows y Apple
const WindowsIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.851"/>
  </svg>
);

const AppleIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

/**
 * Modal genérico con scroll dinámico
 */
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        {/* Modal - dinámico con max-height */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header - fijo */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
          
          {/* Content - scrollable */}
          <div className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// 🌐 Detectar si estamos en desktop (Electron) vs web
const isDesktopApp = () => {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'file:' || !!window.electronAPI;
};

/**
 * Dashboard principal para usuarios Gestores (rol_id = 2)
 */
const GestorDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, loadUserProfile, updateUserProfile } = useAuth();
  const isDesktop = isDesktopApp();
  const { 
    subscription, 
    loading,
    hasActiveSubscription, 
    isInTrial, 
    isPaymentFailed,
    isCancelled,
    getTrialDaysRemaining,
    getStatusLabel,
    refresh: refreshSubscription
  } = useSubscription();

  // Estados de modales
  const [activeModal, setActiveModal] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  // Estados para edición de perfil
  const [isEditing, setIsEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileData, setProfileData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    establecimiento: '',
    direccion: '',
    localidad: '',
    provincia: '',
  });
  // Estado original del establecimiento (para detectar cambios)
  const [originalEstablecimiento, setOriginalEstablecimiento] = useState('');
  // Fecha de última modificación del establecimiento
  const [establecimientoUpdatedAt, setEstablecimientoUpdatedAt] = useState(null);

  // Estados para cambio de contraseña
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Email del usuario para mostrar en el header
  const displayEmail = user?.email || profileData.email || 'Usuario';

  // Forzar tema oscuro inicialmente
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  // Calcular si puede modificar el establecimiento (1 vez al día)
  const canEditEstablecimiento = () => {
    if (!establecimientoUpdatedAt) return true; // Nunca ha sido modificado
    const lastUpdate = new Date(establecimientoUpdatedAt);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    return hoursSinceUpdate >= 24;
  };

  // Calcular tiempo restante para poder modificar
  const getTimeUntilCanEdit = () => {
    if (!establecimientoUpdatedAt) return null;
    const lastUpdate = new Date(establecimientoUpdatedAt);
    const unlockTime = new Date(lastUpdate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const msRemaining = unlockTime - now;
    
    if (msRemaining <= 0) return null;
    
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursRemaining > 0) {
      return `${hoursRemaining}h ${minutesRemaining}min`;
    }
    return `${minutesRemaining} minutos`;
  };

  // Cargar perfil cuando se abre el modal de datos
  const handleOpenDatosModal = async () => {
    setActiveModal('datos');
    setIsEditing(false);
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      const userData = await loadUserProfile();
      if (userData) {
        setProfileData({
          nombre: userData.nombre || '',
          email: userData.email || user?.email || '',
          telefono: userData.telefono || '',
          establecimiento: userData.establecimiento || '',
          direccion: userData.direccion || '',
          localidad: userData.localidad || '',
          provincia: userData.provincia || '',
        });
        // Guardar el establecimiento original para detectar cambios
        setOriginalEstablecimiento(userData.establecimiento || '');
        // Guardar la fecha de última modificación del establecimiento (campo de BD)
        setEstablecimientoUpdatedAt(userData.ultimo_cambio_establecimiento || null);
      } else {
        // Fallback a datos del user de Auth
        setProfileData({
          nombre: user?.user_metadata?.nombre || user?.user_metadata?.full_name || '',
          email: user?.email || '',
          telefono: user?.user_metadata?.telefono || '',
          establecimiento: user?.user_metadata?.establecimiento || '',
          direccion: '',
          localidad: '',
          provincia: '',
        });
        setOriginalEstablecimiento(user?.user_metadata?.establecimiento || '');
        setEstablecimientoUpdatedAt(null);
      }
    } catch (error) {
      logger.error('Error cargando perfil:', error);
      setProfileError('Error al cargar los datos');
    } finally {
      setProfileLoading(false);
    }
  };

  // Guardar cambios del perfil
  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');
    setSaveLoading(true);

    // Detectar si el establecimiento cambió
    const establecimientoChanged = profileData.establecimiento !== originalEstablecimiento;

    try {
      const result = await updateUserProfile(profileData, { establecimientoChanged });
      if (result.success) {
        // Si cambió el establecimiento, actualizar la fecha y el original
        if (establecimientoChanged) {
          setEstablecimientoUpdatedAt(new Date().toISOString());
          setOriginalEstablecimiento(profileData.establecimiento);
          setProfileSuccess('Datos actualizados. Se están generando nuevos indicativos de voz...');
        } else {
          setProfileSuccess('Datos actualizados correctamente');
        }
        setIsEditing(false);
        // Limpiar mensaje de éxito después de 3 segundos
        setTimeout(() => setProfileSuccess(''), 5000);
      } else {
        setProfileError(result.error || 'Error al guardar los cambios');
      }
    } catch (error) {
      logger.error('Error guardando perfil:', error);
      setProfileError('Error al guardar los cambios');
    } finally {
      setSaveLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  // Manejar cambios en el formulario de contraseña
  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    // Limpiar errores al escribir
    if (passwordError) setPasswordError('');
  };

  // Cambiar contraseña
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    // Validaciones
    if (!passwordData.currentPassword) {
      setPasswordError('Introduce tu contraseña actual');
      return;
    }
    if (!passwordData.newPassword) {
      setPasswordError('Introduce la nueva contraseña');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setPasswordLoading(true);

    try {
      // Primero verificar la contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: passwordData.currentPassword
      });

      if (signInError) {
        setPasswordError('La contraseña actual es incorrecta');
        setPasswordLoading(false);
        return;
      }

      // Si la contraseña actual es correcta, actualizar a la nueva
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) {
        throw error;
      }

      setPasswordSuccess('Contraseña actualizada correctamente');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (error) {
      logger.error('Error cambiando contraseña:', error);
      setPasswordError(error.message || 'Error al cambiar la contraseña');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Datos del usuario (para referencia, el modal usa profileData)

  // Manejar descarga
  const handleDownload = (platform) => {
    window.open(DOWNLOAD_URLS[platform], '_blank');
  };

  // Manejar logout
  const handleLogout = async () => {
    try {
      await signOut();
      window.location.replace('/login');
    } catch (error) {
      logger.error('Error al cerrar sesión:', error);
    }
  };

  // Abrir portal de Stripe
  const handleManageSubscription = async () => {
    const authUserId = user?.id || user?.auth_user_id;
    if (!authUserId) {
      logger.error('No se encontró auth_user_id para abrir el portal');
      return;
    }

    try {
      setStripeLoading(true);
      await stripeApi.openPortal(authUserId, `${window.location.origin}/gestor`);
    } catch (error) {
      logger.error('Error abriendo portal de Stripe:', error);
      // Mostrar mensaje al usuario
      alert('No se pudo abrir el portal de suscripción. Por favor, contacta con soporte.');
    } finally {
      setStripeLoading(false);
    }
  };

  // Obtener icono y color del estado de suscripción
  const getSubscriptionInfo = () => {
    if (loading) return { icon: Clock, color: 'text-white/50', bg: 'bg-white/10', label: 'Cargando...' };
    if (!subscription) return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Sin suscripción' };
    // Verificar trial ANTES de active (porque hasActiveSubscription incluye trialing)
    if (isInTrial()) return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', label: `En prueba - ${getTrialDaysRemaining()} días` };
    if (subscription?.estado === 'active') return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Activa' };
    if (isPaymentFailed()) return { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Pago pendiente' };
    if (isCancelled()) return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Cancelada' };
    return { icon: AlertTriangle, color: 'text-white/50', bg: 'bg-white/10', label: getStatusLabel() };
  };

  const subInfo = getSubscriptionInfo();

  // Cards data
  const cards = [
    {
      id: 'datos',
      title: 'Mis\ndatos',
      icon: User,
    },
    {
      id: 'suscripcion',
      title: 'Suscripción',
      icon: CreditCard,
    },
    {
      id: 'contenidos',
      title: 'Gestión\nContenidos',
      icon: FileText,
    },
    {
      id: 'soporte',
      title: 'Soporte',
      icon: HelpCircle,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e14] relative overflow-hidden">
      {/* Efecto de fondo - Foco azul */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20 blur-[150px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #A2D9F7 0%, transparent 70%)',
        }}
      />
      
      {/* Efecto secundario más pequeño */}
      <div 
        className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-10 blur-[100px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #7EC8E3 0%, transparent 70%)',
        }}
      />

      {/* Header - Igual que el reproductor */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4">
        {/* Logo + SMART */}
        <div className="flex items-center gap-2">
          <img 
            src="/assets/icono-ondeon.png"
            alt="Ondeón Logo"
            className="h-12 w-12 sm:h-14 sm:w-14 drop-shadow-lg"
            style={{ maxWidth: 'none' }}
            onError={(e) => {
              console.error('Error al cargar el logo');
              e.target.style.display = 'none';
            }}
          />
          <span className="text-2xl tracking-[0.2em] font-light text-[#A2D9F7] font-sans">SMART</span>
        </div>

        {/* Usuario + Logout */}
        <div className="flex items-center gap-2 sm:gap-4 px-3 py-1.5 rounded-2xl bg-black/5 dark:bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          <span className="text-sm text-[#A2D9F7] flex items-center gap-2">
            {displayEmail}
            <Circle size={8} className="fill-green-500 text-green-500" />
          </span>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center text-foreground/60 hover:text-[#A2D9F7] transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-8 pt-24 pb-8">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-light text-white italic mb-4">
              Tu música, tu negocio, tu estilo
            </h2>
            <p className="text-white/40 text-base mb-10 max-w-lg mx-auto">
              {isDesktop 
                ? 'Gestiona tu cuenta y suscripción desde aquí'
                : 'Descarga la aplicación de escritorio para disfrutar de la mejor experiencia musical en tu establecimiento'
              }
            </p>
            
            {/* Botón según plataforma */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isDesktop ? (
                /* Desktop: Botón para volver al reproductor */
                <Button
                  size="lg"
                  className="h-12 px-8 bg-[#A2D9F7]/20 hover:bg-[#A2D9F7]/30 text-white border border-[#A2D9F7]/30 hover:border-[#A2D9F7]/50 transition-all rounded-xl"
                  onClick={() => navigate('/')}
                >
                  <Home className="w-5 h-5 mr-3" />
                  Volver al reproductor
                </Button>
              ) : (
                /* Web: Botones de descarga */
                <>
                  <Button
                    size="lg"
                    className="h-12 px-6 bg-[#A2D9F7]/20 hover:bg-[#A2D9F7]/30 text-white border border-[#A2D9F7]/30 hover:border-[#A2D9F7]/50 transition-all rounded-xl"
                    onClick={() => handleDownload('windows')}
                  >
                    <WindowsIcon className="w-5 h-5 mr-3" />
                    Descargar para Windows
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 px-6 bg-[#A2D9F7]/20 hover:bg-[#A2D9F7]/30 text-white border border-[#A2D9F7]/30 hover:border-[#A2D9F7]/50 transition-all rounded-xl"
                    onClick={() => handleDownload('mac')}
                  >
                    <AppleIcon className="w-5 h-5 mr-3" />
                    Descargar para macOS
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </section>

        {/* Cards Grid */}
        <section className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {cards.map((card, index) => (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
                onClick={() => card.id === 'datos' ? handleOpenDatosModal() : setActiveModal(card.id)}
                className="group relative aspect-square bg-[#12161c] hover:bg-[#161b23] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-6 text-left transition-all duration-300 overflow-hidden"
              >
                {/* Icono grande de fondo */}
                <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                  <card.icon className="w-40 h-40" />
                </div>
                
                {/* Contenido */}
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <h3 className="text-xl md:text-2xl font-medium text-white/90 whitespace-pre-line leading-tight">
                    {card.title}
                  </h3>
                  <card.icon className="w-8 h-8 text-[#A2D9F7]/60" />
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      </main>

      {/* Modal: Mis Datos */}
      <Modal
        isOpen={activeModal === 'datos'}
        onClose={() => { setActiveModal(null); setIsEditing(false); }}
        title="Mis datos"
      >
        {profileLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-[#A2D9F7] animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Mensajes de error/éxito */}
            {profileError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                {profileSuccess}
              </div>
            )}

            {/* Campo: Nombre */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#A2D9F7]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40 mb-1">Nombre</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={profileData.nombre}
                    onChange={(e) => handleProfileChange('nombre', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50"
                    placeholder="Tu nombre"
                  />
                ) : (
                  <p className="text-white/90">{profileData.nombre || 'No configurado'}</p>
                )}
              </div>
            </div>
            
            {/* Campo: Email (no editable) */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-[#A2D9F7]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40 mb-1">Email</p>
                <p className="text-white/90">{profileData.email || user?.email || 'No disponible'}</p>
                {isEditing && (
                  <p className="text-xs text-white/30 mt-1">El email no se puede modificar</p>
                )}
              </div>
            </div>
            
            {/* Campo: Teléfono */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-[#A2D9F7]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40 mb-1">Teléfono</p>
                {isEditing ? (
                  <input
                    type="tel"
                    value={profileData.telefono}
                    onChange={(e) => handleProfileChange('telefono', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50"
                    placeholder="Tu teléfono"
                  />
                ) : (
                  <p className="text-white/90">{profileData.telefono || 'No configurado'}</p>
                )}
              </div>
            </div>
            
            {/* Campo: Establecimiento */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center flex-shrink-0">
                <Building className="w-5 h-5 text-[#A2D9F7]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40 mb-1">Establecimiento</p>
                {isEditing ? (
                  <>
                    {/* Mensaje de bloqueo si no han pasado 24 horas */}
                    {!canEditEstablecimiento() && (
                      <div className="mb-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-xs text-amber-400 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          Solo puedes cambiar el nombre del establecimiento una vez al día. 
                          Disponible en {getTimeUntilCanEdit()}.
                        </p>
                      </div>
                    )}
                    <input
                      type="text"
                      value={profileData.establecimiento}
                      onChange={(e) => handleProfileChange('establecimiento', e.target.value)}
                      disabled={!canEditEstablecimiento()}
                      className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50 ${!canEditEstablecimiento() ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder="Nombre de tu establecimiento"
                    />
                    {canEditEstablecimiento() && (
                      <p className="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1">
                        <span>💡</span>
                        Al cambiar el nombre se generarán nuevos indicativos de voz personalizados
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-white/90">{profileData.establecimiento || 'No configurado'}</p>
                )}
              </div>
            </div>
            
            {/* Campo: Dirección */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-[#A2D9F7]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40 mb-1">Dirección</p>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={profileData.direccion}
                      onChange={(e) => handleProfileChange('direccion', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50"
                      placeholder="Calle y número"
                    />
                    <input
                      type="text"
                      value={profileData.localidad}
                      onChange={(e) => handleProfileChange('localidad', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50"
                      placeholder="Localidad"
                    />
                    <div className="relative">
                      <select
                        value={profileData.provincia}
                        onChange={(e) => handleProfileChange('provincia', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#0d1117]">Selecciona provincia</option>
                        {PROVINCIAS_ESPANA.map(prov => (
                          <option key={prov} value={prov} className="bg-[#0d1117]">{prov}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                    </div>
                  </div>
                ) : (
                  <p className="text-white/90">
                    {profileData.direccion || 'No configurada'}
                    {profileData.localidad && `, ${profileData.localidad}`}
                    {profileData.provincia && ` (${profileData.provincia})`}
                  </p>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="pt-4 border-t border-white/10 flex gap-3">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                    onClick={() => setIsEditing(false)}
                    disabled={saveLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 h-11 bg-[#A2D9F7]/20 hover:bg-[#A2D9F7]/30 text-white border border-[#A2D9F7]/30"
                    onClick={handleSaveProfile}
                    disabled={saveLoading}
                  >
                    {saveLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full h-11 bg-[#A2D9F7]/20 hover:bg-[#A2D9F7]/30 text-white border border-[#A2D9F7]/30"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar datos
                </Button>
              )}
            </div>

            {/* Sección: Cambiar contraseña */}
            <div className="pt-4 border-t border-white/10">
              {/* Mensajes de contraseña */}
              {passwordError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm mb-4">
                  {passwordSuccess}
                </div>
              )}

              {!showPasswordSection ? (
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-[#A2D9F7]" />
                  </div>
                  <div>
                    <p className="text-white/90 font-medium">Cambiar contraseña</p>
                    <p className="text-xs text-white/40">Actualiza tu contraseña de acceso</p>
                  </div>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-[#A2D9F7]" />
                      <p className="text-white/90 font-medium">Cambiar contraseña</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowPasswordSection(false);
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordError('');
                      }}
                      className="text-white/40 hover:text-white/60"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Contraseña actual */}
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Contraseña actual</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50"
                        placeholder="Tu contraseña actual"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Nueva contraseña */}
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Nueva contraseña</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50"
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar contraseña */}
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Confirmar nueva contraseña</label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#A2D9F7]/50"
                      placeholder="Repite la nueva contraseña"
                    />
                  </div>

                  <Button
                    className="w-full h-11 bg-[#A2D9F7]/20 hover:bg-[#A2D9F7]/30 text-white border border-[#A2D9F7]/30"
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Actualizar contraseña
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Suscripción */}
      <Modal
        isOpen={activeModal === 'suscripcion'}
        onClose={() => setActiveModal(null)}
        title="Suscripción"
      >
        <div className="space-y-6">
          {/* Estado actual con botón refresh */}
          <div className={`flex items-center justify-between p-4 rounded-xl ${subInfo.bg}`}>
            <div className="flex items-center gap-4">
              <subInfo.icon className={`w-6 h-6 ${subInfo.color}`} />
              <div>
                <p className="text-sm text-white/50">Estado actual</p>
                <p className={`text-lg font-medium ${subInfo.color}`}>{subInfo.label}</p>
              </div>
            </div>
            <button
              onClick={refreshSubscription}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
              title="Actualizar estado"
            >
              <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Detalles */}
          {subscription && (
            <div className="space-y-4">
              {(subscription.plan_nombre || subscription.plan) && (
                <div className="flex items-start gap-4">
                  <Globe className="w-5 h-5 text-white/30 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/40 mb-1">Plan</p>
                    <p className="text-white/90">{subscription.plan_nombre || subscription.plan}</p>
                  </div>
                </div>
              )}

              {subscription.precio_mensual && (
                <div className="flex items-start gap-4">
                  <CreditCard className="w-5 h-5 text-white/30 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/40 mb-1">Precio</p>
                    <p className="text-white/90">
                      {subscription.precio_mensual}€/{subscription.intervalo_facturacion === 'year' ? 'año' : 'mes'}
                    </p>
                  </div>
                </div>
              )}
              
              {subscription.fecha_proxima_factura && (
                <div className="flex items-start gap-4">
                  <Calendar className="w-5 h-5 text-white/30 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/40 mb-1">Próxima factura</p>
                    <p className="text-white/90">
                      {new Date(subscription.fecha_proxima_factura).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}

              {isInTrial() && subscription.fecha_fin_trial && (
                <div className="flex items-start gap-4">
                  <Clock className="w-5 h-5 text-white/30 mt-0.5" />
                  <div>
                    <p className="text-xs text-white/40 mb-1">Fin del período de prueba</p>
                    <p className="text-white/90">
                      {new Date(subscription.fecha_fin_trial).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Info técnica para debug */}
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs text-white/30">
                  Estado BD: {subscription.estado} | ID: {subscription.stripe_subscription_id?.slice(-8) || 'N/A'}
                </p>
              </div>

              {/* Accesos directos */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-white/40 mb-3">Accesos rápidos</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Ver facturas */}
                  <button
                    onClick={handleManageSubscription}
                    disabled={stripeLoading}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
                  >
                    <Receipt className="w-4 h-4 text-[#A2D9F7]" />
                    <span className="text-sm text-white/80">Ver facturas</span>
                  </button>
                  
                  {/* Cambiar plan */}
                  <button
                    onClick={async () => {
                      const authUserId = user?.id || user?.auth_user_id;
                      if (!authUserId) return;
                      try {
                        setStripeLoading(true);
                        await stripeApi.openUpdateSubscription(authUserId, `${window.location.origin}/gestor`);
                      } catch (error) {
                        logger.error('Error abriendo cambio de plan:', error);
                        alert('No se pudo abrir. Por favor, contacta con soporte.');
                      } finally {
                        setStripeLoading(false);
                      }
                    }}
                    disabled={stripeLoading}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
                  >
                    <RefreshCw className="w-4 h-4 text-[#A2D9F7]" />
                    <span className="text-sm text-white/80">Cambiar plan</span>
                  </button>
                  
                  {/* Método de pago */}
                  <button
                    onClick={async () => {
                      const authUserId = user?.id || user?.auth_user_id;
                      if (!authUserId) return;
                      try {
                        setStripeLoading(true);
                        await stripeApi.openUpdatePaymentMethod(authUserId, `${window.location.origin}/gestor`);
                      } catch (error) {
                        logger.error('Error abriendo método de pago:', error);
                        alert('No se pudo abrir. Por favor, contacta con soporte.');
                      } finally {
                        setStripeLoading(false);
                      }
                    }}
                    disabled={stripeLoading}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
                  >
                    <Wallet className="w-4 h-4 text-[#A2D9F7]" />
                    <span className="text-sm text-white/80">Método de pago</span>
                  </button>
                  
                  {/* Cancelar */}
                  <button
                    onClick={async () => {
                      const authUserId = user?.id || user?.auth_user_id;
                      if (!authUserId) return;
                      if (!confirm('¿Estás seguro de que quieres cancelar tu suscripción?')) return;
                      try {
                        setStripeLoading(true);
                        await stripeApi.openCancelSubscription(authUserId, `${window.location.origin}/gestor`);
                      } catch (error) {
                        logger.error('Error abriendo cancelación:', error);
                        alert('No se pudo abrir. Por favor, contacta con soporte.');
                      } finally {
                        setStripeLoading(false);
                      }
                    }}
                    disabled={stripeLoading}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 transition-colors text-left"
                  >
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-white/80">Cancelar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Botón gestionar */}
          <Button
            className="w-full h-12 bg-[#A2D9F7]/20 hover:bg-[#A2D9F7]/30 text-white border border-[#A2D9F7]/30"
            onClick={handleManageSubscription}
            disabled={stripeLoading}
          >
            {stripeLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Abriendo portal...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Gestionar suscripción en Stripe
              </>
            )}
          </Button>

          {!subscription && (
            <p className="text-sm text-white/40 text-center">
              No tienes una suscripción activa. Contacta con soporte para más información.
            </p>
          )}
        </div>
      </Modal>

      {/* Modal: Gestión Contenidos */}
      <Modal
        isOpen={activeModal === 'contenidos'}
        onClose={() => setActiveModal(null)}
        title="Gestión de Contenidos"
      >
        <div className="space-y-4">
          <p className="text-white/60 mb-6">
            Administra tus anuncios personalizados y programaciones de contenido desde la aplicación de escritorio.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <FileText className="w-6 h-6 text-[#A2D9F7]/60" />
              <div className="flex-1">
                <p className="text-white/90 font-medium">Mis Anuncios</p>
                <p className="text-sm text-white/40">Crea y gestiona tus anuncios</p>
              </div>
              <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">Desktop</span>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Calendar className="w-6 h-6 text-[#A2D9F7]/60" />
              <div className="flex-1">
                <p className="text-white/90 font-medium">Programaciones</p>
                <p className="text-sm text-white/40">Programa contenido específico</p>
              </div>
              <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded">Desktop</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <p className="text-sm text-white/40 text-center">
              Descarga la aplicación de escritorio para acceder a estas funciones
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal: Soporte */}
      <Modal
        isOpen={activeModal === 'soporte'}
        onClose={() => setActiveModal(null)}
        title="Soporte"
      >
        <div className="space-y-6">
          <p className="text-white/60">
            ¿Necesitas ayuda? Nuestro equipo está aquí para asistirte.
          </p>
          
          <a 
            href="mailto:soporte@ondeon.es"
            className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center">
              <Mail className="w-6 h-6 text-[#A2D9F7]" />
            </div>
            <div>
              <p className="text-white/90 font-medium">Email de soporte</p>
              <p className="text-[#A2D9F7]">soporte@ondeon.es</p>
            </div>
          </a>

          <Button
            variant="outline"
            className="w-full h-12 border-white/10 text-white/70 hover:text-white hover:bg-white/[0.05]"
            onClick={() => window.open('https://ondeon.es/ayuda', '_blank')}
          >
            <Globe className="w-4 h-4 mr-2" />
            Visitar centro de ayuda
          </Button>

          <div className="pt-4 border-t border-white/10">
            <p className="text-sm text-white/40 text-center">
              Horario de atención: Lunes a Viernes, 9:00 - 18:00
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GestorDashboard;
