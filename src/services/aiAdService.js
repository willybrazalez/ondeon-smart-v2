/**
 * AIAdService - Servicio para generar anuncios con IA
 * 
 * Funcionalidades:
 * - Generar texto con OpenAI GPT-4 (paso 1)
 * - Generar audio con ElevenLabs TTS (paso 2)
 * - Obtener voces disponibles de ElevenLabs
 * - Guardar anuncios en base de datos
 * - Programar anuncios para usuarios/grupos
 * - Gestionar biblioteca de música de fondo
 * - Obtener historial de anuncios generados
 */

import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

class AIAdService {
  /**
   * PASO 0: Obtener voces disponibles de ElevenLabs
   */
  async obtenerVocesDisponibles() {
    try {
      logger.dev('🎤 Obteniendo voces de ElevenLabs...');
      
      const { data, error } = await supabase.functions.invoke('generate-ad', {
        body: { mode: 'list-voices' }
      });
      
      if (error) {
        logger.error('❌ Error obteniendo voces:', error);
        throw error;
      }
      
      logger.dev(`✅ ${data.voices?.length || 0} voces disponibles`);
      
      return data.voices || [];
    } catch (error) {
      logger.error('❌ Error obteniendo voces:', error);
      throw error;
    }
  }

  /**
   * PASO 1: Generar solo el TEXTO del anuncio con OpenAI GPT-4
   * NO genera audio ni sube nada a S3
   * 
   * IMPORTANTE: El prompt de OpenAI debe incluir la instrucción:
   * "Responde en el MISMO IDIOMA que la idea proporcionada por el usuario"
   */
  async generarTexto({ 
    idea, 
    empresaNombre,
    targetAudience = 'general', 
    duration = 30
  }) {
    // Sistema de reintentos para iOS (máximo 3 intentos)
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.dev(`📝 Generando texto con GPT-4 (intento ${attempt}/${maxRetries}):`, { 
          idea: idea.substring(0, 50) + '...',
          empresaNombre,
          duration
        });
        
        const { data, error } = await supabase.functions.invoke('generate-ad', {
          body: { 
            mode: 'text',
            idea, 
            targetAudience, 
            duration,
            empresaNombre,
            detectLanguage: true // Indica que la IA debe responder en el idioma de la idea
          }
        });
        
        if (error) {
          logger.error(`❌ Error en Edge Function (intento ${attempt}):`, error);
          lastError = error;
          
          // Si es el último intento, lanzar el error
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Esperar antes de reintentar (backoff exponencial)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.dev(`⏳ Reintentando en ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        logger.dev('✅ Texto generado exitosamente');
        
        return {
          texto: data.texto,
          model: data.model,
          metadata: data.metadata
        };
      } catch (error) {
        logger.error(`❌ Error generando texto (intento ${attempt}):`, error);
        lastError = error;
        
        // Si es el último intento, lanzar el error
        if (attempt === maxRetries) {
          // Mensaje específico para conexiones interrumpidas
          if (error.message && (error.message.includes('Failed to send') || error.message.includes('fetch'))) {
            throw new Error('No se pudo conectar con el servidor después de varios intentos. Verifica tu conexión WiFi e intenta de nuevo.');
          }
          throw error;
        }
        
        // Esperar antes de reintentar
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.dev(`⏳ Reintentando en ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    throw lastError || new Error('Error generando texto después de varios intentos');
  }

  /**
   * PASO 2: Generar solo el AUDIO a partir del texto con ElevenLabs
   * Sube el audio FINAL a AWS S3
   */
  async generarAudio({ 
    texto,
    voiceId,
    // Parámetros de música de fondo (opcionales)
    backgroundMusicId = null,
    backgroundMusicUrl = null,
    musicVolume = 0.15
  }) {
    try {
      logger.dev('🎤 Generando audio con ElevenLabs:', { 
        textoLength: texto.length,
        voiceId,
        conMusica: !!backgroundMusicId 
      });
      
      const { data, error } = await supabase.functions.invoke('generate-ad', {
        body: { 
          mode: 'audio',
          texto,
          voiceId,
          // Música de fondo
          backgroundMusicId,
          backgroundMusicUrl,
          musicVolume
        }
      });
      
      if (error) {
        logger.error('❌ Error en Edge Function:', error);
        throw error;
      }
      
      logger.dev('✅ Audio generado y subido a S3 exitosamente');
      
      return {
        audioUrl: data.audioUrl,
        voiceId: data.voiceId,
        hasBackgroundMusic: data.hasBackgroundMusic || false,
        backgroundMusicId: data.backgroundMusicId,
        metadata: data.metadata
      };
    } catch (error) {
      logger.error('❌ Error generando audio:', error);
      throw error;
    }
  }

  /**
   * Guardar anuncio generado en la base de datos
   */
  async guardarAnuncio({ 
    titulo, 
    idea, 
    texto, 
    audioUrl,
    audioSize = 0,
    voiceId, 
    model, 
    userId, 
    empresaId, 
    marcaId, // Añadido para guardar en marca_contenidos
    durationSeconds,
    empresaNombre,
    textRegenerationCount = 0,
    voiceChangeCount = 0,
    backgroundMusicId = null
  }) {
    try {
      logger.dev('💾 Guardando anuncio en BD...');
      
      // 1. Crear registro en tabla contenidos
      // Extraer s3_key de la URL (ej: "contenidos/ads/ad-uuid.mp3")
      const urlParts = new URL(audioUrl);
      const s3_key = urlParts.pathname.substring(1); // Remover el '/' inicial
      
      // Obtener el auth.uid() real de Supabase Auth (no el ID de la tabla usuarios)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      logger.dev('👤 Usuario autenticado para created_by:', {
        authUserId: authUser?.id,
        email: authUser?.email
      });
      
      const { data: contenido, error: errorContenido } = await supabase
        .from('contenidos')
        .insert({
          nombre: titulo,
          tipo_contenido: 'cuna', // Usar 'cuna' en lugar de crear nuevo tipo 'anuncio'
          url_s3: audioUrl,
          s3_key: s3_key,
          tamaño_bytes: audioSize, // Tamaño real del audio en bytes
          duracion_segundos: durationSeconds,
          formato_audio: 'mp3',
          activo: true,
          created_by: authUser?.id || null // Usar auth.uid() en lugar de usuarios.id
        })
        .select()
        .single();
      
      if (errorContenido) {
        logger.error('❌ Error creando contenido:', errorContenido);
        throw errorContenido;
      }
      
      logger.dev('✅ Contenido creado:', contenido.id);
      
      // 2. Crear registro en tabla ai_generated_ads
      logger.dev('📊 Datos para ai_generated_ads:', {
        titulo,
        empresaId,
        empresaNombre,
        userId,
        voiceId,
        textRegenerationCount,
        voiceChangeCount
      });
      
      const { data: aiAd, error: errorAiAd } = await supabase
        .from('ai_generated_ads')
        .insert({
          titulo,
          idea_original: idea,
          texto_generado: texto,
          ai_provider: 'elevenlabs',
          voice_id: voiceId,
          model_used: model,
          audio_url: audioUrl,
          duration_seconds: durationSeconds,
          contenido_id: contenido.id,
          created_by: userId,
          empresa_id: empresaId, // ✅ ID de la empresa que gestiona el admin
          empresa_nombre: empresaNombre,
          text_regeneration_count: textRegenerationCount,
          voice_change_count: voiceChangeCount,
          metadata: { 
            targetAudience: 'general',
            hasBackgroundMusic: !!backgroundMusicId,
            backgroundMusicId
          }
        })
        .select()
        .single();
      
      if (errorAiAd) {
        logger.error('❌ Error creando ai_generated_ad:', errorAiAd);
        throw errorAiAd;
      }
      
      logger.dev('✅ Anuncio IA guardado en ai_generated_ads');
      
      // 3. Crear relación en marca_contenidos (si se proporciona marcaId)
      if (marcaId) {
        logger.dev('📎 Creando relación marca-contenido:', { marcaId, contenidoId: contenido.id });
        
        const { error: errorMarcaContenido } = await supabase
          .from('marca_contenidos')
          .insert({
            marca_id: marcaId,
            contenido_id: contenido.id
          });
        
        if (errorMarcaContenido) {
          logger.error('❌ Error creando relación marca-contenido:', errorMarcaContenido);
          // No lanzar error, solo loguear (no es crítico)
        } else {
          logger.dev('✅ Contenido asignado a marca:', marcaId);
        }
      }
      
      // 4. Crear asignación del contenido a la empresa (para facturación)
      logger.dev('📎 Creando asignación de contenido a empresa:', empresaId);
      
      const { data: asignacion, error: errorAsignacion } = await supabase
        .from('contenido_asignaciones')
        .insert({
          contenido_id: contenido.id,
          empresa_id: empresaId,
          activo: true,
          prioridad: 1
        })
        .select()
        .single();
      
      if (errorAsignacion) {
        logger.error('❌ Error creando asignación de contenido:', errorAsignacion);
        throw errorAsignacion;
      }
      
      logger.dev('✅ Contenido asignado a empresa para facturación:', asignacion.id);
      logger.dev('✅ Anuncio guardado exitosamente (contenido + ai_ad + marca_contenidos + asignación)');
      
      return { contenido, aiAd, asignacion };
    } catch (error) {
      logger.error('❌ Error guardando anuncio:', error);
      throw error;
    }
  }

  /**
   * Programar anuncio para usuarios específicos con configuración completa
   */
  async programarAnuncio({ 
    contenidoId, 
    titulo, 
    descripcion, 
    usuarios = [], 
    grupos = [], 
    todosUsuarios = false, 
    empresaId,
    frecuencia = {
      tipo: 'diaria', // 'diaria', 'semanal', 'anual'
      minutos: 15
    },
    modoAudio = 'background', // Siempre música de fondo
    horario = {
      desde: '08:00',
      hasta: '23:59',
      horaInicio: '10:00',
      horaFin: '23:59'
    },
    fechas = {
      inicio: new Date().toISOString().split('T')[0],
      fin: null
    },
    periodicidad = {
      tipo: 'diaria',
      // Diaria
      dailyMode: 'laborales',
      cadaDias: 1,
      horaUnaVezDia: '12:00',
      // Semanal
      weeklyMode: 'rango',
      weeklyDays: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      weeklyRangoDesde: '08:00',
      weeklyRangoHasta: '23:59',
      weeklyHoraUnaVez: '12:00',
      // Anual
      annualDate: '01/01',
      annualTime: '12:00'
    },
    userId = null  // ✅ NUEVO: Recibir userId como parámetro para usuarios legacy
  }) {
    try {
      logger.dev('📅 Programando anuncio con configuración completa...', { 
        contenidoId, 
        tipo: periodicidad.tipo,
        frecuenciaMinutos: frecuencia.minutos
      });
      
      // ✅ FIX: Obtener usuario autenticado - soporte para Supabase Auth Y usuarios legacy
      let authUserId = userId; // Priorizar userId recibido (usuarios legacy)
      
      // Si no hay userId, intentar obtenerlo de Supabase Auth
      if (!authUserId) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
        authUserId = authUser?.id;
      }
      
      // ⚠️ CRITICAL: Validar que tenemos usuario
      if (!authUserId) {
        logger.error('❌ No se pudo obtener usuario autenticado para created_by');
        throw new Error('Usuario no autenticado. Por favor, recarga la página.');
      }
      
      logger.dev('👤 Usuario autenticado para created_by:', {
        authUserId,
        source: userId ? 'legacy (parámetro)' : 'supabase auth'
      });
      
      // 1. Crear programación base
      // 🔧 CRÍTICO: Determinar frecuencia_minutos según el modo
      // Si es modo una_vez_dia, frecuencia_minutos debe ser null
      const esModoUnaVezDia = 
        (periodicidad.tipo === 'diaria' && periodicidad.dailyMode === 'una_vez') ||
        false; // ✅ FIX: Eliminada opción "una_vez" de semanal, solo aplica a diaria
      
      const programacionData = {
        descripcion: titulo || descripcion || 'Anuncio IA',  // ✅ FIX: Usar titulo (nombre de programación) primero
        tipo: periodicidad.tipo, // 'diaria' | 'semanal' | 'anual'
        estado: 'activo',
        modo_audio: modoAudio || 'background', // Música de fondo
        fecha_inicio: fechas.inicio,
        fecha_fin: fechas.fin || null,
        frecuencia_minutos: esModoUnaVezDia ? null : (frecuencia.minutos || 15), // ✅ FIX: null si es una_vez_dia
        hora_inicio: horario.horaInicio || '08:00',
        hora_fin: horario.horaFin || '23:59',
        prioridad: 0,
        esperar_fin_cancion: false,
        created_by: authUserId,  // ✅ Usuario que crea (UUID de auth o legacy)
        modified_by: authUserId  // ✅ NUEVO: Usuario que modifica (inicialmente el creador)
      };
      
      // 2. Configurar según el tipo de periodicidad
      if (periodicidad.tipo === 'diaria') {
        programacionData.daily_mode = periodicidad.dailyMode || 'laborales';
        programacionData.cada_dias = periodicidad.cadaDias || 1;
        programacionData.rango_desde = horario.desde || '08:00';
        programacionData.rango_hasta = horario.hasta || '23:59';
        
        // ⚠️ FIX: Solo guardar hora_una_vez_dia cuando modo es 'una_vez'
        if (periodicidad.dailyMode === 'una_vez') {
        programacionData.hora_una_vez_dia = periodicidad.horaUnaVezDia || '12:00';
        }
        
      } else if (periodicidad.tipo === 'semanal') {
        // ✅ FIX: Semanal solo tiene modo 'rango', eliminada opción 'una_vez'
        programacionData.weekly_mode = 'rango';
        
        // Convertir días en español a formato abreviado inglés
        const diasMap = {
          'lunes': 'lun',
          'martes': 'mar',
          'miercoles': 'mie',
          'jueves': 'jue',
          'viernes': 'vie',
          'sabado': 'sab',
          'domingo': 'dom'
        };
        
        const weeklyDaysFormatted = (periodicidad.weeklyDays || []).map(
          dia => diasMap[dia.toLowerCase()] || dia
        );
        
        programacionData.weekly_days = weeklyDaysFormatted;
        programacionData.weekly_rango_desde = periodicidad.weeklyRangoDesde || '08:00';
        programacionData.weekly_rango_hasta = periodicidad.weeklyRangoHasta || '23:59';
        
        // ✅ FIX: weekly_hora_una_vez ya no se usa (eliminada opción 'una_vez' de semanal)
        programacionData.weekly_hora_una_vez = null;
        
      } else if (periodicidad.tipo === 'anual') {
        programacionData.annual_date = periodicidad.annualDate || '01/01';
        programacionData.annual_time = periodicidad.annualTime || '12:00';
      }
      
      logger.dev('📝 Datos de programación:', programacionData);
      
      const { data: programacion, error: errorProg } = await supabase
        .from('programaciones')
        .insert(programacionData)
        .select()
        .single();
      
      if (errorProg) {
        logger.error('❌ Error creando programación:', errorProg);
        throw errorProg;
      }
      
      logger.dev('✅ Programación creada:', programacion.id);
      
      // 2. Asignar contenido a la programación
      const { error: errorContenido } = await supabase
        .from('programacion_contenidos')
        .insert({
          programacion_id: programacion.id,
          contenido_id: contenidoId,
          orden: 1,
          activo: true
        });
      
      if (errorContenido) {
        logger.error('❌ Error asignando contenido:', errorContenido);
        throw errorContenido;
      }
      
      // 3. Obtener lista de usuarios destinatarios
      let usuariosIds = [];
      
      if (todosUsuarios) {
        // Obtener todos los usuarios de la empresa
        const { data: todosLosUsuarios, error: errorUsuarios } = await supabase
          .from('usuarios')
          .select('id')
          .eq('empresa_id', empresaId);
        
        if (errorUsuarios) {
          logger.warn('⚠️ Error obteniendo usuarios de empresa:', errorUsuarios);
        } else {
          usuariosIds = todosLosUsuarios.map(u => u.id);
        }
      } else {
        // Usuarios específicos
        if (usuarios && usuarios.length > 0) {
          usuariosIds.push(...usuarios);
        }
        
        // Usuarios de grupos
        if (grupos && grupos.length > 0) {
          const { data: grupoUsuarios, error: errorGrupos } = await supabase
            .from('grupo_usuarios')
            .select('usuario_id')
            .in('grupo_id', grupos);
          
          if (errorGrupos) {
            logger.warn('⚠️ Error obteniendo usuarios de grupos:', errorGrupos);
          } else {
            usuariosIds.push(...grupoUsuarios.map(gu => gu.usuario_id));
          }
        }
      }
      
      // Eliminar duplicados
      usuariosIds = [...new Set(usuariosIds)];
      
      if (usuariosIds.length === 0) {
        throw new Error('No se encontraron usuarios destinatarios');
      }
      
      logger.dev(`👥 ${usuariosIds.length} usuarios destinatarios`);
      
      // 4. Insertar destinatarios
      const destinatarios = usuariosIds.map(userId => ({
        programacion_id: programacion.id,
        tipo: 'usuario', // Campo obligatorio
        usuario_id: userId,
        activo: true
      }));
      
      const { error: errorDest } = await supabase
        .from('programacion_destinatarios')
        .insert(destinatarios);
      
      if (errorDest) {
        logger.error('❌ Error insertando destinatarios:', errorDest);
        throw errorDest;
      }
      
      logger.dev('✅ Anuncio programado exitosamente');
      
      return { 
        programacion, 
        cantidadUsuarios: usuariosIds.length 
      };
    } catch (error) {
      logger.error('❌ Error programando anuncio:', error);
      throw error;
    }
  }

  /**
   * Obtener biblioteca de música de fondo disponible
   */
  async obtenerMusicaDisponible() {
    try {
      logger.dev('🎵 Obteniendo música disponible...');
      
      const { data, error } = await supabase
        .from('background_music_library')
        .select('*')
        .eq('activo', true)
        .order('nombre');
      
      if (error) {
        logger.error('❌ Error obteniendo música:', error);
        throw error;
      }
      
      logger.dev(`✅ ${data?.length || 0} pistas disponibles`);
      
      return data || [];
    } catch (error) {
      logger.error('❌ Error obteniendo música:', error);
      return [];
    }
  }

  /**
   * Obtener historial de anuncios generados
   */
  async obtenerHistorial(empresaId, limit = 50) {
    try {
      logger.dev('📜 Obteniendo historial de anuncios...');
      
      const { data, error } = await supabase
        .from('ai_generated_ads')
        .select(`
          *,
          contenido:contenidos(nombre, duracion_segundos, activo),
          creator:usuarios(username, email, nombre, apellidos)
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        logger.error('❌ Error obteniendo historial:', error);
        throw error;
      }
      
      logger.dev(`✅ ${data?.length || 0} anuncios en historial`);
      
      return data || [];
    } catch (error) {
      logger.error('❌ Error obteniendo historial:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas de anuncios generados
   */
  async obtenerEstadisticas(empresaId) {
    try {
      const { data, error } = await supabase
        .from('ai_generated_ads')
        .select('id, created_at, ai_provider')
        .eq('empresa_id', empresaId);
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const esteMes = data?.filter(ad => {
        const adDate = new Date(ad.created_at);
        const now = new Date();
        return adDate.getMonth() === now.getMonth() && 
               adDate.getFullYear() === now.getFullYear();
      }).length || 0;
      
      return {
        total,
        esteMes,
        providers: data?.reduce((acc, ad) => {
          acc[ad.ai_provider] = (acc[ad.ai_provider] || 0) + 1;
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas:', error);
      return { total: 0, esteMes: 0, providers: {} };
    }
  }
}

// Exportar singleton
export default new AIAdService();

