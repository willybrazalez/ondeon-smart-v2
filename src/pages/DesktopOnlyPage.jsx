import React, { useEffect } from 'react';
import { 
  Monitor, 
  Apple, 
  Download, 
  LogOut,
  Music,
  Radio,
  Headphones,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import logger from '@/lib/logger';

/**
 * Página mostrada a usuarios básicos (rol_id = 1) cuando intentan acceder desde web.
 * Les indica que el reproductor solo está disponible en la aplicación de escritorio.
 * Diseño minimalista y elegante.
 */
export default function DesktopOnlyPage() {
  const { user, signOut } = useAuth();

  // 🌙 Forzar tema oscuro
  useEffect(() => {
    const previousTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    
    return () => {
      if (previousTheme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    };
  }, []);

  // Detectar sistema operativo
  const getOS = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'mac';
    if (userAgent.includes('linux')) return 'linux';
    return 'windows';
  };

  const os = getOS();

  // URLs de descarga
  const downloadUrls = {
    windows: 'https://releases.ondeon.es/Ondeon-Setup.exe',
    mac: 'https://releases.ondeon.es/Ondeon.dmg',
  };

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.replace('/login');
    } catch (error) {
      logger.error('Error al cerrar sesión:', error);
    }
  };

  const handleDownload = (platform) => {
    const url = downloadUrls[platform] || downloadUrls.windows;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0e14]">
      {/* Fondo gradiente sutil */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e14] via-[#0f1419] to-[#0a0e14]" />
      
      {/* Patrón de puntos sutil */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #A2D9F7 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Contenido principal */}
      <div className="w-full max-w-sm mx-auto z-10 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          {/* Logo */}
          <div className="mb-8">
            <img 
              src={`${import.meta.env.BASE_URL || ''}assets/icono-ondeon.png`}
              alt="Logo Ondeón" 
              className="h-14 w-14 mx-auto mb-5 opacity-90"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <h1 className="text-lg font-light tracking-[0.25em] text-white/90 mb-1">
              ONDEON
            </h1>
            <p className="text-[11px] tracking-[0.15em] text-white/40 uppercase">
              Smart Radio
            </p>
          </div>

          {/* Mensaje principal */}
          <div className="mb-8">
            <div className="w-10 h-10 mx-auto mb-4 rounded-lg bg-white/[0.03] border border-white/[0.06]
                          flex items-center justify-center">
              <Monitor className="w-5 h-5 text-[#A2D9F7]/70" />
            </div>
            <h2 className="text-base font-normal text-white/80 mb-2">
              Aplicación de escritorio
            </h2>
            <p className="text-sm text-white/40 leading-relaxed max-w-[280px] mx-auto">
              El reproductor está disponible en nuestra aplicación para ordenadores
            </p>
          </div>

          {/* Usuario conectado */}
          {user && (
            <div className="mb-6 py-2.5 px-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <p className="text-xs text-white/30">Sesión activa</p>
              <p className="text-sm text-white/60 truncate mt-0.5">
                {user.email || user.username || user.nombre_usuario}
              </p>
            </div>
          )}

          {/* Features minimalistas */}
          <div className="flex justify-center gap-6 mb-8">
            {[
              { icon: Music, label: 'Música 24/7' },
              { icon: Radio, label: '+28 Canales' },
              { icon: Headphones, label: 'Alta calidad' },
            ].map((feature) => (
              <div key={feature.label} className="text-center">
                <feature.icon className="w-4 h-4 mx-auto mb-1.5 text-white/30" />
                <p className="text-[10px] text-white/30">{feature.label}</p>
              </div>
            ))}
          </div>

          {/* Botones de descarga - ambos iguales */}
          <div className="space-y-3">
            <Button 
              size="lg"
              className="w-full h-11 text-sm font-normal rounded-lg
                       bg-white/[0.03] hover:bg-white/[0.06] 
                       text-white/70 hover:text-white/90 border border-white/10
                       transition-all duration-200"
              onClick={() => handleDownload('windows')}
            >
              <Monitor className="w-4 h-4 mr-2 opacity-60" />
              Descargar para Windows
            </Button>
            
            <Button 
              size="lg"
              className="w-full h-11 text-sm font-normal rounded-lg
                       bg-white/[0.03] hover:bg-white/[0.06] 
                       text-white/70 hover:text-white/90 border border-white/10
                       transition-all duration-200"
              onClick={() => handleDownload('mac')}
            >
              <Apple className="w-4 h-4 mr-2 opacity-60" />
              Descargar para macOS
            </Button>
          </div>

          {/* Pasos */}
          <div className="mt-8 space-y-2">
            {[
              'Descarga el instalador',
              'Ejecuta el archivo',
              'Inicia sesión',
            ].map((step, index) => (
              <div key={step} className="flex items-center gap-2 text-left">
                <span className="w-5 h-5 rounded-full bg-white/[0.03] border border-white/[0.06]
                               flex items-center justify-center text-[10px] text-white/40">
                  {index + 1}
                </span>
                <span className="text-xs text-white/35">{step}</span>
                {index < 2 && <ChevronRight className="w-3 h-3 text-white/20 ml-auto" />}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-white/[0.04]">
            <button 
              className="text-xs text-white/25 hover:text-white/40 transition-colors flex items-center gap-1.5 mx-auto"
              onClick={handleLogout}
            >
              <LogOut className="w-3 h-3" />
              Cerrar sesión
            </button>
            
            <p className="text-[10px] text-white/20 mt-4">
              ¿Ayuda?{' '}
              <a href="mailto:soporte@ondeon.es" className="text-[#A2D9F7]/40 hover:text-[#A2D9F7]/60 transition-colors">
                soporte@ondeon.es
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
