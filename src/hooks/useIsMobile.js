import { useState, useEffect } from 'react';

/**
 * Hook para detectar si el dispositivo es móvil
 * Usa tanto media queries como detección de touch
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    // Función para verificar el tamaño de pantalla
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setIsMobile(width < breakpoint);
      setIsTablet(width >= breakpoint && width < 1024);
      setOrientation(height > width ? 'portrait' : 'landscape');
    };

    // Verificar al montar
    checkDevice();

    // Escuchar cambios de tamaño
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, [breakpoint]);

  // Detectar dispositivo táctil
  const isTouchDevice = typeof window !== 'undefined' && 
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isTouchDevice,
    orientation,
    // Métodos de utilidad
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
  };
}

export default useIsMobile;
