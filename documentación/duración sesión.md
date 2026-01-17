# ⏱️ Actualización: Cálculo Correcto de Duración de Sesión

**Fecha:** 21 de Octubre de 2025  
**Versión Dashboard:** Actualizado con v1.3  
**Estado:** ✅ IMPLEMENTADO

---

## 🎯 Resumen del Cambio

Se ha actualizado el **Dashboard Admin** para usar el campo `session_started_at` (v1.3) en lugar de `last_seen_at` al calcular la duración de la sesión de un usuario.

---

## ❌ Problema Anterior

### Comportamiento incorrecto:
```javascript
// ❌ INCORRECTO
duracion = Date.now() - last_seen_at
```

**Síntomas:**
- ❌ La duración siempre mostraba ~30 segundos (el intervalo de heartbeat)
- ❌ No se reseteaba a 0 cuando el usuario hacía logout
- ❌ No reflejaba el tiempo real de la sesión

**Causa raíz:**  
`last_seen_at` se actualiza cada ~30 segundos con el heartbeat, por lo que **NO** es adecuado para calcular la duración total de la sesión.

---

## ✅ Solución Implementada

### Nuevo comportamiento:
```javascript
// ✅ CORRECTO
duracion = Date.now() - session_started_at
```

**Beneficios:**
- ✅ Muestra el tiempo real desde que el usuario hizo login
- ✅ Se resetea a `00h 00m 00s` cuando el usuario hace logout
- ✅ No depende del intervalo de actualización de heartbeat

---

## 🔧 Cambios Técnicos en el Dashboard

### 1. Hook `useLiveUsersPresence.ts`

**Función actualizada:**
```typescript
const formatSessionDuration = useCallback((sessionStartedAt: string | null, isOnline: boolean): string => {
  // Si está offline o no hay session_started_at, duración = 0
  if (!isOnline || !sessionStartedAt) {
    return '00h 00m 00s';
  }
  
  // Calcular duración desde el inicio de sesión ACTUAL
  const diff = Date.now() - new Date(sessionStartedAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}, []);
```

**Cambios en la consulta SQL:**
```typescript
// Ahora incluye session_started_at
const { data: currentState } = await supabase
  .from('user_current_state')
  .select(`
    usuario_id,
    is_online,
    last_seen_at,
    session_started_at,  // ✅ NUEVO CAMPO
    playback_state,
    // ... otros campos
  `);
```

**Uso en el mapeo de datos:**
```typescript
// Antes:
duracion: formatSessionDuration(user.last_seen_at)  // ❌

// Ahora:
duracion: formatSessionDuration(user.session_started_at, user.is_online)  // ✅
```

---

## 📊 Comparación de Campos

| Campo | Propósito | Se actualiza | Uso Correcto |
|-------|-----------|--------------|--------------|
| `session_started_at` | Inicio de sesión ACTUAL | Solo al login | ✅ **Calcular DURACIÓN** |
| `last_seen_at` | Última actividad | Cada ~30s | ✅ Verificar si está online |
| `current_song_started_at` | Inicio de canción actual | Al cambiar canción | ✅ Progreso de canción |

---

## 🔄 Comportamiento Esperado

### Al hacer LOGIN:
```json
{
  "is_online": true,
  "session_started_at": "2025-10-21T10:00:00.000Z",  // ✅ Se establece
  "last_seen_at": "2025-10-21T10:00:00.000Z",
  "playback_state": "paused"
}
```
**Dashboard mostrará:** Duración incrementando desde el login (ej: `0h 30m 15s`)

### Al hacer LOGOUT:
```json
{
  "is_online": false,
  "session_started_at": null,  // ✅ Se limpia
  "last_seen_at": "2025-10-21T10:45:00.000Z",
  "playback_state": null
}
```
**Dashboard mostrará:** `00h 00m 00s` (duración reseteada)

---

## ⚠️ Requisitos del Reproductor

Para que el dashboard funcione correctamente, el **Reproductor/Desktop** debe estar actualizado a **v1.3**:

### 1. Script SQL (ejecutar UNA VEZ):
```bash
scripts/add-session-started-at.sql
```

Este script:
- ✅ Agrega la columna `session_started_at` a `user_current_state`
- ✅ Pobla datos existentes desde `user_presence_sessions`
- ✅ Crea índices para rendimiento

### 2. Código del Reproductor debe actualizar `session_started_at`:

**Al hacer LOGIN:**
```javascript
await supabase
  .from('user_current_state')
  .upsert({
    usuario_id: userId,
    is_online: true,
    session_started_at: new Date().toISOString(),  // ✅ NUEVO
    last_seen_at: new Date().toISOString(),
    // ... otros campos
  });
```

**Al hacer LOGOUT:**
```javascript
await supabase
  .from('user_current_state')
  .update({
    is_online: false,
    session_started_at: null,  // ✅ LIMPIAR
    playback_state: null,
    // ... otros campos
  })
  .eq('usuario_id', userId);
```

---

## 🧪 Cómo Verificar que Funciona

### 1. Verificar que el campo existe en la BD:
```sql
SELECT 
  usuario_id,
  is_online,
  session_started_at,
  last_seen_at
FROM user_current_state
WHERE is_online = true
LIMIT 5;
```

**Resultado esperado:**
- ✅ `session_started_at` NO debe ser `null` para usuarios online
- ✅ `session_started_at` debe ser más antiguo que `last_seen_at`

### 2. Verificar en el Dashboard:

**Usuarios Online:**
- Deberían mostrar duración incrementando (ej: `0h 30m 45s`, `1h 15m 20s`)
- La duración **NO** debe ser siempre ~30 segundos

**Usuarios Offline:**
- Deberían mostrar `00h 00m 00s`

### 3. Verificar en la consola del navegador:

Busca logs como:
```
👤 DATOS CRUDOS DEL USUARIO:
  - session_started_at: 2025-10-21T10:00:00.000Z ✅
```

Si ves `session_started_at: null` para usuarios online, el reproductor aún no está usando v1.3.

---

## 📁 Archivos Modificados

```
✅ src/hooks/useLiveUsersPresence.ts
   - Función formatSessionDuration() actualizada
   - Consulta SQL incluye session_started_at
   - Mapeo de datos usa el nuevo campo

✅ OPTIMIZACION-USUARIOS-EN-DIRECTO.md
   - Sección nueva: "Cálculo Correcto de Duración (v1.3)"
   - Tabla de mapeo actualizada
   - Notas sobre session_started_at

✅ scripts/add-session-started-at.sql (NUEVO)
   - Script para agregar el campo a la BD
   - Pobla datos existentes
   - Crea índices

✅ CAMBIOS-DURACION-SESION.md (NUEVO - este archivo)
   - Documentación completa del cambio
```

---

## 📊 Impacto

### En el Dashboard:
- ✅ Sin impacto en rendimiento (solo usa un campo más)
- ✅ Consultas siguen siendo rápidas (paginación de 100 usuarios)
- ✅ Cálculo de duración más preciso

### En el Reproductor:
- ⚠️ Requiere actualización del código (agregar `session_started_at` en login/logout)
- ⚠️ Requiere ejecutar script SQL (una vez)

---

## ❓ FAQ

**P: ¿Debo eliminar `last_seen_at`?**  
R: **NO.** `last_seen_at` sigue siendo necesario para verificar si el usuario está online (última actividad < 60s).

**P: ¿Qué pasa si el reproductor aún no está actualizado?**  
R: El dashboard mostrará `00h 00m 00s` para todos los usuarios (porque `session_started_at` será `null`).

**P: ¿Funciona con Tiempo Real activado?**  
R: **SÍ.** `session_started_at` está en `user_current_state` que tiene Realtime habilitado.

**P: ¿Afecta a usuarios ya conectados?**  
R: El script SQL poblará `session_started_at` con el timestamp de su sesión activa.

**P: ¿Por qué la duración mostraba ~30 segundos antes?**  
R: Porque se calculaba con `last_seen_at`, que se actualiza cada ~30 segundos con el heartbeat.

---

## ✅ Checklist de Implementación

### Dashboard Admin:
- [x] ✅ Hook actualizado (`useLiveUsersPresence.ts`)
- [x] ✅ Función `formatSessionDuration()` corregida
- [x] ✅ Consulta SQL incluye `session_started_at`
- [x] ✅ Documentación actualizada

### Reproductor/Desktop:
- [ ] ⏳ Ejecutar script SQL (`add-session-started-at.sql`)
- [ ] ⏳ Actualizar código de login (establecer `session_started_at`)
- [ ] ⏳ Actualizar código de logout (limpiar `session_started_at`)
- [ ] ⏳ Verificar que usuarios online tienen `session_started_at` poblado

---

## 🎉 Resultado Final

Después de implementar estos cambios:

1. ✅ La duración mostrará el **tiempo real de la sesión**
2. ✅ Se reseteará a 0 al hacer logout
3. ✅ No dependerá del intervalo de heartbeat
4. ✅ Será coherente con el comportamiento esperado

---

**¿Dudas o problemas?** Revisa los logs en la consola del navegador buscando `session_started_at`.

