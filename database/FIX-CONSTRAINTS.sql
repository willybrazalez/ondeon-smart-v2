-- =====================================================
-- 🔧 FIX CONSTRAINTS - Eliminar y recrear constraints
-- =====================================================
-- Ejecuta esto para arreglar el error de constraints duplicados
-- =====================================================

-- Eliminar constraints si existen
ALTER TABLE public.ai_generated_ads
DROP CONSTRAINT IF EXISTS ai_ads_text_regeneration_limit;

ALTER TABLE public.ai_generated_ads
DROP CONSTRAINT IF EXISTS ai_ads_voice_change_limit;

-- Recrear constraints con límite de 3 intentos
ALTER TABLE public.ai_generated_ads
ADD CONSTRAINT ai_ads_text_regeneration_limit 
CHECK (text_regeneration_count >= 0 AND text_regeneration_count <= 3);

ALTER TABLE public.ai_generated_ads
ADD CONSTRAINT ai_ads_voice_change_limit 
CHECK (voice_change_count >= 0 AND voice_change_count <= 3);

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Constraints recreados correctamente';
  RAISE NOTICE '✅ Límite de 3 intentos activo';
END $$;

