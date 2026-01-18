import { supabase } from './supabase'
import logger from './logger.js'

// ============================================================================
// ONDEON SMART v2 - API CLIENT
// ============================================================================
// Interfaz simplificada usando funciones RPC del nuevo esquema.
// Todas las queries complejas están encapsuladas en el backend.
// ============================================================================

// 🔧 Monitor de consultas lentas (opcional, para desarrollo)
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
      
      if (import.meta.env.DEV) {
        logger.warn(`🐌 Consulta lenta detectada: ${queryName} (${duration}ms)`, details);
      }
    }
  },
  
  getSlowQueries() {
    return this.slowQueries.slice(-10);
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

// ============================================================================
// INIT API - Inicialización del usuario
// ============================================================================

export const initApi = {
  /**
   * Obtiene todos los datos iniciales del usuario al login.
   * Incluye: usuario, sector, canales_recomendados, programaciones_activas
   */
  async getUserInit() {
    const { data, error } = await measureQuery('rpc_get_user_init', () =>
      supabase.rpc('rpc_get_user_init')
    );
    
    if (error) {
      logger.error('❌ Error en rpc_get_user_init:', error);
      throw error;
    }
    
    // El RPC puede devolver un objeto con error si el usuario no existe
    if (data?.error) {
      const err = new Error(data.error);
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    
    logger.dev('✅ Datos iniciales del usuario obtenidos');
    return data;
  }
};

// ============================================================================
// CHANNELS API - Gestión de canales
// ============================================================================

export const channelsApi = {
  // Cache para canales
  _cache: {
    allChannels: null,
    channelData: {},
    timestamp: 0
  },
  _cacheTime: 5 * 60 * 1000, // 5 minutos
  
  /**
   * Obtiene todos los canales activos con indicador de recomendación.
   * Usa rpc_get_all_canales
   */
  async getAllChannels(forceRefresh = false) {
    // Verificar cache
    if (!forceRefresh && 
        this._cache.allChannels && 
        (Date.now() - this._cache.timestamp) < this._cacheTime) {
      logger.dev('⚡ Canales obtenidos desde cache');
      return this._cache.allChannels;
    }
    
    const { data, error } = await measureQuery('rpc_get_all_canales', () =>
      supabase.rpc('rpc_get_all_canales')
    );
    
    if (error) {
      logger.error('❌ Error en rpc_get_all_canales:', error);
      throw error;
    }
    
    if (data?.error) {
      const err = new Error(data.error);
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }
    
    // Guardar en cache
    const canales = data?.canales || [];
    this._cache.allChannels = canales;
    this._cache.timestamp = Date.now();
    
    logger.dev(`✅ ${canales.length} canales obtenidos`);
    return canales;
  },
  
  /**
   * Obtiene los datos completos de un canal (playlists + canciones).
   * Usa rpc_get_canal_data
   */
  async getChannelData(canalId, forceRefresh = false) {
    if (!canalId) {
      logger.warn('⚠️ getChannelData llamado sin canalId');
      return null;
    }
    
    // Verificar cache
    const cacheKey = `channel_${canalId}`;
    const cached = this._cache.channelData[cacheKey];
    if (!forceRefresh && cached && (Date.now() - cached.timestamp) < this._cacheTime) {
      logger.dev('⚡ Datos del canal obtenidos desde cache');
      return cached.data;
    }
    
    const { data, error } = await measureQuery('rpc_get_canal_data', () =>
      supabase.rpc('rpc_get_canal_data', { p_canal_id: canalId })
    );
    
    if (error) {
      logger.error('❌ Error en rpc_get_canal_data:', error);
      throw error;
    }
    
    if (data?.error) {
      const err = new Error(data.error);
      err.code = 'CHANNEL_NOT_FOUND';
      throw err;
    }
    
    // Guardar en cache
    this._cache.channelData[cacheKey] = {
      data: data,
      timestamp: Date.now()
    };
    
    logger.dev(`✅ Datos del canal ${canalId} obtenidos`);
    return data;
  },
  
  /**
   * Invalida el cache de canales
   */
  invalidateCache(canalId = null) {
    if (canalId) {
      delete this._cache.channelData[`channel_${canalId}`];
      logger.dev(`🗑️ Cache del canal ${canalId} invalidado`);
    } else {
      this._cache = { allChannels: null, channelData: {}, timestamp: 0 };
      logger.dev('🗑️ Cache de canales completamente invalidado');
    }
  }
};

// ============================================================================
// PLAYLISTS API - Gestión de playlists
// ============================================================================

export const playlistsApi = {
  _cache: {},
  _cacheTime: 3 * 60 * 1000, // 3 minutos
  
  /**
   * Obtiene las playlists de un canal.
   * Usa los datos de rpc_get_canal_data si están disponibles.
   */
  async getChannelPlaylists(canalId) {
    // Intentar obtener desde channelsApi
    try {
      const channelData = await channelsApi.getChannelData(canalId);
      if (channelData?.playlists) {
        logger.dev('⚡ Playlists obtenidas desde canal data');
        return channelData.playlists;
      }
    } catch (e) {
      logger.dev('ℹ️ Fallback a query directa de playlists');
    }
    
    // Fallback: query directa (si es necesario por compatibilidad)
    const cacheKey = `playlists_${canalId}`;
    const cached = this._cache[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < this._cacheTime) {
      return cached.data;
    }
    
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('canal_id', canalId)
      .eq('activa', true)
      .order('peso', { ascending: false });
    
    if (error) throw error;
    
    this._cache[cacheKey] = { data: data || [], timestamp: Date.now() };
    return data || [];
  },
  
  /**
   * Obtiene una playlist por ID
   */
  async getPlaylist(playlistId) {
    const { data, error } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Invalida cache de playlists
   */
  invalidateCache(canalId = null) {
    if (canalId) {
      delete this._cache[`playlists_${canalId}`];
    } else {
      this._cache = {};
    }
  }
};

// ============================================================================
// SONGS API - Gestión de canciones
// ============================================================================

export const songsApi = {
  _cache: {},
  _cacheTime: 3 * 60 * 1000,
  
  /**
   * Obtiene las canciones de una playlist.
   * Intenta usar datos de rpc_get_canal_data si están disponibles.
   */
  async getPlaylistSongs(playlistId, canalId = null) {
    // Intentar obtener desde channelsApi si tenemos el canalId
    if (canalId) {
      try {
        const channelData = await channelsApi.getChannelData(canalId);
        const playlist = channelData?.playlists?.find(p => p.id === playlistId);
        if (playlist?.canciones) {
          logger.dev('⚡ Canciones obtenidas desde canal data');
          return playlist.canciones;
        }
      } catch (e) {
        logger.dev('ℹ️ Fallback a query directa de canciones');
      }
    }
    
    // Fallback: query directa
    const cacheKey = `songs_${playlistId}`;
    const cached = this._cache[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < this._cacheTime) {
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
        canciones (
          id,
          titulo,
          artista,
          album,
          duracion,
          url_s3
        )
      `)
      .eq('playlist_id', playlistId)
      .order('posicion', { ascending: true });
    
    if (error) throw error;
    
    // Transformar a formato esperado
    const songs = (data || []).map(item => ({
      ...item.canciones,
      posicion: item.posicion,
      peso: item.peso
    }));
    
    this._cache[cacheKey] = { data: songs, timestamp: Date.now() };
    return songs;
  },
  
  /**
   * Obtiene una canción por ID
   */
  async getSong(songId) {
    const { data, error } = await supabase
      .from('canciones')
      .select('*')
      .eq('id', songId)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Invalida cache de canciones
   */
  invalidateCache(playlistId = null) {
    if (playlistId) {
      delete this._cache[`songs_${playlistId}`];
    } else {
      this._cache = {};
    }
  }
};

// ============================================================================
// CONTENIDOS API - Contenidos propios y de sector
// ============================================================================

export const contenidosApi = {
  /**
   * Obtiene contenidos propios del usuario y de su sector.
   * Usa rpc_get_mis_contenidos
   */
  async getMisContenidos() {
    const { data, error } = await measureQuery('rpc_get_mis_contenidos', () =>
      supabase.rpc('rpc_get_mis_contenidos')
    );
    
    if (error) {
      logger.error('❌ Error en rpc_get_mis_contenidos:', error);
      throw error;
    }
    
    if (data?.error) {
      const err = new Error(data.error);
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    
    logger.dev('✅ Contenidos obtenidos');
    return data;
  },
  
  /**
   * Alterna el estado de una programación de sector (activa/desactivada).
   * Usa rpc_toggle_programacion_sector
   */
  async toggleProgramacionSector(programacionId, desactivar) {
    const { data, error } = await supabase.rpc('rpc_toggle_programacion_sector', {
      p_programacion_id: programacionId,
      p_desactivar: desactivar
    });
    
    if (error) {
      logger.error('❌ Error en rpc_toggle_programacion_sector:', error);
      throw error;
    }
    
    if (!data?.success) {
      const err = new Error(data?.error || 'Error al modificar programación');
      throw err;
    }
    
    logger.dev(`✅ Programación ${programacionId} ${desactivar ? 'desactivada' : 'activada'}`);
    return data;
  }
};

// ============================================================================
// PRESENCE API - Estado y presencia del usuario
// ============================================================================

export const presenceApi = {
  /**
   * Envía heartbeat para actualizar estado del usuario.
   * Usa rpc_heartbeat
   */
  async sendHeartbeat({
    canalId = null,
    canalNombre = null,
    cancionTitulo = null,
    cancionArtista = null,
    playbackState = 'playing',
    deviceId = null,
    appVersion = null
  } = {}) {
    // Obtener deviceId si no se proporciona
    const finalDeviceId = deviceId || (() => {
      if (typeof window === 'undefined') return 'default';
      let id = localStorage.getItem('ondeon_device_id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('ondeon_device_id', id);
      }
      return id;
    })();
    
    const { data, error } = await supabase.rpc('rpc_heartbeat', {
      p_canal_id: canalId,
      p_canal_nombre: canalNombre,
      p_cancion_titulo: cancionTitulo,
      p_cancion_artista: cancionArtista,
      p_playback_state: playbackState,
      p_device_id: finalDeviceId,
      p_app_version: appVersion
    });
    
    if (error) {
      // No loguear error en heartbeats fallidos (pueden ser frecuentes)
      if (import.meta.env.DEV) {
        logger.dev('⚠️ Heartbeat fallido:', error.message);
      }
      return { success: false, error: error.message };
    }
    
    return data || { success: true };
  },
  
  /**
   * Marca al usuario como offline (logout).
   * Usa rpc_user_logout
   */
  async logout() {
    const { data, error } = await supabase.rpc('rpc_user_logout');
    
    if (error) {
      logger.error('❌ Error en rpc_user_logout:', error);
      // No lanzar error, el logout debe continuar
    }
    
    logger.dev('✅ Usuario marcado como offline');
    return data || { success: true };
  }
};

// ============================================================================
// AUTH API - Autenticación (solo Supabase Auth)
// ============================================================================

export const authApi = {
  /**
   * Helper para construir redirectTo con basePath
   */
  getAuthRedirectUrl(pathname) {
    if (typeof window === 'undefined') return pathname;
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const fullPath = base === '' ? path : `${base}${path}`;
    return `${window.location.origin}${fullPath}`;
  },
  
  /**
   * Login con email/password
   */
  async signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },
  
  /**
   * Registro con email/password
   */
  async signUpWithEmail(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) throw error;
    return data;
  },
  
  /**
   * Login con Google OAuth
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: this.getAuthRedirectUrl('/login')
      }
    });
    if (error) throw error;
    return data;
  },
  
  /**
   * Login con Apple OAuth
   */
  async signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: this.getAuthRedirectUrl('/login')
      }
    });
    if (error) throw error;
    return data;
  },
  
  /**
   * Logout
   */
  async signOut() {
    // Marcar como offline antes de cerrar sesión
    try {
      await presenceApi.logout();
    } catch (e) {
      // Ignorar errores
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};

// ============================================================================
// USUARIOS API - Gestión de usuarios (para registro/actualización)
// ============================================================================

export const usuariosApi = {
  /**
   * Crea o actualiza el registro del usuario en la tabla usuarios.
   * Solo para el proceso de registro.
   */
  async upsertUsuario(userData) {
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser?.user?.id) {
      throw new Error('Usuario no autenticado');
    }
    
    const { data, error } = await supabase
      .from('usuarios')
      .upsert({
        auth_user_id: authUser.user.id,
        email: authUser.user.email,
        ...userData
      }, {
        onConflict: 'auth_user_id'
      })
      .select()
      .single();
    
    if (error) {
      logger.error('❌ Error en upsertUsuario:', error);
      throw error;
    }
    
    logger.dev('✅ Usuario actualizado:', data.id);
    return data;
  },
  
  /**
   * Obtiene los sectores disponibles para el registro
   */
  async getSectores() {
    const { data, error } = await supabase
      .from('sectores')
      .select('id, nombre, descripcion')
      .eq('activo', true)
      .order('nombre');
    
    if (error) throw error;
    return data || [];
  },
  
  /**
   * Obtiene los idiomas disponibles
   */
  async getIdiomas() {
    const { data, error } = await supabase
      .from('idiomas')
      .select('codigo, nombre');
    
    if (error) throw error;
    return data || [];
  }
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  initApi,
  channelsApi,
  playlistsApi,
  songsApi,
  contenidosApi,
  presenceApi,
  authApi,
  usuariosApi
};
