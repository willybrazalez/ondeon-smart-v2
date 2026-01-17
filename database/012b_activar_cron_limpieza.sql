-- ============================================================================
-- 012b - Activar CRON Job para Limpieza Automática de Usuarios Stale
-- ============================================================================
-- 
-- ⚠️ EJECUTAR ESTE SCRIPT **DESPUÉS** de ejecutar 012_auto_cleanup_stale_users.sql
-- 
-- REQUISITOS:
-- 1. Extensión pg_cron debe estar habilitada en Supabase
--    (Ve a: Database → Extensions → Buscar "pg_cron" → Habilitar)
-- 2. La función cleanup_stale_user_states() debe existir
-- 
-- ============================================================================

-- ============================================================================
-- PASO 1: Verificar que pg_cron está disponible
-- ============================================================================

SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Si no retorna nada, ve a Database → Extensions y habilita "pg_cron"

-- ============================================================================
-- PASO 2: Verificar que la función existe
-- ============================================================================

SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name = 'cleanup_stale_user_states';

-- Debe retornar: cleanup_stale_user_states | FUNCTION

-- ============================================================================
-- PASO 3: Eliminar job anterior si existe (evitar duplicados)
-- ============================================================================

-- Ver si ya existe:
SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-users';

-- Si existe, eliminarlo:
SELECT cron.unschedule('cleanup-stale-users');

-- ============================================================================
-- PASO 4: Crear CRON Job - OPCIÓN A (Cada 2 minutos) ⭐ RECOMENDADO
-- ============================================================================

-- Esta es la opción recomendada: ejecuta la limpieza cada 2 minutos
SELECT cron.schedule(
  'cleanup-stale-users',
  '*/2 * * * *',
  $$SELECT cleanup_stale_user_states();$$
);

-- ============================================================================
-- PASO 4: Crear CRON Job - OPCIÓN B (Cada 5 minutos) - Más conservador
-- ============================================================================

-- Usa esta si prefieres ejecutar menos frecuentemente:
-- SELECT cron.schedule(
--   'cleanup-stale-users',
--   '*/5 * * * *',
--   $$SELECT cleanup_stale_user_states();$$
-- );

-- ============================================================================
-- PASO 4: Crear CRON Job - OPCIÓN C (Cada 1 minuto) - Más agresivo
-- ============================================================================

-- Usa esta si quieres detección casi instantánea (aumenta carga de BD):
-- SELECT cron.schedule(
--   'cleanup-stale-users',
--   '* * * * *',
--   $$SELECT cleanup_stale_user_states();$$
-- );

-- ============================================================================
-- VERIFICACIÓN: Confirmar que se creó el job
-- ============================================================================

SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'cleanup-stale-users';

-- Resultado esperado:
-- jobname: cleanup-stale-users
-- schedule: */2 * * * * (cada 2 minutos)
-- active: true

-- ============================================================================
-- MONITOREO: Ver ejecuciones del job
-- ============================================================================

-- Ver últimas 10 ejecuciones:
SELECT 
  runid,
  jobid,
  status,
  start_time,
  end_time,
  (end_time - start_time) as duracion
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-stale-users')
ORDER BY start_time DESC 
LIMIT 10;

-- ============================================================================
-- TESTING: Ejecutar manualmente para verificar
-- ============================================================================

-- Antes de activar el cron, prueba que funciona manualmente:
SELECT * FROM cleanup_stale_user_states();

-- Debería retornar algo como:
-- usuarios_marcados_offline | usuarios_afectados
-- 0                         | {}
-- (si no hay usuarios zombie actualmente)

-- ============================================================================
-- DESACTIVAR (SI ES NECESARIO)
-- ============================================================================

-- Para detener el job:
-- SELECT cron.unschedule('cleanup-stale-users');

-- Para verificar que se detuvo:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-users';
-- (no debe retornar nada)

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Si el job no se ejecuta:

-- 1. Verificar que está activo:
SELECT active FROM cron.job WHERE jobname = 'cleanup-stale-users';

-- 2. Verificar errores en las ejecuciones:
SELECT 
  status,
  return_message,
  start_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-stale-users')
  AND status = 'failed'
ORDER BY start_time DESC;

-- 3. Verificar permisos:
-- El job debe ejecutarse con permisos adecuados para modificar user_current_state

-- ============================================================================
-- EXPRESIONES CRON - REFERENCIA
-- ============================================================================

-- Formato: minuto hora día_del_mes mes día_de_la_semana
-- 
-- Ejemplos:
-- '* * * * *'      = Cada minuto
-- '*/2 * * * *'    = Cada 2 minutos
-- '*/5 * * * *'    = Cada 5 minutos
-- '0 * * * *'      = Cada hora (en el minuto 0)
-- '0 */2 * * *'    = Cada 2 horas
-- '0 0 * * *'      = Una vez al día (medianoche)
-- '0 0 * * 0'      = Una vez a la semana (domingos a medianoche)
-- '*/10 * * * *'   = Cada 10 minutos
-- '0,30 * * * *'   = En el minuto 0 y 30 de cada hora

-- ============================================================================







