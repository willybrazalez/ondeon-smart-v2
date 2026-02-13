import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import logger from '../../lib/logger.js';

/**
 * Botón de play/pause con ondas concéntricas y anillo visualizador de audio
 * Sistema visual decorativo sincronizado con la música
 * 
 * El audio principal se conecta al AudioContext para obtener datos de frecuencia.
 * Al bloquear pantalla el AudioContext se suspende (sin sonido); al desbloquear
 * se reanuda automáticamente junto con la reproducción.
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
  const connectedAudioElementRef = useRef(null);
  const lastTrackRef = useRef(null);
  const shouldContinueDrawingRef = useRef(false);
  const [visualizerKey, setVisualizerKey] = useState(0);

  // 🔧 Fallback: obtener audioElement del servicio si el prop llega null (race condition)
  const [fetchedElement, setFetchedElement] = useState(null);
  const effectiveAudioElement = audioElement || fetchedElement;

  useEffect(() => {
    if (audioElement) { setFetchedElement(null); return; }
    if (!(isPlaying || isManualPlaybackActive)) return;
    let cancelled = false;
    import('../../services/audioPlayerService').then(({ default: ap }) => {
      if (cancelled) return;
      const el = ap.getState()?.audioElement;
      if (el?.src) setFetchedElement(el);
    });
    return () => { cancelled = true; };
  }, [audioElement, isPlaying, isManualPlaybackActive]);

  // 📱 Resumir AudioContext + reproducción cuando la página vuelve visible (desbloqueo)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      // Reanudar AudioContext del visualizador (puede ser compartido con normalization service)
      const ctx = audioContextRef.current;
      if (ctx?.state === 'suspended') {
        ctx.resume().then(() => {
          logger.dev('📱 AudioContext reanudado tras desbloqueo');
          // Forzar reinicio del visualizador al volver
          setVisualizerKey(prev => prev + 1);
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 🔍 Vigilar cambios en audioElement o su src para forzar reinicio del visualizador
  useEffect(() => {
    const el = effectiveAudioElement;
    if ((!isPlaying && !isManualPlaybackActive) || !el) return;
    let lastSrc = el?.src;
    const intervalId = setInterval(() => {
      const currentSrc = el?.src;
      if (el && connectedAudioElementRef.current !== el) {
        setVisualizerKey(prev => prev + 1);
        lastSrc = currentSrc;
      } else if (el && currentSrc && currentSrc !== lastSrc) {
        setVisualizerKey(prev => prev + 1);
        lastSrc = currentSrc;
      }
    }, 100);
    return () => clearInterval(intervalId);
  }, [isPlaying, isManualPlaybackActive, effectiveAudioElement]);

  // 🎨 Audio Visualizer - Inicialización y dibujado
  useEffect(() => {
    let cancelled = false;
    shouldContinueDrawingRef.current = false;
    if (visualizerAnimationRef.current) {
      cancelAnimationFrame(visualizerAnimationRef.current);
      visualizerAnimationRef.current = null;
    }

    const shouldVisualize = isPlaying || isManualPlaybackActive;
    if (!shouldVisualize || !effectiveAudioElement || !canvasRef.current) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const trackChanged = currentTrack && lastTrackRef.current !== currentTrack;
    if (trackChanged) lastTrackRef.current = currentTrack;

    // Configurar Web Audio API - Reutilizar conexión del audioNormalizationService
    // IMPORTANTE: createMediaElementSource solo puede llamarse UNA vez por elemento.
    // El audioNormalizationService ya lo llama, así que conectamos nuestro analyser
    // al sourceNode que ya existe en ese servicio.
    const setupAudioConnection = async () => {
      try {
        // Intentar obtener los nodos del servicio de normalización
        const { default: audioNormService } = await import('../../services/audioNormalizationService');
        const sharedNodes = audioNormService.getMusicAudioNodes();
        
        if (sharedNodes) {
          const { audioContext, sourceNode } = sharedNodes;
          audioContextRef.current = audioContext;
          sourceRef.current = sourceNode;
          
          // Crear nuestro propio AnalyserNode para el visualizador (fftSize más pequeño para barras)
          if (!analyserRef.current || analyserRef.current.context !== audioContext) {
            analyserRef.current = audioContext.createAnalyser();
            analyserRef.current.fftSize = 128;
            analyserRef.current.smoothingTimeConstant = 0.8;
          }
          
          // Conectar: sourceNode → nuestro analyser (sin conectar a destination, ya lo hace el normService)
          // Verificar si ya está conectado comparando el elemento
          if (connectedAudioElementRef.current !== effectiveAudioElement) {
            try {
              sourceNode.connect(analyserRef.current);
              // NO conectar analyser a destination - el normService ya conecta source → su analyser → destination
              connectedAudioElementRef.current = effectiveAudioElement;
              logger.dev('✅ Visualizador conectado al grafo de audio compartido');
            } catch (connectError) {
              // Puede fallar si ya está conectado, lo cual está bien
              connectedAudioElementRef.current = effectiveAudioElement;
              logger.dev('♻️ Visualizador ya conectado al grafo compartido');
            }
          }
          
          dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
          
          // Reanudar AudioContext si está suspendido
          if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
          }
          return;
        }
        
        // Fallback: si el normalization service aún no conectó, crear conexión propia
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 128;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        if (effectiveAudioElement && connectedAudioElementRef.current !== effectiveAudioElement) {
          try {
            sourceRef.current = audioContextRef.current.createMediaElementSource(effectiveAudioElement);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
            connectedAudioElementRef.current = effectiveAudioElement;
            logger.dev('✅ Visualizador conectado directamente (fallback)');
          } catch (error) {
            if (error.name === 'InvalidStateError') {
              // El elemento ya fue conectado por otro servicio, reintentar con nodos compartidos
              logger.dev('⏳ Elemento ya conectado por otro servicio, reintentando en 500ms...');
              setTimeout(() => setVisualizerKey(prev => prev + 1), 500);
              return;
            }
            throw error;
          }
        }

        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }

        if (analyserRef.current) {
          dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        }
      } catch (error) {
        logger.warn('⚠️ Error en setupAudioConnection:', error);
      }
    };

    // Función de dibujado
    const draw = () => {
      if (!shouldContinueDrawingRef.current) return;
      if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;
      if (!(isPlaying || isManualPlaybackActive) || !effectiveAudioElement) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 50;

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = 32;
      const angleStep = (Math.PI * 2) / bars;

      for (let i = 0; i < bars; i++) {
        const bassIndex = Math.floor(i / 3);
        const midIndex = Math.floor((i / 3) + 10);
        const highIndex = Math.floor((i / 3) + 21);

        let frequencyValue;
        if (i < bars / 3) {
          frequencyValue = dataArrayRef.current[bassIndex] || 0;
        } else if (i < (bars * 2) / 3) {
          frequencyValue = dataArrayRef.current[midIndex] || 0;
        } else {
          frequencyValue = dataArrayRef.current[highIndex] || 0;
        }

        const normalizedValue = frequencyValue / 255;
        const barHeight = normalizedValue * 30;
        const angle = i * angleStep - Math.PI / 2;

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        let color;
        if (i < bars / 3) {
          color = `rgba(100, 200, 255, ${0.6 + normalizedValue * 0.4})`;
        } else if (i < (bars * 2) / 3) {
          color = `rgba(162, 217, 247, ${0.6 + normalizedValue * 0.4})`;
        } else {
          color = `rgba(200, 230, 255, ${0.6 + normalizedValue * 0.4})`;
        }

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (normalizedValue > 0.5) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      visualizerAnimationRef.current = requestAnimationFrame(draw);
    };

    const startDrawing = () => {
      if (!analyserRef.current || !dataArrayRef.current || !canvasRef.current) return;
      shouldContinueDrawingRef.current = true;
      draw();
    };

    // setupAudioConnection es async, iniciar dibujo después de que se resuelva
    setupAudioConnection().then(() => {
      if (cancelled) return; // el efecto fue limpiado antes de que la promesa se resolviera
      startDrawing();
    });

    return () => {
      cancelled = true;
      shouldContinueDrawingRef.current = false;
      if (visualizerAnimationRef.current) {
        cancelAnimationFrame(visualizerAnimationRef.current);
        visualizerAnimationRef.current = null;
      }
    };
  }, [isPlaying, isManualPlaybackActive, effectiveAudioElement, currentTrack, visualizerKey]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ opacity: (isPlaying || isManualPlaybackActive) ? 1 : 0, transition: 'opacity 0.3s ease' }}
      />

      <motion.div
        className="absolute rounded-full border border-white/[0.06] pointer-events-none"
        style={{ width: '128px', height: '128px', top: '50%', left: '50%', marginTop: '-64px', marginLeft: '-64px' }}
        animate={(isPlaying || isManualPlaybackActive) ? { scale: [1, 1.08, 1], opacity: [0.2, 0.5, 0.2] } : { scale: 1, opacity: 0.15 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full border border-[#A2D9F7]/8 pointer-events-none"
        style={{ width: '112px', height: '112px', top: '50%', left: '50%', marginTop: '-56px', marginLeft: '-56px' }}
        animate={(isPlaying || isManualPlaybackActive) ? { scale: [1, 1.04, 1], opacity: [0.15, 0.35, 0.15] } : { scale: 1, opacity: 0.1 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />

      <motion.button
        onClick={() => {
          const ctx = audioContextRef.current;
          if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
          onPlayPause();
        }}
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
        {(isPlaying || isManualPlaybackActive) && (
          <motion.div
            className="absolute inset-2 rounded-full bg-gradient-to-br from-[#A2D9F7]/20 to-transparent"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        
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
