import { supabase } from './supabase'
import logger from './logger.js'

// 🔧 OPTIMIZACIÓN DISK I/O: Monitoreo de consultas lentas
const queryMonitor = {
  slowQueries: [],
  threshold: 1000, // 1 segundo
  
  logSlowQuery(queryName, duration, details = {}) {
    if (duration > this.threshold) {
      this.slowQueries.push({
        query: queryName,
        duration,
        timestamp: new Date().toISOString(),
        details
      });
      
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`🐌 Consulta lenta detectada: ${queryName} (${duration}ms)`, details);
      }
    }
  },
  
  getSlowQueries() {
    return this.slowQueries.slice(-10); // Últimas 10 consultas lentas
  }
};

// Helper para medir tiempo de consultas
const measureQuery = async (queryName, queryFn) => {
  const start = performance.now();
  try {
    const result = await queryFn();
    const duration = performance.now() - start;
    queryMonitor.logSlowQuery(queryName, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    queryMonitor.logSlowQuery(queryName, duration, { error: error.message });
    throw error;
  }
};

// Edge Functions
const EDGE_LOGIN_URL = 'https://nazlyvhndymalevkfpnl.supabase.co/functions/v1/login'
const EDGE_CHANGE_PASSWORD_URL = 'https://nazlyvhndymalevkfpnl.supabase.co/functions/v1/change-password'

// Funciones para gestión de usuarios con Supabase
export const userApi = {
  // Crear nuevo usuario en la tabla profiles
  async createUser(userData) {
    const { data, error } = await supabase
      .from('profiles')
      .insert([userData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Obtener usuario por ID
  async getUser(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  },

  // Actualizar usuario
  async updateUser(userId, userData) {
    const { data, error } = await supabase
      .from('profiles')
      .update(userData)
      .eq('id', userId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Verificar si el perfil está completo
  async checkProfileComplete(userId) {
    try {
      const user = await this.getUser(userId)
      const requiredFields = ['email', 'nombre', 'apellidos', 'telefono', 'nombre_comercial', 'sector']
      return requiredFields.every(field => user[field] && user[field].toString().trim() !== '')
    } catch (error) {
      return false
    }
  },

  // Heartbeat de presencia: marca última actividad del usuario
  async sendHeartbeat(userLike) {
    const isoNow = new Date().toISOString()
    // Usuario legacy en public.usuarios
    if (userLike?.legacy?.id) {
      try {
        const { error } = await supabase
          .from('usuarios')
          .update({ last_seen: isoNow })
          .eq('id', userLike.legacy.id)
        if (error) throw error
        return true
      } catch (e) {
        // Silenciar si la columna no existe o no hay permisos
        return false
      }
    }

    // Usuario Supabase en profiles
    if (userLike?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ last_seen: isoNow })
          .eq('id', userLike.id)
        if (error) throw error
        return true
      } catch (e) {
        return false
      }
    }

    return false
  }
}

// Funciones para gestión de canales con Supabase
export const channelsApi = {
  // 🔧 OPTIMIZACIÓN DISK I/O: Cache agresivo para reducir consultas a BD
  _channelsCache: {},
  _playlistsCache: {},
  _songsCache: {},
  
  // Función de diagnóstico para inspeccionar la tabla
  async inspectTable() {
    try {
      logger.dev('🔍 Inspeccionando estructura de la tabla canales...');
      
      // Intentar obtener un registro para ver qué columnas hay
      const { data, error } = await supabase
        .from('canales')
        .select('*')
        .limit(1)
      
      if (error) {
        logger.error('❌ Error al inspeccionar tabla:', error);
        return { error, columns: [] };
      }
      
      const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
      logger.dev('📋 Columnas disponibles en la tabla canales:', columns);
      
      return { data, columns, error: null };
    } catch (err) {
      logger.error('❌ Error en inspección:', err);
      return { error: err, columns: [] };
    }
  },

  // Obtener todos los canales
  async getAllChannels() {
    const { data, error } = await supabase
      .from('canales')
      .select('*')
      .order('id', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Obtener canal por ID
  async getChannel(channelId) {
    const { data, error } = await supabase
      .from('canales')
      .select('*')
      .eq('id', channelId)
      .single()
    
    if (error) throw error
    return data
  },

  // Crear nuevo canal
  async createChannel(channelData) {
    const { data, error } = await supabase
      .from('canales')
      .insert([channelData])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Actualizar canal
  async updateChannel(channelId, channelData) {
    const { data, error } = await supabase
      .from('canales')
      .update(channelData)
      .eq('id', channelId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Eliminar canal
  async deleteChannel(channelId) {
    const { data, error } = await supabase
      .from('canales')
      .delete()
      .eq('id', channelId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Obtener canales por tipo (si la columna tipo existe)
  async getChannelsByType(tipo) {
    const { data, error } = await supabase
      .from('canales')
      .select('*')
      .eq('tipo', tipo)
      .order('id', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Obtener canales activos asignados a un usuario específico
  async getUserActiveChannels(userId) {
    const { data, error } = await supabase
      .from('reproductor_usuario_canales')
      .select(`
        id,
        usuario_id,
        canal_id,
        activo,
        created_at,
        updated_at,
        canales (
          id,
          nombre,
          tipo,
          descripcion,
          stream_url,
          metadata,
          activo,
          created_at,
          updated_at
        )
      `)
      .eq('usuario_id', userId)
      .eq('activo', true)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Obtener todos los canales activos de usuarios (para administradores)
  async getAllUserChannels() {
    const { data, error } = await supabase
      .from('reproductor_usuario_canales')
      .select(`
        id,
        usuario_id,
        canal_id,
        activo,
        created_at,
        updated_at,
        canales (
          id,
          nombre,
          tipo,
          descripcion,
          stream_url,
          metadata,
          activo,
          created_at,
          updated_at
        )
      `)
      .eq('activo', true)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Asignar canal a usuario
  async assignChannelToUser(userId, channelId) {
    const { data, error } = await supabase
      .from('reproductor_usuario_canales')
      .insert([{
        usuario_id: userId,
        canal_id: channelId,
        activo: true
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Desactivar canal para usuario
  async deactivateUserChannel(userId, channelId) {
    const { data, error } = await supabase
      .from('reproductor_usuario_canales')
      .update({ activo: false })
      .eq('usuario_id', userId)
      .eq('canal_id', channelId)
      .select()
    
    if (error) throw error
    return data
  },

  // 🔧 NUEVO: Invalidar cache de canales (para cambios Realtime)
  invalidateChannelsCache(userId) {
    if (!userId) {
      // Si no se especifica userId, limpiar todo el cache
      this._channelsCache = {};
      logger.dev('🗑️ Cache de canales completamente invalidado');
      return;
    }
    
    const cacheKey = `channels_${userId}`;
    if (this._channelsCache?.[cacheKey]) {
      delete this._channelsCache[cacheKey];
      logger.dev('🗑️ Cache de canales invalidado para usuario:', userId);
    }
  },

  // Cargar canales activos del usuario según jerarquía (usuario, grupo, empresa, genéricos)
  async getUserActiveChannelsHierarchy(userId, forceRefresh = false) {
    // 🔧 OPTIMIZACIÓN DISK I/O: Cache agresivo para reducir consultas a BD
    const cacheKey = `channels_${userId}`;
    const cacheTime = 10 * 60 * 1000; // 10 minutos para reducir I/O
    const cached = this._channelsCache?.[cacheKey];
    
    // Si se fuerza refresco, invalidar cache primero
    if (forceRefresh && cached) {
      delete this._channelsCache[cacheKey];
      logger.dev('🔄 Cache invalidado - forzando refresco de canales');
    }
    
    if (cached && (Date.now() - cached.timestamp) < cacheTime && !forceRefresh) {
      if (process.env.NODE_ENV === 'development') {
        logger.dev('⚡ Canales obtenidos desde cache');
      }
      return cached.data;
    }

    const canalesActivos = [];

    try {
      if (process.env.NODE_ENV === 'development') {
        logger.dev('🔍 Cargando canales para usuario:', userId);
      }
      
      // 🔧 OPTIMIZACIÓN: Consulta única con JOINs para obtener todos los datos
      // 🔑 CRÍTICO: Buscar por auth_user_id (usuarios de Supabase Auth) o por id (usuarios legacy)
      // Primero intentamos por auth_user_id, si falla intentamos por id
      let usuario = null;
      let errorUsuarioData = null;
      
      // Intentar buscar por auth_user_id primero (usuarios nuevos de Supabase Auth)
      const { data: usuarioByAuth, error: errorByAuth } = await measureQuery(
        'getUserActiveChannelsHierarchy:byAuthId',
        () => supabase
          .from('usuarios')
          .select(`
            id,
            grupo_id,
            empresa_id,
            es_usuario_ia,
            usuario_canales (
              canal_id,
              canales!inner(id, nombre, descripcion, imagen_url)
            ),
            grupos (
              grupo_canales (
                canal_id,
                canales!inner(id, nombre, descripcion, imagen_url)
              )
            ),
            empresas (
              empresa_canales (
                canal_id,
                canales!inner(id, nombre, descripcion, imagen_url)
              )
            )
          `)
          .eq('auth_user_id', userId)
          .maybeSingle()
      );
      
      if (usuarioByAuth) {
        usuario = usuarioByAuth;
        logger.dev('✅ Usuario encontrado por auth_user_id');
      } else {
        // Si no encuentra por auth_user_id, intentar por id (usuarios legacy)
        const { data: usuarioById, error: errorById } = await measureQuery(
          'getUserActiveChannelsHierarchy:byId',
          () => supabase
            .from('usuarios')
            .select(`
              id,
              grupo_id,
              empresa_id,
              es_usuario_ia,
              usuario_canales (
                canal_id,
                canales!inner(id, nombre, descripcion, imagen_url)
              ),
              grupos (
                grupo_canales (
                  canal_id,
                  canales!inner(id, nombre, descripcion, imagen_url)
                )
              ),
              empresas (
                empresa_canales (
                  canal_id,
                  canales!inner(id, nombre, descripcion, imagen_url)
                )
              )
            `)
            .eq('id', userId)
            .maybeSingle()
        );
        
        if (usuarioById) {
          usuario = usuarioById;
          logger.dev('✅ Usuario encontrado por id (legacy)');
        } else {
          errorUsuarioData = errorById || errorByAuth || { message: 'Usuario no encontrado' };
        }
      }

      if (errorUsuarioData) {
        logger.error('❌ Error obteniendo datos usuario:', errorUsuarioData);
        return [];
      }

      // 🔧 OPTIMIZACIÓN: Consulta paralela para canales genéricos e IA
      // 🔑 CRÍTICO: Usar usuario.id (ID de tabla usuarios) para reproductor_usuario_canales
      const usuarioIdReal = usuario.id;
      
      const [canalesGenericosResult, canalesIAIdsResult, canalesActivosReproductorResult] = await Promise.all([
        supabase
          .from('canales_genericos')
          .select(`
            canal_id,
            canales!inner(id, nombre, descripcion, imagen_url)
          `)
          .eq('is_generic', true),
        // 🤖 NUEVO: Primero obtener solo los IDs de canales IA
        supabase
          .from('canales_ia')
          .select('canal_id')
          .eq('is_ia', true),
        supabase
          .from('reproductor_usuario_canales')
          .select('canal_id, activo')
          .eq('usuario_id', usuarioIdReal)
      ]);

      // Procesar resultados iniciales
      const canalesUsuario = usuario?.usuario_canales || [];
      const canalesGrupo = usuario?.grupos?.grupo_canales || [];
      const canalesEmpresa = usuario?.empresas?.empresa_canales || [];
      const canalesGenericos = canalesGenericosResult.data || [];
      const canalesActivosReproductor = canalesActivosReproductorResult.data || [];

      // 🤖 NUEVO: Obtener detalles completos de canales IA
      let canalesIA = [];
      const canalesIAIds = canalesIAIdsResult.data || [];
      
      logger.dev('🤖 DEBUG - IDs de canales IA obtenidos:', canalesIAIds.length);
      
      if (canalesIAIds.length > 0) {
        const idsArray = canalesIAIds.map(c => c.canal_id);
        logger.dev('🤖 DEBUG - IDs:', idsArray);
        
        // Obtener detalles completos de los canales
        const { data: detallesCanalesIA, error: errorDetallesIA } = await supabase
          .from('canales')
          .select('id, nombre, descripcion, imagen_url')
          .in('id', idsArray);
        
        if (errorDetallesIA) {
          logger.error('❌ DEBUG - Error obteniendo detalles canales IA:', errorDetallesIA);
        } else {
          // Mapear a la estructura esperada
          canalesIA = (detallesCanalesIA || []).map(canal => ({
            canal_id: canal.id,
            canales: canal
          }));
          logger.dev('🤖 DEBUG - Detalles de canales IA obtenidos:', canalesIA.length);
        }
      }
      
      logger.dev('🎯 DEBUG - Canales activos reproductor:', canalesActivosReproductor.length);

      // Crear mapa de canales activos del reproductor
      const mapaActivos = new Map();
      canalesActivosReproductor.forEach(item => {
        mapaActivos.set(item.canal_id, item.activo);
      });

      // 🤖 CRÍTICO: Verificar si el usuario es de tipo IA
      const esUsuarioIA = usuario.es_usuario_ia === true;
      logger.dev('🤖 DEBUG - Usuario es IA:', esUsuarioIA);

      // Combinar canales según el tipo de usuario
      let todosLosCanales;
      
      if (esUsuarioIA) {
        // 🤖 Usuario IA: SOLO usar los canales de reproductor_usuario_canales (que son canales IA)
        // NO mezclar con canales genéricos
        logger.dev('🤖 Usuario IA detectado - usando SOLO canales de reproductor_usuario_canales');
        todosLosCanales = canalesIA.map(c => ({ ...c, origen: 'ia' }));
      } else {
        // Usuario normal: combinar todos los canales (genéricos, empresa, grupo, usuario)
        todosLosCanales = [
          ...canalesUsuario.map(c => ({ ...c, origen: 'usuario' })),
          ...canalesGrupo.map(c => ({ ...c, origen: 'grupo' })),
          ...canalesEmpresa.map(c => ({ ...c, origen: 'empresa' })),
          ...canalesGenericos.map(c => ({ ...c, origen: 'generico' })),
          ...canalesIA.map(c => ({ ...c, origen: 'ia' }))
        ];
      }

      // 🔍 DEBUG: Ver todos los canales antes del filtrado
      logger.dev('📦 DEBUG - Total canales combinados:', todosLosCanales.length);
      logger.dev('🔑 DEBUG - Mapa de canales activos:', Array.from(mapaActivos.entries()));

      // Filtrar solo los que están activos y deduplicar
      const unicosMap = new Map();
      for (const canal of todosLosCanales) {
        const estaActivo = mapaActivos.get(canal.canal_id);
        
        // 🤖 Para usuarios IA: solo incluir si está EXPLÍCITAMENTE en reproductor_usuario_canales
        // Para usuarios normales: incluir si no está explícitamente desactivado
        const incluirCanal = esUsuarioIA 
          ? estaActivo === true  // IA: debe estar explícitamente activo
          : estaActivo !== false; // Normal: incluir si no está explícitamente inactivo
        
        if (incluirCanal && !unicosMap.has(canal.canal_id)) {
          unicosMap.set(canal.canal_id, {
            id: canal.canal_id,
            nombre: canal.canales.nombre,
            descripcion: canal.canales.descripcion,
            imagen_url: canal.canales.imagen_url,
            origen: canal.origen,
            activo_usuario: estaActivo === true
          });
        }
      }

      const canalesActivosUnicos = Array.from(unicosMap.values());

      // 🔍 DEBUG: Ver canales finales por origen
      const canalesPorOrigen = canalesActivosUnicos.reduce((acc, canal) => {
        acc[canal.origen] = (acc[canal.origen] || 0) + 1;
        return acc;
      }, {});
      logger.dev('📊 DEBUG - Canales por origen:', canalesPorOrigen);
      logger.dev('📋 DEBUG - Canales finales:', canalesActivosUnicos.map(c => ({ nombre: c.nombre, origen: c.origen })));

      // 🔧 OPTIMIZACIÓN: Guardar en cache
      if (!this._channelsCache) this._channelsCache = {};
      this._channelsCache[cacheKey] = {
        data: canalesActivosUnicos,
        timestamp: Date.now()
      };

      logger.dev('✅ Canales cargados:', canalesActivosUnicos.length);
      return canalesActivosUnicos;

    } catch (error) {
      logger.error('❌ Error cargando canales activos:', error);
      return [];
    }
  }
}

// Funciones para gestión de playlists
export const playlistsApi = {
  // 🔧 OPTIMIZACIÓN DISK I/O: Cache para playlists
  _playlistsCache: {},
  
  // Obtener todas las playlists de un canal
  async getChannelPlaylists(canalId) {
    // Cache para reducir consultas a BD
    const cacheKey = `playlists_${canalId}`;
    const cacheTime = 5 * 60 * 1000; // 5 minutos
    const cached = this._playlistsCache?.[cacheKey];
    
    if (cached && (Date.now() - cached.timestamp) < cacheTime) {
      if (process.env.NODE_ENV === 'development') {
        logger.dev('⚡ Playlists obtenidas desde cache');
      }
      return cached.data;
    }
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('canal_id', canalId)
      .eq('activa', true)
      .order('peso', { ascending: false }) // Mayor peso = mayor prioridad
    
    if (error) throw error
    
    // Guardar en cache
    this._playlistsCache[cacheKey] = {
      data: data || [],
      timestamp: Date.now()
    };
    
    return data || []
  },

  // Obtener playlists activas según horario y configuración
  // NOTA: El filtrado de fechas (fecha_activa_desde/fecha_activa_hasta) y 
  // franjas horarias (activa_desde/activa_hasta) se realiza en el lado del cliente
  // mediante la función isInActiveTimeFrame en autoDjService.js
  async getActivePlaylists(canalId, currentTime = new Date()) {
    const currentTimeString = currentTime.toTimeString().split(' ')[0]; // HH:MM:SS
    const currentDate = currentTime.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Obtener todas las playlists activas del canal
    // El filtrado por fecha y hora se hace después en el cliente
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('canal_id', canalId)
      .eq('activa', true)
      .order('peso', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Obtener playlist por ID
  async getPlaylist(playlistId) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .single()
    
    if (error) throw error
    return data
  },

  // Obtener playlists por tipo
  async getPlaylistsByType(canalId, tipo) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('canal_id', canalId)
      .eq('tipo', tipo)
      .eq('activa', true)
      .order('peso', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Obtener playlists agendadas para una hora específica
  async getScheduledPlaylists(canalId, targetTime) {
    const timeString = targetTime.toTimeString().split(' ')[0];
    const dateString = targetTime.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('canal_id', canalId)
      .eq('tipo', 'agendada')
      .eq('activa', true)
      .or(`fecha.is.null,fecha.eq.${dateString}`)
      .or(`hora.is.null,hora.eq.${timeString}`)
      .order('peso', { ascending: false })
    
    if (error) throw error
    return data || []
  }
}

// Funciones para gestión de canciones 
export const songsApi = {
  // 🔧 OPTIMIZACIÓN DISK I/O: Cache para canciones
  _songsCache: {},
  
  // Obtener canciones de una playlist con estructura real
  async getPlaylistSongs(playlistId) {
    // Cache para reducir consultas a BD
    const cacheKey = `songs_${playlistId}`;
    const cacheTime = 3 * 60 * 1000; // 3 minutos (más corto por cambios frecuentes)
    const cached = this._songsCache?.[cacheKey];
    
    if (cached && (Date.now() - cached.timestamp) < cacheTime) {
      if (process.env.NODE_ENV === 'development') {
        logger.dev('⚡ Canciones obtenidas desde cache');
      }
      return cached.data;
    }
    const { data, error } = await supabase
      .from('playlist_canciones')
      .select(`
        id,
        playlist_id,
        cancion_id,
        posicion,
        peso,
        created_at,
        canciones (
          id,
          nombre,
          artista,
          genero,
          duracion,
          duration_ms,
          url_s3,
          s3_key,
          titulo,
          upload_date,
          bpm,
          estilo_musical,
          mood,
          release_date,
          created_by
        )
      `)
      .eq('playlist_id', playlistId)
      .order('posicion', { ascending: true })
    
    if (error) throw error
    
    // Guardar en cache
    this._songsCache[cacheKey] = {
      data: data || [],
      timestamp: Date.now()
    };
    
    return data || []
  },

  // Obtener canción por ID
  async getSong(songId) {
    const { data, error } = await supabase
      .from('canciones')
      .select('*')
      .eq('id', songId)
      .single()
    
    if (error) throw error
    return data
  },

  // ✅ NUEVO MODELO: Obtener canciones de un canal vía playlists
  async getChannelSongs(canalId) {
    try {
      // Obtener todas las playlists del canal
      const playlists = await playlistsApi.getChannelPlaylists(canalId);
      
      if (!playlists || playlists.length === 0) {
        logger.dev('ℹ️ No hay playlists para el canal:', canalId);
        return [];
      }
      
      // Obtener todas las canciones de todas las playlists del canal
      const allSongs = [];
      const songIds = new Set(); // Para evitar duplicados
      
      for (const playlist of playlists) {
        const playlistSongs = await this.getPlaylistSongs(playlist.id);
        
        playlistSongs.forEach(playlistSong => {
          const songId = playlistSong?.canciones?.id;
          if (songId && !songIds.has(songId)) {
            songIds.add(songId);
            allSongs.push(playlistSong.canciones);
          }
        });
      }
      
      logger.dev(`✅ Canciones del canal ${canalId} obtenidas vía playlists:`, allSongs.length);
      return allSongs;
      
    } catch (error) {
      logger.error('❌ Error obteniendo canciones del canal:', error);
      return [];
    }
  },

  // ✅ NUEVO MODELO: Buscar canciones globales (sin filtro por canal)
  async searchSongs(searchText, canalId = null) {
    try {
      // Búsqueda global en todas las canciones
      const { data, error } = await supabase
        .from('canciones')
        .select('*')
        .or(`titulo.ilike.%${searchText}%,artista.ilike.%${searchText}%`)
        .order('upload_date', { ascending: false })
      
      if (error) throw error
      
      // Si se especifica un canal, filtrar por playlists de ese canal
      if (canalId && data && data.length > 0) {
        logger.dev(`🔍 Filtrando resultados de búsqueda para canal: ${canalId}`);
        
        // Obtener IDs de canciones que están en playlists del canal
        const channelSongIds = await this.getChannelSongIds(canalId);
        
        // Filtrar solo las canciones que están en el canal
        const filteredData = data.filter(song => channelSongIds.has(song.id));
        
        logger.dev(`📊 Búsqueda filtrada: ${data.length} → ${filteredData.length} canciones`);
        return filteredData;
      }
      
      return data || [];
      
    } catch (error) {
      logger.error('❌ Error en búsqueda de canciones:', error);
      return [];
    }
  },

  // Helper: Obtener IDs de canciones que pertenecen a un canal
  async getChannelSongIds(canalId) {
    try {
      const { data, error } = await supabase
        .from('playlist_canciones')
        .select(`
          cancion_id,
          playlists!inner(canal_id)
        `)
        .eq('playlists.canal_id', canalId);
      
      if (error) throw error;
      
      const songIds = new Set(data?.map(item => item.cancion_id) || []);
      return songIds;
      
    } catch (error) {
      logger.error('❌ Error obteniendo IDs de canciones del canal:', error);
      return new Set();
    }
  }
}

// Funciones para gestión de contenidos asignados
export const contentAssignmentsApi = {
  // Función de inspección para ver qué columnas están disponibles
  async inspectContentAssignmentsTable() {
    try {
      logger.dev('🔍 Inspeccionando tabla contenido_asignaciones...');
      
      const { data, error } = await supabase
        .from('contenido_asignaciones')
        .select('*')
        .limit(1)
      
      if (error) {
        logger.error('❌ Error inspeccionando tabla:', error);
        return { error, columns: [] };
      }
      
      const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
      logger.dev('📋 Columnas disponibles en contenido_asignaciones:', columns);
      
      return { data, columns, error: null };
    } catch (err) {
      logger.error('❌ Error en inspección:', err);
      return { error: err, columns: [] };
    }
  },

  // Obtener contenidos asignados a un usuario específico con información completa
  async getUserAssignedContent(userId) {
    try {
      logger.dev('🔍 Consultando contenidos asignados para usuario:', userId);
      
      if (!userId) {
        logger.warn('⚠️ No se proporcionó userId');
        return [];
      }
      
      // Usar consulta muy básica para evitar errores de columnas
      const { data, error } = await supabase
        .from('contenido_asignaciones')
        .select(`
          *,
          contenidos (
            id,
            nombre,
            tipo_contenido,
            url_s3,
            duracion_segundos,
            formato_audio,
            metadata,
            activo
          ),
          canales (
            id,
            nombre,
            descripcion
          )
        `)
        .eq('usuario_id', userId)
        .eq('activo', true)
      
      if (error) {
        logger.error('❌ Error en getUserAssignedContent:', error);
        
        // Fallback: consulta sin JOINs
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('contenido_asignaciones')
          .select('*')
          .eq('usuario_id', userId)
          .eq('activo', true)
        
        if (fallbackError) {
          logger.error('❌ Error en consulta fallback:', fallbackError);
          return [];
        }
        
        logger.dev('✅ Usando datos fallback:', fallbackData?.length || 0);
        return fallbackData || [];
      }
      
      logger.dev('✅ Contenidos asignados obtenidos:', data?.length || 0);
      return data || [];
      
    } catch (err) {
      logger.error('❌ Error general en getUserAssignedContent:', err);
      return [];
    }
  },

  // 🔧 NUEVO: Obtener contenidos de programaciones activas del usuario
  async getUserProgrammingContent(userId) {
    try {
      logger.dev('🔍 Consultando contenidos de programaciones (activas/pausadas/completadas) para userId:', userId);
      
      if (!userId) {
        logger.warn('⚠️ No se proporcionó userId');
        return [];
      }

      // 🔧 PASO 0: Determinar el usuario_id correcto
      // El userId puede ser:
      // - auth_user_id (usuarios nuevos de Supabase Auth)
      // - usuario_id (usuarios legacy sin auth_user_id)
      // Intentamos primero buscar por auth_user_id, si no se encuentra, usamos userId directamente
      let usuarioId = userId;

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      if (!usuarioError && usuarioData) {
        // Encontramos el usuario por auth_user_id → usar su id de la tabla usuarios
        usuarioId = usuarioData.id;
        logger.dev('✅ usuario_id encontrado desde auth_user_id:', usuarioId);
      } else {
        // No se encontró por auth_user_id → asumir que userId ya es el usuario_id (legacy)
        logger.dev('ℹ️ Usando userId directamente (usuario legacy):', userId);
      }

      // Paso 1: Obtener programaciones activas, pausadas Y completadas del usuario
      const { data: programaciones, error: progError } = await supabase
        .from('programacion_destinatarios')
        .select(`
          programacion_id,
          programaciones!inner (
            id,
            descripcion,
            tipo,
            estado,
            fecha_inicio,
            fecha_fin,
            modo_audio,
            frecuencia_minutos,
            esperar_fin_cancion,
            hora_inicio,
            hora_fin,
            daily_mode,
            cada_dias,
            rango_desde,
            rango_hasta,
            hora_una_vez_dia,
            weekly_mode,
            weekly_days,
            weekly_rango_desde,
            weekly_rango_hasta,
            weekly_hora_una_vez,
            annual_date,
            annual_time
          )
        `)
        .eq('usuario_id', usuarioId)
        .in('programaciones.estado', ['activo', 'pausado', 'completado']);

      if (progError) {
        logger.error('❌ Error obteniendo programaciones:', progError);
        return [];
      }

      if (!programaciones || programaciones.length === 0) {
        logger.dev('ℹ️ No hay programaciones activas/pausadas/completadas para este usuario');
        return [];
      }

      const activas = programaciones.filter(p => p.programaciones.estado === 'activo').length;
      const pausadas = programaciones.filter(p => p.programaciones.estado === 'pausado').length;
      const completadas = programaciones.filter(p => p.programaciones.estado === 'completado').length;
      logger.dev(`✅ ${programaciones.length} programaciones encontradas (${activas} activas, ${pausadas} pausadas, ${completadas} completadas)`);

      // Paso 2: Obtener IDs de programaciones
      const programacionIds = programaciones.map(p => p.programacion_id);

      // Paso 3: Obtener contenidos de esas programaciones
      const { data: contenidos, error: contentError } = await supabase
        .from('programacion_contenidos')
        .select(`
          id,
          programacion_id,
          contenido_id,
          orden,
          activo,
          contenidos!inner (
            id,
            nombre,
            tipo_contenido,
            url_s3,
            duracion_segundos,
            formato_audio,
            metadata,
            activo,
            etiquetas
          )
        `)
        .in('programacion_id', programacionIds)
        .eq('activo', true)
        .eq('contenidos.activo', true)
        .order('orden', { ascending: true });

      if (contentError) {
        logger.error('❌ Error obteniendo contenidos:', contentError);
        return [];
      }

      logger.dev(`✅ ${contenidos?.length || 0} contenidos obtenidos de programaciones activas/pausadas`);

      // Enriquecer con información de programación
      const contentosEnriquecidos = contenidos.map(c => ({
        ...c,
        programacion_info: programaciones.find(p => p.programacion_id === c.programacion_id)?.programaciones
      }));

      return contentosEnriquecidos || [];

    } catch (err) {
      logger.error('❌ Error general en getUserProgrammingContent:', err);
      return [];
    }
  },

  // Obtener contenidos asignados por canal
  async getChannelAssignedContent(canalId, userId = null) {
    let query = supabase
      .from('contenido_asignaciones')
      .select(`
        id,
        usuario_id,
        contenido_id,
        tipo_contenido,
        canal_id,
        activo,
        fecha_inicio,
        fecha_fin,
        prioridad,
        configuracion,
        created_at,
        updated_at
      `)
      .eq('canal_id', canalId)
      .eq('activo', true)

    if (userId) {
      query = query.eq('usuario_id', userId)
    }

    const { data, error } = await query
      .order('prioridad', { ascending: false })
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Obtener contenidos asignados por tipo
  async getAssignedContentByType(userId, tipoContenido) {
    const { data, error } = await supabase
      .from('contenido_asignaciones')
      .select(`
        id,
        usuario_id,
        contenido_id,
        tipo_contenido,
        canal_id,
        activo,
        fecha_inicio,
        fecha_fin,
        prioridad,
        configuracion,
        created_at,
        updated_at,
        canales (
          id,
          nombre,
          tipo,
          descripcion
        )
      `)
      .eq('usuario_id', userId)
      .eq('tipo_contenido', tipoContenido)
      .eq('activo', true)
      .order('prioridad', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Asignar contenido a usuario
  async assignContentToUser(assignment) {
    const { data, error } = await supabase
      .from('contenido_asignaciones')
      .insert([{
        usuario_id: assignment.userId,
        contenido_id: assignment.contentId,
        tipo_contenido: assignment.contentType,
        canal_id: assignment.channelId,
        activo: true,
        fecha_inicio: assignment.startDate || null,
        fecha_fin: assignment.endDate || null,
        prioridad: assignment.priority || 1,
        configuracion: assignment.configuration || {}
      }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Desactivar asignación de contenido
  async deactivateContentAssignment(assignmentId) {
    const { data, error } = await supabase
      .from('contenido_asignaciones')
      .update({ activo: false })
      .eq('id', assignmentId)
      .select()
    
    if (error) throw error
    return data
  },

  // Obtener contenidos activos para un canal y usuario en un momento específico
  async getActiveContentForChannelAndUser(canalId, userId, currentDate = new Date()) {
    const currentDateString = currentDate.toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('contenido_asignaciones')
      .select(`
        id,
        usuario_id,
        contenido_id,
        tipo_contenido,
        canal_id,
        activo,
        fecha_inicio,
        fecha_fin,
        prioridad,
        configuracion,
        created_at,
        updated_at
      `)
      .eq('canal_id', canalId)
      .eq('usuario_id', userId)
      .eq('activo', true)
      .or(`fecha_inicio.is.null,fecha_inicio.lte.${currentDateString}`)
      .or(`fecha_fin.is.null,fecha_fin.gte.${currentDateString}`)
      .order('prioridad', { ascending: false })
    
    if (error) throw error
    return data || []
  }
}

// Funciones para autenticación
export const authApi = {
  // Helper para construir redirectTo con basePath
  getAuthRedirectUrl(pathname) {
    if (typeof window === 'undefined') return pathname;
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const fullPath = base === '' ? path : `${base}${path}`;
    return `${window.location.origin}${fullPath}`;
  },
  // Login con email/password
  async signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    return data
  },

  // Registro con email/password
  async signUpWithEmail(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) throw error
    return data
  },

  // Login con Google
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // ✅ En producción, redirigir a /login para procesar tokens OAuth
        redirectTo: authApi.getAuthRedirectUrl('/login')
      }
    })
    if (error) throw error
    return data
  },

  // Login con Apple
  async signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        // ✅ En producción, redirigir a /login para procesar tokens OAuth
        redirectTo: authApi.getAuthRedirectUrl('/login')
      }
    })
    if (error) throw error
    return data
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Login legacy edge
  async signInLegacyEdge(username, password) {
    // Obtener la anon key de Supabase
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    
    const response = await fetch(EDGE_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey, // ✅ Requerido para Edge Functions
        'Authorization': `Bearer ${supabaseAnonKey}`, // ✅ También requerido
      },
      body: JSON.stringify({ username, password }),
    });


    if (!response.ok) {
      // Intentar obtener el mensaje de error del response
      let errorMessage = `Edge login failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // Si no se puede parsear el JSON, usar el mensaje por defecto
      }
      
      const error = new Error(errorMessage);
      error.code = 'edge_login_failed';
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    return data;
  },

  // Cambiar contraseña legacy edge
  async changePasswordLegacyEdge(username, currentPassword, newPassword, skipCurrentPasswordCheck = false) {
    // Obtener la anon key de Supabase
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    const response = await fetch(EDGE_CHANGE_PASSWORD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey, // ✅ Requerido para Edge Functions
        'Authorization': `Bearer ${supabaseAnonKey}`, // ✅ También requerido
      },
      body: JSON.stringify({ username, currentPassword, newPassword, skipCurrentPasswordCheck }),
    });

    if (!response.ok) {
      // Intentar obtener el mensaje de error del response
      let errorMessage = `Cambio de contraseña falló con status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // Si no se puede parsear el JSON, usar el mensaje por defecto
      }
      
      const error = new Error(errorMessage);
      error.code = 'change_password_failed';
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    return data;
  }
}

// RPCs de presencia del reproductor
export const presenceApi = {
  async authorizePlayer({ authUserId = null, username = null, password = null }) {
    const { data, error } = await supabase.rpc('fn_reproductor_autorizacion', {
      p_auth_user_id: authUserId,
      p_username: username,
      p_password: password
    })
    if (error) throw error
    return data
  },

  async sendHeartbeat({ usuarioId, status = null, version = null, location = null, metrics = null, deviceInfo = null, deviceId = null, channel = null, song = null, artist = null }) {
    // V2: incluye device_id y app_version
    const finalDeviceId = deviceId || (typeof window !== 'undefined') ?
      (localStorage.getItem('ondeon_device_id') || (localStorage.setItem('ondeon_device_id', crypto.randomUUID()), localStorage.getItem('ondeon_device_id'))) :
      'default'

    // Usar la función RPC v2 si hay datos adicionales, sino usar la v1
    if (location || metrics || deviceInfo || channel || song || artist) {
      const { data, error } = await supabase.rpc('fn_reproductor_heartbeat_v2', {
        p_usuario_id: usuarioId,
        p_device_id: finalDeviceId,
        p_status: status,
        p_app_version: version,
        p_location: location,
        p_metrics: metrics,
        p_device_info: deviceInfo,
        p_channel: channel,
        p_song: song,
        p_artist: artist
      })
      if (error) throw error
      return data
    } else {
      // Fallback a la función original
      const { data, error } = await supabase.rpc('fn_reproductor_heartbeat', {
        p_usuario_id: usuarioId,
        p_device_id: finalDeviceId,
        p_status: status,
        p_app_version: version,
        p_ip: null
      })
      if (error) throw error
      return data
    }
  },

  // 🔐 SISTEMA DE SESIÓN ÚNICA: Iniciar nueva sesión cerrando las previas
  async startSingleSession({ usuarioId, deviceId, deviceInfo = null, appVersion = null }) {
    const { data, error } = await supabase.rpc('start_single_session', {
      p_usuario_id: usuarioId,
      p_device_id: deviceId,
      p_device_info: deviceInfo,
      p_app_version: appVersion
    })
    
    if (error) {
      logger.error('❌ Error iniciando sesión única:', error);
      throw error;
    }
    
    logger.dev('✅ Sesión única iniciada:', data);
    return data;
  },

  // 🔐 Cerrar sesiones previas de un usuario
  async closePreviousSessions({ usuarioId, newDeviceId = null, keepSessionId = null }) {
    const { data, error } = await supabase.rpc('close_previous_user_sessions', {
      p_usuario_id: usuarioId,
      p_new_device_id: newDeviceId,
      p_keep_session_id: keepSessionId
    })
    
    if (error) {
      logger.error('❌ Error cerrando sesiones previas:', error);
      throw error;
    }
    
    logger.dev('✅ Sesiones previas cerradas:', data);
    return data;
  },

  // 🔐 Verificar si el dispositivo tiene sesión activa
  async checkDeviceSession({ usuarioId, deviceId }) {
    const { data, error } = await supabase.rpc('check_device_session', {
      p_usuario_id: usuarioId,
      p_device_id: deviceId
    })
    
    if (error) {
      logger.error('❌ Error verificando sesión del dispositivo:', error);
      throw error;
    }
    
    return data;
  }
}

export default { userApi, channelsApi, playlistsApi, songsApi, contentAssignmentsApi, authApi, presenceApi }