# Instrucciones COMPLETAS para Implementar OndeonAppShowcase en TypeScript

Este documento contiene **TODA** la información necesaria para replicar exactamente el componente `OndeonAppShowcase` en un proyecto TypeScript (.tsx).

## ⚠️ IMPORTANTE: Leer Antes de Empezar

Este componente replica **EXACTAMENTE** la UI del reproductor Ondeon Smart. Para que funcione correctamente, necesitas seguir **TODOS** los pasos de esta guía.

## 📦 Paso 1: Instalar Dependencias

```bash
npm install react react-dom framer-motion lucide-react
# o
yarn add react react-dom framer-motion lucide-react
```

### Versiones recomendadas:
- `react`: ^18.0.0
- `react-dom`: ^18.0.0
- `framer-motion`: ^10.0.0 o superior
- `lucide-react`: ^0.263.0 o superior

## 🎨 Paso 2: Configurar Tailwind CSS

### 2.1. Configuración de Tailwind (`tailwind.config.js` o `tailwind.config.ts`)

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // ⚠️ CRÍTICO: Debe ser 'class'
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    // ... tus rutas
  ],
  theme: {
    extend: {
      colors: {
        // Variables CSS necesarias para el componente
        background: {
          DEFAULT: 'hsl(var(--background))',
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
      },
    },
  },
  plugins: [],
}
```

### 2.2. Variables CSS Necesarias

Agrega estas variables CSS en tu archivo CSS principal (ej: `globals.css`, `index.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Modo claro (si lo necesitas) */
    --background: 0 0% 94%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 92%;
    --muted-foreground: 215.4 16.3% 46.9%;
  }

  .dark {
    /* ⚠️ CRÍTICO: Estas son las variables para modo oscuro */
    --background: 0 0% 15%;
    --foreground: 0 0% 98%;
    --muted: 0 0% 20%;
    --muted-foreground: 0 0% 65%;
  }
}
```

### 2.3. Estilos CSS para Sliders Verticales

Agrega estos estilos en tu archivo CSS:

```css
/* Estilos para sliders verticales de volumen */
.volume-slider {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: transparent;
  cursor: pointer;
  outline: none;
  writing-mode: vertical-lr;
  direction: rtl;
}

/* WebKit (Chrome, Safari, Edge) */
.volume-slider::-webkit-slider-runnable-track {
  width: 3px;
  height: 100%;
  border-radius: 9999px;
  background: rgba(229, 231, 235, 0.2);
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(156, 163, 175);
  cursor: pointer;
  box-shadow: 0 0 10px rgba(128, 128, 128, 0.15);
  transition: all 0.3s;
  transform: translateX(-4px);
  margin-top: -3px;
}

.volume-slider::-webkit-slider-thumb:hover {
  background: rgb(107, 114, 128);
  box-shadow: 0 0 15px rgba(128, 128, 128, 0.2);
}

/* Firefox */
.volume-slider::-moz-range-track {
  width: 3px;
  height: 100%;
  border-radius: 9999px;
  background: rgba(229, 231, 235, 0.2);
}

.volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(156, 163, 175);
  cursor: pointer;
  border: none;
  box-shadow: 0 0 10px rgba(128, 128, 128, 0.15);
  transition: all 0.3s;
}

.volume-slider::-moz-range-thumb:hover {
  background: rgb(107, 114, 128);
  box-shadow: 0 0 15px rgba(128, 128, 128, 0.2);
}
```

## 📁 Paso 3: Crear los Componentes

### 3.1. Componente WaveBackground: `WaveBackground.tsx`

**⚠️ IMPORTANTE**: Este componente usa `useMemo` para evitar que los valores aleatorios cambien en cada render.

```typescript
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface WaveBackgroundProps {
  isPlaying?: boolean;
}

const WaveBackground: React.FC<WaveBackgroundProps> = ({ isPlaying = true }) => {
  const mainColor = '#A2D9F7';
  const bgOpacity = 0.1;
  const particleOpacity = 0.3;

  // ⚠️ CRÍTICO: Memoizar valores aleatorios para que no cambien en cada render
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
        {/* Ondas principales */}
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
        
        {/* Partículas */}
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
        
        {/* Capa adicional de brillo */}
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

export default WaveBackground;
```

### 3.2. Componente Principal: `OndeonAppShowcase.tsx`

**⚠️ CRÍTICO**: Este componente usa la clase `dark` en el contenedor principal. Asegúrate de que el elemento padre tenga `class="dark"` o usa `bg-gray-900` directamente.

```typescript
import React, { useState } from 'react';
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
import WaveBackground from './WaveBackground';

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

  // Modo imagen estática
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

  // Modo iframe
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
    <div className="ondeon-showcase relative w-full max-w-5xl mx-auto rounded-[32px] overflow-hidden dark">
      {/* Fondo animado idéntico al reproductor */}
      <WaveBackground isPlaying={isPlaying} />

      {/* Contenedor principal - ⚠️ Si bg-background no funciona, usa bg-gray-900 */}
      <div className="relative bg-gray-900 min-h-[800px] px-12 py-10">
        {/* Header superior: logo + usuario */}
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 backdrop-blur-md border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
            <span className="text-sm text-[#A2D9F7] flex items-center gap-2">
              TikiTakaAdministrador
              <Circle size={8} className="fill-green-500 text-green-500" />
            </span>
            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center border border-white/10">
              <span className="text-white/70 text-xs">☀</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center border border-white/10">
              <span className="text-[#A2D9F7] text-xs">⚙</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center border border-white/10">
              <span className="text-white/70 text-xs">→</span>
            </div>
          </div>
        </div>

        {/* Selector de canal centrado */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.button
            onClick={handlePrevChannel}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 backdrop-blur-lg hover:bg-black/10 transition-all duration-300 shadow-[0_0_15px_rgba(162,217,247,0.2)] hover:shadow-[0_0_20px_rgba(162,217,247,0.3)]"
          >
            <ChevronLeft className="w-6 h-6 text-white/70" />
          </motion.button>

          <motion.div 
            className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/5 backdrop-blur-lg shadow-[0_0_20px_rgba(162,217,247,0.2)]"
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
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 backdrop-blur-lg hover:bg-black/10 transition-all duration-300 shadow-[0_0_15px_rgba(162,217,247,0.2)] hover:shadow-[0_0_20px_rgba(162,217,247,0.3)]"
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

        {/* Zona central: sliders + botón play con círculos concéntricos */}
        <div className="relative min-h-[500px] flex items-center justify-center mb-12">
          {/* Volumen música (izquierda) */}
          <div className="absolute left-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 p-4 z-30">
            <div className="relative h-40 flex flex-col items-center">
              <div className="absolute -top-6 text-xs px-2 py-0.5 rounded-full bg-black/10 backdrop-blur-md text-white">
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
              <button className="mt-3 rounded-full p-2 bg-black/5 backdrop-blur-lg transition-all duration-300 shadow-[0_0_15px_rgba(128,128,128,0.15)] hover:bg-black/10">
                <Volume2 className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Botón play central con círculos concéntricos */}
          <div className="relative z-20">
            {/* Círculos concéntricos alrededor del botón */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              {/* Círculo exterior más grande */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-white/5 opacity-50" />
              {/* Segundo círculo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-white/5 opacity-60" />
              {/* Tercer círculo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-white/10 opacity-70" />
              {/* Círculo más cercano al botón */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[170px] h-[170px] rounded-full border border-white/15 shadow-[0_0_25px_rgba(162,217,247,0.35)] opacity-80" />
            </div>

            {/* Botón play */}
            <motion.button
              onClick={handlePlayPause}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 600, damping: 15 }}
              className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-150 z-10 bg-black/10 hover:bg-black/15 backdrop-blur-lg shadow-[0_0_30px_rgba(162,217,247,0.3)] hover:shadow-[0_0_40px_rgba(162,217,247,0.4)] text-white/90"
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
              <div className="absolute -top-6 text-xs px-2 py-0.5 rounded-full bg-black/10 backdrop-blur-md text-white">
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
              <button className="mt-3 rounded-full p-2 bg-black/5 backdrop-blur-lg transition-all duration-300 shadow-[0_0_15px_rgba(128,128,128,0.15)] hover:bg-black/10">
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
```

## 🖼️ Paso 4: Assets Necesarios

Coloca la imagen del logo en:
- **Ruta**: `public/assets/icono-ondeon.png`
- **Tamaño recomendado**: 256x256px o superior
- **Formato**: PNG con transparencia

## 📝 Paso 5: Ejemplo de Uso

### Uso en la Sección Hero:

```tsx
import OndeonAppShowcase from './components/OndeonAppShowcase';

function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4 dark">
      {/* ⚠️ IMPORTANTE: Agregar clase "dark" al contenedor padre */}
      <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
        {/* Contenido de texto */}
        <div className="text-white">
          <h1 className="text-5xl font-bold mb-4">
            La mejor radio sin SGAE para{' '}
            <span className="text-[#A2D9F7]">Hostelería</span>
          </h1>
          <p className="text-xl mb-2">100% legales para uso público.</p>
          <p className="text-xl mb-8">
            10 veces más económico. Empieza en 5 minutos.
          </p>
          <button className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            PROBAR GRATIS
          </button>
        </div>

        {/* Showcase del reproductor */}
        <div className="flex justify-center">
          <OndeonAppShowcase mode="visual" />
        </div>
      </div>
    </section>
  );
}
```

## ⚠️ Problemas Comunes y Soluciones

### Problema 1: El fondo no se ve oscuro
**Síntoma**: El componente tiene fondo claro o blanco en lugar de oscuro.

**Solución**: 
- **Opción A**: Agrega la clase `dark` al contenedor padre:
  ```tsx
  <div className="dark">
    <OndeonAppShowcase mode="visual" />
  </div>
  ```
- **Opción B**: Reemplaza `bg-background` por `bg-gray-900` directamente en el componente (línea 176)

### Problema 2: Los sliders no se ven o no funcionan
**Síntoma**: Los controles de volumen no aparecen o no son interactivos.

**Solución**: 
1. Verifica que los estilos CSS de `.volume-slider` estén en tu archivo CSS principal
2. Asegúrate de que el archivo CSS esté importado en tu aplicación (ej: `import './globals.css'`)
3. Verifica en las herramientas de desarrollador que las clases se estén aplicando

### Problema 3: El WaveBackground parpadea o cambia constantemente
**Síntoma**: El fondo animado cambia de forma constante o parpadea.

**Solución**: 
- Usa la versión con `useMemo` que está en este documento (Paso 3.1)
- Los valores aleatorios deben estar memoizados para que no cambien en cada render

### Problema 4: Los círculos concéntricos no se ven
**Síntoma**: No se ven los círculos alrededor del botón play.

**Solución**: 
1. Verifica que los círculos tengan `opacity` > 0 (deben estar entre 0.5 y 0.8)
2. Asegúrate de que el contenedor tenga suficiente espacio (`min-h-[500px]`)
3. Verifica que no haya otros elementos con `z-index` más alto que los oculte
4. Los círculos deben tener `border border-white/5` o similar para ser visibles

### Problema 5: Los colores no coinciden con la imagen
**Síntoma**: Los colores son diferentes a los de la imagen de referencia.

**Solución**: 
- **Usa la versión simplificada**: Revisa el archivo `VERSION-SIMPLIFICADA-SIN-VARIABLES-CSS.tsx` que usa colores directos
- Reemplaza todas las clases `dark:` por valores directos si no usas modo oscuro
- Usa `bg-gray-900` en lugar de `bg-background`
- Usa `text-white` en lugar de `text-foreground`
- Usa `text-gray-400` en lugar de `text-muted-foreground/70`

### Problema 6: El componente se ve muy pequeño o muy grande
**Solución**: 
- Ajusta `max-w-5xl` a `max-w-4xl` o `max-w-6xl` según necesites
- Verifica que el contenedor padre no tenga restricciones de tamaño

### Problema 7: Los elementos están desalineados
**Solución**: 
- Verifica que todos los elementos usen `flex items-center justify-center`
- Asegúrate de que los sliders usen `absolute` con `top-1/2 -translate-y-1/2`
- El botón play debe estar en un contenedor `relative` con `z-20`

### Problema 8: El logo no aparece
**Solución**: 
- Verifica que la ruta sea `/assets/icono-ondeon.png` (con `/` al inicio)
- O usa la ruta relativa según tu estructura: `./assets/icono-ondeon.png` o `assets/icono-ondeon.png`
- Asegúrate de que el archivo exista en `public/assets/`

## 🔍 Checklist Final

Antes de entregar, verifica:

- [ ] ✅ Todas las dependencias instaladas
- [ ] ✅ Tailwind configurado con `darkMode: 'class'`
- [ ] ✅ Variables CSS agregadas en el archivo CSS principal
- [ ] ✅ Estilos `.volume-slider` agregados
- [ ] ✅ Componente `WaveBackground.tsx` creado con `useMemo`
- [ ] ✅ Componente `OndeonAppShowcase.tsx` creado
- [ ] ✅ Imagen `icono-ondeon.png` en `public/assets/`
- [ ] ✅ Clase `dark` agregada al contenedor padre
- [ ] ✅ Todos los colores visibles correctamente
- [ ] ✅ Sliders funcionando
- [ ] ✅ Círculos concéntricos visibles
- [ ] ✅ Botón play/pause funcional

## 🔧 Versión Simplificada (Sin Variables CSS)

Si tienes problemas con las variables CSS personalizadas, usa la versión simplificada que está en el archivo `VERSION-SIMPLIFICADA-SIN-VARIABLES-CSS.tsx`. Esta versión:

- ✅ No requiere variables CSS personalizadas
- ✅ Usa colores directos de Tailwind (`bg-gray-900`, `text-white`, etc.)
- ✅ Funciona inmediatamente sin configuración adicional
- ✅ Mismo resultado visual

## 📞 Si Aún No Funciona

Si después de seguir todos los pasos el componente no se ve igual:

1. **Usa la versión simplificada**: Copia el código de `VERSION-SIMPLIFICADA-SIN-VARIABLES-CSS.tsx`
2. **Consola del navegador**: Busca errores de JavaScript o CSS (F12 → Console)
3. **Herramientas de desarrollador**: 
   - Inspecciona los elementos (F12 → Elements/Inspector)
   - Verifica que las clases CSS se estén aplicando
   - Revisa los estilos computados
4. **Comparación visual**: Compara elemento por elemento con la imagen de referencia
5. **Verifica dependencias**: Asegúrate de que todas las dependencias estén instaladas correctamente
6. **Contacta al equipo**: Proporciona:
   - Capturas de pantalla del resultado actual
   - Errores de consola (si los hay)
   - Versión de React, Tailwind y otras dependencias
   - Código del componente que estás usando

## 🎯 Resultado Esperado

El componente debe verse **EXACTAMENTE** igual que en las imágenes proporcionadas:
- Fondo oscuro con efecto de ondas animadas
- Header con logo SMART y panel de usuario
- Selector de canal centrado con botones de navegación
- Título y artista de la canción
- Botón play central con círculos concéntricos visibles
- Sliders verticales a los lados con porcentajes
- Navegación inferior con 5 iconos
- Versión en la parte inferior

