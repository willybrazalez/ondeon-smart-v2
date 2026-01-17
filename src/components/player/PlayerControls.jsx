import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { SkipBack, SkipForward } from 'lucide-react';
import ReactivePlayButton from './ReactivePlayButton';
import { useAuth } from '@/contexts/AuthContext';

const PlayerControls = ({ 
  isPlaying, 
  onPlayPause, 
  onSkipBack, 
  onSkipForward,
  currentTrack,
  playlistId,
  audioElement // Nuevo prop para pasar el elemento de audio
}) => {
  // 🔒 Obtener estado de reproducción manual para bloquear controles
  const { isManualPlaybackActive, manualPlaybackInfo } = useAuth();
  const blockMessage = isManualPlaybackActive 
    ? `Controles bloqueados - Reproduciendo: ${manualPlaybackInfo?.contentName || 'contenido manual'}`
    : undefined;

  return (
    <div className="flex items-center justify-center gap-2 my-4">
      <motion.div 
        whileHover={isManualPlaybackActive ? {} : { scale: 1.1 }} 
        whileTap={isManualPlaybackActive ? {} : { scale: 0.95 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="w-12 h-12 text-[#A2D9F7] hover:text-[#A2D9F7] hover:bg-[#A2D9F7]/10 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onSkipBack}
          disabled={!currentTrack || isManualPlaybackActive}
          title={blockMessage || 'Retroceder'}
        >
          <SkipBack size={24} />
        </Button>
      </motion.div>

      {/* Botón reactivo con ondas al ritmo de la música */}
      <ReactivePlayButton
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        disabled={!playlistId || isManualPlaybackActive}
        audioElement={audioElement}
        currentTrack={currentTrack}
        blockMessage={blockMessage}
        isManualPlaybackActive={isManualPlaybackActive}
      />

      <motion.div 
        whileHover={isManualPlaybackActive ? {} : { scale: 1.1 }} 
        whileTap={isManualPlaybackActive ? {} : { scale: 0.95 }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="w-12 h-12 text-[#A2D9F7] hover:text-[#A2D9F7] hover:bg-[#A2D9F7]/10 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onSkipForward}
          disabled={!currentTrack || isManualPlaybackActive}
          title={blockMessage || 'Avanzar'}
        >
          <SkipForward size={24} />
        </Button>
      </motion.div>
    </div>
  );
};

export default PlayerControls;