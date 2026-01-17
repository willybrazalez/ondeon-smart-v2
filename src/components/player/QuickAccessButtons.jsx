import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Palette, BookOpen, Sparkles } from 'lucide-react';

const ButtonMotionWrapper = ({ children }) => (
  <motion.div
    whileHover={{ y: -4 }} 
    whileTap={{ y: 0, scale: 0.96 }}
    className="w-full"
    transition={{ type: "spring", stiffness: 260, damping: 14 }}
  >
    {children}
  </motion.div>
);

const QuickAccessButtons = () => {
  return (
    <motion.div 
      className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full max-w-xs sm:max-w-sm mx-auto mt-2.5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.6, type: "spring", stiffness: 90 }}
    >
      <ButtonMotionWrapper>
        <Link 
          to="/canales" 
          className="flex flex-col items-center justify-center h-24 sm:h-28 p-1 sm:p-1.5 rounded-lg bg-[#A2D9F7] hover:bg-[#8AC5E3] transition-colors"
        >
          <Palette size={26} className="mb-1.5 sm:mb-2 text-white" /> 
          <span className="text-xs sm:text-sm text-center leading-tight font-sans text-white">Canales</span>
        </Link>
      </ButtonMotionWrapper>

      <ButtonMotionWrapper>
        <Link 
          to="/programacion" 
          className="flex flex-col items-center justify-center h-24 sm:h-28 p-1 sm:p-1.5 rounded-lg bg-[#A2D9F7] hover:bg-[#8AC5E3] transition-colors"
        >
          <BookOpen size={26} className="mb-1.5 sm:mb-2 text-white" /> 
          <span className="text-xs sm:text-sm text-center leading-tight font-sans text-white">Contenidos</span>
        </Link>
      </ButtonMotionWrapper>

      <ButtonMotionWrapper>
        <Link 
          to="/anuncio-nuevo" 
          className="flex flex-col items-center justify-center h-24 sm:h-28 p-1 sm:p-1.5 rounded-lg bg-[#A2D9F7] hover:bg-[#8AC5E3] transition-colors"
        >
          <Sparkles size={26} className="mb-1.5 sm:mb-2 text-white" /> 
          <span className="text-xs sm:text-sm text-center leading-tight font-sans text-white">Crear</span>
        </Link>
      </ButtonMotionWrapper>
    </motion.div>
  );
};

export default QuickAccessButtons;