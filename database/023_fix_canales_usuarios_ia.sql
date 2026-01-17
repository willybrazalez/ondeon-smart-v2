-- =====================================================
-- MIGRACIÓN 023: Corregir asignación de canales para usuarios IA
-- Fecha: 2026-01-16
-- =====================================================
-- Problema: El trigger on_nuevo_usuario asignaba todos los canales 
-- genéricos a CUALQUIER usuario, sin verificar si era usuario IA.
-- 
-- Impacto: 67 usuarios IA tenían 438 canales normales incorrectamente asignados
-- 
-- Solución: Modificar el trigger para asignar canales según el tipo de usuario.
-- =====================================================

-- 1. CREAR FUNCIÓN: Asignar canales IA a un usuario IA
CREATE OR REPLACE FUNCTION activar_canales_ia_para_usuario(usuario_id_param UUID)
RETURNS VOID AS $$
DECLARE
  canal_record RECORD;
BEGIN
  -- Activar todos los canales IA para el usuario IA
  FOR canal_record IN 
    SELECT canal_id FROM canales_ia WHERE is_ia = true
  LOOP
    INSERT INTO reproductor_usuario_canales (usuario_id, canal_id, activo)
    VALUES (usuario_id_param, canal_record.canal_id, true)
    ON CONFLICT (usuario_id, canal_id) 
    DO UPDATE SET activo = true, updated_at = timezone('utc'::text, now());
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. MODIFICAR TRIGGER: Verificar tipo de usuario antes de asignar canales
CREATE OR REPLACE FUNCTION trigger_nuevo_usuario()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el usuario es de tipo IA
  IF NEW.es_usuario_ia = true THEN
    -- Usuario IA: Asignar SOLO canales IA
    PERFORM activar_canales_ia_para_usuario(NEW.id);
  ELSE
    -- Usuario normal: Asignar canales genéricos
    PERFORM activar_canales_genericos_para_usuario(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. LIMPIAR DATOS: Eliminar canales normales de usuarios IA
-- Primero, eliminar todos los canales que NO son IA de usuarios que SÍ son IA
DELETE FROM reproductor_usuario_canales
WHERE usuario_id IN (
  SELECT id FROM usuarios WHERE es_usuario_ia = true
)
AND canal_id NOT IN (
  SELECT canal_id FROM canales_ia WHERE is_ia = true
);

-- 4. ASIGNAR CANALES IA: A todos los usuarios IA que no los tengan
INSERT INTO reproductor_usuario_canales (usuario_id, canal_id, activo)
SELECT 
  u.id as usuario_id,
  ci.canal_id,
  true as activo
FROM usuarios u
CROSS JOIN canales_ia ci
WHERE u.es_usuario_ia = true
  AND ci.is_ia = true
ON CONFLICT (usuario_id, canal_id) 
DO UPDATE SET activo = true, updated_at = timezone('utc'::text, now());

-- 5. CREAR FUNCIÓN: Para manejar cambios de es_usuario_ia (UPDATE)
-- Si un usuario cambia de normal a IA o viceversa, reasignar canales
CREATE OR REPLACE FUNCTION trigger_cambio_tipo_usuario_ia()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actuar si cambió el campo es_usuario_ia
  IF OLD.es_usuario_ia IS DISTINCT FROM NEW.es_usuario_ia THEN
    -- Eliminar todos los canales actuales del reproductor
    DELETE FROM reproductor_usuario_canales WHERE usuario_id = NEW.id;
    
    -- Reasignar según el nuevo tipo
    IF NEW.es_usuario_ia = true THEN
      PERFORM activar_canales_ia_para_usuario(NEW.id);
    ELSE
      PERFORM activar_canales_genericos_para_usuario(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREAR TRIGGER: Para detectar cambios en es_usuario_ia
DROP TRIGGER IF EXISTS on_cambio_tipo_usuario_ia ON usuarios;
CREATE TRIGGER on_cambio_tipo_usuario_ia
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cambio_tipo_usuario_ia();

-- Agregar comentarios para documentación
COMMENT ON FUNCTION activar_canales_ia_para_usuario(UUID) IS 
  'Asigna todos los canales IA (de canales_ia) a un usuario específico';

COMMENT ON FUNCTION trigger_nuevo_usuario() IS 
  'Trigger que asigna canales al crear un usuario. Si es_usuario_ia=true asigna canales IA, sino asigna canales genéricos';

COMMENT ON FUNCTION trigger_cambio_tipo_usuario_ia() IS 
  'Trigger que reasigna canales cuando un usuario cambia entre tipo IA y normal';
