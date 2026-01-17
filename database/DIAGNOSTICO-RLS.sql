-- =====================================================
-- 🔍 DIAGNÓSTICO RLS - Verificar estado actual
-- =====================================================
-- Ejecuta esto PRIMERO para ver el estado actual
-- Dashboard: https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/sql/new
-- =====================================================

-- 1. Ver si RLS está activado en contenidos
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_activado
FROM pg_tables
WHERE tablename = 'contenidos';

-- 2. Ver todas las políticas de contenidos
SELECT 
  policyname as nombre_politica,
  cmd as comando,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Lectura'
    WHEN cmd = 'INSERT' THEN 'Inserción'
    WHEN cmd = 'UPDATE' THEN 'Actualización'
    WHEN cmd = 'DELETE' THEN 'Eliminación'
    ELSE cmd
  END as tipo,
  roles,
  CASE 
    WHEN qual IS NULL THEN 'Sin restricción'
    ELSE 'Con restricción'
  END as tiene_usando,
  CASE 
    WHEN with_check IS NULL THEN 'Sin verificación'
    ELSE 'Con verificación'
  END as tiene_check
FROM pg_policies
WHERE tablename = 'contenidos'
ORDER BY cmd, policyname;

-- 3. Ver el constraint de created_by
SELECT
  conname as nombre_constraint,
  pg_get_constraintdef(oid) as definicion
FROM pg_constraint
WHERE conname = 'contenidos_created_by_fkey';

-- 4. Ver estructura de la tabla contenidos
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'contenidos'
ORDER BY ordinal_position;

