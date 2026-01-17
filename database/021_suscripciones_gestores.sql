-- ============================================================================
-- MIGRACIÓN 021: Sistema de Suscripciones para Gestores (rol_id = 2)
-- ============================================================================
-- Fecha: 2026-01-12
-- Descripción: 
--   - Agrega columna auth_user_id para vincular auth.users con public.usuarios
--   - Crea trigger para auto-crear usuarios gestores desde Supabase Auth
--   - Crea tablas para gestión de suscripciones con Stripe
-- ============================================================================

-- ============================================================================
-- PARTE 1: Vincular auth.users con public.usuarios
-- ============================================================================

-- 1.1 Agregar columna auth_user_id a la tabla usuarios
-- Esta columna vincula usuarios de Supabase Auth con la tabla legacy
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Índice para búsquedas rápidas por auth_user_id
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id 
ON usuarios(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Comentario explicativo
COMMENT ON COLUMN usuarios.auth_user_id IS 'UUID del usuario en auth.users (Supabase Auth). NULL para usuarios legacy que usan login con username/password.';

-- ============================================================================
-- PARTE 2: Trigger para sincronizar auth.users → public.usuarios
-- ============================================================================

-- 2.1 Función que se ejecuta cuando se crea un usuario en auth.users
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
    
    -- Insertar en public.usuarios
    INSERT INTO public.usuarios (
      auth_user_id,
      email,
      nombre,
      apellidos,
      rol_id,
      activo,
      created_at
    ) VALUES (
      NEW.id,
      NEW.email,
      v_nombre,
      COALESCE(NEW.raw_user_meta_data->>'apellidos', ''),
      2, -- rol_id para gestores
      true,
      NOW()
    )
    ON CONFLICT (auth_user_id) DO NOTHING; -- Evitar duplicados
    
    RAISE LOG 'Usuario gestor creado en public.usuarios: % (auth_user_id: %)', NEW.email, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2.2 Crear trigger en auth.users (si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_auth_user();

-- Comentario
COMMENT ON FUNCTION handle_new_auth_user() IS 'Crea automáticamente un registro en public.usuarios cuando se registra un nuevo usuario via Supabase Auth con rol_id=2 (gestor)';

-- ============================================================================
-- PARTE 3: Tabla de Suscripciones
-- ============================================================================

CREATE TABLE IF NOT EXISTS suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relación con usuario (UUID porque usuarios.id es UUID)
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- IDs de Stripe
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  
  -- Estado de la suscripción
  -- pending: checkout iniciado pero no completado
  -- trialing: en período de prueba (7 días)
  -- active: pagando activamente
  -- past_due: pago fallido, en período de gracia
  -- cancelled: cancelada o expirada
  estado TEXT NOT NULL DEFAULT 'pending' 
    CHECK (estado IN ('pending', 'trialing', 'active', 'past_due', 'cancelled')),
  
  -- Fechas importantes
  fecha_inicio TIMESTAMPTZ,
  fecha_fin_trial TIMESTAMPTZ,
  fecha_proxima_factura TIMESTAMPTZ,
  cancelado_en TIMESTAMPTZ,
  
  -- Información del plan
  plan_nombre TEXT DEFAULT 'Gestor',
  precio_mensual DECIMAL(10,2),
  moneda TEXT DEFAULT 'eur',
  intervalo_facturacion TEXT DEFAULT 'month' CHECK (intervalo_facturacion IN ('month', 'year')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para suscripciones
CREATE INDEX IF NOT EXISTS idx_suscripciones_usuario ON suscripciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_estado ON suscripciones(estado);
CREATE INDEX IF NOT EXISTS idx_suscripciones_stripe_customer ON suscripciones(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_stripe_subscription ON suscripciones(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_fecha_fin_trial ON suscripciones(fecha_fin_trial) WHERE estado = 'trialing';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_suscripciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_suscripciones_updated_at ON suscripciones;
CREATE TRIGGER trigger_suscripciones_updated_at
  BEFORE UPDATE ON suscripciones
  FOR EACH ROW
  EXECUTE FUNCTION update_suscripciones_updated_at();

-- Comentarios
COMMENT ON TABLE suscripciones IS 'Gestiona las suscripciones de usuarios gestores (rol_id=2) con Stripe';
COMMENT ON COLUMN suscripciones.estado IS 'pending=checkout no completado, trialing=trial activo, active=pagando, past_due=pago fallido, cancelled=cancelada';

-- ============================================================================
-- PARTE 4: Tabla de Registros Pendientes
-- ============================================================================

-- Almacena usuarios que iniciaron el registro pero no completaron el pago
-- Se limpian automáticamente después de 24 horas
CREATE TABLE IF NOT EXISTS registros_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ID del usuario en Supabase Auth (para poder eliminarlo si no completa)
  auth_user_id UUID NOT NULL,
  
  -- Datos del usuario
  email TEXT NOT NULL,
  nombre TEXT,
  telefono TEXT,
  nombre_negocio TEXT,
  metodo_auth TEXT CHECK (metodo_auth IN ('google', 'apple', 'email')),
  
  -- ID de la sesión de Stripe Checkout
  stripe_checkout_session_id TEXT,
  
  -- Expiración automática (24 horas por defecto)
  expira_en TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Estado
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado', 'expirado')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para registros_pendientes
CREATE INDEX IF NOT EXISTS idx_registros_pendientes_auth_user ON registros_pendientes(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_registros_pendientes_expira ON registros_pendientes(expira_en) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_registros_pendientes_checkout ON registros_pendientes(stripe_checkout_session_id);

-- Comentarios
COMMENT ON TABLE registros_pendientes IS 'Usuarios que iniciaron registro pero no completaron el pago. Se eliminan automáticamente tras 24h';
COMMENT ON COLUMN registros_pendientes.expira_en IS 'Timestamp después del cual el registro y la cuenta auth se pueden eliminar';

-- ============================================================================
-- PARTE 5: Tabla de Historial de Pagos
-- ============================================================================

CREATE TABLE IF NOT EXISTS historial_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relación con suscripción (UUID porque usuarios.id es UUID)
  suscripcion_id UUID REFERENCES suscripciones(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- IDs de Stripe
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_charge_id TEXT,
  
  -- Detalles del pago
  monto DECIMAL(10,2) NOT NULL,
  moneda TEXT DEFAULT 'eur',
  estado TEXT NOT NULL CHECK (estado IN ('succeeded', 'failed', 'pending', 'refunded', 'disputed')),
  
  -- Descripción
  descripcion TEXT,
  
  -- Fecha del pago
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata adicional (respuesta completa de Stripe, etc.)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para historial_pagos
CREATE INDEX IF NOT EXISTS idx_historial_pagos_suscripcion ON historial_pagos(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_historial_pagos_usuario ON historial_pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_pagos_fecha ON historial_pagos(fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_historial_pagos_estado ON historial_pagos(estado);

-- Comentarios
COMMENT ON TABLE historial_pagos IS 'Registro de todos los pagos procesados por Stripe';

-- ============================================================================
-- PARTE 6: Función para limpiar registros pendientes expirados
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_registros_pendientes()
RETURNS TABLE(
  registros_eliminados INTEGER,
  auth_users_eliminados INTEGER,
  detalles TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registros_count INTEGER := 0;
  v_auth_count INTEGER := 0;
  v_detalles TEXT[] := ARRAY[]::TEXT[];
  v_registro RECORD;
BEGIN
  -- Buscar registros pendientes expirados
  FOR v_registro IN 
    SELECT id, auth_user_id, email 
    FROM registros_pendientes 
    WHERE estado = 'pendiente' 
    AND expira_en < NOW()
  LOOP
    -- Marcar como expirado
    UPDATE registros_pendientes 
    SET estado = 'expirado' 
    WHERE id = v_registro.id;
    
    v_registros_count := v_registros_count + 1;
    v_detalles := array_append(v_detalles, 'Expirado: ' || v_registro.email);
    
    -- NOTA: La eliminación del usuario en auth.users debe hacerse desde Edge Function
    -- usando supabase.auth.admin.deleteUser() ya que no se puede hacer desde SQL
    
    RAISE LOG 'Registro pendiente expirado: % (auth_user_id: %)', v_registro.email, v_registro.auth_user_id;
  END LOOP;
  
  -- Retornar resultados
  registros_eliminados := v_registros_count;
  auth_users_eliminados := v_auth_count;
  detalles := v_detalles;
  
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_registros_pendientes() IS 'Marca como expirados los registros pendientes que superaron las 24h. La eliminación de auth.users se hace desde Edge Function.';

-- ============================================================================
-- PARTE 7: Vista para dashboard de suscripciones
-- ============================================================================

CREATE OR REPLACE VIEW v_suscripciones_activas AS
SELECT 
  s.id as suscripcion_id,
  s.usuario_id,
  u.auth_user_id,
  u.email,
  u.nombre,
  s.estado,
  s.plan_nombre,
  s.precio_mensual,
  s.moneda,
  s.fecha_inicio,
  s.fecha_fin_trial,
  s.fecha_proxima_factura,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  -- Calcular días restantes de trial
  CASE 
    WHEN s.estado = 'trialing' AND s.fecha_fin_trial > NOW() 
    THEN EXTRACT(DAY FROM (s.fecha_fin_trial - NOW()))::INTEGER
    ELSE 0
  END as dias_trial_restantes,
  s.created_at,
  s.updated_at
FROM suscripciones s
INNER JOIN usuarios u ON s.usuario_id = u.id
WHERE u.rol_id = 2; -- Solo gestores

COMMENT ON VIEW v_suscripciones_activas IS 'Vista de suscripciones de gestores con información del usuario';

-- ============================================================================
-- PARTE 8: RLS (Row Level Security) para las nuevas tablas
-- ============================================================================

-- Habilitar RLS
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_pagos ENABLE ROW LEVEL SECURITY;

-- Políticas para suscripciones
-- Los usuarios solo pueden ver su propia suscripción
CREATE POLICY "Usuarios pueden ver su propia suscripción" ON suscripciones
  FOR SELECT
  USING (
    usuario_id IN (
      SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
    )
  );

-- Solo el sistema (service_role) puede insertar/actualizar suscripciones
CREATE POLICY "Solo sistema puede modificar suscripciones" ON suscripciones
  FOR ALL
  USING (auth.role() = 'service_role');

-- Políticas para registros_pendientes
-- Solo el sistema puede acceder
CREATE POLICY "Solo sistema puede acceder registros_pendientes" ON registros_pendientes
  FOR ALL
  USING (auth.role() = 'service_role');

-- Políticas para historial_pagos
-- Usuarios pueden ver su propio historial
CREATE POLICY "Usuarios pueden ver su historial de pagos" ON historial_pagos
  FOR SELECT
  USING (
    usuario_id IN (
      SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
    )
  );

-- Solo el sistema puede insertar pagos
CREATE POLICY "Solo sistema puede insertar pagos" ON historial_pagos
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PARTE 9: Función helper para obtener suscripción por auth_user_id
-- ============================================================================

CREATE OR REPLACE FUNCTION get_subscription_by_auth_user(p_auth_user_id UUID)
RETURNS TABLE(
  suscripcion_id UUID,
  usuario_id INTEGER,
  estado TEXT,
  plan_nombre TEXT,
  precio_mensual DECIMAL,
  moneda TEXT,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin_trial TIMESTAMPTZ,
  fecha_proxima_factura TIMESTAMPTZ,
  dias_trial_restantes INTEGER,
  stripe_customer_id TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.usuario_id,
    s.estado,
    s.plan_nombre,
    s.precio_mensual,
    s.moneda,
    s.fecha_inicio,
    s.fecha_fin_trial,
    s.fecha_proxima_factura,
    CASE 
      WHEN s.estado = 'trialing' AND s.fecha_fin_trial > NOW() 
      THEN EXTRACT(DAY FROM (s.fecha_fin_trial - NOW()))::INTEGER
      ELSE 0
    END,
    s.stripe_customer_id
  FROM suscripciones s
  INNER JOIN usuarios u ON s.usuario_id = u.id
  WHERE u.auth_user_id = p_auth_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_subscription_by_auth_user(UUID) IS 'Obtiene la suscripción activa de un usuario por su auth_user_id';

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 021 completada exitosamente';
  RAISE NOTICE '   - Columna auth_user_id agregada a usuarios';
  RAISE NOTICE '   - Trigger on_auth_user_created configurado';
  RAISE NOTICE '   - Tabla suscripciones creada';
  RAISE NOTICE '   - Tabla registros_pendientes creada';
  RAISE NOTICE '   - Tabla historial_pagos creada';
  RAISE NOTICE '   - RLS configurado para todas las tablas';
END $$;
