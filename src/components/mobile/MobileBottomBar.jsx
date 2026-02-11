import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Radio,
  BookOpen,
  PlusCircle,
  History,
  Play,
  Pause,
  SkipForward,
  Music,
  Mic,
  ChevronUp
} from 'lucide-react';

/**
 * Barra inferior unificada - MiniPlayer + Navegación
 * El MiniPlayer es una extensión de la barra, no un contenedor superpuesto
 */
const MobileBottomBar = ({
  // Player props
  showPlayer = false,
  isPlaying = false,
  onPlayPause,
  onSkipNext,
  trackTitle = '',
  trackArtist = '',
  disabled = false,
  musicVolume = 80,
  contentVolume = 100,
  onMusicVolumeChange,
  onContentVolumeChange
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const currentPath = location.pathname;
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef(null);

  const navItems = [
    { path: '/', icon: Home, label: t('nav.player', 'Inicio') },
    { path: '/canales', icon: Radio, label: t('nav.channels', 'Canales') },
    { path: '/anuncio-nuevo', icon: PlusCircle, label: t('nav.createAd', 'Crear Anuncio'), isAction: true },
    { path: '/contenidos', icon: BookOpen, label: t('nav.contents', 'Contenidos') },
    { path: '/historial-anuncios', icon: History, label: t('nav.history', 'Historial') },
  ];

  // Cerrar panel de volumen al tocar fuera
  useEffect(() => {
    if (!showVolume) return;
    const handleClickOutside = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target)) {
        setShowVolume(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showVolume]);

  const musicBg = `linear-gradient(90deg, #A2D9F7 ${musicVolume}%, rgba(255,255,255,0.08) ${musicVolume}%)`;
  const contentBg = `linear-gradient(90deg, #A2D9F7 ${contentVolume}%, rgba(255,255,255,0.08) ${contentVolume}%)`;

  return (
    <div
      ref={volumeRef}
      className={`fixed left-0 right-0 bottom-0 z-50 flex flex-col ${showPlayer ? 'rounded-t-2xl' : ''}`}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: '#0a0e14',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.8)',
        borderTop: showPlayer ? 'none' : '1px solid rgba(255,255,255,0.1)'
      }}
    >
      {/* MiniPlayer - Protuberancia que sale del menú (sin línea divisoria) */}
      <AnimatePresence>
        {showPlayer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pt-2.5 pb-0">
              {/* Panel de volumen desplegable */}
              <AnimatePresence>
                {showVolume && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scaleY: 0.9 }}
                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                    exit={{ opacity: 0, y: 10, scaleY: 0.9 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="mb-2 px-4 py-3.5 rounded-2xl origin-bottom"
                    style={{
                      backgroundColor: 'rgba(13, 17, 23, 0.95)',
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Music size={14} className="text-[#A2D9F7]/60 flex-shrink-0" />
                      <span className="text-[11px] text-white/40 w-16 flex-shrink-0">Música</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={musicVolume}
                        onChange={(e) => onMusicVolumeChange?.(parseInt(e.target.value))}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer mini-volume-slider"
                        style={{ background: musicBg }}
                      />
                      <span className="text-[11px] text-white/30 w-8 text-right tabular-nums">{musicVolume}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mic size={14} className="text-[#A2D9F7]/60 flex-shrink-0" />
                      <span className="text-[11px] text-white/40 w-16 flex-shrink-0">Contenido</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={contentVolume}
                        onChange={(e) => onContentVolumeChange?.(parseInt(e.target.value))}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer mini-volume-slider"
                        style={{ background: contentBg }}
                      />
                      <span className="text-[11px] text-white/30 w-8 text-right tabular-nums">{contentVolume}%</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Barra del MiniPlayer - esquinas superiores redondeadas, base plana que se funde con la nav */}
              <div 
                className="flex items-center gap-3 px-3.5 py-2 rounded-t-2xl"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  {isPlaying ? (
                    <div className="flex items-end gap-[2px] h-3.5">
                      <motion.div
                        className="w-[3px] bg-[#A2D9F7] rounded-full"
                        animate={{ height: ['6px', '14px', '8px', '12px', '6px'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="w-[3px] bg-[#A2D9F7] rounded-full"
                        animate={{ height: ['12px', '6px', '14px', '6px', '10px'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
                      />
                      <motion.div
                        className="w-[3px] bg-[#A2D9F7] rounded-full"
                        animate={{ height: ['8px', '14px', '6px', '10px', '14px'] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-end gap-[2px] h-3.5">
                      <div className="w-[3px] h-[6px] bg-white/20 rounded-full" />
                      <div className="w-[3px] h-[10px] bg-white/20 rounded-full" />
                      <div className="w-[3px] h-[6px] bg-white/20 rounded-full" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 mr-1">
                  <p className="text-[13px] font-medium text-white truncate leading-tight">
                    {trackTitle || 'Sin reproducción'}
                  </p>
                  <p className="text-[11px] text-white/40 truncate leading-tight mt-0.5">
                    {trackArtist || '—'}
                  </p>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <motion.button
                    onClick={() => setShowVolume(!showVolume)}
                    whileTap={{ scale: 0.85 }}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150
                      ${showVolume ? 'bg-[#A2D9F7]/15' : 'active:bg-white/[0.08]'}`}
                  >
                    <ChevronUp
                      size={15}
                      className={`transition-transform duration-200 ${showVolume ? 'rotate-180 text-[#A2D9F7]/70' : 'text-white/40'}`}
                    />
                  </motion.button>
                  <motion.button
                    onClick={onPlayPause}
                    disabled={disabled}
                    whileTap={!disabled ? { scale: 0.85 } : {}}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.1] border border-white/[0.08]
                      disabled:opacity-30 disabled:cursor-not-allowed active:bg-white/[0.18] transition-colors duration-150"
                  >
                    {isPlaying ? (
                      <Pause size={16} className="text-white" fill="currentColor" />
                    ) : (
                      <Play size={16} className="text-white ml-0.5" fill="currentColor" />
                    )}
                  </motion.button>
                  <motion.button
                    onClick={onSkipNext}
                    disabled={disabled}
                    whileTap={!disabled ? { scale: 0.85 } : {}}
                    className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed
                      active:bg-white/[0.08] transition-colors duration-150"
                  >
                    <SkipForward size={15} className="text-white/60" fill="currentColor" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navegación - Misma pieza que MiniPlayer, sin línea entre ellos */}
      <nav 
        className="flex items-center justify-around h-[58px] max-w-md mx-auto px-1 flex-shrink-0"
        style={{ backgroundColor: '#0a0e14' }}
      >
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          const Icon = item.icon;

          if (item.isAction) {
            return (
              <Link key={item.path} to={item.path} className="relative flex flex-col items-center -mt-3">
                <motion.div whileTap={{ scale: 0.95 }} className="relative">
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-[#6BA8C7] via-[#5A9AB8] to-[#4A8BA9]
                    shadow-lg shadow-[#5A9AB8]/20 flex items-center justify-center border border-white/10">
                    <Icon size={22} className="text-white" strokeWidth={2} />
                  </div>
                </motion.div>
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
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -2 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative"
              >
                <Icon
                  size={22}
                  className={`transition-colors duration-200 ${isActive ? 'text-[#A2D9F7]' : 'text-white/40'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>
              <span
                className={`text-[10px] mt-1 font-medium tracking-wide transition-colors duration-200
                  ${isActive ? 'text-[#A2D9F7]' : 'text-white/40'}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        .mini-volume-slider {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 2px;
          outline: none;
        }
        .mini-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #A2D9F7;
          cursor: pointer;
          border: 2px solid rgba(13, 17, 23, 0.9);
          box-shadow: 0 0 6px rgba(162, 217, 247, 0.3);
        }
        .mini-volume-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #A2D9F7;
          cursor: pointer;
          border: 2px solid rgba(13, 17, 23, 0.9);
          box-shadow: 0 0 6px rgba(162, 217, 247, 0.3);
        }
      `}</style>
    </div>
  );
};

export default MobileBottomBar;
