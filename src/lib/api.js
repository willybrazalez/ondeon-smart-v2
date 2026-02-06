import { supabase } from './supabase'
import logger from './logger.js'

// ============================================================================
// CAPACITOR IN-APP BROWSER - Para OAuth in-app (SFSafariViewController)
// ============================================================================
let CapacitorInAppBrowser = null;
let DefaultSystemBrowserOptions = null;

// Cargar dinámicamente el plugin de InAppBrowser cuando esté en entorno nativo
const loadCapacitorPlugins = async () => {
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    try {
      const inAppBrowserModule = await import('@capacitor/inappbrowser');
      CapacitorInAppBrowser = inAppBrowserModule.InAppBrowser;
      DefaultSystemBrowserOptions = inAppBrowserModule.DefaultSystemBrowserOptions;
      logger.dev('✅ Capacitor InAppBrowser plugin cargado');
    } catch (e) {
      logger.warn('⚠️ No se pudo cargar Capacitor InAppBrowser:', e);
    }
  }
};

// Inicializar plugins
loadCapacitorPlugins();

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
    console.log('🌐 [API] getUserInit() llamado, iniciando RPC...');
    const startTime = Date.now();
    
    try {
      const { data, error } = await measureQuery('rpc_get_user_init', () =>
        supabase.rpc('rpc_get_user_init')
      );
      
      console.log('🌐 [API] RPC completado en', Date.now() - startTime, 'ms');
      
      if (error) {
        console.log('❌ [API] Error en RPC:', error);
        throw error;
      }
      
      // El RPC puede devolver un objeto con error si el usuario no existe
      if (data?.error) {
        console.log('⚠️ [API] RPC devolvió error en data:', data.error);
        const err = new Error(data.error);
        err.code = 'USER_NOT_FOUND';
        throw err;
      }
      
      console.log('✅ [API] Datos obtenidos correctamente');
      return data;
    } catch (e) {
      console.log('❌ [API] Excepción en getUserInit:', e.message, 'después de', Date.now() - startTime, 'ms');
      throw e;
    }
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
  },

  /**
   * Obtiene los contenidos propios del usuario (creados por él).
   * Busca por usuario_id (tabla usuarios) o por auth_user_id (si se pasa auth ID)
   */
  async getMyContents(userId) {
    // Primero intentar buscar por usuario_id directo
    let { data, error } = await measureQuery('contenidos.getMyContents', () =>
      supabase
        .from('contenidos')
        .select('*')
        .eq('usuario_id', userId)
        .eq('activo', true)
        .order('created_at', { ascending: false })
    );
    
    // Si no hay resultados, buscar el usuario_id basado en auth_user_id
    if (!data || data.length === 0) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_user_id', userId)
        .single();
      
      if (usuario?.id) {
        const result = await supabase
          .from('contenidos')
          .select('*')
          .eq('usuario_id', usuario.id)
          .eq('activo', true)
          .order('created_at', { ascending: false });
        
        data = result.data;
        error = result.error;
      }
    }
    
    if (error) {
      logger.error('❌ Error obteniendo mis contenidos:', error);
      throw error;
    }
    
    logger.dev(`✅ ${data?.length || 0} contenidos propios obtenidos`);
    return data || [];
  }
};

// ============================================================================
// AUTH API - Autenticación (solo Supabase Auth)
// ============================================================================

export const authApi = {
  /**
   * Detecta si estamos en una app nativa de Capacitor (iOS/Android)
   */
  isCapacitorNative() {
    return typeof window !== 'undefined' && 
           window.Capacitor && 
           window.Capacitor.isNativePlatform && 
           window.Capacitor.isNativePlatform();
  },

  /**
   * Helper para construir redirectTo con basePath
   * En apps nativas, usa el URL scheme personalizado
   */
  getAuthRedirectUrl(pathname) {
    if (typeof window === 'undefined') return pathname;
    
    // En Capacitor nativo, usar URL scheme personalizado
    if (this.isCapacitorNative()) {
      const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
      return `ondeon-smart:/${path}`;
    }
    
    // En web, usar la URL normal
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
   * En nativo usa in-app browser (SFSafariViewController)
   */
  async signInWithGoogle() {
    return this._performOAuth('google');
  },
  
  /**
   * Login con Apple OAuth
   * En nativo usa in-app browser (SFSafariViewController)
   */
  async signInWithApple() {
    return this._performOAuth('apple');
  },
  
  /**
   * Método interno para realizar OAuth con soporte in-app browser
   * NOTA: En Capacitor nativo, el callback es manejado por AuthContext
   * a través de su listener de deep links (appUrlOpen)
   */
  async _performOAuth(provider) {
    const redirectTo = this.getAuthRedirectUrl('/login');
    
    // En plataforma nativa, usar in-app browser (SFSafariViewController en iOS)
    // AuthContext se encarga de capturar el callback via deep link
    console.log('🔐 [OAUTH] isCapacitorNative:', this.isCapacitorNative(), 'hasInAppBrowser:', !!CapacitorInAppBrowser);
    
    if (this.isCapacitorNative() && CapacitorInAppBrowser) {
      try {
        // Obtener la URL de OAuth sin redirigir automáticamente
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true // No redirigir automáticamente
          }
        });
        
        if (error) throw error;
        
        if (data?.url) {
          console.log(`🔐 [OAUTH] Abriendo ${provider} con openInSystemBrowser`);
          console.log(`🔐 [OAUTH] URL: ${data.url.substring(0, 100)}...`);
          
          // Usar openInSystemBrowser para forzar SFSafariViewController en iOS
          // y Chrome Custom Tabs en Android
          await CapacitorInAppBrowser.openInSystemBrowser({
            url: data.url,
            options: DefaultSystemBrowserOptions
          });
          
          // En nativo, no esperamos aquí - AuthContext manejará el callback
          // y actualizará el estado de autenticación automáticamente
          logger.dev(`✅ In-app browser abierto para OAuth ${provider}`);
          return null;
        }
      } catch (e) {
        logger.error(`❌ Error en OAuth ${provider} nativo:`, e);
        throw e;
      }
    }
    
    // En web, usar el flujo normal de redirección
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo
      }
    });
    if (error) throw error;
    return data;
  },
  
  /**
   * Logout
   */
  async signOut() {
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
// CONTENT ASSIGNMENTS API - Contenidos asignados al usuario
// ============================================================================

export const contentAssignmentsApi = {
  /**
   * Obtiene los contenidos de programaciones activas/pausadas del usuario.
   * Usa programaciones.usuario_id directamente (no usa programacion_destinatarios).
   */
  async getUserProgrammingContent(userId) {
    if (!userId) {
      logger.warn('⚠️ getUserProgrammingContent: userId no proporcionado');
      return [];
    }

    try {
      // Primero obtener el usuario_id real de la tabla usuarios
      let realUserId = userId;
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_user_id', userId)
        .single();
      
      if (usuario?.id) {
        realUserId = usuario.id;
      }

      // 1. Obtener las programaciones del usuario con estado activo o pausado
      const { data: programaciones, error: errorProgramaciones } = await measureQuery(
        'get_programaciones_usuario',
        () => supabase
          .from('programaciones')
          .select('id, nombre, descripcion, tipo, frecuencia_minutos, hora_inicio, hora_fin, modo_audio, estado')
          .eq('usuario_id', realUserId)
          .in('estado', ['activo', 'pausado'])
      );

      if (errorProgramaciones) {
        logger.error('❌ Error obteniendo programaciones:', errorProgramaciones);
        throw errorProgramaciones;
      }

      if (!programaciones || programaciones.length === 0) {
        logger.dev('📭 Usuario sin programaciones activas/pausadas');
        return [];
      }

      const programacionIds = programaciones.map(p => p.id);

      // 2. Obtener los contenidos de esas programaciones
      const { data: programacionContenidos, error: errorContenidos } = await measureQuery(
        'get_programacion_contenidos',
        () => supabase
          .from('programacion_contenidos')
          .select(`
            id,
            programacion_id,
            contenido_id,
            orden,
            contenidos (
              id,
              nombre,
              tipo,
              url_s3,
              duracion_segundos,
              activo
            )
          `)
          .in('programacion_id', programacionIds)
          .order('orden', { ascending: true })
      );

      if (errorContenidos) {
        logger.error('❌ Error obteniendo contenidos:', errorContenidos);
        throw errorContenidos;
      }

      // 3. Combinar datos: cada contenido con su info de programación
      const resultado = (programacionContenidos || [])
        .filter(pc => pc.contenidos && pc.contenidos.activo !== false)
        .map(pc => {
          const prog = programaciones.find(p => p.id === pc.programacion_id);
          return {
            id: pc.id,
            programacion_id: pc.programacion_id,
            contenido_id: pc.contenido_id,
            orden: pc.orden,
            contenidos: pc.contenidos,
            programacion_info: prog ? {
              nombre: prog.nombre,
              descripcion: prog.descripcion,
              tipo: prog.tipo,
              frecuencia_minutos: prog.frecuencia_minutos,
              hora_inicio: prog.hora_inicio,
              hora_fin: prog.hora_fin,
              modo_audio: prog.modo_audio,
              estado: prog.estado
            } : null
          };
        });

      logger.dev(`✅ Contenidos de programaciones obtenidos: ${resultado.length}`);
      return resultado;

    } catch (error) {
      logger.error('❌ Error en getUserProgrammingContent:', error);
      throw error;
    }
  }
};

// ============================================================================
// SECTIONS API - Secciones del home y favoritos
// ============================================================================

export const sectionsApi = {
  _cache: {
    sections: null,
    sectionChannels: {},
    favorites: null,
    timestamp: {}
  },
  _cacheTime: 3 * 60 * 1000, // 3 minutos
  
  /**
   * Obtiene todas las secciones del home activas
   */
  async getHomeSections(forceRefresh = false) {
    const cacheKey = 'sections';
    
    // Verificar cache
    if (!forceRefresh && 
        this._cache.sections && 
        this._cache.timestamp[cacheKey] &&
        (Date.now() - this._cache.timestamp[cacheKey]) < this._cacheTime) {
      logger.dev('⚡ Secciones obtenidas desde cache');
      return this._cache.sections;
    }
    
    const { data, error } = await measureQuery('rpc_get_home_sections', () =>
      supabase.rpc('rpc_get_home_sections')
    );
    
    if (error) {
      logger.error('❌ Error en rpc_get_home_sections:', error);
      throw error;
    }
    
    if (data?.error) {
      const err = new Error(data.error);
      err.code = 'NOT_AUTHENTICATED';
      throw err;
    }
    
    // Parsear el JSON si es necesario
    const sections = typeof data === 'string' ? JSON.parse(data) : data;
    
    // Guardar en cache
    this._cache.sections = sections || [];
    this._cache.timestamp[cacheKey] = Date.now();
    
    logger.dev(`✅ ${sections?.length || 0} secciones obtenidas`);
    return sections || [];
  },
  
  /**
   * Obtiene los canales de una sección específica según su tipo
   */
  async getSectionChannels(sectionId, forceRefresh = false) {
    if (!sectionId) {
      logger.warn('⚠️ getSectionChannels llamado sin sectionId');
      return [];
    }
    
    const cacheKey = `section_${sectionId}`;
    
    // Verificar cache
    if (!forceRefresh && 
        this._cache.sectionChannels[sectionId] && 
        this._cache.timestamp[cacheKey] &&
        (Date.now() - this._cache.timestamp[cacheKey]) < this._cacheTime) {
      logger.dev(`⚡ Canales de sección ${sectionId} obtenidos desde cache`);
      return this._cache.sectionChannels[sectionId];
    }
    
    const { data, error } = await measureQuery('rpc_get_section_channels', () =>
      supabase.rpc('rpc_get_section_channels', { p_seccion_id: sectionId })
    );
    
    if (error) {
      logger.error('❌ Error en rpc_get_section_channels:', error);
      throw error;
    }
    
    if (data?.error) {
      logger.warn(`⚠️ ${data.error}`);
      return [];
    }
    
    // Parsear el JSON si es necesario
    const channels = typeof data === 'string' ? JSON.parse(data) : data;
    
    // Guardar en cache
    this._cache.sectionChannels[sectionId] = channels || [];
    this._cache.timestamp[cacheKey] = Date.now();
    
    logger.dev(`✅ ${channels?.length || 0} canales de sección obtenidos`);
    return channels || [];
  },
  
  /**
   * Añade o quita un canal de favoritos
   */
  async toggleFavorite(canalId) {
    if (!canalId) {
      logger.warn('⚠️ toggleFavorite llamado sin canalId');
      return { success: false, error: 'Canal ID requerido' };
    }
    
    const { data, error } = await measureQuery('rpc_toggle_favorite_channel', () =>
      supabase.rpc('rpc_toggle_favorite_channel', { p_canal_id: canalId })
    );
    
    if (error) {
      logger.error('❌ Error en rpc_toggle_favorite_channel:', error);
      throw error;
    }
    
    // Parsear el JSON si es necesario
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (result?.success) {
      // Invalidar cache de favoritos
      this.invalidateFavoritesCache();
      
      logger.dev(`✅ Favorito ${result.action === 'added' ? 'añadido' : 'eliminado'}`);
    }
    
    return result;
  },
  
  /**
   * Verifica si un canal es favorito
   */
  async checkIsFavorite(canalId) {
    if (!canalId) return false;
    
    const { data, error } = await supabase.rpc('rpc_check_is_favorite', { 
      p_canal_id: canalId 
    });
    
    if (error) {
      logger.error('❌ Error en rpc_check_is_favorite:', error);
      return false;
    }
    
    return data === true;
  },
  
  /**
   * Obtiene todos los canales favoritos del usuario
   */
  async getUserFavorites(forceRefresh = false) {
    const cacheKey = 'favorites';
    
    // Verificar cache
    if (!forceRefresh && 
        this._cache.favorites && 
        this._cache.timestamp[cacheKey] &&
        (Date.now() - this._cache.timestamp[cacheKey]) < this._cacheTime) {
      logger.dev('⚡ Favoritos obtenidos desde cache');
      return this._cache.favorites;
    }
    
    const { data, error } = await measureQuery('rpc_get_user_favorites', () =>
      supabase.rpc('rpc_get_user_favorites')
    );
    
    if (error) {
      logger.error('❌ Error en rpc_get_user_favorites:', error);
      throw error;
    }
    
    // Parsear el JSON si es necesario
    const favorites = typeof data === 'string' ? JSON.parse(data) : data;
    
    // Guardar en cache
    this._cache.favorites = favorites || [];
    this._cache.timestamp[cacheKey] = Date.now();
    
    logger.dev(`✅ ${favorites?.length || 0} favoritos obtenidos`);
    return favorites || [];
  },
  
  /**
   * Invalida el cache de secciones
   */
  invalidateSectionsCache() {
    this._cache.sections = null;
    delete this._cache.timestamp['sections'];
    logger.dev('🗑️ Cache de secciones invalidado');
  },
  
  /**
   * Invalida el cache de canales de una sección
   */
  invalidateSectionChannelsCache(sectionId = null) {
    if (sectionId) {
      delete this._cache.sectionChannels[sectionId];
      delete this._cache.timestamp[`section_${sectionId}`];
      logger.dev(`🗑️ Cache de sección ${sectionId} invalidado`);
    } else {
      this._cache.sectionChannels = {};
      // Limpiar timestamps de secciones
      Object.keys(this._cache.timestamp).forEach(key => {
        if (key.startsWith('section_')) {
          delete this._cache.timestamp[key];
        }
      });
      logger.dev('🗑️ Cache de todas las secciones invalidado');
    }
  },
  
  /**
   * Invalida el cache de favoritos
   */
  invalidateFavoritesCache() {
    this._cache.favorites = null;
    delete this._cache.timestamp['favorites'];
    
    // También invalidar cache de sección de favoritos si existe
    const sections = this._cache.sections || [];
    const favSection = sections.find(s => s.tipo === 'favoritos');
    if (favSection?.id) {
      this.invalidateSectionChannelsCache(favSection.id);
    }
    
    logger.dev('🗑️ Cache de favoritos invalidado');
  },
  
  /**
   * Invalida todo el cache de secciones
   */
  invalidateAllCache() {
    this._cache = {
      sections: null,
      sectionChannels: {},
      favorites: null,
      timestamp: {}
    };
    logger.dev('🗑️ Cache completo de secciones invalidado');
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
  authApi,
  usuariosApi,
  contentAssignmentsApi,
  sectionsApi
};
