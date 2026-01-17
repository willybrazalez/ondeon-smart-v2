-- ============================================================
-- AGREGAR CAMPO session_started_at A user_current_state
-- ============================================================
-- Propósito: Permitir que el dashboard calcule la duración de la
-- sesión ACTUAL en lugar de usar last_seen_at (que acumula tiempo)
--
-- Fórmula correcta para el dashboard:
-- Duración = Date.now() - session_started_at
-- ============================================================

-- ============================================================
-- PASO 1: Agregar columna
-- ============================================================

ALTER TABLE user_current_state
ADD COLUMN IF NOT EXISTS session_started_at timestamptz;

-- Comentario para documentación
COMMENT ON COLUMN user_current_state.session_started_at IS 
'Timestamp de inicio de la sesión ACTUAL (para calcular duración en tiempo real)';

-- ============================================================
-- PASO 2: Poblar con datos existentes
-- ============================================================

-- Para usuarios online, obtener started_at de su sesión activa
UPDATE user_current_state ucs
SET session_started_at = ups.started_at
FROM user_presence_sessions ups
WHERE ucs.current_session_id = ups.id
  AND ucs.is_online = true
  AND ucs.session_started_at IS NULL;

-- Para usuarios offline, dejar en NULL
UPDATE user_current_state
SET session_started_at = NULL
WHERE is_online = false;

-- ============================================================
-- PASO 3: Verificación
-- ============================================================

-- Ver usuarios online con duración de sesión
SELECT 
  usuario_id,
  is_online,
  session_started_at,
  last_seen_at,
  EXTRACT(EPOCH FROM (NOW() - session_started_at)) / 60 as duracion_minutos,
  playback_state,
  current_canal_name
FROM user_current_state
WHERE is_online = true
ORDER BY session_started_at DESC;

-- Ver estadísticas
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN is_online = true THEN 1 END) as usuarios_online,
  COUNT(CASE WHEN is_online = true AND session_started_at IS NOT NULL THEN 1 END) as online_con_started_at,
  COUNT(CASE WHEN is_online = false AND session_started_at IS NULL THEN 1 END) as offline_sin_started_at
FROM user_current_state;

-- ============================================================
-- NOTAS PARA EL DASHBOARD
-- ============================================================
-- 
-- ✅ Cálculo CORRECTO de duración:
-- const duracion = Date.now() - new Date(user.session_started_at).getTime()
-- 
-- ✅ Regla de negocio:
-- - Si is_online = true → Calcular duración desde session_started_at
-- - Si is_online = false → Mostrar duración = 0 o "Offline"
-- - Si session_started_at = null → Mostrar "N/A"
-- 
-- ❌ NO usar last_seen_at para calcular duración (acumula tiempo)
-- 
-- ============================================================

