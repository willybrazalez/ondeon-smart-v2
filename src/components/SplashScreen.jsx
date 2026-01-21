import React, { useState, useEffect } from 'react';

/**
 * Splash Screen con branding de Ondeon
 * Se muestra al iniciar la app y desaparece con una animación elegante
 */
const SplashScreen = ({ onFinish, minDuration = 2000 }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Esperar el tiempo mínimo y luego iniciar fade out
    const timer = setTimeout(() => {
      setIsFading(true);
      // Esperar a que termine la animación de fade
      setTimeout(() => {
        setIsVisible(false);
        onFinish?.();
      }, 500);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onFinish]);

  if (!isVisible) return null;

  return (
    <div 
      className={`
        fixed inset-0 z-[9999] 
        flex flex-col items-center justify-center
        bg-[#0a0e14]
        transition-opacity duration-500 ease-out
        ${isFading ? 'opacity-0' : 'opacity-100'}
      `}
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Logo con animación */}
      <div className={`
        flex flex-col items-center gap-6
        transition-all duration-700 ease-out
        ${isFading ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}
      `}>
        {/* Icono */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 blur-2xl bg-[#A2D9F7]/20 rounded-full scale-150 animate-pulse" />
          <img
            src="/assets/icono-ondeon.png"
            alt="Ondeon"
            className="relative w-24 h-24 drop-shadow-2xl animate-[float_3s_ease-in-out_infinite]"
          />
        </div>
        
        {/* Texto SMART */}
        <div className="flex items-center gap-3">
          <span className="text-3xl tracking-[0.2em] font-light text-[#A2D9F7]">
            SMART
          </span>
        </div>
        
        {/* Línea decorativa animada */}
        <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[#A2D9F7]/50 to-transparent animate-pulse" />
        
        {/* Texto de carga */}
        <p className="text-white/40 text-sm tracking-wider animate-pulse">
          Cargando...
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
