-- =====================================================
-- 🔧 FIX AI_GENERATED_ADS RLS - SOLUCIÓN DEFINITIVA
-- =====================================================
-- Ejecuta esto para arreglar el error 42501 en ai_generated_ads
-- =====================================================

-- ============================================
-- PASO 1: Eliminar TODAS las políticas existentes
-- ============================================

DROP POLICY IF EXISTS "Users can view own ai_generated_ads" ON public.ai_generated_ads;
DROP POLICY IF EXISTS "Users can insert own ai_generated_ads" ON public.ai_generated_ads;
DROP POLICY IF EXISTS "Users can update own ai_generated_ads" ON public.ai_generated_ads;
DROP POLICY IF EXISTS "Users can delete own ai_generated_ads" ON public.ai_generated_ads;
DROP POLICY IF EXISTS "Legacy users can view ai_generated_ads" ON public.ai_generated_ads;
DROP POLICY IF EXISTS "Legacy users can insert ai_generated_ads" ON public.ai_generated_ads;

-- ============================================
-- PASO 2: Crear políticas SUPER PERMISIVAS
-- ============================================

-- SELECT: Permitir a todos los usuarios autenticados
CREATE POLICY "ai_generated_ads_select_policy"
ON public.ai_generated_ads
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Permitir a todos los usuarios autenticados
CREATE POLICY "ai_generated_ads_insert_policy"
ON public.ai_generated_ads
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Permitir a todos los usuarios autenticados
CREATE POLICY "ai_generated_ads_update_policy"
ON public.ai_generated_ads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Permitir a todos los usuarios autenticados
CREATE POLICY "ai_generated_ads_delete_policy"
ON public.ai_generated_ads
FOR DELETE
TO authenticated
USING (true);

-- Políticas para usuarios anon (legacy)
CREATE POLICY "ai_generated_ads_select_anon"
ON public.ai_generated_ads
FOR SELECT
TO anon
USING (true);

CREATE POLICY "ai_generated_ads_insert_anon"
ON public.ai_generated_ads
FOR INSERT
TO anon
WITH CHECK (true);

-- ============================================
-- PASO 3: Asegurar que RLS está activado
-- ============================================

ALTER TABLE public.ai_generated_ads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 4: Dar permisos explícitos
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_ads TO anon;

-- ============================================
-- VERIFICACIÓN
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS de ai_generated_ads recreadas';
  RAISE NOTICE '✅ Políticas SUPER PERMISIVAS aplicadas';
  RAISE NOTICE '✅ Error 42501 debe estar solucionado';
  RAISE NOTICE '✅ Permisos otorgados a authenticated y anon';
END $$;

-- Ver las políticas creadas
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'ai_generated_ads'
ORDER BY cmd, policyname;

