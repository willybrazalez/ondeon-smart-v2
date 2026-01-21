# 🚀 Dashboard "En Directo" - Guía Rápida de Implementación

**Para:** Desarrollador del Dashboard Externo  
**De:** Equipo Ondeon Frontend  
**Objetivo:** Crear dashboard de monitoreo en tiempo real de usuarios

---

## 📝 Resumen Ejecutivo

Vas a crear un dashboard que muestre **en tiempo real** qué están haciendo los usuarios de Ondeon:
- ✅ Quién está conectado AHORA
- ✅ Qué canal está escuchando cada usuario
- ✅ Qué canción está sonando
- ✅ Historial completo de actividad

**Tecnología:** Supabase Realtime + PostgreSQL  
**Consumo:** ~2.5 GB/mes con 500 usuarios (muy optimizado)  
**Tiempo estimado:** 2-3 días de desarrollo

---

## 🎯 Lo Que Necesitas Saber

### 1. ¿Cómo funciona el sistema?

```
Usuario Desktop App → Genera eventos (cambio de canción, canal, etc.)
                    ↓
             Supabase Realtime (WebSocket)
                    ↓
             Tu Dashboard ← Recibe eventos en tiempo real
                    ↓
             También se guarda en BD (para historial)
```

### 2. ¿Qué eventos vas a recibir?

| Evento | Cuándo se dispara | Información incluida |
|--------|-------------------|---------------------|
| `presence:join` | Usuario hace login | Nombre, email, ID, dispositivo |
| `presence:leave` | Usuario hace logout | ID del usuario que se desconectó |
| `song_changed` | Cambia la canción | Título, artista, canal, duración |
| `channel_changed` | Cambia de canal | Canal anterior, canal nuevo |
| `playback_state_changed` | Pausa/Play/Stop | Estado (playing/paused/stopped) |
| `scheduled_content_started` | Inicia un anuncio | Título, duración, tipo |
| `playback_error` | Error de reproducción | Descripción del error |

### 3. ¿Qué tablas vas a consultar?

| Tabla | Para qué sirve | Cuándo consultarla |
|-------|----------------|-------------------|
| `user_current_state` | Estado actual de cada usuario | Para ver quién está online AHORA |
| `user_activity_events` | Todos los eventos (historial) | Para mostrar historial de actividad |
| `user_presence_sessions` | Sesiones de login/logout | Para estadísticas de tiempo conectado |

---

## 🛠️ Setup en 10 Minutos

### Paso 1: Instalar Supabase Client

```bash
npm install @supabase/supabase-js
```

### Paso 2: Configurar Conexión

```javascript
// config/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://nazlyvhndymalevkfpnl.supabase.co', // URL del proyecto
  'ANON_KEY_AQUI' // Pedir la key al equipo Ondeon
)
```

### Paso 3: Login como Admin

```javascript
// Para poder ver datos de todos los usuarios, debes autenticarte como admin
async function loginAsAdmin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'TU_EMAIL_ADMIN',
    password: 'TU_PASSWORD'
  })
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('✅ Autenticado como admin')
}
```

### Paso 4: Escuchar Usuarios Online (Realtime)

```javascript
// components/OnlineUsers.jsx
const presenceChannel = supabase.channel('users-presence')

// Lista completa de usuarios online
presenceChannel.on('presence', { event: 'sync' }, () => {
  const onlineUsers = Object.values(presenceChannel.presenceState()).flat()
  console.log('Usuarios online:', onlineUsers)
  setUsers(onlineUsers) // Actualizar estado React
})

// Usuario se conectó
presenceChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
  console.log('✅ Usuario conectado:', newPresences)
  // Mostrar notificación o añadir a lista
})

// Usuario se desconectó
presenceChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  console.log('❌ Usuario desconectado:', leftPresences)
  // Eliminar de lista
})

presenceChannel.subscribe()
```

### Paso 5: Escuchar Eventos de Actividad (Realtime)

```javascript
// components/ActivityFeed.jsx
const eventsChannel = supabase.channel('user-events')

// Escuchar TODOS los eventos
eventsChannel.on('broadcast', { event: '*' }, (payload) => {
  console.log('Evento recibido:', payload.event, payload.payload)
  
  // Actualizar UI según el tipo de evento
  switch(payload.event) {
    case 'song_changed':
      updateCurrentSong(payload.payload)
      break
    case 'channel_changed':
      updateChannel(payload.payload)
      break
    // ... más casos
  }
})

// O escuchar eventos específicos
eventsChannel.on('broadcast', { event: 'song_changed' }, (payload) => {
  console.log('Nueva canción:', payload.payload.title)
})

eventsChannel.subscribe()
```

### Paso 6: Consultar Historial (Base de Datos)

```javascript
// components/UserHistory.jsx
async function getUserHistory(userId) {
  const { data, error } = await supabase
    .from('user_activity_events')
    .select('id, event_type, content_title, content_artist, canal_name, created_at')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Historial del usuario:', data)
  return data
}
```

---

## 🎨 Ejemplo de UI Completo (React)

```jsx
import { useState, useEffect } from 'react'
import { supabase } from './config/supabase'

function Dashboard() {
  const [onlineUsers, setOnlineUsers] = useState([])
  const [recentEvents, setRecentEvents] = useState([])

  useEffect(() => {
    // 1. Conectar a Presencia
    const presenceChannel = supabase.channel('users-presence')
    
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const users = Object.values(presenceChannel.presenceState()).flat()
      setOnlineUsers(users)
    })
    
    presenceChannel.subscribe()

    // 2. Conectar a Eventos
    const eventsChannel = supabase.channel('user-events')
    
    eventsChannel.on('broadcast', { event: '*' }, (payload) => {
      setRecentEvents(prev => [payload.payload, ...prev.slice(0, 49)])
    })
    
    eventsChannel.subscribe()

    // Cleanup
    return () => {
      presenceChannel.unsubscribe()
      eventsChannel.unsubscribe()
    }
  }, [])

  return (
    <div className="dashboard">
      <h1>Dashboard En Directo</h1>
      
      {/* Lista de Usuarios Online */}
      <div className="online-users">
        <h2>Usuarios Online ({onlineUsers.length})</h2>
        {onlineUsers.map(user => (
          <div key={user.user_id} className="user-card">
            <h3>{user.user_name}</h3>
            <p>Email: {user.email}</p>
            <p>Conectado desde: {new Date(user.online_at).toLocaleTimeString()}</p>
          </div>
        ))}
      </div>

      {/* Feed de Actividad */}
      <div className="activity-feed">
        <h2>Actividad Reciente</h2>
        {recentEvents.map((event, index) => (
          <div key={index} className="event-card">
            <span className="event-type">{event.eventType}</span>
            <p>{event.title || event.eventType}</p>
            <small>{new Date(event.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
```

---

## 🔒 Importante: Seguridad (RLS)

El sistema tiene **Row Level Security** habilitado:

- ✅ **Usuarios normales** solo ven sus propios datos
- ✅ **Admins** (`rol_id = 2 o 3`) ven datos de todos
- ✅ **Superadmins** (tabla `superadmins`) acceso total

**Para tu dashboard:**
- Debes autenticarte como admin o superadmin
- Si no te autenticas, no verás ningún dato
- Si te autenticas como usuario normal, solo verás datos de ese usuario

```javascript
// ❌ SIN autenticación → error de permisos
const { data } = await supabase.from('user_current_state').select('*')

// ✅ CON autenticación de admin → funciona
await supabase.auth.signInWithPassword({ email: 'admin@...', password: '...' })
const { data } = await supabase.from('user_current_state').select('*')
```

---

## 📊 Estructura de Datos Clave

### Objeto de Presence (usuario online)

```javascript
{
  user_id: "uuid-del-usuario",
  user_name: "Juan Pérez",
  user_role: "admin", // o "user"
  email: "juan@ejemplo.com",
  device_id: "device_abc123",
  session_id: "uuid-de-la-sesion",
  online_at: "2025-10-20T10:00:00.000Z"
}
```

### Evento de Canción (song_changed)

```javascript
{
  eventType: "song_changed",
  usuario_id: "uuid",
  session_id: "uuid",
  timestamp: 1729423200000,
  title: "Bohemian Rhapsody",
  artist: "Queen",
  channelId: "uuid-del-canal",
  channelName: "Rock Clásico",
  duration: 354
}
```

### Fila de Historial (user_activity_events)

```javascript
{
  id: "uuid",
  usuario_id: "uuid",
  session_id: "uuid",
  created_at: "2025-10-20T10:15:00.000Z",
  event_type: "song_changed",
  canal_id: "uuid",
  canal_name: "Rock Clásico",
  content_title: "Bohemian Rhapsody",
  content_artist: "Queen",
  content_duration_seconds: 354,
  event_data: { song_id: "...", playlist_id: "..." }
}
```

---

## 🚨 Detección de Logout (Limpieza Automática)

**Pregunta del equipo Ondeon:** ¿Se limpia la información cuando un usuario hace logout?

**Respuesta:** ✅ **SÍ, COMPLETAMENTE**

Cuando un usuario hace logout:

1. **Tabla `user_presence_sessions`:**
   - `status` cambia de `'active'` a `'disconnected'`
   - Se registra `ended_at` (hora del logout)
   - Se calcula `total_duration_seconds` (duración de la sesión)

2. **Tabla `user_current_state`:**
   - `is_online` cambia a `false`
   - `last_seen_at` se actualiza con la hora del logout

3. **Realtime:**
   - Se dispara evento `presence:leave`
   - El dashboard recibe el evento y puede eliminar al usuario de la UI

**Código para detectar logout en tu dashboard:**

```javascript
// Opción 1: Realtime (inmediato)
presenceChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  leftPresences.forEach(user => {
    console.log(`${user.user_name} hizo logout`)
    removeUserFromList(user.user_id)
  })
})

// Opción 2: Polling de BD (cada 30s)
setInterval(async () => {
  const { data } = await supabase
    .from('user_current_state')
    .select('*')
    .eq('is_online', false)
  
  // Actualizar lista de usuarios offline
  updateOfflineUsers(data)
}, 30000)
```

---

## 📚 Recursos Adicionales

### Documentación Completa
- **Archivo:** `SISTEMA-PRESENCIA-DASHBOARD.md` (1500+ líneas)
- **Incluye:** Todos los detalles técnicos, ejemplos avanzados, troubleshooting

### Scripts SQL (carpeta `database/`)
```
1. 001_create_presence_system.sql  → Crear tablas y vistas
2. 004_enable_realtime.sql         → Habilitar Realtime
3. 005_enable_rls.sql              → Configurar seguridad
4. 006_fix_canal_foreign_key.sql   → Correcciones FK
```

### Documentación Supabase
- Realtime: https://supabase.com/docs/guides/realtime
- JavaScript Client: https://supabase.com/docs/reference/javascript

---

## ✅ Checklist de Implementación

Usa esta lista para verificar tu progreso:

- [ ] **Setup inicial**
  - [ ] Instalado `@supabase/supabase-js`
  - [ ] Configurado cliente de Supabase
  - [ ] Obtenido credenciales (URL, anon key, usuario admin)

- [ ] **Base de datos**
  - [ ] Scripts SQL ejecutados en Supabase
  - [ ] Verificado que las 3 tablas existen
  - [ ] Realtime habilitado en las tablas
  - [ ] RLS configurado correctamente

- [ ] **Autenticación**
  - [ ] Login como admin funciona
  - [ ] Se pueden consultar datos de todos los usuarios

- [ ] **Vista "En Directo"**
  - [ ] Conectado a canal `users-presence`
  - [ ] Lista de usuarios online se actualiza en tiempo real
  - [ ] Evento `join` muestra nuevos usuarios
  - [ ] Evento `leave` elimina usuarios desconectados

- [ ] **Feed de Actividad**
  - [ ] Conectado a canal `user-events`
  - [ ] Eventos de canción se reciben y muestran
  - [ ] Eventos de canal se reciben y muestran
  - [ ] Otros eventos funcionan correctamente

- [ ] **Vista "Historial"**
  - [ ] Consulta a `user_activity_events` funciona
  - [ ] Se puede filtrar por usuario
  - [ ] Se puede filtrar por tipo de evento
  - [ ] Paginación implementada

- [ ] **Extras**
  - [ ] Estadísticas de uso (tiempo conectado, canciones reproducidas)
  - [ ] Gráficos/dashboards visuales
  - [ ] Exportación de datos
  - [ ] Notificaciones/alertas

---

## 🆘 Problemas Comunes

### "No recibo eventos de Realtime"
**Solución:** Verifica que Realtime esté habilitado en las tablas:
1. Supabase Dashboard → Database → Replication
2. Las tablas deben estar en la publication `supabase_realtime`

### "Error: row-level security policy violation"
**Solución:** No estás autenticado como admin
```javascript
await supabase.auth.signInWithPassword({
  email: 'admin@ejemplo.com',
  password: 'tu_password'
})
```

### "Los usuarios no aparecen como offline después de logout"
**Solución:** Usa Presence (`presence:leave`) en lugar de `user_current_state` para datos en tiempo real. La tabla tiene un delay de hasta 60 segundos.

---

## 📞 Contacto

**Para dudas técnicas:**
- Revisar primero: `SISTEMA-PRESENCIA-DASHBOARD.md`
- Contactar al equipo de Ondeon Frontend

**Información del sistema:**
- Base de datos: Supabase (PostgreSQL)
- Versión del sistema: 1.1
- Última actualización: 20 Oct 2025

---

## 🎉 ¡Listo para Empezar!

Con esta guía tienes todo lo básico para arrancar. Para detalles avanzados, consulta el documento completo.

**Tiempo estimado de implementación:**
- Setup básico: 2-4 horas
- Vista "En Directo": 1 día
- Vista "Historial": 1 día
- Pulido y testing: 1 día
- **Total: 2-3 días**

¡Buena suerte! 🚀

