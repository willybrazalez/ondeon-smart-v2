-- ============================================================
-- LIMPIEZA DE TABLAS ANTIGUAS
-- ============================================================
-- Este script elimina tablas/vistas que ya no se usan
-- ============================================================

-- ============================================================
-- 1. Eliminar user_activity_log (tabla vieja)
-- ============================================================
-- Esta tabla era del sistema anterior y ya no se usa
-- El nuevo sistema usa user_activity_events

-- Ver si existe y cuántos registros tiene
SELECT 
  'user_activity_log' as tabla,
  COUNT(*) as registros,
  pg_size_pretty(pg_total_relation_size('user_activity_log'::regclass)) as tamaño
FROM user_activity_log;

-- ⚠️ Si quieres guardar backup antes de eliminar (opcional):
-- CREATE TABLE user_activity_log_backup AS SELECT * FROM user_activity_log;

-- Eliminar la tabla
DROP TABLE IF EXISTS user_activity_log CASCADE;

-- Verificar eliminación
SELECT 
  'user_activity_log eliminada' as resultado,
  NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_activity_log'
  ) as eliminada;

-- ============================================================
-- NOTA: NO eliminamos v_user_stats_24h ni v_users_online
-- ============================================================
-- Estas vistas se mantienen porque:
-- - v_user_stats_24h: Se usa en useUserActivity.js como fallback
-- - v_users_online: Se usa para el dashboard externo
-- 
-- Si en el futuro quieres eliminarlas:
-- DROP VIEW IF EXISTS v_user_stats_24h CASCADE;
-- DROP VIEW IF EXISTS v_users_online CASCADE;
-- ============================================================

