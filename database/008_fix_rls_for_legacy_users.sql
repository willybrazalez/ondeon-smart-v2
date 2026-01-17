-- ============================================================
-- FIX RLS PARA USUARIOS MIXTOS (LEGACY + SUPABASE AUTH + SUPERADMINS)
-- ============================================================
-- Problema: El sistema tiene 3 tipos de usuarios:
--   1. Usuarios legacy (rol 'anon' - sin JWT de Supabase)
--   2. Usuarios de Supabase Auth (rol 'authenticated' - con JWT)
--   3. Superadmins (tabla superadmins - pueden ser legacy o auth)
-- 
-- Solución: Políticas que permitan acceso a TODOS los tipos:
--   - TO public (incluye 'anon' y 'authenticated')
--   - Verificación adicional para superadmins si fuera necesario
-- 
-- IMPORTANTE: La seguridad se maneja a nivel de aplicación.
-- Todos los usuarios tienen los mismos permisos en estas tablas.
-- ============================================================

-- ============================================================
-- PASO 1: Habilitar RLS en las tablas
-- ============================================================

ALTER TABLE user_presence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_current_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_presence_sessions
-- ============================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "select_user_presence_sessions" ON user_presence_sessions;
DROP POLICY IF EXISTS "insert_user_presence_sessions" ON user_presence_sessions;
DROP POLICY IF EXISTS "update_user_presence_sessions" ON user_presence_sessions;
DROP POLICY IF EXISTS "delete_user_presence_sessions" ON user_presence_sessions;

-- SELECT: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "select_user_presence_sessions" ON user_presence_sessions
FOR SELECT
TO public  -- Incluye 'anon' (legacy) y 'authenticated' (Supabase Auth)
USING (true);

-- INSERT: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "insert_user_presence_sessions" ON user_presence_sessions
FOR INSERT
TO public
WITH CHECK (true);

-- UPDATE: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "update_user_presence_sessions" ON user_presence_sessions
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "delete_user_presence_sessions" ON user_presence_sessions
FOR DELETE
TO public
USING (true);

-- ============================================================
-- user_activity_events
-- ============================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "select_user_activity_events" ON user_activity_events;
DROP POLICY IF EXISTS "insert_user_activity_events" ON user_activity_events;
DROP POLICY IF EXISTS "update_user_activity_events" ON user_activity_events;
DROP POLICY IF EXISTS "delete_user_activity_events" ON user_activity_events;

-- SELECT: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "select_user_activity_events" ON user_activity_events
FOR SELECT
TO public
USING (true);

-- INSERT: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "insert_user_activity_events" ON user_activity_events
FOR INSERT
TO public
WITH CHECK (true);

-- UPDATE: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "update_user_activity_events" ON user_activity_events
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "delete_user_activity_events" ON user_activity_events
FOR DELETE
TO public
USING (true);

-- ============================================================
-- user_current_state
-- ============================================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "select_user_current_state" ON user_current_state;
DROP POLICY IF EXISTS "insert_user_current_state" ON user_current_state;
DROP POLICY IF EXISTS "update_user_current_state" ON user_current_state;
DROP POLICY IF EXISTS "delete_user_current_state" ON user_current_state;

-- SELECT: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "select_user_current_state" ON user_current_state
FOR SELECT
TO public
USING (true);

-- INSERT: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "insert_user_current_state" ON user_current_state
FOR INSERT
TO public
WITH CHECK (true);

-- UPDATE: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "update_user_current_state" ON user_current_state
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE: Usuarios legacy (anon), auth (authenticated) y superadmins
CREATE POLICY "delete_user_current_state" ON user_current_state
FOR DELETE
TO public
USING (true);

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

-- Ver políticas actuales
SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN (
  'user_presence_sessions',
  'user_activity_events',
  'user_current_state'
)
ORDER BY tablename, cmd;

-- Verificar que RLS está habilitado
SELECT 
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename IN (
  'user_presence_sessions',
  'user_activity_events',
  'user_current_state'
);

-- ============================================================
-- NOTAS
-- ============================================================
-- 
-- ⚠️ IMPORTANTE: Estas políticas son MUY PERMISIVAS
-- 
-- Permiten que CUALQUIER USUARIO (legacy con rol 'anon', auth con rol 'authenticated', 
-- y superadmins) pueda:
-- - Ver TODOS los datos de TODOS los usuarios
-- - Insertar/actualizar/eliminar cualquier registro
-- 
-- Esto es apropiado SI:
-- ✅ Tu aplicación maneja permisos a nivel de código
-- ✅ Confías en que tu frontend solo muestre datos apropiados
-- ✅ Los usuarios base no tienen acceso directo a Supabase
-- 
-- Si necesitas restricciones más estrictas, podrías:
-- 1. Crear políticas que verifiquen usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
-- 2. Agregar una columna auth_user_id a la tabla usuarios
-- 3. Vincular tus usuarios legacy con auth.uid()
-- 
-- ============================================================

