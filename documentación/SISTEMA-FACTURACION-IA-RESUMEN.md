# 💰 Sistema de Facturación de Anuncios IA - RESUMEN COMPLETO

## ✅ **ESTADO: LISTO PARA IMPLEMENTAR**

---

## 🎯 **Objetivo**

Permitir a Ondeon Grupo llevar un control contable detallado del uso de servicios de IA (OpenAI + ElevenLabs) por empresa, para poder:

1. **Facturar** a cada empresa según su consumo
2. **Controlar costos** de servicios externos de IA
3. **Generar reportes** mensuales automáticos
4. **Exportar datos** para sistema de facturación externo

---

## 📦 **Archivos del Sistema**

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| **`database/020_ai_ads_billing_system.sql`** | Schema completo de BD (tablas, vistas, funciones) | ✅ Creado y Corregido |
| **`src/services/aiAdsBillingService.js`** | Servicio de tracking y reportes | ✅ Creado |
| **`QUERIES-FACTURACION-IA.sql`** | Queries útiles para reportes | ✅ Creado |
| **`INSTRUCCIONES-SISTEMA-FACTURACION.md`** | Guía paso a paso de implementación | ✅ Creado |
| **`EJEMPLO-PAGINA-FACTURACION.jsx`** | Ejemplo de página de admin (opcional) | ✅ Creado |

---

## ⚡ **Instalación Rápida (10 minutos)**

### **PASO 1: Ejecutar SQL (5 min)**

1. Abre [Supabase Dashboard](https://app.supabase.com) → SQL Editor
2. Copia el contenido de `database/020_ai_ads_billing_system.sql`
3. Pega y ejecuta (click en **RUN**)
4. Verifica que se creó la tabla:
   ```sql
   SELECT COUNT(*) FROM ai_ads_usage_tracking;
   ```

### **PASO 2: Integrar Tracking en Código (5 min)**

Sigue las instrucciones detalladas en: **`INSTRUCCIONES-SISTEMA-FACTURACION.md`**

**Resumen:**
- Importar `aiAdsBillingService` en `aiAdService.js` y `QuickAdsPage.jsx`
- Agregar tracking en 5 puntos clave:
  - Generación de texto
  - Regeneración de texto
  - Generación de audio
  - Cambio de voz (regeneración audio)
  - Guardar anuncio
  - Programar anuncio

### **PASO 3: Probar (2 min)**

1. Crea un anuncio de prueba en `/admin/anuncios-rapidos`
2. Verifica el tracking:
   ```sql
   SELECT * FROM ai_ads_usage_tracking 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. Deberías ver al menos 3 registros: `text_generated`, `audio_generated`, `ad_saved`

---

## 📊 **Uso del Sistema**

### **Generar Reporte Mensual**

```sql
-- Reporte del mes actual
SELECT * FROM get_monthly_billing_report(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);
```

### **Ver Resumen por Empresa**

```sql
-- Ver todas las empresas y su uso total
SELECT * FROM ai_ads_usage_summary_by_company
ORDER BY total_cost_euros DESC;
```

### **Exportar a CSV**

**Opción A:** Desde Supabase Dashboard
1. Ejecuta la query del reporte
2. Click en **Export** → CSV
3. Descarga el archivo

**Opción B:** Desde código (frontend)
```javascript
import aiAdsBillingService from '@/services/aiAdsBillingService';

const data = await aiAdsBillingService.getMonthlyReport(2025, 11);
aiAdsBillingService.exportToCSV(data, 'facturacion_nov_2025.csv');
```

---

## 💡 **¿Qué se Registra?**

| Acción | Proveedor | Datos Registrados | Costo Estimado |
|--------|-----------|-------------------|----------------|
| **Generar texto** | OpenAI GPT-4 | Tokens usados | ~1.5¢ EUR |
| **Regenerar texto** | OpenAI GPT-4 | Tokens usados | ~1.5¢ EUR |
| **Generar audio** | ElevenLabs | Caracteres + Duración + Voz | ~2.5¢ EUR |
| **Cambiar voz** | ElevenLabs | Caracteres + Duración + Voz | ~2.5¢ EUR |
| **Guardar anuncio** | - | ID de anuncio | 0¢ |
| **Programar anuncio** | - | # de usuarios | 0¢ |

**Costo típico por anuncio:** ~4-5¢ EUR  
**Costo típico por empresa/mes (50 anuncios):** ~2-2.5 EUR

---

## 📈 **Estructura de Base de Datos**

### **Tabla Principal: `ai_ads_usage_tracking`**

```sql
CREATE TABLE ai_ads_usage_tracking (
  id UUID PRIMARY KEY,
  empresa_id UUID NOT NULL,      -- Empresa que usa el servicio
  ai_ad_id UUID,                 -- Anuncio generado (si aplica)
  admin_id UUID NOT NULL,        -- Admin que hizo la acción
  action_type TEXT NOT NULL,     -- 'text_generated', 'audio_generated', etc.
  tokens_used INTEGER,           -- Para OpenAI
  characters_used INTEGER,       -- Para ElevenLabs
  duration_seconds INTEGER,      -- Duración del audio
  voice_id TEXT,                 -- ID de voz de ElevenLabs
  model_used TEXT,               -- Modelo de IA usado
  estimated_cost_cents DECIMAL,  -- Costo estimado en céntimos
  metadata JSONB,                -- Datos adicionales
  created_at TIMESTAMPTZ         -- Fecha y hora
);
```

### **Vista: `ai_ads_usage_summary_by_company`**

Resume el uso total de cada empresa (todos los tiempos).

### **Vista: `ai_ads_monthly_usage`**

Resume el uso mensual por empresa.

### **Función: `get_monthly_billing_report(year, month)`**

Genera un reporte completo de facturación para un mes específico.

---

## 🔍 **Queries Más Útiles**

Todas las queries están en: **`QUERIES-FACTURACION-IA.sql`**

### **Top 10 empresas por uso**
```sql
SELECT * FROM ai_ads_usage_summary_by_company
ORDER BY total_cost_euros DESC
LIMIT 10;
```

### **¿Cuánto gastó una empresa este mes?**
```sql
SELECT * FROM ai_ads_monthly_usage
WHERE empresa_id = 'UUID_EMPRESA'
  AND year = 2025
  AND month = 11;
```

### **Ingresos totales del sistema**
```sql
SELECT 
  SUM(estimated_cost_cents) / 100.0 as ingresos_totales_euros
FROM ai_ads_usage_tracking;
```

---

## 🖥️ **Página de Admin (Opcional)**

Un ejemplo completo de una página de facturación está en:  
**`EJEMPLO-PAGINA-FACTURACION.jsx`**

Esta página incluye:
- 📊 Resumen mensual con cards visuales
- 📅 Selector de mes/año
- 🔍 Buscador por empresa
- 📥 Exportar a CSV con un click
- 📈 Tabla con todos los detalles

Puedes implementarla en tu **frontend-desktop-admin** (proyecto separado).

---

## 🚨 **Importante: Costos Estimados**

Los costos son **ESTIMACIONES** basadas en tarifas públicas:

- **OpenAI GPT-4:** $0.03 por 1K tokens ≈ 3¢ EUR
- **ElevenLabs:** $0.15 por 1K caracteres ≈ 15¢ EUR

**Para costos exactos:**
1. Revisa tus contratos empresariales con OpenAI y ElevenLabs
2. Ajusta las fórmulas en `aiAdsBillingService.js`:
   - Línea 24: `(tokensUsed / 1000) * 3.0` (OpenAI)
   - Línea 77: `(charactersUsed / 1000) * 15.0` (ElevenLabs)

---

## 🔐 **Seguridad y Permisos**

- ✅ **RLS activado** en `ai_ads_usage_tracking`
- ✅ Admins solo ven tracking de sus empresas
- ✅ Legacy users (anon) tienen acceso completo
- ✅ Inserción permitida para authenticated y anon

---

## ⚙️ **Características del Sistema**

| Característica | Estado |
|----------------|--------|
| Tracking automático | ✅ |
| No bloquea la UI si falla | ✅ |
| Registra todas las acciones | ✅ |
| Reportes mensuales | ✅ |
| Exportación a CSV | ✅ |
| Vistas optimizadas | ✅ |
| Funciones SQL reutilizables | ✅ |
| RLS y seguridad | ✅ |
| Preparado para Stripe | 🔮 Futuro |
| Dashboard visual | 🔮 Opcional |

---

## 🎯 **Checklist de Implementación**

- [ ] **SQL ejecutado** en Supabase Dashboard
- [ ] **Tabla creada** (`ai_ads_usage_tracking`)
- [ ] **Vistas creadas** (`ai_ads_*`)
- [ ] **Funciones creadas** (`get_*_billing_*`)
- [ ] **Servicio importado** en `aiAdService.js`
- [ ] **Servicio importado** en `QuickAdsPage.jsx`
- [ ] **Tracking agregado** en `generarTexto`
- [ ] **Tracking agregado** en `guardarAnuncio`
- [ ] **Tracking agregado** en `programarAnuncio`
- [ ] **Tracking agregado** en frontend (`handleGenerarTexto`)
- [ ] **Tracking agregado** en frontend (`handleGenerarAudioPreview`)
- [ ] **Anuncio de prueba creado**
- [ ] **Verificado registros** en BD
- [ ] **Reporte mensual probado**

---

## 🔮 **Roadmap Futuro**

### **Corto Plazo**
1. Implementar sistema en producción
2. Generar primer reporte mensual real
3. Validar costos estimados vs. costos reales

### **Medio Plazo**
1. Crear dashboard visual de facturación
2. Agregar alertas de uso excesivo
3. Implementar límites por empresa

### **Largo Plazo**
1. Integración con Stripe para cobro automático
2. Generación automática de facturas en PDF
3. Sistema de pagos y suscripciones

---

## 📚 **Documentación Relacionada**

1. **`INSTRUCCIONES-SISTEMA-FACTURACION.md`** - Guía detallada paso a paso
2. **`QUERIES-FACTURACION-IA.sql`** - Todas las queries útiles
3. **`database/020_ai_ads_billing_system.sql`** - Schema completo
4. **`src/services/aiAdsBillingService.js`** - Código del servicio
5. **`EJEMPLO-PAGINA-FACTURACION.jsx`** - Ejemplo de UI

---

## 🤝 **Soporte**

Si encuentras problemas:

1. Revisa la sección "Solución de Problemas" en `INSTRUCCIONES-SISTEMA-FACTURACION.md`
2. Verifica logs en consola del navegador
3. Verifica logs de Supabase Edge Functions
4. Ejecuta queries de verificación en Supabase SQL Editor

---

## ✅ **Conclusión**

El sistema está **100% listo** para implementar. Solo necesitas:

1. ⏱️ **5 minutos** - Ejecutar SQL
2. ⏱️ **5 minutos** - Integrar código
3. ⏱️ **2 minutos** - Probar

**Total: ~12 minutos**

Después de eso, el tracking será **automático y transparente** para los usuarios, y podrás generar reportes mensuales para facturación en segundos.

---

**📅 Documento Creado:** Noviembre 2025  
**👨‍💻 Estado:** ✅ Listo para Producción  
**🎯 Próximo Paso:** Ejecutar `database/020_ai_ads_billing_system.sql` en Supabase

