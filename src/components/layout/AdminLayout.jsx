import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Radio, 
  Megaphone, 
  Users, 
  ChevronLeft,
  ChevronRight,
  Map,
  Menu,
  X,
  LogOut,
  Calendar,
  FileText,
  UserCog,
  Building2,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import logger from '@/lib/logger';

/**
 * Layout específico para vistas administrativas
 * Incluye sidebar con navegación y área de contenido
 */
const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useRole();
  const { signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Función para cerrar sesión completa
  const handleLogout = async () => {
    try {
      logger.dev('🚪 Iniciando proceso de logout desde AdminLayout...');
      
      // 🔧 CRÍTICO: Importar servicios dinámicamente
      const [
        { default: audioPlayer },
        { default: autoDj },
        { default: playbackLogger },
        { default: advancedPresenceService }
      ] = await Promise.all([
        import('@/services/audioPlayerService'),
        import('@/services/autoDjService'),
        import('@/services/playbackLogger'),
        import('@/services/advancedPresenceService')
      ]);
      
      // 🔧 CRÍTICO: Detener servicio de presencia/heartbeat
      try {
        await advancedPresenceService.stopPresence();
        logger.dev('🛑 Servicio de presencia detenido');
      } catch (e) {
        logger.warn('⚠️ Error deteniendo servicio de presencia:', e);
      }
      
      // 🔧 CRÍTICO: Detener completamente el AutoDJ
      if (autoDj && typeof autoDj.stop === 'function') {
        logger.dev('⏹️ Deteniendo AutoDJ...');
        await autoDj.stop();
      }
      
      // 🔧 CRÍTICO: Detener el reproductor de audio
      if (audioPlayer && typeof audioPlayer.stop === 'function') {
        logger.dev('⏹️ Deteniendo AudioPlayer...');
        audioPlayer.stop();
      }
      
      // 🔧 CRÍTICO: Resetear el AutoDJ
      if (autoDj && typeof autoDj.reset === 'function') {
        logger.dev('🧹 Reseteando AutoDJ...');
        autoDj.reset();
      }
      
      // 🔧 CRÍTICO: Resetear el AudioPlayer
      if (audioPlayer && typeof audioPlayer.reset === 'function') {
        logger.dev('🧹 Reseteando AudioPlayer...');
        audioPlayer.reset();
      }
      
      // 📊 CRÍTICO: Detener logger de historial
      if (playbackLogger.isActive) {
        logger.dev('📊 Deteniendo logger de historial...');
        playbackLogger.detener();
      }
      
      // 🧹 CRÍTICO: Limpiar variables globales
      logger.dev('🧹 Limpiando variables globales...');
      window.currentPlayerChannelId = null;
      window.currentPlayerChannelName = null;
      window.channelsRealtimeActive = false;
      window.suppressAutoSelect = false;
      
      // Limpiar servicios de debug
      delete window.scheduledContentDebug;
      delete window.forceWatchdogRecovery;
      delete window.simulateAudioHang;
      
      // Ejecutar cleanup del servicio de presencia
      if (typeof window.__presence_cleanup === 'function') {
        try {
          window.__presence_cleanup();
        } catch (e) {
          logger.warn('⚠️ Error ejecutando presence cleanup:', e);
        }
        delete window.__presence_cleanup;
      }
      
      logger.dev('✅ Variables globales limpiadas');
      logger.dev('✅ Servicios detenidos - cerrando sesión...');
      
      await signOut();
      logger.dev('✅ Sesión cerrada - redirigiendo a login...');
      
      // ✅ CRÍTICO: Navegar a /login antes de recargar
      navigate('/login', { replace: true });
      
      // ✅ CRÍTICO Windows/Electron: Recargar la app para limpiar completamente
      // Usar IPC para recargar desde el proceso principal (más seguro que window.location.reload)
      if (window.electronAPI?.reloadApp) {
        logger.dev('🔄 Recargando aplicación Electron...');
        setTimeout(() => {
          window.electronAPI.reloadApp();
        }, 500); // Pequeño delay para que termine el signOut
      } else {
        // Fallback para navegador web: redirigir a /login y recargar
        setTimeout(() => {
          window.location.href = '/login';
        }, 300);
      }
    } catch (error) {
      logger.error('❌ Error al cerrar sesión:', error);
      // Incluso si hay error, navegar a login y forzar reload para estado limpio
      navigate('/login', { replace: true });
      if (window.electronAPI?.reloadApp) {
        setTimeout(() => {
          window.electronAPI.reloadApp();
        }, 500);
      } else {
        setTimeout(() => {
          window.location.href = '/login';
        }, 300);
      }
    }
  };

  // Elementos de navegación para administradores
  const navItems = [
    { 
      path: '/admin/dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      permission: 'showAdminPanel',
      description: 'Visión general del sistema'
    },
    { 
      path: '/admin/mapa', 
      label: 'Mapa en Directo', 
      icon: Map,
      permission: 'showAdminPanel',
      description: 'Visualización geográfica en tiempo real'
    },
    { 
      path: '/admin/anuncios-rapidos', 
      label: 'Anuncios con IA', 
      icon: Megaphone,
      permission: 'canManageAIAds',
      description: 'Generar anuncios con inteligencia artificial'
    },
    { 
      path: '/admin/programaciones', 
      label: 'Programaciones', 
      icon: Calendar,
      permission: 'canManageUsers',
      description: 'Gestionar programaciones activas',
      divider: true
    },
    { 
      path: '/admin/contenidos', 
      label: 'Gestión de Contenidos', 
      icon: FileText,
      permission: 'canManageUsers',
      description: 'Administrar contenidos multimedia'
    },
    { 
      path: '/admin/canales', 
      label: 'Gestión de Canales', 
      icon: Radio,
      permission: 'canManageUsers',
      description: 'Administrar canales de emisión'
    },
    { 
      path: '/admin/usuarios-grupos', 
      label: 'Gestión de Usuarios y Grupos', 
      icon: Users,
      permission: 'canManageUsers',
      description: 'Crear y administrar grupos de usuarios'
    },
    { 
      path: '/admin/empresas', 
      label: 'Gestión de Empresas', 
      icon: Building2,
      permission: 'canManageUsers',
      description: 'Administrar empresas y relaciones'
    },
    { 
      path: '/', 
      label: 'Volver al Reproductor', 
      icon: Radio,
      permission: 'canAccessPlayer',
      description: 'Interfaz de reproducción',
      divider: true
    }
  ];

  // Filtrar elementos según permisos
  const filteredNavItems = navItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Desktop */}
      <AnimatePresence mode="wait">
        <motion.aside
          initial={false}
          animate={{ 
            width: sidebarCollapsed ? '80px' : '280px',
            transition: { duration: 0.3, ease: 'easeInOut' }
          }}
          className="hidden lg:flex flex-col bg-black/5 dark:bg-white/5 border-r border-black/10 dark:border-white/10"
        >
          {/* Header del sidebar - Logo Ondeón */}
          <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
            {!sidebarCollapsed ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <img
                    src={`${import.meta.env.BASE_URL || ''}assets/icono-ondeon.png`}
                    alt="Ondeón Logo"
                    className="h-12 w-12 drop-shadow-lg"
                    onError={(e) => {
                      console.error('Error al cargar el logo en AdminLayout');
                      e.target.style.display = 'none';
                    }}
                  />
                  <div>
                    <h2 className="text-sm font-semibold">Panel Admin</h2>
                    <p className="text-xs text-muted-foreground">Gestión Ondeon</p>
                  </div>
                </motion.div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(true)}
                  className="ml-auto"
                  title="Contraer menú"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center w-full gap-3"
              >
                <img
                  src={`${import.meta.env.BASE_URL || ''}assets/icono-ondeon.png`}
                  alt="Ondeón Logo"
                  className="h-10 w-10 drop-shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(false)}
                  className="w-10 h-10 hover:bg-primary/10"
                  title="Expandir menú"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </div>

          {/* Navegación */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <React.Fragment key={item.path}>
                    {item.divider && <div className="my-4 border-t border-black/10 dark:border-white/10" />}
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground'
                      }`}
                      title={sidebarCollapsed ? item.label : item.description}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col"
                        >
                          <span className="text-sm font-medium">{item.label}</span>
                          {isActive && (
                            <span className="text-xs text-muted-foreground">{item.description}</span>
                          )}
                        </motion.div>
                      )}
                    </Link>
                  </React.Fragment>
                );
              })}
            </div>
          </nav>

          {/* Footer del sidebar - Botón Logout */}
          <div className="p-4 border-t border-black/10 dark:border-white/10">
            {!sidebarCollapsed ? (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Cerrar Sesión</span>
              </motion.button>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all duration-200"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </motion.aside>
      </AnimatePresence>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </Button>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Sidebar */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-black/10 dark:border-white/10 z-50 flex flex-col"
            >
              {/* Header - Logo Ondeón */}
              <div className="flex items-center gap-3 p-4 border-b border-black/10 dark:border-white/10">
                <img
                  src={`${import.meta.env.BASE_URL || ''}assets/icono-ondeon.png`}
                  alt="Ondeón Logo"
                  className="h-12 w-12 drop-shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div>
                  <h2 className="text-sm font-semibold">Panel Admin</h2>
                  <p className="text-xs text-muted-foreground">Gestión Ondeon</p>
                </div>
              </div>

              {/* Navegación */}
              <nav className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {filteredNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                      <React.Fragment key={item.path}>
                        {item.divider && <div className="my-4 border-t border-black/10 dark:border-white/10" />}
                        <Link
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground'
                          }`}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{item.description}</span>
                          </div>
                        </Link>
                      </React.Fragment>
                    );
                  })}
                </div>
              </nav>

              {/* Footer Mobile - Botón Logout */}
              <div className="p-4 border-t border-black/10 dark:border-white/10">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all duration-200"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Cerrar Sesión</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Área de contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

