-- ============================================================================
-- MIGRACIÓN: Hashear contraseñas en texto plano de la tabla usuarios
-- ============================================================================
-- Fecha: 2025-01-XX
-- Descripción: Hashea todas las contraseñas en texto plano usando pgcrypto
--              Solo hashea contraseñas que NO estén ya hasheadas
--              Optimizado para evitar timeouts - usa UPDATE directo
-- ============================================================================

-- Verificar que la extensión pgcrypto está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PASO 1: Verificar estado actual ANTES de migrar
-- ============================================================================

-- Ver cuántos usuarios tienen contraseñas en texto plano
SELECT 
  CASE 
    WHEN password LIKE '$2%' THEN 'Hasheada'
    WHEN password IS NULL OR password = '' THEN 'Sin password'
    ELSE 'Texto plano'
  END as tipo_password,
  COUNT(*) as cantidad
FROM usuarios
GROUP BY tipo_password
ORDER BY cantidad DESC;

-- ============================================================================
-- PASO 2: Migración directa (sin loops) - OPTIMIZADO
-- ============================================================================

-- Actualizar solo contraseñas que NO estén hasheadas
-- Los hashes bcrypt siempre empiezan con $2a$, $2b$, o $2y$
-- NOTA: Si tienes muchos usuarios y hay timeout, ejecuta el UPDATE en lotes
-- usando la versión con CTE que está más abajo

UPDATE usuarios
SET password = crypt(password, gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password != ''
  AND password NOT LIKE '$2%';

-- Mostrar cuántos registros se actualizaron
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ Contraseñas hasheadas: %', v_updated;
END $$;

-- ============================================================================
-- ALTERNATIVA: Si el UPDATE anterior causa timeout, usa esta versión en lotes
-- ============================================================================

-- Versión con CTE para procesar en lotes de 100 usuarios
-- Ejecuta esta query múltiples veces hasta que no actualice más registros
/*
WITH usuarios_a_hashear AS (
  SELECT id, password
  FROM usuarios
  WHERE password IS NOT NULL
    AND password != ''
    AND password NOT LIKE '$2%'
  LIMIT 100
)
UPDATE usuarios u
SET password = crypt(u.password, gen_salt('bf', 10))
FROM usuarios_a_hashear uah
WHERE u.id = uah.id;
*/

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

-- Ver algunos ejemplos de contraseñas hasheadas
SELECT 
  id,
  username,
  CASE 
    WHEN password LIKE '$2%' THEN '✅ Hasheada'
    WHEN password IS NULL OR password = '' THEN '⚠️ Sin password'
    ELSE '❌ Texto plano'
  END as estado_password,
  LEFT(password, 30) || '...' as password_preview
FROM usuarios
ORDER BY created_at DESC
LIMIT 10;

-- Contar cuántas contraseñas están hasheadas vs texto plano
SELECT 
  CASE 
    WHEN password LIKE '$2%' THEN 'Hasheada'
    WHEN password IS NULL OR password = '' THEN 'Sin password'
    ELSE 'Texto plano'
  END as tipo_password,
  COUNT(*) as cantidad
FROM usuarios
GROUP BY tipo_password
ORDER BY cantidad DESC;

