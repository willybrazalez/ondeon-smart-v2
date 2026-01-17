# 🔐 Implementación de Sesión Única por Usuario

## 📋 Resumen

Se ha implementado un sistema de **sesión única por usuario** que garantiza que cada usuario solo pueda tener una sesión activa a la vez. Si el usuario inicia sesión desde otro dispositivo, la sesión anterior se cierra automáticamente.

---

## ✅ ¿Qué se implementó?

### 1. **Base de Datos (SQL)**
- ✅ Nueva función `start_single_session()`: Crea una nueva sesión cerrando automáticamente sesiones previas del mismo usuario
- ✅ Función `close_previous_user_sessions()`: Cierra manualmente sesiones activas de un usuario
- ✅ Función `check_device_session()`: Verifica si un dispositivo tiene sesión activa
- ✅ Trigger `notify_session_closed`: Notifica vía Realtime cuando una sesión es cerrada forzadamente
- ✅ Índices optimizados para consultas por `device_id` y `usuario_id`

**Archivo:** `database/013_single_session_enforcement.sql`

### 2. **API (JavaScript)**
- ✅ `presenceApi.startSingleSession()`: Inicia nueva sesión cerrando las previas
- ✅ `presenceApi.closePreviousSessions()`: Cierra sesiones previas manualmente
- ✅ `presenceApi.checkDeviceSession()`: Verifica sesión del dispositivo

**Archivo:** `src/lib/api.js`

### 3. **Servicio de Presencia**
- ✅ Modificado `optimizedPresenceService` para usar la nueva función de sesión única
- ✅ Al iniciar presencia, ahora se llama automáticamente a `start_single_session()`
- ✅ Logs informativos cuando se cierran sesiones previas

**Archivo:** `src/services/optimizedPresenceService.js`

### 4. **Hook de Monitoreo**
- ✅ Nuevo hook `useSessionMonitor()` que detecta en tiempo real cuando la sesión fue cerrada en otro dispositivo
- ✅ Dos métodos de detección:
  - Suscripción Realtime a cambios en `user_current_state`
  - Verificación periódica cada 30 segundos (backup)

**Archivo:** `src/hooks/useSessionMonitor.js`

### 5. **Modal de Notificación**
- ✅ Componente `SessionClosedModal` que muestra el mensaje:
  > "Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo"
- ✅ Auto-redirige al login después de 5 segundos
- ✅ Limpia localStorage automáticamente
- ✅ Diseño moderno con animaciones

**Archivo:** `src/components/SessionClosedModal.jsx`

### 6. **Integración en App.jsx**
- ✅ Hook `useSessionMonitor` integrado en el componente principal
- ✅ Modal mostrado cuando se detecta cierre de sesión
- ✅ Funciona tanto para usuarios legacy como Supabase Auth

**Archivo:** `src/App.jsx`

---

## 🚀 Cómo Activar el Sistema

### Paso 1: Ejecutar el Script SQL

1. Ir al **SQL Editor** en el dashboard de Supabase
2. Copiar y pegar el contenido completo del archivo:
   ```
   database/013_single_session_enforcement.sql
   ```
3. Hacer clic en **Run** (Ejecutar)
4. Verificar que aparezca el mensaje:
   ```
   ✅ Sistema de sesión única instalado correctamente (3/3 funciones creadas)
   ```

**Nota:** Este script es seguro de ejecutar múltiples veces (usa `CREATE OR REPLACE`).

### Paso 2: Reiniciar la Aplicación

Ya está! El código del frontend ya está implementado. Solo necesitas:

1. Asegurarte de que no hay errores de compilación:
   ```bash
   npm run dev
   ```

2. Todo debería funcionar automáticamente.

---

## 🧪 Cómo Probar que Funciona

### Escenario 1: Login en Segundo Dispositivo

1. **Dispositivo A:** Inicia sesión con un usuario (ej: `usuario1@ejemplo.com`)
2. **Dispositivo A:** Verifica que estás conectado y el reproductor funciona
3. **Dispositivo B:** Abre la app en otra pestaña/navegador/dispositivo
4. **Dispositivo B:** Inicia sesión con el **mismo usuario** (`usuario1@ejemplo.com`)
5. **Dispositivo A:** Deberías ver el modal:
   ```
   🚫 Sesión Cerrada
   Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.
   ```
6. **Dispositivo A:** Después de 5 segundos, redirige automáticamente al login
7. **Dispositivo B:** Sigue funcionando normalmente

### Escenario 2: Verificar en la Base de Datos

Puedes verificar en Supabase SQL Editor:

```sql
-- Ver sesiones activas de un usuario
SELECT 
  id,
  usuario_id,
  device_id,
  status,
  started_at,
  ended_at
FROM user_presence_sessions
WHERE usuario_id = 'UUID_DEL_USUARIO'
ORDER BY started_at DESC
LIMIT 5;
```

Deberías ver:
- ✅ Solo **1 sesión con `status = 'active'`**
- ❌ Las demás sesiones con `status = 'disconnected'` y `ended_at` rellenado

### Escenario 3: Logs en la Consola

En desarrollo (`NODE_ENV=development`), verás logs como:

**Al hacer login:**
```
🔐 Iniciando sesión única para usuario: [user_id]
🔐 1 sesión(es) previa(s) cerrada(s)
   Dispositivo anterior: [device_id]
✅ Sesión única creada: [session_id]
```

**En el dispositivo anterior (cuando se detecta cierre):**
```
🚫 Sesión cerrada detectada - Usuario conectado en otro dispositivo
🔄 Redirigiendo al login por sesión cerrada...
```

---

## 🔍 Detalles Técnicos

### Flujo Completo

```
1. Usuario hace login
   ↓
2. optimizedPresenceService.startPresence() se ejecuta
   ↓
3. Llama a presenceApi.startSingleSession()
   ↓
4. Función SQL start_single_session():
   - Busca sesiones activas del usuario
   - Cierra sesiones previas (marca como 'disconnected')
   - Actualiza user_current_state (is_online = false)
   - Crea nueva sesión activa
   - Actualiza user_current_state con nueva sesión
   ↓
5. Trigger notify_session_closed emite notificación pg_notify
   ↓
6. Hook useSessionMonitor detecta cambio en user_current_state
   ↓
7. Modal SessionClosedModal se muestra
   ↓
8. Limpia localStorage y redirige al login
```

### Verificación Periódica (Backup)

Por si Realtime falla, el sistema también verifica cada 30 segundos:

```javascript
// Cada 30 segundos
const { data } = await supabase
  .from('user_current_state')
  .select('is_online, device_id')
  .eq('usuario_id', userId)
  .single();

// Si otro dispositivo está activo → mostrar modal
if (data.is_online && data.device_id !== myDeviceId) {
  handleSessionClosed();
}
```

---

## 🛠️ Archivos Modificados/Creados

### Nuevos Archivos
- ✅ `database/013_single_session_enforcement.sql` (función SQL)
- ✅ `src/hooks/useSessionMonitor.js` (hook de detección)
- ✅ `src/components/SessionClosedModal.jsx` (modal de notificación)

### Archivos Modificados
- ✅ `src/lib/api.js` (nuevas funciones de API)
- ✅ `src/services/optimizedPresenceService.js` (integración)
- ✅ `src/App.jsx` (integración del hook y modal)

---

## 📝 Funciones SQL Disponibles

### 1. `start_single_session()`
**Uso:** Crear nueva sesión cerrando las previas automáticamente

```sql
SELECT * FROM start_single_session(
  'usuario_id_here',
  'device_id_here',
  '{"os": "Windows", "browser": "Chrome"}'::jsonb,
  '1.3.0'
);
```

**Retorna:**
- `new_session_id`: UUID de la nueva sesión
- `closed_sessions_count`: Número de sesiones cerradas
- `previous_device_id`: Device ID de la sesión anterior

### 2. `close_previous_user_sessions()`
**Uso:** Cerrar manualmente todas las sesiones de un usuario

```sql
SELECT * FROM close_previous_user_sessions('usuario_id_here');
```

**Retorna:**
- `closed_sessions_count`: Número de sesiones cerradas
- `session_ids`: Array de UUIDs de las sesiones cerradas

### 3. `check_device_session()`
**Uso:** Verificar si un dispositivo tiene sesión activa

```sql
SELECT * FROM check_device_session('usuario_id', 'device_id');
```

**Retorna:**
- `has_active_session`: boolean
- `session_id`: UUID de la sesión (si existe)
- `started_at`: Timestamp de inicio

---

## ⚠️ Consideraciones

### 1. Device ID
- Se genera automáticamente y se guarda en `localStorage` como `ondeon_device_id`
- Es único por navegador/dispositivo
- Se mantiene entre sesiones

### 2. Usuarios Legacy vs Supabase Auth
- ✅ Funciona para **ambos tipos** de usuarios
- La función SQL solo necesita el `usuario_id` (UUID)
- No importa si vienen de `auth.users` o `public.usuarios`

### 3. Performance
- Las funciones SQL usan índices optimizados
- El hook de monitoreo tiene throttling (no spam)
- Impacto mínimo en rendimiento

### 4. Realtime
- Usa la suscripción Realtime de Supabase
- Si Realtime falla, el sistema backup de verificación periódica toma el control
- No hay riesgo de sesiones "zombie"

---

## 🐛 Troubleshooting

### El modal no aparece en el dispositivo anterior

**Posibles causas:**
1. Realtime no está configurado en Supabase
   - **Solución:** Verificar que Realtime esté habilitado en el proyecto
2. La tabla `user_current_state` no tiene RLS configurado correctamente
   - **Solución:** Verificar políticas RLS
3. Hook no está inicializando
   - **Solución:** Verificar logs en consola, debería aparecer:
     ```
     👁️ Iniciando monitoreo de sesión única para: [userId]
     ```

### Se cierran ambas sesiones

**Posible causa:** Ambos dispositivos comparten el mismo `device_id`
- **Solución:** Limpiar localStorage en uno de los dispositivos:
  ```javascript
  localStorage.removeItem('ondeon_device_id');
  location.reload();
  ```

### La función SQL no se ejecuta

**Posible causa:** Permisos insuficientes
- **Solución:** Verificar que el usuario `authenticated` tenga permisos:
  ```sql
  GRANT EXECUTE ON FUNCTION start_single_session TO authenticated;
  ```

---

## 📞 Soporte

Si tienes problemas o dudas:

1. Verificar logs en la consola del navegador (modo desarrollo)
2. Ejecutar en Supabase SQL Editor:
   ```sql
   -- Verificar que las funciones existan
   SELECT proname FROM pg_proc 
   WHERE proname IN ('start_single_session', 'close_previous_user_sessions', 'check_device_session');
   ```
3. Revisar las sesiones activas en la tabla `user_presence_sessions`

---

## 🎉 Resultado Final

Con esta implementación:

✅ **Solo 1 sesión activa por usuario**  
✅ **Cierre automático de sesiones previas**  
✅ **Notificación en tiempo real al dispositivo anterior**  
✅ **Mensaje claro al usuario**  
✅ **Redirección automática al login**  
✅ **Funciona para usuarios legacy y Supabase Auth**  
✅ **Sistema robusto con backup (verificación periódica)**  
✅ **Sin impacto en performance**

---

## 🔧 Historial de Cambios

### Versión 1.0.2 (27 de octubre de 2025)
- ✅ **Fix:** Agregado `DROP TRIGGER IF EXISTS` para evitar error de duplicado
  - El script ahora elimina el trigger existente antes de crearlo
  - Error resuelto: `trigger "trigger_notify_session_closed" already exists`
  - El script es completamente idempotente (se puede ejecutar múltiples veces sin errores)

### Versión 1.0.1 (27 de octubre de 2025)
- ✅ **Fix:** Corregida ambigüedad en columnas SQL
  - Agregados alias explícitos en `RETURN QUERY SELECT` para evitar conflictos
  - Funciones afectadas: `start_single_session()` y `close_previous_user_sessions()`
  - Error resuelto: `column reference "closed_sessions_count" is ambiguous`

### Versión 1.0 (27 de octubre de 2025)
- ✅ Implementación inicial del sistema de sesión única

---

**Fecha de implementación:** 27 de octubre de 2025  
**Versión:** 1.0.2

