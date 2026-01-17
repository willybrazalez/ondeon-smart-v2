-- =====================================================
-- Migración 015: RLS y Tracking de Intentos para AI Ads
-- =====================================================
-- Descripción: 
-- - Activa RLS en ai_generated_ads
-- - Añade políticas para usuarios autenticados y legacy
-- - Añade columnas para tracking de intentos de texto y voz
-- =====================================================

-- ============================================
-- 1. Actualizar tabla AI_GENERATED_ADS
-- ============================================

-- Añadir columnas para tracking de intentos
ALTER TABLE public.ai_generated_ads
ADD COLUMN IF NOT EXISTS text_regeneration_count integer DEFAULT 0 NOT NULL;

ALTER TABLE public.ai_generated_ads
ADD COLUMN IF NOT EXISTS voice_change_count integer DEFAULT 0 NOT NULL;

-- Añadir constraints para limitar intentos a máximo 3
ALTER TABLE public.ai_generated_ads
ADD CONSTRAINT ai_ads_text_regeneration_limit 
CHECK (text_regeneration_count >= 0 AND text_regeneration_count <= 3);

ALTER TABLE public.ai_generated_ads
ADD CONSTRAINT ai_ads_voice_change_limit 
CHECK (voice_change_count >= 0 AND voice_change_count <= 3);

-- Añadir índices para optimizar consultas de intentos
CREATE INDEX IF NOT EXISTS idx_ai_ads_text_regen_count 
ON public.ai_generated_ads (text_regeneration_count);

CREATE INDEX IF NOT EXISTS idx_ai_ads_voice_change_count 
ON public.ai_generated_ads (voice_change_count);

-- Añadir comentarios para documentación
COMMENT ON COLUMN public.ai_generated_ads.text_regeneration_count IS 
'Número de veces que el usuario regeneró el texto antes de confirmar (máximo 3)';

COMMENT ON COLUMN public.ai_generated_ads.voice_change_count IS 
'Número de veces que el usuario cambió de voz antes de confirmar (máximo 3)';

-- ============================================
-- 2. Activar RLS en AI_GENERATED_ADS
-- ============================================

-- Activar Row Level Security
ALTER TABLE public.ai_generated_ads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Crear políticas RLS
-- ============================================

-- Política: Los usuarios pueden ver sus propios anuncios
CREATE POLICY "Users can view own ai_generated_ads"
ON public.ai_generated_ads
FOR SELECT
USING (
  auth.uid() = created_by
  OR
  -- Los admins pueden ver anuncios de su empresa
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.rol_id = 3
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
  OR
  -- Los gestores pueden ver anuncios de su empresa
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.rol_id = 2
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

-- Política: Los usuarios pueden insertar anuncios
CREATE POLICY "Users can insert own ai_generated_ads"
ON public.ai_generated_ads
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND
  (
    -- Verificar que el usuario pertenece a la empresa
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.empresa_id = ai_generated_ads.empresa_id
      AND u.rol_id IN (2, 3) -- Gestor o Administrador
    )
  )
);

-- Política: Los usuarios pueden actualizar sus propios anuncios
CREATE POLICY "Users can update own ai_generated_ads"
ON public.ai_generated_ads
FOR UPDATE
USING (
  auth.uid() = created_by
  OR
  -- Los admins pueden actualizar anuncios de su empresa
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.rol_id = 3
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

-- Política: Los usuarios pueden eliminar sus propios anuncios
CREATE POLICY "Users can delete own ai_generated_ads"
ON public.ai_generated_ads
FOR DELETE
USING (
  auth.uid() = created_by
  OR
  -- Los admins pueden eliminar anuncios de su empresa
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND u.rol_id = 3
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

-- ============================================
-- 4. Políticas para usuarios LEGACY (anon)
-- ============================================

-- Política: Usuarios legacy (anon) pueden ver anuncios de su empresa
CREATE POLICY "Legacy users can view ai_generated_ads"
ON public.ai_generated_ads
FOR SELECT
USING (
  auth.role() = 'anon'
  AND
  -- Verificar que el usuario legacy pertenece a la empresa
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.auth_user_id IS NULL
    AND u.empresa_id = ai_generated_ads.empresa_id
  )
);

-- Política: Usuarios legacy pueden insertar anuncios
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

-- ============================================
-- 5. Grants de permisos
-- ============================================

-- Dar permisos a usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_ads TO authenticated;

-- Dar permisos a usuarios anónimos (legacy)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_ads TO anon;

-- ============================================
-- 6. Actualizar políticas RLS de CONTENIDOS
-- ============================================

-- Eliminar política INSERT restrictiva si existe
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar contenidos" ON public.contenidos;

-- Crear nueva política INSERT más permisiva
CREATE POLICY "Usuarios autenticados pueden insertar contenidos"
ON public.contenidos
FOR INSERT
WITH CHECK (
  -- Permitir si el usuario está autenticado
  auth.uid() = created_by
  OR
  -- Permitir si es un usuario del sistema (para anuncios IA)
  auth.role() = 'authenticated'
);

-- Política INSERT para usuarios legacy (anon)
DROP POLICY IF EXISTS "Legacy users can insert contenidos" ON public.contenidos;

CREATE POLICY "Legacy users can insert contenidos"
ON public.contenidos
FOR INSERT
WITH CHECK (
  auth.role() = 'anon'
  AND
  -- Verificar que el usuario legacy existe
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = contenidos.created_by
    AND u.auth_user_id IS NULL
  )
);

-- ============================================
-- 7. Verificación
-- ============================================

-- Comentario final
COMMENT ON TABLE public.ai_generated_ads IS 
'Tabla de anuncios generados con IA. RLS activado para usuarios autenticados y legacy. Incluye tracking de intentos de regeneración.';

-- Mostrar estado de RLS
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 015 completada exitosamente';
  RAISE NOTICE '✅ RLS activado en ai_generated_ads';
  RAISE NOTICE '✅ Columnas de tracking añadidas (text_regeneration_count, voice_change_count)';
  RAISE NOTICE '✅ Límite de 3 intentos configurado para texto y voz';
  RAISE NOTICE '✅ Políticas RLS creadas para usuarios autenticados y legacy';
  RAISE NOTICE '✅ Políticas RLS de contenidos actualizadas para permitir INSERT';
END $$;

