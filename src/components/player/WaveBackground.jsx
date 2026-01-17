import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

const WaveBackground = ({ isPlaying = true }) => {
  const { theme } = useTheme();
  const mainColor = theme === 'dark' ? '#A2D9F7' : '#A2D9F7';
  const bgOpacity = theme === 'dark' ? 0.1 : 0.05;
  const particleOpacity = theme === 'dark' ? 0.3 : 0.15;

  return (
    <div className={`fixed inset-0 overflow-hidden -z-10 ${theme === 'dark' ? 'bg-[#09090b]' : 'bg-background'}`}>
      {/* 🔧 OPTIMIZADO: Fondo siempre visible para evitar glitches */}
      {(
        <div className="relative w-full h-full">
          {/* Ondas principales (menos cantidad y menos blur) */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ opacity: 0.3, scale: 1 }}
              animate={{
                opacity: [0.2, 0.4, 0.2],
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: isPlaying ? 8 : 20,
                delay: i * 0.5,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <div 
                className="absolute w-full h-full"
                style={{
                  backgroundColor: mainColor,
                  opacity: isPlaying ? bgOpacity : bgOpacity * 0.5,
                  clipPath: `circle(${50 + i * 8}% at ${50 + Math.sin(i) * 10}% ${50 + Math.cos(i) * 10}%)`,
                  filter: 'blur(16px)',
                  mixBlendMode: theme === 'dark' ? 'plus-lighter' : 'multiply',
                  willChange: 'transform, opacity'
                }}
              />
            </motion.div>
          ))}
          {/* Menos partículas */}
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 2 + 1 + 'px',
                height: Math.random() * 2 + 1 + 'px',
                backgroundColor: mainColor,
                opacity: isPlaying ? particleOpacity : particleOpacity * 0.5,
                filter: 'blur(0.5px)',
                willChange: 'transform, opacity'
              }}
              initial={{ 
                x: Math.random() * 100 + "%",
                y: Math.random() * 100 + "%",
                scale: 0
              }}
              animate={{
                x: [
                  Math.random() * 100 + "%",
                  Math.random() * 100 + "%",
                  Math.random() * 100 + "%",
                  Math.random() * 100 + "%"
                ],
                y: [
                  Math.random() * 100 + "%",
                  Math.random() * 100 + "%",
                  Math.random() * 100 + "%",
                  Math.random() * 100 + "%"
                ],
                scale: [0, 1.2, 1, 0],
                opacity: [0, particleOpacity, particleOpacity, 0]
              }}
              transition={{
                duration: 10 + Math.random() * 6,
                repeat: Infinity,
                ease: "linear",
                delay: -Math.random() * 6
              }}
            />
          ))}
          {/* Capa adicional de brillo */}
          <div 
            className="absolute inset-0 bg-gradient-to-b"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(162, 217, 247, ${theme === 'dark' ? '0.04' : '0.01'}), transparent)`,
              mixBlendMode: theme === 'dark' ? 'plus-lighter' : 'multiply',
              filter: 'blur(20px)',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default WaveBackground; 