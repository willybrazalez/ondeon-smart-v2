import React, { createContext, useContext } from 'react';

const PlayerContext = createContext({
  isPlaying: false,
  currentChannel: null,
  currentSong: null,
});

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children, value }) => {
  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};


