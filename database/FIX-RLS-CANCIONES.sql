-- =====================================================
-- 🔐 FIX: Políticas RLS para tabla canciones
-- =====================================================
-- Este script añade políticas RLS para que los usuarios
-- puedan ver las canciones de sus canales asignados
-- =====================================================

-- ============================================
-- PASO 0: VERIFICAR POLÍTICAS ACTUALES (EJECUTAR PRIMERO)
-- ============================================

-- ⚠️ IMPORTANTE: Ejecuta esta query ANTES de aplicar los cambios
-- para ver qué políticas existen actualmente:

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
WHERE tablename = 'canciones'
ORDER BY cmd, policyname;

-- Verificar si RLS está activado:
SELECT 
  schemaname,
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename = 'canciones';

-- ⏸️ RESULTADO DE VERIFICACIÓN:
-- ==========================================
-- POLÍTICAS ACTUALES ENCONTRADAS:
-- 1. "Allow authenticated users full access to canciones" 
--    → Rol: public, Comando: ALL, Restricción: auth.role() = 'authenticated'
-- 2. "Todos los permisos para la anon key"
--    → Rol: anon, Comando: ALL, Restricción: true (sin restricciones)
--
-- ⚠️ ANÁLISIS DE SEGURIDAD:
-- Estas políticas son MUY PERMISIVAS:
-- ✅ Ventaja: Funcionan para todos los usuarios
-- ❌ Problema: NO limitan el acceso por canal/marca/empresa
-- ❌ Riesgo: Usuarios pueden ver TODAS las canciones de TODOS los canales
--
-- 💡 RECOMENDACIÓN:
-- Opción A (RECOMENDADA): Reemplazar por políticas más específicas
-- Opción B: Mantener ambas (las actuales + las nuevas)
-- ==========================================

-- ============================================
-- PASO 1: Activar RLS si no está activado
-- ============================================

ALTER TABLE public.canciones ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 2: OPCIÓN A - Eliminar políticas antiguas (MÁS SEGURO)
-- ============================================
-- Descomenta estas líneas si quieres REEMPLAZAR las políticas antiguas:

-- DROP POLICY IF EXISTS "Allow authenticated users full access to canciones" ON public.canciones;
-- DROP POLICY IF EXISTS "Todos los permisos para la anon key" ON public.canciones;

-- ============================================
-- PASO 2: OPCIÓN B - Mantener políticas antiguas (ACTUAL)
-- ============================================
-- Las políticas antiguas se mantendrán activas.
-- Las nuevas políticas se añadirán como adicionales.
-- PostgreSQL aplicará la política más permisiva.

-- Eliminar solo políticas de prueba anteriores (si existen):
DROP POLICY IF EXISTS "Users can view canciones from their channels" ON public.canciones;
DROP POLICY IF EXISTS "Admins can view all canciones" ON public.canciones;
DROP POLICY IF EXISTS "Public can view canciones" ON public.canciones;
DROP POLICY IF EXISTS "anon_can_view_canciones" ON public.canciones;

-- ============================================
-- PASO 3: Crear nuevas políticas específicas
-- ============================================
-- ⚠️ NOTA: Si mantienes las políticas antiguas (Opción B),
-- estas nuevas políticas NO limitarán el acceso porque PostgreSQL
-- aplicará la política más permisiva. Solo son útiles si
-- eliminas las políticas antiguas (Opción A).

-- Política 1: Usuarios autenticados pueden ver canciones de sus canales asignados
-- (Esta política solo será efectiva si eliminas "Allow authenticated users full access")
CREATE POLICY "authenticated_users_can_view_their_canciones"
ON public.canciones
FOR SELECT
TO authenticated
USING (
  -- El usuario tiene acceso al canal que contiene esta canción
  EXISTS (
    SELECT 1 
    FROM playlist_canciones pc
    INNER JOIN playlists p ON p.id = pc.playlist_id
    INNER JOIN canales c ON c.id = p.canal_id
    WHERE pc.cancion_id = canciones.id
    AND (
      -- Canal asignado directamente al usuario
      EXISTS (
        SELECT 1 FROM usuario_canales uc
        WHERE uc.canal_id = c.id
        AND uc.usuario_id = auth.uid()
      )
      OR
      -- Canal asignado al grupo del usuario
      EXISTS (
        SELECT 1 FROM grupo_canales gc
        INNER JOIN grupo_usuarios gu ON gu.grupo_id = gc.grupo_id
        WHERE gc.canal_id = c.id
        AND gu.usuario_id = auth.uid()
      )
      OR
      -- Canal asignado a la empresa del usuario
      EXISTS (
        SELECT 1 FROM empresa_canales ec
        INNER JOIN usuarios u ON u.empresa_id = ec.empresa_id
        WHERE ec.canal_id = c.id
        AND u.id = auth.uid()
      )
    )
  )
);

-- Política 2: Admins pueden ver todas las canciones de sus marcas asignadas
CREATE POLICY "admins_can_view_marca_canciones"
ON public.canciones
FOR SELECT
TO authenticated
USING (
  -- El admin tiene acceso a través de sus marcas asignadas
  EXISTS (
    SELECT 1
    FROM admin_asignaciones aa
    INNER JOIN marca_canales mc ON mc.marca_id = aa.marca_id
    INNER JOIN playlists p ON p.canal_id = mc.canal_id
    INNER JOIN playlist_canciones pc ON pc.playlist_id = p.id
    WHERE aa.admin_id = auth.uid()
    AND pc.cancion_id = canciones.id
  )
);

-- Política 3: Usuarios anónimos (legacy) pueden ver canciones públicas
-- ⚠️ CONFLICTO: Ya existe "Todos los permisos para la anon key"
-- Si mantienes la política antigua, esta no tendrá efecto.
-- Descomenta esta política solo si eliminas "Todos los permisos para la anon key"

/*
CREATE POLICY "anon_can_view_public_canciones"
ON public.canciones
FOR SELECT
TO anon
USING (
  -- Permitir acceso a canciones de canales activos
  EXISTS (
    SELECT 1 
    FROM playlist_canciones pc
    INNER JOIN playlists p ON p.id = pc.playlist_id
    INNER JOIN canales c ON c.id = p.canal_id
    WHERE pc.cancion_id = canciones.id
    AND c.activo = true
    AND p.activa = true
  )
);
*/

-- ⚠️ NOTA: Dejamos comentada porque "Todos los permisos para la anon key" 
-- ya permite acceso completo a usuarios anónimos.

-- ============================================
-- PASO 4: Crear políticas para INSERT/UPDATE/DELETE (admins)
-- ============================================
-- ⚠️ CONFLICTO: "Allow authenticated users full access to canciones" 
-- ya permite INSERT/UPDATE/DELETE a todos los usuarios autenticados.
-- Estas políticas más restrictivas NO tendrán efecto.
-- 
-- Descomenta estas políticas solo si eliminas la política antigua.

/*
-- Política 4: Solo admins pueden insertar canciones
CREATE POLICY "admins_can_insert_canciones"
ON public.canciones
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM admin_asignaciones
    WHERE admin_id = auth.uid()
  )
);

-- Política 5: Solo admins pueden actualizar canciones
CREATE POLICY "admins_can_update_canciones"
ON public.canciones
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_asignaciones
    WHERE admin_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM admin_asignaciones
    WHERE admin_id = auth.uid()
  )
);

-- Política 6: Solo admins pueden eliminar canciones
CREATE POLICY "admins_can_delete_canciones"
ON public.canciones
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_asignaciones
    WHERE admin_id = auth.uid()
  )
);
*/

-- ⚠️ NOTA: Políticas comentadas porque las actuales ya permiten 
-- modificaciones a todos los usuarios autenticados.

-- ============================================
-- PASO 5: VERIFICAR POLÍTICAS FINALES
-- ============================================

-- Verifica que las políticas se crearon correctamente:
SELECT 
  tablename,
  policyname,
  roles,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Con restricción USING'
    ELSE 'Sin restricción USING'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Con restricción WITH CHECK'
    ELSE 'Sin restricción WITH CHECK'
  END as check_clause
FROM pg_policies 
WHERE tablename = 'canciones'
ORDER BY cmd, policyname;

-- Verificar RLS activado:
SELECT 
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename = 'canciones';

-- ============================================
-- PASO 6: PRUEBAS DE PERMISOS (OPCIONAL)
-- ============================================

-- Probar como usuario autenticado:
-- SET ROLE authenticated;
-- SELECT COUNT(*) FROM canciones;

-- Probar como usuario anónimo:
-- SET ROLE anon;
-- SELECT COUNT(*) FROM canciones;

-- Volver a rol normal:
-- RESET ROLE;

-- ============================================
-- ✅ ESTADO FINAL
-- ============================================
-- POLÍTICAS ACTIVAS (con Opción B - mantener antiguas):
-- 
-- POLÍTICAS ANTIGUAS (ACTIVAS):
-- 1. ✅ "Allow authenticated users full access to canciones"
--    → Usuarios autenticados: acceso completo a TODAS las canciones
-- 2. ✅ "Todos los permisos para la anon key"
--    → Usuarios anónimos: acceso completo a TODAS las canciones
--
-- POLÍTICAS NUEVAS (AÑADIDAS PERO INACTIVAS):
-- 3. ✅ "authenticated_users_can_view_their_canciones"
--    → No tiene efecto (política antigua es más permisiva)
-- 4. ✅ "admins_can_view_marca_canciones"
--    → No tiene efecto (política antigua es más permisiva)
-- 5. ⚠️ Políticas INSERT/UPDATE/DELETE comentadas
--    → No se crearon (conflicto con política antigua)
--
-- ==========================================
-- 🔒 RECOMENDACIÓN DE SEGURIDAD:
-- ==========================================
-- Si quieres mejorar la seguridad y limitar el acceso por canal/marca:
-- 
-- 1. Ejecuta el PASO 2 - OPCIÓN A (descomenta las líneas 50-51)
-- 2. Descomenta la Política 3 (línea 122)
-- 3. Descomenta las Políticas 4, 5, 6 (líneas 162-199)
-- 4. Vuelve a ejecutar este script completo
--
-- Esto reemplazará las políticas permisivas por políticas específicas.
-- ==========================================

