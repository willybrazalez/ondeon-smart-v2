/**
 * ScheduledContentService v2 - Gestiona contenidos programados
 * 
 * ============================================================================
 * ONDEON SMART v2 - Contenidos Programados
 * ============================================================================
 * 
 * Características:
 * ✅ Usa datos de programaciones desde AuthContext (via rpc_get_user_init)
 * ✅ NO hace queries directas - las programaciones vienen precargadas
 * ✅ Evalúa periodicidad (diaria, semanal, anual, una vez)
 * ✅ Evalúa frecuencia (cada X minutos)
 * ✅ Ejecuta contenidos según modo de audio
 * ✅ Suscripción Realtime a cambios en programaciones
 */

import { supabase } from '../lib/supabase.js';
import audioPlayer from './audioPlayerService.js';
import logger from '../lib/logger.js';

class ScheduledContentService {
  constructor() {
    // Estado del servicio
    this.isActive = false;
    this.userId = null;
    
    // Programaciones (precargadas desde AuthContext)
    this.programaciones = [];
    
    // Control de ejecución
    this.ultimasEjecuciones = new Map();
    this.isPlayingScheduledContent = false;
    this.currentProgramacion = null;
    this.primerCicloCompletado = false;
    this.userHasInteracted = false;
    
    // Bolsa de contenidos (sistema anti-repetición)
    this.bolsasContenidos = new Map();
    
    // Timer de verificación
    this.checkInterval = null;
    this.checkIntervalDuration = 10000; // 10 segundos
    
    // Realtime
    this.realtimeChannel = null;
  }

  /**
   * Iniciar servicio con programaciones precargadas
   */
  async iniciar(userId, programacionesActivas = []) {
    try {
      logger.dev('🚀 Iniciando ScheduledContentService v2 para usuario:', userId);
      
      if (!userId) {
        throw new Error('Usuario ID requerido');
      }
      
      // Limpiar instancia anterior
      this.detener();
      
      // Restaurar timestamps de ejecuciones
      this.cargarTimestampsDesdeStorage(userId);
      
      this.userId = userId;
      this.isActive = true;
      
      // Usar programaciones precargadas
      this.setProgramaciones(programacionesActivas);
      
      // Iniciar timer de verificación
      this.iniciarTimer();
      
      // Configurar Realtime para cambios
      this.configurarRealtime();
      
      logger.dev('✅ ScheduledContentService v2 iniciado');
      logger.dev(`📊 ${this.programaciones.length} programaciones activas`);
      
      return true;
    } catch (error) {
      logger.error('❌ Error iniciando ScheduledContentService:', error);
      return false;
    }
  }

  /**
   * Establecer programaciones desde AuthContext
   */
  setProgramaciones(programacionesActivas) {
    this.programaciones = programacionesActivas || [];
    
    // Limpiar bolsas para programaciones que ya no existen
    const idsActuales = new Set(this.programaciones.map(p => p.id));
    for (const id of this.bolsasContenidos.keys()) {
      if (!idsActuales.has(id)) {
        this.bolsasContenidos.delete(id);
      }
    }
    
    logger.dev(`📊 ${this.programaciones.length} programaciones establecidas`);
  }

  /**
   * Detener servicio
   */
  detener() {
    logger.dev('⏹️ Deteniendo ScheduledContentService...');
    
    this.isActive = false;
    
    // Detener timer
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Limpiar Realtime
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    
    // Guardar timestamps
    this.guardarTimestampsEnStorage();
    
    // Resetear estado
    this.userId = null;
    this.programaciones = [];
    this.bolsasContenidos.clear();
    this.isPlayingScheduledContent = false;
    this.currentProgramacion = null;
    this.primerCicloCompletado = false;
    
    logger.dev('✅ ScheduledContentService detenido');
  }

  /**
   * Iniciar timer de verificación
   */
  iniciarTimer() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    logger.dev(`⏰ Timer de verificación iniciado (cada ${this.checkIntervalDuration / 1000}s)`);
    
    // Primera verificación después de un ciclo
    this.checkInterval = setInterval(() => {
      if (this.isActive) {
        this.verificarProgramaciones();
      }
    }, this.checkIntervalDuration);
  }

  /**
   * Verificar programaciones pendientes
   */
  async verificarProgramaciones() {
    try {
      // Saltar primer ciclo para empezar con música
      if (!this.primerCicloCompletado) {
        this.primerCicloCompletado = true;
        return;
      }
      
      // Verificar estado del reproductor
      const audioState = audioPlayer.getState();
      
      // Detectar interacción del usuario
      if (!this.userHasInteracted) {
        if (audioState.isPlaying || audioState.isPaused) {
          this.userHasInteracted = true;
        } else {
          return;
        }
      }
      
      // No ejecutar si está en pausa
      if (!audioState.isPlaying) {
        return;
      }
      
      // No verificar si hay contenido reproduciéndose
      if (this.isPlayingScheduledContent) {
        return;
      }
      
      // Buscar programaciones para ejecutar
      for (const prog of this.programaciones) {
        if (this.debeEjecutarse(prog) && this.debeSonarAhora(prog)) {
          logger.dev(`🎬 Ejecutando programación: "${prog.nombre || prog.descripcion}"`);
          await this.ejecutarProgramacion(prog);
          break; // Solo una a la vez
        }
      }
      
    } catch (error) {
      logger.error('❌ Error verificando programaciones:', error);
    }
  }

  /**
   * Evaluar si una programación debe ejecutarse según periodicidad
   */
  debeEjecutarse(prog) {
    const ahora = new Date();
    const horaActual = ahora.toTimeString().slice(0, 5);
    const diaSemana = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][ahora.getDay()];
    const fechaActual = ahora.toISOString().slice(0, 10);

    // Verificar rango de fechas
    if (prog.fecha_inicio && fechaActual < prog.fecha_inicio) return false;
    if (prog.fecha_fin && fechaActual > prog.fecha_fin) return false;

    // Verificar rango horario
    if (prog.hora_inicio && prog.hora_fin) {
      if (horaActual < prog.hora_inicio.slice(0, 5) || horaActual > prog.hora_fin.slice(0, 5)) {
        return false;
      }
    }

    // Verificar días de la semana
    if (prog.dias_semana && prog.dias_semana.length > 0) {
      if (!prog.dias_semana.includes(diaSemana)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluar si debe sonar AHORA según frecuencia
   */
  debeSonarAhora(prog) {
    // Sin frecuencia = hora específica
    if (!prog.frecuencia_minutos || prog.frecuencia_minutos === 0) {
      const ultimaEjecucion = this.ultimasEjecuciones.get(prog.id);
      
      if (!ultimaEjecucion) {
        return true;
      }
      
      // Para programaciones diarias, verificar que no se haya ejecutado hoy
      const ahora = new Date();
      const ultEjec = new Date(ultimaEjecucion);
      const hoyStr = ahora.toISOString().split('T')[0];
      const ultEjecStr = ultEjec.toISOString().split('T')[0];
      
      return hoyStr !== ultEjecStr;
    }
    
    // Con frecuencia = cada X minutos
    const ahora = new Date();
    const minutosDelDia = ahora.getHours() * 60 + ahora.getMinutes();
    
    // ¿Estamos en un slot válido?
    const esSlotValido = (minutosDelDia % prog.frecuencia_minutos) === 0;
    if (!esSlotValido) {
      return false;
    }
    
    // Evitar dobles ejecuciones
    const ultimaEjecucion = this.ultimasEjecuciones.get(prog.id);
    if (ultimaEjecucion) {
      const f = new Date(ultimaEjecucion);
      const minutoActual = ahora.getMinutes();
      const horaActual = ahora.getHours();
      const mismoMinuto = f.getMinutes() === minutoActual && 
                         f.getHours() === horaActual &&
                         f.getDate() === ahora.getDate();
      if (mismoMinuto) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Ejecutar una programación
   */
  async ejecutarProgramacion(prog) {
    try {
      this.isPlayingScheduledContent = true;
      this.currentProgramacion = prog;
      
      // Contenidos vienen con la programación desde rpc_get_user_init
      const contenidos = prog.contenidos || [];
      
      if (contenidos.length === 0) {
        logger.warn('⚠️ Programación sin contenidos:', prog.nombre);
        this.isPlayingScheduledContent = false;
        this.currentProgramacion = null;
        return;
      }
      
      // Seleccionar contenido aleatorio
      const contenido = this.seleccionarContenidoAleatorio(prog.id, contenidos);
      
      if (!contenido) {
        logger.warn('⚠️ No se pudo seleccionar contenido');
        this.isPlayingScheduledContent = false;
        this.currentProgramacion = null;
        return;
      }
      
      logger.dev(`🎯 Contenido seleccionado: ${contenido.nombre}`);
      
      // Bloquear controles
      const contentName = contenido.nombre || 'Contenido programado';
      const duration = contenido.duracion_segundos || 30;
      
      if (typeof window.__startContentPlayback === 'function') {
        window.__startContentPlayback(contenido.id, contentName, duration);
      }
      
      // Reproducir
      const success = await audioPlayer.reproducirProgramacion([contenido], prog.modo_audio);
      
      if (success) {
        // Registrar ejecución
        this.ultimasEjecuciones.set(prog.id, Date.now());
        this.guardarTimestampsEnStorage();
        
        // Enviar evento de presencia
        try {
          const optimizedPresenceService = (await import('./optimizedPresenceService.js')).default;
          await optimizedPresenceService.sendScheduledContentStarted({
            title: contentName,
            type: contenido.tipo || 'contenido',
            programacionId: prog.id,
            duration
          });
        } catch (e) {
          // Ignorar errores de presencia
        }
        
        logger.dev('✅ Programación completada:', prog.nombre);
      } else {
        // Desbloquear si falló
        if (typeof window.__clearManualPlayback === 'function') {
          window.__clearManualPlayback();
        }
      }
      
    } catch (error) {
      logger.error('❌ Error ejecutando programación:', error);
    } finally {
      this.isPlayingScheduledContent = false;
      this.currentProgramacion = null;
    }
  }

  /**
   * Seleccionar contenido aleatorio con sistema de bolsa
   */
  seleccionarContenidoAleatorio(programacionId, contenidos) {
    if (!contenidos || contenidos.length === 0) return null;
    if (contenidos.length === 1) return contenidos[0];

    // Obtener o inicializar bolsa
    if (!this.bolsasContenidos.has(programacionId)) {
      this.bolsasContenidos.set(programacionId, {
        contenidos: [...contenidos],
        yaReproducidos: []
      });
    }

    const bolsa = this.bolsasContenidos.get(programacionId);

    // Reiniciar si vacía
    if (bolsa.contenidos.length === 0) {
      bolsa.contenidos = [...bolsa.yaReproducidos];
      bolsa.yaReproducidos = [];
    }

    // Seleccionar aleatorio
    const indice = Math.floor(Math.random() * bolsa.contenidos.length);
    const contenido = bolsa.contenidos.splice(indice, 1)[0];
    bolsa.yaReproducidos.push(contenido);

    return contenido;
  }

  /**
   * Configurar Realtime para cambios en programaciones
   */
  configurarRealtime() {
    if (!this.userId) return;

    try {
      const channelName = `programaciones-user-${this.userId}`;
      this.realtimeChannel = supabase.channel(channelName);
      
      // Escuchar cambios en programaciones
      this.realtimeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'programaciones'
        },
        () => {
          logger.dev('🔔 Cambio detectado en programaciones');
          // Notificar al AuthContext para recargar datos
          window.dispatchEvent(new CustomEvent('programacionesChanged'));
        }
      );
      
      this.realtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.dev('✅ Suscripción Realtime a programaciones activa');
        }
      });
      
    } catch (error) {
      logger.warn('⚠️ Error configurando Realtime:', error);
    }
  }

  /**
   * Guardar timestamps en localStorage
   */
  guardarTimestampsEnStorage() {
    if (!this.userId) return;
    
    try {
      const key = `scheduledContent_timestamps_${this.userId}`;
      const data = {
        timestamps: Object.fromEntries(this.ultimasEjecuciones),
        savedAt: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      logger.warn('⚠️ Error guardando timestamps:', error.message);
    }
  }
  
  /**
   * Cargar timestamps desde localStorage
   */
  cargarTimestampsDesdeStorage(userId) {
    try {
      const key = `scheduledContent_timestamps_${userId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        this.ultimasEjecuciones.clear();
        return;
      }
      
      const data = JSON.parse(stored);
      const ahora = Date.now();
      const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
      
      // Filtrar timestamps antiguos
      const timestampsValidos = new Map();
      for (const [key, value] of Object.entries(data.timestamps)) {
        const timestamp = typeof value === 'number' ? value : value.timestamp;
        if (ahora - timestamp < seteDiasMs) {
          timestampsValidos.set(key, value);
        }
      }
      
      this.ultimasEjecuciones = timestampsValidos;
      logger.dev(`📂 ${timestampsValidos.size} timestamps restaurados`);
      
    } catch (error) {
      logger.warn('⚠️ Error cargando timestamps:', error.message);
      this.ultimasEjecuciones.clear();
    }
  }

  /**
   * Obtener estado del servicio
   */
  getState() {
    return {
      isActive: this.isActive,
      userId: this.userId,
      programaciones: this.programaciones.length,
      isPlayingScheduledContent: this.isPlayingScheduledContent,
      currentProgramacion: this.currentProgramacion?.nombre || null
    };
  }
}

// Exportar singleton
const scheduledContentService = new ScheduledContentService();

// Debug en desarrollo
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.scheduledContentDebug = scheduledContentService;
}

export default scheduledContentService;
