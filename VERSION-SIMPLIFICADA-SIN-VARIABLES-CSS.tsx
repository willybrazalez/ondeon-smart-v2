/**
 * VERSIÓN SIMPLIFICADA - Sin dependencias de variables CSS personalizadas
 * 
 * Esta versión usa colores directos de Tailwind CSS, sin necesidad de
 * configurar variables CSS personalizadas como bg-background o text-muted-foreground
 * 
 * Copia este código directamente en tu proyecto TypeScript
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2, 
  Mic,
  Home as HomeIcon,
  Radio,
  BookOpen,
  History as HistoryIcon,
  MessageSquare,
  Circle
} from 'lucide-react';

// ============================================
// COMPONENTE WAVEBACKGROUND
// ============================================
interface WaveBackgroundProps {
  isPlaying?: boolean;
}

const WaveBackground: React.FC<WaveBackgroundProps> = ({ isPlaying = true }) => {
  const mainColor = '#A2D9F7';
  const bgOpacity = 0.1;
  const particleOpacity = 0.3;

  // Memoizar valores aleatorios para evitar cambios en cada render
  const waveData = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      randomX: 50 + Math.sin(i) * 10,
      randomY: 50 + Math.cos(i) * 10,
    }));
  }, []);

  const particlesData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      width: Math.random() * 2 + 1,
      height: Math.random() * 2 + 1,
      positions: [
        { x: Math.random() * 100, y: Math.random() * 100 },
        { x: Math.random() * 100, y: Math.random() * 100 },
        { x: Math.random() * 100, y: Math.random() * 100 },
        { x: Math.random() * 100, y: Math.random() * 100 },
      ],
      duration: 10 + Math.random() * 6,
      delay: -Math.random() * 6,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden -z-10 bg-black">
      <div className="relative w-full h-full">
        {waveData.map((wave) => (
          <motion.div
            key={wave.id}
            className="absolute inset-0"
            initial={{ opacity: 0.3, scale: 1 }}
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: isPlaying ? 8 : 20,
              delay: wave.id * 0.5,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            <div 
              className="absolute w-full h-full"
              style={{
                backgroundColor: mainColor,
                opacity: isPlaying ? bgOpacity : bgOpacity * 0.5,
                clipPath: `circle(${50 + wave.id * 8}% at ${wave.randomX}% ${wave.randomY}%)`,
                filter: 'blur(16px)',
                mixBlendMode: 'plus-lighter',
                willChange: 'transform, opacity'
              }}
            />
          </motion.div>
        ))}
        
        {particlesData.map((particle) => (
          <motion.div
            key={`particle-${particle.id}`}
            className="absolute rounded-full"
            style={{
              width: `${particle.width}px`,
              height: `${particle.height}px`,
              backgroundColor: mainColor,
              opacity: isPlaying ? particleOpacity : particleOpacity * 0.5,
              filter: 'blur(0.5px)',
              willChange: 'transform, opacity'
            }}
            initial={{ 
              x: `${particle.positions[0].x}%`,
              y: `${particle.positions[0].y}%`,
              scale: 0
            }}
            animate={{
              x: [
                `${particle.positions[0].x}%`,
                `${particle.positions[1].x}%`,
                `${particle.positions[2].x}%`,
                `${particle.positions[3].x}%`
              ],
              y: [
                `${particle.positions[0].y}%`,
                `${particle.positions[1].y}%`,
                `${particle.positions[2].y}%`,
                `${particle.positions[3].y}%`
              ],
              scale: [0, 1.2, 1, 0],
              opacity: [0, particleOpacity, particleOpacity, 0]
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              ease: "linear",
              delay: particle.delay
            }}
          />
        ))}
        
        <div 
          className="absolute inset-0 bg-gradient-to-b"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(162, 217, 247, 0.04), transparent)`,
            mixBlendMode: 'plus-lighter',
            filter: 'blur(20px)',
          }}
        />
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL ONDEONAPPSHOWCASE
// ============================================
interface OndeonAppShowcaseProps {
  mode?: 'visual' | 'image' | 'iframe';
  imageSrc?: string;
  iframeSrc?: string;
}

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}

const OndeonAppShowcase: React.FC<OndeonAppShowcaseProps> = ({ 
  mode = 'visual',
  imageSrc = '/images/ondeon-app-screenshot.png',
  iframeSrc = 'https://ondeon.smart.app'
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentChannel, setCurrentChannel] = useState<number>(0);
  const [musicVolume, setMusicVolume] = useState<number>(80);
  const [micVolume, setMicVolume] = useState<number>(100);

  const channels = [
    { name: 'Tiki Taka R&B', image: null },
    { name: 'Pop Hits', image: null },
    { name: 'Rock Classics', image: null },
  ];

  const currentSong = {
    title: 'Lost Obsidian Horizons',
    artist: 'Ondeón'
  };

  const handlePrevChannel = () => {
    setCurrentChannel((prev) => (prev === 0 ? channels.length - 1 : prev - 1));
  };

  const handleNextChannel = () => {
    setCurrentChannel((prev) => (prev === channels.length - 1 ? 0 : prev + 1));
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  if (mode === 'image') {
    return (
      <div className="relative w-full max-w-md mx-auto">
        <img 
          src={imageSrc} 
          alt="Ondeon Smart App" 
          className="w-full h-auto rounded-lg shadow-2xl"
        />
      </div>
    );
  }

  if (mode === 'iframe') {
    return (
      <div className="relative w-full max-w-md mx-auto aspect-[9/16] rounded-lg overflow-hidden shadow-2xl">
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          title="Ondeon Smart App"
          allow="autoplay; encrypted-media"
        />
      </div>
    );
  }

  // Modo visual (UI mockup) - RECOMENDADO
  return (
    <div className="ondeon-showcase relative w-full max-w-5xl mx-auto rounded-[32px] overflow-hidden">
      {/* Fondo animado */}
      <WaveBackground isPlaying={isPlaying} />

      {/* Contenedor principal - USANDO COLORES DIRECTOS */}
      <div className="relative bg-gray-900 min-h-[800px] px-12 py-10">
        {/* Header superior */}
        <div className="flex items-center justify-between mb-10 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img
              src="/assets/icono-ondeon.png"
              alt="Ondeón Logo"
              className="h-16 w-16 sm:h-14 sm:w-14 drop-shadow-lg"
              style={{ maxWidth: 'none' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="text-2xl tracking-[0.2em] font-light text-[#A2D9F7] font-sans">
              SMART
            </span>
          </div>

          {/* Panel usuario */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
            <span className="text-sm text-[#A2D9F7] flex items-center gap-2">
              TikiTakaAdministrador
              <Circle size={8} className="fill-green-500 text-green-500" />
            </span>
            <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center border border-white/10">
              <span className="text-white/70 text-xs">☀</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center border border-white/10">
              <span className="text-[#A2D9F7] text-xs">⚙</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center border border-white/10">
              <span className="text-white/70 text-xs">→</span>
            </div>
          </div>
        </div>

        {/* Selector de canal */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.button
            onClick={handlePrevChannel}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-lg hover:bg-black/30 transition-all duration-300 shadow-[0_0_15px_rgba(162,217,247,0.2)] hover:shadow-[0_0_20px_rgba(162,217,247,0.3)]"
          >
            <ChevronLeft className="w-6 h-6 text-white/70" />
          </motion.button>

          <motion.div 
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/20 backdrop-blur-lg shadow-[0_0_20px_rgba(162,217,247,0.2)]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center border border-purple-300/40 shadow-[0_0_18px_rgba(168,85,247,0.6)]">
              <Mic className="w-4 h-4 text-purple-100" />
            </div>
            <span className="text-sm font-sans font-light tracking-wider text-white/80">
              {channels[currentChannel].name}
            </span>
          </motion.div>

          <motion.button
            onClick={handleNextChannel}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-lg hover:bg-black/30 transition-all duration-300 shadow-[0_0_15px_rgba(162,217,247,0.2)] hover:shadow-[0_0_20px_rgba(162,217,247,0.3)]"
          >
            <ChevronRight className="w-6 h-6 text-white/70" />
          </motion.button>
        </div>

        {/* Título de la canción */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-sans font-light tracking-wide text-white/90">
            {currentSong.title}
          </h2>
          <p className="text-lg font-sans font-extralight tracking-wider text-white/70">
            {currentSong.artist}
          </p>
        </div>

        {/* Zona central: sliders + botón play */}
        <div className="relative min-h-[500px] flex items-center justify-center mb-12">
          {/* Volumen música (izquierda) */}
          <div className="absolute left-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 p-4 z-30">
            <div className="relative h-40 flex flex-col items-center">
              <div className="absolute -top-6 text-xs px-2 py-0.5 rounded-full bg-gray-800/90 backdrop-blur-md text-white">
                {musicVolume}%
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={musicVolume}
                onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                className="volume-slider"
                style={{ 
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  width: '26px',
                  height: '160px'
                }}
              />
              <button className="mt-3 rounded-full p-2 bg-black/20 backdrop-blur-lg transition-all duration-300 shadow-[0_0_15px_rgba(128,128,128,0.15)] hover:bg-black/30">
                <Volume2 className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Botón play central con círculos concéntricos */}
          <div className="relative z-20">
            {/* Círculos concéntricos - VISIBLES */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-white/5 opacity-50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-white/5 opacity-60" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-white/10 opacity-70" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[170px] h-[170px] rounded-full border border-white/15 shadow-[0_0_25px_rgba(162,217,247,0.35)] opacity-80" />
            </div>

            {/* Botón play */}
            <motion.button
              onClick={handlePlayPause}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 600, damping: 15 }}
              className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-150 z-10 bg-black/20 hover:bg-black/30 backdrop-blur-lg shadow-[0_0_30px_rgba(162,217,247,0.3)] hover:shadow-[0_0_40px_rgba(162,217,247,0.4)] text-white/90"
            >
              {isPlaying ? (
                <Pause className="w-10 h-10" />
              ) : (
                <Play className="w-10 h-10 ml-1" />
              )}
            </motion.button>
          </div>

          {/* Volumen micro (derecha) */}
          <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 p-4 z-30">
            <div className="relative h-40 flex flex-col items-center">
              <div className="absolute -top-6 text-xs px-2 py-0.5 rounded-full bg-gray-800/90 backdrop-blur-md text-white">
                {micVolume}%
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={micVolume}
                onChange={(e) => setMicVolume(parseInt(e.target.value))}
                className="volume-slider"
                style={{ 
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  width: '26px',
                  height: '160px'
                }}
              />
              <button className="mt-3 rounded-full p-2 bg-black/20 backdrop-blur-lg transition-all duration-300 shadow-[0_0_15px_rgba(128,128,128,0.15)] hover:bg-black/30">
                <Mic className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Navegación inferior + versión */}
        <div className="mt-12">
          <div className="flex items-center justify-center gap-12 mb-3">
            <NavItem icon={HomeIcon} label="Reproductor" active />
            <NavItem icon={Radio} label="Canales" />
            <NavItem icon={BookOpen} label="Contenidos" />
            <NavItem icon={HistoryIcon} label="Historial" />
            <NavItem icon={MessageSquare} label="Soporte" />
          </div>
          <p className="text-center text-xs text-gray-400">
            Ondeon Smart v0.0.34
          </p>
        </div>
      </div>
    </div>
  );
};

// Componente auxiliar para items de navegación
const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, active = false }) => {
  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
        active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white/80'
      }`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={`text-xs ${active ? 'text-white' : 'text-white/60'}`}>
        {label}
      </span>
    </div>
  );
};

export default OndeonAppShowcase;

