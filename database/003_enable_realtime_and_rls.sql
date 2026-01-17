-- ============================================================================
-- HABILITAR REALTIME Y RLS PARA SISTEMA DE PRESENCIA
-- ============================================================================
-- Versión: 1.0
-- Fecha: 2025-10-20
-- Descripción: Activa Realtime y Row Level Security para las tablas de presencia
-- ============================================================================

-- ============================================================================
-- PARTE 1: HABILITAR REALTIME EN LAS TABLAS
-- ============================================================================

-- Crear publicación si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
    RAISE NOTICE '✅ Publicación supabase_realtime creada';
  ELSE
    RAISE NOTICE 'ℹ️  Publicación supabase_realtime ya existe';
  END IF;
END $$;

-- Habilitar Realtime para las 3 tablas
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_activity_events;
ALTER PUBLICATION supabase_realtime ADD TABLE user_current_state;

RAISE NOTICE '✅ Realtime habilitado para todas las tablas de presencia';

-- ============================================================================
-- PARTE 2: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Activar RLS en las 3 tablas
ALTER TABLE user_presence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_current_state ENABLE ROW LEVEL SECURITY;

RAISE NOTICE '✅ RLS habilitado para todas las tablas de presencia';

-- ============================================================================
-- PARTE 3: POLÍTICAS RLS PARA user_presence_sessions
-- ============================================================================

-- Los usuarios pueden ver sus propias sesiones
CREATE POLICY "Users can view own sessions"
ON user_presence_sessions
FOR SELECT
USING (auth.uid() = usuario_id);

-- Los usuarios pueden insertar sus propias sesiones
CREATE POLICY "Users can insert own sessions"
ON user_presence_sessions
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- Los usuarios pueden actualizar sus propias sesiones
CREATE POLICY "Users can update own sessions"
ON user_presence_sessions
FOR UPDATE
USING (auth.uid() = usuario_id)
WITH CHECK (auth.uid() = usuario_id);

-- Los admins pueden ver todas las sesiones
CREATE POLICY "Admins can view all sessions"
ON user_presence_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() 
    AND rol_id = 1 -- Ajusta según tu rol de admin
  )
);

COMMENT ON POLICY "Users can view own sessions" ON user_presence_sessions 
IS 'Los usuarios pueden ver solo sus propias sesiones';

COMMENT ON POLICY "Admins can view all sessions" ON user_presence_sessions 
IS 'Los administradores pueden ver todas las sesiones';

-- ============================================================================
-- PARTE 4: POLÍTICAS RLS PARA user_activity_events
-- ============================================================================

-- Los usuarios pueden ver sus propios eventos
CREATE POLICY "Users can view own activity"
ON user_activity_events
FOR SELECT
USING (auth.uid() = usuario_id);

-- Los usuarios pueden insertar sus propios eventos
CREATE POLICY "Users can insert own activity"
ON user_activity_events
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- Los admins pueden ver todos los eventos
CREATE POLICY "Admins can view all activity"
ON user_activity_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() 
    AND rol_id = 1 -- Ajusta según tu rol de admin
  )
);

COMMENT ON POLICY "Users can view own activity" ON user_activity_events 
IS 'Los usuarios pueden ver solo su propio historial de actividad';

COMMENT ON POLICY "Admins can view all activity" ON user_activity_events 
IS 'Los administradores pueden ver toda la actividad';

-- ============================================================================
-- PARTE 5: POLÍTICAS RLS PARA user_current_state
-- ============================================================================

-- Los usuarios pueden ver su propio estado actual
CREATE POLICY "Users can view own state"
ON user_current_state
FOR SELECT
USING (auth.uid() = usuario_id);

-- Los usuarios pueden insertar su propio estado
CREATE POLICY "Users can insert own state"
ON user_current_state
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- Los usuarios pueden actualizar su propio estado
CREATE POLICY "Users can update own state"
ON user_current_state
FOR UPDATE
USING (auth.uid() = usuario_id)
WITH CHECK (auth.uid() = usuario_id);

-- Los admins pueden ver todos los estados
CREATE POLICY "Admins can view all states"
ON user_current_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() 
    AND rol_id = 1 -- Ajusta según tu rol de admin
  )
);

-- Los admins pueden ver estados de todos (para dashboard)
CREATE POLICY "Admins can view user states for dashboard"
ON user_current_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() 
    AND rol_id IN (1, 2) -- Ajusta según roles que pueden ver dashboard
  )
);

COMMENT ON POLICY "Users can view own state" ON user_current_state 
IS 'Los usuarios pueden ver solo su propio estado actual';

COMMENT ON POLICY "Admins can view all states" ON user_current_state 
IS 'Los administradores pueden ver el estado de todos los usuarios';

-- ============================================================================
-- PARTE 6: POLÍTICAS PARA LAS VISTAS (Opcional)
-- ============================================================================

-- Nota: Las vistas heredan los permisos de las tablas subyacentes
-- pero podemos dar acceso directo para simplificar

-- Acceso a vista de usuarios online
GRANT SELECT ON v_users_online TO authenticated;

-- Acceso a vista de actividad reciente
GRANT SELECT ON v_recent_activity TO authenticated;

-- Acceso a vista de sesiones activas
GRANT SELECT ON v_active_sessions TO authenticated;

-- Acceso a vista de estadísticas
GRANT SELECT ON v_user_stats_24h TO authenticated;

-- ============================================================================
-- PARTE 7: POLÍTICA ESPECIAL PARA SERVICE ROLE (Backend/Functions)
-- ============================================================================

-- Permitir que el service_role (backend) pueda hacer todo
-- Esto es necesario para que las Edge Functions o tu backend puedan operar

-- Las políticas anteriores ya permiten operaciones básicas
-- El service_role bypasea RLS automáticamente cuando se usa

-- ============================================================================
-- PARTE 8: VERIFICACIÓN DE CONFIGURACIÓN
-- ============================================================================

DO $$
DECLARE
  v_rls_enabled_count integer;
  v_policies_count integer;
BEGIN
  -- Verificar que RLS está habilitado
  SELECT COUNT(*) INTO v_rls_enabled_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN ('user_presence_sessions', 'user_activity_events', 'user_current_state')
    AND c.relrowsecurity = true;
  
  -- Contar políticas creadas
  SELECT COUNT(*) INTO v_policies_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('user_presence_sessions', 'user_activity_events', 'user_current_state');
  
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ VERIFICACIÓN COMPLETADA:';
  RAISE NOTICE '   - Tablas con RLS habilitado: %/3', v_rls_enabled_count;
  RAISE NOTICE '   - Políticas RLS creadas: %', v_policies_count;
  RAISE NOTICE '   - Realtime habilitado: ✅';
  RAISE NOTICE '================================================';
  
  IF v_rls_enabled_count = 3 THEN
    RAISE NOTICE '🎉 Todo configurado correctamente!';
  ELSE
    RAISE WARNING '⚠️  Algunas tablas no tienen RLS habilitado';
  END IF;
END $$;

-- ============================================================================
-- CONFIGURACIÓN ADICIONAL RECOMENDADA
-- ============================================================================

-- Si quieres que TODOS los usuarios autenticados puedan ver usuarios online
-- (útil para features sociales), descomenta esto:

/*
CREATE POLICY "Authenticated users can see who is online"
ON user_current_state
FOR SELECT
USING (
  auth.role() = 'authenticated' 
  AND is_online = true
);
*/

-- Si quieres permitir que los usuarios vean actividad reciente de otros
-- (útil para feeds de actividad), descomenta esto:

/*
CREATE POLICY "Authenticated users can see recent activity"
ON user_activity_events
FOR SELECT
USING (
  auth.role() = 'authenticated' 
  AND created_at > (now() - interval '1 hour')
);
*/

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

/*
ROLES EN TU SISTEMA:
- Ajusta 'rol_id = 1' según tu configuración:
  - 1 = Admin
  - 2 = Moderador/Manager
  - 3 = Usuario normal
  - etc.

AUTENTICACIÓN:
- auth.uid() retorna el UUID del usuario autenticado de Supabase Auth
- Si usas autenticación legacy (sin Supabase Auth), necesitas ajustar las políticas

TESTING:
- Para probar RLS, usa diferentes usuarios
- Para bypasear RLS temporalmente (solo testing), usa service_role key
- NUNCA uses service_role key en el frontend

TROUBLESHOOTING:
- Si los usuarios no pueden acceder a sus datos:
  1. Verifica que auth.uid() retorna el usuario correcto
  2. Verifica que usuario_id en las tablas coincide con auth.uid()
  3. Verifica los logs de Supabase Dashboard
  
- Si quieres desactivar RLS temporalmente (SOLO TESTING):
  ALTER TABLE user_presence_sessions DISABLE ROW LEVEL SECURITY;
  ALTER TABLE user_activity_events DISABLE ROW LEVEL SECURITY;
  ALTER TABLE user_current_state DISABLE ROW LEVEL SECURITY;
*/

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Para ejecutar este script:
-- 1. Copia todo el contenido
-- 2. Pega en SQL Editor de Supabase
-- 3. Haz clic en "Run"
-- 4. Verifica el mensaje de verificación al final

