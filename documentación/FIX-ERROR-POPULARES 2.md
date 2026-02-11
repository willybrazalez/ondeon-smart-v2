# Fix: Error SQL en Sección "Más Escuchados"

## Problema Detectado

**Fecha:** 2 de febrero de 2026  
**Error:** PostgreSQL 42803 - "aggregate function calls cannot be nested"  
**Ubicación:** Función `rpc_get_section_channels`, caso 'populares'

## Síntomas

```
❌ Error en rpc_get_section_channels: {
  code: '42803', 
  message: 'aggregate function calls cannot be nested'
}
```

La sección "Más escuchados" (ID: `45b1ae55-ae25-46d4-999e-d736a1f25761`) no cargaba canales.

## Causa

El código SQL original intentaba usar `COUNT()` dentro de `json_agg()`, lo cual PostgreSQL no permite:

```sql
-- ❌ CÓDIGO PROBLEMÁTICO
WHEN 'populares' THEN
  SELECT json_agg(
    json_build_object(
      'play_count', COUNT(ph.id)  -- ❌ COUNT dentro de json_agg
    ) ORDER BY COUNT(ph.id) DESC  -- ❌ COUNT anidado
  ) INTO v_result
  FROM canales c
  LEFT JOIN playback_history ph ON ph.canal_id = c.id
  WHERE c.activo = true
  GROUP BY c.id
  LIMIT 20;
```

## Solución Aplicada

Usar una subconsulta para calcular primero los conteos, luego construir el JSON:

```sql
-- ✅ CÓDIGO CORREGIDO
WHEN 'populares' THEN
  SELECT json_agg(
    json_build_object(
      'id', channel_stats.id,
      'nombre', channel_stats.nombre,
      'descripcion', channel_stats.descripcion,
      'imagen_url', channel_stats.imagen_url,
      'play_count', channel_stats.play_count
    ) ORDER BY channel_stats.play_count DESC
  ) INTO v_result
  FROM (
    SELECT 
      c.id,
      c.nombre,
      c.descripcion,
      c.imagen_url,
      COUNT(ph.id) as play_count
    FROM canales c
    LEFT JOIN playback_history ph ON ph.canal_id = c.id 
      AND ph.created_at >= now() - interval '30 days'
    WHERE c.activo = true
    GROUP BY c.id, c.nombre, c.descripcion, c.imagen_url
    ORDER BY COUNT(ph.id) DESC
    LIMIT 20
  ) channel_stats;
```

## Migración Aplicada

**Archivo:** `database/029_fix_section_channels_populares.sql`

**Ejecutada:** ✅ Exitosamente en Supabase

## Verificación

```sql
-- Verificar función actualizada
SELECT obj_description(p.oid, 'pg_proc') 
FROM pg_proc p 
WHERE p.proname = 'rpc_get_section_channels';
-- Debe devolver: "...v2 corregido"
```

## Resultado

- ✅ Función `rpc_get_section_channels` corregida
- ✅ Sección "Más escuchados" ahora funciona correctamente
- ✅ Sin errores SQL en la consola del navegador
- ✅ Las 10 secciones cargan correctamente

## Impacto

- **Antes:** 9 de 10 secciones funcionaban
- **Después:** 10 de 10 secciones funcionan ✅

## Archivos Modificados

1. `database/029_fix_section_channels_populares.sql` - Migración de corrección
2. `IMPLEMENTACION-COMPLETA.md` - Actualizada con instrucción de ejecutar migración 029
3. `documentación/FIX-ERROR-POPULARES.md` - Esta documentación

## Lecciones Aprendidas

- PostgreSQL no permite anidar funciones de agregación
- Siempre usar subconsultas o CTEs cuando se necesiten agregaciones dentro de funciones de agregación
- Probar todas las variantes de tipos de sección antes de desplegar
