# 🔌 Integración del Heartbeat Ligero

**Para implementar:** Opción 2 del documento `SOLUCION-DETECCION-DESCONEXIONES.md`  
**Tiempo estimado:** 30 minutos  
**Impacto:** Detección de desconexiones en 2-3 minutos

---

## 📋 Checklist de Implementación

- [ ] 1. Ejecutar script SQL `012_auto_cleanup_stale_users.sql` en Supabase
- [ ] 2. Verificar que la columna `last_heartbeat` existe en `user_current_state`
- [ ] 3. Integrar heartbeat en `AuthContext.jsx`
- [ ] 4. Probar con un usuario real
- [ ] 5. Activar CRON job en Supabase
- [ ] 6. Monitorear consumo durante 24 horas

---

## 🔧 Paso 1: Ejecutar Script SQL

### En Supabase Dashboard:

1. Ve a: **SQL Editor** → New Query
2. Pega el contenido de `database/012_auto_cleanup_stale_users.sql`
3. Ejecuta el script completo
4. Verifica que se creó el índice y la función:

```sql
-- Verificar función
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'cleanup_stale_user_states';

-- Verificar columna last_heartbeat
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_current_state' 
AND column_name = 'last_heartbeat';
```

Resultado esperado:
```
✅ routine_name: cleanup_stale_user_states
✅ column_name: last_heartbeat | data_type: timestamp with time zone
```

---

## 🔧 Paso 2: Integrar en AuthContext

### Archivo: `src/contexts/AuthContext.jsx`

#### A) Importar el servicio al inicio del archivo:

```javascript
// Al inicio del archivo, después de otros imports
import lightweightHeartbeatService from '@/services/lightweightHeartbeatService';
```

#### B) Iniciar heartbeat cuando el usuario se autentica

Busca la línea donde se inicia `optimizedPresenceService` (alrededor de la línea 300-400):

```javascript
// ANTES (código existente):
await optimizedPresenceService.startPresence(userId, userProfile);

// DESPUÉS (añadir estas líneas justo después):
await optimizedPresenceService.startPresence(userId, userProfile);

// 💓 Iniciar heartbeat ligero para detección de desconexiones
lightweightHeartbeatService.start(userId);
logger.dev('💓 Heartbeat ligero iniciado');
```

#### C) Detener heartbeat en el logout

Busca la función `signOut` (alrededor de la línea 400-500):

```javascript
// En la función signOut, ANTES de limpiar estados:

const signOut = async () => {
  try {
    logger.dev('🚪 Cerrando sesión...');
    
    // 🛑 Detener heartbeat ligero
    lightweightHeartbeatService.stop();
    logger.dev('🛑 Heartbeat ligero detenido');
    
    // ... resto del código de signOut
  } catch (error) {
    // ...
  }
}
```

#### D) Limpiar heartbeat al desmontar el componente

Busca el `useEffect` de limpieza (si existe) o añade uno nuevo:

```javascript
// Añadir este useEffect cerca del final del componente, antes del return:

useEffect(() => {
  // Cleanup al desmontar el contexto
  return () => {
    if (lightweightHeartbeatService.isRunning()) {
      logger.dev('🧹 Limpiando heartbeat en unmount');
      lightweightHeartbeatService.stop();
    }
  };
}, []);
```

---

## 🔧 Paso 3: (Opcional) Integrar en App.jsx como Fallback

Si quieres asegurarte de que el heartbeat se detiene al cerrar la app:

### Archivo: `src/App.jsx`

Busca la función `handleLogout` y añade:

```javascript
const handleLogout = async () => {
  try {
    logger.dev('🚪 Iniciando proceso de logout...');
    
    // 🔧 CRÍTICO: Detener heartbeat ligero
    try {
      if (window.lightweightHeartbeat?.isRunning()) {
        window.lightweightHeartbeat.stop();
        logger.dev('🛑 Heartbeat ligero detenido');
      }
    } catch (e) {
      logger.warn('⚠️ Error deteniendo heartbeat:', e);
    }
    
    // ... resto del código de logout
  } catch (error) {
    // ...
  }
};
```

---

## 🔧 Paso 4: Activar CRON Job en Supabase

### Opción A: Usando pg_cron (Recomendado)

1. Ve a: **Database** → **Extensions**
2. Busca `pg_cron` y actívala
3. En **SQL Editor**, ejecuta:

```sql
-- Programar limpieza cada 2 minutos
SELECT cron.schedule(
  'cleanup-stale-users',
  '*/2 * * * *',
  $$SELECT cleanup_stale_user_states();$$
);
```

4. Verificar que se creó:

```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-users';
```

### Opción B: Usando Supabase Edge Functions (Alternativa)

Si `pg_cron` no está disponible, puedes usar Edge Functions con un cron externo (como GitHub Actions o Vercel Cron).

---

## 🧪 Testing

### Test 1: Verificar que el heartbeat se envía

1. Hacer login en la app
2. Abrir consola del navegador
3. Buscar logs: `💓 Heartbeat OK`
4. Verificar en Supabase:

```sql
SELECT 
  usuario_id,
  is_online,
  last_heartbeat,
  NOW() - last_heartbeat as segundos_desde_ultimo
FROM user_current_state
WHERE usuario_id = 'TU_USER_ID';
```

Resultado esperado:
```
✅ is_online: true
✅ last_heartbeat: actualizado en los últimos 60 segundos
```

### Test 2: Verificar detección de desconexión

1. Hacer login en la app
2. Esperar 1 minuto (para que haya al menos 1 heartbeat)
3. **Cerrar la app abruptamente** (sin hacer logout)
4. Esperar 3-4 minutos
5. Verificar en Supabase:

```sql
SELECT 
  usuario_id,
  is_online,
  last_heartbeat,
  NOW() - last_heartbeat as segundos_sin_heartbeat
FROM user_current_state
WHERE usuario_id = 'TU_USER_ID';
```

Resultado esperado:
```
✅ is_online: false (marcado offline por el CRON job)
✅ playback_state: null (limpiado)
```

### Test 3: Verificar en el dashboard externo

1. Hacer login en la app
2. Verificar que apareces como "Playing" en el dashboard
3. Cerrar la app sin logout
4. Esperar 3-4 minutos
5. Recargar el dashboard
6. Verificar que YA NO apareces (o apareces como "Offline")

---

## 📊 Monitoreo

### Query 1: Ver heartbeats en tiempo real

```sql
SELECT 
  usuario_id,
  is_online,
  playback_state,
  last_heartbeat,
  NOW() - last_heartbeat as tiempo_ultimo_heartbeat,
  CASE 
    WHEN last_heartbeat > (NOW() - INTERVAL '2 minutes') THEN '🟢 Activo'
    WHEN last_heartbeat > (NOW() - INTERVAL '5 minutes') THEN '🟡 Inactivo pronto'
    ELSE '🔴 Debería estar offline'
  END as estado_heartbeat
FROM user_current_state
WHERE is_online = true
ORDER BY last_heartbeat DESC;
```

### Query 2: Verificar ejecuciones del CRON job

```sql
-- Si usas pg_cron:
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-stale-users')
ORDER BY start_time DESC 
LIMIT 10;
```

### Query 3: Estadísticas generales

```sql
SELECT 
  COUNT(*) FILTER (WHERE is_online = true) as usuarios_online,
  COUNT(*) FILTER (WHERE is_online = false) as usuarios_offline,
  COUNT(*) FILTER (
    WHERE is_online = true 
    AND last_heartbeat < (NOW() - INTERVAL '3 minutes')
  ) as usuarios_zombie_pendientes,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_heartbeat))) FILTER (WHERE is_online = true) as promedio_segundos_ultimo_heartbeat
FROM user_current_state;
```

---

## 🐛 Troubleshooting

### Problema: Los heartbeats no se envían

**Síntoma:** No ves logs `💓 Heartbeat OK` en la consola

**Solución:**
1. Verificar que se importó correctamente el servicio
2. Verificar que `lightweightHeartbeatService.start(userId)` se llamó
3. Revisar consola por errores de Supabase (permisos RLS)

```javascript
// En consola del navegador:
window.lightweightHeartbeat.getStats()
// Debería mostrar: { isActive: true, userId: '...', ... }
```

### Problema: Los usuarios no se marcan como offline

**Síntoma:** Usuarios siguen apareciendo como online después de cerrar la app

**Solución:**
1. Verificar que el CRON job está activo:
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-users';
```

2. Ejecutar la función manualmente para testing:
```sql
SELECT * FROM cleanup_stale_user_states();
```

3. Verificar que hay usuarios que deberían marcarse offline:
```sql
SELECT COUNT(*) 
FROM user_current_state 
WHERE is_online = true 
AND last_heartbeat < (NOW() - INTERVAL '3 minutes');
```

### Problema: Consumo de BD muy alto

**Síntoma:** El egress aumentó significativamente

**Solución:**
1. Aumentar el intervalo de heartbeat:
```javascript
// En consola del navegador:
window.lightweightHeartbeat.setInterval(120000); // 2 minutos en lugar de 1
```

2. Verificar que el CRON job no se ejecuta muy frecuentemente:
```sql
-- Cambiar a cada 5 minutos en lugar de cada 2:
SELECT cron.schedule(
  'cleanup-stale-users',
  '*/5 * * * *',
  $$SELECT cleanup_stale_user_states();$$
);
```

---

## 🔄 Rollback (Si necesitas desactivar)

### Desactivar heartbeats:

```javascript
// En src/contexts/AuthContext.jsx
// Comentar o eliminar estas líneas:
// lightweightHeartbeatService.start(userId);
// lightweightHeartbeatService.stop();
```

### Desactivar CRON job:

```sql
SELECT cron.unschedule('cleanup-stale-users');
```

### Eliminar columna last_heartbeat (opcional):

```sql
ALTER TABLE user_current_state DROP COLUMN last_heartbeat;
```

---

## 📈 Métricas Esperadas

### Consumo de recursos:

| Métrica | Sin heartbeat | Con heartbeat | Incremento |
|---------|---------------|---------------|------------|
| **Egress BD/mes** | ~5 GB | ~7 GB | +2 GB (+40%) |
| **Queries/min** | ~50 | ~550 | +500 |
| **Latencia detección** | 5-10 min | 2-3 min | ✅ Mejor |
| **Falsos positivos** | Alta | Baja | ✅ Mejor |

### Precisión de detección:

| Escenario | Sin heartbeat | Con heartbeat |
|-----------|---------------|---------------|
| **Cierre abrupto app** | ❌ 10 min | ✅ 3 min |
| **Pérdida de conexión** | ❌ No detecta | ✅ 3 min |
| **Usuario pausó música** | ⚠️ 5-10 min | ✅ Sigue online |
| **Logout explícito** | ✅ Inmediato | ✅ Inmediato |

---

## 📝 Archivos Modificados

- ✅ `src/services/lightweightHeartbeatService.js` (nuevo)
- ✅ `database/012_auto_cleanup_stale_users.sql` (nuevo)
- ⏳ `src/contexts/AuthContext.jsx` (modificar)
- ⏳ `src/App.jsx` (opcional, modificar)

---

## ✅ Verificación Final

Antes de dar por terminada la implementación, verifica:

- [ ] Heartbeats se envían cada 60 segundos
- [ ] Usuarios offline se detectan en 3-4 minutos
- [ ] Dashboard externo muestra estados correctos
- [ ] No hay errores en consola del navegador
- [ ] Consumo de BD dentro del presupuesto
- [ ] CRON job se ejecuta correctamente

---

**¿Necesitas ayuda?** Revisa los logs:
```javascript
// Consola del navegador:
window.lightweightHeartbeat.getStats()
```

**Última actualización:** 21 de Octubre de 2025  
**Versión:** 1.0







