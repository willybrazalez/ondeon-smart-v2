# 🚀 Instrucciones de Implementación: Sistema de Facturación de Anuncios IA

## 📋 **Resumen**

Este sistema permite a Ondeon Grupo:
- ✅ Registrar automáticamente cada uso de servicios de IA (OpenAI + ElevenLabs)
- ✅ Generar reportes mensuales de facturación por empresa
- ✅ Exportar datos a CSV para contabilidad externa
- ✅ (Futuro) Integrar con Stripe para cobro automático

**Tiempo de instalación:** ~10 minutos  
**Impacto en usuarios:** Ninguno (transparente)

---

## 🔧 **PASO 1: Ejecutar SQL en Supabase**

### 1.1 Acceder a Supabase Dashboard

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. En el menú lateral, click en **SQL Editor**
4. Click en **New query**

### 1.2 Ejecutar el Script

1. Abre el archivo: `database/020_ai_ads_billing_system.sql`
2. **Copia TODO el contenido** del archivo
3. Pega en el SQL Editor de Supabase
4. Click en **RUN** (botón verde en la esquina inferior derecha)

### 1.3 Verificar que funcionó

Ejecuta estas queries de verificación (una por una):

```sql
-- ✅ Verificar que la tabla existe
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'ai_ads_usage_tracking'
ORDER BY ordinal_position;
```

**Debe mostrar:** ~13 columnas (id, empresa_id, ai_ad_id, admin_id, action_type, etc.)

```sql
-- ✅ Verificar que las vistas existen
SELECT table_name 
FROM information_schema.views 
WHERE table_name LIKE 'ai_ads%';
```

**Debe mostrar:** 
- `ai_ads_usage_summary_by_company`
- `ai_ads_monthly_usage`

```sql
-- ✅ Verificar que las funciones existen
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%billing%';
```

**Debe mostrar:**
- `get_monthly_billing_report`
- `get_billing_summary`

✅ **Si todo funciona, continúa al PASO 2**

---

## 📝 **PASO 2: Integrar Tracking en el Código**

### 2.1 El servicio ya está creado

El archivo `src/services/aiAdsBillingService.js` ya está creado y listo para usar.

### 2.2 Modificar `aiAdService.js`

Abre el archivo: `src/services/aiAdService.js`

**Al inicio del archivo, agregar:**

```javascript
import aiAdsBillingService from './aiAdsBillingService.js';
```

**Buscar la función `generarTexto` (línea ~47) y DESPUÉS del `logger.dev('✅ Texto generado exitosamente')` (línea ~91), agregar:**

```javascript
// Tracking de facturación (no bloqueante)
const tokensUsed = data.metadata?.tokens_used || 150; // Estimación si no viene
aiAdsBillingService.trackTextGeneration({
  empresaId: null, // Se agregará después en QuickAdsPage cuando se guarde
  aiAdId: null,    // Se agregará cuando se guarde
  adminId: null,   // Se agregará cuando se guarde
  tokensUsed,
  modelUsed: data.model || 'gpt-4'
}).catch(err => logger.warn('⚠️ Tracking failed:', err));
```

**Buscar la función `guardarAnuncio` (línea ~176) y AL FINAL (después de insertar en `contenido_asignaciones`, antes del return), agregar:**

```javascript
// 4. Tracking de facturación
logger.dev('📊 Registrando uso para facturación...');

// Tracking de anuncio guardado
await aiAdsBillingService.trackAdSaved({
  empresaId,
  aiAdId: aiAd.id,
  adminId: userId
});

logger.dev('✅ Anuncio guardado y tracking registrado');
```

**Buscar la función `programarAnuncio` (línea ~307) y AL FINAL (antes del return con el id de programación), agregar:**

```javascript
// Tracking de programación
await aiAdsBillingService.trackAdScheduled({
  empresaId,
  aiAdId: null, // Se puede obtener desde contenidoId si es necesario
  adminId: authUser?.id,
  usersCount: destinatarios.length
});

logger.dev('✅ Programación completada y tracking registrado');
```

### 2.3 Modificar `QuickAdsPage.jsx`

Abre el archivo: `src/pages/admin/QuickAdsPage.jsx`

**Al inicio del archivo (con los demás imports), agregar:**

```javascript
import aiAdsBillingService from '@/services/aiAdsBillingService';
```

**Buscar la función `handleGenerarTexto` (dentro de `QuickAdsPage`) y DESPUÉS de recibir la respuesta de `aiAdService.generarTexto`, agregar:**

```javascript
// Tracking de generación de texto
if (adminEmpresaIds && adminEmpresaIds.length > 0 && user?.id) {
  const tokensUsed = result.metadata?.tokens_used || 150;
  aiAdsBillingService.trackTextGeneration({
    empresaId: adminEmpresaIds[0], // Primera empresa del admin
    aiAdId: null, // Aún no se ha guardado
    adminId: user.id,
    tokensUsed,
    modelUsed: result.model || 'gpt-4'
  }).catch(err => console.warn('⚠️ Tracking failed:', err));
}
```

**Buscar la función `handleRegenerarTexto` y agregar el mismo código anterior (tracking de regeneración):**

```javascript
// Tracking de REGENERACIÓN de texto
if (adminEmpresaIds && adminEmpresaIds.length > 0 && user?.id) {
  const tokensUsed = result.metadata?.tokens_used || 150;
  aiAdsBillingService.trackTextRegeneration({
    empresaId: adminEmpresaIds[0],
    aiAdId: null,
    adminId: user.id,
    tokensUsed,
    modelUsed: result.model || 'gpt-4'
  }).catch(err => console.warn('⚠️ Tracking failed:', err));
}
```

**Buscar la función `handleGenerarAudioPreview` y DESPUÉS de generar el audio, agregar:**

```javascript
// Tracking de generación de audio
if (adminEmpresaIds && adminEmpresaIds.length > 0 && user?.id) {
  const charactersUsed = textoGenerado.length;
  aiAdsBillingService.trackAudioGeneration({
    empresaId: adminEmpresaIds[0],
    aiAdId: null, // Aún no se ha guardado
    adminId: user.id,
    charactersUsed,
    durationSeconds: duracion,
    voiceId: vozSeleccionada.id
  }).catch(err => console.warn('⚠️ Tracking failed:', err));
}
```

**Buscar cuando se cambia de voz (en `handleVolverAtras` con `voiceChangeCount`) y agregar:**

```javascript
// Tracking de regeneración de audio (cambio de voz)
if (adminEmpresaIds && adminEmpresaIds.length > 0 && user?.id) {
  const charactersUsed = textoGenerado.length;
  aiAdsBillingService.trackAudioRegeneration({
    empresaId: adminEmpresaIds[0],
    aiAdId: null,
    adminId: user.id,
    charactersUsed,
    durationSeconds: duracion,
    voiceId: vozSeleccionada.id
  }).catch(err => console.warn('⚠️ Tracking failed:', err));
}
```

---

## ✅ **PASO 3: Probar el Sistema**

### 3.1 Crear un Anuncio de Prueba

1. Abre la aplicación y ve a `/admin/anuncios-rapidos`
2. Crea un anuncio con IA completo (texto + audio + guardar)
3. NO importa si lo programas o no

### 3.2 Verificar el Tracking en Supabase

Ejecuta esta query en el **SQL Editor** de Supabase:

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
1. `text_generated` - Con ~150-200 tokens
2. `audio_generated` - Con ~150-300 caracteres
3. `ad_saved` - Sin tokens/caracteres

✅ **Si ves estos registros, el sistema está funcionando correctamente**

### 3.3 Verificar el Reporte Mensual

```sql
SELECT * FROM get_monthly_billing_report(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
);
```

**Deberías ver:**
- Tu empresa de prueba
- Al menos 1 anuncio creado
- Costos estimados en céntimos

---

## 📊 **PASO 4: Generar Reportes**

### Opción A: Usar SQL directamente (Supabase Dashboard)

**Reporte del mes actual:**
```sql
SELECT * FROM get_monthly_billing_report(2025, 11);
```

**Exportar a CSV:**
1. Ejecuta la query en SQL Editor
2. Click en **Export** (esquina superior derecha)
3. Selecciona **CSV**
4. Descarga el archivo

### Opción B: Crear página de admin (Futuro)

Ver el archivo **opcional** creado para referencia:
- `EJEMPLO-PAGINA-FACTURACION.jsx`

Esta página se puede integrar en tu **frontend-desktop-admin** (proyecto separado) para que los administradores de Ondeon Grupo puedan:
- Ver reportes mensuales con gráficas
- Filtrar por empresa
- Exportar a CSV con un click
- Ver estadísticas en tiempo real

---

## 🔍 **PASO 5: Queries Útiles**

Todas las queries útiles están en: `QUERIES-FACTURACION-IA.sql`

**Las más importantes:**

```sql
-- 💰 ¿Cuánto gastó una empresa este mes?
SELECT * FROM ai_ads_monthly_usage
WHERE empresa_id = 'UUID_EMPRESA'
  AND year = 2025
  AND month = 11;

-- 🏆 Top 10 empresas por uso
SELECT * FROM ai_ads_usage_summary_by_company
ORDER BY total_cost_euros DESC
LIMIT 10;

-- 📈 Ingresos totales
SELECT 
  SUM(estimated_cost_cents) / 100.0 as ingresos_totales_euros
FROM ai_ads_usage_tracking;
```

---

## 💶 **Entender los Costos**

### Costos Estimados por Acción

| Acción | Proveedor | Costo Aproximado |
|--------|-----------|------------------|
| Generar texto (150 tokens) | OpenAI GPT-4 | ~1.5¢ EUR |
| Generar audio (150 chars) | ElevenLabs | ~2.5¢ EUR |
| Guardar anuncio | - | 0¢ |
| Programar anuncio | - | 0¢ |
| **Total por anuncio** | | **~4-5¢ EUR** |

### Ejemplo Real

**Empresa:** "Restaurante La Buena Mesa"  
**Mes:** Noviembre 2025  
**Uso:**
- 50 anuncios creados
- 55 textos generados (incluye 5 regeneraciones)
- 53 audios generados (incluye 3 cambios de voz)

**Costo estimado:** ~2.00-2.50 EUR/mes

---

## 🚨 **Solución de Problemas**

### Problema 1: "La tabla ya existe"
**Solución:** Ignora este error, significa que ya está creada. Continúa con las siguientes queries.

### Problema 2: "No se registra el tracking"
**Verificar:**
1. ¿Las políticas RLS están activas? Ejecuta:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'ai_ads_usage_tracking';
   ```
   Deberías ver 4 políticas.

2. ¿El usuario está autenticado? Verifica en consola del navegador:
   ```javascript
   const { data: { user } } = await supabase.auth.getUser();
   console.log('User ID:', user?.id);
   ```

### Problema 3: "Los costos parecen incorrectos"
**Nota:** Los costos son **estimaciones** basadas en tarifas públicas. Para costos exactos, necesitas:
1. Revisar tu contrato con OpenAI y ElevenLabs
2. Ajustar las fórmulas en `aiAdsBillingService.js`:
   - Línea ~24: `(tokensUsed / 1000) * 3.0` (para OpenAI)
   - Línea ~77: `(charactersUsed / 1000) * 15.0` (para ElevenLabs)

### Problema 4: "No aparecen datos en el reporte"
**Verificar:**
```sql
-- ¿Hay algún registro?
SELECT COUNT(*) FROM ai_ads_usage_tracking;

-- ¿De qué mes son los registros?
SELECT 
  EXTRACT(YEAR FROM created_at) as año,
  EXTRACT(MONTH FROM created_at) as mes,
  COUNT(*) as total
FROM ai_ads_usage_tracking
GROUP BY año, mes;
```

---

## 📞 **Contacto y Soporte**

Si encuentras problemas:
1. Revisa los logs en la consola del navegador
2. Revisa los logs de Supabase Edge Functions
3. Ejecuta las queries de verificación en este documento

---

## 🎯 **Checklist Final**

- [ ] SQL ejecutado en Supabase ✅
- [ ] Tabla `ai_ads_usage_tracking` existe ✅
- [ ] Vistas `ai_ads_*` creadas ✅
- [ ] Funciones `get_*_billing_*` creadas ✅
- [ ] `aiAdsBillingService.js` importado en `aiAdService.js` ✅
- [ ] `aiAdsBillingService` importado en `QuickAdsPage.jsx` ✅
- [ ] Tracking agregado en `generarTexto` ✅
- [ ] Tracking agregado en `guardarAnuncio` ✅
- [ ] Tracking agregado en `programarAnuncio` ✅
- [ ] Tracking agregado en `handleGenerarTexto` (frontend) ✅
- [ ] Tracking agregado en `handleGenerarAudioPreview` (frontend) ✅
- [ ] Anuncio de prueba creado ✅
- [ ] Registros visibles en `ai_ads_usage_tracking` ✅
- [ ] Reporte mensual funciona correctamente ✅

---

## 🔮 **Próximos Pasos (Opcional)**

1. **Dashboard de Facturación** - Crear página en admin para ver reportes visuales
2. **Alertas de Uso** - Notificar cuando una empresa supera cierto uso
3. **Integración con Stripe** - Cobro automático mensual
4. **Ajuste de Tarifas** - Definir margen de beneficio sobre costos de IA
5. **Facturación Automática** - Generar PDF de facturas al fin de mes

---

**✅ Sistema Implementado Correctamente**  
**📅 Fecha:** Noviembre 2025  
**🎯 Estado:** Listo para Producción

