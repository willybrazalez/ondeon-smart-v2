import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const SongInfo = ({ title, artist }) => {
  const titleRef = useRef(null);
  const artistRef = useRef(null);
  const [titleNeedsScroll, setTitleNeedsScroll] = useState(false);
  const [artistNeedsScroll, setArtistNeedsScroll] = useState(false);

  useEffect(() => {
    // Verificar si el título es muy largo y necesita scroll
    if (titleRef.current) {
      const element = titleRef.current;
      setTitleNeedsScroll(element.scrollWidth > element.clientWidth);
    }

    // Verificar si el artista es muy largo y necesita scroll
    if (artistRef.current) {
      const element = artistRef.current;
      setArtistNeedsScroll(element.scrollWidth > element.clientWidth);
    }
  }, [title, artist]);

  return (
  <motion.div 
    className="mb-2 sm:mb-3"
    initial={{ opacity: 0, x: -15 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
  >
      {/* Título con efecto marquee */}
      <div className="overflow-hidden relative w-full">
        <h2 
          ref={titleRef}
          className={`text-2xl sm:text-3xl font-semibold text-foreground font-sans ${
            titleNeedsScroll ? 'animate-marquee-slow hover:animation-paused' : ''
          }`}
          style={{ 
            textShadow: '1px 1px 2px hsla(var(--foreground-rgb), 0.05)',
            whiteSpace: 'nowrap',
            display: 'inline-block',
            paddingRight: titleNeedsScroll ? '50px' : '0'
          }}
        >
          {title}
        </h2>
      </div>

      {/* Artista con efecto marquee */}
      <div className="overflow-hidden relative w-full">
        <p 
          ref={artistRef}
          className={`text-md sm:text-lg text-primary/90 font-sans ${
            artistNeedsScroll ? 'animate-marquee-slow hover:animation-paused' : ''
          }`}
          style={{
            whiteSpace: 'nowrap',
            display: 'inline-block',
            paddingRight: artistNeedsScroll ? '50px' : '0'
          }}
        >
          {artist}
        </p>
      </div>
  </motion.div>
);
};

export default SongInfo;