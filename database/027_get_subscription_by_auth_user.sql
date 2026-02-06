-- ============================================
-- Función RPC: get_subscription_by_auth_user
-- ============================================
-- Esta función obtiene la suscripción del usuario autenticado
-- Usa SECURITY DEFINER para ejecutarse con permisos elevados

CREATE OR REPLACE FUNCTION get_subscription_by_auth_user()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  plan_id TEXT,
  plan_nombre TEXT,
  estado TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.plan_id,
    s.plan_nombre,
    s.estado,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.fecha_inicio,
    s.fecha_fin,
    s.created_at,
    s.updated_at
  FROM suscripciones s
  WHERE s.user_id = auth.uid()
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_subscription_by_auth_user() TO authenticated;

-- Comentario descriptivo
COMMENT ON FUNCTION get_subscription_by_auth_user() IS 'Obtiene la suscripción activa del usuario autenticado';
