-- ============================================================================
-- VERIFICACIÓN PREVIA - Antes de aplicar correcciones
-- ============================================================================
-- Este script verifica el estado actual de las políticas e índices
-- Ejecuta esto ANTES de aplicar 200_fix_supabase_performance_warnings.sql
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR POLÍTICAS RLS CON PROBLEMAS DE AUTH
-- ============================================================================

SELECT 
    '🔍 POLÍTICAS CON PROBLEMAS DE auth.uid()' as seccion;

SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN qual::text LIKE '%auth.uid()%' 
             AND qual::text NOT LIKE '%(SELECT auth.uid())%' THEN '❌ Necesita optimización'
        ELSE '✅ OK'
    END as estado,
    qual::text as condicion
FROM pg_policies
WHERE schemaname = 'public'
    AND (qual::text LIKE '%auth.uid()%' OR with_check::text LIKE '%auth.uid()%')
ORDER BY tablename, policyname;

-- ============================================================================
-- 2. VERIFICAR POLÍTICAS MÚLTIPLES
-- ============================================================================

SELECT 
    '🔍 TABLAS CON MÚLTIPLES POLÍTICAS PERMISIVAS' as seccion;

SELECT 
    tablename,
    cmd as comando,
    COUNT(*) as num_politicas,
    CASE 
        WHEN COUNT(*) > 1 THEN '⚠️ Consolidar'
        ELSE '✅ OK'
    END as estado,
    string_agg(policyname, ', ') as nombres_politicas
FROM pg_policies
WHERE schemaname = 'public'
    AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- 3. VERIFICAR ÍNDICES DUPLICADOS
-- ============================================================================

SELECT 
    '🔍 ÍNDICES DUPLICADOS' as seccion;

WITH index_columns AS (
    SELECT 
        schemaname,
        tablename,
        indexname,
        array_agg(attname ORDER BY attnum) as columns
    FROM pg_indexes
    CROSS JOIN LATERAL unnest(string_to_array(
        regexp_replace(indexdef, '.*\((.*)\).*', '\1'), 
        ','
    )) WITH ORDINALITY AS cols(attname, attnum)
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename, indexname
)
SELECT 
    i1.tablename,
    i1.indexname as indice_1,
    i2.indexname as indice_2,
    i1.columns,
    '⚠️ Duplicado' as estado
FROM index_columns i1
JOIN index_columns i2 
    ON i1.tablename = i2.tablename 
    AND i1.columns = i2.columns
    AND i1.indexname < i2.indexname;

-- ============================================================================
-- 4. VERIFICAR CLAVES FORÁNEAS SIN ÍNDICE
-- ============================================================================

SELECT 
    '🔍 CLAVES FORÁNEAS SIN ÍNDICE' as seccion;

SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN i.indexname IS NULL THEN '❌ Sin índice'
        ELSE '✅ Con índice'
    END as estado
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN pg_indexes i 
    ON i.tablename = tc.table_name
    AND i.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY 
    CASE WHEN i.indexname IS NULL THEN 0 ELSE 1 END,
    tc.table_name;

-- ============================================================================
-- 5. VERIFICAR ÍNDICES SIN USAR
-- ============================================================================

SELECT 
    '🔍 ÍNDICES SIN USAR' as seccion;

SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as veces_usado,
    pg_size_pretty(pg_relation_size(indexrelid)) as tamaño,
    CASE 
        WHEN idx_scan = 0 THEN '⚠️ Nunca usado'
        WHEN idx_scan < 10 THEN '⚠️ Poco usado'
        ELSE '✅ En uso'
    END as estado
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexrelname LIKE 'idx_%'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 6. RESUMEN GENERAL
-- ============================================================================

SELECT 
    '📊 RESUMEN GENERAL' as seccion;

SELECT 
    'Total de políticas RLS' as metrica,
    COUNT(*)::text as valor
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Políticas con auth.uid() sin optimizar' as metrica,
    COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public'
    AND qual::text LIKE '%auth.uid()%'
    AND qual::text NOT LIKE '%(SELECT auth.uid())%'
UNION ALL
SELECT 
    'Tablas con políticas múltiples' as metrica,
    COUNT(DISTINCT tablename)::text
FROM (
    SELECT tablename, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename, cmd
    HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 
    'Claves foráneas sin índice' as metrica,
    COUNT(*)::text
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN pg_indexes i 
    ON i.tablename = tc.table_name
    AND i.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND i.indexname IS NULL
UNION ALL
SELECT 
    'Índices sin usar' as metrica,
    COUNT(*)::text
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexrelname LIKE 'idx_%'
UNION ALL
SELECT 
    'Tamaño total de índices' as metrica,
    pg_size_pretty(SUM(pg_relation_size(indexrelid)))
FROM pg_stat_user_indexes
WHERE schemaname = 'public';

-- ============================================================================
-- 7. TAMAÑO DE TABLAS PRINCIPALES
-- ============================================================================

SELECT 
    '📊 TAMAÑO DE TABLAS PRINCIPALES' as seccion;

SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as tamaño_total,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as tamaño_tabla,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as tamaño_indices,
    (pg_indexes_size(schemaname||'.'||tablename)::float / 
     NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0) * 100)::numeric(5,2) as porcentaje_indices
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 15;

-- ============================================================================
-- FIN DE VERIFICACIÓN
-- ============================================================================

SELECT 
    '✅ Verificación completada' as resultado,
    'Revisa los resultados arriba antes de ejecutar el script de corrección' as siguiente_paso;
