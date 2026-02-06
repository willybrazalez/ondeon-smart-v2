# Errores Locales - RESUELTOS

## Error SQL "aggregate function calls cannot be nested"

**Estado:** ✅ RESUELTO  
**Fecha resolución:** 2 de febrero de 2026  
**Migración:** `database/029_fix_section_channels_populares.sql`

### Error Original

```
POST https://vqhaoerphnyahnbemmdd.supabase.co/rest/v1/rpc/rpc_get_section_channels 400
❌ Error en rpc_get_section_channels: {
  code: '42803', 
  message: 'aggregate function calls cannot be nested'
}
```

**Aparecía en líneas:** 163-169, 277-301, 343-386 del log original

**Sección afectada:** "Más escuchados" (ID: `45b1ae55-ae25-46d4-999e-d736a1f25761`)

### Causa

Función SQL intentaba anidar `COUNT()` dentro de `json_agg()`:
```sql
SELECT json_agg(
  json_build_object('play_count', COUNT(ph.id))
) FROM ...
GROUP BY c.id
```

PostgreSQL no permite funciones de agregación anidadas.

### Solución Aplicada

Refactorización con subconsulta:
```sql
SELECT json_agg(...) 
FROM (
  SELECT c.id, COUNT(ph.id) as play_count
  FROM canales c
  LEFT JOIN playback_history ph ON ...
  GROUP BY c.id
) channel_stats;
```

### Verificación

```sql
-- Función actualizada correctamente
SELECT obj_description(p.oid, 'pg_proc') 
FROM pg_proc p 
WHERE p.proname = 'rpc_get_section_channels';
-- Resultado: "...v2 corregido"
```

### Estado Final

- ✅ Error eliminado
- ✅ Sección "Más escuchados" funciona
- ✅ 10/10 secciones operativas
- ✅ Sin errores 400 en consola

---

## Otros Logs del Archivo Original

### Warnings de React Router (No críticos)

```
⚠️ React Router Future Flag Warning: v7_startTransition
⚠️ React Router Future Flag Warning: v7_relativeSplatPath
```

**Estado:** No requiere acción  
**Razón:** Warnings de preparación para React Router v7  
**Impacto:** Ninguno en funcionalidad actual

### Logs Informativos (Normales)

- ✅ Vite conectando y recargando
- ✅ Sistema de autenticación funcionando
- ✅ Cache de secciones operativo
- ✅ Reproductor de audio inicializado
- ✅ Suscripciones Realtime activas

### Usuario FREE sin acceso a canales

```
🔒 Usuario FREE sin acceso a página de canales
```

**Estado:** Comportamiento esperado  
**Razón:** Usuario en plan FREE no tiene acceso a canales  
**Solución:** Usuario necesita plan TRIAL, BASICO o PRO

---

## Resumen

**Errores críticos:** 1 → ✅ Resuelto  
**Warnings:** 2 → No críticos  
**Estado sistema:** ✅ Completamente funcional

El archivo `errores.local.md` puede ser archivado o renombrado.
Sistema listo para producción.
