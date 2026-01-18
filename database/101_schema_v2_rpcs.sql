-- ============================================================================
-- ONDEON SMART v2 - FUNCIONES RPC
-- ============================================================================
-- Funciones que encapsulan la lógica de negocio.
-- El frontend usa estas funciones en lugar de queries directas.
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: rpc_get_user_init
-- Inicialización del usuario al login. Devuelve todo lo necesario.
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_get_user_init()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_sector_id UUID;
  v_result JSON;
BEGIN
  -- Obtener usuario_id desde auth.uid()
  SELECT id, sector_id INTO v_usuario_id, v_sector_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('error', 'Usuario no encontrado');
  END IF;
  
  -- Construir respuesta completa
  SELECT json_build_object(
    'usuario', (
      SELECT row_to_json(u.*)
      FROM (
        SELECT 
          id, nombre, email, telefono, establecimiento,
          direccion, localidad, provincia, codigo_postal, pais,
          sector_id, idioma, rol, activo, registro_completo,
          created_at, last_seen_at
        FROM usuarios
        WHERE id = v_usuario_id
      ) u
    ),
    'sector', (
      SELECT row_to_json(s.*)
      FROM sectores s
      WHERE s.id = v_sector_id
    ),
    'canales_recomendados', (
      SELECT COALESCE(json_agg(c ORDER BY scr.orden), '[]'::json)
      FROM sector_canales_recomendados scr
      JOIN canales c ON c.id = scr.canal_id
      WHERE scr.sector_id = v_sector_id
      AND c.activo = true
    ),
    'programaciones_activas', (
      SELECT COALESCE(json_agg(p), '[]'::json)
      FROM (
        -- Programaciones propias del usuario
        SELECT 
          pr.id, pr.nombre, pr.descripcion, pr.tipo,
          pr.frecuencia_minutos, pr.hora_inicio, pr.hora_fin,
          pr.fecha_inicio, pr.fecha_fin, pr.dias_semana,
          pr.modo_audio, pr.estado, 'propia' as origen,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', c.id,
              'nombre', c.nombre,
              'url_s3', c.url_s3,
              'duracion_segundos', c.duracion_segundos,
              'orden', pc.orden
            ) ORDER BY pc.orden), '[]'::json)
            FROM programacion_contenidos pc
            JOIN contenidos c ON c.id = pc.contenido_id
            WHERE pc.programacion_id = pr.id AND pc.activo = true
          ) as contenidos
        FROM programaciones pr
        WHERE pr.usuario_id = v_usuario_id
        AND pr.estado = 'activo'
        
        UNION ALL
        
        -- Programaciones de sector (no desactivadas por el usuario)
        SELECT 
          pr.id, pr.nombre, pr.descripcion, pr.tipo,
          pr.frecuencia_minutos, pr.hora_inicio, pr.hora_fin,
          pr.fecha_inicio, pr.fecha_fin, pr.dias_semana,
          pr.modo_audio, pr.estado, 'sector' as origen,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', c.id,
              'nombre', c.nombre,
              'url_s3', c.url_s3,
              'duracion_segundos', c.duracion_segundos,
              'orden', pc.orden
            ) ORDER BY pc.orden), '[]'::json)
            FROM programacion_contenidos pc
            JOIN contenidos c ON c.id = pc.contenido_id
            WHERE pc.programacion_id = pr.id AND pc.activo = true
          ) as contenidos
        FROM programaciones pr
        WHERE pr.sector_id = v_sector_id
        AND pr.usuario_id IS NULL
        AND pr.estado = 'activo'
        AND pr.id NOT IN (
          SELECT programacion_id 
          FROM usuario_programaciones_desactivadas 
          WHERE usuario_id = v_usuario_id
        )
        -- Filtrar por idioma del usuario si la programación tiene idioma definido
        AND (pr.idioma IS NULL OR pr.idioma = (SELECT idioma FROM usuarios WHERE id = v_usuario_id))
      ) p
    )
  ) INTO v_result;
  
  -- Actualizar last_seen_at
  UPDATE usuarios SET last_seen_at = now() WHERE id = v_usuario_id;
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- FUNCIÓN: rpc_heartbeat
-- Actualiza el estado del usuario (presencia y canción actual)
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_heartbeat(
  p_canal_id UUID DEFAULT NULL,
  p_canal_nombre TEXT DEFAULT NULL,
  p_cancion_titulo TEXT DEFAULT NULL,
  p_cancion_artista TEXT DEFAULT NULL,
  p_playback_state TEXT DEFAULT 'playing',
  p_device_id TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  -- Obtener usuario_id
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;
  
  -- Insertar o actualizar estado
  INSERT INTO user_current_state (
    usuario_id, is_online, last_seen_at, playback_state,
    current_canal_id, current_canal_name,
    current_song_title, current_song_artist,
    device_id, app_version, updated_at
  )
  VALUES (
    v_usuario_id, true, now(), p_playback_state,
    p_canal_id, p_canal_nombre,
    p_cancion_titulo, p_cancion_artista,
    p_device_id, p_app_version, now()
  )
  ON CONFLICT (usuario_id) DO UPDATE SET
    is_online = true,
    last_seen_at = now(),
    playback_state = COALESCE(p_playback_state, user_current_state.playback_state),
    current_canal_id = COALESCE(p_canal_id, user_current_state.current_canal_id),
    current_canal_name = COALESCE(p_canal_nombre, user_current_state.current_canal_name),
    current_song_title = p_cancion_titulo,
    current_song_artist = p_cancion_artista,
    device_id = COALESCE(p_device_id, user_current_state.device_id),
    app_version = COALESCE(p_app_version, user_current_state.app_version),
    updated_at = now();
  
  -- Actualizar last_seen_at en usuarios
  UPDATE usuarios SET last_seen_at = now() WHERE id = v_usuario_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================================
-- FUNCIÓN: rpc_get_canal_data
-- Obtiene playlists y canciones de un canal específico
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_get_canal_data(p_canal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Verificar que el usuario está autenticado
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'No autenticado');
  END IF;
  
  SELECT json_build_object(
    'canal', (
      SELECT row_to_json(c.*)
      FROM (
        SELECT id, nombre, descripcion, imagen_url
        FROM canales
        WHERE id = p_canal_id AND activo = true
      ) c
    ),
    'playlists', (
      SELECT COALESCE(json_agg(pl ORDER BY pl.peso DESC), '[]'::json)
      FROM (
        SELECT 
          p.id, p.nombre, p.descripcion, p.tipo, p.peso,
          p.orden_reproduccion, p.activa_desde, p.activa_hasta,
          p.repetir_cada, p.repetir_unidad,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', ca.id,
              'titulo', ca.titulo,
              'artista', ca.artista,
              'album', ca.album,
              'duracion', ca.duracion,
              'url_s3', ca.url_s3,
              'posicion', pc.posicion,
              'peso', pc.peso
            ) ORDER BY pc.posicion, pc.peso DESC), '[]'::json)
            FROM playlist_canciones pc
            JOIN canciones ca ON ca.id = pc.cancion_id
            WHERE pc.playlist_id = p.id AND ca.activa = true
          ) as canciones
        FROM playlists p
        WHERE p.canal_id = p_canal_id AND p.activa = true
      ) pl
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- FUNCIÓN: rpc_get_all_canales
-- Obtiene todos los canales activos
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_get_all_canales()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_sector_id UUID;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'No autenticado');
  END IF;
  
  -- Obtener sector del usuario para marcar recomendados
  SELECT id, sector_id INTO v_usuario_id, v_sector_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  RETURN (
    SELECT json_build_object(
      'canales', COALESCE(json_agg(c ORDER BY c.orden), '[]'::json)
    )
    FROM (
      SELECT 
        ca.id, ca.nombre, ca.descripcion, ca.imagen_url, ca.orden,
        EXISTS(
          SELECT 1 FROM sector_canales_recomendados scr 
          WHERE scr.canal_id = ca.id AND scr.sector_id = v_sector_id
        ) as recomendado
      FROM canales ca
      WHERE ca.activo = true
    ) c
  );
END;
$$;

-- ============================================================================
-- FUNCIÓN: rpc_get_mis_contenidos
-- Obtiene contenidos propios del usuario + contenidos de su sector
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_get_mis_contenidos()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_sector_id UUID;
  v_idioma TEXT;
BEGIN
  -- Obtener datos del usuario
  SELECT id, sector_id, idioma INTO v_usuario_id, v_sector_id, v_idioma
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('error', 'Usuario no encontrado');
  END IF;
  
  RETURN (
    SELECT json_build_object(
      'contenidos_propios', (
        SELECT COALESCE(json_agg(c ORDER BY c.created_at DESC), '[]'::json)
        FROM (
          SELECT id, nombre, descripcion, tipo, url_s3, duracion_segundos,
                 idioma, generado_ia, activo, created_at
          FROM contenidos
          WHERE usuario_id = v_usuario_id AND activo = true
        ) c
      ),
      'contenidos_sector', (
        SELECT COALESCE(json_agg(c ORDER BY c.created_at DESC), '[]'::json)
        FROM (
          SELECT id, nombre, descripcion, tipo, url_s3, duracion_segundos,
                 idioma, generado_ia, activo, created_at
          FROM contenidos
          WHERE sector_id = v_sector_id 
          AND usuario_id IS NULL 
          AND activo = true
          AND (idioma IS NULL OR idioma = v_idioma)
        ) c
      )
    )
  );
END;
$$;

-- ============================================================================
-- FUNCIÓN: rpc_toggle_programacion_sector
-- Activa o desactiva una programación heredada de sector
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_toggle_programacion_sector(
  p_programacion_id UUID,
  p_desactivar BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_sector_id UUID;
  v_prog_sector_id UUID;
BEGIN
  -- Obtener datos del usuario
  SELECT id, sector_id INTO v_usuario_id, v_sector_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;
  
  -- Verificar que la programación es de su sector
  SELECT sector_id INTO v_prog_sector_id
  FROM programaciones
  WHERE id = p_programacion_id AND usuario_id IS NULL;
  
  IF v_prog_sector_id IS NULL OR v_prog_sector_id != v_sector_id THEN
    RETURN json_build_object('success', false, 'error', 'Programación no válida');
  END IF;
  
  IF p_desactivar THEN
    -- Insertar en desactivadas
    INSERT INTO usuario_programaciones_desactivadas (usuario_id, programacion_id)
    VALUES (v_usuario_id, p_programacion_id)
    ON CONFLICT (usuario_id, programacion_id) DO NOTHING;
  ELSE
    -- Eliminar de desactivadas
    DELETE FROM usuario_programaciones_desactivadas
    WHERE usuario_id = v_usuario_id AND programacion_id = p_programacion_id;
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================================
-- FUNCIÓN: rpc_user_logout
-- Marca al usuario como offline
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_user_logout()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('success', false);
  END IF;
  
  UPDATE user_current_state
  SET is_online = false, playback_state = 'stopped', updated_at = now()
  WHERE usuario_id = v_usuario_id;
  
  -- Registrar logout en historial
  INSERT INTO playback_history (usuario_id, evento)
  VALUES (v_usuario_id, 'logout');
  
  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================================
-- FUNCIÓN AUXILIAR: Obtener usuario_id desde auth
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_usuario_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM usuarios WHERE auth_user_id = auth.uid();
$$;

-- ============================================================================
-- PERMISOS DE EJECUCIÓN
-- ============================================================================

GRANT EXECUTE ON FUNCTION rpc_get_user_init() TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_heartbeat(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_canal_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_all_canales() TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_get_mis_contenidos() TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_toggle_programacion_sector(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_user_logout() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_usuario_id() TO authenticated;
