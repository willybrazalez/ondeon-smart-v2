-- ============================================================================
-- SISTEMA DE PRESENCIA Y ACTIVIDAD DE USUARIOS - OPTIMIZADO
-- ============================================================================
-- Versión: 1.0
-- Fecha: 2025-10-20
-- Descripción: Sistema híbrido de presencia en tiempo real y registro de actividad
--              Optimizado para 62+ usuarios concurrentes
-- ============================================================================

-- ============================================================================
-- TABLA 1: user_presence_sessions
-- Propósito: Rastrear sesiones de conexión (login/logout)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_presence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Timestamps
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  
  -- Info del dispositivo
  device_id text,
  device_info jsonb,
  app_version text,
  
  -- Estado de la sesión
  status text NOT NULL DEFAULT 'active',
  
  -- Métricas de la sesión (calculadas al cerrar)
  total_duration_seconds integer,
  
  -- Constraint para validar status
  CONSTRAINT valid_session_status CHECK (status IN ('active', 'idle', 'disconnected'))
);

-- Comentarios para documentación
COMMENT ON TABLE user_presence_sessions IS 'Registra sesiones de usuario con inicio, fin y estado';
COMMENT ON COLUMN user_presence_sessions.status IS 'active: conectado activo, idle: sin actividad, disconnected: desconectado';
COMMENT ON COLUMN user_presence_sessions.device_id IS 'ID único del dispositivo (generado en cliente)';
COMMENT ON COLUMN user_presence_sessions.total_duration_seconds IS 'Duración total de la sesión en segundos (calculado al cerrar)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_presence_sessions_usuario 
  ON user_presence_sessions(usuario_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_presence_sessions_active 
  ON user_presence_sessions(usuario_id, status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_presence_sessions_recent 
  ON user_presence_sessions(last_activity_at DESC) 
  WHERE status = 'active';

-- ============================================================================
-- TABLA 2: user_activity_events
-- Propósito: Registrar TODOS los eventos de actividad del usuario
-- Reemplaza: playback_history (con estructura mejorada)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Usuario y sesión
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  session_id uuid REFERENCES user_presence_sessions(id) ON DELETE SET NULL,
  
  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Tipo de evento
  event_type text NOT NULL,
  
  -- Datos del canal (si aplica)
  canal_id uuid REFERENCES canales_genericos(id) ON DELETE SET NULL,
  canal_name text,
  
  -- Datos de contenido (canciones, anuncios, etc.)
  content_title text,
  content_artist text,
  content_duration_seconds integer,
  
  -- Datos específicos del evento (estructura flexible)
  event_data jsonb,
  
  -- Constraint para validar tipos de evento
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'song_changed',
    'channel_changed',
    'playback_state_changed',
    'scheduled_content_started',
    'scheduled_content_ended',
    'manual_content_started',
    'manual_content_ended',
    'playback_error'
  ))
);

-- Comentarios para documentación
COMMENT ON TABLE user_activity_events IS 'Registro de todos los eventos de actividad del usuario';
COMMENT ON COLUMN user_activity_events.event_type IS 'Tipo de evento: song_changed, channel_changed, playback_state_changed, etc.';
COMMENT ON COLUMN user_activity_events.event_data IS 'Datos adicionales en formato JSON flexible según tipo de evento';

-- Ejemplos de event_data por tipo:
-- song_changed: {"song_id": "uuid", "playlist_id": "uuid"}
-- channel_changed: {"from_channel": "Rock", "to_channel": "Jazz", "from_channel_id": "uuid"}
-- playback_error: {"error_type": "stream_failed", "error_message": "Failed to load"}
-- scheduled_content: {"programacion_id": "uuid", "tipo_contenido": "ad", "modo_audio": "overlay"}

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_activity_events_usuario_time 
  ON user_activity_events(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_type 
  ON user_activity_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_session 
  ON user_activity_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_canal 
  ON user_activity_events(canal_id, created_at DESC) 
  WHERE canal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_events_recent 
  ON user_activity_events(created_at DESC);

-- Índice GIN para búsquedas en event_data (JSON)
CREATE INDEX IF NOT EXISTS idx_activity_events_data 
  ON user_activity_events USING GIN (event_data);

-- ============================================================================
-- TABLA 3: user_current_state
-- Propósito: Estado actual de cada usuario (snapshot para consultas rápidas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_current_state (
  usuario_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Estado de presencia
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  
  -- Estado de reproducción
  playback_state text, -- 'playing', 'paused', 'stopped', null
  current_canal_id uuid REFERENCES canales_genericos(id) ON DELETE SET NULL,
  current_canal_name text,
  current_song_title text,
  current_song_artist text,
  current_song_started_at timestamptz,
  
  -- Sesión actual
  current_session_id uuid REFERENCES user_presence_sessions(id) ON DELETE SET NULL,
  
  -- Info del dispositivo actual
  device_id text,
  app_version text,
  
  -- Metadata adicional (estructura flexible)
  metadata jsonb,
  
  -- Actualizado automáticamente
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraint para validar playback_state
  CONSTRAINT valid_playback_state CHECK (playback_state IN ('playing', 'paused', 'stopped'))
);

-- Comentarios para documentación
COMMENT ON TABLE user_current_state IS 'Estado actual de cada usuario (para consultas rápidas en dashboard)';
COMMENT ON COLUMN user_current_state.is_online IS 'true si el usuario está conectado actualmente';
COMMENT ON COLUMN user_current_state.playback_state IS 'Estado de reproducción: playing, paused, stopped';
COMMENT ON COLUMN user_current_state.metadata IS 'Datos adicionales en formato JSON (ej: ubicación, preferencias)';

-- Índices para consultas del dashboard
CREATE INDEX IF NOT EXISTS idx_current_state_online 
  ON user_current_state(is_online, last_seen_at DESC) 
  WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_current_state_canal 
  ON user_current_state(current_canal_id) 
  WHERE current_canal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_current_state_updated 
  ON user_current_state(updated_at DESC);

-- ============================================================================
-- VISTAS PARA FACILITAR CONSULTAS DEL DASHBOARD
-- ============================================================================

-- Vista: Usuarios online ahora mismo
CREATE OR REPLACE VIEW v_users_online AS
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_name,
  u.email,
  COALESCE(u.rol_id, u.role, 'user') as usuario_role,
  ucs.playback_state,
  ucs.current_canal_id,
  ucs.current_canal_name,
  ucs.current_song_title,
  ucs.current_song_artist,
  ucs.current_song_started_at,
  ucs.last_seen_at,
  EXTRACT(EPOCH FROM (now() - ucs.last_seen_at))::integer as seconds_since_activity,
  ucs.device_id,
  ucs.app_version,
  ucs.metadata
FROM usuarios u
INNER JOIN user_current_state ucs ON u.id = ucs.usuario_id
WHERE ucs.is_online = true
ORDER BY ucs.last_seen_at DESC;

COMMENT ON VIEW v_users_online IS 'Lista de usuarios conectados con su estado actual de reproducción';

-- Vista: Actividad reciente (últimas 24 horas)
CREATE OR REPLACE VIEW v_recent_activity AS
SELECT 
  uae.id,
  uae.usuario_id,
  u.nombre as usuario_name,
  u.email as usuario_email,
  uae.event_type,
  uae.created_at,
  uae.canal_id,
  uae.canal_name,
  uae.content_title,
  uae.content_artist,
  uae.content_duration_seconds,
  uae.event_data,
  uae.session_id
FROM user_activity_events uae
INNER JOIN usuarios u ON uae.usuario_id = u.id
WHERE uae.created_at > (now() - interval '24 hours')
ORDER BY uae.created_at DESC;

COMMENT ON VIEW v_recent_activity IS 'Actividad de usuarios en las últimas 24 horas';

-- Vista: Sesiones activas
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT 
  ups.id as session_id,
  ups.usuario_id,
  u.nombre as usuario_name,
  u.email as usuario_email,
  ups.started_at,
  ups.last_activity_at,
  EXTRACT(EPOCH FROM (now() - ups.started_at))::integer as session_duration_seconds,
  ups.device_id,
  ups.device_info,
  ups.app_version,
  ups.status
FROM user_presence_sessions ups
INNER JOIN usuarios u ON ups.usuario_id = u.id
WHERE ups.status = 'active'
ORDER BY ups.last_activity_at DESC;

COMMENT ON VIEW v_active_sessions IS 'Sesiones activas con duración calculada en tiempo real';

-- Vista: Estadísticas por usuario (últimas 24h)
CREATE OR REPLACE VIEW v_user_stats_24h AS
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_name,
  COUNT(CASE WHEN uae.event_type = 'song_changed' THEN 1 END) as songs_played,
  COUNT(CASE WHEN uae.event_type = 'channel_changed' THEN 1 END) as channel_changes,
  COUNT(CASE WHEN uae.event_type = 'playback_error' THEN 1 END) as errors_count,
  COUNT(CASE WHEN uae.event_type LIKE 'scheduled_content_%' THEN 1 END) as scheduled_content_count,
  MIN(uae.created_at) as first_activity,
  MAX(uae.created_at) as last_activity,
  COUNT(DISTINCT uae.canal_id) as unique_channels_used
FROM usuarios u
LEFT JOIN user_activity_events uae ON u.id = uae.usuario_id 
  AND uae.created_at > (now() - interval '24 hours')
GROUP BY u.id, u.nombre
ORDER BY last_activity DESC NULLS LAST;

COMMENT ON VIEW v_user_stats_24h IS 'Estadísticas de actividad por usuario en las últimas 24 horas';

-- ============================================================================
-- FUNCIONES DE UTILIDAD
-- ============================================================================

-- Función: Limpiar eventos antiguos (retención configurable)
CREATE OR REPLACE FUNCTION cleanup_old_activity_events(retention_days integer DEFAULT 30)
RETURNS TABLE(deleted_events bigint, deleted_sessions bigint) AS $$
DECLARE
  v_deleted_events bigint;
  v_deleted_sessions bigint;
BEGIN
  -- Limpiar eventos antiguos
  DELETE FROM user_activity_events
  WHERE created_at < (now() - make_interval(days => retention_days));
  
  GET DIAGNOSTICS v_deleted_events = ROW_COUNT;
  
  -- Limpiar sesiones antiguas desconectadas (90 días por defecto)
  DELETE FROM user_presence_sessions
  WHERE started_at < (now() - interval '90 days')
  AND status = 'disconnected';
  
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_events, v_deleted_sessions;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_activity_events IS 'Limpia eventos y sesiones antiguas. Llamar periódicamente desde cliente o pg_cron';

-- Función: Obtener historial del usuario con paginación
CREATE OR REPLACE FUNCTION get_user_activity_history(
  p_usuario_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_event_type text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  event_type text,
  created_at timestamptz,
  canal_name text,
  content_title text,
  content_artist text,
  content_duration_seconds integer,
  event_data jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uae.id,
    uae.event_type,
    uae.created_at,
    uae.canal_name,
    uae.content_title,
    uae.content_artist,
    uae.content_duration_seconds,
    uae.event_data
  FROM user_activity_events uae
  WHERE uae.usuario_id = p_usuario_id
    AND (p_event_type IS NULL OR uae.event_type = p_event_type)
  ORDER BY uae.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_activity_history IS 'Obtiene historial de actividad del usuario con paginación y filtros';

-- Función: Actualizar last_activity_at de la sesión
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_presence_sessions
  SET last_activity_at = now()
  WHERE id = p_session_id AND status = 'active';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_session_activity IS 'Actualiza el timestamp de última actividad de una sesión';

-- ============================================================================
-- TRIGGER: Actualizar updated_at en user_current_state
-- ============================================================================
CREATE OR REPLACE FUNCTION update_current_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_current_state_timestamp
  BEFORE UPDATE ON user_current_state
  FOR EACH ROW
  EXECUTE FUNCTION update_current_state_timestamp();

COMMENT ON TRIGGER trigger_update_current_state_timestamp ON user_current_state IS 'Actualiza automáticamente updated_at al modificar el estado';

-- ============================================================================
-- RLS (Row Level Security) - OPCIONAL
-- Habilitar si necesitas que los usuarios solo vean sus propios datos
-- ============================================================================

-- Ejemplo: Habilitar RLS en user_activity_events
-- ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven sus propios eventos
-- CREATE POLICY "Users can view own activity" ON user_activity_events
--   FOR SELECT
--   USING (auth.uid() = usuario_id);

-- Política: Los admins ven todos los eventos
-- CREATE POLICY "Admins can view all activity" ON user_activity_events
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM usuarios 
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );

-- ============================================================================
-- GRANTS - Permisos para roles de Supabase
-- ============================================================================

-- Dar permisos al rol autenticado (usuarios de la app)
GRANT SELECT, INSERT, UPDATE ON user_presence_sessions TO authenticated;
GRANT SELECT, INSERT ON user_activity_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_current_state TO authenticated;

-- Permisos en vistas
GRANT SELECT ON v_users_online TO authenticated;
GRANT SELECT ON v_recent_activity TO authenticated;
GRANT SELECT ON v_active_sessions TO authenticated;
GRANT SELECT ON v_user_stats_24h TO authenticated;

-- Permisos en funciones
GRANT EXECUTE ON FUNCTION get_user_activity_history TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_activity TO authenticated;

-- Solo admins pueden ejecutar cleanup
GRANT EXECUTE ON FUNCTION cleanup_old_activity_events TO postgres;

-- ============================================================================
-- DATOS INICIALES - Crear entrada en user_current_state para usuarios existentes
-- ============================================================================
INSERT INTO user_current_state (usuario_id, is_online, last_seen_at)
SELECT id, false, now()
FROM usuarios
WHERE NOT EXISTS (
  SELECT 1 FROM user_current_state WHERE usuario_id = usuarios.id
)
ON CONFLICT (usuario_id) DO NOTHING;

-- ============================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ============================================================================

-- Verificar que las tablas se crearon correctamente
DO $$
DECLARE
  v_tables_count integer;
BEGIN
  SELECT COUNT(*) INTO v_tables_count
  FROM information_schema.tables
  WHERE table_name IN ('user_presence_sessions', 'user_activity_events', 'user_current_state')
    AND table_schema = 'public';
  
  IF v_tables_count = 3 THEN
    RAISE NOTICE '✅ Sistema de presencia instalado correctamente (3/3 tablas creadas)';
  ELSE
    RAISE WARNING '⚠️ Sistema de presencia instalado parcialmente (% de 3 tablas)', v_tables_count;
  END IF;
END $$;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Para ejecutar este script en Supabase:
-- 1. Ir a SQL Editor en el dashboard de Supabase
-- 2. Copiar y pegar todo este contenido
-- 3. Ejecutar (Run)
-- 4. Verificar que aparece el mensaje "✅ Sistema de presencia instalado correctamente"

