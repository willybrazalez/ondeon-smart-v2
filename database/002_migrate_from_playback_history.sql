-- ============================================================================
-- MIGRACIÓN DESDE playback_history AL NUEVO SISTEMA
-- ============================================================================
-- Versión: 1.0
-- Fecha: 2025-10-20
-- Descripción: Script opcional para migrar datos existentes de playback_history
--              al nuevo sistema de user_activity_events
-- ============================================================================

-- IMPORTANTE: Este script es OPCIONAL
-- Solo ejecutarlo si:
-- 1. Ya tienes datos en playback_history que quieres conservar
-- 2. Ya ejecutaste 001_create_presence_system.sql
-- 3. Quieres mantener el historial antiguo en el nuevo sistema

-- ============================================================================
-- VERIFICACIÓN PREVIA
-- ============================================================================

DO $$
DECLARE
  v_old_table_exists boolean;
  v_new_table_exists boolean;
BEGIN
  -- Verificar si existe playback_history
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'playback_history' AND table_schema = 'public'
  ) INTO v_old_table_exists;
  
  -- Verificar si existe user_activity_events
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_activity_events' AND table_schema = 'public'
  ) INTO v_new_table_exists;
  
  IF NOT v_old_table_exists THEN
    RAISE NOTICE '⚠️ La tabla playback_history no existe. No es necesario migrar.';
  END IF;
  
  IF NOT v_new_table_exists THEN
    RAISE EXCEPTION '❌ La tabla user_activity_events no existe. Ejecuta primero 001_create_presence_system.sql';
  END IF;
  
  IF v_old_table_exists AND v_new_table_exists THEN
    RAISE NOTICE '✅ Ambas tablas existen. Listo para migrar.';
  END IF;
END $$;

-- ============================================================================
-- MIGRACIÓN DE DATOS
-- ============================================================================

-- Nota: La tabla playback_history tiene la siguiente estructura (según el código):
-- - id
-- - usuario_id
-- - created_at
-- - event_type (song, channel_change, scheduled_content, login, logout)
-- - title
-- - artist
-- - canal_id
-- - channel_name
-- - duration_seconds
-- - programacion_id
-- - metadata (jsonb)

-- Migrar eventos de canciones
INSERT INTO user_activity_events (
  usuario_id,
  session_id,
  created_at,
  event_type,
  canal_id,
  canal_name,
  content_title,
  content_artist,
  content_duration_seconds,
  event_data
)
SELECT 
  ph.usuario_id,
  NULL, -- session_id no disponible en datos antiguos
  ph.created_at,
  'song_changed', -- Normalizar event_type
  ph.canal_id,
  ph.channel_name,
  ph.title,
  ph.artist,
  ph.duration_seconds,
  COALESCE(ph.metadata, '{}'::jsonb) -- Preservar metadata existente
FROM playback_history ph
WHERE ph.event_type = 'song'
ON CONFLICT (id) DO NOTHING; -- Por si ya se migró

-- Migrar eventos de cambio de canal
INSERT INTO user_activity_events (
  usuario_id,
  session_id,
  created_at,
  event_type,
  canal_id,
  canal_name,
  content_title,
  content_artist,
  content_duration_seconds,
  event_data
)
SELECT 
  ph.usuario_id,
  NULL,
  ph.created_at,
  'channel_changed',
  ph.canal_id,
  ph.channel_name,
  ph.title,
  NULL,
  NULL,
  jsonb_build_object(
    'from_channel', COALESCE(ph.metadata->>'from_channel', 'Desconocido')
  )
FROM playback_history ph
WHERE ph.event_type = 'channel_change'
ON CONFLICT (id) DO NOTHING;

-- Migrar eventos de contenido programado
-- Nota: playback_history solo tiene un evento, el nuevo sistema tiene start/end
INSERT INTO user_activity_events (
  usuario_id,
  session_id,
  created_at,
  event_type,
  canal_id,
  canal_name,
  content_title,
  content_artist,
  content_duration_seconds,
  event_data
)
SELECT 
  ph.usuario_id,
  NULL,
  ph.created_at,
  'scheduled_content_started', -- Asumir que es inicio
  ph.canal_id,
  ph.channel_name,
  ph.title,
  ph.artist, -- En el viejo sistema se guardaba tipo_contenido aquí
  ph.duration_seconds,
  jsonb_build_object(
    'programacion_id', ph.programacion_id,
    'tipo_contenido', COALESCE(ph.metadata->>'tipo_contenido', 'content'),
    'modo_audio', COALESCE(ph.metadata->>'modo_audio', 'overlay'),
    'descripcion_prog', COALESCE(ph.metadata->>'descripcion_prog', '')
  )
FROM playback_history ph
WHERE ph.event_type = 'scheduled_content'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ESTADÍSTICAS DE MIGRACIÓN
-- ============================================================================

DO $$
DECLARE
  v_songs_migrated bigint;
  v_channel_changes_migrated bigint;
  v_scheduled_content_migrated bigint;
  v_total_old bigint;
  v_total_new bigint;
BEGIN
  -- Contar registros antiguos
  SELECT COUNT(*) INTO v_total_old FROM playback_history;
  
  -- Contar registros nuevos por tipo
  SELECT COUNT(*) INTO v_songs_migrated 
  FROM user_activity_events WHERE event_type = 'song_changed';
  
  SELECT COUNT(*) INTO v_channel_changes_migrated 
  FROM user_activity_events WHERE event_type = 'channel_changed';
  
  SELECT COUNT(*) INTO v_scheduled_content_migrated 
  FROM user_activity_events WHERE event_type = 'scheduled_content_started';
  
  SELECT COUNT(*) INTO v_total_new FROM user_activity_events;
  
  RAISE NOTICE '📊 ESTADÍSTICAS DE MIGRACIÓN:';
  RAISE NOTICE '   - Registros en playback_history: %', v_total_old;
  RAISE NOTICE '   - Canciones migradas: %', v_songs_migrated;
  RAISE NOTICE '   - Cambios de canal migrados: %', v_channel_changes_migrated;
  RAISE NOTICE '   - Contenido programado migrado: %', v_scheduled_content_migrated;
  RAISE NOTICE '   - Total en user_activity_events: %', v_total_new;
  RAISE NOTICE '✅ Migración completada';
END $$;

-- ============================================================================
-- OPCIONAL: RENOMBRAR O ELIMINAR TABLA ANTIGUA
-- ============================================================================

-- Opción 1: Renombrar playback_history como backup (RECOMENDADO)
-- ALTER TABLE playback_history RENAME TO playback_history_backup_20251020;
-- COMMENT ON TABLE playback_history_backup_20251020 IS 'Backup de playback_history antes de migración al nuevo sistema';

-- Opción 2: Eliminar playback_history (CUIDADO: irreversible)
-- DROP TABLE playback_history CASCADE;

-- Por defecto, dejamos la tabla intacta para que puedas decidir

RAISE NOTICE '⚠️  IMPORTANTE: La tabla playback_history sigue existiendo.';
RAISE NOTICE '   Si la migración fue exitosa, puedes:';
RAISE NOTICE '   1. Renombrarla como backup: ALTER TABLE playback_history RENAME TO playback_history_backup;';
RAISE NOTICE '   2. Eliminarla: DROP TABLE playback_history CASCADE;';
RAISE NOTICE '   O mantenerla si prefieres conservar los datos originales.';

-- ============================================================================
-- FIN DEL SCRIPT DE MIGRACIÓN
-- ============================================================================

