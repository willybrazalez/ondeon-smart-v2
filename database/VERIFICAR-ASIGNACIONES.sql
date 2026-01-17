-- =====================================================
-- SCRIPT DE VERIFICACIÓN: Asignaciones de Anuncios IA
-- =====================================================
-- Ejecuta estas queries en el Dashboard de Supabase
-- para verificar que los anuncios se están asignando
-- correctamente a las empresas.
-- =====================================================

-- 1. Ver últimas asignaciones creadas (general)
SELECT 
  ca.id AS asignacion_id,
  ca.contenido_id,
  c.nombre AS nombre_contenido,
  c.tipo_contenido,
  ca.empresa_id,
  e.nombre AS nombre_empresa,
  ca.activo,
  ca.fecha_inicio,
  ca.created_at AS fecha_asignacion
FROM contenido_asignaciones ca
JOIN contenidos c ON c.id = ca.contenido_id
LEFT JOIN empresas e ON e.id = ca.empresa_id
ORDER BY ca.created_at DESC
LIMIT 20;

-- =====================================================

-- 2. Ver asignaciones de anuncios IA específicamente
SELECT 
  ca.id AS asignacion_id,
  c.id AS contenido_id,
  c.nombre AS nombre_contenido,
  ai.titulo AS titulo_anuncio_ia,
  ai.idea_original,
  ai.empresa_nombre,
  ca.empresa_id,
  e.nombre AS nombre_empresa_asignada,
  ca.activo AS asignacion_activa,
  ca.fecha_inicio,
  ca.created_at AS fecha_asignacion,
  ai.created_at AS fecha_creacion_ia
FROM contenido_asignaciones ca
JOIN contenidos c ON c.id = ca.contenido_id
JOIN ai_generated_ads ai ON ai.contenido_id = c.id
LEFT JOIN empresas e ON e.id = ca.empresa_id
WHERE c.tipo_contenido = 'cuna'
ORDER BY ca.created_at DESC
LIMIT 20;

-- =====================================================

-- 3. Verificar que TODOS los anuncios IA tienen asignación
-- (Si aparecen resultados, hay anuncios SIN asignar)
SELECT 
  ai.id AS ai_ad_id,
  ai.titulo,
  ai.contenido_id,
  ai.empresa_id,
  ai.empresa_nombre,
  c.nombre AS nombre_contenido,
  'SIN ASIGNACIÓN' AS problema
FROM ai_generated_ads ai
JOIN contenidos c ON c.id = ai.contenido_id
WHERE NOT EXISTS (
  SELECT 1 
  FROM contenido_asignaciones ca 
  WHERE ca.contenido_id = ai.contenido_id
)
ORDER BY ai.created_at DESC;

-- =====================================================

-- 4. Contar asignaciones por empresa
SELECT 
  e.id AS empresa_id,
  e.nombre AS nombre_empresa,
  COUNT(ca.id) AS total_asignaciones,
  COUNT(CASE WHEN ca.activo = true THEN 1 END) AS asignaciones_activas,
  COUNT(CASE WHEN c.tipo_contenido = 'cuna' THEN 1 END) AS anuncios_cuna
FROM empresas e
LEFT JOIN contenido_asignaciones ca ON ca.empresa_id = e.id
LEFT JOIN contenidos c ON c.id = ca.contenido_id
GROUP BY e.id, e.nombre
ORDER BY total_asignaciones DESC;

-- =====================================================

-- 5. Ver último anuncio creado con toda su información
WITH ultimo_anuncio AS (
  SELECT id, contenido_id 
  FROM ai_generated_ads 
  ORDER BY created_at DESC 
  LIMIT 1
)
SELECT 
  'CONTENIDO' AS tabla,
  c.id,
  c.nombre,
  c.tipo_contenido,
  c.url_s3,
  c.activo,
  c.created_at
FROM contenidos c
WHERE c.id = (SELECT contenido_id FROM ultimo_anuncio)

UNION ALL

SELECT 
  'AI_GENERATED_AD' AS tabla,
  ai.id,
  ai.titulo,
  ai.voice_id,
  ai.audio_url,
  ai.activo::text,
  ai.created_at
FROM ai_generated_ads ai
WHERE ai.id = (SELECT id FROM ultimo_anuncio)

UNION ALL

SELECT 
  'ASIGNACIÓN' AS tabla,
  ca.id,
  e.nombre AS empresa,
  ca.tipo_contenido,
  ca.activo::text || ' (prio: ' || ca.prioridad::text || ')' AS detalle,
  ca.activo::text,
  ca.created_at
FROM contenido_asignaciones ca
LEFT JOIN empresas e ON e.id = ca.empresa_id
WHERE ca.contenido_id = (SELECT contenido_id FROM ultimo_anuncio);

-- =====================================================

-- 6. Verificar RLS en contenido_asignaciones
-- (Debe mostrar políticas activas)
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
WHERE tablename = 'contenido_asignaciones'
ORDER BY policyname;

-- =====================================================

-- 7. Asignaciones sin empresa (error de datos)
SELECT 
  ca.id AS asignacion_id,
  ca.contenido_id,
  c.nombre AS nombre_contenido,
  ca.empresa_id,
  ca.usuario_id,
  ca.grupo_id,
  ca.created_at
FROM contenido_asignaciones ca
JOIN contenidos c ON c.id = ca.contenido_id
WHERE ca.empresa_id IS NULL 
  AND ca.usuario_id IS NULL 
  AND ca.grupo_id IS NULL
ORDER BY ca.created_at DESC
LIMIT 10;

-- =====================================================

-- 8. Resumen completo del último anuncio guardado
SELECT 
  ai.id AS ai_ad_id,
  ai.titulo,
  ai.empresa_nombre,
  c.id AS contenido_id,
  c.nombre AS nombre_contenido,
  c.activo AS contenido_activo,
  ca.id AS asignacion_id,
  ca.empresa_id,
  e.nombre AS empresa_asignada,
  ca.activo AS asignacion_activa,
  ai.created_at AS fecha_creacion,
  CASE 
    WHEN ca.id IS NOT NULL THEN '✅ ASIGNADO'
    ELSE '❌ SIN ASIGNAR'
  END AS estado_asignacion
FROM ai_generated_ads ai
JOIN contenidos c ON c.id = ai.contenido_id
LEFT JOIN contenido_asignaciones ca ON ca.contenido_id = c.id
LEFT JOIN empresas e ON e.id = ca.empresa_id
ORDER BY ai.created_at DESC
LIMIT 1;

-- =====================================================
-- FIN DEL SCRIPT DE VERIFICACIÓN
-- =====================================================

-- 📊 RESULTADOS ESPERADOS:
--
-- Query 1: Debe mostrar las últimas asignaciones (mezcla de todos los tipos)
-- Query 2: Debe mostrar solo asignaciones de anuncios IA
-- Query 3: NO debe mostrar nada (todos los anuncios deben tener asignación)
-- Query 4: Debe mostrar conteo por empresa
-- Query 5: Debe mostrar el último anuncio en las 3 tablas
-- Query 6: Debe mostrar políticas RLS activas
-- Query 7: NO debe mostrar nada (todas las asignaciones deben tener empresa/usuario/grupo)
-- Query 8: Debe mostrar "✅ ASIGNADO" para el último anuncio
--
-- =====================================================

