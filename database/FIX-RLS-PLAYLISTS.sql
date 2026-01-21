-- =====================================================
-- 🔐 FIX: Políticas RLS para tabla playlists
-- =====================================================
-- Este script añade políticas RLS para la tabla playlists
-- =====================================================

-- ============================================
-- PASO 0: VERIFICAR ESTADO ACTUAL
-- ============================================

-- Ver políticas actuales de playlists:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'playlists'
ORDER BY cmd, policyname;

-- Verificar si RLS está activado:
SELECT 
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename = 'playlists';

-- ============================================
-- PASO 1: Activar RLS
-- ============================================

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 2: Crear políticas PERMISIVAS
-- ============================================

-- Eliminar políticas antiguas si existen:
DROP POLICY IF EXISTS "Allow authenticated users access to playlists" ON public.playlists;
DROP POLICY IF EXISTS "Allow anon access to playlists" ON public.playlists;

-- Política 1: Usuarios autenticados pueden ver/modificar todo
CREATE POLICY "Allow authenticated users access to playlists"
ON public.playlists
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Política 2: Usuarios anónimos (legacy) pueden ver/modificar todo  
CREATE POLICY "Allow anon access to playlists"
ON public.playlists
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- PASO 3: Verificar políticas creadas
-- ============================================

SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'playlists'
ORDER BY cmd, policyname;

-- ============================================
-- ✅ COMPLETADO
-- ============================================
-- Políticas RLS para playlists configuradas:
-- 1. ✅ Usuarios autenticados: acceso completo
-- 2. ✅ Usuarios anónimos (legacy): acceso completo
-- ============================================

