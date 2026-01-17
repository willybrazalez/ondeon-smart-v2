/**
 * ScheduledContentService - Gestiona la reproducción de contenidos programados
 * 
 * Sistema independiente que funciona en paralelo al AutoDJ musical:
 * - Monitorea programaciones del usuario cada 60 segundos
 * - Evalúa periodicidad (diaria, semanal, anual, una vez)
 * - Evalúa frecuencia (cada X minutos)
 * - Ejecuta contenidos según modo de audio (fade_out o background)
 * - Sincronización en tiempo real con Supabase
 * 
 * NO interfiere con el AutoDJ musical, solo usa el audioPlayerService
 * para reproducir contenidos temporales.
 */

import { supabase } from '../lib/supabase.js';
import audioPlayer from './audioPlayerService.js';
import logger from '../lib/logger.js';

class ScheduledContentService {
  constructor() {
    // Usuario actual
    this.currentUserId = null;
    this.isActive = false;
    
    // Programaciones cargadas
    this.programaciones = [];
    
    // Control de ejecución
    this.ultimasEjecuciones = new Map(); // programacionId -> timestamp
    this.intentosFallidos = new Map(); // programacionId -> {timestamp, count} - Para evitar bucles infinitos
    this.bolsasContenidos = new Map(); // programacionId -> {contenidos: [], yaReproducidos: []}
    this.isPlayingScheduledContent = false;
    this.currentProgramacion = null;
    this.primerCicloCompletado = false; // Evitar ejecución inmediata al iniciar
    this.userHasInteracted = false; // 🔧 NUEVO: Flag para verificar interacción del usuario
    
    // 🔧 NUEVO: Cola de programaciones que esperan fin de canción
    this.programacionesEnEspera = []; // Array de programaciones que deben esperar fin de canción
    this.esperandoFinCancion = false; // Flag para indicar si estamos esperando fin de canción
    
    // Timers
    this.checkInterval = null;
    this.checkIntervalDuration = 10000; // 🔧 10 segundos (mayor precisión para horarios exactos)
    
    // Realtime
    this.realtimeChannel = null;
    this.realtimeStatus = 'DISCONNECTED'; // Estado de la conexión en tiempo real
    this.realtimeHeartbeat = null; // Timer para verificar conexión
    this.reconnectAttempts = 0; // Contador de intentos de reconexión
    this.maxReconnectAttempts = 10; // 🔧 AUMENTADO: 10 intentos (antes 5)
    this.reconnectTimer = null; // 🔧 NUEVO: Timer de reconexión para limpieza
    // Guardas de control para evitar bucles de reconexión
    this.isReconnecting = false; // Evita reconexiones concurrentes
    this.isClosingRealtime = false; // Marca cierre intencional (ignorar CLOSED)
    this.closingGraceMs = 1500; // Ventana de gracia tras cerrar
    this.closingUntilTs = 0; // Timestamp hasta el que se ignoran cierres
    this.activeChannelName = null; // Nombre del canal actual
    
    // 🔧 NUEVO: Polling como fallback cuando WebSocket falla
    this.pollingInterval = null; // Timer de polling
    this.pollingIntervalMs = 3 * 60 * 1000; // 3 minutos (balance entre responsividad y tráfico)
    this.lastPollingCheck = 0; // Timestamp de última verificación por polling
    this.isPollingActive = false; // Flag para saber si polling está activo
    
    // Page Visibility
    this._visibilityHandler = null; // Handler para cambios de visibilidad
  }

  /**
   * Iniciar servicio para un usuario
   */
  async iniciar(usuarioId) {
    try {
      logger.dev('🚀 Iniciando ScheduledContentService para usuario:', usuarioId);
      
      if (!usuarioId) {
        throw new Error('Usuario ID requerido');
      }
      
      // 🧹 CRÍTICO: Detener cualquier instancia anterior para evitar timers duplicados
      this.detener();
      
      // 🔧 CRÍTICO: Restaurar timestamps de ejecuciones desde localStorage
      // Esto evita que las programaciones diarias se ejecuten múltiples veces al día
      this.cargarTimestampsDesdeStorage(usuarioId);
      
      // 🧹 Limpiar bolsas de contenidos (puede regenerarse)
      this.bolsasContenidos.clear();
      this.primerCicloCompletado = false;
      
      this.currentUserId = usuarioId;
      this.isActive = true;
      
      // 1. Cargar programaciones del usuario
      await this.cargarProgramacionesUsuario();
      
      // 2. Iniciar timer de verificación
      this.iniciarTimer();
      
      // 3. Configurar sincronización en tiempo real
      this.configurarRealtime();
      
      // 4. 🔧 NUEVO: Iniciar polling como fallback
      this.iniciarPollingFallback();
      
      // 5. Configurar listeners para mantener servicio activo en segundo plano
      this.configurarPageVisibility();
      
      // 5. Limpiar timestamps antiguos (mantenimiento)
      this.limpiarTimestampsAntiguos();
      
      // 6. 🔧 NUEVO: Suscribirse al evento onEnd del audioPlayer para ejecutar programaciones en espera
      this.configurarListenerFinCancion();
      
      logger.dev('✅ ScheduledContentService iniciado exitosamente');
      logger.dev(`📊 ${this.programaciones.length} programaciones activas cargadas`);
      
      return true;
    } catch (error) {
      logger.error('❌ Error iniciando ScheduledContentService:', error);
      return false;
    }
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
    
    // Detener heartbeat de realtime
    if (this.realtimeHeartbeat) {
      clearInterval(this.realtimeHeartbeat);
      this.realtimeHeartbeat = null;
    }
    
    // 🔧 NUEVO: Detener timer de reconexión
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // 🔧 NUEVO: Detener polling fallback
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPollingActive = false;
    }
    
    // Limpiar realtime
    this.limpiarRealtime();
    
    // Limpiar listener de visibilidad
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    
    // 🔧 NUEVO: Desuscribirse del evento onEnd del audioPlayer
    if (this._onSongEndHandler && audioPlayer && typeof audioPlayer.off === 'function') {
      audioPlayer.off('onEnd', this._onSongEndHandler);
      this._onSongEndHandler = null;
      logger.dev('✅ Listener de fin de canción eliminado');
    }
    
    // 💾 CRÍTICO: Guardar timestamps antes de detener
    this.guardarTimestampsEnStorage();
    
    // Resetear estado (pero NO limpiar ultimasEjecuciones - se restauran al reiniciar)
    this.currentUserId = null;
    this.programaciones = [];
    // NO hacer: this.ultimasEjecuciones.clear(); - se persiste en localStorage
    this.bolsasContenidos.clear();
    this.isPlayingScheduledContent = false;
    this.currentProgramacion = null;
    this.primerCicloCompletado = false; // Resetear para próxima sesión
    this.realtimeStatus = 'DISCONNECTED';
    this.reconnectAttempts = 0;
    this.isReconnecting = false; // 🔧 NUEVO: Resetear flag de reconexión
    
    // 🔧 NUEVO: Limpiar cola de programaciones en espera
    this.programacionesEnEspera = [];
    this.esperandoFinCancion = false;
    
    logger.dev('✅ ScheduledContentService detenido (timestamps persistidos)');
  }

  /**
   * Cargar programaciones activas del usuario desde Supabase
   */
  async cargarProgramacionesUsuario() {
    try {
      logger.dev('📂 Cargando programaciones del usuario...', {
        usuarioId: this.currentUserId
      });
      
      // PASO 1: Obtener IDs de programaciones asignadas al usuario
      const { data: destinatarios, error: errorDestinatarios } = await supabase
        .from('programacion_destinatarios')
        .select('programacion_id')
        .eq('usuario_id', this.currentUserId)
        .eq('activo', true);
      
      logger.dev('🔍 DEBUG - Query programacion_destinatarios:', {
        usuarioId: this.currentUserId,
        error: errorDestinatarios,
        resultados: destinatarios?.length || 0,
        datos: destinatarios
      });
      
      if (errorDestinatarios) {
        logger.error('❌ Error en query programacion_destinatarios:', errorDestinatarios);
        throw errorDestinatarios;
      }
      
      if (!destinatarios || destinatarios.length === 0) {
        logger.warn('⚠️ Usuario no tiene programaciones asignadas');
        logger.dev('💡 Verifica en Supabase:');
        logger.dev(`   SELECT * FROM programacion_destinatarios WHERE usuario_id = '${this.currentUserId}' AND activo = true;`);
        this.programaciones = [];
        return [];
      }
      
      const programacionIds = destinatarios.map(d => d.programacion_id);
      logger.dev(`📋 ${programacionIds.length} programaciones asignadas al usuario`, programacionIds);
      
      // PASO 2: Obtener datos completos de las programaciones
      const fechaHoy = new Date().toISOString().split('T')[0];
      
      logger.dev('🔍 DEBUG - Query programaciones:', {
        programacionIds,
        fechaHoy,
        filtros: {
          estado: 'activo',
          fecha_inicio_lte: fechaHoy,
          fecha_fin_gte_o_null: fechaHoy
        }
      });
      
      const { data: programaciones, error: errorProgramaciones } = await supabase
        .from('programaciones')
        .select('*')
        .in('id', programacionIds)
        .eq('estado', 'activo')
        .lte('fecha_inicio', fechaHoy)
        .or(`fecha_fin.is.null,fecha_fin.gte.${fechaHoy}`);
      
      logger.dev('🔍 DEBUG - Resultado programaciones:', {
        error: errorProgramaciones,
        resultados: programaciones?.length || 0,
        datos: programaciones
      });
      
      // 🔧 DEBUG CRÍTICO: Verificar el estado de cada programación
      if (programaciones && programaciones.length > 0) {
        programaciones.forEach(p => {
          logger.dev(`  📋 Programación "${p.descripcion}": estado="${p.estado}" (esperado: "activo")`);
        });
      }
      
      if (errorProgramaciones) {
        logger.error('❌ Error en query programaciones:', errorProgramaciones);
        throw errorProgramaciones;
      }
      
      this.programaciones = programaciones || [];
      
      logger.dev('✅ Programaciones cargadas:', {
        total: this.programaciones.length,
        tipos: this.programaciones.reduce((acc, p) => {
          acc[p.tipo] = (acc[p.tipo] || 0) + 1;
          return acc;
        }, {}),
        modos_audio: this.programaciones.reduce((acc, p) => {
          acc[p.modo_audio] = (acc[p.modo_audio] || 0) + 1;
          return acc;
        }, {})
      });
      
      return this.programaciones;
      
    } catch (error) {
      logger.error('❌ Error cargando programaciones:', error);
      this.programaciones = [];
      return [];
    }
  }

  /**
   * Iniciar timer de verificación periódica
   */
  iniciarTimer() {
    // 🔧 CRÍTICO: Limpiar timer anterior si existe
    if (this.checkInterval) {
      logger.dev('🧹 Limpiando timer anterior para evitar duplicados');
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // 🔧 Verificar que no haya otro timer activo (seguridad extra)
    if (this.checkInterval !== null) {
      logger.warn('⚠️ ADVERTENCIA: Timer ya activo, no creando duplicado');
      return;
    }
    
    logger.dev(`⏰ Iniciando timer de verificación cada ${this.checkIntervalDuration / 1000}s`);
    
    // Ejecutar inmediatamente la primera vez
    this.verificarProgramaciones();
    
    // Y luego cada 10 segundos
    this.checkInterval = setInterval(() => {
      if (this.isActive) {
        this.verificarProgramaciones();
      }
    }, this.checkIntervalDuration);
    
    logger.dev(`✅ Timer iniciado con ID: ${this.checkInterval}`);
  }

  /**
   * Verificar si alguna programación debe ejecutarse AHORA
   */
  async verificarProgramaciones() {
    try {
      // 🔧 Saltar la primera verificación para que siempre empiece con música
      if (!this.primerCicloCompletado) {
        logger.dev('⏭️ Primer ciclo - saltando verificación para empezar con música');
        this.primerCicloCompletado = true;
        return;
      }
      
      // 🔧 CRÍTICO: El botón play/pause controla TODO el sistema (música + programaciones)
      // Si el usuario ha pausado, NO reproducir nada
      const audioState = audioPlayer.getState();
      
      // Primero verificar si el usuario ha interactuado alguna vez
      if (!this.userHasInteracted) {
        if (audioState.isPlaying || audioState.isPaused) {
          this.userHasInteracted = true;
          logger.dev('✅ Usuario ha interactuado - habilitando contenidos programados');
        } else {
          logger.dev('⏸️ Esperando interacción del usuario (play) para habilitar contenidos programados');
          return;
        }
      }
      
      // Ahora verificar el estado actual: solo reproducir si está en play
      if (!audioState.isPlaying) {
        logger.dev('⏸️ Reproductor en pausa - no ejecutar contenidos programados');
        return;
      }
      
      // No verificar si ya hay contenido programado reproduciéndose
      if (this.isPlayingScheduledContent) {
        logger.dev('⏸️ Verificación pausada - contenido programado en reproducción');
        return;
      }
      
      const ahora = new Date();
      const horaActual = ahora.toTimeString().slice(0, 5); // "HH:mm"
      
      logger.dev(`🔍 Verificando programaciones - ${horaActual}`);
      
      // Buscar programaciones que deben ejecutarse
      const programacionesParaEjecutar = [];
      
      for (const prog of this.programaciones) {
        logger.dev(`📋 Evaluando: "${prog.descripcion}" (${prog.tipo})`);
        
        // 🔧 CRÍTICO: Verificar que el estado sea 'activo'
        // Aunque se filtra al cargar, puede haber cambiado entre carga y verificación
        if (prog.estado !== 'activo') {
          logger.dev(`  ⏸️ Programación pausada (estado: ${prog.estado}) - saltando`);
          continue;
        }
        
        // ¿Debe ejecutarse según su periodicidad?
        const debeEjecutarse = this.debeEjecutarse(prog);
        logger.dev(`  ⏰ debeEjecutarse: ${debeEjecutarse}`);
        
        if (!debeEjecutarse) {
          continue;
        }
        
        // ¿Debe sonar ahora según su frecuencia?
        const debeSonar = this.debeSonarAhora(prog);
        logger.dev(`  🔔 debeSonarAhora: ${debeSonar}`);
        
        if (debeSonar) {
          programacionesParaEjecutar.push(prog);
        }
      }
      
      if (programacionesParaEjecutar.length === 0) {
        // logger.dev('✅ No hay programaciones pendientes');
        return;
      }
      
      logger.dev(`🎯 ${programacionesParaEjecutar.length} programación(es) lista(s) para ejecutar`);
      
      // 🔧 NUEVO: Separar programaciones según si deben esperar fin de canción o no
      const programacionesInmediatas = [];
      const programacionesConEspera = [];
      
      for (const programacion of programacionesParaEjecutar) {
        // Verificar si tiene frecuencia X (frecuencia_minutos > 0)
        const tieneFrecuenciaX = programacion.frecuencia_minutos && programacion.frecuencia_minutos > 0;
        
        // Verificar si debe esperar fin de canción
        const debeEsperarFinCancion = programacion.esperar_fin_cancion === true;
        
        if (tieneFrecuenciaX && debeEsperarFinCancion) {
          logger.dev(`⏳ Programación "${programacion.descripcion}" debe esperar a fin de canción`);
          programacionesConEspera.push(programacion);
        } else {
          programacionesInmediatas.push(programacion);
        }
      }
      
      // Ejecutar programaciones inmediatas (comportamiento actual)
      for (const programacion of programacionesInmediatas) {
        logger.dev(`🎬 Ejecutando programación inmediata: "${programacion.descripcion}"`);
        await this.ejecutarProgramacion(programacion);
      }
      
      // Agregar programaciones con espera a la cola (si no están ya en ella)
      for (const programacion of programacionesConEspera) {
        // Evitar duplicados en la cola
        const yaEnCola = this.programacionesEnEspera.some(p => p.id === programacion.id);
        if (!yaEnCola) {
          logger.dev(`📋 Agregando a cola de espera: "${programacion.descripcion}"`);
          this.programacionesEnEspera.push(programacion);
          this.esperandoFinCancion = true;
          
          // 🔧 CRÍTICO: Bloquear AutoDJ INMEDIATAMENTE cuando se agrega a la cola
          // No esperar al evento onEnd, porque sería demasiado tarde (race condition)
          this._bloquearAutoDJ(false);
        } else {
          logger.dev(`⏭️ Programación "${programacion.descripcion}" ya está en cola de espera`);
        }
      }
      
      if (this.programacionesEnEspera.length > 0) {
        logger.dev(`⏳ ${this.programacionesEnEspera.length} programación(es) esperando fin de canción actual`);
      }
      
    } catch (error) {
      logger.error('❌ Error verificando programaciones:', error);
    }
  }

  /**
   * Evaluar si una programación debe ejecutarse según su periodicidad
   * (tipo: una_vez, diaria, semanal, anual)
   */
  debeEjecutarse(prog) {
    const ahora = new Date();
    const horaActual = ahora.toTimeString().slice(0, 5); // "HH:mm"
    const diaSemana = ['sun','mon','tue','wed','thu','fri','sat'][ahora.getDay()];
    const fechaActual = ahora.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const mesdia = fechaActual.slice(5); // "MM-DD"

    logger.dev(`     🕒 Hora actual: ${horaActual}, Fecha: ${fechaActual}, Día: ${diaSemana}`);

    // Verificar rango de fechas
    if (prog.fecha_inicio && fechaActual < prog.fecha_inicio) {
      logger.dev(`     ❌ Fuera de rango: fechaActual (${fechaActual}) < fecha_inicio (${prog.fecha_inicio})`);
      return false;
    }
    if (prog.fecha_fin && fechaActual > prog.fecha_fin) {
      logger.dev(`     ❌ Fuera de rango: fechaActual (${fechaActual}) > fecha_fin (${prog.fecha_fin})`);
      return false;
    }

    logger.dev(`     ✅ Dentro del rango de fechas`);
    logger.dev(`     📝 Tipo: ${prog.tipo}, daily_mode: ${prog.daily_mode}`);

    switch (prog.tipo) {
      case 'una_vez': {
        // 🎯 CRÍTICO: Programación UNA VEZ - Se ejecuta EXACTAMENTE en fecha_inicio + hora_inicio
        // Solo una vez y nunca más (verificado en debeSonarAhora)
        logger.dev(`     🎯 UNA VEZ - Fecha prog: ${prog.fecha_inicio}, Actual: ${fechaActual}`);
        
        // Verificar que sea exactamente la fecha de inicio
        if (fechaActual !== prog.fecha_inicio) {
          logger.dev(`     ❌ No es la fecha programada (debe ser ${prog.fecha_inicio})`);
          return false;
        }
        
        // Verificar hora exacta usando hora_inicio
        if (!prog.hora_inicio) {
          logger.dev(`     ❌ No tiene hora_inicio configurada`);
          return false;
        }
        
        const horaInicioMinutos = this.tiempoAMinutos(prog.hora_inicio);
        const horaActualMinutos = this.tiempoAMinutos(horaActual);
        const esHoraValida = horaActualMinutos === horaInicioMinutos; // Hora exacta
        
        logger.dev(`     ⏰ Hora inicio: ${prog.hora_inicio} (${horaInicioMinutos}m), Actual: ${horaActual} (${horaActualMinutos}m), Válida: ${esHoraValida}`);
        
        return esHoraValida;
      }

      case 'diaria':
        logger.dev(`     📅 DIARIA - daily_mode: ${prog.daily_mode}`);
        
        if (prog.daily_mode === 'una_vez_dia') {
          // Ejecutar a esa hora exacta
          const horaProgMinutos = this.tiempoAMinutos(prog.hora_una_vez_dia);
          const horaActualMinutos = this.tiempoAMinutos(horaActual);
          const esHoraValida = horaActualMinutos === horaProgMinutos; // Hora exacta
          logger.dev(`     ⏰ Una vez al día - Hora prog: ${prog.hora_una_vez_dia} (${horaProgMinutos}m), Actual: ${horaActual} (${horaActualMinutos}m), Válida: ${esHoraValida}`);
          
          // La verificación de si ya se ejecutó hoy se hace en debeSonarAhora()
          return esHoraValida;
        }
        
        if (prog.daily_mode === 'cada') {
          // Cada N días
          const diasDesdeInicio = Math.floor(
            (ahora.getTime() - new Date(prog.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24)
          );
          logger.dev(`     📆 Cada ${prog.cada_dias} días - Días desde inicio: ${diasDesdeInicio}, Cumple: ${diasDesdeInicio % prog.cada_dias === 0}`);
          if (diasDesdeInicio % prog.cada_dias !== 0) {
            return false;
          }
        }
        
        if (prog.daily_mode === 'laborales') {
          // Solo lunes a viernes
          const esLaboral = !['sat','sun'].includes(diaSemana);
          logger.dev(`     💼 Solo laborables - Día: ${diaSemana}, Es laboral: ${esLaboral}`);
          if (!esLaboral) {
            return false;
          }
        }
        
        // Verificar rango horario
        logger.dev(`     🕐 Rango horario: ${prog.rango_desde} - ${prog.rango_hasta}, Hora actual: ${horaActual}`);
        
        // Si rango_desde y rango_hasta son iguales (ej: 00:00:00 - 00:00:00), significa "todo el día"
        if (prog.rango_desde === prog.rango_hasta) {
          logger.dev(`     ✅ Rango especial (todo el día) - siempre dentro del rango`);
          return true;
        }
        
        const dentroRangoDiario = horaActual >= prog.rango_desde && horaActual <= prog.rango_hasta;
        logger.dev(`     ${dentroRangoDiario ? '✅' : '❌'} Dentro del rango: ${dentroRangoDiario}`);
        return dentroRangoDiario;

      case 'semanal':
        logger.dev(`     📅 SEMANAL - weekly_mode: ${prog.weekly_mode}`);
        
        // ✅ FIX: Crear un mapa de conversión de días (soportar múltiples formatos)
        const diaHoyFormatos = {
          'sun': ['sun', 'dom', 'domingo'],
          'mon': ['mon', 'lun', 'lunes'],
          'tue': ['tue', 'mar', 'martes'],
          'wed': ['wed', 'mie', 'miercoles', 'miércoles'],
          'thu': ['thu', 'jue', 'jueves'],
          'fri': ['fri', 'vie', 'viernes'],
          'sat': ['sat', 'sab', 'sabado', 'sábado']
        };
        
        const formatosDiaHoy = diaHoyFormatos[diaSemana] || [diaSemana];
        
        // Verificar si alguno de los formatos del día actual está en weekly_days
        const estaDiaEnPrograma = prog.weekly_days?.some(dia => 
          formatosDiaHoy.includes(dia?.toLowerCase())
        );
        
        if (!estaDiaEnPrograma) {
          logger.dev(`     ❌ Hoy (${diaSemana}) no está en días programados: ${prog.weekly_days?.join(', ')}`);
          return false;
        }
        logger.dev(`     ✅ Hoy (${diaSemana}) SÍ está en días programados`);
        
        if (prog.weekly_mode === 'una_vez_dia') {
          // Ejecutar a esa hora exacta
          const horaProgMinutos = this.tiempoAMinutos(prog.weekly_hora_una_vez);
          const horaActualMinutos = this.tiempoAMinutos(horaActual);
          const esHoraValida = horaActualMinutos === horaProgMinutos; // Hora exacta
          logger.dev(`     ⏰ Una vez en el día - Hora prog: ${prog.weekly_hora_una_vez} (${horaProgMinutos}m), Actual: ${horaActual} (${horaActualMinutos}m), Válida: ${esHoraValida}`);
          
          // La verificación de si ya se ejecutó esta semana se hace en debeSonarAhora()
          return esHoraValida;
        }
        
        // Si rango_desde y rango_hasta son iguales, significa "todo el día"
        if (prog.weekly_rango_desde === prog.weekly_rango_hasta) {
          logger.dev(`     ✅ Rango especial (todo el día) - siempre dentro del rango`);
          return true;
        }
        
        logger.dev(`     🕐 Rango horario: ${prog.weekly_rango_desde} - ${prog.weekly_rango_hasta}, Hora actual: ${horaActual}`);
        const dentroRangoSemanal = horaActual >= prog.weekly_rango_desde && horaActual <= prog.weekly_rango_hasta;
        logger.dev(`     ${dentroRangoSemanal ? '✅' : '❌'} Dentro del rango: ${dentroRangoSemanal}`);
        return dentroRangoSemanal;

      case 'anual':
        // Solo si es ese día del año
        if (mesdia !== prog.annual_date) {
          return false;
        }
        const horaProgMinutos = this.tiempoAMinutos(prog.annual_time);
        const horaActualMinutos = this.tiempoAMinutos(horaActual);
        return Math.abs(horaActualMinutos - horaProgMinutos) <= 2;

      default:
        return false;
    }
  }

  /**
   * Evaluar si debe sonar AHORA según frecuencia_minutos
   */
  debeSonarAhora(prog) {
    // 🔧 CRÍTICO: Si es modo "una_vez_dia" (diaria o semanal), siempre usar hora específica
    // Ignorar frecuencia_minutos para estos modos
    const esModoUnaVezDia = 
      (prog.tipo === 'diaria' && prog.daily_mode === 'una_vez_dia') ||
      (prog.tipo === 'semanal' && prog.weekly_mode === 'una_vez_dia');
    
    // 🔧 CRÍTICO: Si NO tiene frecuencia (NULL o 0) O es modo una_vez_dia, significa que es programación de hora específica
    if (!prog.frecuencia_minutos || prog.frecuencia_minutos === 0 || esModoUnaVezDia) {
      if (esModoUnaVezDia) {
        logger.dev(`     ✅ Modo una_vez_dia - ignorando frecuencia_minutos, usando hora específica`);
      } else {
        logger.dev(`     ✅ Sin frecuencia - programación de hora específica`);
      }
      
      const ultimaEjecucion = this.ultimasEjecuciones.get(prog.id);
      
      // ✅ FIX: Verificar si hay un intento fallido reciente o pausado
      const intentoFallido = this.intentosFallidos.get(prog.id);
      if (intentoFallido) {
        const ahora = Date.now();
        
        // Si está pausado hasta una fecha futura, no ejecutar
        if (intentoFallido.pausadoHasta && ahora < intentoFallido.pausadoHasta) {
          const minutosRestantes = Math.ceil((intentoFallido.pausadoHasta - ahora) / (1000 * 60));
          logger.dev(`     🚫 Programación pausada por múltiples fallos - ${minutosRestantes} min restantes`);
          return false;
        }
        
        // Si el pausado expiró, limpiar y permitir reintento
        if (intentoFallido.pausadoHasta && ahora >= intentoFallido.pausadoHasta) {
          this.intentosFallidos.delete(prog.id);
          logger.dev(`     🔄 Pausa expirada - permitiendo reintento`);
        } else {
          // Verificar si el intento fallido fue reciente (últimos 2 minutos)
          const tiempoDesdeIntento = ahora - intentoFallido.timestamp;
          const minutosDesdeIntento = Math.floor(tiempoDesdeIntento / (1000 * 60));
          
          // Si se intentó hace menos de 2 minutos, evitar re-ejecución
          if (minutosDesdeIntento < 2) {
            logger.dev(`     🚫 Intento fallido reciente (hace ${Math.floor(tiempoDesdeIntento / 1000)}s, ${intentoFallido.count} intentos) - evitando bucle infinito`);
            return false;
          }
          
          // Si pasaron más de 2 minutos, limpiar el intento fallido para permitir reintento
          if (minutosDesdeIntento >= 2) {
            this.intentosFallidos.delete(prog.id);
            logger.dev(`     🔄 Limpiando intento fallido antiguo (${minutosDesdeIntento} min) - permitiendo reintento`);
          }
        }
      }
      
      // Si nunca se ejecutó, puede sonar
      if (!ultimaEjecucion) {
        logger.dev(`     ✅ Primera ejecución - puede sonar`);
        return true;
      }
      
      const ahora = new Date();
      const ultEjec = new Date(ultimaEjecucion);
      
      // Para DIARIAS: verificar si ya se ejecutó HOY con la MISMA HORA
      if (prog.tipo === 'diaria') {
        const hoyStr = ahora.toISOString().split('T')[0];
        const ultEjecStr = ultEjec.toISOString().split('T')[0];
        
        // 🔧 Obtener la hora programada actual y la hora que estaba cuando se ejecutó
        const horaProgramadaActual = prog.hora_una_vez_dia || prog.daily_mode;
        const infoUltEjec = this.ultimasEjecuciones.get(prog.id + '_info');
        const horaProgramadaAnterior = infoUltEjec?.horaProgramada;
        
        // Si cambió la hora programada, permitir nueva ejecución
        if (horaProgramadaAnterior && horaProgramadaActual !== horaProgramadaAnterior) {
          logger.dev(`     🔄 DIARIA - Hora cambió de ${horaProgramadaAnterior} a ${horaProgramadaActual} - permitiendo nueva ejecución`);
          return true;
        }
        
        if (hoyStr === ultEjecStr) {
          // 🔧 CRÍTICO: También verificar que no se ejecutó en el MISMO MINUTO
          const minutosDesdeUltima = Math.floor((ahora.getTime() - ultEjec.getTime()) / (1000 * 60));
          if (minutosDesdeUltima < 1) {
            logger.dev(`     🚫 DIARIA - Ya se ejecutó hace ${Math.floor((ahora.getTime() - ultEjec.getTime()) / 1000)}s - evitando re-ejecución`);
            return false;
          }
          logger.dev(`     ⏭️ DIARIA - Ya se ejecutó hoy con esta misma hora - esperando hasta mañana`);
          return false;
        }
        
        logger.dev(`     ✅ DIARIA - No se ha ejecutado hoy - puede sonar`);
        return true;
      }
      
      // Para SEMANALES: verificar si ya se ejecutó ESTA SEMANA en ESTE DÍA con la MISMA HORA
      if (prog.tipo === 'semanal') {
        const diaSemanaActual = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][ahora.getDay()];
        const diaSemanaUltEjec = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][ultEjec.getDay()];
        
        // 🔧 Obtener la hora programada actual y la hora que estaba cuando se ejecutó
        const horaProgramadaActual = prog.weekly_hora_una_vez || prog.weekly_mode;
        const infoUltEjec = this.ultimasEjecuciones.get(prog.id + '_info');
        const horaProgramadaAnterior = infoUltEjec?.horaProgramada;
        
        // Si cambió la hora programada, permitir nueva ejecución
        if (horaProgramadaAnterior && horaProgramadaActual !== horaProgramadaAnterior) {
          logger.dev(`     🔄 SEMANAL - Hora cambió de ${horaProgramadaAnterior} a ${horaProgramadaActual} - permitiendo nueva ejecución`);
          return true;
        }
        
        // Calcular número de semana del año
        const getWeekNumber = (date) => {
          const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
          const dayNum = d.getUTCDay() || 7;
          d.setUTCDate(d.getUTCDate() + 4 - dayNum);
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        };
        
        const semanaActual = getWeekNumber(ahora);
        const semanaUltEjec = getWeekNumber(ultEjec);
        const añoActual = ahora.getFullYear();
        const añoUltEjec = ultEjec.getFullYear();
        
        // Si es el mismo día de la semana, mismo número de semana y mismo año → ya se ejecutó
        if (diaSemanaActual === diaSemanaUltEjec && semanaActual === semanaUltEjec && añoActual === añoUltEjec) {
          // 🔧 CRÍTICO: También verificar que no se ejecutó en el MISMO MINUTO
          const minutosDesdeUltima = Math.floor((ahora.getTime() - ultEjec.getTime()) / (1000 * 60));
          if (minutosDesdeUltima < 1) {
            logger.dev(`     🚫 SEMANAL - Ya se ejecutó hace ${Math.floor((ahora.getTime() - ultEjec.getTime()) / 1000)}s - evitando re-ejecución`);
            return false;
          }
          logger.dev(`     ⏭️ SEMANAL - Ya se ejecutó esta semana en este día con esta misma hora - esperando hasta la próxima`);
          return false;
        }
        
        logger.dev(`     ✅ SEMANAL - No se ha ejecutado esta semana en este día - puede sonar`);
        return true;
      }
      
      // Para tipo UNA_VEZ: NUNCA se debe repetir después de ejecutarse una vez
      if (prog.tipo === 'una_vez') {
        logger.dev(`     🚫 UNA VEZ - Ya se ejecutó anteriormente - NUNCA se repetirá`);
        return false;
      }
      
      // Para tipo ANUAL: verificar que no sea en el mismo minuto
      const segundosDesdeUltima = Math.floor((Date.now() - ultimaEjecucion) / 1000);
      if (segundosDesdeUltima < 60) {
        logger.dev(`     ⏸️ Ya se ejecutó hace ${segundosDesdeUltima}s - esperando al siguiente minuto`);
        return false;
      }
      
      return true;
    }
    
    logger.dev(`     🎯 Evaluando frecuencia: ${prog.frecuencia_minutos} min (slots fijos)`);
    
    // 🔧 SISTEMA DE SLOTS FIJOS (estilo streaming)
    const ahora = new Date();
    const minutoActual = ahora.getMinutes();
    const horaActual = ahora.getHours();
    
    // 🐛 FIX: Calcular minutos totales desde medianoche (no solo minuto de la hora)
    // Esto evita que frecuencias como 45min suenen cada 15min (:00 y :45 de cada hora)
    const minutosDelDia = (horaActual * 60) + minutoActual;
    
    // ¿Estamos en un slot válido? (basado en minutos del día, no de la hora)
    const esSlotValido = (minutosDelDia % prog.frecuencia_minutos) === 0;
    if (!esSlotValido) {
      // 🐛 FIX: Calcular próximo slot basado en minutos del día
      const minutosHastaProximoSlot = prog.frecuencia_minutos - (minutosDelDia % prog.frecuencia_minutos);
      const proximosMinutosDelDia = minutosDelDia + minutosHastaProximoSlot;
      const proximaHora = Math.floor(proximosMinutosDelDia / 60) % 24;
      const proximoMinuto = proximosMinutosDelDia % 60;
      logger.dev(`     ⏳ Fuera de slot. Próximo slot: ${String(proximaHora).padStart(2,'0')}:${String(proximoMinuto).padStart(2,'0')} (en ${minutosHastaProximoSlot} min)`);
      return false;
    }
    
    logger.dev(`     ✅ Slot válido detectado: ${String(horaActual).padStart(2,'0')}:${String(minutoActual).padStart(2,'0')} (minuto ${minutosDelDia} del día)`);
    
    // Evitar dobles ejecuciones en el MISMO minuto
    const ultimaEjecucion = this.ultimasEjecuciones.get(prog.id);
    if (ultimaEjecucion) {
      const f = new Date(ultimaEjecucion);
      const mismoMinuto = f.getMinutes() === minutoActual && f.getHours() === horaActual &&
                         f.getDate() === ahora.getDate() && f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      if (mismoMinuto) {
        logger.dev(`     🚫 Ya ejecutada en este slot (${f.toTimeString().slice(0,8)})`);
        return false;
      }
      logger.dev(`     ⏱️ Última ejecución: ${f.toTimeString().slice(0,8)}`);
    }
    
    logger.dev(`     ✅ Listo para ejecutar en slot ${String(horaActual).padStart(2,'0')}:${String(minutoActual).padStart(2,'0')}`);
    return true;
  }

  /**
   * Ejecutar una programación (reproduce UN contenido aleatorio por ejecución)
   */
  async ejecutarProgramacion(prog, songEndedBefore = false) {
    try {
      this.isPlayingScheduledContent = true;
      this.currentProgramacion = prog;
      
      // 1. Obtener contenidos ordenados
      const contenidos = await this.obtenerContenidos(prog.id);
      
      if (!contenidos || contenidos.length === 0) {
        logger.warn('⚠️ Programación sin contenidos:', prog.descripcion);
        this.isPlayingScheduledContent = false;
        this.currentProgramacion = null;
        return;
      }
      
      logger.dev(`📦 ${contenidos.length} contenido(s) disponibles en la programación`);
      
      // 2. Seleccionar UN contenido aleatorio usando sistema de bolsa
      const contenidoAReproducir = this.seleccionarContenidoAleatorio(prog.id, contenidos);
      
      if (!contenidoAReproducir) {
        logger.warn('⚠️ No se pudo seleccionar contenido');
        this.isPlayingScheduledContent = false;
        this.currentProgramacion = null;
        return;
      }
      
      logger.dev(`🎯 Contenido seleccionado: ${contenidoAReproducir.titulo || contenidoAReproducir.descripcion || 'Sin título'}`);
      
      // 🔒 NUEVO: Bloquear controles durante reproducción programada (igual que manual)
      const contentName = contenidoAReproducir.titulo || contenidoAReproducir.descripcion || contenidoAReproducir.nombre || 'Contenido programado';
      const duration = contenidoAReproducir.duracion_segundos || 30;
      const contentId = contenidoAReproducir.id || contenidoAReproducir.contenido_id;
      
      if (typeof window.__startContentPlayback === 'function') {
        window.__startContentPlayback(contentId, contentName, duration);
        logger.dev('🔒 Controles bloqueados para contenido programado:', { contentName, duration });
      }
      
      // 3. Reproducir EL contenido seleccionado según modo de audio
      const reproduccionExitosa = await audioPlayer.reproducirProgramacion([contenidoAReproducir], prog.modo_audio, songEndedBefore);
      
      // 🔧 CRÍTICO: Solo registrar ejecución si la reproducción fue exitosa
      if (!reproduccionExitosa) {
        logger.error('❌ La reproducción falló - NO se guardará el timestamp para permitir reintentos');
        
        // ✅ FIX: Guardar timestamp de intento fallido para evitar bucles infinitos
        const intentoAnterior = this.intentosFallidos.get(prog.id);
        const count = intentoAnterior ? intentoAnterior.count + 1 : 1;
        this.intentosFallidos.set(prog.id, {
          timestamp: Date.now(),
          count: count
        });
        
        // Si hay demasiados intentos fallidos seguidos, marcar como problema
        if (count >= 5) {
          logger.error(`❌ Demasiados intentos fallidos (${count}) para programación "${prog.descripcion}" - pausando intentos por 10 minutos`);
          // Guardar timestamp que expira en 10 minutos
          this.intentosFallidos.set(prog.id, {
            timestamp: Date.now(),
            count: count,
            pausadoHasta: Date.now() + (10 * 60 * 1000) // 10 minutos
          });
        }
        
        // 🔓 Desbloquear controles si la reproducción falló
        if (typeof window.__clearManualPlayback === 'function') {
          window.__clearManualPlayback();
          logger.dev('🔓 Controles desbloqueados tras fallo de reproducción programada');
        }
        
        this.isPlayingScheduledContent = false;
        this.currentProgramacion = null;
        return;
      }
      
      // ✅ FIX: Si la reproducción fue exitosa, limpiar intentos fallidos
      this.intentosFallidos.delete(prog.id);
      
      // 🔧 CRÍTICO: Registrar timestamp INMEDIATAMENTE para evitar dobles ejecuciones en recargas
      // Esto previene que la programación se ejecute múltiples veces si la app se recarga
      const timestampEjecucion = Date.now();
      this.ultimasEjecuciones.set(prog.id, timestampEjecucion);
      
      // 🔧 Guardar hora programada para detectar cambios futuros
      // CRÍTICO: Obtener la hora correcta según el tipo y modo de la programación
      let horaProgramada;
      if (prog.tipo === 'diaria' && prog.daily_mode === 'una_vez_dia') {
        horaProgramada = prog.hora_una_vez_dia;
      } else if (prog.tipo === 'semanal' && prog.weekly_mode === 'una_vez_dia') {
        horaProgramada = prog.weekly_hora_una_vez;
      } else if (prog.tipo === 'una_vez') {
        horaProgramada = prog.hora_inicio;
      } else if (prog.tipo === 'anual') {
        horaProgramada = prog.annual_time;
      } else {
        // Para programaciones con rango horario, usar el rango como referencia
        horaProgramada = prog.rango_desde || prog.weekly_rango_desde || prog.daily_mode || prog.weekly_mode;
      }
      
      this.ultimasEjecuciones.set(prog.id + '_info', {
        horaProgramada,
        timestamp: timestampEjecucion
      });
      
      // 💾 CRÍTICO: Guardar timestamps INMEDIATAMENTE en localStorage
      // Esto previene que si la app se recarga durante la reproducción, no se ejecute de nuevo
      this.guardarTimestampsEnStorage();
      logger.dev('💾 Timestamp guardado ANTES de reproducción para prevenir dobles ejecuciones');
      
      // 5. Logging opcional a base de datos - DESACTIVADO (usa playback_history)
      // await this.registrarEjecucion(prog, [contenidoAReproducir]);
      
      // 📊 Enviar evento de inicio de contenido programado
      try {
        const { default: optimizedPresenceService } = await import('./optimizedPresenceService.js');
        await optimizedPresenceService.sendScheduledContentStarted({
          title: contenidoAReproducir.nombre || contenidoAReproducir.titulo || contenidoAReproducir.descripcion || 'Sin título',
          type: contenidoAReproducir.tipo_contenido || 'contenido',
          programacionId: prog.id,
          channelId: window.currentPlayerChannelId,
          channelName: window.currentPlayerChannelName || 'Canal Desconocido',
          duration: contenidoAReproducir.duracion || null,
          modoAudio: prog.modo_audio,
          descripcionProg: prog.descripcion
        });
        logger.dev(`📊 Evento de inicio de contenido programado enviado: ${contenidoAReproducir.nombre} (${contenidoAReproducir.tipo_contenido})`);
        
        // 📊 Programar evento de finalización (si tiene duración)
        if (contenidoAReproducir.duracion) {
          setTimeout(async () => {
            try {
              await optimizedPresenceService.sendScheduledContentEnded({
                title: contenidoAReproducir.nombre || contenidoAReproducir.titulo || contenidoAReproducir.descripcion || 'Sin título',
                type: contenidoAReproducir.tipo_contenido || 'contenido',
                programacionId: prog.id,
                channelId: window.currentPlayerChannelId,
                channelName: window.currentPlayerChannelName || 'Canal Desconocido'
              });
              logger.dev(`📊 Evento de fin de contenido programado enviado: ${contenidoAReproducir.nombre}`);
            } catch (error) {
              logger.warn('⚠️ No se pudo enviar evento de fin de contenido:', error.message);
            }
          }, contenidoAReproducir.duracion * 1000);
        }
      } catch (error) {
        logger.warn('⚠️ No se pudo enviar evento de contenido programado:', error.message);
      }
      
      logger.dev('✅ Programación completada:', prog.descripcion);
      
    } catch (error) {
      logger.error('❌ Error ejecutando programación:', error);
    } finally {
      this.isPlayingScheduledContent = false;
      this.currentProgramacion = null;
    }
  }

  /**
   * Obtener contenidos de una programación (ordenados)
   */
  async obtenerContenidos(programacionId) {
    try {
      logger.dev(`📦 Obteniendo contenidos para programación: ${programacionId}`);
      
      const { data: contenidosIds, error: errorIds } = await supabase
        .from('programacion_contenidos')
        .select('contenido_id, orden')
        .eq('programacion_id', programacionId)
        .eq('activo', true)
        .order('orden', { ascending: true });
      
      logger.dev(`   📋 IDs de contenidos:`, contenidosIds);
      
      if (errorIds || !contenidosIds || contenidosIds.length === 0) {
        logger.dev(`   ⚠️ No se encontraron contenidos`);
        return [];
      }
      
      const ids = contenidosIds.map(c => c.contenido_id);
      logger.dev(`   🔍 Buscando ${ids.length} contenidos en tabla 'contenidos'`);
      
      const { data: contenidos, error: errorContenidos } = await supabase
        .from('contenidos')
        .select('*')
        .in('id', ids);
      
      logger.dev(`   📦 Contenidos obtenidos:`, contenidos);
      
      if (errorContenidos) {
        logger.error(`   ❌ Error:`, errorContenidos);
      }
      
      if (errorContenidos || !contenidos) {
        return [];
      }
      
      // Ordenar según el orden de programacion_contenidos
      const contenidosOrdenados = contenidosIds
        .map(pc => {
          const contenido = contenidos.find(c => c.id === pc.contenido_id);
          if (contenido) {
            logger.dev(`   ✅ Contenido ID ${pc.contenido_id}: url_s3 = ${contenido.url_s3 ? 'SÍ' : 'NO'}`);
          }
          return contenido;
        })
        .filter(Boolean);
      
      logger.dev(`   ✅ ${contenidosOrdenados.length} contenidos ordenados con URL`);
      return contenidosOrdenados;
      
    } catch (error) {
      logger.error('❌ Error obteniendo contenidos:', error);
      return [];
    }
  }

  /**
   * Seleccionar UN contenido aleatorio usando sistema de bolsa
   * (similar al AutoDJ musical - no repetir hasta completar todos)
   */
  seleccionarContenidoAleatorio(programacionId, contenidos) {
    if (!contenidos || contenidos.length === 0) {
      return null;
    }

    // Si solo hay un contenido, devolverlo
    if (contenidos.length === 1) {
      return contenidos[0];
    }

    // Obtener o inicializar bolsa para esta programación
    if (!this.bolsasContenidos.has(programacionId)) {
      this.bolsasContenidos.set(programacionId, {
        contenidos: [...contenidos],
        yaReproducidos: []
      });
      logger.dev(`🎰 Bolsa inicializada para programación ${programacionId}: ${contenidos.length} contenidos`);
    }

    const bolsa = this.bolsasContenidos.get(programacionId);

    // Si la bolsa está vacía (todos reproducidos), reiniciarla
    if (bolsa.contenidos.length === 0) {
      bolsa.contenidos = [...bolsa.yaReproducidos];
      bolsa.yaReproducidos = [];
      logger.dev(`🔄 Bolsa reiniciada - todos los contenidos disponibles nuevamente`);
    }

    // Seleccionar uno aleatorio de los disponibles
    const indiceAleatorio = Math.floor(Math.random() * bolsa.contenidos.length);
    const contenidoSeleccionado = bolsa.contenidos.splice(indiceAleatorio, 1)[0];
    bolsa.yaReproducidos.push(contenidoSeleccionado);

    logger.dev(`🎰 Contenido seleccionado de bolsa: ${bolsa.yaReproducidos.length}/${bolsa.contenidos.length + bolsa.yaReproducidos.length}`);

    return contenidoSeleccionado;
  }

  /**
   * Registrar ejecución en programacion_logs (opcional)
   */
  async registrarEjecucion(prog, contenidos) {
    try {
      // Insertar log por cada contenido reproducido
      const logs = contenidos.map(contenido => ({
        programacion_id: prog.id,
        usuario_id: this.currentUserId,
        contenido_id: contenido.id,
        // Supabase automáticamente agregará created_at
        metadata: {
          modo_audio: prog.modo_audio,
          duracion_segundos: contenido.duracion || null,
          descripcion_prog: prog.descripcion,
          titulo_contenido: contenido.titulo || contenido.descripcion || 'Sin título'
        }
      }));
      
      const { error } = await supabase
        .from('programacion_logs')
        .insert(logs);
      
      if (error) {
        logger.warn('⚠️ Error registrando logs:', error.message);
      } else {
        logger.dev('✅ Logs registrados en base de datos');
      }
      
    } catch (error) {
      logger.warn('⚠️ Error registrando ejecución:', error);
      // No lanzar error, es opcional
    }
  }

  /**
   * Configurar sincronización en tiempo real con Supabase
   */
  configurarRealtime() {
    try {
      logger.dev('🔄 Configurando sincronización en tiempo real...'); // 🔧 Activado para debug

      // No configurar si el servicio no está activo o no hay usuario
      if (!this.isActive || !this.currentUserId) {
        logger.warn('⚠️ No se puede configurar realtime: servicio inactivo o sin usuario');
        return;
      }

      // Evitar configuraciones concurrentes
      if (this.isReconnecting) {
        logger.dev('⏳ Reconexion ya en curso - evitando duplicado');
        return;
      }
      
      // Si ya está suscrito correctamente, no rehacer
      if (this.realtimeChannel && this.realtimeStatus === 'SUBSCRIBED') {
        logger.dev('✅ Realtime ya suscrito - sin cambios');
        return;
      }

      // Limpiar canal anterior si existe (marcando cierre intencional)
      if (this.realtimeChannel) {
        this.limpiarRealtime();
      }
      
      // Canal único para todas las suscripciones del usuario
      const channelName = `programaciones-user-${this.currentUserId}`; // Estable, sin Date.now()
      logger.dev(`📡 Creando canal: ${channelName}`);
      this.realtimeChannel = supabase.channel(channelName);
      this.activeChannelName = channelName;
      
      // 1. Cambios en programacion_destinatarios (asignaciones)
      this.realtimeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'programacion_destinatarios',
          filter: `usuario_id=eq.${this.currentUserId}`
        },
        (payload) => {
          logger.dev('🔔 Cambio en destinatarios:', payload);
          this.recargarProgramaciones();
        }
      );
      
      // 2. Cambios en programaciones
      this.realtimeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'programaciones'
        },
        async (payload) => {
          logger.dev('🔔 Cambio en programaciones:', payload);
          const programacionId = payload.new?.id || payload.old?.id;
          const eventType = payload.eventType;
          
          // 🔧 CRÍTICO: Para DELETE, verificar si la programación estaba en nuestra lista actual
          if (eventType === 'DELETE') {
            const estabaEnLista = this.programaciones.some(p => p.id === programacionId);
            if (estabaEnLista) {
              logger.dev('🗑️ Programación eliminada estaba en nuestra lista - recargando...');
              this.recargarProgramaciones();
            }
            return;
          }
          
          // 🔧 CRÍTICO: Para UPDATE e INSERT, verificar si está asignada al usuario y recargar
          // Esto cubre todos los casos:
          // - Cambio de ACTIVO → PAUSADO (está en lista, debe quitarse)
          // - Cambio de PAUSADO → ACTIVO (no está en lista, debe agregarse)
          // - Cualquier otra modificación en una programación asignada
          const { data: asignacion, error } = await supabase
            .from('programacion_destinatarios')
            .select('programacion_id')
            .eq('programacion_id', programacionId)
            .eq('usuario_id', this.currentUserId)
            .eq('activo', true)
            .maybeSingle();
          
          if (error) {
            logger.warn('⚠️ Error verificando asignación de programación:', error.message);
            return;
          }
          
          if (asignacion) {
            logger.dev(`📥 Recargando programaciones por cambio detectado (${eventType})...`);
            
            // 🔧 CRÍTICO: Para UPDATE, agregar un pequeño delay para evitar race condition
            // El evento realtime puede llegar antes de que los datos estén sincronizados
            if (eventType === 'UPDATE') {
              logger.dev('⏳ Esperando 2s para que Supabase sincronice los datos...');
              logger.dev('📋 Datos del evento UPDATE:', {
                id: programacionId,
                new_estado: payload.new?.estado,
                old_estado: payload.old?.estado
              });
              setTimeout(() => {
                logger.dev('🔄 Recargando después del delay de 2s...');
                this.recargarProgramaciones();
              }, 2000);
            } else {
              // Para INSERT, recargar inmediatamente
              this.recargarProgramaciones();
            }
          }
        }
      );
      
      // 3. Cambios en programacion_contenidos
      this.realtimeChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'programacion_contenidos'
        },
        async (payload) => {
          logger.dev('🔔 Cambio en contenidos:', payload);
          const programacionId = payload.new?.programacion_id || payload.old?.programacion_id;
          const eventType = payload.eventType;
          
          // 🔧 CRÍTICO: Verificar que programacionId no sea undefined
          if (!programacionId) {
            logger.dev('⚠️ No se pudo obtener programacion_id del evento, ignorando');
            return;
          }
          
          // 🔧 CRÍTICO: Para DELETE, solo verificar si la programación está en nuestra lista
          if (eventType === 'DELETE') {
            const estaEnLista = this.programaciones.some(p => p.id === programacionId);
            if (estaEnLista) {
              logger.dev('📥 Contenido eliminado de programación en nuestra lista - recargando...');
              this.recargarProgramaciones();
            }
            return;
          }
          
          // Para INSERT y UPDATE: verificar si esta programación está asignada al usuario
          const { data: asignacion, error } = await supabase
            .from('programacion_destinatarios')
            .select('programacion_id')
            .eq('programacion_id', programacionId)
            .eq('usuario_id', this.currentUserId)
            .eq('activo', true)
            .maybeSingle(); // 🔧 Usar maybeSingle() en lugar de single() para evitar error si no existe
          
          if (error) {
            logger.warn('⚠️ Error verificando asignación de programación:', error.message);
            return;
          }
          
          if (asignacion) {
            logger.dev('📥 Recargando programaciones por cambio en contenidos...');
            this.recargarProgramaciones();
          }
        }
      );
      
      // Suscribirse al canal con manejo de estados
      const channelRef = this.realtimeChannel; // Capturar referencia para ignorar eventos de canales antiguos
      this.realtimeChannel.subscribe((status) => {
        logger.dev(`📡 Estado del canal de programaciones: ${status}`);
        this.realtimeStatus = status;
        
        if (status === 'SUBSCRIBED') {
          logger.dev('✅ Sincronización en tiempo real de programaciones activada');
          this.resetReconnection(); // 🔧 MEJORADO: Usar resetReconnection() en lugar de manual
          this.iniciarHeartbeatRealtime();
        } else if (status === 'CHANNEL_ERROR') {
          // Ignorar si el evento viene de un canal antiguo o de un cierre intencional
          if (channelRef !== this.realtimeChannel) return;
          if (Date.now() < this.closingUntilTs) return;
          logger.error('❌ Error en canal de programaciones - el heartbeat manejará la reconexión');
          // 🔧 NO llamar intentarReconexionRealtime() aquí - el heartbeat lo detectará y manejará
        } else if (status === 'CLOSED') {
          // Ignorar si el evento viene de un canal antiguo o de un cierre intencional
          if (channelRef !== this.realtimeChannel) return;
          if (Date.now() < this.closingUntilTs) return;
          logger.warn('⚠️ Canal de programaciones cerrado - el heartbeat manejará la reconexión');
          // 🔧 NO llamar intentarReconexionRealtime() aquí - el heartbeat lo detectará y manejará
        }
      });
      
    } catch (error) {
      logger.error('❌ Error configurando realtime:', error);
      // this.intentarReconexionRealtime(); // silenciar log, seguimos reconectando
    }
  }

  /**
   * Iniciar heartbeat para verificar estado de la conexión en tiempo real
   * Se verifica cada 15s para detectar desconexiones rápidamente
   */
  iniciarHeartbeatRealtime() {
    // Limpiar heartbeat anterior si existe
    if (this.realtimeHeartbeat) {
      clearInterval(this.realtimeHeartbeat);
    }

    // 🔧 CRÍTICO: Verificar estado cada 15 segundos (más agresivo)
    this.realtimeHeartbeat = setInterval(() => {
      if (!this.isActive) return;

      // Verificar si el canal está conectado
      if (this.realtimeStatus !== 'SUBSCRIBED' && !this.isReconnecting && Date.now() >= this.closingUntilTs) {
        logger.warn(`⚠️ Conexión en tiempo real perdida (estado: ${this.realtimeStatus}) - reconectando automáticamente...`); // 🔧 Activado para debug
        this.intentarReconexionRealtime();
      } else {
        // 🔧 Log de estado cada 60s (cada 4to heartbeat)
        if (!this._heartbeatCount) this._heartbeatCount = 0;
        this._heartbeatCount++;
        if (this._heartbeatCount % 4 === 0) {
          logger.dev(`💓 Realtime heartbeat - Estado: ${this.realtimeStatus}`);
        }
      }
    }, 15000); // 15 segundos para detección rápida
  }

  /**
   * Intentar reconexión automática de la conexión en tiempo real
   * Usa backoff exponencial: 1s, 2s, 4s, 8s, 16s, máx 60s
   * Reintentos ilimitados para garantizar reconexión tras interrupciones largas
   */
  async intentarReconexionRealtime() {
    if (!this.isActive || !this.currentUserId) return;
    if (this.isReconnecting) return; // Evitar paralelismo

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    // ⚡ Reconexión ULTRA-RÁPIDA: 500ms inicial, máximo 15s entre intentos
    // 🔋 Con prevención de sleep, las desconexiones deberían ser raras
    const baseDelay = 500; // ⚡ 500ms (antes: 1000ms)
    const maxDelay = 15000; // ⚡ 15s máximo (antes: 60s)
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);
    
    logger.dev(`🔄 Reconectando canal de programaciones en ${delay/1000}s (intento #${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    this.reconnectTimer = setTimeout(async () => {
      if (!this.isActive || !this.currentUserId) {
        this.isReconnecting = false;
        return;
      }
      
      logger.dev(`🔌 Intento de reconexión #${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      
      try {
        // Limpiar canal anterior
        this.limpiarRealtime();
        
        // ⚡ Pequeña pausa antes de reconectar (500ms - optimizado)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Intentar configurar canal de nuevo
        this.configurarRealtime();
        
        // IMPORTANTE: No marcar como exitoso aquí, esperar a que subscribe() llame con SUBSCRIBED
        // El éxito se marca en el callback de subscribe() cuando status === 'SUBSCRIBED'
      } catch (error) {
        logger.error(`❌ Error en reconexión de canal de programaciones (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error);
        
        // 🔧 CRÍTICO: Resetear flag para permitir próximo intento
        this.isReconnecting = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          logger.dev(`⏳ Esperando antes del próximo intento...`);
          this.intentarReconexionRealtime();
        } else {
          logger.error('❌ Máximo de intentos de reconexión alcanzado');
          logger.warn('⚠️ El canal de programaciones permanecerá desconectado (timer local sigue activo)');
          this.resetReconnection();
        }
      }
    }, delay);
  }
  
  /**
   * 🔧 NUEVO: Resetear estado de reconexión
   */
  resetReconnection() {
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Recargar programaciones desde Supabase
   */
  async recargarProgramaciones() {
    logger.dev('🔄 Recargando programaciones...');
    
    // Usar debounce para evitar recargas múltiples
    if (this._reloadTimeout) {
      clearTimeout(this._reloadTimeout);
    }
    
    this._reloadTimeout = setTimeout(async () => {
      await this.cargarProgramacionesUsuario();
      logger.dev(`✅ ${this.programaciones.length} programaciones recargadas`);
      
      // 🔧 CRÍTICO: Limpiar el Map de ultimasEjecuciones para programaciones que cambiaron
      // Esto permite que las programaciones con frecuencia actualizada se ejecuten con la nueva frecuencia
      logger.dev('🧹 Limpiando timestamps de ejecuciones anteriores para permitir cambios de frecuencia...');
      // NO limpiar todo el Map, solo resetear para permitir recálculo con nueva frecuencia
      
      // 🔧 CRÍTICO: Limpiar la cola de espera de programaciones que ya no están activas
      this.limpiarColaEsperaPausadas();
    }, 1000); // Esperar 1 segundo antes de recargar
  }
  
  /**
   * 🔧 NUEVO: Limpiar cola de espera de programaciones pausadas/eliminadas
   */
  limpiarColaEsperaPausadas() {
    if (this.programacionesEnEspera.length === 0) {
      return;
    }
    
    const programacionesActivasIds = new Set(
      this.programaciones
        .filter(p => p.estado === 'activo')
        .map(p => p.id)
    );
    
    const colaInicial = this.programacionesEnEspera.length;
    this.programacionesEnEspera = this.programacionesEnEspera.filter(prog => {
      const estaActiva = programacionesActivasIds.has(prog.id);
      if (!estaActiva) {
        logger.dev(`🧹 Eliminando de cola de espera: "${prog.descripcion}" (pausada o eliminada)`);
      }
      return estaActiva;
    });
    
    const eliminadas = colaInicial - this.programacionesEnEspera.length;
    if (eliminadas > 0) {
      logger.dev(`🧹 ${eliminadas} programación(es) eliminada(s) de la cola de espera`);
      
      // Si la cola quedó vacía, resetear flag y desbloquear AutoDJ
      if (this.programacionesEnEspera.length === 0) {
        this.esperandoFinCancion = false;
        this._desbloquearAutoDJ();
        logger.dev('✅ Cola de espera vacía - AutoDJ desbloqueado');
      }
    }
  }

  /**
   * Forzar recarga inmediata de programaciones (sin debounce)
   * Útil para testing o cuando el usuario hace un cambio manual
   */
  async forzarRecargaProgramaciones() {
    logger.dev('🔄 FORZANDO recarga inmediata de programaciones...');
    
    // Cancelar debounce pendiente
    if (this._reloadTimeout) {
      clearTimeout(this._reloadTimeout);
      this._reloadTimeout = null;
    }
    
    await this.cargarProgramacionesUsuario();
    logger.dev(`✅ ${this.programaciones.length} programaciones recargadas FORZADAMENTE`);
    logger.dev('🧹 Timestamps de ejecuciones mantenidos - nueva frecuencia se aplicará en próxima verificación');
  }

  /**
   * Limpiar suscripciones de tiempo real
   */
  limpiarRealtime() {
    if (this.realtimeChannel) {
      // Marcar cierre intencional y abrir ventana de gracia para ignorar CLOSED
      this.isClosingRealtime = true;
      this.closingUntilTs = Date.now() + this.closingGraceMs;
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
      logger.dev('🗑️ Suscripciones de tiempo real eliminadas');
      // Fin del cierre intencional
      this.isClosingRealtime = false;
    }
  }

  /**
   * 🔧 NUEVO: Iniciar polling como fallback cuando WebSocket falla
   * Polling inteligente que solo se activa cuando el WebSocket está desconectado
   * Garantiza que los cambios se detecten incluso con pantalla bloqueada
   */
  iniciarPollingFallback() {
    // Limpiar polling anterior si existe
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    logger.dev(`🔄 Sistema de polling fallback iniciado (cada ${this.pollingIntervalMs / 1000 / 60} min)`);
    logger.dev('   → Se activa automáticamente cuando WebSocket falla');
    logger.dev('   → Garantiza detección de cambios incluso con pantalla bloqueada');
    
    // Ejecutar polling cada X minutos
    this.pollingInterval = setInterval(() => {
      this.verificarYEjecutarPolling();
    }, this.pollingIntervalMs);
  }
  
  /**
   * 🔧 NUEVO: Verificar si se debe ejecutar polling y ejecutarlo
   */
  async verificarYEjecutarPolling() {
    if (!this.isActive || !this.currentUserId) {
      return;
    }
    
    // 🎯 LÓGICA CLAVE: Solo hacer polling si WebSocket está muerto
    if (this.realtimeStatus === 'SUBSCRIBED') {
      // WebSocket activo → NO hacer polling (ahorra tráfico)
      if (this.isPollingActive) {
        logger.dev('✅ WebSocket reconectado - desactivando polling fallback');
        this.isPollingActive = false;
      }
      return;
    }
    
    // WebSocket muerto → Activar polling
    if (!this.isPollingActive) {
      logger.dev('⚠️ WebSocket inactivo - ACTIVANDO polling fallback');
      this.isPollingActive = true;
    }
    
    // Evitar polling duplicado (si ya se hizo hace menos de 2 minutos)
    const ahora = Date.now();
    if (ahora - this.lastPollingCheck < 2 * 60 * 1000) {
      logger.dev('⏭️ Polling saltado - ya se ejecutó recientemente');
      return;
    }
    
    logger.dev('🔄 [POLLING FALLBACK] Consultando BD directamente...');
    this.lastPollingCheck = ahora;
    
    try {
      // Consultar programaciones directamente desde BD
      const programacionesAnteriores = this.programaciones.length;
      await this.cargarProgramacionesUsuario();
      const programacionesNuevas = this.programaciones.length;
      
      if (programacionesAnteriores !== programacionesNuevas) {
        logger.dev(`🔔 [POLLING] Cambios detectados: ${programacionesAnteriores} → ${programacionesNuevas} programaciones`);
      } else {
        logger.dev(`✅ [POLLING] Sin cambios (${this.programaciones.length} programaciones)`);
      }
      
      // También verificar si hay programaciones pendientes de ejecutar AHORA
      // (por si se perdió la ejecución mientras estaba desconectado)
      logger.dev('🔍 [POLLING] Verificando programaciones pendientes...');
      await this.verificarProgramaciones();
      
    } catch (error) {
      logger.error('❌ [POLLING] Error consultando BD:', error);
    }
  }

  /**
   * Configurar Page Visibility API para mantener servicio activo en segundo plano
   * Asegura que el servicio siga funcionando incluso cuando la pestaña no está visible
   */
  configurarPageVisibility() {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página en segundo plano - verificar que todo siga activo
        logger.dev('📱 App en segundo plano - manteniendo servicios activos...');
      } else {
        // Página visible de nuevo - FORZAR reconexión agresiva
        logger.dev('📱 App visible de nuevo - FORZANDO verificación completa...');
        
        // 1. Verificar que el timer siga activo
        if (this.isActive && !this.checkInterval) {
          logger.warn('⚠️ Timer se detuvo - reiniciando...');
          this.iniciarTimer();
        }
        
        // 2. Si el canal NO está suscrito, FORZAR reconexión inmediata
        if (this.isActive && this.realtimeStatus !== 'SUBSCRIBED') {
          logger.warn('⚠️ Canal desconectado - FORZANDO reconexión inmediata...');
          
          // 🔧 CRÍTICO: Resetear intentos fallidos previos
          // Si se alcanzó el máximo mientras dormía, esto permite reintentar
          this.resetReconnection();
          
          // 🔧 CRÍTICO: Forzar reconexión AHORA (sin esperar)
          this.configurarRealtime();
          
          // 🔧 CRÍTICO: Recargar programaciones después de 3 segundos
          // (dar tiempo a que el canal se conecte)
          setTimeout(async () => {
            if (this.realtimeStatus === 'SUBSCRIBED') {
              logger.dev('✅ Canal reconectado - recargando programaciones...');
              await this.cargarProgramacionesUsuario();
              logger.dev(`✅ ${this.programaciones.length} programaciones recargadas después de reconexión`);
            } else {
              logger.warn('⚠️ Canal todavía no conectado después de 3s - reintentando...');
              this.intentarReconexionRealtime();
            }
          }, 3000);
        } else if (this.isActive && this.realtimeStatus === 'SUBSCRIBED') {
          // Canal conectado - solo recargar programaciones por si hubo cambios
          logger.dev('✅ Canal ya conectado - recargando programaciones por si hubo cambios...');
          this.recargarProgramaciones();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Guardar referencia para limpieza
    this._visibilityHandler = handleVisibilityChange;
  }

  /**
   * 🔧 NUEVO: Configurar listener para detectar fin de canción
   * Permite ejecutar programaciones que esperan a que termine la canción actual
   */
  configurarListenerFinCancion() {
    if (!audioPlayer || typeof audioPlayer.on !== 'function') {
      logger.warn('⚠️ audioPlayer no disponible para configurar listener');
      return;
    }
    
    // Guardar referencia al handler para poder eliminarlo después
    this._onSongEndHandler = async () => {
      // Solo procesar si hay programaciones en espera
      if (this.programacionesEnEspera.length === 0) {
        return;
      }
      
      logger.dev(`🎵 Canción terminada - ${this.programacionesEnEspera.length} programación(es) esperando`);
      
      // Obtener la primera programación en espera (FIFO)
      const programacion = this.programacionesEnEspera.shift();
      this.esperandoFinCancion = false;
      
      logger.dev(`🎬 Ejecutando programación que esperaba fin de canción: "${programacion.descripcion}"`);
      
      // 🔧 CRÍTICO: Ejecutar con songEndedBefore = true porque la canción terminó
      await this.ejecutarProgramacion(programacion, true);
      
      // 🔧 CRÍTICO: Desbloquear el AutoDJ DESPUÉS de la reproducción
      logger.dev(`✅ Contenido programado finalizado - desbloqueando AutoDJ`);
      this._desbloquearAutoDJ();
    };
    
    // Suscribirse al evento onEnd del audioPlayer
    audioPlayer.on('onEnd', this._onSongEndHandler);
    logger.dev('✅ Listener de fin de canción configurado');
  }
  
  /**
   * 🔧 NUEVO: Bloquear AutoDJ temporalmente
   */
  _bloquearAutoDJ(immediate = false) {
    if (typeof window !== 'undefined' && window.autoDjInstance) {
      window.autoDjInstance.blockedByScheduledContent = true;
      if (immediate) {
        // Detener cualquier procesamiento de handleSongEnd en curso
        window.autoDjInstance.isHandlingSongEnd = false;
      }
      logger.dev('🔒 AutoDJ bloqueado por contenido programado');
    }
  }
  
  /**
   * 🔧 NUEVO: Desbloquear AutoDJ
   */
  _desbloquearAutoDJ() {
    if (typeof window !== 'undefined' && window.autoDjInstance) {
      window.autoDjInstance.blockedByScheduledContent = false;
      logger.dev('🔓 AutoDJ desbloqueado');
      
      // Ejecutar manualmente handleSongEnd ahora que está desbloqueado
      if (window.autoDjInstance.handleSongEnd) {
        logger.dev('🎵 Ejecutando handleSongEnd del AutoDJ ahora');
        window.autoDjInstance.handleSongEnd();
      }
    }
  }

  /**
   * 💾 Guardar timestamps de ejecuciones en localStorage
   * CRÍTICO: Previene que programaciones diarias se ejecuten múltiples veces al día
   */
  guardarTimestampsEnStorage() {
    if (!this.currentUserId) return;
    
    try {
      const key = `scheduledContent_timestamps_${this.currentUserId}`;
      const data = {
        timestamps: Object.fromEntries(this.ultimasEjecuciones),
        savedAt: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
      logger.dev('💾 Timestamps guardados en localStorage');
    } catch (error) {
      logger.warn('⚠️ Error guardando timestamps:', error.message);
    }
  }
  
  /**
   * 📂 Cargar timestamps de ejecuciones desde localStorage
   * CRÍTICO: Restaura memoria de programaciones ejecutadas tras reinicios
   */
  cargarTimestampsDesdeStorage(usuarioId) {
    try {
      const key = `scheduledContent_timestamps_${usuarioId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        logger.dev('📂 No hay timestamps guardados - empezando desde cero');
        this.ultimasEjecuciones.clear();
        return;
      }
      
      const data = JSON.parse(stored);
      const ahora = Date.now();
      const unDiaMs = 24 * 60 * 60 * 1000;
      
      // 🧹 Limpiar timestamps antiguos (más de 7 días)
      const timestampsValidos = new Map();
      for (const [key, value] of Object.entries(data.timestamps)) {
        const timestamp = typeof value === 'number' ? value : value.timestamp;
        if (ahora - timestamp < 7 * unDiaMs) {
          timestampsValidos.set(key, value);
        }
      }
      
      this.ultimasEjecuciones = timestampsValidos;
      logger.dev(`📂 ${timestampsValidos.size} timestamps restaurados desde localStorage`);
      
      // Debug: Mostrar timestamps restaurados
      for (const [progId, timestamp] of timestampsValidos.entries()) {
        if (!progId.endsWith('_info')) {
          const fecha = new Date(typeof timestamp === 'number' ? timestamp : timestamp.timestamp);
          logger.dev(`   - ${progId}: ${fecha.toLocaleString('es-ES')}`);
        }
      }
      
    } catch (error) {
      logger.warn('⚠️ Error cargando timestamps:', error.message);
      this.ultimasEjecuciones.clear();
    }
  }
  
  /**
   * 🧹 Limpiar timestamps antiguos de localStorage
   */
  limpiarTimestampsAntiguos() {
    if (!this.currentUserId) return;
    
    try {
      const key = `scheduledContent_timestamps_${this.currentUserId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) return;
      
      const data = JSON.parse(stored);
      const ahora = Date.now();
      const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
      
      const timestampsActualizados = {};
      let eliminados = 0;
      
      for (const [key, value] of Object.entries(data.timestamps)) {
        const timestamp = typeof value === 'number' ? value : value.timestamp;
        if (ahora - timestamp < seteDiasMs) {
          timestampsActualizados[key] = value;
        } else {
          eliminados++;
        }
      }
      
      if (eliminados > 0) {
        localStorage.setItem(key, JSON.stringify({
          timestamps: timestampsActualizados,
          savedAt: ahora
        }));
        logger.dev(`🧹 ${eliminados} timestamps antiguos eliminados de localStorage`);
      }
      
    } catch (error) {
      logger.warn('⚠️ Error limpiando timestamps:', error.message);
    }
  }

  /**
   * Convertir tiempo HH:MM a minutos desde medianoche
   */
  tiempoAMinutos(tiempoString) {
    if (!tiempoString) return 0;
    const [horas, minutos] = tiempoString.split(':').map(Number);
    return horas * 60 + minutos;
  }

  /**
   * Obtener estado actual del servicio
   */
  getState() {
    return {
      isActive: this.isActive,
      currentUserId: this.currentUserId,
      programaciones: this.programaciones.length,
      programacionesDetalles: this.programaciones.map(p => ({
        id: p.id,
        descripcion: p.descripcion,
        tipo: p.tipo,
        estado: p.estado,
        modo_audio: p.modo_audio
      })),
      isPlayingScheduledContent: this.isPlayingScheduledContent,
      currentProgramacion: this.currentProgramacion?.descripcion || null,
      ultimasEjecuciones: Object.fromEntries(this.ultimasEjecuciones)
    };
  }
  
  /**
   * 🔧 DEBUG: Ver timestamps guardados en localStorage
   */
  verTimestampsGuardados() {
    if (!this.currentUserId) {
      logger.warn('⚠️ No hay usuario activo');
      return null;
    }
    
    try {
      const key = `scheduledContent_timestamps_${this.currentUserId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        logger.dev('📂 No hay timestamps guardados en localStorage');
        return null;
      }
      
      const data = JSON.parse(stored);
      logger.dev('📂 Timestamps en localStorage:', {
        usuarioId: this.currentUserId,
        guardadoEn: new Date(data.savedAt).toLocaleString('es-ES'),
        cantidad: Object.keys(data.timestamps).filter(k => !k.endsWith('_info')).length
      });
      
      console.table(
        Object.entries(data.timestamps)
          .filter(([key]) => !key.endsWith('_info'))
          .map(([progId, timestamp]) => ({
            'ID Programación': progId.substring(0, 8) + '...',
            'Última Ejecución': new Date(typeof timestamp === 'number' ? timestamp : timestamp.timestamp).toLocaleString('es-ES'),
            'Hace': Math.floor((Date.now() - (typeof timestamp === 'number' ? timestamp : timestamp.timestamp)) / (1000 * 60)) + ' min'
          }))
      );
      
      return data;
    } catch (error) {
      logger.error('❌ Error leyendo timestamps:', error);
      return null;
    }
  }
  
  /**
   * 🔧 DEBUG: Limpiar TODOS los timestamps (forzar reset completo)
   * ⚠️ ADVERTENCIA: Esto permitirá que todas las programaciones se ejecuten de nuevo
   */
  limpiarTodosLosTimestamps() {
    if (!this.currentUserId) {
      logger.warn('⚠️ No hay usuario activo');
      return false;
    }
    
    try {
      const key = `scheduledContent_timestamps_${this.currentUserId}`;
      localStorage.removeItem(key);
      this.ultimasEjecuciones.clear();
      logger.dev('🧹 TODOS los timestamps eliminados - programaciones se ejecutarán de nuevo');
      logger.warn('⚠️ ADVERTENCIA: Las programaciones diarias/semanales se ejecutarán nuevamente');
      return true;
    } catch (error) {
      logger.error('❌ Error limpiando timestamps:', error);
      return false;
    }
  }
  
  /**
   * 🔧 DEBUG: Limpiar timestamp de UNA programación específica
   */
  limpiarTimestampProgramacion(programacionId) {
    if (!programacionId) {
      logger.warn('⚠️ Debe proporcionar un ID de programación');
      return false;
    }
    
    try {
      // Limpiar en memoria
      this.ultimasEjecuciones.delete(programacionId);
      this.ultimasEjecuciones.delete(programacionId + '_info');
      
      // Guardar en localStorage
      this.guardarTimestampsEnStorage();
      
      logger.dev(`🧹 Timestamp eliminado para programación: ${programacionId}`);
      logger.dev('✅ Esta programación podrá ejecutarse de nuevo');
      return true;
    } catch (error) {
      logger.error('❌ Error limpiando timestamp:', error);
      return false;
    }
  }

  /**
   * 🔧 DEBUG: Verificar si las tablas existen y tienen datos
   */
  async verificarTablas() {
    logger.dev('🔍 Verificando estructura de base de datos...');
    
    try {
      // Test 1: Tabla programaciones
      const { data: testProg, error: errorProg } = await supabase
        .from('programaciones')
        .select('id, descripcion, estado')
        .limit(5);
      
      logger.dev('📊 Test programaciones:', {
        existe: !errorProg,
        error: errorProg?.message,
        registros: testProg?.length || 0,
        muestra: testProg
      });
      
      // Test 2: Tabla programacion_destinatarios
      const { data: testDest, error: errorDest } = await supabase
        .from('programacion_destinatarios')
        .select('programacion_id, usuario_id, activo')
        .limit(5);
      
      logger.dev('📊 Test programacion_destinatarios:', {
        existe: !errorDest,
        error: errorDest?.message,
        registros: testDest?.length || 0,
        muestra: testDest
      });
      
      // Test 3: Tabla programacion_contenidos
      const { data: testCont, error: errorCont } = await supabase
        .from('programacion_contenidos')
        .select('programacion_id, contenido_id, orden')
        .limit(5);
      
      logger.dev('📊 Test programacion_contenidos:', {
        existe: !errorCont,
        error: errorCont?.message,
        registros: testCont?.length || 0,
        muestra: testCont
      });
      
      // Test 4: ¿Hay programaciones para este usuario?
      if (this.currentUserId) {
        const { data: userProgs, error: errorUser } = await supabase
          .from('programacion_destinatarios')
          .select('*')
          .eq('usuario_id', this.currentUserId);
        
        logger.dev('📊 Programaciones del usuario actual:', {
          usuarioId: this.currentUserId,
          error: errorUser?.message,
          total: userProgs?.length || 0,
          activas: userProgs?.filter(p => p.activo).length || 0,
          datos: userProgs
        });
      }
      
      return {
        programaciones: !errorProg,
        destinatarios: !errorDest,
        contenidos: !errorCont
      };
      
    } catch (error) {
      logger.error('❌ Error verificando tablas:', error);
      return {
        programaciones: false,
        destinatarios: false,
        contenidos: false,
        error: error.message
      };
    }
  }
}

// Exportar singleton PEREZOSO (lazy) para evitar logs prematuros
let _scheduledContentInstance = null;
const getInstance = () => {
  if (!_scheduledContentInstance) {
    _scheduledContentInstance = new ScheduledContentService();
  }
  return _scheduledContentInstance;
};

// Proxy que crea la instancia solo al acceder a un método/propiedad
const lazyScheduledContent = new Proxy({}, {
  get(_target, prop) {
    const inst = getInstance();
    
    // Mostrar log de inicialización solo cuando se accede por primera vez
    if (!inst._initialized) {
      logger.dev('📅 ScheduledContentService inicializado');
      inst._initialized = true;
      
      // Hacer accesible globalmente para debug solo cuando se inicializa
      if (typeof window !== 'undefined') {
        window.scheduledContentDebug = inst;
        logger.dev('🔧 scheduledContentService: Debug disponible en window.scheduledContentDebug');
        logger.dev('🔧 Comandos disponibles:');
        logger.dev('   - window.scheduledContentDebug.verTimestampsGuardados() → Ver ejecuciones guardadas');
        logger.dev('   - window.scheduledContentDebug.limpiarTimestampProgramacion(id) → Resetear una programación');
        logger.dev('   - window.scheduledContentDebug.limpiarTodosLosTimestamps() → ⚠️ Resetear todo (usar con cuidado)');
        logger.dev('   - window.scheduledContentDebug.getState() → Ver estado completo');
      }
    }
    
    const value = inst[prop];
    if (typeof value === 'function') return value.bind(inst);
    return value;
  }
});

export default lazyScheduledContent;

