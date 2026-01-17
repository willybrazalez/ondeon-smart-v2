-- =====================================================
-- Migración: Añadir campo modified_by a programaciones
-- Fecha: 2025-11-08
-- Descripción: Campo para rastrear último usuario en modificar programación
-- =====================================================

-- 1. Añadir columna modified_by (compatible con ambos proyectos)
ALTER TABLE programaciones 
ADD COLUMN IF NOT EXISTS modified_by UUID;

-- 2. Añadir comentario explicativo
COMMENT ON COLUMN programaciones.modified_by IS 
'ID del último usuario que modificó la programación. 
- En frontend-desktop: ID de tabla usuarios
- En master-control: UID de tabla superadmins';

-- 3. Crear índice para mejorar rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_programaciones_modified_by 
ON programaciones(modified_by);

-- 4. Actualizar registros existentes: modified_by = created_by (si existe)
UPDATE programaciones 
SET modified_by = created_by 
WHERE created_by IS NOT NULL AND modified_by IS NULL;

-- 5. Verificación
DO $$
BEGIN
  -- Verificar que la columna existe
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'programaciones' 
    AND column_name = 'modified_by'
  ) THEN
    RAISE NOTICE '✅ Columna modified_by creada exitosamente';
    
    -- Mostrar estadísticas
    RAISE NOTICE '📊 Registros actualizados: %', 
      (SELECT COUNT(*) FROM programaciones WHERE modified_by IS NOT NULL);
    RAISE NOTICE '📊 Registros sin modified_by: %', 
      (SELECT COUNT(*) FROM programaciones WHERE modified_by IS NULL);
  ELSE
    RAISE EXCEPTION '❌ Error: La columna modified_by no se creó correctamente';
  END IF;
END $$;

-- =====================================================
-- NOTAS DE IMPLEMENTACIÓN
-- =====================================================
-- 
-- Frontend Desktop (usuarios):
-- --------------------------------
-- created_by = auth.uid() → Se guarda al crear
-- modified_by = auth.uid() → Se actualiza al modificar
-- 
-- Master Control (superadmins):
-- --------------------------------
-- created_by = UID del superadmin
-- modified_by = UID del superadmin
-- 
-- Ambos sistemas comparten la misma tabla programaciones,
-- por lo que el campo modified_by es UUID compatible.
-- =====================================================

