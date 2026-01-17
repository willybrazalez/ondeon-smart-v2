-- =====================================================
-- MIGRACIÓN 024: Resolver IDs de usuarios en funciones de presencia
-- Fecha: 2026-01-16
-- =====================================================
-- Problema: Las funciones de presencia recibían IDs que podían ser:
--   - auth_user_id (para usuarios OAuth de Supabase Auth)
--   - id de tabla usuarios (para usuarios legacy)
-- 
-- Solución: Crear función helper resolve_usuario_id() y actualizar
-- todas las funciones de presencia para usar esta resolución automática.
-- =====================================================

-- 1. FUNCIÓN HELPER: Resolver usuario_id (auth_user_id → id de tabla usuarios)
CREATE OR REPLACE FUNCTION resolve_usuario_id(p_input_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_real_id uuid;
BEGIN
  -- Primero intentar encontrar por id directo (usuarios legacy)
  SELECT id INTO v_real_id
  FROM usuarios
  WHERE id = p_input_id;
  
  -- Si no se encuentra, buscar por auth_user_id (usuarios OAuth)
  IF v_real_id IS NULL THEN
    SELECT id INTO v_real_id
    FROM usuarios
    WHERE auth_user_id = p_input_id;
  END IF;
  
  RETURN v_real_id;
END;
$$;

COMMENT ON FUNCTION resolve_usuario_id(uuid) IS 
  'Resuelve un ID de entrada al id real de la tabla usuarios.
   Acepta tanto auth_user_id (OAuth) como id (legacy).';

-- 2. ACTUALIZAR: start_single_session
CREATE OR REPLACE FUNCTION start_single_session(
  p_usuario_id uuid,
  p_device_id text DEFAULT 'default',
  p_device_info jsonb DEFAULT '{}'::jsonb,
  p_app_version text DEFAULT NULL
)
RETURNS TABLE (
  new_session_id uuid,
  closed_sessions_count integer,
  previous_device_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_usuario_id uuid;
  v_new_session_id uuid;
  v_closed_count integer;
  v_previous_device_id text;
BEGIN
  -- Resolver el ID real del usuario
  v_real_usuario_id := resolve_usuario_id(p_usuario_id);
  
  IF v_real_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado con ID % (ni como id ni como auth_user_id)', p_usuario_id
      USING ERRCODE = '23503';
  END IF;

  -- Obtener device_id de la sesión anterior (si existe)
  SELECT device_id INTO v_previous_device_id
  FROM user_current_state
  WHERE usuario_id = v_real_usuario_id
    AND is_online = true
  LIMIT 1;

  -- Cerrar sesiones previas (usando el ID real)
  SELECT r.closed_sessions_count INTO v_closed_count
  FROM close_previous_user_sessions(v_real_usuario_id, p_device_id) AS r;

  -- Crear nueva sesión (usando el ID real)
  INSERT INTO user_presence_sessions (
    usuario_id,
    device_id,
    device_info,
    app_version,
    status,
    started_at,
    last_activity_at
  )
  VALUES (
    v_real_usuario_id,
    p_device_id,
    p_device_info,
    p_app_version,
    'active',
    now(),
    now()
  )
  RETURNING id INTO v_new_session_id;

  -- Actualizar user_current_state con la nueva sesión
  INSERT INTO user_current_state (
    usuario_id,
    is_online,
    session_started_at,
    last_seen_at,
    current_session_id,
    device_id,
    app_version,
    updated_at
  )
  VALUES (
    v_real_usuario_id,
    true,
    now(),
    now(),
    v_new_session_id,
    p_device_id,
    p_app_version,
    now()
  )
  ON CONFLICT (usuario_id) DO UPDATE SET
    is_online = true,
    session_started_at = now(),
    last_seen_at = now(),
    current_session_id = v_new_session_id,
    device_id = p_device_id,
    app_version = COALESCE(EXCLUDED.app_version, user_current_state.app_version),
    updated_at = now();

  -- Actualizar app_version en usuarios (solo si no es NULL - solo Electron)
  IF p_app_version IS NOT NULL THEN
    UPDATE usuarios
    SET app_version = p_app_version
    WHERE id = v_real_usuario_id
      AND (app_version IS NULL OR app_version != p_app_version);
  END IF;

  -- Retornar información de la operación
  RETURN QUERY SELECT 
    v_new_session_id AS new_session_id, 
    COALESCE(v_closed_count, 0) AS closed_sessions_count, 
    v_previous_device_id AS previous_device_id;
END;
$$;

-- 3. ACTUALIZAR: close_previous_user_sessions
CREATE OR REPLACE FUNCTION close_previous_user_sessions(
  p_usuario_id uuid,
  p_current_device_id text DEFAULT NULL
)
RETURNS TABLE (closed_sessions_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_usuario_id uuid;
  v_count integer;
BEGIN
  -- Resolver el ID real del usuario
  v_real_usuario_id := resolve_usuario_id(p_usuario_id);
  
  IF v_real_usuario_id IS NULL THEN
    RETURN QUERY SELECT 0::integer;
    RETURN;
  END IF;

  -- Cerrar sesiones activas anteriores
  WITH updated AS (
    UPDATE user_presence_sessions
    SET 
      status = 'disconnected',
      ended_at = now()
    WHERE usuario_id = v_real_usuario_id
      AND status = 'active'
      AND (p_current_device_id IS NULL OR device_id != p_current_device_id)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  
  RETURN QUERY SELECT v_count;
END;
$$;

-- 4. DROP y RECREAR: check_device_session
DROP FUNCTION IF EXISTS check_device_session(uuid, text);

CREATE FUNCTION check_device_session(
  p_usuario_id uuid,
  p_device_id text
)
RETURNS TABLE (
  has_active_session boolean,
  is_same_device boolean,
  active_device_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_usuario_id uuid;
  v_active_device text;
BEGIN
  -- Resolver el ID real del usuario
  v_real_usuario_id := resolve_usuario_id(p_usuario_id);
  
  IF v_real_usuario_id IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::text;
    RETURN;
  END IF;

  SELECT device_id INTO v_active_device
  FROM user_current_state
  WHERE usuario_id = v_real_usuario_id
    AND is_online = true;
  
  RETURN QUERY SELECT 
    (v_active_device IS NOT NULL),
    (v_active_device = p_device_id),
    v_active_device;
END;
$$;

-- 5. ACTUALIZAR: update_session_activity
CREATE OR REPLACE FUNCTION update_session_activity(
  p_session_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_usuario_id uuid;
BEGIN
  IF p_usuario_id IS NOT NULL THEN
    v_real_usuario_id := resolve_usuario_id(p_usuario_id);
  END IF;

  UPDATE user_presence_sessions
  SET last_activity_at = now()
  WHERE id = p_session_id;
  
  IF v_real_usuario_id IS NOT NULL THEN
    UPDATE user_current_state
    SET 
      last_seen_at = now(),
      last_heartbeat = now(),
      updated_at = now()
    WHERE usuario_id = v_real_usuario_id;
  END IF;
END;
$$;

-- 6. ACTUALIZAR: fn_reproductor_heartbeat_v2
CREATE OR REPLACE FUNCTION fn_reproductor_heartbeat_v2(
  p_usuario_id uuid,
  p_device_id text DEFAULT 'default',
  p_canal_id uuid DEFAULT NULL,
  p_canal_nombre text DEFAULT NULL,
  p_cancion_titulo text DEFAULT NULL,
  p_cancion_artista text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_playback_state text DEFAULT 'playing'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_usuario_id uuid;
  v_session_id uuid;
BEGIN
  v_real_usuario_id := resolve_usuario_id(p_usuario_id);
  
  IF v_real_usuario_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  SELECT id INTO v_session_id
  FROM user_presence_sessions
  WHERE usuario_id = v_real_usuario_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  UPDATE user_current_state
  SET 
    is_online = true,
    last_seen_at = now(),
    last_heartbeat = now(),
    playback_state = p_playback_state,
    current_canal_id = p_canal_id,
    current_canal_name = p_canal_nombre,
    current_song_title = p_cancion_titulo,
    current_song_artist = p_cancion_artista,
    device_id = p_device_id,
    app_version = COALESCE(p_app_version, app_version),
    updated_at = now()
  WHERE usuario_id = v_real_usuario_id;

  IF v_session_id IS NOT NULL THEN
    UPDATE user_presence_sessions
    SET last_activity_at = now()
    WHERE id = v_session_id;
  END IF;

  IF p_app_version IS NOT NULL THEN
    UPDATE usuarios
    SET app_version = p_app_version
    WHERE id = v_real_usuario_id
      AND (app_version IS NULL OR app_version != p_app_version);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'usuario_id', v_real_usuario_id,
    'session_id', v_session_id
  );
END;
$$;

-- 7. ACTUALIZAR: fn_reproductor_heartbeat (legacy)
CREATE OR REPLACE FUNCTION fn_reproductor_heartbeat(
  p_usuario_id uuid,
  p_device_id text DEFAULT 'default',
  p_canal_id uuid DEFAULT NULL,
  p_canal_nombre text DEFAULT NULL,
  p_cancion_titulo text DEFAULT NULL,
  p_cancion_artista text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_real_usuario_id uuid;
BEGIN
  v_real_usuario_id := resolve_usuario_id(p_usuario_id);
  
  IF v_real_usuario_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE user_current_state
  SET 
    is_online = true,
    last_seen_at = now(),
    last_heartbeat = now(),
    playback_state = 'playing',
    current_canal_id = p_canal_id,
    current_canal_name = p_canal_nombre,
    current_song_title = p_cancion_titulo,
    current_song_artist = p_cancion_artista,
    device_id = p_device_id,
    updated_at = now()
  WHERE usuario_id = v_real_usuario_id;
END;
$$;
