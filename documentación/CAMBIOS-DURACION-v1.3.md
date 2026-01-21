# 📊 Actualización: Cálculo Correcto de Duración de Sesión (v1.3)

**Fecha:** 21 de Octubre de 2025  
**Versión:** 1.3  
**Estado:** ✅ IMPLEMENTADO

---

## 🎯 Problema Identificado

### ❌ Problema: Duración incorrecta en el dashboard

**Comportamiento anterior:**
```javascript
// El dashboard calculaba duración usando last_seen_at
Duración = Date.now() - last_seen_at

// Esto daba SIEMPRE ~30 segundos (el intervalo de actualización)
// NO reflejaba el tiempo real de la sesión
```

**Síntomas:**
- La duración mostraba valores acumulados de sesiones anteriores
- La duración no se reseteaba a 0 al hacer logout
- La duración siempre mostraba ~30 segundos

---

## ✅ Solución Implementada

### Nuevo campo: `session_started_at`

Se agregó un nuevo campo a `user_current_state`:

```sql
ALTER TABLE user_current_state
ADD COLUMN session_started_at timestamptz;
```

**Comportamiento:**
- ✅ Se establece cuando el usuario hace **login**
- ✅ Se limpia (`null`) cuando el usuario hace **logout**
- ✅ Permite calcular la duración de la **sesión ACTUAL**

---

## 📋 Cambios Implementados

### 1️⃣ Script SQL (`database/011_add_session_started_at.sql`)

```sql
-- Agregar columna
ALTER TABLE user_current_state
ADD COLUMN IF NOT EXISTS session_started_at timestamptz;

-- Poblar con datos existentes
UPDATE user_current_state ucs
SET session_started_at = ups.started_at
FROM user_presence_sessions ups
WHERE ucs.current_session_id = ups.id
  AND ucs.is_online = true;
```

**📁 Ejecutar UNA VEZ en Supabase SQL Editor**

---

### 2️⃣ Código del Reproductor (`optimizedPresenceService.js`)

**En `initializeCurrentState()` (línea 435):**
```javascript
session_started_at: now,  // 🆕 Guardar timestamp de inicio de sesión
```

**En `stopPresence()` (línea 159):**
```javascript
session_started_at: null,  // 🆕 Limpiar en logout
```

---

### 3️⃣ Documentación (`SISTEMA-PRESENCIA-DASHBOARD.md`)

**Actualizado a versión 1.3** con:
- ✅ Definición del nuevo campo
- ✅ Ejemplo de uso
- ✅ FAQ: "¿Cómo calculo la duración de la sesión ACTUAL?"
- ✅ Fórmula correcta de cálculo

---

## 💻 Uso en el Dashboard

### ✅ Fórmula CORRECTA

```javascript
// Calcular duración de la sesión ACTUAL
const calcularDuracion = (user) => {
  // Validar que el usuario esté online y tenga sesión
  if (!user.is_online || !user.session_started_at) {
    return {
      duracion: 0,
      texto: 'Offline'
    }
  }
  
  // Calcular duración desde el inicio de sesión
  const ahora = Date.now()
  const inicio = new Date(user.session_started_at).getTime()
  const duracionMs = ahora - inicio
  
  // Convertir a formato legible
  const segundos = Math.floor(duracionMs / 1000)
  const minutos = Math.floor(segundos / 60)
  const horas = Math.floor(minutos / 60)
  
  return {
    duracion: duracionMs,
    segundos: segundos,
    minutos: minutos,
    horas: horas,
    texto: `${horas}h ${minutos % 60}m ${segundos % 60}s`
  }
}

// Ejemplo de uso
const user = {
  is_online: true,
  session_started_at: "2025-10-21T10:00:00.000Z",
  usuario_name: "Juan Pérez"
}

const duracion = calcularDuracion(user)
console.log(duracion.texto)  // "0h 45m 23s"
```

### ❌ NO usar `last_seen_at`

```javascript
// ❌ INCORRECTO
const duracionIncorrecta = Date.now() - new Date(user.last_seen_at).getTime()
// Siempre dará ~30 segundos (intervalo de actualización)
```

---

## 📊 Comparación de Campos

| Campo | Propósito | Se actualiza | Uso en Dashboard |
|-------|-----------|--------------|------------------|
| `session_started_at` | Inicio de sesión ACTUAL | Solo al login | ✅ Calcular DURACIÓN |
| `last_seen_at` | Última actividad | Cada ~30s | ✅ Verificar si está online |
| `current_song_started_at` | Inicio de canción actual | Al cambiar canción | ✅ Progreso de canción |

---

## 🔄 Comportamiento en Login/Logout

### Al hacer LOGIN:
```javascript
{
  is_online: true,
  session_started_at: "2025-10-21T10:00:00.000Z",  // ✅ Se establece
  last_seen_at: "2025-10-21T10:00:00.000Z",
  playback_state: "paused",
  ...
}

// Duración = Date.now() - session_started_at
// → Muestra tiempo desde que hizo login
```

### Al hacer LOGOUT:
```javascript
{
  is_online: false,
  session_started_at: null,  // ✅ Se limpia (resetea a 0)
  last_seen_at: "2025-10-21T10:45:00.000Z",  // Última vez visto
  playback_state: null,  // Limpiado también
  ...
}

// Duración = 0 (usuario offline)
// → Dashboard muestra "Offline" o "0h 0m 0s"
```

---

## 🧪 Cómo Verificar

### Prueba 1: Nuevo login tiene timestamp

```sql
-- Después de hacer login en el reproductor
SELECT 
  usuario_id,
  is_online,
  session_started_at,
  last_seen_at
FROM user_current_state
WHERE usuario_id = 'TU_USER_ID';

-- Resultado esperado:
-- is_online: true
-- session_started_at: "2025-10-21T10:00:00..." ✅ (NO null)
```

### Prueba 2: Logout limpia timestamp

```sql
-- Después de hacer logout
SELECT 
  usuario_id,
  is_online,
  session_started_at
FROM user_current_state
WHERE usuario_id = 'TU_USER_ID';

-- Resultado esperado:
-- is_online: false
-- session_started_at: null ✅
```

### Prueba 3: Duración se calcula correctamente

```javascript
// En el dashboard
const { data: users } = await supabase
  .from('user_current_state')
  .select('*')
  .eq('is_online', true)

users.forEach(user => {
  const duracion = calcularDuracion(user)
  console.log(`${user.usuario_name}: ${duracion.texto}`)
})

// Resultado esperado:
// "Juan Pérez: 0h 30m 15s" ✅
// (incrementa cada segundo en tiempo real)
```

---

## 📁 Archivos Modificados

```
✅ database/011_add_session_started_at.sql (NUEVO)
✅ src/services/optimizedPresenceService.js (líneas 159, 435)
✅ SISTEMA-PRESENCIA-DASHBOARD.md (v1.3)
✅ CAMBIOS-DURACION-v1.3.md (NUEVO - este archivo)
```

---

## 📨 Mensaje para el Dashboard

```
🔔 ACTUALIZACIÓN v1.3: Cálculo de Duración Corregido

CAMBIO CRÍTICO:
Nuevo campo `session_started_at` en user_current_state para calcular duración correcta.

ANTES:
- Duración = Date.now() - last_seen_at  ❌
- Siempre mostraba ~30 segundos
- No se reseteaba en logout

AHORA:
- Duración = Date.now() - session_started_at  ✅
- Muestra tiempo real de la sesión actual
- Se resetea a 0 en logout

ACCIÓN REQUERIDA:
- Ejecutar: database/011_add_session_started_at.sql (UNA VEZ)
- Actualizar código del dashboard para usar session_started_at
- Ver función completa en FAQ del documento actualizado

Documentación: SISTEMA-PRESENCIA-DASHBOARD.md (v1.3)
Ver sección: "📊 ¿Cómo calculo la duración de la sesión ACTUAL?"
```

---

## ✅ Checklist de Implementación

### Para tu proyecto (Reproductor):
- [x] ✅ Código actualizado (`optimizedPresenceService.js`)
- [ ] ⏳ Ejecutar script SQL (`database/011_add_session_started_at.sql`)
- [ ] ⏳ Recargar app para aplicar cambios

### Para el Dashboard:
- [ ] ⏳ Ejecutar script SQL en Supabase
- [ ] ⏳ Actualizar código para usar `session_started_at`
- [ ] ⏳ Implementar función `calcularDuracion()`
- [ ] ⏳ Validar que usuarios offline muestren duración = 0

---

## 🎉 Beneficios

1. ✅ **Duración precisa**: Muestra tiempo real desde el login
2. ✅ **Se resetea en logout**: Duración = 0 para usuarios offline
3. ✅ **Fácil de calcular**: `Date.now() - session_started_at`
4. ✅ **Sin confusiones**: `last_seen_at` ya no se usa para duración

---

## ❓ FAQ

**P: ¿Debo eliminar el campo `last_seen_at`?**  
R: NO, `last_seen_at` se usa para verificar si el usuario está online (reciente < 60s).

**P: ¿Qué pasa con los usuarios ya conectados?**  
R: El script SQL poblará `session_started_at` con el valor de su sesión activa.

**P: ¿Funciona con Realtime?**  
R: Sí, `session_started_at` está en `user_current_state` que tiene Realtime habilitado.

**P: ¿Afecta al rendimiento?**  
R: No, es solo un campo más. No hay cálculos adicionales en la BD.

---

**✅ Cambios implementados y documentados completamente**  
**🚀 Dashboard mostrará duración correcta de la sesión actual**

