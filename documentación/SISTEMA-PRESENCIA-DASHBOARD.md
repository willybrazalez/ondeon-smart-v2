# 📡 Sistema de Presencia y Actividad en Tiempo Real - Documentación para Dashboard

**Versión:** 1.3  
**Fecha:** 20 de Octubre de 2025  
**Última actualización:** 21 de Octubre de 2025  
**Audiencia:** Equipo de desarrollo del Dashboard externo

> **⚡ Actualización v1.3:** Nuevo campo `session_started_at` para calcular duración correcta de la sesión ACTUAL. La duración se resetea a 0 en logout. Ver FAQ "¿Cómo calculo la duración de la sesión ACTUAL?".

> **⚡ Actualización v1.2:** Limpieza automática de datos de reproducción en logout. Los usuarios offline ya NO mostrarán datos "congelados" de canal/canción. Ver FAQ para detalles.

> **⚡ Actualización v1.1:** Incluye información detallada sobre limpieza automática de sesiones en logout, seguridad RLS, y optimizaciones para escalabilidad (500+ usuarios).

---

## 📋 Tabla de Contenidos

1. [🚀 Inicio Rápido (Quick Start)](#-inicio-rápido-quick-start)
2. [🎯 Introducción](#-introducción)
3. [🏗️ Arquitectura del Sistema](#️-arquitectura-del-sistema)
4. [🗄️ Estructura de Base de Datos](#️-estructura-de-base-de-datos)
5. [📡 Eventos en Tiempo Real (Realtime)](#-eventos-en-tiempo-real-realtime)
6. [🔌 Cómo Conectarse al Sistema](#-cómo-conectarse-al-sistema)
7. [💻 Ejemplos de Implementación](#-ejemplos-de-implementación)
8. [📚 API Reference Completa](#-api-reference-completa)
9. [✨ Best Practices](#-best-practices)
10. [🔧 Troubleshooting](#-troubleshooting)
11. [❓ FAQ](#-faq)
12. [🔒 Seguridad y RLS](#-seguridad-y-rls-row-level-security)
13. [📞 Soporte](#-soporte)

---

## 🚀 Inicio Rápido (Quick Start)

### Requisitos Previos
- ✅ Cuenta de Supabase con acceso al proyecto Ondeon
- ✅ Node.js 16+ instalado
- ✅ Conocimientos de JavaScript/TypeScript
- ✅ Usuario administrador en Supabase

### Setup en 5 Pasos

**1. Instalar dependencias**
```bash
npm install @supabase/supabase-js
```

**2. Ejecutar scripts SQL** (si no están ejecutados)
```sql
-- En Supabase SQL Editor, ejecutar en orden:
1. database/001_create_presence_system.sql
2. database/004_enable_realtime.sql
3. database/005_enable_rls.sql
4. database/006_fix_canal_foreign_key.sql
```

**3. Configurar cliente de Supabase**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://tu-proyecto.supabase.co',
  'tu_anon_key'
)
```

**4. Autenticarse como admin**
```javascript
await supabase.auth.signInWithPassword({
  email: 'admin@ejemplo.com',
  password: 'tu_password'
})
```

**5. Conectar a Realtime y mostrar usuarios online**
```javascript
const channel = supabase.channel('users-presence')
channel.on('presence', { event: 'sync' }, () => {
  const users = Object.values(channel.presenceState()).flat()
  console.log('Usuarios online:', users)
})
channel.subscribe()
```

✅ **¡Listo!** Ya estás recibiendo datos en tiempo real.

---

## 🎯 Introducción

Este documento describe el **Sistema Híbrido de Presencia y Actividad** implementado en Ondeon, que permite:

- ✅ Monitorear usuarios online en tiempo real (presencia)
- ✅ Recibir eventos de actividad en tiempo real (qué están haciendo)
- ✅ Acceder al historial completo de actividad de cada usuario
- ✅ Consumo optimizado (~55 MB/mes con 62 usuarios, ~2.5 GB/mes con 500 usuarios)
- ✅ Sistema de sesiones con limpieza automática en logout

### ¿Para qué sirve?

Este sistema te permite crear un **Dashboard de Monitoreo en Tiempo Real** que muestra:

1. **Vista "En Directo"**: Qué está haciendo cada usuario AHORA
   - Quién está conectado
   - Qué canal está escuchando
   - Qué canción está sonando
   - Estado de reproducción (playing/paused)

2. **Vista "Historial"**: Qué ha hecho cada usuario
   - Canciones reproducidas
   - Cambios de canal
   - Errores de reproducción
   - Contenido programado ejecutado

---

## 🏗️ Arquitectura del Sistema

### Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                    APP DESKTOP (Cliente)                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         optimizedPresenceService.js                         │ │
│  │  • Transmite eventos vía Realtime (inmediato)              │ │
│  │  • Guarda eventos en BD (batch cada 30s)                   │ │
│  │  • Actualiza estado actual del usuario                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                │ Supabase
                                │
         ┌──────────────────────┴──────────────────────┐
         │                                              │
         ▼                                              ▼
┌─────────────────────┐                  ┌──────────────────────────┐
│  REALTIME CHANNELS  │                  │   BASE DE DATOS          │
│                     │                  │                          │
│  1. Presence        │                  │  1. user_presence_       │
│     (online/offline)│                  │     sessions             │
│                     │                  │  2. user_activity_       │
│  2. Events          │                  │     events               │
│     (broadcast)     │                  │  3. user_current_        │
│                     │                  │     state                │
└─────────────────────┘                  └──────────────────────────┘
         │                                              │
         │                                              │
         └──────────────────┬───────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │     TU DASHBOARD             │
              │                              │
              │  • Escucha Realtime          │
              │  • Lee BD para historial     │
              │  • Muestra datos en UI       │
              └──────────────────────────────┘
```

### Flujo de Datos

#### 1. Usuario se Conecta (Login)
```
App Desktop → optimizedPresenceService.startPresence()
    ↓
1. Crea sesión en `user_presence_sessions`
2. Se conecta a canal Realtime "users-presence"
3. Llama a channel.track({ user_id, user_name, ... })
4. Actualiza `user_current_state` (is_online = true)
    ↓
Dashboard recibe evento "presence:join"
    ↓
Dashboard actualiza lista de usuarios online
```

#### 2. Usuario Cambia de Canción
```
App Desktop → optimizedPresenceService.sendSongChanged()
    ↓
1. Transmite vía Realtime broadcast (inmediato)
2. Agrega a buffer local
3. Guarda en BD cada 30s (batch)
4. Actualiza `user_current_state`
    ↓
Dashboard recibe evento "song_changed" vía Realtime
    ↓
Dashboard actualiza UI en tiempo real
```

#### 3. Usuario se Desconecta (Logout)
```
App Desktop → optimizedPresenceService.stopPresence()
    ↓
1. Flush eventos pendientes (guarda todo lo que quede en buffer)
2. Cierra sesión en `user_presence_sessions`:
   - status = 'disconnected'
   - ended_at = timestamp actual
   - total_duration_seconds = duración calculada
3. Actualiza `user_current_state`:
   - is_online = false
   - last_seen_at = timestamp actual
4. Desconecta canales de Realtime:
   - channel.untrack() (Presence)
   - channel.unsubscribe() (Events)
5. Resetea estado interno del servicio
    ↓
Dashboard recibe evento "presence:leave"
    ↓
Dashboard elimina usuario de lista online
```

**⚠️ IMPORTANTE:** El sistema **SÍ limpia automáticamente** la información de conexión:
- ✅ La sesión se marca como `disconnected`
- ✅ Se registra la hora de logout (`ended_at`)
- ✅ Se calcula la duración total de la sesión
- ✅ El usuario aparece como `is_online = false` en `user_current_state`
- ✅ El dashboard lo elimina de la lista de usuarios online en tiempo real

---

## 🗄️ Estructura de Base de Datos

### Tabla 1: `user_presence_sessions`

**Propósito:** Registra sesiones de conexión de usuarios (login/logout)

```sql
CREATE TABLE user_presence_sessions (
  id uuid PRIMARY KEY,
  usuario_id uuid REFERENCES usuarios(id),
  
  -- Timestamps
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  last_activity_at timestamptz NOT NULL,
  
  -- Dispositivo
  device_id text,
  device_info jsonb,
  app_version text,
  
  -- Estado
  status text, -- 'active', 'idle', 'disconnected'
  
  -- Métricas
  total_duration_seconds integer
);
```

**Ejemplo de fila:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "usuario_id": "123e4567-e89b-12d3-a456-426614174000",
  "started_at": "2025-10-20T10:00:00.000Z",
  "ended_at": null,
  "last_activity_at": "2025-10-20T10:30:00.000Z",
  "device_id": "device_abc123",
  "device_info": {
    "platform": "MacIntel",
    "userAgent": "Mozilla/5.0...",
    "screenResolution": "1920x1080"
  },
  "app_version": "1.0.0",
  "status": "active",
  "total_duration_seconds": null
}
```

---

### Tabla 2: `user_activity_events`

**Propósito:** Registra TODOS los eventos de actividad del usuario

```sql
CREATE TABLE user_activity_events (
  id uuid PRIMARY KEY,
  usuario_id uuid REFERENCES usuarios(id),
  session_id uuid REFERENCES user_presence_sessions(id),
  
  created_at timestamptz NOT NULL,
  event_type text NOT NULL,
  
  -- Datos del canal
  canal_id uuid,
  canal_name text,
  
  -- Datos del contenido
  content_title text,
  content_artist text,
  content_duration_seconds integer,
  
  -- Datos específicos (JSON flexible)
  event_data jsonb
);
```

**Tipos de eventos (`event_type`):**
- `song_changed` - Cambió la canción
- `channel_changed` - Cambió de canal
- `playback_state_changed` - Cambió estado (playing/paused/stopped)
- `scheduled_content_started` - Inició contenido programado (anuncio)
- `scheduled_content_ended` - Finalizó contenido programado
- `manual_content_started` - Inició contenido manual
- `manual_content_ended` - Finalizó contenido manual
- `playback_error` - Error de reproducción

**Ejemplo de evento `song_changed`:**
```json
{
  "id": "660f9500-f39c-52e5-b827-557766551111",
  "usuario_id": "123e4567-e89b-12d3-a456-426614174000",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-10-20T10:15:00.000Z",
  "event_type": "song_changed",
  "canal_id": "abc12345-1234-1234-1234-123456789abc",
  "canal_name": "Rock Clásico",
  "content_title": "Bohemian Rhapsody",
  "content_artist": "Queen",
  "content_duration_seconds": 354,
  "event_data": {
    "song_id": "song_uuid",
    "playlist_id": "playlist_uuid"
  }
}
```

**Ejemplo de evento `channel_changed`:**
```json
{
  "id": "770g0600-g40d-63f6-c938-668877662222",
  "usuario_id": "123e4567-e89b-12d3-a456-426614174000",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-10-20T10:20:00.000Z",
  "event_type": "channel_changed",
  "canal_id": "def67890-5678-5678-5678-567890abcdef",
  "canal_name": "Jazz Suave",
  "content_title": null,
  "content_artist": null,
  "content_duration_seconds": null,
  "event_data": {
    "from_channel": "Rock Clásico",
    "to_channel": "Jazz Suave",
    "from_channel_id": "abc12345-1234-1234-1234-123456789abc"
  }
}
```

**Ejemplo de evento `scheduled_content_started`:**
```json
{
  "id": "880h1700-h51e-74g7-d049-779988773333",
  "usuario_id": "123e4567-e89b-12d3-a456-426614174000",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-10-20T10:25:00.000Z",
  "event_type": "scheduled_content_started",
  "canal_id": "abc12345-1234-1234-1234-123456789abc",
  "canal_name": "Rock Clásico",
  "content_title": "Anuncio Farmacia Ondeon",
  "content_artist": null,
  "content_duration_seconds": 30,
  "event_data": {
    "programacion_id": "prog_uuid",
    "tipo_contenido": "ad",
    "modo_audio": "overlay",
    "descripcion_prog": "Anuncio cada hora"
  }
}
```

**Ejemplo de evento `playback_error`:**
```json
{
  "id": "990i2800-i62f-85h8-e150-880099884444",
  "usuario_id": "123e4567-e89b-12d3-a456-426614174000",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-10-20T10:30:00.000Z",
  "event_type": "playback_error",
  "canal_id": "abc12345-1234-1234-1234-123456789abc",
  "canal_name": "Rock Clásico",
  "content_title": "Stairway to Heaven",
  "content_artist": null,
  "content_duration_seconds": null,
  "event_data": {
    "error_type": "stream_failed",
    "error_message": "Failed to load audio source",
    "error_context": "Network timeout"
  }
}
```

---

### Tabla 3: `user_current_state`

**Propósito:** Estado actual de cada usuario (snapshot rápido para dashboard)

```sql
CREATE TABLE user_current_state (
  usuario_id uuid PRIMARY KEY REFERENCES usuarios(id),
  
  -- Presencia
  is_online boolean NOT NULL,
  last_seen_at timestamptz NOT NULL,
  session_started_at timestamptz,  -- 🆕 Para calcular duración de sesión actual
  
  -- Reproducción actual
  playback_state text, -- 'playing', 'paused', 'stopped'
  current_canal_id uuid,
  current_canal_name text,
  current_song_title text,
  current_song_artist text,
  current_song_started_at timestamptz,
  
  -- Sesión
  current_session_id uuid,
  device_id text,
  app_version text,
  
  -- Metadata
  metadata jsonb,
  updated_at timestamptz NOT NULL
);
```

**Ejemplo de fila:**
```json
{
  "usuario_id": "123e4567-e89b-12d3-a456-426614174000",
  "is_online": true,
  "last_seen_at": "2025-10-20T10:30:00.000Z",
  "session_started_at": "2025-10-20T10:00:00.000Z",  // 🆕 Inicio de sesión actual
  "playback_state": "playing",
  "current_canal_id": "abc12345-1234-1234-1234-123456789abc",
  "current_canal_name": "Rock Clásico",
  "current_song_title": "Bohemian Rhapsody",
  "current_song_artist": "Queen",
  "current_song_started_at": "2025-10-20T10:15:00.000Z",
  "current_session_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "device_abc123",
  "app_version": "1.0.0",
  "metadata": {},
  "updated_at": "2025-10-20T10:30:00.000Z"
}
```

**💡 Cálculo de Duración de Sesión:**

```javascript
// ✅ CORRECTO: Usar session_started_at
const duracionMs = Date.now() - new Date(user.session_started_at).getTime()
const duracionMinutos = Math.floor(duracionMs / 60000)

// ❌ INCORRECTO: NO usar last_seen_at (se actualiza constantemente)
// const duracionMs = Date.now() - new Date(user.last_seen_at).getTime()
```

**📋 Regla de negocio:**
- **Si `is_online = true`** → Calcular duración desde `session_started_at`
- **Si `is_online = false`** → Mostrar duración = 0 o "Offline"
- **Si `session_started_at = null`** → Mostrar "N/A"

---

### Vistas Útiles

El sistema incluye vistas pre-configuradas para facilitar consultas:

#### Vista: `v_users_online`
Lista de usuarios conectados con su estado actual

```sql
SELECT * FROM v_users_online;
```

**Resultado:**
```json
[
  {
    "usuario_id": "123...",
    "usuario_name": "Juan Pérez",
    "email": "juan@example.com",
    "usuario_role": "user",
    "playback_state": "playing",
    "current_canal_name": "Rock Clásico",
    "current_song_title": "Bohemian Rhapsody",
    "current_song_artist": "Queen",
    "last_seen_at": "2025-10-20T10:30:00.000Z",
    "seconds_since_activity": 15,
    "device_id": "device_abc123",
    "app_version": "1.0.0"
  }
]
```

#### Vista: `v_recent_activity`
Actividad de las últimas 24 horas

```sql
SELECT * FROM v_recent_activity
ORDER BY created_at DESC
LIMIT 100;
```

#### Vista: `v_active_sessions`
Sesiones activas con duración calculada

```sql
SELECT * FROM v_active_sessions;
```

#### Vista: `v_user_stats_24h`
Estadísticas por usuario (últimas 24h)

```sql
SELECT * FROM v_user_stats_24h
WHERE usuario_id = 'uuid';
```

**Resultado:**
```json
{
  "usuario_id": "123...",
  "usuario_name": "Juan Pérez",
  "songs_played": 45,
  "channel_changes": 5,
  "errors_count": 1,
  "scheduled_content_count": 8,
  "unique_channels_used": 3,
  "first_activity": "2025-10-20T00:00:00.000Z",
  "last_activity": "2025-10-20T10:30:00.000Z"
}
```

---

## 📡 Eventos en Tiempo Real (Realtime)

### Canales de Realtime

El sistema usa 2 canales de Supabase Realtime:

#### 1. Canal de Presencia: `users-presence`
**Propósito:** Detectar quién está online/offline automáticamente

**Eventos:**
- `presence:sync` - Lista completa de usuarios online
- `presence:join` - Usuario se conectó
- `presence:leave` - Usuario se desconectó

**Estructura de presencia:**
```typescript
interface PresenceData {
  user_id: string
  user_name: string
  user_role: string
  email: string
  device_id: string
  session_id: string
  online_at: string // ISO timestamp
}
```

#### 2. Canal de Eventos: `user-events`
**Propósito:** Transmitir eventos de actividad en tiempo real

**Eventos:**
- `song_changed`
- `channel_changed`
- `playback_state_changed`
- `scheduled_content_started`
- `scheduled_content_ended`
- `manual_content_started`
- `manual_content_ended`
- `playback_error`

**Estructura genérica de evento:**
```typescript
interface BroadcastEvent {
  type: "broadcast"
  event: string // Tipo de evento
  payload: {
    usuario_id: string
    session_id: string
    timestamp: number
    // ... datos específicos del evento
  }
}
```

---

## 🔌 Cómo Conectarse al Sistema

### Requisitos Previos

1. **Credenciales de Supabase:**
   - URL del proyecto
   - Anon key (pública)

2. **Librería Supabase Client:**
   ```bash
   npm install @supabase/supabase-js
   ```

### Paso 1: Inicializar Cliente de Supabase

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tu-proyecto.supabase.co'
const supabaseAnonKey = 'tu_anon_key_publica'

const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Paso 2: Escuchar Presencia (Usuarios Online)

```javascript
// Suscribirse al canal de presencia
const presenceChannel = supabase.channel('users-presence')

// Listener: Sincronización completa (se ejecuta al conectar y cuando cambia)
presenceChannel.on('presence', { event: 'sync' }, () => {
  const state = presenceChannel.presenceState()
  const onlineUsers = Object.values(state).flat()
  
  console.log('Usuarios online:', onlineUsers)
  // Actualizar UI con lista de usuarios
  updateOnlineUsersList(onlineUsers)
})

// Listener: Usuario se conectó
presenceChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
  console.log('Usuario(s) conectado(s):', newPresences)
  // Mostrar notificación o añadir a lista
  newPresences.forEach(user => {
    addUserToList(user)
    showNotification(`${user.user_name} se conectó`)
  })
})

// Listener: Usuario se desconectó
presenceChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  console.log('Usuario(s) desconectado(s):', leftPresences)
  // Remover de lista
  leftPresences.forEach(user => {
    removeUserFromList(user.user_id)
    showNotification(`${user.user_name} se desconectó`)
  })
})

// Suscribirse al canal
presenceChannel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('✅ Conectado a presencia')
  }
})
```

### Paso 3: Escuchar Eventos de Actividad

```javascript
// Suscribirse al canal de eventos
const eventsChannel = supabase.channel('user-events')

// Listener genérico para todos los eventos
eventsChannel.on('broadcast', { event: '*' }, (payload) => {
  const { event, payload: data } = payload
  
  console.log(`Evento recibido: ${event}`, data)
  
  // Manejar según tipo de evento
  switch (event) {
    case 'song_changed':
      handleSongChanged(data)
      break
    case 'channel_changed':
      handleChannelChanged(data)
      break
    case 'playback_error':
      handlePlaybackError(data)
      break
    // ... otros eventos
  }
})

// O escuchar eventos específicos
eventsChannel.on('broadcast', { event: 'song_changed' }, (payload) => {
  console.log('Canción cambiada:', payload.payload)
  updateUserCurrentSong(payload.payload)
})

// Suscribirse al canal
eventsChannel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('✅ Conectado a eventos')
  }
})
```

### Paso 4: Consultar Base de Datos

```javascript
// Obtener usuarios online (desde BD)
async function getOnlineUsers() {
  const { data, error } = await supabase
    .from('v_users_online')
    .select('*')
    .order('last_seen_at', { ascending: false })
  
  if (error) {
    console.error('Error:', error)
    return []
  }
  
  return data
}

// Obtener historial de un usuario
async function getUserHistory(userId, limit = 50) {
  const { data, error } = await supabase
    .from('user_activity_events')
    .select('*')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error:', error)
    return []
  }
  
  return data
}

// Obtener estadísticas del usuario
async function getUserStats(userId) {
  const { data, error } = await supabase
    .from('v_user_stats_24h')
    .select('*')
    .eq('usuario_id', userId)
    .single()
  
  if (error) {
    console.error('Error:', error)
    return null
  }
  
  return data
}
```

---

## 💻 Ejemplos de Implementación

### Ejemplo 1: Dashboard React Básico

```jsx
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('URL', 'ANON_KEY')

function Dashboard() {
  const [onlineUsers, setOnlineUsers] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  
  useEffect(() => {
    // Cargar usuarios online desde BD
    loadOnlineUsers()
    
    // Conectar a Realtime
    const presenceChannel = supabase.channel('users-presence')
    const eventsChannel = supabase.channel('user-events')
    
    // Escuchar presencia
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setOnlineUsers(Object.values(state).flat())
      })
      .subscribe()
    
    // Escuchar eventos
    eventsChannel
      .on('broadcast', { event: '*' }, (payload) => {
        setRecentEvents(prev => [payload.payload, ...prev].slice(0, 50))
      })
      .subscribe()
    
    // Cleanup
    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(eventsChannel)
    }
  }, [])
  
  async function loadOnlineUsers() {
    const { data } = await supabase
      .from('v_users_online')
      .select('*')
    
    if (data) setOnlineUsers(data)
  }
  
  return (
    <div className="dashboard">
      <h1>Dashboard en Tiempo Real</h1>
      
      <div className="section">
        <h2>Usuarios Online ({onlineUsers.length})</h2>
        <ul>
          {onlineUsers.map(user => (
            <li key={user.usuario_id}>
              <strong>{user.usuario_name}</strong>
              {user.current_song_title && (
                <span> - {user.current_song_title} por {user.current_song_artist}</span>
              )}
              <span> ({user.current_canal_name})</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="section">
        <h2>Eventos Recientes</h2>
        <ul>
          {recentEvents.map((event, i) => (
            <li key={i}>
              <strong>{event.event}</strong> - Usuario {event.usuario_id}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default Dashboard
```

### Ejemplo 2: Dashboard Vue.js

```vue
<template>
  <div class="dashboard">
    <h1>Dashboard en Tiempo Real</h1>
    
    <div class="section">
      <h2>Usuarios Online ({{ onlineUsers.length }})</h2>
      <ul>
        <li v-for="user in onlineUsers" :key="user.usuario_id">
          <strong>{{ user.usuario_name }}</strong>
          <span v-if="user.current_song_title">
            - {{ user.current_song_title }} por {{ user.current_song_artist }}
          </span>
          <span>({{ user.current_canal_name }})</span>
        </li>
      </ul>
    </div>
    
    <div class="section">
      <h2>Eventos Recientes</h2>
      <ul>
        <li v-for="(event, i) in recentEvents" :key="i">
          <strong>{{ event.event }}</strong> - Usuario {{ event.usuario_id }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('URL', 'ANON_KEY')

export default {
  name: 'Dashboard',
  data() {
    return {
      onlineUsers: [],
      recentEvents: [],
      presenceChannel: null,
      eventsChannel: null
    }
  },
  mounted() {
    this.loadOnlineUsers()
    this.connectRealtime()
  },
  beforeUnmount() {
    if (this.presenceChannel) {
      supabase.removeChannel(this.presenceChannel)
    }
    if (this.eventsChannel) {
      supabase.removeChannel(this.eventsChannel)
    }
  },
  methods: {
    async loadOnlineUsers() {
      const { data } = await supabase
        .from('v_users_online')
        .select('*')
      
      if (data) {
        this.onlineUsers = data
      }
    },
    connectRealtime() {
      // Presencia
      this.presenceChannel = supabase.channel('users-presence')
      this.presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = this.presenceChannel.presenceState()
          this.onlineUsers = Object.values(state).flat()
        })
        .subscribe()
      
      // Eventos
      this.eventsChannel = supabase.channel('user-events')
      this.eventsChannel
        .on('broadcast', { event: '*' }, (payload) => {
          this.recentEvents.unshift(payload.payload)
          if (this.recentEvents.length > 50) {
            this.recentEvents.pop()
          }
        })
        .subscribe()
    }
  }
}
</script>
```

### Ejemplo 3: Backend (Node.js)

```javascript
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient('URL', 'ANON_KEY')

// Guardar eventos en tu propia BD (opcional)
async function listenAndSave() {
  const eventsChannel = supabase.channel('user-events')
  
  eventsChannel.on('broadcast', { event: '*' }, async (payload) => {
    const { event, payload: data } = payload
    
    console.log(`Evento recibido: ${event}`, data)
    
    // Guardar en tu BD (MongoDB, PostgreSQL, etc.)
    await saveToMyDatabase({
      event_type: event,
      ...data,
      received_at: new Date()
    })
  })
  
  eventsChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Backend conectado a eventos')
    }
  })
}

listenAndSave()
```

---

## 📚 API Reference Completa

### Eventos de Presencia

#### `presence:sync`
Se ejecuta al conectar y cuando cambia la lista de usuarios online

**Datos:**
```typescript
{
  [user_id: string]: PresenceData[]
}
```

#### `presence:join`
Usuario se conectó

**Datos:**
```typescript
{
  newPresences: PresenceData[]
}
```

#### `presence:leave`
Usuario se desconectó

**Datos:**
```typescript
{
  leftPresences: PresenceData[]
}
```

---

### Eventos de Actividad

#### `song_changed`
Usuario cambió de canción

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  song: string
  artist: string
  channel_id: string
  channel_name: string
  duration: number // segundos
  timestamp: number
}
```

#### `channel_changed`
Usuario cambió de canal

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  from_channel: string
  to_channel: string
  from_channel_id: string
  to_channel_id: string
  timestamp: number
}
```

#### `playback_state_changed`
Cambió estado de reproducción

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  state: 'playing' | 'paused' | 'stopped'
  previous_state: string
  channel_id: string
  channel_name: string
  timestamp: number
}
```

#### `scheduled_content_started`
Inició contenido programado

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  title: string
  tipo_contenido: string // 'ad', 'announcement', etc.
  programacion_id: string
  channel_id: string
  channel_name: string
  duration: number
  timestamp: number
}
```

#### `scheduled_content_ended`
Finalizó contenido programado

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  title: string
  tipo_contenido: string
  programacion_id: string
  channel_id: string
  channel_name: string
  timestamp: number
}
```

#### `manual_content_started`
Inició contenido manual

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  title: string
  content_type: string
  channel_id: string
  channel_name: string
  duration: number
  file_url: string
  timestamp: number
}
```

#### `manual_content_ended`
Finalizó contenido manual

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  title: string
  content_type: string
  channel_id: string
  channel_name: string
  timestamp: number
}
```

#### `playback_error`
Error de reproducción

**Payload:**
```typescript
{
  usuario_id: string
  session_id: string
  error_type: string // 'stream_failed', 'network_error', etc.
  error_message: string
  channel_id: string
  channel_name: string
  title: string // Canción que falló
  timestamp: number
}
```

---

## 🎯 Best Practices

### 1. Manejo de Reconexiones

Supabase Realtime se reconecta automáticamente, pero puedes manejar estados:

```javascript
presenceChannel.subscribe((status) => {
  switch (status) {
    case 'SUBSCRIBED':
      console.log('✅ Conectado')
      setConnectionStatus('connected')
      break
    case 'CHANNEL_ERROR':
      console.error('❌ Error de conexión')
      setConnectionStatus('error')
      break
    case 'TIMED_OUT':
      console.warn('⏱️ Timeout')
      setConnectionStatus('timeout')
      break
    case 'CLOSED':
      console.log('🔌 Conexión cerrada')
      setConnectionStatus('disconnected')
      break
  }
})
```

### 2. Rate Limiting

No necesitas implementar rate limiting manualmente, el cliente ya lo gestiona. Pero si recibes demasiados eventos, considera:

```javascript
// Debounce para actualizar UI
import { debounce } from 'lodash'

const updateUI = debounce((data) => {
  setOnlineUsers(data)
}, 500) // Actualizar cada 500ms máximo

presenceChannel.on('presence', { event: 'sync' }, () => {
  const state = presenceChannel.presenceState()
  updateUI(Object.values(state).flat())
})
```

### 3. Filtrado de Eventos Propios

Si quieres ignorar eventos del usuario actual:

```javascript
const currentUserId = 'tu-user-id'

eventsChannel.on('broadcast', { event: '*' }, (payload) => {
  const { payload: data } = payload
  
  // Ignorar eventos propios
  if (data.usuario_id === currentUserId) {
    return
  }
  
  handleEvent(data)
})
```

### 4. Paginación de Historial

```javascript
async function loadMoreHistory(userId, offset = 0, limit = 50) {
  const { data, error } = await supabase
    .from('user_activity_events')
    .select('*')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  return data || []
}

// Cargar primera página
const firstPage = await loadMoreHistory(userId, 0, 50)

// Cargar segunda página
const secondPage = await loadMoreHistory(userId, 50, 50)
```

### 5. Cleanup de Conexiones

Siempre limpia las conexiones al desmontar componentes:

```javascript
useEffect(() => {
  const presenceChannel = supabase.channel('users-presence')
  const eventsChannel = supabase.channel('user-events')
  
  // ... suscripciones ...
  
  return () => {
    supabase.removeChannel(presenceChannel)
    supabase.removeChannel(eventsChannel)
  }
}, [])
```

---

## 🐛 Troubleshooting

### Problema: No recibo eventos de Realtime

**Solución:**
1. Verifica que Realtime esté habilitado en Supabase Dashboard
2. Verifica que usas la anon key correcta
3. Verifica que el canal tenga el nombre correcto:
   - Presencia: `users-presence`
   - Eventos: `user-events`

```javascript
// Debug: Ver estado del canal
console.log('Canal:', presenceChannel)
console.log('Estado:', presenceChannel.state)
```

### Problema: Eventos duplicados

**Solución:**
Asegúrate de no suscribirte múltiples veces al mismo canal:

```javascript
// ❌ MAL
useEffect(() => {
  const channel = supabase.channel('user-events')
  channel.on('broadcast', ...).subscribe()
}) // Sin cleanup

// ✅ BIEN
useEffect(() => {
  const channel = supabase.channel('user-events')
  channel.on('broadcast', ...).subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

### Problema: Usuarios aparecen como offline pero están online

**Solución:**
La tabla `user_current_state` se actualiza cada ~30 segundos. Para datos en tiempo real, usa Presence:

```javascript
// ✅ Usar Presence para estado en tiempo real
const onlineUsers = Object.values(presenceChannel.presenceState()).flat()

// ⚠️ user_current_state puede tener delay de hasta 30s
const { data } = await supabase.from('user_current_state').select('*')
```

### Problema: Error de permisos (RLS)

**Solución:**
Verifica que las políticas RLS estén configuradas correctamente en Supabase.

Por defecto, las tablas tienen permisos para usuarios autenticados:

```sql
-- Ver políticas actuales
SELECT * FROM pg_policies
WHERE tablename IN ('user_activity_events', 'user_current_state');
```

---

## ❓ FAQ

### ¿Cuánto tráfico consume el sistema?

**Con 62 usuarios concurrentes:**
- **Realtime:** ~25 MB/mes
- **Escrituras en BD:** ~30 MB/mes
- **Total:** ~55 MB/mes (0.022% de límite de 250GB)

**Con 500 usuarios concurrentes:**
- **Realtime:** ~200 MB/mes
- **Escrituras en BD:** ~2.3 GB/mes (optimizado con batching)
- **Total:** ~2.5 GB/mes (1% de límite de 250GB)

**Optimizaciones aplicadas:**
- ✅ Batch inserts cada 60 segundos (acumula hasta 20 eventos)
- ✅ Consultas con límite de 50 registros
- ✅ Solo columnas necesarias en SELECT
- ✅ Auto-refresh pausado si usuario inactivo
- ✅ Throttling de eventos duplicados

**Capacidad máxima estimada:** 10,000+ usuarios con plan de 250GB/mes

### ¿Puedo guardar los eventos en mi propia base de datos?

Sí, puedes escuchar eventos vía Realtime y guardarlos donde quieras:

```javascript
eventsChannel.on('broadcast', { event: '*' }, async (payload) => {
  // Guardar en MongoDB, PostgreSQL, etc.
  await myDatabase.insert(payload.payload)
})
```

### ¿Los eventos se guardan aunque no haya nadie escuchando?

Sí, los eventos se guardan en `user_activity_events` automáticamente desde la app desktop, independientemente de si el dashboard está conectado o no.

### ¿Qué pasa si Realtime falla?

- Los eventos se siguen guardando en BD (batch cada 30s)
- Realtime se reconecta automáticamente
- Puedes consultar la BD como fallback

### ¿Puedo filtrar eventos por tipo?

Sí, tanto en Realtime como en BD:

```javascript
// Realtime: Solo canciones
eventsChannel.on('broadcast', { event: 'song_changed' }, (payload) => {
  // ...
})

// BD: Solo errores
const { data } = await supabase
  .from('user_activity_events')
  .select('*')
  .eq('event_type', 'playback_error')
```

### ¿Cómo sé si un usuario sigue conectado?

Usa `last_seen_at` y compara con la hora actual:

```javascript
const isOnline = (lastSeenAt) => {
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  return diff < 60000 // Menos de 1 minuto = online
}
```

### ¿Puedo ver el historial de sesiones de un usuario?

Sí:

```javascript
const { data } = await supabase
  .from('user_presence_sessions')
  .select('*')
  .eq('usuario_id', userId)
  .order('started_at', { ascending: false })
  .limit(10)
```

### ¿Cómo detecto cuando un usuario hace logout?

**Opción 1: Realtime (Inmediato)**
```javascript
presenceChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  leftPresences.forEach(user => {
    console.log(`${user.user_name} hizo logout`)
    // Actualizar UI inmediatamente
    removeUserFromDashboard(user.user_id)
  })
})
```

**Opción 2: Base de Datos (Para historial)**
```javascript
// Buscar sesiones cerradas
const { data } = await supabase
  .from('user_presence_sessions')
  .select('*')
  .eq('status', 'disconnected')
  .not('ended_at', 'is', null)
  .order('ended_at', { ascending: false })

// Ver cuánto tiempo estuvo conectado
data.forEach(session => {
  console.log(`Usuario: ${session.usuario_id}`)
  console.log(`Duración: ${session.total_duration_seconds} segundos`)
  console.log(`Logout: ${session.ended_at}`)
})
```

**Opción 3: Polling de `user_current_state`**
```javascript
// Verificar cada 30 segundos
setInterval(async () => {
  const { data } = await supabase
    .from('user_current_state')
    .select('usuario_id, is_online, last_seen_at')
    .eq('is_online', false)
  
  // Actualizar lista de usuarios offline
  updateOfflineUsers(data)
}, 30000)
```

### 📊 ¿Cómo calculo la duración de la sesión ACTUAL?

**IMPORTANTE:** Usa el campo `session_started_at`, NO `last_seen_at`.

**✅ Fórmula CORRECTA:**
```javascript
// Duración de la sesión ACTUAL (desde que hizo login)
const calcularDuracion = (user) => {
  if (!user.is_online || !user.session_started_at) {
    return 0  // Usuario offline o sin sesión
  }
  
  const ahora = Date.now()
  const inicio = new Date(user.session_started_at).getTime()
  const duracionMs = ahora - inicio
  
  // Convertir a formato legible
  const segundos = Math.floor(duracionMs / 1000)
  const minutos = Math.floor(segundos / 60)
  const horas = Math.floor(minutos / 60)
  
  return {
    ms: duracionMs,
    segundos,
    minutos,
    horas,
    formatoTexto: `${horas}h ${minutos % 60}m ${segundos % 60}s`
  }
}

// Ejemplo de uso
const user = {
  is_online: true,
  session_started_at: "2025-10-21T10:00:00.000Z"
}

const duracion = calcularDuracion(user)
console.log(duracion.formatoTexto)  // "0h 30m 15s"
```

**❌ NO usar `last_seen_at`:**
```javascript
// ❌ INCORRECTO - last_seen_at se actualiza constantemente
const duracionIncorrecta = Date.now() - new Date(user.last_seen_at).getTime()
// Esto siempre dará ~30 segundos (el intervalo de actualización)
```

**📋 Diferencia entre los campos:**

| Campo | Propósito | Se actualiza |
|-------|-----------|--------------|
| `session_started_at` | Inicio de sesión ACTUAL | ✅ Solo al hacer login |
| `last_seen_at` | Última actividad | ❌ Cada 30 segundos |

**🔄 Comportamiento en logout:**

Cuando un usuario hace logout:
```javascript
{
  is_online: false,          // ✅ Marcado offline
  session_started_at: null,  // ✅ Limpiado (resetea a 0)
  last_seen_at: "2025-10-21T10:30:00.000Z"  // Mantiene última vez visto
}
```

**Resultado:** La duración se resetea a 0 cuando el usuario se desconecta.

---

### ⚠️ ¿Por qué veo usuarios OFFLINE con datos de reproducción?

**IMPORTANTE:** A partir de la versión 1.1, esto ya NO debería suceder.

**Comportamiento CORRECTO (versión 1.1+):**

Cuando un usuario hace **logout** o se desconecta:
```javascript
// ✅ Se limpia AUTOMÁTICAMENTE:
{
  is_online: false,          // Marcado como offline
  playback_state: null,      // ❌ LIMPIADO
  current_canal_name: null,  // ❌ LIMPIADO
  current_song_title: null,  // ❌ LIMPIADO
  current_song_artist: null, // ❌ LIMPIADO
  current_song_started_at: null  // ❌ LIMPIADO
}
```

**Si ves usuarios offline CON datos:**

Son datos **residuales** de versiones anteriores. Ejecuta este SQL para limpiarlos:

```sql
-- Limpiar datos residuales de usuarios offline
UPDATE user_current_state
SET 
  playback_state = NULL,
  current_canal_id = NULL,
  current_canal_name = NULL,
  current_song_title = NULL,
  current_song_artist = NULL,
  current_song_started_at = NULL,
  updated_at = NOW()
WHERE is_online = false;
```

**Cómo manejar esto en tu Dashboard:**

```javascript
// Opción 1: Filtrar SOLO usuarios online
const { data: onlineUsers } = await supabase
  .from('user_current_state')
  .select('*')
  .eq('is_online', true)  // ✅ Solo usuarios realmente conectados

// Opción 2: Validar datos antes de mostrar
const renderUser = (user) => {
  // Si está offline, mostrar campos vacíos
  if (!user.is_online) {
    return {
      ...user,
      playback_state: null,
      current_canal_name: null,
      current_song_title: null
    }
  }
  return user
}

// Opción 3: Mostrar warning si hay inconsistencias
if (!user.is_online && user.playback_state) {
  console.warn('⚠️ Datos residuales detectados:', user.usuario_id)
}
```

**Regla de negocio recomendada:**

```javascript
// Solo mostrar datos de reproducción si el usuario está REALMENTE online
const shouldShowPlaybackInfo = (user) => {
  return user.is_online === true && 
         user.playback_state !== null &&
         user.last_seen_at !== null
}
```

---

## 🔒 Seguridad y RLS (Row Level Security)

### Políticas de Seguridad Implementadas

El sistema tiene RLS habilitado en todas las tablas con las siguientes políticas:

#### Usuarios Base (`rol_id = 1`)
- ✅ Pueden **ver** y **modificar** SOLO sus propios datos
- ❌ No pueden ver datos de otros usuarios

#### Administradores (`rol_id = 2 o 3`)
- ✅ Pueden **ver** datos de TODOS los usuarios
- ✅ Pueden **modificar** datos de todos los usuarios
- ✅ Acceso completo a vistas y tablas

#### Superadmins (tabla `superadmins`)
- ✅ Acceso completo sin restricciones
- ✅ Pueden crear, leer, actualizar y eliminar cualquier registro

### Autenticación en el Dashboard

**⚠️ IMPORTANTE:** Para acceder a los datos, tu dashboard debe autenticarse con un usuario que tenga permisos de administrador o superadmin.

```javascript
// Iniciar sesión como admin
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@ejemplo.com',
  password: 'tu_password'
})

if (error) {
  console.error('Error de autenticación:', error)
  return
}

// Ahora puedes acceder a todos los datos
const { data: allUsers } = await supabase
  .from('user_current_state')
  .select('*')
```

### Verificar Permisos

```sql
-- Ver políticas RLS de una tabla
SELECT * FROM pg_policies 
WHERE tablename = 'user_activity_events';

-- Verificar si RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'user_presence_sessions',
  'user_activity_events', 
  'user_current_state'
);
```

### Scripts SQL de Seguridad

Los scripts SQL necesarios están en:
- `database/005_enable_rls.sql` - Habilita RLS y crea políticas
- Incluye funciones auxiliares: `public.is_superadmin()` y `public.get_user_role()`

---

## 📞 Soporte

Para dudas o problemas:

1. **Revisa esta documentación** primero
2. **Verifica los logs** en la consola del navegador
3. **Consulta Supabase docs** para temas de Realtime: https://supabase.com/docs/guides/realtime

---

## 🎉 ¡Listo para Empezar!

Con esta documentación tienes todo lo necesario para crear un dashboard completo que muestre:

- ✅ Quién está online en tiempo real
- ✅ Qué está escuchando cada usuario
- ✅ Historial completo de actividad
- ✅ Estadísticas y métricas

**Próximos pasos:**

1. ✅ **Verificar BD:** Ejecutar scripts SQL en Supabase (carpeta `database/`)
   - Verificar que las tablas existen: `user_presence_sessions`, `user_activity_events`, `user_current_state`
   - Verificar que Realtime está habilitado en las 3 tablas
   - Verificar que RLS está configurado correctamente

2. ✅ **Obtener credenciales:**
   - URL del proyecto Supabase
   - Anon key (pública)
   - Credenciales de usuario admin/superadmin

3. ✅ **Implementar dashboard:**
   - Usar los ejemplos de código de este documento
   - Crear vista "En Directo" (Realtime Presence + Broadcast)
   - Crear vista "Historial" (consultas a BD)

4. ✅ **Probar:**
   - Conectar un usuario desktop
   - Verificar que aparece en el dashboard
   - Cambiar canción/canal y ver actualizaciones
   - Hacer logout y verificar que desaparece

5. ✅ **Monitorear consumo:**
   - Dashboard Supabase → Project Settings → Usage
   - Verificar Realtime Messages y Database Egress

**Checklist de Verificación:**
- [ ] Scripts SQL ejecutados sin errores
- [ ] Dashboard se conecta a Supabase sin errores
- [ ] Usuarios online aparecen en tiempo real
- [ ] Eventos se reciben correctamente (canciones, canales, etc.)
- [ ] Logout elimina usuarios de la lista
- [ ] Historial muestra datos correctos
- [ ] RLS funciona (admin ve todos, usuario base solo los suyos)

¡Buena suerte! 🚀

---

## 📝 Changelog

**v1.1** (20 Oct 2025)
- ✅ Agregada sección de Inicio Rápido
- ✅ Agregada sección de Seguridad y RLS
- ✅ Actualizado consumo para 500 usuarios
- ✅ Agregada información detallada de logout
- ✅ Agregadas nuevas FAQs

**v1.0** (20 Oct 2025)
- ✅ Documentación inicial

