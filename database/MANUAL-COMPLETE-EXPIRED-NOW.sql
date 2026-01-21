-- ============================================================================
-- MANUAL: Completar programaciones expiradas AHORA
-- ============================================================================
-- Ejecuta esto en Supabase SQL Editor para actualizar inmediatamente
-- las programaciones que ya expiraron
-- ============================================================================

-- PASO 1: Ver cuántas programaciones están expiradas
SELECT 
  id,
  descripcion,
  estado AS estado_actual,
  'completado' AS deberia_ser,
  fecha_inicio,
  fecha_fin,
  terminacion_tipo
FROM programaciones
WHERE 
  estado IN ('activo', 'pausado')
  AND (
    (fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE)
    OR (terminacion_tipo = 'en_fecha' AND fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE)
  )
ORDER BY fecha_fin DESC;

-- ============================================================================
-- PASO 2: Actualizar todas las programaciones expiradas
-- ============================================================================

UPDATE programaciones
SET 
  estado = 'completado',
  updated_at = NOW()
WHERE 
  estado IN ('activo', 'pausado')
  AND (
    (fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE)
    OR (terminacion_tipo = 'en_fecha' AND fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE)
  );

-- Esto debería actualizar 2 programaciones:
-- - 88bd32ff-29ac-439c-b575-c2a9ea0549c0 (fecha_fin: 2025-11-07)
-- - b7c44a23-1609-452c-ba22-ac466cfad677 (fecha_fin: 2025-11-08)

-- ============================================================================
-- PASO 3: Verificar que se actualizaron correctamente
-- ============================================================================

SELECT 
  id,
  descripcion,
  estado,
  fecha_fin,
  updated_at
FROM programaciones
WHERE 
  id IN (
    '88bd32ff-29ac-439c-b575-c2a9ea0549c0',
    'b7c44a23-1609-452c-ba22-ac466cfad677'
  );

-- Resultado esperado: ambas con estado = 'completado'

-- ============================================================================
-- ✅ LISTO: Programaciones actualizadas correctamente
-- ============================================================================


