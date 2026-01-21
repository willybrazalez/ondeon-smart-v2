-- ============================================================================
-- MIGRACIÓN: Añadir campo para rastrear última modificación de establecimiento
-- ============================================================================
-- Este campo permite limitar los cambios de nombre de establecimiento 
-- a 1 vez cada 24 horas (para controlar la generación de indicativos de voz)
-- ============================================================================

-- Añadir columna si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'usuarios' 
        AND column_name = 'establecimiento_updated_at'
    ) THEN
        ALTER TABLE public.usuarios 
        ADD COLUMN establecimiento_updated_at TIMESTAMPTZ DEFAULT NULL;
        
        COMMENT ON COLUMN public.usuarios.establecimiento_updated_at IS 
            'Fecha de última modificación del nombre del establecimiento. Usado para limitar cambios a 1 vez por día.';
        
        RAISE NOTICE '✅ Columna establecimiento_updated_at añadida correctamente';
    ELSE
        RAISE NOTICE 'ℹ️ La columna establecimiento_updated_at ya existe';
    END IF;
END $$;

-- Crear índice para consultas rápidas (opcional, mejora rendimiento)
CREATE INDEX IF NOT EXISTS idx_usuarios_establecimiento_updated_at 
ON public.usuarios(establecimiento_updated_at) 
WHERE establecimiento_updated_at IS NOT NULL;

-- Verificar la columna
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
AND column_name = 'establecimiento_updated_at';
