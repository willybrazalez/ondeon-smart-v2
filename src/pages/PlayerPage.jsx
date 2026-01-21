import React from 'react';
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
      <div className="w-full p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-4xl mx-auto relative">
          <PlayerHeader />
        </div>
      </div>
    </>
  );
};

export default PlayerPage;
