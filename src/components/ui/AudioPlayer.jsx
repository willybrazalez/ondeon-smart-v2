import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

// Evento global para detener todos los demás audios
const STOP_ALL_AUDIO_EVENT = 'stopAllAudio';

/**
 * AudioPlayer personalizado con diseño minimalista
 * Sigue el tema del proyecto (primary, muted)
 * 
 * MEJORAS:
 * - Detiene automáticamente todos los demás AudioPlayer al reproducir uno nuevo
 * - Solo puede haber una reproducción activa a la vez
 */
const AudioPlayer = ({ src, className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const playerIdRef = useRef(`audio-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    // Escuchar evento global para detener este audio si otro empieza
    const handleStopAllAudio = (event) => {
      // Si el evento viene de otro AudioPlayer (no de este)
      if (event.detail.playerId !== playerIdRef.current) {
        if (!audio.paused) {
          audio.pause();
          setIsPlaying(false);
        }
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    window.addEventListener(STOP_ALL_AUDIO_EVENT, handleStopAllAudio);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      window.removeEventListener(STOP_ALL_AUDIO_EVENT, handleStopAllAudio);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Emitir evento para detener todos los demás audios
      window.dispatchEvent(new CustomEvent(STOP_ALL_AUDIO_EVENT, {
        detail: { playerId: playerIdRef.current }
      }));
      
      // Reproducir este audio
      audio.play().catch(err => {
        console.error('Error reproduciendo audio:', err);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const progressBar = e.currentTarget;
    const clickX = e.nativeEvent.offsetX;
    const width = progressBar.offsetWidth;
    const newTime = (clickX / width) * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Audio element oculto */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Botón Play/Pause */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center"
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" fill="currentColor" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Barra de progreso y tiempo */}
      <div className="flex-1 flex items-center gap-2">
        {/* Tiempo actual */}
        <span className="text-xs text-muted-foreground font-mono min-w-[32px]">
          {formatTime(currentTime)}
        </span>

        {/* Barra de progreso */}
        <div
          onClick={handleProgressClick}
          className="flex-1 h-2 bg-black/10 dark:bg-white/10 rounded-full cursor-pointer overflow-hidden relative group"
        >
          {/* Progreso */}
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-100 rounded-full"
            style={{ width: `${progress}%` }}
          />
          
          {/* Hover effect */}
          <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Duración */}
        <span className="text-xs text-muted-foreground font-mono min-w-[32px]">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

export default AudioPlayer;

