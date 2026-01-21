-- ====================================================================
-- SOLUCIÓN: Error 42501 - RLS en tablas de programaciones
-- ====================================================================
-- Error: "new row violates row-level security policy for table programaciones"
-- 
-- Este script activa RLS y crea políticas permisivas para las tablas:
-- - programaciones
-- - programacion_contenidos  
-- - programacion_destinatarios
-- ====================================================================

-- ====================================================================
-- TABLA: programaciones
-- ====================================================================

-- 1. Activar RLS si no está activado
ALTER TABLE programaciones ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes si las hay (para evitar duplicados)
DROP POLICY IF EXISTS "prog_select_all" ON programaciones;
DROP POLICY IF EXISTS "prog_insert_all" ON programaciones;
DROP POLICY IF EXISTS "prog_update_all" ON programaciones;
DROP POLICY IF EXISTS "prog_delete_all" ON programaciones;

-- 3. Crear políticas muy permisivas para authenticated (usuarios con sesión)
CREATE POLICY "prog_select_all" ON programaciones
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "prog_insert_all" ON programaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "prog_update_all" ON programaciones
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "prog_delete_all" ON programaciones
  FOR DELETE
  TO authenticated
  USING (true);

-- 4. Crear políticas para anon (usuarios legacy sin sesión)
CREATE POLICY "prog_select_anon" ON programaciones
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "prog_insert_anon" ON programaciones
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "prog_update_anon" ON programaciones
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "prog_delete_anon" ON programaciones
  FOR DELETE
  TO anon
  USING (true);

-- ====================================================================
-- TABLA: programacion_contenidos
-- ====================================================================

-- 1. Activar RLS
ALTER TABLE programacion_contenidos ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes
DROP POLICY IF EXISTS "prog_cont_select_all" ON programacion_contenidos;
DROP POLICY IF EXISTS "prog_cont_insert_all" ON programacion_contenidos;
DROP POLICY IF EXISTS "prog_cont_update_all" ON programacion_contenidos;
DROP POLICY IF EXISTS "prog_cont_delete_all" ON programacion_contenidos;

-- 3. Políticas para authenticated
CREATE POLICY "prog_cont_select_all" ON programacion_contenidos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "prog_cont_insert_all" ON programacion_contenidos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "prog_cont_update_all" ON programacion_contenidos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "prog_cont_delete_all" ON programacion_contenidos
  FOR DELETE
  TO authenticated
  USING (true);

-- 4. Políticas para anon
CREATE POLICY "prog_cont_select_anon" ON programacion_contenidos
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "prog_cont_insert_anon" ON programacion_contenidos
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "prog_cont_update_anon" ON programacion_contenidos
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "prog_cont_delete_anon" ON programacion_contenidos
  FOR DELETE
  TO anon
  USING (true);

-- ====================================================================
-- TABLA: programacion_destinatarios
-- ====================================================================

-- 1. Activar RLS
ALTER TABLE programacion_destinatarios ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes
DROP POLICY IF EXISTS "prog_dest_select_all" ON programacion_destinatarios;
DROP POLICY IF EXISTS "prog_dest_insert_all" ON programacion_destinatarios;
DROP POLICY IF EXISTS "prog_dest_update_all" ON programacion_destinatarios;
DROP POLICY IF EXISTS "prog_dest_delete_all" ON programacion_destinatarios;

-- 3. Políticas para authenticated
CREATE POLICY "prog_dest_select_all" ON programacion_destinatarios
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "prog_dest_insert_all" ON programacion_destinatarios
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "prog_dest_update_all" ON programacion_destinatarios
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "prog_dest_delete_all" ON programacion_destinatarios
  FOR DELETE
  TO authenticated
  USING (true);

-- 4. Políticas para anon
CREATE POLICY "prog_dest_select_anon" ON programacion_destinatarios
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "prog_dest_insert_anon" ON programacion_destinatarios
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "prog_dest_update_anon" ON programacion_destinatarios
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "prog_dest_delete_anon" ON programacion_destinatarios
  FOR DELETE
  TO anon
  USING (true);

-- ====================================================================
-- VERIFICACIÓN
-- ====================================================================
-- Ejecuta este query para verificar que las políticas se crearon correctamente:
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('programaciones', 'programacion_contenidos', 'programacion_destinatarios')
ORDER BY tablename, policyname;
*/

