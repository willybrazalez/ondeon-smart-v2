-- =====================================================
-- 🔐 FIX COMPLETO: RLS para TODAS las tablas de música
-- =====================================================
-- Este script configura RLS en TODAS las tablas necesarias
-- para que funcione el listado de canciones
-- =====================================================

-- ============================================
-- VERIFICACIÓN INICIAL
-- ============================================

-- Ver qué tablas NO tienen RLS activado:
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('canciones', 'playlists', 'playlist_canciones', 'canales')
ORDER BY tablename;

-- Ver políticas actuales de TODAS estas tablas:
SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('canciones', 'playlists', 'playlist_canciones', 'canales')
ORDER BY tablename, cmd;

-- ============================================
-- PARTE 1: ACTIVAR RLS EN TODAS LAS TABLAS
-- ============================================

ALTER TABLE public.canales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_canciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canciones ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 2: CANALES
-- ============================================

DROP POLICY IF EXISTS "Allow all access to canales" ON public.canales;

CREATE POLICY "Allow all access to canales"
ON public.canales
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================
-- PARTE 3: PLAYLISTS
-- ============================================

DROP POLICY IF EXISTS "Allow all access to playlists" ON public.playlists;

CREATE POLICY "Allow all access to playlists"
ON public.playlists
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================
-- PARTE 4: PLAYLIST_CANCIONES
-- ============================================

DROP POLICY IF EXISTS "Allow all access to playlist_canciones" ON public.playlist_canciones;

CREATE POLICY "Allow all access to playlist_canciones"
ON public.playlist_canciones
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================
-- PARTE 5: CANCIONES
-- ============================================

-- Mantener las políticas existentes si las hay, pero añadir una permisiva por si acaso
DROP POLICY IF EXISTS "Allow all access to canciones" ON public.canciones;

CREATE POLICY "Allow all access to canciones"
ON public.canciones
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Ver que RLS está activado en todas:
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('canciones', 'playlists', 'playlist_canciones', 'canales')
ORDER BY tablename;

-- Ver las políticas creadas:
SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('canciones', 'playlists', 'playlist_canciones', 'canales')
ORDER BY tablename, cmd;

-- ============================================
-- PRUEBA RÁPIDA
-- ============================================

-- Ejecuta esto para verificar que todo funciona:
-- 1. Contar canales:
SELECT COUNT(*) as total_canales FROM canales;

-- 2. Contar playlists:
SELECT COUNT(*) as total_playlists FROM playlists;

-- 3. Contar relaciones playlist-cancion:
SELECT COUNT(*) as total_playlist_canciones FROM playlist_canciones;

-- 4. Contar canciones:
SELECT COUNT(*) as total_canciones FROM canciones;

-- 5. Probar la query que usa el frontend (reemplaza 'CANAL_ID' con un ID real):
-- SELECT pc.cancion_id, pc.playlist_id, c.*
-- FROM playlist_canciones pc
-- INNER JOIN canciones c ON c.id = pc.cancion_id
-- INNER JOIN playlists p ON p.id = pc.playlist_id
-- WHERE p.canal_id = 'CANAL_ID' AND p.activa = true;

-- ============================================
-- ✅ COMPLETADO
-- ============================================
-- Si ves resultados en las pruebas de arriba, ¡todo funciona!
-- Si ves 0 resultados o errores, revisa:
-- 1. Que las tablas tengan datos
-- 2. Que no haya otras políticas más restrictivas
-- ============================================

