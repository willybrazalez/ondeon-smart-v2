-- =====================================================
-- QUERIES ÚTILES PARA FACTURACIÓN DE ANUNCIOS IA
-- =====================================================
-- Copia y pega estas queries en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. REPORTE MENSUAL COMPLETO
-- =====================================================

-- Reporte del mes actual
SELECT * FROM get_monthly_billing_report(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);

-- Reporte de un mes específico (ej: Noviembre 2025)
SELECT * FROM get_monthly_billing_report(2025, 11);

-- =====================================================
-- 2. RESUMEN POR EMPRESA (TODO EL TIEMPO)
-- =====================================================

-- Ver todas las empresas y su uso total
SELECT * FROM ai_ads_usage_summary_by_company
ORDER BY total_cost_euros DESC;

-- Ver solo empresas activas (con anuncios)
SELECT * FROM ai_ads_usage_summary_by_company
WHERE total_ads_created > 0
ORDER BY total_cost_euros DESC;

-- Top 10 empresas por ingresos
SELECT 
  razon_social,
  total_ads_created,
  total_cost_euros
FROM ai_ads_usage_summary_by_company
WHERE total_ads_created > 0
ORDER BY total_cost_euros DESC
LIMIT 10;

-- =====================================================
-- 3. USO MENSUAL DE UNA EMPRESA ESPECÍFICA
-- =====================================================

-- Ver últimos 12 meses de una empresa
SELECT * FROM ai_ads_monthly_usage
WHERE empresa_id = 'UUID_EMPRESA'
ORDER BY year DESC, month DESC
LIMIT 12;

-- Ver año completo de una empresa
SELECT * FROM ai_ads_monthly_usage
WHERE empresa_id = 'UUID_EMPRESA'
  AND year = 2025
ORDER BY month DESC;

-- =====================================================
-- 4. EVOLUCIÓN MENSUAL (PARA GRÁFICAS)
-- =====================================================

-- Ingresos mensuales totales (todos los clientes)
SELECT 
  period,
  year,
  month,
  SUM(monthly_cost_euros) as total_revenue,
  COUNT(DISTINCT empresa_id) as active_companies,
  SUM(ads_saved) as total_ads
FROM ai_ads_monthly_usage
WHERE year >= 2025
GROUP BY period, year, month
ORDER BY year DESC, month DESC;

-- Comparación mes actual vs mes anterior
SELECT 
  'Mes Actual' as periodo,
  COUNT(DISTINCT empresa_id) as empresas_activas,
  SUM(estimated_cost_cents) / 100.0 as ingresos_euros
FROM ai_ads_usage_tracking
WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)

UNION ALL

SELECT 
  'Mes Anterior' as periodo,
  COUNT(DISTINCT empresa_id) as empresas_activas,
  SUM(estimated_cost_cents) / 100.0 as ingresos_euros
FROM ai_ads_usage_tracking
WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
  AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month');

-- =====================================================
-- 5. RESUMEN GENERAL
-- =====================================================

-- Resumen completo del sistema
SELECT * FROM get_billing_summary();

-- Estadísticas globales
SELECT 
  COUNT(DISTINCT empresa_id) as total_empresas,
  COUNT(DISTINCT ai_ad_id) as total_anuncios,
  COUNT(*) as total_acciones,
  SUM(estimated_cost_cents) / 100.0 as ingresos_totales_euros,
  AVG(estimated_cost_cents) / 100.0 as costo_promedio_por_accion_euros
FROM ai_ads_usage_tracking;

-- =====================================================
-- 6. DETALLE DE ACCIONES POR EMPRESA
-- =====================================================

-- Ver todas las acciones de una empresa (con detalles)
SELECT 
  ut.*,
  ai.titulo as anuncio_titulo,
  u.nombre as admin_nombre
FROM ai_ads_usage_tracking ut
LEFT JOIN ai_generated_ads ai ON ai.id = ut.ai_ad_id
LEFT JOIN usuarios u ON u.id = ut.admin_id
WHERE ut.empresa_id = 'UUID_EMPRESA'
ORDER BY ut.created_at DESC;

-- Resumen de acciones por tipo (una empresa)
SELECT 
  action_type,
  COUNT(*) as cantidad,
  SUM(tokens_used) as total_tokens,
  SUM(characters_used) as total_caracteres,
  SUM(estimated_cost_cents) / 100.0 as costo_total_euros
FROM ai_ads_usage_tracking
WHERE empresa_id = 'UUID_EMPRESA'
GROUP BY action_type
ORDER BY costo_total_euros DESC;

-- =====================================================
-- 7. EXPORTAR PARA FACTURACIÓN
-- =====================================================

-- Generar CSV del mes (formato para contabilidad)
SELECT 
  e.razon_social as "Razón Social",
  e.cif as "CIF",
  e.direccion_postal as "Dirección",
  e.localidad as "Localidad",
  COUNT(DISTINCT ai.id) as "Anuncios Creados",
  COUNT(CASE WHEN ut.action_type = 'text_generated' THEN 1 END) as "Textos Generados",
  COUNT(CASE WHEN ut.action_type = 'audio_generated' THEN 1 END) as "Audios Generados",
  COALESCE(SUM(ut.estimated_cost_cents), 0) / 100.0 as "Importe (EUR)"
FROM empresas e
LEFT JOIN ai_generated_ads ai ON ai.empresa_id = e.id 
  AND EXTRACT(YEAR FROM ai.created_at) = 2025
  AND EXTRACT(MONTH FROM ai.created_at) = 11
LEFT JOIN ai_ads_usage_tracking ut ON ut.empresa_id = e.id
  AND EXTRACT(YEAR FROM ut.created_at) = 2025
  AND EXTRACT(MONTH FROM ut.created_at) = 11
WHERE ai.id IS NOT NULL  -- Solo empresas con anuncios
GROUP BY e.id, e.razon_social, e.cif, e.direccion_postal, e.localidad
ORDER BY "Importe (EUR)" DESC;

-- =====================================================
-- 8. ANÁLISIS Y ESTADÍSTICAS
-- =====================================================

-- Distribución de costos por tipo de acción
SELECT 
  action_type,
  COUNT(*) as num_acciones,
  ROUND(AVG(estimated_cost_cents) / 100.0, 4) as costo_promedio_euros,
  ROUND(SUM(estimated_cost_cents) / 100.0, 2) as costo_total_euros,
  ROUND(100.0 * SUM(estimated_cost_cents) / (SELECT SUM(estimated_cost_cents) FROM ai_ads_usage_tracking), 2) as porcentaje_del_total
FROM ai_ads_usage_tracking
GROUP BY action_type
ORDER BY costo_total_euros DESC;

-- Empresas más activas (por número de anuncios)
SELECT 
  e.razon_social,
  COUNT(DISTINCT ai.id) as anuncios_creados,
  COUNT(ut.id) as acciones_totales,
  SUM(ut.estimated_cost_cents) / 100.0 as costo_total_euros
FROM empresas e
INNER JOIN ai_generated_ads ai ON ai.empresa_id = e.id
LEFT JOIN ai_ads_usage_tracking ut ON ut.empresa_id = e.id
GROUP BY e.id, e.razon_social
ORDER BY anuncios_creados DESC
LIMIT 20;

-- Crecimiento mensual (últimos 6 meses)
SELECT 
  TO_CHAR(created_at, 'YYYY-MM') as mes,
  COUNT(DISTINCT empresa_id) as empresas_activas,
  COUNT(DISTINCT ai_ad_id) as anuncios_creados,
  COUNT(*) as acciones_totales,
  ROUND(SUM(estimated_cost_cents) / 100.0, 2) as ingresos_euros
FROM ai_ads_usage_tracking
WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY mes
ORDER BY mes DESC;

-- =====================================================
-- 9. VERIFICACIÓN Y DEBUGGING
-- =====================================================

-- Verificar que el tracking está funcionando
SELECT 
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as fecha_hora,
  action_type,
  estimated_cost_cents / 100.0 as costo_euros
FROM ai_ads_usage_tracking
ORDER BY created_at DESC
LIMIT 20;

-- Ver última actividad por empresa
SELECT 
  e.razon_social,
  MAX(ut.created_at) as ultima_actividad,
  COUNT(DISTINCT DATE(ut.created_at)) as dias_activos,
  COUNT(*) as total_acciones
FROM empresas e
INNER JOIN ai_ads_usage_tracking ut ON ut.empresa_id = e.id
GROUP BY e.id, e.razon_social
ORDER BY ultima_actividad DESC;

-- Verificar costos estimados
SELECT 
  action_type,
  MIN(estimated_cost_cents) as minimo,
  AVG(estimated_cost_cents) as promedio,
  MAX(estimated_cost_cents) as maximo
FROM ai_ads_usage_tracking
GROUP BY action_type;

-- =====================================================
-- 10. ALERTAS Y MONITOREO
-- =====================================================

-- Empresas con uso inusualmente alto este mes
SELECT 
  e.razon_social,
  COUNT(*) as acciones_este_mes,
  SUM(ut.estimated_cost_cents) / 100.0 as costo_este_mes_euros
FROM ai_ads_usage_tracking ut
JOIN empresas e ON e.id = ut.empresa_id
WHERE EXTRACT(YEAR FROM ut.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM ut.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
GROUP BY e.id, e.razon_social
HAVING COUNT(*) > 50  -- Más de 50 acciones
ORDER BY acciones_este_mes DESC;

-- Detectar posibles errores (acciones sin costo estimado)
SELECT *
FROM ai_ads_usage_tracking
WHERE estimated_cost_cents IS NULL
  OR estimated_cost_cents < 0
ORDER BY created_at DESC;

-- =====================================================
-- NOTAS DE USO:
-- =====================================================
-- 1. Reemplaza 'UUID_EMPRESA' con el ID real de la empresa
-- 2. Ajusta fechas (2025, 11) según el mes/año deseado
-- 3. Los costos son ESTIMACIONES basadas en tarifas públicas
-- 4. Para exportar a CSV en Supabase Dashboard:
--    Ejecuta la query → Click en "Export" → Descarga CSV
-- =====================================================

