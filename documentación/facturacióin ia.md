# 💰 Sistema de Facturación de Anuncios IA - Resumen Ejecutivo

## 🎯 ¿Qué Hace?

El sistema registra **automáticamente** cada acción relacionada con anuncios generados con IA para poder **facturar** a las empresas al final de cada mes.

---

## ✅ Qué se Registra Automáticamente

Cada vez que un administrador crea un anuncio con IA, el sistema registra:

1. ✅ **Texto generado (tanto los diferentes intentos como el texto final utilizado** con OpenAI GPT-4
   - Número de tokens usados
   - Costo estimado: ~1-2 céntimos EUR

2. ✅ **Audio generado (tanto los diferentes intentos como el audio final utilizado** con ElevenLabs
   - Número de caracteres usados
   - Duración del audio
   - Costo estimado: ~2-3 céntimos EUR

3. ✅ **Anuncio guardado**
   - Registro de que se guardó exitosamente

4. ✅ **Anuncio programado** (si se programa)
   - Número de usuarios destinatarios

**Costo total típico por anuncio:** ~**4-5 céntimos EUR**

---

## 📊 Reportes Disponibles

### **1. Resumen por Empresa (Todo el Tiempo)**
```sql
SELECT * FROM ai_ads_usage_summary_by_company
WHERE razon_social = 'NOMBRE_EMPRESA';
```

**Muestra:**
- Total de anuncios creados
- Total de textos generados
- Total de audios generados
- Costo total acumulado

### **2. Uso Mensual**
```sql
SELECT * FROM ai_ads_monthly_usage
WHERE empresa_id = 'UUID_EMPRESA'
  AND year = 2025
  AND month = 11;
```

**Muestra:**
- Textos generados en el mes
- Audios generados en el mes
- Anuncios guardados
- Anuncios programados
- Costo total del mes

### **3. Detalle de Acciones**
```sql
SELECT * FROM ai_ads_usage_tracking
WHERE empresa_id = 'UUID_EMPRESA'
ORDER BY created_at DESC;
```

**Muestra cada acción individual con:**
- Fecha y hora exacta
- Tipo de acción
- Tokens/caracteres usados
- Costo estimado

---

## 💶 Ejemplo Real

### **Empresa: "Restaurante La Buena Mesa"**
**Mes: Noviembre 2025**

- **Anuncios creados:** 50
- **Textos generados:** 50 × ~1.5 céntimos = 0.75 EUR
- **Audios generados:** 50 × ~2.5 céntimos = 1.25 EUR
- **Total:** ~**2.00 EUR/mes**

---

## 🔄 Proceso de Facturación Mensual

### **Opción 1: Manual (SQL)**

Al final del mes, ejecutas una query SQL que genera un reporte CSV:

```sql
-- Ver todas las empresas y su uso del mes
SELECT 
  e.razon_social,
  COUNT(DISTINCT ai.id) as anuncios_creados,
  SUM(ut.estimated_cost_cents) as costo_total_cents,
  ROUND(SUM(ut.estimated_cost_cents) / 100.0, 2) as costo_total_euros
FROM empresas e
LEFT JOIN ai_generated_ads ai ON ai.empresa_id = e.id
LEFT JOIN ai_ads_usage_tracking ut ON ut.empresa_id = e.id
WHERE EXTRACT(YEAR FROM ut.created_at) = 2025
  AND EXTRACT(MONTH FROM ut.created_at) = 11
GROUP BY e.razon_social
ORDER BY costo_total_euros DESC;
```

**Resultado:**
```
razon_social                 | anuncios_creados | costo_total_euros
----------------------------|-----------------|------------------
Restaurante La Buena Mesa   | 50              | 2.00
Cafetería Central           | 30              | 1.20
Tienda Moda Express         | 20              | 0.80
```

### **Opción 2: Exportar CSV desde Frontend**

```javascript
import aiAdsBillingService from '@/services/aiAdsBillingService';

// Obtener datos del mes
const data = await aiAdsBillingService.getMonthlyUsage(empresaId, 2025, 11);

// Exportar a CSV
aiAdsBillingService.exportToCSV(data, 'facturacion_noviembre_2025.csv');
```

**Descargas un archivo CSV que puedes:**
- Abrir en Excel
- Importar a tu sistema de facturación
- Enviar a contabilidad

---

## 🚀 Instalación (5 minutos)

### **Paso 1: Ejecutar SQL**
1. Ve a **Supabase Dashboard**
2. Abre **SQL Editor**
3. Copia el contenido de `database/020_ai_ads_billing_system.sql`
4. Haz clic en **Run**

### **Paso 2: Verificar**
```sql
SELECT COUNT(*) FROM ai_ads_usage_tracking;
SELECT COUNT(*) FROM ai_ads_billing_periods;
```

### **Paso 3: Probar**
1. Crea un anuncio con IA desde `/admin/anuncios-rapidos`
2. Ejecuta:
   ```sql
   SELECT * FROM ai_ads_usage_tracking 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. Deberías ver 3 registros (text_generated, audio_generated, ad_saved)

---

## 📁 Archivos Importantes

1. **`database/020_ai_ads_billing_system.sql`**
   - Schema completo de BD (tablas, vistas, funciones)
   - **Ejecutar UNA VEZ en Supabase**

2. **`src/services/aiAdsBillingService.js`**
   - Servicio para tracking y reportes
   - Ya integrado en `aiAdService.js`

3. **`SISTEMA-FACTURACION-ANUNCIOS-IA.md`**
   - Documentación completa del sistema

4. **`INSTRUCCIONES-SISTEMA-FACTURACION.md`**
   - Guía paso a paso para instalación y uso

---

## 🔮 Futuro: Stripe

El sistema ya está **preparado** para integrar con Stripe:

- Al final del mes, automáticamente:
  1. Genera reporte
  2. Crea factura en Stripe
  3. Envía email al cliente
  4. Cobra automáticamente
  5. Actualiza estado en BD

**Campos ya incluidos:**
- `stripe_invoice_id`
- `stripe_payment_intent_id`

---

## 📞 Queries Útiles Rápidas

### **¿Cuánto gastó una empresa este mes?**
```sql
SELECT 
  razon_social,
  COUNT(*) as acciones_totales,
  SUM(estimated_cost_cents) as costo_cents,
  ROUND(SUM(estimated_cost_cents) / 100.0, 2) as costo_euros
FROM ai_ads_usage_tracking ut
JOIN empresas e ON e.id = ut.empresa_id
WHERE empresa_id = 'UUID_EMPRESA'
  AND EXTRACT(MONTH FROM ut.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(YEAR FROM ut.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY razon_social;
```

### **¿Cuáles son las 10 empresas que más usan IA?**
```sql
SELECT * FROM ai_ads_usage_summary_by_company
ORDER BY total_ads_created DESC
LIMIT 10;
```

### **¿Cuánto dinero se ha generado en total?**
```sql
SELECT 
  COUNT(DISTINCT empresa_id) as empresas_activas,
  SUM(estimated_cost_cents) as costo_total_cents,
  ROUND(SUM(estimated_cost_cents) / 100.0, 2) as costo_total_euros
FROM ai_ads_usage_tracking;
```

---

## ✅ Ventajas del Sistema

1. ✅ **100% Automático** - No requiere intervención manual
2. ✅ **No Bloquea** - Si el tracking falla, el anuncio se crea igual
3. ✅ **Auditable** - Cada acción tiene timestamp y usuario
4. ✅ **Escalable** - Soporta miles de empresas y millones de registros
5. ✅ **Listo para Stripe** - Integración futura simplificada
6. ✅ **Exportable** - CSV para Excel y contabilidad externa
7. ✅ **Seguro** - RLS activado, solo admins ven datos de sus empresas

---

## 📊 Dashboard Futuro (Próximo)

Página de admin `/admin/facturacion-ia` con:

- 📈 **Gráficas de uso mensual**
- 💰 **Costo acumulado por empresa**
- 📄 **Botón "Exportar Reporte"**
- 📅 **Selector de mes/año**
- 🔍 **Filtros por empresa**
- 📊 **Top 10 empresas por uso**

---

## 🎯 Próximos Pasos

1. ✅ Ejecutar el SQL (5 min)
2. ✅ Verificar que funciona (1 anuncio de prueba)
3. ⏳ Esperar fin de mes para primer reporte
4. ⏳ Decidir si integrar Stripe o usar sistema externo
5. ⏳ (Opcional) Crear dashboard de reportes

---

## 📝 Notas Importantes

### **¿Los costos son exactos?**
Los costos son **estimaciones** basadas en tarifas públicas de:
- OpenAI: $0.03 por 1K tokens
- ElevenLabs: $0.15 por 1K caracteres

Los costos reales pueden variar según tu plan empresarial con estos proveedores.

### **¿Qué pasa si el tracking falla?**
El sistema está diseñado con `try/catch`:
- Si el tracking falla, el anuncio **SÍ se crea correctamente**
- Solo se registra un warning en logs
- No interrumpe la experiencia del usuario

### **¿Puedo ver el histórico?**
Sí, el sistema guarda **TODO el histórico**:
```sql
SELECT * FROM ai_ads_usage_tracking
ORDER BY created_at DESC;
```

---

## 🎉 ¡Listo!

Con este sistema, Ondeon Grupo puede:

✅ Saber exactamente cuánto usa cada empresa  
✅ Generar reportes mensuales en segundos  
✅ Exportar a Excel/CSV para contabilidad  
✅ (Futuro) Cobrar automáticamente con Stripe

**Instalación:** 5 minutos  
**Mantenimiento:** 0 (automático)  
**Beneficio:** Control total de costos de IA por empresa

---

**Documento Creado:** Noviembre 2025  
**Versión:** 1.0  
**Estado:** ✅ LISTO PARA USAR

