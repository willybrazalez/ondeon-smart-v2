import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = ({ navItems, theme }) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const sidebarVariants = {
    open: { width: '18rem', transition: { type: 'spring', stiffness: 300, damping: 30 } }, // 288px
    closed: { width: '5rem', transition: { type: 'spring', stiffness: 300, damping: 30 } }, // 80px
  };

  const itemTextVariants = {
    open: { opacity: 1, x: 0, display: 'inline-block', transition: { delay: 0.1, duration: 0.2 } },
    closed: { opacity: 0, x: -10, display: 'none', transition: { duration: 0.1 } },
  };

  const iconContainerVariants = {
    open: { paddingLeft: '1rem', paddingRight: '1rem' }, // px-4
    closed: { paddingLeft: '0.5rem', paddingRight: '0.5rem' }, // px-2 for centering icon
  };

  return (
    <motion.nav
      variants={sidebarVariants}
      animate={isSidebarOpen ? 'open' : 'closed'}
      initial={false}
      className={`relative bg-card/60 backdrop-blur-sm p-4 pt-6 space-y-3 border-r border-border/60 shadow-lg flex flex-col h-full transition-colors duration-300 ease-in-out group`}
    >
      <div className="absolute top-4 right-0 transform translate-x-1/2 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-full bg-card hover:bg-muted border-border/80 w-8 h-8 shadow-md hover:shadow-lg transition-all"
          aria-label={isSidebarOpen ? 'Cerrar sidebar' : 'Abrir sidebar'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isSidebarOpen ? (
              <motion.div key="chevron-left" initial={{ rotate: 180, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -180, opacity: 0 }} transition={{duration: 0.2}}>
                <ChevronLeft size={18} />
              </motion.div>
            ) : (
              <motion.div key="chevron-right" initial={{ rotate: -180, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 180, opacity: 0 }} transition={{duration: 0.2}}>
                <ChevronRight size={18} />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </div>

      {navItems.map((item) => (
        <Button
          key={item.path}
          asChild
          variant={location.pathname === item.path ? 'default' : 'ghost'}
          className={`w-full justify-start text-base py-3 rounded-xl transition-all duration-200 ease-in-out group/item ${
            location.pathname === item.path
              ? 'bg-gradient-to-r from-primary to-green-500 hover:from-primary/90 hover:to-green-500/90 text-primary-foreground shadow-lg transform scale-105 font-medium'
              : 'hover:bg-primary/10 text-foreground/70 hover:text-primary transform hover:scale-[1.03] font-normal'
          } ${!isSidebarOpen ? 'px-0 justify-center' : 'px-4'}`}
          title={isSidebarOpen ? '' : item.label}
        >
          <Link to={item.path} className="flex items-center">
            <motion.div 
              variants={iconContainerVariants} 
              className={`flex items-center ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`}
            >
              <item.icon 
                className={`h-6 w-6 transition-colors duration-200 ${
                  location.pathname === item.path 
                  ? 'text-primary-foreground' 
                  : 'text-primary/80 group-hover/item:text-primary'
                }`} 
              />
            </motion.div>
            <motion.span variants={itemTextVariants} className="whitespace-nowrap overflow-hidden">
              {item.label}
            </motion.span>
          </Link>
        </Button>
      ))}
    </motion.nav>
  );
};

export default Sidebar;