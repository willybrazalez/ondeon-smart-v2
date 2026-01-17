-- ============================================================================
-- 012 - Limpieza Automática de Estados de Usuario Obsoletos
-- ============================================================================
-- 
-- PROPÓSITO:
-- Marcar como offline automáticamente a usuarios que:
-- - No han actualizado su estado en más de 5 minutos
-- - Probablemente cerraron la app sin hacer logout
--
-- CÓMO FUNCIONA:
-- 1. Crea una función que se ejecuta periódicamente
-- 2. Busca registros en user_current_state sin actividad reciente
-- 3. Los marca como offline y limpia sus datos de reproducción
--
-- ============================================================================

-- ============================================================================
-- PASO 1: Añadir columna last_heartbeat a user_current_state (si no existe)
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_current_state' 
    AND column_name = 'last_heartbeat'
  ) THEN
    ALTER TABLE user_current_state 
    ADD COLUMN last_heartbeat TIMESTAMPTZ DEFAULT NOW();
    
    -- Inicializar con el valor de updated_at para registros existentes
    UPDATE user_current_state 
    SET last_heartbeat = updated_at 
    WHERE last_heartbeat IS NULL;
  END IF;
END $$;

-- ============================================================================
-- PASO 2: Crear función de limpieza automática
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
  -- Buscar usuarios "zombie" (sin heartbeat en los últimos 5 minutos)
  -- y marcarlos como offline
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
        last_heartbeat < (NOW() - INTERVAL '5 minutes')
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
-- PASO 3: Probar la función manualmente
-- ============================================================================

-- Ejecutar limpieza manual para ver qué usuarios se marcarían como offline
SELECT * FROM cleanup_stale_user_states();

-- ============================================================================
-- PASO 4 (OPCIONAL): Configurar ejecución automática con pg_cron
-- ============================================================================

-- NOTA: Esto requiere tener la extensión pg_cron instalada en Supabase.
-- En Supabase, ve a: Database → Extensions → Habilitar "pg_cron"

-- ⚠️ NO EJECUTAR ESTE BLOQUE CON EL SCRIPT PRINCIPAL
-- Copiar y pegar SOLO esta query en una nueva ventana después de ejecutar los pasos anteriores:

-- Ver jobs programados actuales:
-- SELECT * FROM cron.job;

-- Detener el job si ya existe:
-- SELECT cron.unschedule('cleanup-stale-users');

-- ============================================================================
-- PASO 5: Crear índice para optimizar la consulta
-- ============================================================================

-- Índice para acelerar la búsqueda de usuarios offline
CREATE INDEX IF NOT EXISTS idx_user_current_state_online_heartbeat 
ON user_current_state (is_online, last_heartbeat)
WHERE is_online = true;

-- ============================================================================
-- VERIFICACIÓN: Ver usuarios que se marcarían como offline
-- ============================================================================

SELECT 
  usuario_id,
  is_online,
  playback_state,
  last_heartbeat,
  NOW() - last_heartbeat as tiempo_sin_heartbeat,
  CASE 
    WHEN last_heartbeat < (NOW() - INTERVAL '5 minutes') THEN '❌ Se marcará offline'
    WHEN last_heartbeat IS NULL THEN '❌ Sin heartbeat (se marcará offline)'
    ELSE '✅ Activo'
  END as estado_limpieza
FROM user_current_state
WHERE is_online = true
ORDER BY last_heartbeat ASC NULLS FIRST;

-- ============================================================================
-- MONITOREO: Query para verificar que la limpieza funciona
-- ============================================================================

-- Ejecutar esto después de activar el CRON job para verificar
SELECT 
  COUNT(*) FILTER (WHERE is_online = true) as usuarios_online,
  COUNT(*) FILTER (WHERE is_online = false) as usuarios_offline,
  COUNT(*) FILTER (
    WHERE is_online = true 
    AND last_heartbeat < (NOW() - INTERVAL '5 minutes')
  ) as usuarios_zombie_pendientes
FROM user_current_state;

-- ============================================================================
-- LIMPIEZA INMEDIATA (OPCIONAL)
-- ============================================================================

-- Si quieres limpiar AHORA todos los usuarios obsoletos, ejecuta:
-- SELECT * FROM cleanup_stale_user_states();

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
--
-- 1. ⚠️ Esta solución funciona SIN necesitar heartbeats desde la app
--    Se basa en el último updated_at o last_heartbeat
--
-- 2. ⚠️ Si la app NO actualiza last_heartbeat periódicamente, 
--    todos los usuarios se marcarán como offline después de 5 minutos
--    sin actividad (cambio de canción, pausa, etc.)
--
-- 3. ✅ Para mejorar la precisión, considera implementar heartbeats
--    ligeros en la app (ver Opción 2 o 3 del documento de soluciones)
--
-- 4. ⚠️ El intervalo de 5 minutos es configurable. Puedes ajustarlo:
--    - 2 minutos: Más agresivo, marca offline rápidamente
--    - 10 minutos: Más tolerante, permite desconexiones temporales
--
-- ============================================================================

