# 🔍 Análisis de Fallos Lógicos en Programaciones

**Fecha:** 2025-11-16  
**Versión:** 1.0

---

## 📋 **Problemas Detectados**

### **1. ❌ Frecuencia_minutos siempre se establece, incluso en modo `una_vez_dia`**

#### **Ubicación:** `src/services/aiAdService.js` línea 407

**Problema:**
```javascript
frecuencia_minutos: frecuencia.minutos || 15,  // ❌ Siempre establece 15, incluso si es una_vez_dia
```

**Impacto:** Cuando se crea una programación con `weekly_mode: 'una_vez_dia'` o `daily_mode: 'una_vez_dia'`, el sistema intenta ejecutarla cada 15 minutos en lugar de a la hora específica.

**Solución:** Establecer `frecuencia_minutos = null` cuando el modo es `una_vez_dia`.

---

### **2. ❌ Frecuencia_minutos no se valida al editar programaciones**

#### **Ubicación:** `src/pages/admin/ProgramacionesPage.jsx` línea 653

**Problema:**
```javascript
frecuencia_minutos: formEdicion.frecuenciaMinutos,  // ❌ No valida si es modo una_vez_dia
```

**Impacto:** Al editar una programación y cambiar a modo `una_vez_dia`, el campo `frecuencia_minutos` mantiene su valor anterior, causando el mismo problema.

**Solución:** Establecer `frecuencia_minutos = null` cuando se detecta modo `una_vez_dia`.

---

### **3. ⚠️ Validación incompleta en modo semanal `una_vez_dia`**

#### **Ubicación:** `src/pages/admin/ProgramacionesPage.jsx` línea 699

**Problema:**
```javascript
updateData.weekly_mode = formEdicion.weeklyMode;
updateData.weekly_hora_una_vez = formEdicion.weeklyHoraUnaVez;
// ❌ No se limpia frecuencia_minutos cuando weekly_mode === 'una_vez_dia'
```

**Impacto:** Similar al problema anterior, pero específico para programaciones semanales.

---

### **4. ⚠️ No hay validación al crear nuevas programaciones**

#### **Ubicación:** No existe función de creación en `ProgramacionesPage.jsx`

**Problema:** No hay una función dedicada para crear nuevas programaciones desde cero. Solo existe edición.

**Impacto:** No se puede crear programaciones directamente desde la página de gestión.

---

## ✅ **Soluciones Propuestas**

### **Fix 1: Corregir `aiAdService.js`**

```javascript
// ANTES (línea 407)
frecuencia_minutos: frecuencia.minutos || 15,

// DESPUÉS
frecuencia_minutos: (periodicidad.tipo === 'diaria' && periodicidad.dailyMode === 'una_vez') ||
                     (periodicidad.tipo === 'semanal' && periodicidad.weeklyMode === 'una_vez')
  ? null  // Sin frecuencia para modo una_vez_dia
  : (frecuencia.minutos || 15),
```

---

### **Fix 2: Corregir `ProgramacionesPage.jsx` - Guardar edición**

```javascript
// En guardarEdicionCompleta(), después de detectar el tipo:

// Si es modo una_vez_dia, establecer frecuencia_minutos = null
if (formEdicion.tipo === 'diaria' && unaVezAlDia) {
  updateData.frecuencia_minutos = null;
} else if (formEdicion.tipo === 'semanal' && formEdicion.weeklyMode === 'una_vez_dia') {
  updateData.frecuencia_minutos = null;
} else {
  updateData.frecuencia_minutos = formEdicion.frecuenciaMinutos;
}
```

---

### **Fix 3: Agregar función de creación de programaciones**

Crear una función `abrirModalCreacion()` similar a `abrirModalEdicion()` pero con valores por defecto.

---

## 📊 **Resumen de Cambios Necesarios**

| Archivo | Línea | Problema | Solución |
|---------|-------|----------|----------|
| `aiAdService.js` | 407 | `frecuencia_minutos` siempre 15 | Validar modo `una_vez_dia` |
| `ProgramacionesPage.jsx` | 653 | No valida modo al editar | Establecer `null` si es `una_vez_dia` |
| `ProgramacionesPage.jsx` | 699 | No limpia `frecuencia_minutos` en semanal | Agregar validación |
| `ContentManagementPage.jsx` | 819 | Botón solo navega, no abre modal | Implementar apertura de modal con contenido pre-seleccionado |

---

## 🎯 **Prioridad**

1. **ALTA:** Fix 1 y Fix 2 (afectan funcionalidad existente)
2. **MEDIA:** Fix 3 (mejora UX)
3. **BAJA:** Implementar creación desde ContentManagementPage (nueva funcionalidad)

---

**Última actualización:** 2025-11-16

