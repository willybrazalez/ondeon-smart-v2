-- ============================================================================
-- 016_auto_complete_expired_programaciones.sql
-- ============================================================================
-- Fecha: 2025-11-09
-- Descripción: Crear función y cron job para actualizar automáticamente
--              el estado de programaciones expiradas a "completado"
--
-- Problema: Programaciones con fecha_fin pasada siguen en estado "activo"
--           o "pausado" en lugar de "completado"
--
-- Solución: Función automática que se ejecuta cada hora via pg_cron
-- ============================================================================

-- PASO 1: Crear función de limpieza automática
CREATE OR REPLACE FUNCTION auto_complete_expired_programaciones()
RETURNS TABLE (
  updated_count INTEGER,
  programaciones_actualizadas TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_ids TEXT[] := ARRAY[]::TEXT[];
  v_fecha_actual DATE;
BEGIN
  v_fecha_actual := CURRENT_DATE;
  
  -- Actualizar programaciones expiradas a "completado"
  WITH updated AS (
    UPDATE programaciones
    SET 
      estado = 'completado',
      updated_at = NOW()
    WHERE 
      -- Solo actualizar si NO está ya completada
      estado IN ('activo', 'pausado')
      
      -- Y cumple una de estas condiciones de expiración:
      AND (
        -- 1. Tiene fecha_fin y ya pasó
        (fecha_fin IS NOT NULL AND fecha_fin < v_fecha_actual)
        
        -- 2. O terminacion_tipo es "en_fecha" y fecha_fin ya pasó
        OR (terminacion_tipo = 'en_fecha' AND fecha_fin IS NOT NULL AND fecha_fin < v_fecha_actual)
      )
    RETURNING id, descripcion
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id::TEXT)
  INTO v_count, v_ids
  FROM updated;
  
  -- Log de resultados
  IF v_count > 0 THEN
    RAISE NOTICE '✅ auto_complete_expired_programaciones: % programaciones actualizadas a completado', v_count;
  ELSE
    RAISE NOTICE 'ℹ️ auto_complete_expired_programaciones: No hay programaciones expiradas para actualizar';
  END IF;
  
  -- Retornar resultados
  RETURN QUERY SELECT v_count, COALESCE(v_ids, ARRAY[]::TEXT[]);
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Error en auto_complete_expired_programaciones: %', SQLERRM;
  RETURN QUERY SELECT 0, ARRAY[]::TEXT[];
END;
$$;

-- Comentario descriptivo
COMMENT ON FUNCTION auto_complete_expired_programaciones IS 
'Actualiza automáticamente el estado de programaciones expiradas a "completado". Se ejecuta vía pg_cron cada hora.';

-- ============================================================================
-- PASO 2: Verificar que pg_cron está habilitado
-- ============================================================================
-- Si este query no retorna nada, ve a: Database → Extensions → Habilitar "pg_cron"

SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- ============================================================================
-- PASO 3: Eliminar cron job anterior si existe (para evitar duplicados)
-- ============================================================================

SELECT cron.unschedule('auto-complete-expired-programaciones') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-expired-programaciones'
);

-- ============================================================================
-- PASO 4: Crear CRON Job (se ejecuta cada hora)
-- ============================================================================
-- Ejecuta cada hora en el minuto 5 (ej: 00:05, 01:05, 02:05, etc.)

SELECT cron.schedule(
  'auto-complete-expired-programaciones',  -- Nombre del job
  '5 * * * *',                             -- Cada hora en el minuto 5
  $$SELECT auto_complete_expired_programaciones();$$
);

-- ============================================================================
-- PASO 5: Verificar que el cron job se creó correctamente
-- ============================================================================

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'auto-complete-expired-programaciones';

-- Resultado esperado:
-- jobname: auto-complete-expired-programaciones
-- schedule: 5 * * * * (cada hora en minuto 5)
-- active: true

-- ============================================================================
-- PASO 6: Ejecutar MANUALMENTE para actualizar programaciones AHORA
-- ============================================================================

SELECT * FROM auto_complete_expired_programaciones();

-- Esto actualizará inmediatamente todas las programaciones expiradas
-- sin esperar al próximo ciclo del cron (próxima hora en minuto 5)

-- ============================================================================
-- VERIFICACIÓN: Ver programaciones que deberían estar completadas
-- ============================================================================

SELECT 
  id,
  descripcion,
  estado,
  tipo,
  fecha_inicio,
  fecha_fin,
  terminacion_tipo,
  updated_at
FROM programaciones
WHERE 
  estado IN ('activo', 'pausado')
  AND (
    (fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE)
    OR (terminacion_tipo = 'en_fecha' AND fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE)
  )
ORDER BY fecha_fin DESC;

-- Si esta query retorna filas, esas programaciones deberían estar "completado"

-- ============================================================================
-- LOGS: Ver historial de ejecuciones del cron
-- ============================================================================

SELECT 
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-complete-expired-programaciones')
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- MANTENIMIENTO: Comandos útiles
-- ============================================================================

-- 🔧 Deshabilitar temporalmente el cron (sin eliminarlo):
-- UPDATE cron.job SET active = false WHERE jobname = 'auto-complete-expired-programaciones';

-- 🔧 Reactivar el cron:
-- UPDATE cron.job SET active = true WHERE jobname = 'auto-complete-expired-programaciones';

-- 🗑️ Eliminar completamente el cron job:
-- SELECT cron.unschedule('auto-complete-expired-programaciones');

-- 📊 Ver estado actual del cron:
-- SELECT active FROM cron.job WHERE jobname = 'auto-complete-expired-programaciones';

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 
-- ⏰ FRECUENCIA:
--    - Se ejecuta cada hora en el minuto 5 (00:05, 01:05, 02:05, etc.)
--    - Esto es suficiente para mantener estados actualizados
--    - Si necesitas más frecuencia, cambia el schedule:
--      - Cada 30 min: '5,35 * * * *'
--      - Cada 15 min: '5,20,35,50 * * * *'
--
-- 🔐 SEGURIDAD:
--    - La función usa SECURITY DEFINER para tener permisos
--    - Solo actualiza programaciones realmente expiradas
--
-- 📊 RENDIMIENTO:
--    - La función es muy ligera (solo actualiza registros expirados)
--    - No afecta al rendimiento del sistema
--
-- ✅ COMPATIBILIDAD:
--    - Compatible con sistema de programaciones actual
--    - No interfiere con actualizaciones manuales
--
-- ============================================================================


