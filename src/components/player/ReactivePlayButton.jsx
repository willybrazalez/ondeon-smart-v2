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
  const dataArrayRef = useRef(null);
  const visualizerAnimationRef = useRef(null);
  const connectedAudioElementRef = useRef(null); // Referencia al elemento conectado
  const lastTrackRef = useRef(null); // Referencia a la última canción
  const shouldContinueDrawingRef = useRef(false); // Flag para controlar el loop
  const [visualizerKey, setVisualizerKey] = useState(0); // Key para forzar reinicio del visualizador

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

    // Configurar Web Audio API - Solo conexión inicial
    const setupAudioConnection = () => {
      try {
        // Crear contexto de audio si no existe
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 128; // 64 barras de frecuencia
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        // 🔧 CRÍTICO: Detectar si el audioElement cambió (nuevo canal = nuevo elemento)
        const audioElementChanged = audioElement && connectedAudioElementRef.current && connectedAudioElementRef.current !== audioElement;
        
        if (audioElementChanged) {
          logger.dev('🔄 Elemento de audio cambió - reconectando visualizador...');
          
          // Desconectar el anterior
          if (sourceRef.current) {
            try {
              sourceRef.current.disconnect();
              logger.dev('🧹 Fuente de audio anterior desconectada');
            } catch (error) {
              logger.warn('⚠️ Error al desconectar fuente anterior:', error);
            }
            sourceRef.current = null;
          }
        }
        
        // Conectar fuente de audio si no existe o si cambió el elemento
        if (audioElement && (!sourceRef.current || audioElementChanged)) {
          logger.dev('🔌 Conectando visualizador al elemento de audio...');
          
          // Crear fuente de audio
          try {
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
            // 🔧 Guardar referencias en el propio elemento para reutilizarlas
            try { 
              audioElement._visualizerSource = sourceRef.current;
              audioElement._visualizerAnalyser = analyserRef.current;
              audioElement._visualizerContext = audioContextRef.current;
            } catch (_) {}
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
            connectedAudioElementRef.current = audioElement;
            logger.dev('✅ Visualizador conectado correctamente');
          } catch (error) {
            // Si ya existe un MediaElementSource para este elemento
            if (error.name === 'InvalidStateError') {
              logger.dev('ℹ️ El elemento de audio ya tiene una fuente conectada - reutilizando sin modificar');
              // Reutilizar TODO el setup existente guardado en el elemento
              const existingSource = audioElement._visualizerSource;
              const existingAnalyser = audioElement._visualizerAnalyser;
              const existingContext = audioElement._visualizerContext;
              
              if (existingSource && existingAnalyser && existingContext) {
                // 🔧 CRÍTICO: Solo actualizar refs sin crear nada nuevo
                sourceRef.current = existingSource;
                analyserRef.current = existingAnalyser;
                audioContextRef.current = existingContext;
                
                // Regenerar dataArray si es necesario
                if (!dataArrayRef.current) {
                  const bufferLength = analyserRef.current.frequencyBinCount;
                  dataArrayRef.current = new Uint8Array(bufferLength);
                }
                
                connectedAudioElementRef.current = audioElement;
                logger.dev('♻️ Setup completo reutilizado - sin crear nuevas conexiones');
              } else {
                logger.warn('⚠️ Fuente existente pero faltan referencias guardadas');
                sourceRef.current = existingSource;
                connectedAudioElementRef.current = audioElement;
              }
            } else {
              throw error;
            }
          }
        } else if (audioElement && sourceRef.current && connectedAudioElementRef.current === audioElement) {
          // El elemento es el mismo y ya está conectado - perfecto, el visualizador sigue funcionando
          if (trackChanged) {
            logger.dev('✅ Visualizador sigue conectado - Nueva canción:', currentTrack);
          }
        }

        // Crear array para datos de frecuencia
        if (analyserRef.current) {
          const bufferLength = analyserRef.current.frequencyBinCount;
          dataArrayRef.current = new Uint8Array(bufferLength);
        }
      } catch (error) {
        logger.warn('⚠️ Error en setupAudioConnection:', error);
      }
    };

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
      // Detener el loop al desmontar
      shouldContinueDrawingRef.current = false;
      
      if (visualizerAnimationRef.current) {
        logger.dev('🧹 Limpiando loop de visualización en cleanup...');
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

      {/* Ondas concéntricas reactivas al ritmo */}
      {/* ⚠️ TEMPORALMENTE DESACTIVADO - Para reactivar, descomentar este bloque
      {isPlaying && waves.map(wave => (
          <motion.div
            key={wave.id}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: `${100 * wave.scale}px`,
              height: `${100 * wave.scale}px`,
              border: `2px solid rgba(162, 217, 247, ${wave.opacity * wave.intensity})`,
              boxShadow: `0 0 ${15 * wave.intensity}px rgba(162, 217, 247, ${wave.opacity * wave.intensity * 0.8})`,
              opacity: wave.opacity,
            }}
          />
      ))}
      */}

      {/* Botón central con estilo original */}
      <motion.button
        onClick={onPlayPause}
        disabled={disabled}
        title={blockMessage || ((isPlaying || isManualPlaybackActive) ? 'Pausar' : 'Reproducir')}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-150 z-10
          ${(isPlaying || isManualPlaybackActive)
            ? 'bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15' 
            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}
          backdrop-blur-lg shadow-[0_0_30px_rgba(162,217,247,0.3)] dark:shadow-[0_0_30px_rgba(255,255,255,0.2)]
          hover:shadow-[0_0_40px_rgba(162,217,247,0.4)] dark:hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]
          text-black/90 dark:text-white/90 transition-transform duration-150`}
        whileHover={!disabled ? { scale: 1.1 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        transition={{ type: "spring", stiffness: 600, damping: 15 }}
      >
        {(isPlaying || isManualPlaybackActive) ? (
          <Pause className="w-10 h-10" />
        ) : (
          <Play className="w-10 h-10 ml-1" />
        )}
      </motion.button>
    </div>
  );
};

export default ReactivePlayButton;

