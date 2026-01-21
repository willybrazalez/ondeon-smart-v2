-- =====================================================
-- AÑADIR POLÍTICAS RLS PARA USUARIOS LEGACY (ANON)
-- contenido_asignaciones
-- =====================================================
-- NO BORRA LAS POLÍTICAS EXISTENTES
-- Solo añade las necesarias para usuarios anónimos
-- =====================================================

-- Política SELECT para usuarios anónimos (legacy)
CREATE POLICY "Usuarios legacy pueden ver asignaciones"
ON contenido_asignaciones
FOR SELECT
TO anon
USING (true);

-- Política INSERT para usuarios anónimos (legacy)
CREATE POLICY "Usuarios legacy pueden insertar asignaciones"
ON contenido_asignaciones
FOR INSERT
TO anon
WITH CHECK (true);

-- Política UPDATE para usuarios anónimos (legacy)
CREATE POLICY "Usuarios legacy pueden actualizar asignaciones"
ON contenido_asignaciones
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Política DELETE para usuarios anónimos (legacy)
CREATE POLICY "Usuarios legacy pueden eliminar asignaciones"
ON contenido_asignaciones
FOR DELETE
TO anon
USING (true);

-- =====================================================
-- Verificar políticas creadas
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'contenido_asignaciones'
ORDER BY roles, cmd;

-- =====================================================
-- FIN
-- =====================================================

