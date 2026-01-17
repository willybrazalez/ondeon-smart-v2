import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({ isPlaying }) => (
  <div className="w-full h-1.5 bg-muted/80 rounded-full my-3 sm:my-4 overflow-hidden shadow-inner border border-border/50">
    <motion.div 
      className="h-full bg-gradient-to-r from-accent to-primary"
      initial={{ width: "0%" }}
      animate={isPlaying ? { width: "100%" } : { width: "30%"}}
      transition={isPlaying ? { duration: 30, ease: "linear" } : { duration: 0.4, type: "spring", stiffness: 60 }}
      key={isPlaying ? 'playing_progress' : 'paused_progress'}
    />
  </div>
);

export default ProgressBar;