import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, Music, Mic, ChevronUp } from 'lucide-react';

/**
 * MiniPlayer flotante - Se muestra encima del BottomNavigation
 * Incluye controles de reproducción + volumen desplegable
 */
const MiniPlayer = ({ 
  isPlaying, 
  onPlayPause, 
  onSkipNext,
  trackTitle = '', 
  trackArtist = '',
  disabled = false,
  isVisible = true,
  musicVolume = 80,
  contentVolume = 100,
  onMusicVolumeChange,
  onContentVolumeChange,
  isMobile = true,
  embedded = false  // Dentro de un contenedor padre (sin position fixed, sin fondo propio)
}) => {
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef(null);

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

  if (!isVisible) return null;

  const musicBg = `linear-gradient(90deg, #A2D9F7 ${musicVolume}%, rgba(255,255,255,0.08) ${musicVolume}%)`;
  const contentBg = `linear-gradient(90deg, #A2D9F7 ${contentVolume}%, rgba(255,255,255,0.08) ${contentVolume}%)`;

  const wrapperClass = embedded
    ? 'relative w-full max-w-sm'
    : `fixed ${isMobile ? 'z-40 left-2.5 right-2.5' : 'z-[51] left-1/2 -translate-x-1/2 w-full max-w-sm px-3'}`;
  const wrapperStyle = embedded ? {} : { bottom: isMobile ? '54px' : '160px' };

  return (
    <div ref={volumeRef} className={wrapperClass} style={wrapperStyle}>
      {/* Panel de volumen desplegable */}
      <AnimatePresence>
        {showVolume && (
          <motion.div
            initial={{ opacity: 0, y: 10, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: 10, scaleY: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-2 mx-1 px-4 py-3.5 rounded-2xl border border-white/[0.08] origin-bottom"
            style={{
              backgroundColor: 'rgba(13, 17, 23, 0.95)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.5)'
            }}
          >
            {/* Música */}
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

            {/* Contenido */}
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

      {/* Barra principal del MiniPlayer */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div 
          className={`flex items-center gap-3 px-3.5 py-2 ${embedded ? 'rounded-xl' : 'rounded-2xl'}`}
          style={embedded ? {} : {
            backgroundColor: 'rgba(10, 14, 20, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)'
          }}
        >
          {/* Indicador de reproducción animado */}
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

          {/* Info de la canción */}
          <div className="flex-1 min-w-0 mr-1">
            <p className="text-[13px] font-medium text-white truncate leading-tight">
              {trackTitle || 'Sin reproducción'}
            </p>
            <p className="text-[11px] text-white/40 truncate leading-tight mt-0.5">
              {trackArtist || '—'}
            </p>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Botón volumen */}
            <motion.button
              onClick={() => setShowVolume(!showVolume)}
              whileTap={{ scale: 0.85 }}
              className={`w-8 h-8 flex items-center justify-center rounded-full
                transition-colors duration-150
                ${showVolume ? 'bg-[#A2D9F7]/15' : 'active:bg-white/[0.08]'}`}
            >
              <ChevronUp 
                size={15} 
                className={`transition-transform duration-200 ${showVolume ? 'rotate-180 text-[#A2D9F7]/70' : 'text-white/40'}`} 
              />
            </motion.button>

            {/* Play/Pause */}
            <motion.button
              onClick={onPlayPause}
              disabled={disabled}
              whileTap={!disabled ? { scale: 0.85 } : {}}
              className="w-9 h-9 flex items-center justify-center rounded-full
                bg-white/[0.1] border border-white/[0.08]
                disabled:opacity-30 disabled:cursor-not-allowed
                active:bg-white/[0.18] transition-colors duration-150"
            >
              {isPlaying ? (
                <Pause size={16} className="text-white" fill="currentColor" />
              ) : (
                <Play size={16} className="text-white ml-0.5" fill="currentColor" />
              )}
            </motion.button>

            {/* Skip Forward */}
            <motion.button
              onClick={onSkipNext}
              disabled={disabled}
              whileTap={!disabled ? { scale: 0.85 } : {}}
              className="w-8 h-8 flex items-center justify-center rounded-full
                disabled:opacity-30 disabled:cursor-not-allowed
                active:bg-white/[0.08] transition-colors duration-150"
            >
              <SkipForward size={15} className="text-white/60" fill="currentColor" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Estilos para los sliders de volumen */}
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

export default MiniPlayer;
