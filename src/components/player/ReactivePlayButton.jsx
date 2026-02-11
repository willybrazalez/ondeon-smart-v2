import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import logger from '../../lib/logger.js';

/**
 * Botón de play/pause con ondas concéntricas y anillo visualizador de audio
 * Sistema visual decorativo sincronizado con la música
 */
const ReactivePlayButton = ({ isPlaying, onPlayPause, disabled, bpm, blockMessage, audioElement, currentTrack, isManualPlaybackActive = false }) => {
  const animationRef = useRef(null);
  const [waves, setWaves] = useState([]);
  const waveIdCounterRef = useRef(0);
  const lastWaveTimeRef = useRef(0);
  
  // 🎵 Audio Visualizer - Web Audio API
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null); // Gain 0 - para no emitir audio del viz
  const vizAudioRef = useRef(null); // Elemento separado SOLO para visualización - el principal no se conecta (audio en background)
  const dataArrayRef = useRef(null);
  const visualizerAnimationRef = useRef(null);
  const connectedAudioElementRef = useRef(null); // Referencia al main element (para sync)
  const lastTrackRef = useRef(null); // Referencia a la última canción
  const shouldContinueDrawingRef = useRef(false); // Flag para controlar el loop
  const [visualizerKey, setVisualizerKey] = useState(0); // Key para forzar reinicio del visualizador

  // 📱 Resumir AudioContext del visualizador cuando la página vuelve visible
  // (El audio principal NO pasa por el contexto → sigue sonando con pantalla bloqueada)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      const ctx = audioContextRef.current;
      if (ctx?.state === 'suspended') {
        ctx.resume().then(() => logger.dev('📱 AudioContext viz reanudado tras desbloqueo')).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 🔍 Vigilar cambios en audioElement o su src para forzar reinicio del visualizador
  useEffect(() => {
    // 🔧 Mantener vigilancia activa si está reproduciendo O si hay reproducción manual (música de fondo)
    if ((!isPlaying && !isManualPlaybackActive) || !audioElement) return;

    let lastSrc = audioElement?.src;

    // Verificar cada 100ms si el audioElement o su src cambió
    const intervalId = setInterval(() => {
      const currentSrc = audioElement?.src;
      
      if (audioElement && connectedAudioElementRef.current !== audioElement) {
        logger.dev('🔄 ReactivePlayButton - audioElement cambió (nueva instancia), forzando reinicio');
        setVisualizerKey(prev => prev + 1);
        lastSrc = currentSrc;
      } else if (audioElement && currentSrc && currentSrc !== lastSrc) {
        logger.dev('🔄 ReactivePlayButton - src cambió, forzando reinicio:', currentSrc);
        setVisualizerKey(prev => prev + 1);
        lastSrc = currentSrc;
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [isPlaying, isManualPlaybackActive, audioElement]);

  // 🎵 Sistema visual decorativo - ondas constantes y elegantes
  // ⚠️ TEMPORALMENTE DESACTIVADO - Para reactivar, descomentar este bloque
  /*
  useEffect(() => {
    if (!isPlaying) {
      setWaves([]);
      return;
    }

    const animate = () => {
      const currentTime = Date.now();

      // Frecuencia visual agradable basada en BPM aproximado
      const effectiveBpm = (bpm && bpm > 0 && bpm < 300) ? bpm : 120;
      const baseInterval = 60000 / effectiveBpm; // Intervalo base por BPM

      // Generar onda si ha pasado suficiente tiempo
      if (currentTime - lastWaveTimeRef.current >= baseInterval) {
        const newWave = {
          id: waveIdCounterRef.current++,
          scale: 1,
          opacity: 1,
          intensity: 0.7
        };

        setWaves(prev => {
          const filtered = prev.filter(w => w.opacity > 0.05);
          return [...filtered, newWave].slice(-3);
        });

        lastWaveTimeRef.current = currentTime;
      }

      // Actualizar ondas existentes
      setWaves(prev => prev.map(wave => ({
        ...wave,
        scale: wave.scale + 0.06, // ⚡ Expansión más rápida
        opacity: wave.opacity - 0.008 // 🌫️ Desvanecimiento más lento
      })).filter(w => w.opacity > 0));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [bpm, isPlaying]);
  */

  // 🎨 Audio Visualizer - Inicialización y dibujado
  useEffect(() => {
    logger.dev('🔍 ReactivePlayButton useEffect ejecutado:', {
      isPlaying,
      isManualPlaybackActive,
      hasAudioElement: !!audioElement,
      currentTrack,
      visualizerKey,
      hasCanvas: !!canvasRef.current
    });

    // 🧹 DETENER loop anterior estableciendo el flag a false
    shouldContinueDrawingRef.current = false;
    
    // 🧹 Cancelar el requestAnimationFrame anterior
    if (visualizerAnimationRef.current) {
      logger.dev('🧹 Cancelando loop de visualización anterior...');
      cancelAnimationFrame(visualizerAnimationRef.current);
      visualizerAnimationRef.current = null;
    }

    // 🔧 Mantener visualizador activo si está reproduciendo O si hay reproducción manual (música de fondo)
    const shouldVisualize = isPlaying || isManualPlaybackActive;

    if (!shouldVisualize || !audioElement || !canvasRef.current) {
      // Limpiar canvas cuando se pausa
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      logger.dev('⏸️ Visualizador pausado o sin audio element', { isPlaying, isManualPlaybackActive, hasAudioElement: !!audioElement, hasCanvas: !!canvasRef.current });
      return;
    }

    // Detectar si cambió la canción
    const trackChanged = currentTrack && lastTrackRef.current !== currentTrack;
    if (trackChanged) {
      logger.dev('🎵 Cambio de canción detectado:', currentTrack);
      lastTrackRef.current = currentTrack;
    }

    // Configurar Web Audio API - Usar elemento VIZ separado (NUNCA conectar el audio principal)
    // El audio principal reproduce directo → sigue sonando con pantalla bloqueada
    const setupAudioConnection = () => {
      try {
        // Crear contexto de audio si no existe
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 128;
          analyserRef.current.smoothingTimeConstant = 0.8;
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.gain.value = 0; // Sin salida - solo análisis
        }

        if (!audioElement?.src) return;

        // Crear/actualizar elemento viz (muted, solo para análisis)
        if (!vizAudioRef.current) {
          vizAudioRef.current = new Audio();
          vizAudioRef.current.muted = true;
          vizAudioRef.current.crossOrigin = 'anonymous';
        }

        const viz = vizAudioRef.current;
        if (viz.src !== audioElement.src) {
          viz.src = audioElement.src;
        }
        viz.currentTime = audioElement.currentTime;

        if (audioElement.paused) {
          viz.pause();
        } else {
          viz.play().catch(() => {});
        }

        // Conectar VIZ (no el principal) al contexto
        if (!sourceRef.current) {
          logger.dev('🔌 Conectando visualizador al elemento VIZ (audio principal libre para background)');
          sourceRef.current = audioContextRef.current.createMediaElementSource(viz);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
        }

        connectedAudioElementRef.current = audioElement;

        if (analyserRef.current) {
          const bufferLength = analyserRef.current.frequencyBinCount;
          dataArrayRef.current = new Uint8Array(bufferLength);
        }
      } catch (error) {
        logger.warn('⚠️ Error en setupAudioConnection:', error);
      }
    };

    // Sincronizar viz con el audio principal (play/pause/currentTime)
    let syncCleanup = () => {};
    const main = audioElement;
    if (main && vizAudioRef.current) {
      const viz = vizAudioRef.current;
      const onPlay = () => { try { viz.currentTime = main.currentTime; viz.play().catch(() => {}); } catch (_) {} };
      const onPause = () => { try { viz.pause(); } catch (_) {} };
      const onTimeUpdate = () => { try { if (Math.abs(viz.currentTime - main.currentTime) > 0.5) viz.currentTime = main.currentTime; } catch (_) {} };

      main.addEventListener('play', onPlay);
      main.addEventListener('pause', onPause);
      main.addEventListener('timeupdate', onTimeUpdate);

      if (main.src && main.src !== viz.src) viz.src = main.src;
      viz.currentTime = main.currentTime;
      if (!main.paused) viz.play().catch(() => {}); else viz.pause();

      syncCleanup = () => {
        main.removeEventListener('play', onPlay);
        main.removeEventListener('pause', onPause);
        main.removeEventListener('timeupdate', onTimeUpdate);
      };
    }

    // Iniciar conexión
    setupAudioConnection();

    // Función de dibujado - se ejecuta siempre en cada render del useEffect
    const draw = () => {
      // 🛑 Verificar flag - si es false, detener el loop inmediatamente
      if (!shouldContinueDrawingRef.current) {
        logger.dev('⏹️ Loop detenido por flag');
        return;
      }

      // Verificar que todos los recursos estén disponibles
      if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) {
        logger.dev('⏹️ Deteniendo loop - recursos no disponibles');
        return;
      }

      // 🔧 Verificar que todavía deberíamos estar dibujando (isPlaying O reproducción manual)
      const shouldKeepDrawing = isPlaying || isManualPlaybackActive;
      if (!shouldKeepDrawing || !audioElement) {
        logger.dev('⏹️ Deteniendo loop - ya no está reproduciendo');
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 50; // Radio del anillo

      // Obtener datos de frecuencia
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      // Limpiar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Número de barras (segmentos del círculo)
      const bars = 32;
      const angleStep = (Math.PI * 2) / bars;

      // Dibujar anillo visualizador
      for (let i = 0; i < bars; i++) {
        // Dividir frecuencias en 3 rangos
        const bassIndex = Math.floor(i / 3); // Graves (0-10)
        const midIndex = Math.floor((i / 3) + 10); // Medios (10-21)
        const highIndex = Math.floor((i / 3) + 21); // Agudos (21-32)

        // Obtener valor de frecuencia según posición en el círculo
        let frequencyValue;
        if (i < bars / 3) {
          frequencyValue = dataArrayRef.current[bassIndex] || 0;
        } else if (i < (bars * 2) / 3) {
          frequencyValue = dataArrayRef.current[midIndex] || 0;
        } else {
          frequencyValue = dataArrayRef.current[highIndex] || 0;
        }

        // Normalizar valor (0-255 -> 0-1)
        const normalizedValue = frequencyValue / 255;
        
        // Calcular altura de la barra
        const barHeight = normalizedValue * 30; // Máximo 30px de altura

        // Calcular ángulo
        const angle = i * angleStep - Math.PI / 2; // Empezar desde arriba

        // Posiciones inicial y final de la barra
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        // Color según rango de frecuencia
        let color;
        if (i < bars / 3) {
          // Graves - Azul
          color = `rgba(100, 200, 255, ${0.6 + normalizedValue * 0.4})`;
        } else if (i < (bars * 2) / 3) {
          // Medios - Cyan
          color = `rgba(162, 217, 247, ${0.6 + normalizedValue * 0.4})`;
        } else {
          // Agudos - Blanco
          color = `rgba(200, 230, 255, ${0.6 + normalizedValue * 0.4})`;
        }

        // Dibujar barra
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Glow effect
        if (normalizedValue > 0.5) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      visualizerAnimationRef.current = requestAnimationFrame(draw);
    };

    // 🎬 Verificar que todo esté listo antes de iniciar el loop
    if (!analyserRef.current || !dataArrayRef.current || !canvasRef.current) {
      logger.warn('⚠️ No se puede iniciar visualizador - faltan recursos:', {
        analyser: !!analyserRef.current,
        dataArray: !!dataArrayRef.current,
        canvas: !!canvasRef.current
      });
      return;
    }

    // 🎬 Habilitar el nuevo loop estableciendo el flag a true
    shouldContinueDrawingRef.current = true;

    // 🎬 Iniciar loop de dibujado - se ejecuta siempre cuando el useEffect se ejecuta
    logger.dev('🎬 Iniciando nuevo loop de visualización...', {
      track: currentTrack,
      visualizerKey,
      hasAnalyser: !!analyserRef.current,
      hasDataArray: !!dataArrayRef.current,
      hasCanvas: !!canvasRef.current,
      hasAudioElement: !!audioElement,
      connectedElement: connectedAudioElementRef.current,
      elementsMatch: connectedAudioElementRef.current === audioElement,
      flagEnabled: shouldContinueDrawingRef.current
    });
    
    // Iniciar el loop llamando a draw() directamente (draw se encarga de continuar el loop)
    draw();

    return () => {
      syncCleanup();
      try { vizAudioRef.current?.pause(); } catch (_) {}
      shouldContinueDrawingRef.current = false;
      if (visualizerAnimationRef.current) {
        cancelAnimationFrame(visualizerAnimationRef.current);
        visualizerAnimationRef.current = null;
      }
    };
  }, [isPlaying, isManualPlaybackActive, audioElement, currentTrack, visualizerKey]); // ⚡ Se re-ejecuta cuando cambia audioElement, canción, key o estado manual

  return (
    <div className="relative">
      {/* Canvas para el anillo visualizador */}
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ opacity: (isPlaying || isManualPlaybackActive) ? 1 : 0, transition: 'opacity 0.3s ease' }}
      />

      {/* Anillos decorativos externos - posicionados con dimensiones explícitas para evitar recorte */}
      {/* Anillo exterior pulsante */}
      <motion.div
        className="absolute rounded-full border border-white/[0.06] pointer-events-none"
        style={{
          width: '128px', height: '128px',
          top: '50%', left: '50%',
          marginTop: '-64px', marginLeft: '-64px'
        }}
        animate={(isPlaying || isManualPlaybackActive) ? {
          scale: [1, 1.08, 1],
          opacity: [0.2, 0.5, 0.2],
        } : { scale: 1, opacity: 0.15 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Anillo medio */}
      <motion.div
        className="absolute rounded-full border border-[#A2D9F7]/8 pointer-events-none"
        style={{
          width: '112px', height: '112px',
          top: '50%', left: '50%',
          marginTop: '-56px', marginLeft: '-56px'
        }}
        animate={(isPlaying || isManualPlaybackActive) ? {
          scale: [1, 1.04, 1],
          opacity: [0.15, 0.35, 0.15],
        } : { scale: 1, opacity: 0.1 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />

      {/* Botón central - Diseño moderno glassmorphism */}
      <motion.button
        onClick={onPlayPause}
        disabled={disabled}
        title={blockMessage || ((isPlaying || isManualPlaybackActive) ? 'Pausar' : 'Reproducir')}
        className={`relative w-24 h-24 md:w-20 md:h-20 rounded-full flex items-center justify-center z-10
          bg-white/[0.08] border border-white/[0.12]
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          transition-all duration-300`}
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: (isPlaying || isManualPlaybackActive) 
            ? '0 0 40px rgba(162, 217, 247, 0.25), 0 0 80px rgba(162, 217, 247, 0.1), inset 0 0 20px rgba(162, 217, 247, 0.08)' 
            : '0 0 30px rgba(162, 217, 247, 0.12), inset 0 0 15px rgba(255, 255, 255, 0.04)'
        }}
        whileHover={!disabled ? { scale: 1.08 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        {/* Glow interior cuando está reproduciendo */}
        {(isPlaying || isManualPlaybackActive) && (
          <motion.div
            className="absolute inset-2 rounded-full bg-gradient-to-br from-[#A2D9F7]/20 to-transparent"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        
        {/* Icono */}
        <motion.div
          className="relative z-10"
          animate={(isPlaying || isManualPlaybackActive) ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        >
          {(isPlaying || isManualPlaybackActive) ? (
            <Pause className="w-10 h-10 md:w-9 md:h-9 text-white" strokeWidth={2.5} />
          ) : (
            <Play className="w-10 h-10 md:w-9 md:h-9 text-white ml-1" strokeWidth={2.5} />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default ReactivePlayButton;

