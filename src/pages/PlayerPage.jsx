import React from 'react';
import { motion } from 'framer-motion';
import PlayerHeader from '@/components/player/PlayerHeader';
import RippleBackground from '@/components/effects/RippleBackground';
import WaveBackground from '@/components/player/WaveBackground';
import { usePlayer } from '@/contexts/PlayerContext';

const PlayerPage = () => {
  const { isPlaying } = usePlayer();

  return (
    <>
      {isPlaying && <WaveBackground isPlaying={isPlaying} />}
      <RippleBackground isPlaying={isPlaying} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full p-4 sm:p-6 md:p-8"
      >
        <div className="w-full max-w-4xl mx-auto relative">
          <PlayerHeader />
        </div>
      </motion.div>
    </>
  );
};

export default PlayerPage;
