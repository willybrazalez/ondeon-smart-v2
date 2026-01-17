-- =====================================================
-- 🔍 DIAGNÓSTICO AI_GENERATED_ADS
-- =====================================================
-- Ejecuta esto para ver el estado de ai_generated_ads
-- =====================================================

-- 1. Ver si RLS está activado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_activado
FROM pg_tables
WHERE tablename = 'ai_generated_ads';

-- 2. Ver todas las políticas de ai_generated_ads
SELECT 
  policyname as nombre_politica,
  cmd as comando,
  roles,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename = 'ai_generated_ads'
ORDER BY cmd, policyname;

-- 3. Ver columnas de tracking
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'ai_generated_ads'
AND column_name IN ('text_regeneration_count', 'voice_change_count')
ORDER BY column_name;

