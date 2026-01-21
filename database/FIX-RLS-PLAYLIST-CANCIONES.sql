-- =====================================================
-- 🔐 FIX: Políticas RLS para tabla playlist_canciones
-- =====================================================
-- Este script añade políticas RLS para la tabla intermedia
-- que conecta playlists con canciones
-- =====================================================

-- ============================================
-- PASO 0: VERIFICAR ESTADO ACTUAL
-- ============================================

-- Ver políticas actuales de playlist_canciones:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'playlist_canciones'
ORDER BY cmd, policyname;

-- Verificar si RLS está activado:
SELECT 
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename = 'playlist_canciones';

-- ============================================
-- PASO 1: Activar RLS
-- ============================================

ALTER TABLE public.playlist_canciones ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 2: Crear políticas PERMISIVAS (solución rápida)
-- ============================================
-- Estas políticas permiten acceso completo para que la app funcione.
-- Son las mismas políticas permisivas que tienen otras tablas del sistema.

-- Eliminar políticas antiguas si existen:
DROP POLICY IF EXISTS "Allow authenticated users access to playlist_canciones" ON public.playlist_canciones;
DROP POLICY IF EXISTS "Allow anon access to playlist_canciones" ON public.playlist_canciones;

-- Política 1: Usuarios autenticados pueden ver/modificar todo
CREATE POLICY "Allow authenticated users access to playlist_canciones"
ON public.playlist_canciones
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Política 2: Usuarios anónimos (legacy) pueden ver/modificar todo  
CREATE POLICY "Allow anon access to playlist_canciones"
ON public.playlist_canciones
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
WHERE tablename = 'playlist_canciones'
ORDER BY cmd, policyname;

-- ============================================
-- ✅ COMPLETADO
-- ============================================
-- Políticas RLS para playlist_canciones configuradas:
-- 1. ✅ Usuarios autenticados: acceso completo
-- 2. ✅ Usuarios anónimos (legacy): acceso completo
--
-- ⚠️ NOTA: Estas son políticas permisivas para que funcione.
-- Si quieres más seguridad, puedes restringirlas después.
-- ============================================

