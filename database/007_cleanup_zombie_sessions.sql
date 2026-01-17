-- ============================================================================
-- 007 - Limpieza de Sesiones "Zombie" Activas
-- ============================================================================
-- 
-- PROPÓSITO:
-- Este script cierra todas las sesiones que quedaron marcadas como 'active'
-- sin un 'ended_at', que son sesiones "zombie" creadas cuando:
-- - El usuario refrescó la página sin hacer logout
-- - La app se cerró abruptamente
-- - Se perdió la conexión sin logout explícito
--
-- CUÁNDO EJECUTAR:
-- - Una sola vez para limpiar sesiones antiguas
-- - Después de implementar el fix en optimizedPresenceService.js
--
-- NOTA:
-- Después de ejecutar este script, el código actualizado prevendrá que se
-- creen nuevas sesiones zombie (closePreviousSessions() en startPresence).
--
-- ============================================================================

-- Ver cuántas sesiones zombie hay actualmente
SELECT 
  COUNT(*) as sesiones_zombie,
  COUNT(DISTINCT usuario_id) as usuarios_afectados
FROM user_presence_sessions
WHERE status = 'active' 
  AND ended_at IS NULL
  AND started_at < (NOW() - INTERVAL '1 hour'); -- Más de 1 hora sin actualizar

-- ============================================================================
-- PASO 1: Cerrar sesiones zombie (más de 1 hora sin actividad)
-- ============================================================================

UPDATE user_presence_sessions
SET 
  ended_at = COALESCE(last_activity_at, started_at),
  status = 'disconnected',
  total_duration_seconds = EXTRACT(EPOCH FROM (
    COALESCE(last_activity_at, started_at) - started_at
  ))::INTEGER
WHERE status = 'active'
  AND ended_at IS NULL
  AND started_at < (NOW() - INTERVAL '1 hour');

-- Verificar resultado
SELECT 
  '✅ Sesiones zombie cerradas' as resultado,
  COUNT(*) as total_cerradas
FROM user_presence_sessions
WHERE status = 'disconnected'
  AND ended_at > (NOW() - INTERVAL '1 minute');

-- ============================================================================
-- PASO 2: Ver estado actual de las sesiones
-- ============================================================================

SELECT 
  status,
  COUNT(*) as cantidad,
  COUNT(DISTINCT usuario_id) as usuarios_unicos
FROM user_presence_sessions
GROUP BY status
ORDER BY status;

-- ============================================================================
-- PASO 3: Ver sesiones activas restantes (deberían ser pocas)
-- ============================================================================

SELECT 
  usuario_id,
  COUNT(*) as sesiones_activas,
  MAX(started_at) as ultima_sesion,
  MAX(last_activity_at) as ultima_actividad
FROM user_presence_sessions
WHERE status = 'active'
  AND ended_at IS NULL
GROUP BY usuario_id
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- PASO 4 (OPCIONAL): Mantener solo la sesión más reciente por usuario
-- ============================================================================
-- 
-- Si aún ves múltiples sesiones activas por usuario después del PASO 1,
-- este query cierra todas excepto la más reciente.
--
-- ⚠️ ADVERTENCIA: Solo ejecutar si sabes que no hay usuarios realmente
-- conectados con múltiples dispositivos.
-- ============================================================================

-- Descomentar para ejecutar:
/*
WITH ranked_sessions AS (
  SELECT 
    id,
    usuario_id,
    started_at,
    last_activity_at,
    ROW_NUMBER() OVER (
      PARTITION BY usuario_id 
      ORDER BY COALESCE(last_activity_at, started_at) DESC
    ) as rn
  FROM user_presence_sessions
  WHERE status = 'active'
    AND ended_at IS NULL
)
UPDATE user_presence_sessions ups
SET 
  ended_at = COALESCE(rs.last_activity_at, rs.started_at),
  status = 'disconnected',
  total_duration_seconds = EXTRACT(EPOCH FROM (
    COALESCE(rs.last_activity_at, rs.started_at) - rs.started_at
  ))::INTEGER
FROM ranked_sessions rs
WHERE ups.id = rs.id
  AND rs.rn > 1; -- Cerrar todas excepto la más reciente (rn=1)
*/

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

SELECT 
  '✅ Limpieza completada' as resultado,
  (SELECT COUNT(*) FROM user_presence_sessions WHERE status = 'active') as sesiones_activas,
  (SELECT COUNT(*) FROM user_presence_sessions WHERE status = 'disconnected') as sesiones_cerradas,
  (SELECT COUNT(*) FROM user_presence_sessions) as total_sesiones;

-- ============================================================================
-- RECOMENDACIONES
-- ============================================================================
--
-- 1. ✅ Ejecutar este script una sola vez para limpiar el estado actual
--
-- 2. ✅ El código actualizado (optimizedPresenceService.js) ahora cierra
--       automáticamente sesiones previas en cada login
--
-- 3. ✅ Considerar crear un CRON job para ejecutar limpieza periódica:
--       - Frecuencia: 1 vez al día
--       - Acción: Cerrar sesiones con más de 24 horas sin actividad
--
-- 4. ✅ Monitorear regularmente:
--       SELECT COUNT(*) FROM user_presence_sessions WHERE status = 'active';
--       (Debería ser igual o menor al número de usuarios realmente conectados)
--
-- ============================================================================

-- Ejemplo de consulta para monitoreo diario:
SELECT 
  DATE(started_at) as fecha,
  COUNT(*) as sesiones_creadas,
  COUNT(CASE WHEN status = 'disconnected' THEN 1 END) as sesiones_cerradas,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as sesiones_activas
FROM user_presence_sessions
WHERE started_at > (NOW() - INTERVAL '7 days')
GROUP BY DATE(started_at)
ORDER BY fecha DESC;

