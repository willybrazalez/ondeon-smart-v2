import React from 'react';
import { useLocation } from 'react-router-dom';
import MobileHeader from '@/components/mobile/MobileHeader';
import BottomNavigation from '@/components/mobile/BottomNavigation';

/**
 * Layout principal para móvil
 * Incluye header compacto y navegación inferior
 */
const MobileLayout = ({ 
  children, 
  onLogout,
  showHeader = true,
  showNavigation = true,
  transparentHeader = false,
  className = '' 
}) => {
  const location = useLocation();
  const isPlayerPage = location.pathname === '/';

  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {/* Header */}
      {showHeader && (
        <MobileHeader 
          onLogout={onLogout}
          transparent={transparentHeader || isPlayerPage}
        />
      )}

      {/* Contenido principal */}
      <main className={`
        flex-1 
        ${showHeader ? 'pt-14' : ''} 
        ${showNavigation ? 'pb-20' : ''}
        overflow-y-auto
        overflow-x-hidden
      `}>
        {children}
      </main>

      {/* Navegación inferior */}
      {showNavigation && <BottomNavigation />}
    </div>
  );
};

export default MobileLayout;
