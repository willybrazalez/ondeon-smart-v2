import React from 'react';
import { motion } from 'framer-motion';

const PlayerHeader = () => {
  return (
    <motion.div 
      className="relative mb-2 sm:mb-3"
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5, type: "spring", stiffness: 130 }}
    >
      <div className="h-20 flex flex-col items-center justify-center rounded-md">
      </div>
    </motion.div>
  );
};

export default PlayerHeader;