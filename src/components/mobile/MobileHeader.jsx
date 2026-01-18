import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LogOut, Circle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Header compacto para móvil
 * Muestra logo, usuario y acciones básicas
 */
const MobileHeader = ({ 
  onLogout,
  transparent = false,
  showUser = true,
  className = '' 
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Obtener nombre de usuario para mostrar
  const displayName = user?.user_metadata?.establecimiento 
    || user?.establecimiento 
    || user?.user_metadata?.username 
    || user?.username 
    || user?.nombre_usuario 
    || user?.email?.split('@')[0]
    || t('common.user');

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        fixed top-0 left-0 right-0 z-50
        ${transparent 
          ? 'bg-transparent' 
          : 'bg-background/90 backdrop-blur-xl border-b border-white/5'}
        safe-area-top
        ${className}
      `}
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img
            src="/assets/icono-ondeon.png"
            alt="Ondeón"
            className="h-10 w-10 drop-shadow-lg"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="text-lg tracking-[0.15em] font-light text-[#A2D9F7]">
            SMART
          </span>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1">
          {/* Usuario con indicador de conexión */}
          {showUser && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 mr-2">
              <span className="text-xs text-foreground/70 max-w-[100px] truncate">
                {displayName}
              </span>
              <Circle size={6} className="fill-green-500 text-green-500 flex-shrink-0" />
            </div>
          )}

          {/* Toggle de tema */}
          <ThemeToggle />

          {/* Logout */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onLogout}
            className="h-9 w-9 text-foreground/50 hover:text-red-400"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </motion.header>
  );
};

export default MobileHeader;
