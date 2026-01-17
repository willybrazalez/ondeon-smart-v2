-- =====================================================
-- SISTEMA DE FACTURACIÓN Y CONTABILIDAD DE ANUNCIOS IA
-- =====================================================
-- Versión: 1.0
-- Fecha: Noviembre 2025
-- Descripción: Sistema completo de tracking y facturación de servicios de IA
-- =====================================================

-- 1. Tabla de tracking de uso de IA
CREATE TABLE IF NOT EXISTS public.ai_ads_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relaciones
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ai_ad_id UUID REFERENCES ai_generated_ads(id) ON DELETE SET NULL,
  admin_id UUID NOT NULL REFERENCES usuarios(id),
  
  -- Tipo de acción
  action_type TEXT NOT NULL CHECK (action_type IN (
    'text_generated',      -- Texto generado con OpenAI
    'text_regenerated',    -- Texto regenerado
    'audio_generated',     -- Audio generado con ElevenLabs
    'audio_regenerated',   -- Audio regenerado (cambio de voz)
    'ad_saved',           -- Anuncio guardado
    'ad_scheduled'        -- Anuncio programado
  )),
  
  -- Detalles del uso
  tokens_used INTEGER,           -- Para OpenAI
  characters_used INTEGER,       -- Para ElevenLabs
  duration_seconds INTEGER,      -- Duración del audio
  voice_id TEXT,                 -- ID de voz usada
  model_used TEXT,               -- Modelo de IA usado
  
  -- Costos estimados (en céntimos de euro)
  estimated_cost_cents DECIMAL(10, 2),
  
  -- Metadata adicional
  metadata JSONB,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_usage_tracking_empresa 
  ON ai_ads_usage_tracking(empresa_id);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at 
  ON ai_ads_usage_tracking(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_action 
  ON ai_ads_usage_tracking(action_type);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_empresa_date 
  ON ai_ads_usage_tracking(empresa_id, created_at DESC);

-- =====================================================
-- 2. Vista de Resumen por Empresa (Todo el tiempo)
-- =====================================================

CREATE OR REPLACE VIEW ai_ads_usage_summary_by_company AS
SELECT 
  e.id as empresa_id,
  e.razon_social,
  e.cif,
  
  -- Conteo de anuncios
  COUNT(DISTINCT ai.id) as total_ads_created,
  
  -- Conteo por tipo de acción
  COUNT(CASE WHEN ut.action_type = 'text_generated' THEN 1 END) as total_texts_generated,
  COUNT(CASE WHEN ut.action_type = 'text_regenerated' THEN 1 END) as total_texts_regenerated,
  COUNT(CASE WHEN ut.action_type = 'audio_generated' THEN 1 END) as total_audios_generated,
  COUNT(CASE WHEN ut.action_type = 'audio_regenerated' THEN 1 END) as total_audios_regenerated,
  COUNT(CASE WHEN ut.action_type = 'ad_saved' THEN 1 END) as total_ads_saved,
  COUNT(CASE WHEN ut.action_type = 'ad_scheduled' THEN 1 END) as total_ads_scheduled,
  
  -- Costos totales
  COALESCE(SUM(ut.estimated_cost_cents), 0) as total_cost_cents,
  ROUND(COALESCE(SUM(ut.estimated_cost_cents), 0) / 100.0, 2) as total_cost_euros,
  
  -- Fechas
  MIN(ai.created_at) as first_ad_date,
  MAX(ai.created_at) as last_ad_date
  
FROM empresas e
LEFT JOIN ai_generated_ads ai ON ai.empresa_id = e.id
LEFT JOIN ai_ads_usage_tracking ut ON ut.empresa_id = e.id
GROUP BY e.id, e.razon_social, e.cif;

-- =====================================================
-- 3. Vista de Uso Mensual por Empresa
-- =====================================================

CREATE OR REPLACE VIEW ai_ads_monthly_usage AS
SELECT 
  e.id as empresa_id,
  e.razon_social,
  EXTRACT(YEAR FROM ut.created_at)::INTEGER as year,
  EXTRACT(MONTH FROM ut.created_at)::INTEGER as month,
  TO_CHAR(ut.created_at, 'YYYY-MM') as period,
  
  -- Conteo por tipo
  COUNT(CASE WHEN ut.action_type = 'text_generated' THEN 1 END) as texts_generated,
  COUNT(CASE WHEN ut.action_type = 'text_regenerated' THEN 1 END) as texts_regenerated,
  COUNT(CASE WHEN ut.action_type = 'audio_generated' THEN 1 END) as audios_generated,
  COUNT(CASE WHEN ut.action_type = 'audio_regenerated' THEN 1 END) as audios_regenerated,
  COUNT(CASE WHEN ut.action_type = 'ad_saved' THEN 1 END) as ads_saved,
  COUNT(CASE WHEN ut.action_type = 'ad_scheduled' THEN 1 END) as ads_scheduled,
  
  -- Costos del mes
  COALESCE(SUM(ut.estimated_cost_cents), 0) as monthly_cost_cents,
  ROUND(COALESCE(SUM(ut.estimated_cost_cents), 0) / 100.0, 2) as monthly_cost_euros
  
FROM empresas e
LEFT JOIN ai_ads_usage_tracking ut ON ut.empresa_id = e.id
WHERE ut.created_at IS NOT NULL
GROUP BY e.id, e.razon_social, year, month, period
ORDER BY year DESC, month DESC, e.razon_social;

-- =====================================================
-- 4. Función para obtener reporte de facturación mensual
-- =====================================================

CREATE OR REPLACE FUNCTION get_monthly_billing_report(
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  empresa_id UUID,
  razon_social TEXT,
  cif TEXT,
  anuncios_creados BIGINT,
  textos_generados BIGINT,
  textos_regenerados BIGINT,
  audios_generados BIGINT,
  audios_regenerados BIGINT,
  anuncios_guardados BIGINT,
  anuncios_programados BIGINT,
  costo_total_cents NUMERIC,
  costo_total_euros NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.razon_social,
    e.cif,
    COUNT(DISTINCT ai.id) as anuncios_creados,
    COUNT(CASE WHEN ut.action_type = 'text_generated' THEN 1 END) as textos_generados,
    COUNT(CASE WHEN ut.action_type = 'text_regenerated' THEN 1 END) as textos_regenerados,
    COUNT(CASE WHEN ut.action_type = 'audio_generated' THEN 1 END) as audios_generados,
    COUNT(CASE WHEN ut.action_type = 'audio_regenerated' THEN 1 END) as audios_regenerados,
    COUNT(CASE WHEN ut.action_type = 'ad_saved' THEN 1 END) as anuncios_guardados,
    COUNT(CASE WHEN ut.action_type = 'ad_scheduled' THEN 1 END) as anuncios_programados,
    COALESCE(SUM(ut.estimated_cost_cents), 0) as costo_total_cents,
    ROUND(COALESCE(SUM(ut.estimated_cost_cents), 0) / 100.0, 2) as costo_total_euros
  FROM empresas e
  LEFT JOIN ai_generated_ads ai ON ai.empresa_id = e.id 
    AND EXTRACT(YEAR FROM ai.created_at) = p_year
    AND EXTRACT(MONTH FROM ai.created_at) = p_month
  LEFT JOIN ai_ads_usage_tracking ut ON ut.empresa_id = e.id
    AND EXTRACT(YEAR FROM ut.created_at) = p_year
    AND EXTRACT(MONTH FROM ut.created_at) = p_month
  GROUP BY e.id, e.razon_social, e.cif
  HAVING COUNT(DISTINCT ai.id) > 0  -- Solo empresas con anuncios
  ORDER BY costo_total_euros DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Función para obtener resumen general
-- =====================================================

CREATE OR REPLACE FUNCTION get_billing_summary()
RETURNS TABLE (
  total_companies_with_ads BIGINT,
  total_ads_created BIGINT,
  total_cost_euros NUMERIC,
  current_month_revenue NUMERIC,
  last_month_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT empresa_id) as total_companies_with_ads,
    COUNT(*) as total_ads_created,
    ROUND(COALESCE(SUM(estimated_cost_cents), 0) / 100.0, 2) as total_cost_euros,
    ROUND(COALESCE(SUM(CASE 
      WHEN EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      THEN estimated_cost_cents ELSE 0 END), 0) / 100.0, 2) as current_month_revenue,
    ROUND(COALESCE(SUM(CASE 
      WHEN EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
      THEN estimated_cost_cents ELSE 0 END), 0) / 100.0, 2) as last_month_revenue
  FROM ai_ads_usage_tracking;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Políticas RLS
-- =====================================================

ALTER TABLE ai_ads_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Admins can view tracking of their companies" ON ai_ads_usage_tracking;
DROP POLICY IF EXISTS "System can insert tracking" ON ai_ads_usage_tracking;
DROP POLICY IF EXISTS "Anon can view tracking" ON ai_ads_usage_tracking;
DROP POLICY IF EXISTS "Anon can insert tracking" ON ai_ads_usage_tracking;

-- Política para usuarios autenticados (admins)
CREATE POLICY "Admins can view tracking of their companies"
  ON ai_ads_usage_tracking
  FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id 
      FROM admin_asignaciones 
      WHERE admin_id = auth.uid()
    )
  );

-- Política para insertar (solo sistema)
CREATE POLICY "System can insert tracking"
  ON ai_ads_usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para anon (legacy)
CREATE POLICY "Anon can view tracking"
  ON ai_ads_usage_tracking
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert tracking"
  ON ai_ads_usage_tracking
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver estructura de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_ads_usage_tracking'
ORDER BY ordinal_position;

-- Verificar que las vistas existen
SELECT table_name 
FROM information_schema.views 
WHERE table_name LIKE 'ai_ads%';

-- Verificar que las funciones existen
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%billing%';

-- =====================================================
-- DATOS DE EJEMPLO (COMENTADOS)
-- =====================================================
/*
-- Ejemplo de inserción manual
INSERT INTO ai_ads_usage_tracking 
  (empresa_id, admin_id, action_type, tokens_used, estimated_cost_cents)
VALUES 
  ('uuid-empresa', 'uuid-admin', 'text_generated', 150, 1.5);

-- Ejemplo de consulta del mes actual
SELECT * FROM get_monthly_billing_report(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);

-- Ejemplo de resumen general
SELECT * FROM get_billing_summary();
*/

