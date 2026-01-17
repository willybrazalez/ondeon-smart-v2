# 🧪 Guía de Pruebas - Sistema de Presencia y Actividad en Directo

**Fecha:** 20 de Octubre de 2025  
**Versión:** 2.0 (Optimizado)  
**Objetivo:** Validar el funcionamiento completo del sistema antes de documentar para el equipo del dashboard

---

## ✅ Checklist de Pruebas

### **Fase 1: Verificar Base de Datos** 

#### 1.1 Verificar que las tablas existen

```sql
-- En Supabase SQL Editor:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_presence_sessions', 'user_activity_events', 'user_current_state');
```

**Resultado esperado:** 3 filas (las 3 tablas)

---

#### 1.2 Verificar que Realtime está habilitado

```sql
-- Verificar publicación de Realtime
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

**Resultado esperado:** Debe incluir:
- `user_presence_sessions`
- `user_activity_events`
- `user_current_state`

---

#### 1.3 Verificar RLS está activo

```sql
-- Ver políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('user_presence_sessions', 'user_activity_events', 'user_current_state');
```

**Resultado esperado:** Múltiples políticas para SELECT, INSERT, UPDATE, DELETE

---

### **Fase 2: Probar Login y Presencia**

#### 2.1 Login del usuario

1. **Recarga la aplicación** (Cmd+R o F5)
2. Abre la **consola de desarrollo** (F12 → Console)
3. Haz **login** con cualquier usuario

**Logs esperados en consola:**
```
🚀 Iniciando OptimizedPresenceService para usuario: [usuario-id]
✅ Sesión creada: [session-id]
✅ Canal de presencia conectado
✅ Canal de eventos conectado
👥 Usuarios online: 1
✅ Estado actual inicializado
✅ OptimizedPresenceService iniciado correctamente
```

---

#### 2.2 Verificar sesión en BD

```sql
-- Ver sesión activa del usuario
SELECT 
  id,
  usuario_id,
  started_at,
  status,
  app_version,
  device_id
FROM user_presence_sessions
WHERE usuario_id = 'TU_USUARIO_ID' 
AND status = 'active'
ORDER BY started_at DESC
LIMIT 1;
```

**Resultado esperado:** 1 fila con `status = 'active'` y `started_at` reciente

---

#### 2.3 Verificar estado actual

```sql
-- Ver estado actual del usuario
SELECT 
  usuario_id,
  is_online,
  last_seen_at,
  playback_state,
  current_canal_name,
  current_song_title
FROM user_current_state
WHERE usuario_id = 'TU_USUARIO_ID';
```

**Resultado esperado:** 
- `is_online = true`
- `last_seen_at` reciente (< 1 minuto)

---

### **Fase 3: Probar Eventos de Actividad**

#### 3.1 Reproducir una canción

1. En la app, **haz clic en PLAY**
2. Espera a que empiece a reproducir

**Logs esperados:**
```
📡 Evento transmitido: song_changed
📊 Evento de canción enviado: [nombre-canción]
```

**Verificar en BD:**
```sql
SELECT 
  event_type,
  content_title,
  content_artist,
  canal_name,
  created_at
FROM user_activity_events
WHERE usuario_id = 'TU_USUARIO_ID'
AND event_type = 'song_changed'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado:** Eventos de tipo `song_changed` con datos de la canción

---

#### 3.2 Cambiar de canal

1. En la app, **cambia a otro canal** (flechas de navegación)

**Logs esperados:**
```
📡 Evento transmitido: channel_changed
📊 Evento de cambio de canal enviado: [canal-anterior] → [canal-nuevo]
```

**Verificar en BD:**
```sql
SELECT 
  event_type,
  canal_name,
  event_data->'from_channel' as from_channel,
  event_data->'to_channel' as to_channel,
  created_at
FROM user_activity_events
WHERE usuario_id = 'TU_USUARIO_ID'
AND event_type = 'channel_changed'
ORDER BY created_at DESC
LIMIT 3;
```

**Resultado esperado:** Eventos de tipo `channel_changed` con canales origen y destino

---

#### 3.3 Pausa/Play

1. **Pausa** la reproducción
2. **Vuelve a darle play**

**Verificar en BD:**
```sql
SELECT 
  event_type,
  event_data->>'state' as playback_state,
  created_at
FROM user_activity_events
WHERE usuario_id = 'TU_USUARIO_ID'
AND event_type = 'playback_state_changed'
ORDER BY created_at DESC
LIMIT 3;
```

**Resultado esperado:** Eventos con `state = 'paused'` y `state = 'playing'`

---

### **Fase 4: Probar Historial del Usuario**

#### 4.1 Ver historial en la app

1. Ve a la página **"Historial"** en el menú
2. Deberías ver tus últimos eventos

**Resultado esperado:**
- Lista de eventos (canciones, cambios de canal, etc.)
- Ordenados del más reciente al más antiguo
- Máximo 50 eventos mostrados
- Paginación de 10 eventos por página

**Logs esperados:**
```
✅ Historial cargado: [número] eventos
```

---

#### 4.2 Verificar auto-refresh

1. Con la página de historial abierta, **reproduce otra canción**
2. Espera 60 segundos (el auto-refresh está configurado cada 60s)
3. El historial debería actualizarse automáticamente

**Logs esperados (cada 60s):**
```
🔄 Auto-refresh historial (usuario activo)
✅ Historial cargado: [número] eventos
```

---

#### 4.3 Verificar pausa por inactividad

1. Con la página de historial abierta, **no muevas el mouse por 2 minutos**

**Logs esperados (después de 2 min):**
```
⏸️ Usuario inactivo - pausando auto-refresh del historial
⏸️ Auto-refresh pausado (usuario inactivo)
```

2. **Mueve el mouse** → debería reanudar auto-refresh

---

### **Fase 5: Probar Contenido Programado/Manual**

#### 5.1 Contenido Programado (si tienes configurado)

1. Espera a que se reproduzca un contenido programado (anuncio/cuña)

**Verificar en BD:**
```sql
SELECT 
  event_type,
  content_title,
  event_data->>'tipo_contenido' as tipo,
  event_data->>'modo_audio' as modo_audio,
  created_at
FROM user_activity_events
WHERE usuario_id = 'TU_USUARIO_ID'
AND event_type IN ('scheduled_content_started', 'scheduled_content_ended')
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:** 
- Eventos `scheduled_content_started` y `scheduled_content_ended` en pares
- Datos del contenido correctos

---

#### 5.2 Contenido Manual

1. Ve a **"Programación"** (si tienes acceso)
2. **Reproduce manualmente** un contenido

**Verificar en BD:**
```sql
SELECT 
  event_type,
  content_title,
  created_at
FROM user_activity_events
WHERE usuario_id = 'TU_USUARIO_ID'
AND event_type IN ('manual_content_started', 'manual_content_ended')
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:** 
- Eventos `manual_content_started` y `manual_content_ended`

---

### **Fase 6: Probar Batch/Flush de Eventos**

#### 6.1 Ver buffer acumulándose

En consola del navegador:
```javascript
// Ver estado del servicio
window.optimizedPresence.getStats()
```

**Resultado esperado:**
```javascript
{
  isActive: true,
  userId: "uuid",
  sessionId: "uuid",
  bufferedEvents: 5,  // Número de eventos en buffer
  onlineUsers: 1
}
```

---

#### 6.2 Esperar flush automático

1. Reproduce varias canciones rápidamente (5-10 canciones)
2. Espera 60 segundos

**Logs esperados:**
```
💾 Flush de eventos al buffer: [número] eventos
📊 [número] eventos guardados en BD
```

**Verificar:**
- Los eventos aparecen en `user_activity_events` después del flush

---

### **Fase 7: Probar Logout**

#### 7.1 Hacer logout

1. **Haz logout** de la aplicación

**Logs esperados:**
```
🛑 Deteniendo OptimizedPresenceService...
💾 Flush de eventos al buffer: [número] eventos
📊 [número] eventos guardados en BD
✅ Sesión cerrada: [session-id] ([duración]s)
✅ Estado actual actualizado (offline)
✅ Canales de Realtime desconectados
✅ Sistema de presencia detenido
```

---

#### 7.2 Verificar sesión cerrada

```sql
SELECT 
  id,
  usuario_id,
  started_at,
  ended_at,
  status,
  total_duration_seconds
FROM user_presence_sessions
WHERE usuario_id = 'TU_USUARIO_ID'
ORDER BY started_at DESC
LIMIT 1;
```

**Resultado esperado:**
- `status = 'disconnected'`
- `ended_at` tiene timestamp
- `total_duration_seconds` calculado

---

#### 7.3 Verificar estado offline

```sql
SELECT 
  usuario_id,
  is_online,
  last_seen_at
FROM user_current_state
WHERE usuario_id = 'TU_USUARIO_ID';
```

**Resultado esperado:**
- `is_online = false`
- `last_seen_at` con timestamp del logout

---

### **Fase 8: Probar Realtime (2 usuarios simultáneos)**

#### 8.1 Abrir 2 sesiones

1. Abre la app en **2 navegadores diferentes** (Chrome + Firefox)
2. Haz login con **2 usuarios diferentes**

**En la consola de cada navegador:**
```javascript
window.optimizedPresence.getStats()
```

**Resultado esperado en ambos:**
```javascript
{
  onlineUsers: 2  // ✅ Ambos usuarios se ven mutuamente
}
```

---

#### 8.2 Verificar eventos cruzados

1. En navegador 1: reproduce una canción
2. En navegador 2: verifica en consola

**NO deberías ver** el evento del otro usuario (Realtime usa broadcast, no PostgreSQL changes)

---

#### 8.3 Ver lista de usuarios online

```sql
-- Ver todos los usuarios online
SELECT * FROM v_users_online;
```

**Resultado esperado:** 2 filas (los 2 usuarios)

---

### **Fase 9: Verificar Optimización de Consumo**

#### 9.1 Monitorear escrituras en BD

```sql
-- Contar eventos guardados en la última hora
SELECT 
  COUNT(*) as total_eventos,
  COUNT(DISTINCT usuario_id) as usuarios_distintos,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 as minutos_transcurridos,
  COUNT(*) / NULLIF(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60, 0) as eventos_por_minuto
FROM user_activity_events
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Resultado esperado:**
- Eventos por minuto < 1 (gracias al batching)
- NO deberían ser 60 eventos/hora (eso indicaría heartbeats cada minuto)

---

#### 9.2 Ver tamaño de datos

```sql
-- Ver tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename IN ('user_presence_sessions', 'user_activity_events', 'user_current_state')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Resultado esperado:** Tamaños razonables (KB a pocos MB con pocos usuarios)

---

## ✅ Resumen de Validación

Marca cada ítem cuando esté validado:

- [ ] ✅ Tablas creadas correctamente
- [ ] ✅ Realtime habilitado
- [ ] ✅ RLS configurado
- [ ] ✅ Login crea sesión activa
- [ ] ✅ Estado actual se actualiza (online)
- [ ] ✅ Eventos de canción se registran
- [ ] ✅ Eventos de cambio de canal se registran
- [ ] ✅ Eventos de play/pause se registran
- [ ] ✅ Historial del usuario funciona
- [ ] ✅ Auto-refresh del historial funciona
- [ ] ✅ Pausa por inactividad funciona
- [ ] ✅ Contenido programado se registra
- [ ] ✅ Contenido manual se registra
- [ ] ✅ Batch/flush funciona
- [ ] ✅ Logout cierra sesión correctamente
- [ ] ✅ Estado cambia a offline
- [ ] ✅ Múltiples usuarios se ven mutuamente
- [ ] ✅ Optimización de consumo confirmada

---

## 🐛 Problemas Comunes

### Problema: No se crean eventos

**Solución:**
```javascript
// En consola del navegador:
window.optimizedPresence.getStats()
// Verificar que isActive = true
```

### Problema: RLS bloquea inserts

**Solución:**
```sql
-- Temporalmente deshabilitar RLS para testing
ALTER TABLE user_presence_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_current_state DISABLE ROW LEVEL SECURITY;

-- Después de testing, RE-HABILITAR:
ALTER TABLE user_presence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_current_state ENABLE ROW LEVEL SECURITY;
```

### Problema: "servicio inactivo"

**Solución:** Hacer logout y login de nuevo para reiniciar el servicio

### Problema: Eventos no aparecen inmediatamente

**Respuesta:** Es normal, se guardan en batch cada 60 segundos. Para forzar flush:
```javascript
await window.optimizedPresence.flush()
```

---

## 📊 Métricas de Éxito

### Con 1 usuario activo por 1 hora:

- **Sesiones creadas:** 1
- **Eventos en user_activity_events:** ~20-50 (dependiendo de actividad)
- **Escrituras en BD:** ~1 por minuto (gracias a batching)
- **Usuarios online en Realtime:** 1
- **Tamaño de datos generados:** < 50 KB

### Con 10 usuarios activos por 1 hora:

- **Sesiones creadas:** 10
- **Eventos totales:** ~200-500
- **Tamaño de datos:** < 500 KB
- **Escrituras por minuto:** ~10 (distribu idas entre usuarios)

---

## ✅ Una vez validado todo:

1. **Marca todos los checkboxes** ✅
2. **Captura pantallas** de:
   - Consola con logs exitosos
   - Página de historial funcionando
   - Queries SQL con datos
3. **Notifícame** que todo está validado
4. **Procederé** a elaborar el documento final para el equipo del dashboard

---

**Última actualización:** 20 de Octubre de 2025  
**Estado:** 🧪 Listo para pruebas

