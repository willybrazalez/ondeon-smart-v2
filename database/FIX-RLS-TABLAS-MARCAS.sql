-- =====================================================
-- AÑADIR POLÍTICAS RLS PARA TABLAS DE MARCAS
-- =====================================================
-- Soluciona el error: "new row violates row-level security policy"
-- Para usuarios legacy (anon) y authenticated
-- =====================================================

-- ============================================
-- MARCA_GRUPOS
-- ============================================

-- Habilitar RLS si no está habilitado
ALTER TABLE marca_grupos ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "marca_grupos_select_anon" ON marca_grupos;
DROP POLICY IF EXISTS "marca_grupos_insert_anon" ON marca_grupos;
DROP POLICY IF EXISTS "marca_grupos_update_anon" ON marca_grupos;
DROP POLICY IF EXISTS "marca_grupos_delete_anon" ON marca_grupos;
DROP POLICY IF EXISTS "marca_grupos_select_auth" ON marca_grupos;
DROP POLICY IF EXISTS "marca_grupos_insert_auth" ON marca_grupos;
DROP POLICY IF EXISTS "marca_grupos_update_auth" ON marca_grupos;
DROP POLICY IF EXISTS "marca_grupos_delete_auth" ON marca_grupos;

-- Políticas para usuarios anon (legacy)
CREATE POLICY "marca_grupos_select_anon"
ON marca_grupos
FOR SELECT
TO anon
USING (true);

CREATE POLICY "marca_grupos_insert_anon"
ON marca_grupos
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "marca_grupos_update_anon"
ON marca_grupos
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_grupos_delete_anon"
ON marca_grupos
FOR DELETE
TO anon
USING (true);

-- Políticas para usuarios authenticated
CREATE POLICY "marca_grupos_select_auth"
ON marca_grupos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "marca_grupos_insert_auth"
ON marca_grupos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "marca_grupos_update_auth"
ON marca_grupos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_grupos_delete_auth"
ON marca_grupos
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- MARCA_EMPRESAS
-- ============================================

ALTER TABLE marca_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marca_empresas_select_anon" ON marca_empresas;
DROP POLICY IF EXISTS "marca_empresas_insert_anon" ON marca_empresas;
DROP POLICY IF EXISTS "marca_empresas_update_anon" ON marca_empresas;
DROP POLICY IF EXISTS "marca_empresas_delete_anon" ON marca_empresas;
DROP POLICY IF EXISTS "marca_empresas_select_auth" ON marca_empresas;
DROP POLICY IF EXISTS "marca_empresas_insert_auth" ON marca_empresas;
DROP POLICY IF EXISTS "marca_empresas_update_auth" ON marca_empresas;
DROP POLICY IF EXISTS "marca_empresas_delete_auth" ON marca_empresas;

CREATE POLICY "marca_empresas_select_anon"
ON marca_empresas
FOR SELECT
TO anon
USING (true);

CREATE POLICY "marca_empresas_insert_anon"
ON marca_empresas
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "marca_empresas_update_anon"
ON marca_empresas
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_empresas_delete_anon"
ON marca_empresas
FOR DELETE
TO anon
USING (true);

CREATE POLICY "marca_empresas_select_auth"
ON marca_empresas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "marca_empresas_insert_auth"
ON marca_empresas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "marca_empresas_update_auth"
ON marca_empresas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_empresas_delete_auth"
ON marca_empresas
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- MARCA_CONTENIDOS
-- ============================================

ALTER TABLE marca_contenidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marca_contenidos_select_anon" ON marca_contenidos;
DROP POLICY IF EXISTS "marca_contenidos_insert_anon" ON marca_contenidos;
DROP POLICY IF EXISTS "marca_contenidos_update_anon" ON marca_contenidos;
DROP POLICY IF EXISTS "marca_contenidos_delete_anon" ON marca_contenidos;
DROP POLICY IF EXISTS "marca_contenidos_select_auth" ON marca_contenidos;
DROP POLICY IF EXISTS "marca_contenidos_insert_auth" ON marca_contenidos;
DROP POLICY IF EXISTS "marca_contenidos_update_auth" ON marca_contenidos;
DROP POLICY IF EXISTS "marca_contenidos_delete_auth" ON marca_contenidos;

CREATE POLICY "marca_contenidos_select_anon"
ON marca_contenidos
FOR SELECT
TO anon
USING (true);

CREATE POLICY "marca_contenidos_insert_anon"
ON marca_contenidos
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "marca_contenidos_update_anon"
ON marca_contenidos
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_contenidos_delete_anon"
ON marca_contenidos
FOR DELETE
TO anon
USING (true);

CREATE POLICY "marca_contenidos_select_auth"
ON marca_contenidos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "marca_contenidos_insert_auth"
ON marca_contenidos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "marca_contenidos_update_auth"
ON marca_contenidos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_contenidos_delete_auth"
ON marca_contenidos
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- MARCA_CANALES
-- ============================================

ALTER TABLE marca_canales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marca_canales_select_anon" ON marca_canales;
DROP POLICY IF EXISTS "marca_canales_insert_anon" ON marca_canales;
DROP POLICY IF EXISTS "marca_canales_update_anon" ON marca_canales;
DROP POLICY IF EXISTS "marca_canales_delete_anon" ON marca_canales;
DROP POLICY IF EXISTS "marca_canales_select_auth" ON marca_canales;
DROP POLICY IF EXISTS "marca_canales_insert_auth" ON marca_canales;
DROP POLICY IF EXISTS "marca_canales_update_auth" ON marca_canales;
DROP POLICY IF EXISTS "marca_canales_delete_auth" ON marca_canales;

CREATE POLICY "marca_canales_select_anon"
ON marca_canales
FOR SELECT
TO anon
USING (true);

CREATE POLICY "marca_canales_insert_anon"
ON marca_canales
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "marca_canales_update_anon"
ON marca_canales
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_canales_delete_anon"
ON marca_canales
FOR DELETE
TO anon
USING (true);

CREATE POLICY "marca_canales_select_auth"
ON marca_canales
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "marca_canales_insert_auth"
ON marca_canales
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "marca_canales_update_auth"
ON marca_canales
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "marca_canales_delete_auth"
ON marca_canales
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- MARCAS (tabla principal)
-- ============================================

ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marcas_select_anon" ON marcas;
DROP POLICY IF EXISTS "marcas_insert_anon" ON marcas;
DROP POLICY IF EXISTS "marcas_update_anon" ON marcas;
DROP POLICY IF EXISTS "marcas_delete_anon" ON marcas;
DROP POLICY IF EXISTS "marcas_select_auth" ON marcas;
DROP POLICY IF EXISTS "marcas_insert_auth" ON marcas;
DROP POLICY IF EXISTS "marcas_update_auth" ON marcas;
DROP POLICY IF EXISTS "marcas_delete_auth" ON marcas;

CREATE POLICY "marcas_select_anon"
ON marcas
FOR SELECT
TO anon
USING (true);

CREATE POLICY "marcas_insert_anon"
ON marcas
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "marcas_update_anon"
ON marcas
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "marcas_delete_anon"
ON marcas
FOR DELETE
TO anon
USING (true);

CREATE POLICY "marcas_select_auth"
ON marcas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "marcas_insert_auth"
ON marcas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "marcas_update_auth"
ON marcas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "marcas_delete_auth"
ON marcas
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- ADMIN_ASIGNACIONES
-- ============================================

ALTER TABLE admin_asignaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_asignaciones_select_anon" ON admin_asignaciones;
DROP POLICY IF EXISTS "admin_asignaciones_insert_anon" ON admin_asignaciones;
DROP POLICY IF EXISTS "admin_asignaciones_update_anon" ON admin_asignaciones;
DROP POLICY IF EXISTS "admin_asignaciones_delete_anon" ON admin_asignaciones;
DROP POLICY IF EXISTS "admin_asignaciones_select_auth" ON admin_asignaciones;
DROP POLICY IF EXISTS "admin_asignaciones_insert_auth" ON admin_asignaciones;
DROP POLICY IF EXISTS "admin_asignaciones_update_auth" ON admin_asignaciones;
DROP POLICY IF EXISTS "admin_asignaciones_delete_auth" ON admin_asignaciones;

CREATE POLICY "admin_asignaciones_select_anon"
ON admin_asignaciones
FOR SELECT
TO anon
USING (true);

CREATE POLICY "admin_asignaciones_insert_anon"
ON admin_asignaciones
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "admin_asignaciones_update_anon"
ON admin_asignaciones
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "admin_asignaciones_delete_anon"
ON admin_asignaciones
FOR DELETE
TO anon
USING (true);

CREATE POLICY "admin_asignaciones_select_auth"
ON admin_asignaciones
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin_asignaciones_insert_auth"
ON admin_asignaciones
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "admin_asignaciones_update_auth"
ON admin_asignaciones
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "admin_asignaciones_delete_auth"
ON admin_asignaciones
FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- Grants de permisos
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON marca_grupos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON marca_grupos TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON marca_empresas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON marca_empresas TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON marca_contenidos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON marca_contenidos TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON marca_canales TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON marca_canales TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON marcas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON marcas TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON admin_asignaciones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_asignaciones TO authenticated;

-- ============================================
-- Verificación
-- ============================================

SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN (
  'marca_grupos',
  'marca_empresas',
  'marca_contenidos',
  'marca_canales',
  'marcas',
  'admin_asignaciones'
)
ORDER BY tablename, roles, cmd;

-- =====================================================
-- IMPORTANTE: CONSIDERACIONES DE SEGURIDAD
-- =====================================================
-- 
-- ⚠️ ESTAS POLÍTICAS SON MUY PERMISIVAS
-- 
-- Permiten que CUALQUIER usuario (anon o authenticated) pueda:
-- - Ver, insertar, actualizar y eliminar CUALQUIER registro
-- - Sin restricciones por empresa, marca o usuario
-- 
-- Esto es APROPIADO solo si:
-- ✅ Tu aplicación maneja la seguridad en el código (frontend/backend)
-- ✅ Filtras los datos por usuario/empresa en tus consultas
-- ✅ No expones la API directamente a usuarios no confiables
-- 
-- Para MEJORAR la seguridad, considera:
-- 🔒 Restringir por empresa_id del usuario
-- 🔒 Restringir por marca_id del admin
-- 🔒 Verificar roles antes de INSERT/UPDATE/DELETE
-- 
-- EJEMPLO de política más restrictiva:
-- 
-- CREATE POLICY "marca_grupos_insert_anon"
-- ON marca_grupos
-- FOR INSERT
-- TO anon
-- WITH CHECK (
--   marca_id IN (
--     SELECT marca_id 
--     FROM admin_asignaciones 
--     WHERE admin_id = current_setting('request.jwt.claims.sub')::uuid
--   )
-- );
-- 
-- =====================================================

