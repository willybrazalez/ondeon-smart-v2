/**
 * AudioNormalizationService - Normalización de volumen con Web Audio API
 * 
 * ============================================================================
 * ONDEON SMART v2 - Normalización de Loudness para Contenidos
 * ============================================================================
 * 
 * Problema: Los contenidos (cuñas, spots, locuciones) suelen tener un volumen
 * más bajo que las canciones musicales comerciales (que están muy comprimidas
 * por la "loudness war").
 * 
 * Solución: Usar Web Audio API para:
 * 1. Medir el loudness real (RMS) de las canciones durante reproducción
 * 2. Medir el loudness del contenido durante su fade-in
 * 3. Aplicar ganancia compensatoria automática vía GainNode
 * 
 * Arquitectura del grafo de audio:
 * 
 * MÚSICA (normal):
 *   source → analyser → gainNode(1.0) → destination
 *   El gainNode está en 1.0, no altera el sonido de la música.
 * 
 * CONTENIDO (reproductor nuevo - Desktop):
 *   source → contentAnalyser → contentGainNode(normalizado) → destination
 *   GainNode puede amplificar más allá de 1.0 (imposible con audioElement.volume).
 * 
 * CONTENIDO (reproductor reutilizado - iOS):
 *   El mismo source de música ahora reproduce contenido.
 *   Se reutiliza el gainNode existente, ajustando su ganancia para compensar.
 *   source → analyser → gainNode(normalizado) → destination
 *   Al terminar, gainNode vuelve a 1.0.
 * 
 * Compatibilidad:
 * - Chrome, Firefox, Safari, Edge (todos soportan Web Audio API)
 * - iOS: Requiere AudioContext.resume() tras interacción del usuario
 * - Fallback: Si Web Audio API no está disponible, no se aplica normalización
 */

import logger from '../lib/logger.js';

// Nivel de referencia RMS objetivo para contenidos
const TARGET_LOUDNESS_RMS = 0.15; // RMS lineal objetivo (~-16.5 dBFS)
const MIN_GAIN = 0.5;             // Ganancia mínima (nunca bajar más de 50%)
const MAX_GAIN = 4.0;             // Ganancia máxima (nunca subir más de 4x / +12dB)
const ANALYSIS_DURATION_MS = 600;  // Duración del análisis de loudness
const ANALYSIS_INTERVAL_MS = 50;   // Intervalo de muestreo durante análisis
const MUSIC_REFERENCE_SAMPLES = 10; // Muestras de referencia de música a mantener

class AudioNormalizationService {
  constructor() {
    /** @type {AudioContext|null} */
    this.audioContext = null;
    
    // Referencia de loudness de la música (promedio de las últimas N canciones)
    this.musicLoudnessSamples = [];
    this.currentMusicRMS = TARGET_LOUDNESS_RMS;
    
    // Nodo de ganancia activo para contenido (reproductor nuevo)
    /** @type {GainNode|null} */
    this.contentGainNode = null;
    
    // MediaElementSource activo (para evitar doble conexión)
    /** @type {Map<HTMLAudioElement, MediaElementAudioSourceNode>} */
    this.connectedSources = new Map();
    
    // Estado
    this.isSupported = typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
    this.isInitialized = false;
    
    // Cadena de música: source → analyser → musicGainNode → destination
    /** @type {GainNode|null} */
    this.musicGainNode = null;  // GainNode en la cadena de música (1.0 normal, ajustable para contenido iOS)
    /** @type {AnalyserNode|null} */
    this.musicAnalyser = null;
    /** @type {MediaElementAudioSourceNode|null} */
    this.musicSourceNode = null;
    this.musicAnalysisInterval = null;
    
    // Estado de normalización iOS (player reutilizado)
    this._isNormalizingReusedPlayer = false;
    this._lastNormalizationGain = null;
    
    logger.dev(`🔊 AudioNormalizationService: Web Audio API ${this.isSupported ? 'disponible' : 'NO disponible'}`);
  }

  /**
   * Inicializar AudioContext (debe llamarse tras interacción del usuario para iOS)
   */
  async initialize() {
    if (this.isInitialized) return true;
    if (!this.isSupported) {
      logger.warn('⚠️ Web Audio API no soportada - normalización desactivada');
      return false;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      
      // iOS requiere resume() explícito tras interacción
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.isInitialized = true;
      logger.dev('✅ AudioNormalizationService inicializado (AudioContext state:', this.audioContext.state + ')');
      return true;
    } catch (error) {
      logger.error('❌ Error inicializando AudioContext:', error);
      this.isSupported = false;
      return false;
    }
  }

  /**
   * Asegurar que el AudioContext está activo
   */
  async ensureContextActive() {
    if (!this.audioContext) {
      return await this.initialize();
    }
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        logger.dev('🔊 AudioContext reanudado');
      } catch (e) {
        logger.warn('⚠️ No se pudo reanudar AudioContext:', e);
        return false;
      }
    }
    
    return this.audioContext.state === 'running';
  }

  /**
   * Conectar el reproductor de música con cadena completa incluyendo GainNode.
   * Cadena: source → analyser → musicGainNode(1.0) → destination
   * 
   * El musicGainNode permite:
   * - Música normal: ganancia 1.0 (sin alteración)
   * - Contenido iOS (player reutilizado): ganancia > 1.0 para normalizar
   * 
   * @param {HTMLAudioElement} musicPlayer - Elemento de audio de música
   */
  connectMusicPlayer(musicPlayer) {
    if (!this.isInitialized || !musicPlayer) return;

    try {
      // Evitar doble conexión
      if (this.connectedSources.has(musicPlayer)) {
        logger.dev('🎵 Reproductor de música ya conectado al analizador');
        return;
      }

      const source = this.audioContext.createMediaElementSource(musicPlayer);
      
      // Crear analizador para medir loudness
      this.musicAnalyser = this.audioContext.createAnalyser();
      this.musicAnalyser.fftSize = 2048;
      this.musicAnalyser.smoothingTimeConstant = 0.8;
      
      // Crear GainNode para la cadena de música
      // En modo normal: ganancia 1.0 (transparente)
      // En modo contenido iOS: ganancia ajustada para normalizar
      this.musicGainNode = this.audioContext.createGain();
      this.musicGainNode.gain.value = 1.0;
      
      // Cadena: source → analyser → musicGainNode → destination
      source.connect(this.musicAnalyser);
      this.musicAnalyser.connect(this.musicGainNode);
      this.musicGainNode.connect(this.audioContext.destination);
      
      this.connectedSources.set(musicPlayer, source);
      this.musicSourceNode = source;
      
      // Iniciar muestreo periódico del loudness de música
      this.startMusicLoudnessTracking();
      
      logger.dev('✅ Reproductor de música conectado: source → analyser → gainNode(1.0) → destination');
    } catch (error) {
      if (error.name === 'InvalidStateError') {
        logger.dev('ℹ️ Reproductor ya conectado a otro nodo - reutilizando conexión existente');
      } else {
        logger.error('❌ Error conectando reproductor de música:', error);
      }
    }
  }

  /**
   * Obtener los nodos de audio del reproductor de música para uso externo (ej: visualizador).
   */
  getMusicAudioNodes() {
    if (!this.isInitialized || !this.audioContext || !this.musicSourceNode) {
      return null;
    }
    return {
      audioContext: this.audioContext,
      sourceNode: this.musicSourceNode,
      analyser: this.musicAnalyser
    };
  }

  /**
   * Iniciar muestreo periódico del loudness de la música
   */
  startMusicLoudnessTracking() {
    if (this.musicAnalysisInterval) {
      clearInterval(this.musicAnalysisInterval);
    }

    this.musicAnalysisInterval = setInterval(() => {
      // No medir si estamos normalizando contenido en el player reutilizado
      if (!this.musicAnalyser || this._isNormalizingReusedPlayer) return;
      
      const rms = this.measureRMS(this.musicAnalyser);
      
      // Solo registrar si hay audio real (no silencio)
      if (rms > 0.01) {
        this.musicLoudnessSamples.push(rms);
        
        if (this.musicLoudnessSamples.length > MUSIC_REFERENCE_SAMPLES) {
          this.musicLoudnessSamples.shift();
        }
        
        this.currentMusicRMS = this.musicLoudnessSamples.reduce((a, b) => a + b, 0) 
                               / this.musicLoudnessSamples.length;
      }
    }, 2000);
  }

  /**
   * Medir RMS (Root Mean Square) de un AnalyserNode.
   * 
   * @param {AnalyserNode} analyser
   * @returns {number} Valor RMS (0.0 - 1.0)
   */
  measureRMS(analyser) {
    if (!analyser) return 0;
    
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);
    
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      sumSquares += dataArray[i] * dataArray[i];
    }
    
    return Math.sqrt(sumSquares / bufferLength);
  }

  // =========================================================================
  // NORMALIZACIÓN PARA REPRODUCTOR NUEVO (Desktop / no-iOS)
  // =========================================================================

  /**
   * Crear cadena de procesamiento para contenido con normalización.
   * Conecta: audioElement → source → contentAnalyser → contentGainNode → destination
   * 
   * @param {HTMLAudioElement} contentPlayer - Elemento de audio del contenido
   * @returns {{ gainNode: GainNode, analyser: AnalyserNode, source: MediaElementAudioSourceNode }|null}
   */
  createContentChain(contentPlayer) {
    if (!this.isInitialized || !contentPlayer) return null;

    try {
      if (this.connectedSources.has(contentPlayer)) {
        logger.dev('ℹ️ Contenido ya conectado - reutilizando cadena existente');
        return { gainNode: this.contentGainNode, source: this.connectedSources.get(contentPlayer) };
      }

      const source = this.audioContext.createMediaElementSource(contentPlayer);
      
      // Crear GainNode para control de volumen amplificado
      this.contentGainNode = this.audioContext.createGain();
      this.contentGainNode.gain.value = 1.0;
      
      // Crear analizador para medir loudness del contenido
      const contentAnalyser = this.audioContext.createAnalyser();
      contentAnalyser.fftSize = 2048;
      contentAnalyser.smoothingTimeConstant = 0.3;
      
      // Cadena: source → analyser → gainNode → destination
      source.connect(contentAnalyser);
      contentAnalyser.connect(this.contentGainNode);
      this.contentGainNode.connect(this.audioContext.destination);
      
      this.connectedSources.set(contentPlayer, source);
      
      logger.dev('✅ Cadena de normalización creada para contenido (reproductor nuevo)');
      
      return { gainNode: this.contentGainNode, source, analyser: contentAnalyser };
    } catch (error) {
      if (error.name === 'InvalidStateError') {
        logger.dev('ℹ️ Contenido ya conectado a otro nodo');
      } else {
        logger.error('❌ Error creando cadena de normalización:', error);
      }
      return null;
    }
  }

  /**
   * Analizar loudness y calcular ganancia compensatoria.
   * 
   * @param {AnalyserNode} analyser - Analizador conectado al contenido
   * @param {GainNode} gainNode - Nodo de ganancia a ajustar
   * @returns {Promise<number>} Ganancia aplicada
   */
  async analyzeAndNormalize(analyser, gainNode) {
    if (!analyser || !gainNode) return 1.0;

    const samples = [];
    const totalSamples = Math.floor(ANALYSIS_DURATION_MS / ANALYSIS_INTERVAL_MS);
    
    for (let i = 0; i < totalSamples; i++) {
      const rms = this.measureRMS(analyser);
      if (rms > 0.005) {
        samples.push(rms);
      }
      await new Promise(r => setTimeout(r, ANALYSIS_INTERVAL_MS));
    }

    if (samples.length === 0) {
      logger.dev('🔊 No se detectó audio durante análisis - manteniendo ganancia neutral');
      return 1.0;
    }

    const contentRMS = samples.reduce((a, b) => a + b, 0) / samples.length;
    const referenceRMS = this.currentMusicRMS > 0.01 ? this.currentMusicRMS : TARGET_LOUDNESS_RMS;
    
    let gain = referenceRMS / contentRMS;
    gain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, gain));
    
    // Aplicar ganancia con rampa suave
    const currentTime = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
    gainNode.gain.linearRampToValueAtTime(gain, currentTime + 0.3);
    
    logger.dev('🔊 Normalización aplicada:', {
      contentRMS: contentRMS.toFixed(4),
      musicReferenceRMS: referenceRMS.toFixed(4),
      gananciaCalculada: gain.toFixed(2) + 'x',
      gananciadB: (20 * Math.log10(gain)).toFixed(1) + ' dB',
      muestrasAnalizadas: samples.length
    });

    return gain;
  }

  /**
   * Aplicar volumen al contenido a través del GainNode.
   * 
   * @param {number} volume - Volumen deseado (0.0 - 1.0)
   */
  setContentVolume(volume) {
    // Determinar qué GainNode usar
    const gainNode = this._isNormalizingReusedPlayer ? this.musicGainNode : this.contentGainNode;
    if (!gainNode || !this.audioContext) return;
    
    const normalizationGain = this._lastNormalizationGain || 1.0;
    const newGain = volume * normalizationGain;
    
    const currentTime = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
    gainNode.gain.linearRampToValueAtTime(newGain, currentTime + 0.05);
  }

  /**
   * Proceso completo: conectar contenido nuevo, analizar y normalizar.
   * Para reproductores NUEVOS (no reutilizados de iOS).
   * 
   * @param {HTMLAudioElement} contentPlayer - Reproductor de contenido
   * @param {number} targetVolume - Volumen objetivo (contentVolume × masterVolume)
   * @returns {Promise<{ gainNode: GainNode|null, gain: number }>}
   */
  async normalizeContent(contentPlayer, targetVolume) {
    if (!this.isInitialized) {
      const ok = await this.initialize();
      if (!ok) {
        return { gainNode: null, gain: 1.0 };
      }
    }

    await this.ensureContextActive();

    const chain = this.createContentChain(contentPlayer);
    if (!chain) {
      return { gainNode: null, gain: 1.0 };
    }

    const { gainNode, analyser } = chain;
    
    // El audioElement.volume se deja en 1.0, el GainNode controla todo
    gainNode.gain.value = targetVolume;
    contentPlayer.volume = 1.0;

    // Analizar loudness en paralelo
    if (analyser) {
      this.analyzeAndNormalize(analyser, gainNode).then(normGain => {
        this._lastNormalizationGain = normGain;
        const finalGain = targetVolume * normGain;
        const clampedGain = Math.min(finalGain, MAX_GAIN);
        
        const currentTime = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.linearRampToValueAtTime(clampedGain, currentTime + 0.3);
        
        logger.dev('🔊 Ganancia final de contenido (reproductor nuevo):', {
          volumenUsuario: targetVolume.toFixed(2),
          normalizacion: normGain.toFixed(2) + 'x',
          gananciaFinal: clampedGain.toFixed(2),
          gananciaFinaldB: (20 * Math.log10(clampedGain)).toFixed(1) + ' dB'
        });
      });
    }

    return { gainNode, gain: 1.0 };
  }

  // =========================================================================
  // NORMALIZACIÓN PARA REPRODUCTOR REUTILIZADO (iOS)
  // =========================================================================

  /**
   * Activar normalización para el reproductor reutilizado (iOS).
   * Usa el musicGainNode existente en la cadena de música para amplificar.
   * 
   * Cadena existente: source → analyser → musicGainNode → destination
   * Acción: musicGainNode.gain pasa de 1.0 a (targetVolume × normalizationFactor)
   * 
   * IMPORTANTE: El audioElement.volume se deja en 1.0 para que el GainNode
   * tenga control total (puede amplificar más allá de 1.0).
   * 
   * @param {HTMLAudioElement} reusedPlayer - El reproductor principal reutilizado
   * @param {number} targetVolume - Volumen objetivo (contentVolume × masterVolume)
   * @returns {Promise<boolean>} true si la normalización se activó
   */
  async activateReusedPlayerNormalization(reusedPlayer, targetVolume) {
    if (!this.isInitialized || !this.musicGainNode || !this.musicAnalyser) {
      logger.dev('ℹ️ Normalización iOS no disponible (no inicializado o sin cadena de música)');
      return false;
    }

    await this.ensureContextActive();
    
    this._isNormalizingReusedPlayer = true;
    
    // El audioElement.volume se deja en 1.0 para que el GainNode controle todo
    // Esto permite amplificar más allá de lo que audioElement.volume permite (0-1)
    reusedPlayer.volume = 1.0;
    
    // Configurar ganancia inicial al volumen objetivo (sin normalización aún)
    const currentTime = this.audioContext.currentTime;
    this.musicGainNode.gain.setValueAtTime(0.001, currentTime); // Empezar casi en silencio
    this.musicGainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + 0.8); // Fade in de 800ms
    
    logger.dev('🍎🔊 Normalización iOS activada - fade in via GainNode:', {
      targetVolume: targetVolume.toFixed(2),
      musicGainNodeActive: true
    });
    
    // Analizar loudness del contenido en paralelo (durante el fade-in)
    this._analyzeReusedPlayerContent(targetVolume);
    
    return true;
  }

  /**
   * Analizar loudness del contenido en el reproductor reutilizado y ajustar ganancia.
   * Se ejecuta en paralelo con el fade-in.
   * 
   * @param {number} targetVolume - Volumen objetivo base
   */
  async _analyzeReusedPlayerContent(targetVolume) {
    try {
      // Esperar a que el contenido empiece a sonar (después del fade-in inicial)
      await new Promise(r => setTimeout(r, 400));
      
      if (!this._isNormalizingReusedPlayer || !this.musicAnalyser) return;
      
      const samples = [];
      const totalSamples = Math.floor(ANALYSIS_DURATION_MS / ANALYSIS_INTERVAL_MS);
      
      for (let i = 0; i < totalSamples; i++) {
        if (!this._isNormalizingReusedPlayer) return; // Cancelado
        const rms = this.measureRMS(this.musicAnalyser);
        if (rms > 0.005) {
          samples.push(rms);
        }
        await new Promise(r => setTimeout(r, ANALYSIS_INTERVAL_MS));
      }
      
      if (samples.length === 0 || !this._isNormalizingReusedPlayer) return;
      
      const contentRMS = samples.reduce((a, b) => a + b, 0) / samples.length;
      const referenceRMS = this.currentMusicRMS > 0.01 ? this.currentMusicRMS : TARGET_LOUDNESS_RMS;
      
      // Calcular ganancia de normalización
      let normGain = referenceRMS / contentRMS;
      normGain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, normGain));
      
      this._lastNormalizationGain = normGain;
      
      // Aplicar ganancia final: volumen del usuario × normalización
      const finalGain = Math.min(targetVolume * normGain, MAX_GAIN);
      
      const currentTime = this.audioContext.currentTime;
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, currentTime);
      this.musicGainNode.gain.linearRampToValueAtTime(finalGain, currentTime + 0.3);
      
      logger.dev('🍎🔊 Normalización iOS aplicada:', {
        contentRMS: contentRMS.toFixed(4),
        musicReferenceRMS: referenceRMS.toFixed(4),
        normalizacion: normGain.toFixed(2) + 'x',
        volumenBase: targetVolume.toFixed(2),
        gananciaFinal: finalGain.toFixed(2),
        gananciaFinaldB: (20 * Math.log10(finalGain)).toFixed(1) + ' dB'
      });
    } catch (e) {
      logger.dev('ℹ️ Análisis de normalización iOS no completado:', e.message);
    }
  }

  /**
   * Desactivar normalización del reproductor reutilizado (iOS).
   * Restaura el musicGainNode a ganancia 1.0 para música normal.
   * 
   * @param {number} restoreVolume - Volumen al que restaurar (musicVolume × masterVolume)
   * @param {number} fadeDurationMs - Duración del fade de restauración
   */
  async deactivateReusedPlayerNormalization(restoreVolume = 1.0, fadeDurationMs = 800) {
    if (!this._isNormalizingReusedPlayer || !this.musicGainNode) {
      this._isNormalizingReusedPlayer = false;
      return;
    }
    
    // Fade out suave del contenido (800ms por defecto)
    const currentTime = this.audioContext.currentTime;
    this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, currentTime);
    this.musicGainNode.gain.linearRampToValueAtTime(0.001, currentTime + (fadeDurationMs / 1000));
    
    await new Promise(r => setTimeout(r, fadeDurationMs));
    
    // Dejar musicGainNode en 0 — el fade-in de la música lo subirá gradualmente
    // NO restaurar a 1.0 aquí, eso lo hace el audioPlayerService con un fade suave
    this.musicGainNode.gain.setValueAtTime(0.001, this.audioContext.currentTime);
    
    this._isNormalizingReusedPlayer = false;
    this._lastNormalizationGain = null;
    
    logger.dev('🍎🔊 Normalización iOS desactivada - musicGainNode en 0 (esperando fade-in de música)');
  }

  // =========================================================================
  // FADE HELPERS
  // =========================================================================

  /**
   * Hacer fade-in del contenido a través del GainNode
   */
  async fadeInContent(gainNode, targetVolume, durationMs = 800) {
    if (!gainNode || !this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    const durationSec = durationMs / 1000;
    
    gainNode.gain.setValueAtTime(0.001, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(targetVolume, 0.001), 
      currentTime + durationSec
    );
    
    await new Promise(r => setTimeout(r, durationMs));
    logger.dev('✅ Fade in de contenido completado (via GainNode)');
  }

  /**
   * Hacer fade-out del contenido a través del GainNode
   */
  async fadeOutContent(gainNode, durationMs = 300) {
    if (!gainNode || !this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    const durationSec = durationMs / 1000;
    
    gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + durationSec);
    
    await new Promise(r => setTimeout(r, durationMs));
    logger.dev('✅ Fade out de contenido completado (via GainNode)');
  }

  // =========================================================================
  // LIMPIEZA
  // =========================================================================

  /**
   * Desconectar un reproductor de contenido nuevo y limpiar sus nodos.
   * NO usar para el reproductor reutilizado de iOS (usar deactivateReusedPlayerNormalization).
   */
  disconnectPlayer(player) {
    if (!player) return;
    
    const source = this.connectedSources.get(player);
    if (source) {
      try { source.disconnect(); } catch (e) {}
      this.connectedSources.delete(player);
    }
    
    if (this.contentGainNode) {
      try { this.contentGainNode.disconnect(); } catch (e) {}
      this.contentGainNode = null;
    }
    
    this._lastNormalizationGain = null;
    
    logger.dev('🧹 Reproductor de contenido desconectado de normalización');
  }

  /**
   * Obtener el estado actual del servicio
   */
  getState() {
    return {
      isSupported: this.isSupported,
      isInitialized: this.isInitialized,
      audioContextState: this.audioContext?.state || 'none',
      musicReferenceRMS: this.currentMusicRMS?.toFixed(4),
      musicSamples: this.musicLoudnessSamples.length,
      lastNormalizationGain: this._lastNormalizationGain?.toFixed(2) || 'none',
      isNormalizingReusedPlayer: this._isNormalizingReusedPlayer,
      hasMusicGainNode: !!this.musicGainNode,
      musicGainValue: this.musicGainNode?.gain?.value?.toFixed(2) || 'none',
      connectedPlayers: this.connectedSources.size
    };
  }

  /**
   * Limpiar todo
   */
  destroy() {
    if (this.musicAnalysisInterval) {
      clearInterval(this.musicAnalysisInterval);
      this.musicAnalysisInterval = null;
    }
    
    for (const [player, source] of this.connectedSources) {
      try { source.disconnect(); } catch (e) {}
    }
    this.connectedSources.clear();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (e) {}
    }
    
    this.audioContext = null;
    this.isInitialized = false;
    this.musicLoudnessSamples = [];
    this.contentGainNode = null;
    this.musicGainNode = null;
    this.musicAnalyser = null;
    this.musicSourceNode = null;
    this._isNormalizingReusedPlayer = false;
    this._lastNormalizationGain = null;
    
    logger.dev('🧹 AudioNormalizationService destruido');
  }
}

// Exportar singleton
const audioNormalization = new AudioNormalizationService();

// Debug en desarrollo
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.audioNormalizationDebug = audioNormalization;
}

export default audioNormalization;
