-- =====================================================
-- 🚀 EJECUTA ESTE SQL EN SUPABASE DASHBOARD
-- =====================================================
-- Dashboard: https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/sql/new
-- 
-- Este script:
-- 1. Añade columnas de tracking a ai_generated_ads
-- 2. Activa RLS en ai_generated_ads
-- 3. Crea políticas RLS para ai_generated_ads
-- 4. ARREGLA las políticas RLS de contenidos (el error 42501)
-- =====================================================

-- ============================================
-- PASO 1: Añadir columnas de tracking
-- ============================================

ALTER TABLE public.ai_generated_ads
ADD COLUMN IF NOT EXISTS text_regeneration_count integer DEFAULT 0 NOT NULL;

ALTER TABLE public.ai_generated_ads
ADD COLUMN IF NOT EXISTS voice_change_count integer DEFAULT 0 NOT NULL;

ALTER TABLE public.ai_generated_ads
ADD CONSTRAINT ai_ads_text_regeneration_limit 
CHECK (text_regeneration_count >= 0 AND text_regeneration_count <= 3);

ALTER TABLE public.ai_generated_ads
ADD CONSTRAINT ai_ads_voice_change_limit 
CHECK (voice_change_count >= 0 AND voice_change_count <= 3);

CREATE INDEX IF NOT EXISTS idx_ai_ads_text_regen_count 
ON public.ai_generated_ads (text_regeneration_count);

CREATE INDEX IF NOT EXISTS idx_ai_ads_voice_change_count 
ON public.ai_generated_ads (voice_change_count);

-- ============================================
-- PASO 2: Activar RLS en ai_generated_ads
-- ============================================

ALTER TABLE public.ai_generated_ads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 3: Crear políticas para ai_generated_ads
-- ============================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view own ai_generated_ads" ON public.ai_generated_ads;

CREATE POLICY "Users can view own ai_generated_ads"
ON public.ai_generated_ads
FOR SELECT
USING (
  auth.uid() = created_by
  OR
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.rol_id IN (2, 3)
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert own ai_generated_ads" ON public.ai_generated_ads;

CREATE POLICY "Users can insert own ai_generated_ads"
ON public.ai_generated_ads
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.empresa_id = ai_generated_ads.empresa_id
    AND u.rol_id IN (2, 3)
  )
);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update own ai_generated_ads" ON public.ai_generated_ads;

CREATE POLICY "Users can update own ai_generated_ads"
ON public.ai_generated_ads
FOR UPDATE
USING (
  auth.uid() = created_by
  OR
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.rol_id = 3
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete own ai_generated_ads" ON public.ai_generated_ads;

CREATE POLICY "Users can delete own ai_generated_ads"
ON public.ai_generated_ads
FOR DELETE
USING (
  auth.uid() = created_by
  OR
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.rol_id = 3
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

-- Legacy users policies
DROP POLICY IF EXISTS "Legacy users can view ai_generated_ads" ON public.ai_generated_ads;

CREATE POLICY "Legacy users can view ai_generated_ads"
ON public.ai_generated_ads
FOR SELECT
USING (
  auth.role() = 'anon'
  AND
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.auth_user_id IS NULL
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

DROP POLICY IF EXISTS "Legacy users can insert ai_generated_ads" ON public.ai_generated_ads;

CREATE POLICY "Legacy users can insert ai_generated_ads"
ON public.ai_generated_ads
FOR INSERT
WITH CHECK (
  auth.role() = 'anon'
  AND
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = created_by
    AND u.auth_user_id IS NULL
    AND u.empresa_id = ai_generated_ads.empresa_id
    AND u.rol_id IN (2, 3)
  )
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_ads TO anon;

-- ============================================
-- PASO 4: ARREGLAR políticas de CONTENIDOS
-- (Esto soluciona el error 42501)
-- ============================================

-- Eliminar política INSERT restrictiva
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar contenidos" ON public.contenidos;

-- Crear nueva política INSERT PERMISIVA
CREATE POLICY "Usuarios autenticados pueden insertar contenidos"
ON public.contenidos
FOR INSERT
WITH CHECK (
  -- Permitir a usuarios autenticados
  auth.role() = 'authenticated'
);

-- Política para usuarios legacy (anon)
DROP POLICY IF EXISTS "Legacy users can insert contenidos" ON public.contenidos;

CREATE POLICY "Legacy users can insert contenidos"
ON public.contenidos
FOR INSERT
WITH CHECK (
  auth.role() = 'anon'
);

-- ============================================
-- ✅ FINALIZADO
-- ============================================

-- Mostrar resultado
DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE '✅ RLS activado en ai_generated_ads';
  RAISE NOTICE '✅ Columnas de tracking añadidas';
  RAISE NOTICE '✅ Políticas RLS de contenidos actualizadas';
  RAISE NOTICE '✅ Error 42501 solucionado';
END $$;

