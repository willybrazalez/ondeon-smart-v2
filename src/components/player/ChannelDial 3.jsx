import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Import cn utility
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

const getThemeColors = (theme) => {
  if (theme === 'dark') {
    return {
      centerChannelColor: 'hsl(270, 75%, 80%)', 
      sideChannelColor: 'hsl(240, 20%, 65%)',   
      centerIconColor: 'hsl(270, 70%, 75%)',    
      centerTextShadow: '0px 1px 3px hsla(270, 70%, 50%, 0.4), 0px 0px 10px hsla(270, 70%, 60%, 0.25)',
      sideTextShadow: '0px 1px 2px hsla(0, 0%, 0%, 0.3)',
      auraColors: {
        primary: 'hsla(270, 75%, 80%, 0.45)', // Lila principal para aura
        accent: 'hsla(300, 80%, 70%, 0.3)', // Rosa-Lila acento para aura
        secondary: 'hsla(270, 75%, 80%, 0.2)'  // Lila secundario más tenue
      }
    };
  }
  // Light theme (original)
  return {
    centerChannelColor: 'hsl(140, 70%, 15%)', 
    sideChannelColor: 'hsl(140, 50%, 25%)',   
    centerIconColor: 'hsl(140, 70%, 15%)',    
    centerTextShadow: '0px 1px 2px hsla(0,0%,100%,0.3), 0px 2px 4px hsla(var(--primary-rgb),0.1)',
    sideTextShadow: '0px 1px 1px hsla(0,0%,100%,0.2)',
    auraColors: {
      primary: 'hsla(var(--primary-rgb), 0.4)', // Verde primario para aura
      accent: 'hsla(var(--accent-rgb), 0.3)',   // Acento lima para aura
      secondary: 'hsla(var(--primary-rgb), 0.18)' // Verde secundario más tenue
    }
  };
};

const ChannelDial = ({ channels, currentChannel, setCurrentChannel, isPlaying }) => { // Added isPlaying prop
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const [theme, setTheme] = useState(localStorage.getItem('ondeon-smart-theme') || 'light');
  
  // 🔒 Obtener estado de reproducción manual para bloquear navegación de canales
  const { isManualPlaybackActive, manualPlaybackInfo } = useAuth();

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('ondeon-smart-theme') || 'light');
    };
    window.addEventListener('storage', handleThemeChange); 
    
    const observer = new MutationObserver((mutationsList) => {
      for(let mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (document.documentElement.classList.contains('dark')) {
            setTheme('dark');
          } else {
            setTheme('light');
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener('storage', handleThemeChange);
      observer.disconnect();
    };
  }, []);


  useEffect(() => {
    const initialIndex = channels.findIndex(ch => ch.id === currentChannel.id);
    if (initialIndex !== -1) {
      setCurrentIndex(initialIndex);
    } else if (channels.length > 0) {
      setCurrentIndex(0);
      setCurrentChannel(channels[0]);
    }
  }, [channels, currentChannel.id, setCurrentChannel]);

  if (!channels || channels.length === 0) {
    return <div className="text-center text-muted-foreground/70 py-3 font-sans">No hay canales disponibles.</div>;
  }

  const navigateChannel = (dir) => {
    // 🔒 BLOQUEO: No permitir cambio de canal si hay reproducción manual activa
    if (isManualPlaybackActive) {
      logger.dev('🔒 Navegación de canal bloqueada - reproducción manual activa');
      return;
    }
    
    setDirection(dir);
    let newIndex;
    if (dir === 'next') {
      newIndex = (currentIndex + 1) % channels.length;
    } else {
      newIndex = (currentIndex - 1 + channels.length) % channels.length;
    }
    setCurrentIndex(newIndex);
    setCurrentChannel(channels[newIndex]);
  };

  const getChannelName = (index) => {
    if (index < 0 || index >= channels.length) return "";
    return channels[index].name;
  };

  const themeColors = getThemeColors(theme);

  const channelVariant = {
    center: {
      opacity: 1,
      scale: 1.05,
      x: 0,
      filter: `blur(0px) drop-shadow(0 1px 3px hsla(var(--primary-rgb), ${theme === 'dark' ? 0.3 : 0.2})) drop-shadow(0 0 8px hsla(var(--primary-rgb), ${theme === 'dark' ? 0.15 : 0.1}))`,
      transition: { type: 'spring', stiffness: 300, damping: 20 }
    },
    left: {
      opacity: 0.6,
      scale: 0.85,
      x: -90, 
      filter: 'blur(1.5px)',
      transition: { type: 'spring', stiffness: 300, damping: 25 }
    },
    right: {
      opacity: 0.6,
      scale: 0.85,
      x: 90, 
      filter: 'blur(1.5px)',
      transition: { type: 'spring', stiffness: 300, damping: 25 }
    },
    exit: (customDirection) => ({
      x: customDirection === 'next' ? -160 : 160, 
      opacity: 0,
      scale: 0.75,
      filter: 'blur(4px)',
      transition: { duration: 0.35, ease: 'anticipate' }
    }),
    enter: (customDirection) => ({
      x: customDirection === 'next' ? 160 : -160, 
      opacity: 0,
      scale: 0.75,
      filter: 'blur(4px)',
      transition: { duration: 0.35, ease: 'anticipate' }
    })
  };
  
  // Dynamically set aura colors using CSS variables
  const auraStyle = {
    '--aura-primary-color': themeColors.auraColors.primary,
    '--aura-accent-color': themeColors.auraColors.accent,
    '--aura-secondary-color': themeColors.auraColors.secondary,
  };

  const blockMessage = isManualPlaybackActive 
    ? `Controles bloqueados - Reproduciendo: ${manualPlaybackInfo?.contentName || 'contenido manual'}`
    : undefined;

  return (
    <div className="flex items-center justify-between w-full max-w-xs sm:max-w-sm mx-auto my-3 sm:my-4 h-16 overflow-hidden relative">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => navigateChannel('prev')} 
        disabled={isManualPlaybackActive}
        className="text-primary/70 hover:text-accent hover:bg-primary/5 rounded-full transition-colors transform hover:scale-110 z-10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label="Canal anterior"
        title={blockMessage || 'Canal anterior'}
      >
        <ChevronLeft size={28} />
      </Button>
      <div className="flex-1 flex items-center justify-center h-full relative">
        <motion.div
          key={`${getChannelName(currentIndex)}-center`}
          variants={channelVariant}
          initial="enter"
          animate="center"
          exit="exit"
          className={cn(
            "flex items-center text-lg sm:text-xl font-semibold truncate px-3 py-1.5 rounded-lg font-sans",
            isPlaying && "channel-aura-active",
            isManualPlaybackActive && "opacity-60"
          )}
          style={{ 
            color: themeColors.centerChannelColor, 
            textShadow: themeColors.centerTextShadow,
            ...auraStyle
          }}
          title={blockMessage}
        >
          <Radio size={18} className="mr-2 opacity-80" style={{ color: themeColors.centerIconColor, filter: `drop-shadow(0 1px 1px hsla(0,0%,${theme === 'dark' ? '10%' : '100%'},0.4))` }} />
          {getChannelName(currentIndex)}
        </motion.div>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => navigateChannel('next')} 
        disabled={isManualPlaybackActive}
        className="text-primary/70 hover:text-accent hover:bg-primary/5 rounded-full transition-colors transform hover:scale-110 z-10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label="Canal siguiente"
        title={blockMessage || 'Canal siguiente'}
      >
        <ChevronRight size={28} />
      </Button>
    </div>
  );
};

export default ChannelDial;