-- ============================================================================
-- 012c - Ajustar Timeout de Heartbeat para Detección Más Rápida
-- ============================================================================
-- 
-- EJECUTAR DESPUÉS de implementar lightweightHeartbeatService en la app
-- 
-- Con heartbeats activos, podemos ser más agresivos en la detección:
-- - Heartbeats se envían cada 60 segundos
-- - Si no hay heartbeat en 3 minutos → marcar offline
-- 
-- ============================================================================

-- ============================================================================
-- PASO 1: Actualizar la función para usar timeout de 3 minutos
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_stale_user_states()
RETURNS TABLE(
  usuarios_marcados_offline INTEGER,
  usuarios_afectados TEXT[]
) 
LANGUAGE plpgsql
AS $$
DECLARE
  affected_count INTEGER;
  affected_users TEXT[];
BEGIN
  -- Buscar usuarios "zombie" (sin heartbeat en los últimos 3 minutos)
  -- ⚡ CAMBIADO: De 5 minutos a 3 minutos (más agresivo con heartbeats activos)
  WITH updated_users AS (
    UPDATE user_current_state
    SET 
      is_online = false,
      playback_state = null,
      current_canal_id = null,
      current_canal_name = null,
      current_song_title = null,
      current_song_artist = null,
      current_song_started_at = null,
      session_started_at = null,
      updated_at = NOW()
    WHERE 
      is_online = true
      AND (
        last_heartbeat < (NOW() - INTERVAL '3 minutes')  -- ⚡ Cambiado de 5 a 3 minutos
        OR last_heartbeat IS NULL
      )
    RETURNING usuario_id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(usuario_id::TEXT)
  INTO affected_count, affected_users
  FROM updated_users;

  -- Retornar resultados
  RETURN QUERY SELECT affected_count, affected_users;
END;
$$;

-- ============================================================================
-- PASO 2: Verificar que se actualizó correctamente
-- ============================================================================

-- Ejecutar manualmente para probar:
SELECT * FROM cleanup_stale_user_states();

-- ============================================================================
-- VERIFICACIÓN: Ver usuarios que se marcarían como offline con el nuevo timeout
-- ============================================================================

SELECT 
  usuario_id,
  is_online,
  playback_state,
  last_heartbeat,
  NOW() - last_heartbeat as tiempo_sin_heartbeat,
  CASE 
    WHEN last_heartbeat < (NOW() - INTERVAL '3 minutes') THEN '❌ Se marcará offline (3+ min)'
    WHEN last_heartbeat < (NOW() - INTERVAL '2 minutes') THEN '⚠️ Cerca del timeout (2-3 min)'
    WHEN last_heartbeat IS NULL THEN '❌ Sin heartbeat (offline inmediato)'
    ELSE '✅ Activo (< 2 min)'
  END as estado_limpieza,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::INTEGER as segundos_sin_heartbeat
FROM user_current_state
WHERE is_online = true
ORDER BY last_heartbeat ASC NULLS FIRST;

-- ============================================================================
-- MONITOREO: Query para verificar salud del sistema con heartbeats
-- ============================================================================

SELECT 
  COUNT(*) FILTER (WHERE is_online = true) as usuarios_online,
  COUNT(*) FILTER (WHERE is_online = false) as usuarios_offline,
  COUNT(*) FILTER (
    WHERE is_online = true 
    AND last_heartbeat < (NOW() - INTERVAL '3 minutes')
  ) as zombies_pendientes_3min,
  COUNT(*) FILTER (
    WHERE is_online = true 
    AND (last_heartbeat IS NULL OR last_heartbeat < (NOW() - INTERVAL '2 minutes'))
  ) as usuarios_con_heartbeat_atrasado,
  -- Promedio de segundos desde último heartbeat (debe ser < 60s si funciona bien)
  AVG(EXTRACT(EPOCH FROM (NOW() - last_heartbeat))) FILTER (WHERE is_online = true)::INTEGER as promedio_segundos_ultimo_heartbeat,
  -- Máximo de segundos sin heartbeat (debe ser < 180s)
  MAX(EXTRACT(EPOCH FROM (NOW() - last_heartbeat))) FILTER (WHERE is_online = true)::INTEGER as maximo_segundos_sin_heartbeat
FROM user_current_state;

-- Resultado esperado después de implementar heartbeats:
-- - promedio_segundos_ultimo_heartbeat: ~30-60 segundos
-- - maximo_segundos_sin_heartbeat: < 180 segundos (3 minutos)
-- - zombies_pendientes_3min: 0 (o muy pocos)

-- ============================================================================
-- TESTING: Verificar que los heartbeats se están enviando
-- ============================================================================

-- Ver últimos heartbeats de todos los usuarios online:
SELECT 
  usuario_id,
  last_heartbeat,
  NOW() - last_heartbeat as tiempo_desde_ultimo,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::INTEGER as segundos,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) < 90 THEN '✅ Heartbeat OK'
    WHEN EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) < 180 THEN '⚠️ Heartbeat retrasado'
    ELSE '❌ Sin heartbeat'
  END as estado
FROM user_current_state
WHERE is_online = true
ORDER BY last_heartbeat DESC;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Si ves usuarios con heartbeat_retrasado (90-180 segundos):
-- 1. Verificar que lightweightHeartbeatService está activo en la app
-- 2. Revisar logs del navegador: buscar "💓 Heartbeat OK"
-- 3. Verificar que no hay errores de permisos RLS en Supabase

-- Si ves usuarios sin heartbeat (NULL o > 180 segundos):
-- 1. Verificar que se inició el servicio: window.lightweightHeartbeat.getStats()
-- 2. Verificar que el CRON job está ejecutándose cada 2 minutos
-- 3. Revisar logs de errores en cron.job_run_details

-- ============================================================================
-- COMPARATIVA: Antes vs Después de Heartbeats
-- ============================================================================

-- ANTES (sin heartbeats):
-- - Timeout: 5-10 minutos
-- - Falsos positivos: SÍ (usuarios escuchando música marcados como offline)
-- - Precisión: ⚠️ Baja

-- DESPUÉS (con heartbeats):
-- - Timeout: 3 minutos
-- - Falsos positivos: NO (heartbeat confirma que app está abierta)
-- - Precisión: ✅ Alta

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. ⚡ El timeout de 3 minutos asume que heartbeats se envían cada 60 segundos
--    3 minutos = 3 heartbeats perdidos = usuario definitivamente offline
--
-- 2. ✅ Con heartbeats, NO hay falsos positivos:
--    - Usuario escuchando música SIN hacer nada → Sigue enviando heartbeats → Online ✅
--    - Usuario cierra app → NO más heartbeats → Offline en 3 min ✅
--
-- 3. ⚙️ Si el CRON job se ejecuta cada 2 minutos, la detección real será:
--    - Mínimo: 3 minutos (si cierra justo antes de un CRON)
--    - Máximo: 5 minutos (3 min sin heartbeat + 2 min hasta próximo CRON)
--    - Promedio: ~4 minutos
--
-- 4. 🔧 Si quieres detección más rápida (2-3 min), cambia el CRON a cada 1 minuto:
--    SELECT cron.schedule('cleanup-stale-users', '* * * * *', $$SELECT cleanup_stale_user_states();$$);
--
-- ============================================================================







