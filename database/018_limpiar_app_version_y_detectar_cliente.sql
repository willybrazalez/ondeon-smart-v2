-- ============================================================================
-- LIMPIAR app_version Y PREPARAR DETECCIÓN DE TIPO DE CLIENTE
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: 
--   1. Limpia el campo app_version en todas las tablas (ponerlo en NULL)
--   2. Prepara el sistema para detectar tipo de cliente (app/web) desde device_info
-- ============================================================================

-- ============================================================================
-- PASO 1: Limpiar app_version en la tabla usuarios
-- ============================================================================
UPDATE usuarios
SET app_version = NULL
WHERE app_version IS NOT NULL;

-- Verificar cuántos registros se actualizaron
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ app_version limpiado en usuarios: % registros', v_updated;
END $$;

-- ============================================================================
-- PASO 2: Limpiar app_version en user_current_state
-- ============================================================================
UPDATE user_current_state
SET app_version = NULL
WHERE app_version IS NOT NULL;

-- Verificar cuántos registros se actualizaron
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ app_version limpiado en user_current_state: % registros', v_updated;
END $$;

-- ============================================================================
-- PASO 3: Limpiar app_version en user_presence_sessions (opcional, para historial)
-- ============================================================================
-- NOTA: Esto limpia el historial también. Si quieres mantener el historial,
-- comenta esta sección
UPDATE user_presence_sessions
SET app_version = NULL
WHERE app_version IS NOT NULL;

-- Verificar cuántos registros se actualizaron
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ app_version limpiado en user_presence_sessions: % registros', v_updated;
END $$;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================
-- Verificar que todos los app_version están en NULL
SELECT 
  'usuarios' as tabla,
  COUNT(*) FILTER (WHERE app_version IS NOT NULL) as con_version,
  COUNT(*) FILTER (WHERE app_version IS NULL) as sin_version
FROM usuarios
UNION ALL
SELECT 
  'user_current_state' as tabla,
  COUNT(*) FILTER (WHERE app_version IS NOT NULL) as con_version,
  COUNT(*) FILTER (WHERE app_version IS NULL) as sin_version
FROM user_current_state
UNION ALL
SELECT 
  'user_presence_sessions' as tabla,
  COUNT(*) FILTER (WHERE app_version IS NOT NULL) as con_version,
  COUNT(*) FILTER (WHERE app_version IS NULL) as sin_version
FROM user_presence_sessions;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- Después de ejecutar este script:
-- 1. El campo app_version quedará limpio (NULL) en todas las tablas
-- 2. A partir de ahora, solo se guardará la versión real de Electron
-- 3. El tipo de cliente (app/web) se detectará desde device_info.userAgent
-- 4. Si device_info contiene "Electron" en userAgent = App instalada
-- 5. Si device_info NO contiene "Electron" = Web (navegador)

