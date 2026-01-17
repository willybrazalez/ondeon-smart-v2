-- ============================================================================
-- MIGRACIÓN 022: Campo registro_completo para control de onboarding
-- ============================================================================
-- Fecha: 2026-01-13
-- Descripción: 
--   - Agrega columna registro_completo para rastrear si un usuario completó
--     todo el flujo de registro (datos + pago)
--   - Modifica el trigger handle_new_auth_user para insertar con registro_completo = false
--   - Los usuarios solo pueden acceder al dashboard si registro_completo = true
-- ============================================================================

-- ============================================================================
-- PARTE 1: Agregar columna registro_completo
-- ============================================================================

-- 1.1 Agregar columna (FALSE por defecto para nuevos usuarios)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS registro_completo BOOLEAN DEFAULT FALSE;

-- 1.2 Índice para consultas rápidas de usuarios pendientes
CREATE INDEX IF NOT EXISTS idx_usuarios_registro_completo 
ON usuarios(registro_completo) WHERE registro_completo = FALSE;

-- 1.3 Comentario explicativo
COMMENT ON COLUMN usuarios.registro_completo IS 'TRUE si el usuario completó todo el onboarding (datos + pago). FALSE para usuarios que abandonaron el registro.';

-- ============================================================================
-- PARTE 2: Actualizar usuarios existentes
-- ============================================================================

-- 2.1 Usuarios legacy (sin auth_user_id) = registro_completo = true
-- Son usuarios creados manualmente, ya tienen acceso
UPDATE usuarios 
SET registro_completo = TRUE 
WHERE auth_user_id IS NULL 
  AND registro_completo IS NOT TRUE;

-- 2.2 Usuarios de Supabase Auth con suscripción activa = registro_completo = true
UPDATE usuarios u
SET registro_completo = TRUE
WHERE u.auth_user_id IS NOT NULL
  AND u.registro_completo IS NOT TRUE
  AND EXISTS (
    SELECT 1 FROM suscripciones s 
    WHERE s.usuario_id = u.id 
    AND s.estado IN ('active', 'trialing')
  );

-- Log de usuarios actualizados
DO $$
DECLARE
  v_legacy_count INTEGER;
  v_supabase_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_legacy_count 
  FROM usuarios 
  WHERE auth_user_id IS NULL AND registro_completo = TRUE;
  
  SELECT COUNT(*) INTO v_supabase_count 
  FROM usuarios 
  WHERE auth_user_id IS NOT NULL AND registro_completo = TRUE;
  
  RAISE NOTICE '✅ Usuarios legacy marcados como registro_completo: %', v_legacy_count;
  RAISE NOTICE '✅ Usuarios Supabase con suscripción activa marcados: %', v_supabase_count;
END $$;

-- ============================================================================
-- PARTE 3: Modificar trigger para nuevos usuarios
-- ============================================================================

-- 3.1 Actualizar función del trigger
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_id INTEGER;
  v_nombre TEXT;
BEGIN
  -- Obtener rol_id de los metadatos (default: 2 para gestores auto-registrados)
  v_rol_id := COALESCE((NEW.raw_user_meta_data->>'rol_id')::INTEGER, 2);
  
  -- Solo crear registro si es un gestor (rol_id = 2)
  -- Los roles 1 y 3 son para usuarios business creados manualmente
  IF v_rol_id = 2 THEN
    -- Obtener nombre del usuario (prioridad: nombre, full_name, parte del email)
    v_nombre := COALESCE(
      NEW.raw_user_meta_data->>'nombre',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    );
    
    -- Insertar en public.usuarios con registro_completo = FALSE
    -- El usuario debe completar el onboarding (datos + pago) para que sea TRUE
    INSERT INTO public.usuarios (
      auth_user_id,
      email,
      nombre,
      apellidos,
      rol_id,
      registro_completo,
      es_usuario_ia,
      canales_ia,
      created_at
    ) VALUES (
      NEW.id,
      NEW.email,
      v_nombre,
      COALESCE(NEW.raw_user_meta_data->>'apellidos', ''),
      2, -- rol_id para gestores
      FALSE, -- ⚠️ IMPORTANTE: registro NO completo hasta que pague
      TRUE,  -- Usuarios gestores son usuarios IA
      TRUE,  -- Activa acceso a canales IA
      NOW()
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      email = EXCLUDED.email;
    
    RAISE LOG 'Usuario gestor creado en public.usuarios (pendiente onboarding): % (auth_user_id: %)', NEW.email, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3.2 Comentario actualizado
COMMENT ON FUNCTION handle_new_auth_user() IS 'Crea automáticamente un registro en public.usuarios cuando se registra un nuevo usuario via Supabase Auth con rol_id=2 (gestor). El usuario inicia con registro_completo=FALSE hasta completar el pago.';

-- ============================================================================
-- PARTE 4: Función helper para marcar registro como completo
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_registration_complete(p_auth_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated BOOLEAN := FALSE;
BEGIN
  UPDATE usuarios
  SET registro_completo = TRUE
  WHERE auth_user_id = p_auth_user_id
    AND registro_completo = FALSE;
  
  IF FOUND THEN
    v_updated := TRUE;
    RAISE LOG 'Registro completado para usuario: %', p_auth_user_id;
  END IF;
  
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION mark_registration_complete(UUID) IS 'Marca el registro de un usuario como completo después de finalizar el pago en Stripe';

-- ============================================================================
-- PARTE 5: Verificación
-- ============================================================================

DO $$
DECLARE
  v_pending_count INTEGER;
  v_complete_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_pending_count 
  FROM usuarios 
  WHERE registro_completo = FALSE OR registro_completo IS NULL;
  
  SELECT COUNT(*) INTO v_complete_count 
  FROM usuarios 
  WHERE registro_completo = TRUE;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Migración 022 completada exitosamente';
  RAISE NOTICE '   - Columna registro_completo agregada';
  RAISE NOTICE '   - Trigger handle_new_auth_user actualizado';
  RAISE NOTICE '   - Función mark_registration_complete creada';
  RAISE NOTICE '   - Usuarios con registro completo: %', v_complete_count;
  RAISE NOTICE '   - Usuarios pendientes de completar: %', v_pending_count;
  RAISE NOTICE '============================================';
END $$;
