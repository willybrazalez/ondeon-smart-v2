# 🐛 FIX: Programaciones Semanales - Mismatch de Días

**Fecha:** 2025-11-09  
**Versión:** 1.0

---

## 📋 **Problema Detectado**

### **Bug: Programaciones semanales no se ejecutan** ❌

**Síntoma:**
Una programación configurada para ejecutarse de "lunes a domingo" (7 días de la semana) **no se ejecuta** ningún día, incluyendo domingo.

**Ejemplo del problema:**
```javascript
// Logs de verificación
📋 Evaluando: "borrar" (semanal)
     📅 SEMANAL - weekly_mode: rango
     ❌ Hoy (sun) no está en días programados: lunes, martes, miercoles, jueves, viernes, sabado, domingo
  ⏰ debeEjecutarse: false
```

**Datos en la BD:**
```csv
tipo: semanal
daily_mode: laborales  ❌ (incorrecto para programaciones semanales)
weekly_mode: rango
weekly_days: ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"]
```

---

## 🔍 **Causas Raíz**

### **1. Mismatch de idiomas y formatos** 🌍

| Componente | Formato usado | Ejemplo |
|------------|---------------|---------|
| **scheduledContentService.js** (línea 467) | Inglés abreviado | `"sun"`, `"mon"`, `"tue"` |
| **BD (weekly_days)** | Español completo | `"domingo"`, `"lunes"`, `"martes"` |
| **aiAdService.js** (mapping) | Español abreviado | `"dom"`, `"lun"`, `"mar"` |

**Resultado:** `"sun" !== "domingo"` → `includes()` retorna `false` → ❌ Nunca se ejecuta

---

### **2. Campo `daily_mode` incorrecto en programaciones semanales** ❌

```sql
-- Programación SEMANAL con campo DIARIO (incorrecto)
tipo: 'semanal'
daily_mode: 'laborales'  ❌ Este campo solo es para tipo 'diaria'
weekly_mode: 'rango'     ✅ Correcto
```

**Causa:** Cuando un admin editaba una programación desde `ProgramacionesPage.jsx`, no se limpiaban los campos de otros tipos de periodicidad.

---

## ✅ **Soluciones Aplicadas**

### **Fix 1: Soporte multi-formato en `scheduledContentService.js`**

**Archivo:** `src/services/scheduledContentService.js` líneas 563-585

**Cambio:**
```javascript
// ❌ ANTES: Solo comparaba formato exacto
if (!prog.weekly_days?.includes(diaSemana)) {
  return false;
}

// ✅ DESPUÉS: Soporta múltiples formatos (inglés + español)
const diaHoyFormatos = {
  'sun': ['sun', 'dom', 'domingo'],
  'mon': ['mon', 'lun', 'lunes'],
  'tue': ['tue', 'mar', 'martes'],
  'wed': ['wed', 'mie', 'miercoles', 'miércoles'],
  'thu': ['thu', 'jue', 'jueves'],
  'fri': ['fri', 'vie', 'viernes'],
  'sat': ['sat', 'sab', 'sabado', 'sábado']
};

const formatosDiaHoy = diaHoyFormatos[diaSemana] || [diaSemana];

const estaDiaEnPrograma = prog.weekly_days?.some(dia => 
  formatosDiaHoy.includes(dia?.toLowerCase())
);
```

**Resultado:** Ahora funciona con cualquier formato:
- ✅ `"sun"` (inglés abreviado)
- ✅ `"dom"` (español abreviado)
- ✅ `"domingo"` (español completo)

---

### **Fix 2: Limpiar campos incorrectos al editar programaciones**

**Archivo:** `src/pages/admin/ProgramacionesPage.jsx` líneas 680-729

**Cambio:**
```javascript
// ✅ NUEVO: Cuando se guarda programación SEMANAL
if (formEdicion.tipo === 'semanal') {
  updateData.weekly_mode = formEdicion.weeklyMode;
  updateData.weekly_days = formEdicion.weeklyDays;
  updateData.weekly_rango_desde = formEdicion.weeklyRangoDesde;
  updateData.weekly_rango_hasta = formEdicion.weeklyRangoHasta;
  updateData.weekly_hora_una_vez = formEdicion.weeklyHoraUnaVez;
  
  // ✅ FIX: Limpiar campos de tipo DIARIO
  updateData.daily_mode = null;
  updateData.cada_dias = null;
  updateData.rango_desde = null;
  updateData.rango_hasta = null;
  updateData.hora_una_vez_dia = null;
  
  // ✅ FIX: Limpiar campos de tipo ANUAL
  updateData.annual_date = null;
  updateData.annual_time = null;
}
```

**Resultado:** Cada tipo de programación solo guarda sus propios campos, evitando mezclas y confusiones.

---

## 🧪 **Pruebas de Verificación**

### **Test 1: Programación semanal (todos los días)**

1. Crear o editar una programación tipo "Semanal"
2. Seleccionar **todos los días de la semana** (lunes a domingo)
3. Configurar modo "rango" con horario `08:00 - 23:59`
4. Guardar

**Verificar en BD:**
```sql
SELECT 
  id,
  tipo,
  daily_mode,        -- Debe ser NULL
  weekly_mode,       -- Debe ser 'rango'
  weekly_days,       -- Debe incluir todos los días
  weekly_rango_desde,
  weekly_rango_hasta
FROM programaciones
WHERE descripcion = 'TU_PROGRAMACION'
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado:**
```csv
tipo: semanal
daily_mode: NULL  ✅
weekly_mode: rango  ✅
weekly_days: ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]  ✅
weekly_rango_desde: 08:00:00
weekly_rango_hasta: 23:59:00
```

---

### **Test 2: Programación se ejecuta el domingo**

1. Con la programación del Test 1 activa
2. Esperar a un **domingo** dentro del rango horario (08:00 - 23:59)
3. Dar play en el reproductor (para habilitar programaciones)
4. Esperar ~10 segundos (ciclo de verificación)

**Logs esperados:**
```javascript
📋 Evaluando: "TU_PROGRAMACION" (semanal)
     📅 SEMANAL - weekly_mode: rango
     ✅ Hoy (sun) SÍ está en días programados  ✅
     🕐 Rango horario: 08:00:00 - 23:59:00, Hora actual: 13:15
     ✅ Dentro del rango: true  ✅
  ⏰ debeEjecutarse: true  ✅
```

**Resultado:** ✅ La programación se ejecuta correctamente el domingo

---

## 🔄 **Migración de Datos Existentes** (Opcional)

Si tienes programaciones semanales existentes con `daily_mode` incorrecto:

```sql
-- Limpiar campo daily_mode en programaciones semanales
UPDATE programaciones
SET 
  daily_mode = NULL,
  cada_dias = NULL,
  rango_desde = NULL,
  rango_hasta = NULL,
  hora_una_vez_dia = NULL
WHERE tipo = 'semanal';

-- Limpiar campos semanales en programaciones diarias
UPDATE programaciones
SET 
  weekly_mode = NULL,
  weekly_days = NULL,
  weekly_rango_desde = NULL,
  weekly_rango_hasta = NULL,
  weekly_hora_una_vez = NULL
WHERE tipo = 'diaria';

-- Limpiar campos diarios y semanales en programaciones anuales
UPDATE programaciones
SET 
  daily_mode = NULL,
  cada_dias = NULL,
  rango_desde = NULL,
  rango_hasta = NULL,
  hora_una_vez_dia = NULL,
  weekly_mode = NULL,
  weekly_days = NULL,
  weekly_rango_desde = NULL,
  weekly_rango_hasta = NULL,
  weekly_hora_una_vez = NULL
WHERE tipo = 'anual';
```

---

## 📊 **Antes vs Después**

### **ANTES:**
```
Tipo: semanal
daily_mode: laborales  ❌
weekly_days: ["domingo"]
Domingo actual → Evaluación: ❌ false (no ejecuta)
```

### **DESPUÉS:**
```
Tipo: semanal
daily_mode: NULL  ✅
weekly_days: ["domingo"] o ["dom"] o ["sun"]  ✅ (todos funcionan)
Domingo actual → Evaluación: ✅ true (ejecuta correctamente)
```

---

## ✅ **Problemas Resueltos:**

| Problema | Estado | Solución |
|----------|--------|----------|
| Mismatch de idiomas en weekly_days | ✅ RESUELTO | Soporte multi-formato en comparación |
| `daily_mode` en programaciones semanales | ✅ RESUELTO | Limpieza explícita de campos por tipo |
| Programaciones semanales no se ejecutan | ✅ RESUELTO | Corrección de lógica de evaluación |

---

**¡Solución completa implementada! 🎉**

**Versión:** 1.0  
**Última actualización:** 2025-11-09


