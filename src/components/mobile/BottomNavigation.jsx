import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Home, 
  Radio, 
  BookOpen,
  PlusCircle, 
  History
} from 'lucide-react';

/**
 * Navegación inferior moderna estilo iOS/Spotify
 * Diseño glassmorphism con animaciones fluidas
 */
const BottomNavigation = ({ className = '' }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { 
      path: '/', 
      icon: Home, 
      label: t('nav.player', 'Inicio')
    },
    { 
      path: '/canales', 
      icon: Radio, 
      label: t('nav.channels', 'Canales')
    },
    { 
      path: '/anuncio-nuevo', 
      icon: PlusCircle, 
      label: t('nav.createAd', 'Crear Anuncio'),
      isAction: true
    },
    { 
      path: '/contenidos', 
      icon: BookOpen, 
      label: t('nav.contents', 'Contenidos')
    },
    { 
      path: '/historial-anuncios', 
      icon: History, 
      label: t('nav.history', 'Historial')
    },
  ];

  return (
      <nav 
        className={`fixed left-0 right-0 bottom-0 z-50 border-t border-white/10 ${className}`}
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backgroundColor: '#0a0e14',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.8)'
        }}
      >
      <div className="flex items-center justify-around h-[58px] max-w-md mx-auto px-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          const Icon = item.icon;
          
          // Botón de acción central (Crear Anuncio)
          if (item.isAction) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center -mt-3"
              >
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  {/* Botón principal - azul más suave */}
                  <div className={`
                    relative w-12 h-12 rounded-full 
                    bg-gradient-to-br from-[#6BA8C7] via-[#5A9AB8] to-[#4A8BA9]
                    shadow-lg shadow-[#5A9AB8]/20
                    flex items-center justify-center
                    border border-white/10
                  `}>
                    <Icon 
                      size={22}
                      className="text-white"
                      strokeWidth={2}
                    />
                  </div>
                </motion.div>
                
                {/* Etiqueta alineada */}
                <span className="text-[9px] text-center mt-1.5 text-[#6BA8C7] font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          }
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex flex-col items-center justify-end min-w-[60px] pb-2"
            >
              {/* Contenedor del icono */}
              <motion.div
                animate={{ 
                  scale: isActive ? 1.1 : 1,
                  y: isActive ? -2 : 0
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative"
              >
                <Icon 
                  size={22}
                  className={`
                    transition-colors duration-200
                    ${isActive 
                      ? 'text-[#A2D9F7]' 
                      : 'text-white/40'}
                  `}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>
              
              {/* Etiqueta */}
              <span className={`
                text-[10px] mt-1 font-medium tracking-wide
                transition-colors duration-200
                ${isActive 
                  ? 'text-[#A2D9F7]' 
                  : 'text-white/40'}
              `}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
