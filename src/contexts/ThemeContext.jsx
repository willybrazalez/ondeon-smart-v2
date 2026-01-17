import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // ✅ CRÍTICO para Windows/Electron: Forzar tema oscuro por defecto
    try {
      const stored = typeof window !== 'undefined' && window.localStorage 
        ? localStorage.getItem('theme') 
        : null;
      const initial = stored || 'dark';
      
      if (typeof document !== 'undefined') {
        // Asegurar que las clases se apliquen correctamente
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(initial);
      }
      
      return initial;
    } catch (error) {
      // Si falla localStorage (problema común en Electron), usar 'dark' por defecto
      console.warn('⚠️ Error accediendo a localStorage, usando tema oscuro por defecto:', error);
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
      return 'dark';
    }
  });

  useEffect(() => {
    // Escuchar cambios del tema desde otros lugares
    const handleThemeChange = (event) => {
      setTheme(event.detail.theme);
    };

    // Escuchar cambios en localStorage (para sincronización entre pestañas)
    const handleStorageChange = (event) => {
      if (event.key === 'theme') {
        setTheme(event.newValue);
      }
    };

    window.addEventListener('themeChange', handleThemeChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    document.documentElement.classList.toggle('light', newTheme === 'light');
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: newTheme } }));
  };

  const setThemeManually = (newTheme) => {
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    document.documentElement.classList.toggle('light', newTheme === 'light');
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: newTheme } }));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeManually }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 