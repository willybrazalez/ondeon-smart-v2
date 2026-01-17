-- ============================================================================
-- SISTEMA DE SESIÓN ÚNICA POR USUARIO
-- ============================================================================
-- Versión: 1.0
-- Fecha: 2025-10-27
-- Descripción: Implementa control de sesión única por usuario
--              Al iniciar sesión, cierra automáticamente sesiones previas
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: Cerrar todas las sesiones activas de un usuario
-- ============================================================================
CREATE OR REPLACE FUNCTION close_previous_user_sessions(
  p_usuario_id uuid,
  p_new_device_id text DEFAULT NULL,
  p_keep_session_id uuid DEFAULT NULL
)
RETURNS TABLE(
  closed_sessions_count integer,
  session_ids uuid[]
) AS $$
DECLARE
  v_closed_count integer;
  v_session_ids uuid[];
BEGIN
  -- Obtener IDs de las sesiones que se van a cerrar
  SELECT 
    COUNT(*)::integer,
    ARRAY_AGG(id)
  INTO v_closed_count, v_session_ids
  FROM user_presence_sessions
  WHERE usuario_id = p_usuario_id
    AND status = 'active'
    AND (p_keep_session_id IS NULL OR id != p_keep_session_id);

  -- Cerrar sesiones activas del usuario (excepto la que se va a crear)
  UPDATE user_presence_sessions
  SET 
    status = 'disconnected',
    ended_at = now(),
    total_duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::integer
  WHERE usuario_id = p_usuario_id
    AND status = 'active'
    AND (p_keep_session_id IS NULL OR id != p_keep_session_id);

  -- Actualizar user_current_state para reflejar el cierre
  UPDATE user_current_state
  SET 
    is_online = false,
    session_started_at = NULL,
    playback_state = NULL,
    current_canal_id = NULL,
    current_canal_name = NULL,
    current_song_title = NULL,
    current_song_artist = NULL,
    current_song_started_at = NULL,
    last_seen_at = now(),
    updated_at = now()
  WHERE usuario_id = p_usuario_id;

  -- Retornar información de las sesiones cerradas
  RETURN QUERY SELECT 
    v_closed_count AS closed_sessions_count, 
    v_session_ids AS session_ids;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION close_previous_user_sessions IS 
'Cierra todas las sesiones activas de un usuario para implementar sesión única. Parámetros: p_usuario_id (requerido), p_new_device_id (opcional), p_keep_session_id (opcional para mantener una sesión específica)';

-- ============================================================================
-- FUNCIÓN: Crear nueva sesión cerrando las previas
-- ============================================================================
CREATE OR REPLACE FUNCTION start_single_session(
  p_usuario_id uuid,
  p_device_id text,
  p_device_info jsonb DEFAULT NULL,
  p_app_version text DEFAULT NULL
)
RETURNS TABLE(
  new_session_id uuid,
  closed_sessions_count integer,
  previous_device_id text
) AS $$
DECLARE
  v_new_session_id uuid;
  v_closed_count integer;
  v_previous_device_id text;
BEGIN
  -- Obtener device_id de la sesión anterior (si existe)
  SELECT device_id INTO v_previous_device_id
  FROM user_current_state
  WHERE usuario_id = p_usuario_id
    AND is_online = true
  LIMIT 1;

  -- Cerrar sesiones previas
  SELECT r.closed_sessions_count INTO v_closed_count
  FROM close_previous_user_sessions(p_usuario_id, p_device_id) AS r;

  -- Crear nueva sesión
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
    p_usuario_id,
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
    p_usuario_id,
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

  -- Actualizar también el campo app_version en la tabla usuarios
  -- SOLO si p_app_version NO es NULL (es decir, solo para Electron, no para web)
  IF p_app_version IS NOT NULL THEN
    UPDATE usuarios
    SET app_version = p_app_version
    WHERE id = p_usuario_id
      AND (app_version IS NULL OR app_version != p_app_version);
  END IF;

  -- Retornar información de la operación
  RETURN QUERY SELECT 
    v_new_session_id AS new_session_id, 
    COALESCE(v_closed_count, 0) AS closed_sessions_count, 
    v_previous_device_id AS previous_device_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION start_single_session IS 
'Inicia una nueva sesión única para el usuario, cerrando automáticamente cualquier sesión previa. Retorna el ID de la nueva sesión, el número de sesiones cerradas, y el device_id de la sesión anterior.';

-- ============================================================================
-- FUNCIÓN: Verificar si el dispositivo actual tiene sesión activa
-- ============================================================================
CREATE OR REPLACE FUNCTION check_device_session(
  p_usuario_id uuid,
  p_device_id text
)
RETURNS TABLE(
  has_active_session boolean,
  session_id uuid,
  started_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(
      SELECT 1 
      FROM user_current_state 
      WHERE usuario_id = p_usuario_id 
        AND device_id = p_device_id 
        AND is_online = true
    ) as has_active_session,
    ucs.current_session_id,
    ucs.session_started_at
  FROM user_current_state ucs
  WHERE ucs.usuario_id = p_usuario_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_device_session IS 
'Verifica si un dispositivo específico tiene una sesión activa para el usuario dado.';

-- ============================================================================
-- GRANTS - Permisos para usuarios autenticados
-- ============================================================================
GRANT EXECUTE ON FUNCTION close_previous_user_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION start_single_session TO authenticated;
GRANT EXECUTE ON FUNCTION check_device_session TO authenticated;

-- ============================================================================
-- ÍNDICE ADICIONAL para mejorar performance de consultas por device_id
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_current_state_device 
  ON user_current_state(usuario_id, device_id, is_online);

CREATE INDEX IF NOT EXISTS idx_presence_sessions_device_status
  ON user_presence_sessions(usuario_id, device_id, status);

-- ============================================================================
-- TRIGGER: Notificar cuando una sesión es cerrada forzadamente
-- ============================================================================
-- Crear canal de notificación para Realtime
CREATE OR REPLACE FUNCTION notify_session_closed()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo notificar si la sesión pasó de 'active' a 'disconnected'
  IF OLD.status = 'active' AND NEW.status = 'disconnected' THEN
    -- Emitir notificación a través de pg_notify para Supabase Realtime
    PERFORM pg_notify(
      'session_closed',
      json_build_object(
        'session_id', OLD.id,
        'usuario_id', OLD.usuario_id,
        'device_id', OLD.device_id,
        'closed_at', NEW.ended_at,
        'reason', 'new_login_detected'
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger existente si existe antes de crearlo
DROP TRIGGER IF EXISTS trigger_notify_session_closed ON user_presence_sessions;

CREATE TRIGGER trigger_notify_session_closed
  AFTER UPDATE ON user_presence_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_session_closed();

COMMENT ON TRIGGER trigger_notify_session_closed ON user_presence_sessions IS 
'Notifica vía pg_notify cuando una sesión es cerrada forzadamente (para implementar notificación en tiempo real)';

-- ============================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ============================================================================
DO $$
DECLARE
  v_functions_count integer;
BEGIN
  SELECT COUNT(*) INTO v_functions_count
  FROM pg_proc
  WHERE proname IN ('close_previous_user_sessions', 'start_single_session', 'check_device_session');
  
  IF v_functions_count = 3 THEN
    RAISE NOTICE '✅ Sistema de sesión única instalado correctamente (3/3 funciones creadas)';
  ELSE
    RAISE WARNING '⚠️ Sistema de sesión única instalado parcialmente (% de 3 funciones)', v_functions_count;
  END IF;
END $$;

-- ============================================================================
-- INSTRUCCIONES DE USO
-- ============================================================================
-- 
-- 1. Al iniciar sesión desde el cliente:
--    SELECT * FROM start_single_session(
--      'usuario_id_here',
--      'device_id_here',
--      '{"os": "Windows", "browser": "Chrome"}'::jsonb,
--      '1.3.0'
--    );
--
-- 2. Para verificar sesión de dispositivo:
--    SELECT * FROM check_device_session('usuario_id', 'device_id');
--
-- 3. Para cerrar manualmente sesiones de un usuario:
--    SELECT * FROM close_previous_user_sessions('usuario_id');
--
-- ============================================================================

