-- ============================================================================
-- 015_remove_programaciones_fk_constraints.sql
-- ============================================================================
-- Fecha: 2025-11-08
-- Descripción: Eliminar foreign key constraints de created_by y modified_by
--              en la tabla programaciones para permitir UUIDs de usuarios
--              legacy (tabla usuarios) además de Supabase Auth (tabla users).
--
-- Problema: Los usuarios legacy tienen UUIDs que no están en auth.users,
--           causando errores de foreign key constraint al crear programaciones.
--
-- Solución: Remover las constraints para permitir ambos tipos de usuarios.
-- ============================================================================

-- 1. Eliminar constraint de created_by (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'programaciones_created_by_fkey'
    AND table_name = 'programaciones'
  ) THEN
    ALTER TABLE programaciones 
    DROP CONSTRAINT programaciones_created_by_fkey;
    
    RAISE NOTICE '✅ Constraint programaciones_created_by_fkey eliminada';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint programaciones_created_by_fkey no existe (ya fue eliminada)';
  END IF;
END $$;

-- 2. Eliminar constraint de modified_by (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'programaciones_modified_by_fkey'
    AND table_name = 'programaciones'
  ) THEN
    ALTER TABLE programaciones 
    DROP CONSTRAINT programaciones_modified_by_fkey;
    
    RAISE NOTICE '✅ Constraint programaciones_modified_by_fkey eliminada';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint programaciones_modified_by_fkey no existe (ya fue eliminada)';
  END IF;
END $$;

-- 3. Eliminar constraint de updated_by (si existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'programaciones_updated_by_fkey'
    AND table_name = 'programaciones'
  ) THEN
    ALTER TABLE programaciones 
    DROP CONSTRAINT programaciones_updated_by_fkey;
    
    RAISE NOTICE '✅ Constraint programaciones_updated_by_fkey eliminada';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint programaciones_updated_by_fkey no existe (ya fue eliminada)';
  END IF;
END $$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Verificar que las constraints fueron eliminadas
SELECT 
  constraint_name,
  table_name
FROM information_schema.table_constraints
WHERE table_name = 'programaciones'
  AND constraint_type = 'FOREIGN KEY'
  AND (constraint_name LIKE '%created_by%' OR constraint_name LIKE '%modified_by%' OR constraint_name LIKE '%updated_by%');

-- Si la query anterior no devuelve filas, las constraints fueron eliminadas ✅

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- ⚠️ COMPATIBILIDAD:
--    - created_by puede ser: UUID de auth.users O UUID de public.usuarios
--    - modified_by puede ser: UUID de auth.users O UUID de public.usuarios
--    - updated_by puede ser: UUID de auth.users O UUID de public.usuarios
--    
-- ✅ ESTO ES SEGURO porque:
--    - Los UUIDs siguen siendo válidos y únicos
--    - La aplicación valida que el usuario existe antes de insertar
--    - Esto permite compatibilidad con usuarios legacy
--
-- 📊 PROYECTOS AFECTADOS:
--    - frontend-desktop (usuarios legacy)
--    - master-control (superadmins con UID)
-- ============================================================================

