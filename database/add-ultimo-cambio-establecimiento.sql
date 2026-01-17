-- ============================================================================
-- MIGRACIÓN: Agregar columna ultimo_cambio_establecimiento
-- ============================================================================
-- Esta columna controla que los usuarios solo puedan cambiar el nombre
-- de su establecimiento una vez al mes (para evitar regenerar indicativos
-- constantemente).
-- ============================================================================

-- Agregar columna si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'usuarios' 
        AND column_name = 'ultimo_cambio_establecimiento'
    ) THEN
        ALTER TABLE usuarios 
        ADD COLUMN ultimo_cambio_establecimiento TIMESTAMPTZ;
        
        RAISE NOTICE 'Columna ultimo_cambio_establecimiento agregada';
    ELSE
        RAISE NOTICE 'Columna ultimo_cambio_establecimiento ya existe';
    END IF;
END $$;

-- Comentario descriptivo
COMMENT ON COLUMN usuarios.ultimo_cambio_establecimiento IS 
'Fecha del último cambio de nombre de establecimiento. 
Se usa para limitar cambios a 1 vez por mes y controlar regeneración de indicativos.';

-- ============================================================================
-- FUNCIÓN: Validar que solo se puede cambiar establecimiento 1 vez al mes
-- ============================================================================

CREATE OR REPLACE FUNCTION validar_cambio_establecimiento()
RETURNS TRIGGER AS $$
DECLARE
    dias_desde_ultimo_cambio INTEGER;
    dias_minimos INTEGER := 30;  -- Mínimo 30 días entre cambios
BEGIN
    -- Solo validar si está cambiando el establecimiento
    IF OLD.establecimiento IS NOT DISTINCT FROM NEW.establecimiento THEN
        RETURN NEW;
    END IF;
    
    -- Si nunca ha cambiado, permitir
    IF OLD.ultimo_cambio_establecimiento IS NULL THEN
        NEW.ultimo_cambio_establecimiento := NOW();
        RETURN NEW;
    END IF;
    
    -- Calcular días desde último cambio
    dias_desde_ultimo_cambio := EXTRACT(DAY FROM (NOW() - OLD.ultimo_cambio_establecimiento));
    
    -- Validar que han pasado al menos 30 días
    IF dias_desde_ultimo_cambio < dias_minimos THEN
        RAISE EXCEPTION 'Solo puedes cambiar el nombre del establecimiento una vez al mes. Faltan % días.', 
            (dias_minimos - dias_desde_ultimo_cambio);
    END IF;
    
    -- Actualizar timestamp del cambio
    NEW.ultimo_cambio_establecimiento := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para validación
DROP TRIGGER IF EXISTS trigger_validar_cambio_establecimiento ON usuarios;

CREATE TRIGGER trigger_validar_cambio_establecimiento
    BEFORE UPDATE OF establecimiento ON usuarios
    FOR EACH ROW
    WHEN (NEW.establecimiento IS DISTINCT FROM OLD.establecimiento)
    EXECUTE FUNCTION validar_cambio_establecimiento();

-- ============================================================================
-- FUNCIÓN RPC: Verificar si usuario puede cambiar establecimiento
-- ============================================================================
-- Esta función se puede llamar desde el frontend para mostrar si el usuario
-- puede cambiar el nombre o cuántos días faltan.

CREATE OR REPLACE FUNCTION puede_cambiar_establecimiento(p_usuario_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_ultimo_cambio TIMESTAMPTZ;
    v_dias_desde_cambio INTEGER;
    v_dias_restantes INTEGER;
    v_dias_minimos INTEGER := 30;
BEGIN
    -- Obtener fecha de último cambio
    SELECT ultimo_cambio_establecimiento 
    INTO v_ultimo_cambio
    FROM usuarios 
    WHERE id = p_usuario_id;
    
    -- Si nunca ha cambiado, puede hacerlo
    IF v_ultimo_cambio IS NULL THEN
        RETURN jsonb_build_object(
            'puede_cambiar', true,
            'dias_restantes', 0,
            'mensaje', 'Puedes cambiar el nombre de tu establecimiento'
        );
    END IF;
    
    -- Calcular días
    v_dias_desde_cambio := EXTRACT(DAY FROM (NOW() - v_ultimo_cambio));
    v_dias_restantes := GREATEST(0, v_dias_minimos - v_dias_desde_cambio);
    
    IF v_dias_restantes > 0 THEN
        RETURN jsonb_build_object(
            'puede_cambiar', false,
            'dias_restantes', v_dias_restantes,
            'ultimo_cambio', v_ultimo_cambio,
            'proximo_cambio_permitido', v_ultimo_cambio + INTERVAL '30 days',
            'mensaje', format('Podrás cambiar el nombre en %s días', v_dias_restantes)
        );
    ELSE
        RETURN jsonb_build_object(
            'puede_cambiar', true,
            'dias_restantes', 0,
            'ultimo_cambio', v_ultimo_cambio,
            'mensaje', 'Puedes cambiar el nombre de tu establecimiento'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permiso a usuarios autenticados
GRANT EXECUTE ON FUNCTION puede_cambiar_establecimiento(UUID) TO authenticated;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Ver la nueva columna
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
AND column_name = 'ultimo_cambio_establecimiento';

-- Ver triggers relacionados
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE '%establecimiento%';
