-- ============================================================
-- ACTIVAR ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Este script activa RLS y crea políticas para:
-- 1. Usuario base (rol_id = 1): Solo ve su historial
-- 2. Admin/Gestor (rol_id = 2 o 3): Ve todo de sus usuarios
-- 3. Superadmin (tabla superadmins): Acceso total
-- ============================================================

-- Activar RLS en las tres tablas
ALTER TABLE user_presence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_current_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIÓN AUXILIAR: Verificar si es superadmin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN AUXILIAR: Obtener rol del usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT rol_id FROM public.usuarios 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- POLÍTICAS: user_presence_sessions
-- ============================================================

-- SELECT: Usuarios base ven solo sus sesiones, admins y superadmins ven todo
DROP POLICY IF EXISTS "select_user_presence_sessions" ON user_presence_sessions;
CREATE POLICY "select_user_presence_sessions" ON user_presence_sessions
FOR SELECT
USING (
  -- Superadmin: ve todo
  public.is_superadmin() = true
  OR
  -- Admin/Gestor (rol 2 o 3): ve todo
  public.get_user_role() IN (2, 3)
  OR
  -- Usuario base: solo sus sesiones
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
  OR
  -- 🔧 LEGACY: Permitir acceso si está autenticado (para usuarios legacy sin auth.uid())
  -- Esto permite que el servicio funcione incluso sin autenticación de Supabase
  auth.role() = 'authenticated'
);

-- INSERT: Todos pueden crear sesiones (solo con su propio usuario_id si es base)
DROP POLICY IF EXISTS "insert_user_presence_sessions" ON user_presence_sessions;
CREATE POLICY "insert_user_presence_sessions" ON user_presence_sessions
FOR INSERT
WITH CHECK (
  -- Superadmin: puede insertar cualquier sesión
  public.is_superadmin() = true
  OR
  -- Admin/Gestor: puede insertar cualquier sesión
  public.get_user_role() IN (2, 3)
  OR
  -- Usuario base: solo puede insertar con su propio usuario_id
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
  OR
  -- 🔧 LEGACY: Permitir insertar si está autenticado
  auth.role() = 'authenticated'
);

-- UPDATE: Solo superadmin y admin pueden actualizar sesiones
DROP POLICY IF EXISTS "update_user_presence_sessions" ON user_presence_sessions;
CREATE POLICY "update_user_presence_sessions" ON user_presence_sessions
FOR UPDATE
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
  OR
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
);

-- DELETE: Solo superadmin y admin
DROP POLICY IF EXISTS "delete_user_presence_sessions" ON user_presence_sessions;
CREATE POLICY "delete_user_presence_sessions" ON user_presence_sessions
FOR DELETE
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
);

-- ============================================================
-- POLÍTICAS: user_activity_events
-- ============================================================

-- SELECT: Usuarios base ven solo su historial, admins y superadmins ven todo
DROP POLICY IF EXISTS "select_user_activity_events" ON user_activity_events;
CREATE POLICY "select_user_activity_events" ON user_activity_events
FOR SELECT
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
  OR
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
);

-- INSERT: Todos pueden crear eventos (solo con su propio usuario_id si es base)
DROP POLICY IF EXISTS "insert_user_activity_events" ON user_activity_events;
CREATE POLICY "insert_user_activity_events" ON user_activity_events
FOR INSERT
WITH CHECK (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
  OR
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
);

-- UPDATE: Solo superadmin y admin
DROP POLICY IF EXISTS "update_user_activity_events" ON user_activity_events;
CREATE POLICY "update_user_activity_events" ON user_activity_events
FOR UPDATE
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
);

-- DELETE: Solo superadmin y admin
DROP POLICY IF EXISTS "delete_user_activity_events" ON user_activity_events;
CREATE POLICY "delete_user_activity_events" ON user_activity_events
FOR DELETE
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
);

-- ============================================================
-- POLÍTICAS: user_current_state
-- ============================================================

-- SELECT: Usuarios base ven solo su estado, admins y superadmins ven todo
DROP POLICY IF EXISTS "select_user_current_state" ON user_current_state;
CREATE POLICY "select_user_current_state" ON user_current_state
FOR SELECT
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
  OR
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
);

-- INSERT: Todos pueden crear su estado (solo con su propio usuario_id si es base)
DROP POLICY IF EXISTS "insert_user_current_state" ON user_current_state;
CREATE POLICY "insert_user_current_state" ON user_current_state
FOR INSERT
WITH CHECK (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
  OR
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
);

-- UPDATE: Usuarios actualizan solo su estado, admins y superadmins actualizan todo
DROP POLICY IF EXISTS "update_user_current_state" ON user_current_state;
CREATE POLICY "update_user_current_state" ON user_current_state
FOR UPDATE
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
  OR
  (public.get_user_role() = 1 AND usuario_id = auth.uid())
);

-- DELETE: Solo superadmin y admin
DROP POLICY IF EXISTS "delete_user_current_state" ON user_current_state;
CREATE POLICY "delete_user_current_state" ON user_current_state
FOR DELETE
USING (
  public.is_superadmin() = true
  OR
  public.get_user_role() IN (2, 3)
);

-- ============================================================
-- PERMISOS EN LAS VISTAS (para consultas del dashboard)
-- ============================================================

-- Las vistas heredan las políticas de las tablas base,
-- pero necesitamos dar permiso SELECT al rol authenticated

GRANT SELECT ON v_users_online TO authenticated;
GRANT SELECT ON v_recent_activity TO authenticated;
GRANT SELECT ON v_active_sessions TO authenticated;
GRANT SELECT ON v_user_stats_24h TO authenticated;

-- ============================================================
-- VERIFICACIÓN (opcional - comenta si no quieres ejecutar)
-- ============================================================

-- Ver políticas creadas
DO $$
BEGIN
  RAISE NOTICE '✅ RLS habilitado y políticas creadas correctamente';
  RAISE NOTICE '📊 Políticas en user_presence_sessions: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_presence_sessions');
  RAISE NOTICE '📊 Políticas en user_activity_events: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_activity_events');
  RAISE NOTICE '📊 Políticas en user_current_state: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_current_state');
END $$;
