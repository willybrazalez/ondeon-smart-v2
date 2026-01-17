# 📋 Instrucciones para el Administrador - Sistema de Facturación IA

## 🎯 **Objetivo**

Implementar un sistema de tracking automático para registrar el uso de servicios de IA (OpenAI + ElevenLabs) y poder generar reportes mensuales de facturación por empresa.

**Tiempo estimado:** 10 minutos

---

## ⚡ **PASO 1: Ejecutar SQL en Supabase (5 min)**

### 1.1 Acceder a Supabase
1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona el proyecto
3. Menú lateral → **SQL Editor**
4. Click en **New query**

### 1.2 Ejecutar el Script
1. Abre el archivo: **`database/020_ai_ads_billing_system.sql`**
2. Copia **TODO** el contenido (287 líneas)
3. Pega en el SQL Editor
4. Click en **RUN** (botón verde inferior derecha)

### 1.3 Verificar Instalación

Ejecuta estas 3 queries (una por una) para verificar:

```sql
-- ✅ 1. Verificar que la tabla existe
SELECT COUNT(*) FROM ai_ads_usage_tracking;
-- Debe devolver: 0 (tabla vacía pero creada)

-- ✅ 2. Verificar que las vistas existen
SELECT table_name FROM information_schema.views 
WHERE table_name LIKE 'ai_ads%';
-- Debe mostrar: ai_ads_usage_summary_by_company, ai_ads_monthly_usage

-- ✅ 3. Verificar que las funciones existen
SELECT proname FROM pg_proc WHERE proname LIKE '%billing%';
-- Debe mostrar: get_monthly_billing_report, get_billing_summary
```

**Si las 3 queries funcionan → ✅ Instalación correcta**

---

## 🔍 **PASO 2: Probar el Sistema (5 min)**

### 2.1 Crear Anuncio de Prueba
1. El equipo de desarrollo debe crear **1 anuncio completo** desde `/admin/anuncios-rapidos`
2. Completar: Texto + Audio + Guardar (no es necesario programar)

### 2.2 Verificar Tracking

Ejecuta esta query:

```sql
SELECT 
  created_at,
  action_type,
  tokens_used,
  characters_used,
  estimated_cost_cents / 100.0 as costo_euros
FROM ai_ads_usage_tracking
ORDER BY created_at DESC
LIMIT 10;
```

**Deberías ver al menos 3 registros:**
- `text_generated` - ~150-200 tokens - ~1.5¢ EUR
- `audio_generated` - ~150-300 caracteres - ~2.5¢ EUR
- `ad_saved` - Sin tokens/caracteres - 0¢

**Si ves estos registros → ✅ Sistema funcionando correctamente**

---

## 📊 **USO DEL SISTEMA**

### **Reporte Mensual (Principal)**

Para obtener el reporte de facturación de un mes específico:

```sql
-- Reporte de Noviembre 2025
SELECT * FROM get_monthly_billing_report(2025, 11);

-- Reporte del mes actual
SELECT * FROM get_monthly_billing_report(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);
```

**Resultado incluye:**
- Razón Social de la empresa
- CIF
- Número de anuncios creados
- Número de textos generados (y regenerados)
- Número de audios generados (y regenerados)
- Anuncios guardados y programados
- **Costo total en céntimos y euros**

### **Resumen por Empresa (Histórico)**

```sql
-- Ver todas las empresas y su uso total
SELECT * FROM ai_ads_usage_summary_by_company
ORDER BY total_cost_euros DESC;

-- Top 10 empresas por uso
SELECT * FROM ai_ads_usage_summary_by_company
WHERE total_ads_created > 0
ORDER BY total_cost_euros DESC
LIMIT 10;
```

### **Exportar a CSV**

1. Ejecuta la query del reporte mensual
2. En la parte superior derecha del resultado → Click **Export**
3. Selecciona **CSV**
4. Descarga el archivo

---

## 💰 **Interpretación de Costos**

Los costos son **estimaciones** basadas en tarifas públicas:

| Servicio | Tarifa | Costo Típico |
|----------|--------|--------------|
| OpenAI GPT-4 (texto) | $0.03/1K tokens | ~1.5¢ EUR por anuncio |
| ElevenLabs (audio) | $0.15/1K chars | ~2.5¢ EUR por anuncio |
| **Total por anuncio** | | **~4-5¢ EUR** |

**Ejemplo real:**
- Empresa con 50 anuncios/mes = ~2-2.5 EUR/mes
- Empresa con 100 anuncios/mes = ~4-5 EUR/mes

---

## 🔐 **Seguridad y Permisos**

✅ **Row Level Security (RLS) activado**
- Los administradores solo pueden ver el tracking de sus empresas asignadas
- Los usuarios legacy (anon) tienen acceso completo
- El sistema puede insertar registros automáticamente

✅ **No bloquea la experiencia del usuario**
- Si el tracking falla, el anuncio **SÍ se crea correctamente**
- Solo se registra un warning en logs
- Es completamente transparente para el usuario final

---

## 🚨 **Solución de Problemas**

### Problema: "No aparecen registros en ai_ads_usage_tracking"

**Causa:** El código de frontend aún no está integrado.

**Solución:**
1. Confirmar que se ejecutó el SQL correctamente
2. El equipo de desarrollo debe integrar el servicio `aiAdsBillingService.js` siguiendo las instrucciones del archivo de integración
3. Crear un anuncio de prueba después de la integración

### Problema: "Los costos parecen muy bajos o muy altos"

**Causa:** Las estimaciones están basadas en tarifas públicas.

**Solución:**
- Revisar los contratos empresariales con OpenAI y ElevenLabs
- Ajustar las fórmulas de cálculo en `aiAdsBillingService.js` si es necesario
- Los costos son **orientativos**, no reflejan facturas reales de los proveedores

### Problema: "Error al ejecutar el SQL"

**Causa más común:** La tabla `ai_generated_ads` ya existe o hay conflictos.

**Solución:**
```sql
-- Verificar si la tabla ya existe
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'ai_ads_usage_tracking';

-- Si existe, puedes continuar con las siguientes partes del SQL
-- Las vistas y funciones se crearán/reemplazarán automáticamente
```

---

## 📝 **Queries Útiles para Monitoreo**

### Última actividad del sistema
```sql
SELECT 
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as fecha_hora,
  action_type,
  estimated_cost_cents / 100.0 as costo_euros
FROM ai_ads_usage_tracking
ORDER BY created_at DESC
LIMIT 20;
```

### Ingresos totales del sistema
```sql
SELECT 
  COUNT(DISTINCT empresa_id) as total_empresas_activas,
  COUNT(*) as total_acciones,
  SUM(estimated_cost_cents) / 100.0 as ingresos_totales_euros
FROM ai_ads_usage_tracking;
```

### Comparación mes actual vs anterior
```sql
SELECT 
  'Mes Actual' as periodo,
  COUNT(DISTINCT empresa_id) as empresas,
  COUNT(*) as acciones,
  SUM(estimated_cost_cents) / 100.0 as ingresos_eur
FROM ai_ads_usage_tracking
WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)

UNION ALL

SELECT 
  'Mes Anterior' as periodo,
  COUNT(DISTINCT empresa_id),
  COUNT(*),
  SUM(estimated_cost_cents) / 100.0
FROM ai_ads_usage_tracking
WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
  AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month');
```

---

## ✅ **Checklist de Implementación**

**Para el Administrador de Base de Datos:**
- [ ] SQL ejecutado en Supabase
- [ ] Tabla `ai_ads_usage_tracking` creada
- [ ] Vistas creadas (2)
- [ ] Funciones creadas (2)
- [ ] Verificación con queries de prueba exitosa

**Para el Equipo de Desarrollo:**
- [ ] Servicio `aiAdsBillingService.js` integrado
- [ ] Tracking agregado en funciones clave
- [ ] Anuncio de prueba creado
- [ ] Verificación de registros en BD

**Para Facturación/Contabilidad:**
- [ ] Primer reporte mensual generado
- [ ] Proceso de exportación a CSV probado
- [ ] Costos validados vs. facturas reales de OpenAI/ElevenLabs

---

## 📞 **Contacto**

Si hay problemas durante la implementación:
1. Revisar los logs de Supabase (Dashboard → Logs → Postgres Logs)
2. Verificar que RLS está configurado correctamente
3. Confirmar que la tabla `ai_generated_ads` existe
4. Contactar al equipo de desarrollo para verificar integración del código

---

## 🎉 **Resultado Final**

Una vez implementado correctamente:

✅ **Tracking automático** de cada generación de texto y audio  
✅ **Reportes mensuales** en segundos con un solo query  
✅ **Exportación a CSV** para contabilidad externa  
✅ **Auditoría completa** de uso de servicios de IA  
✅ **Base para facturación** mensual a clientes

---

**📅 Documento creado:** Noviembre 2025  
**🎯 Versión:** 1.0  
**✅ Estado:** Listo para producción










