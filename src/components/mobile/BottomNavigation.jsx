import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Home, 
  Radio, 
  PlusCircle, 
  History, 
  User 
} from 'lucide-react';

/**
 * Navegación inferior estilo app mobile
 * Diseño minimalista con iconos y etiquetas
 */
const BottomNavigation = ({ className = '' }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { 
      path: '/', 
      icon: Home, 
      label: t('nav.player', 'Player'),
      activeColor: '#A2D9F7'
    },
    { 
      path: '/canales', 
      icon: Radio, 
      label: t('nav.channels', 'Canales'),
      activeColor: '#A2D9F7'
    },
    { 
      path: '/anuncio-nuevo', 
      icon: PlusCircle, 
      label: t('nav.createAd', 'Nuevo'),
      activeColor: '#4ADE80',
      isAction: true
    },
    { 
      path: '/historial-anuncios', 
      icon: History, 
      label: t('nav.history', 'Historial'),
      activeColor: '#A2D9F7'
    },
    { 
      path: '/gestor', 
      icon: User, 
      label: t('nav.myAccount', 'Cuenta'),
      activeColor: '#A2D9F7'
    },
  ];

  return (
    <nav className={`
      fixed bottom-0 left-0 right-0 z-50
      bg-background/95 backdrop-blur-xl
      border-t border-white/10 dark:border-white/5
      px-2 pb-safe
      ${className}
    `}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[56px] h-full px-3 py-2
                transition-all duration-200
                ${item.isAction ? 'scale-110' : ''}
              `}
            >
              {/* Indicador activo */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-x-2 top-0 h-0.5 rounded-full"
                  style={{ backgroundColor: item.activeColor }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              
              {/* Icono con fondo para acción principal */}
              <div className={`
                relative flex items-center justify-center
                ${item.isAction 
                  ? 'w-12 h-12 -mt-6 rounded-full bg-gradient-to-br from-[#A2D9F7] to-[#7BC4E0] shadow-lg shadow-[#A2D9F7]/30' 
                  : 'w-8 h-8'}
              `}>
                <Icon 
                  size={item.isAction ? 24 : 22}
                  className={`
                    transition-all duration-200
                    ${item.isAction 
                      ? 'text-[#0a0e14]' 
                      : isActive 
                        ? 'text-[#A2D9F7]' 
                        : 'text-foreground/50'}
                  `}
                  strokeWidth={isActive || item.isAction ? 2.5 : 2}
                />
              </div>
              
              {/* Etiqueta */}
              <span className={`
                text-[10px] mt-1 font-medium tracking-wide
                transition-all duration-200
                ${item.isAction 
                  ? 'text-[#A2D9F7] mt-2' 
                  : isActive 
                    ? 'text-[#A2D9F7]' 
                    : 'text-foreground/40'}
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
