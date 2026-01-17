import React from 'react';
import { motion } from 'framer-motion';

const RippleBackground = ({ isPlaying = false }) => {
  return (
    <div className={`fixed inset-0 -z-10 overflow-hidden transition-colors duration-500 ${isPlaying ? 'bg-transparent' : 'bg-[#fafafa] dark:bg-[#09090b]'}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-[1px] border-black/5 dark:border-white/5"
            initial={{ width: '100px', height: '100px', opacity: 0.8 }}
            animate={{
              width: ['100px', '600px'],
              height: ['100px', '600px'],
              opacity: [0.8, 0],
            }}
            transition={{
              duration: 4,
              ease: "linear",
              repeat: Infinity,
              delay: i * 1,
            }}
            style={{
              background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.03) 70%, transparent 100%)',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default RippleBackground; 