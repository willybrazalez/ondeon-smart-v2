# 🚀 Guía Rápida: Activar Limpieza Automática de Usuarios Zombie

**Tiempo:** 5 minutos  
**Objetivo:** Detectar y marcar como offline a usuarios que cerraron la app sin logout

---

## 📋 Pasos de Ejecución

### **Paso 1: Ejecutar script principal (3 minutos)**

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Crea una nueva query
3. Copia y pega **TODO** el contenido de: `database/012_auto_cleanup_stale_users.sql`
4. Click en **Run** (o Ctrl/Cmd + Enter)

✅ **Resultado esperado:**
- Se añade columna `last_heartbeat` a `user_current_state`
- Se crea función `cleanup_stale_user_states()`
- Se crea índice para optimización
- Se ejecuta una limpieza manual inicial

📊 **Verás algo como:**
```
usuarios_marcados_offline: 3
usuarios_afectados: {uuid1, uuid2, uuid3}
```

---

### **Paso 2: Habilitar extensión pg_cron (1 minuto)**

1. En Supabase, ve a: **Database** → **Extensions**
2. Busca `pg_cron`
3. Click en **Enable** (Habilitar)

✅ **Verificar:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```
Debe retornar 1 fila.

---

### **Paso 3: Activar CRON Job (1 minuto)**

1. Ve a **SQL Editor** → Nueva query
2. Copia y pega **SOLO ESTAS 4 LÍNEAS** de `database/012b_activar_cron_limpieza.sql`:

```sql
SELECT cron.schedule(
  'cleanup-stale-users',
  '*/2 * * * *',
  $$SELECT cleanup_stale_user_states();$$
);
```

3. Click en **Run**

✅ **Verificar:**
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-users';
```
Debe retornar 1 fila con `active = true`.

---

## ✅ Verificación Final

### Ver usuarios que se limpiarán:

```sql
SELECT 
  usuario_id,
  is_online,
  playback_state,
  last_heartbeat,
  NOW() - last_heartbeat as tiempo_sin_heartbeat,
  CASE 
    WHEN last_heartbeat < (NOW() - INTERVAL '5 minutes') THEN '❌ Se marcará offline'
    WHEN last_heartbeat IS NULL THEN '❌ Sin heartbeat'
    ELSE '✅ Activo'
  END as estado
FROM user_current_state
WHERE is_online = true
ORDER BY last_heartbeat ASC NULLS FIRST;
```

### Ver si el CRON está funcionando:

Espera 2-3 minutos y ejecuta:

```sql
SELECT 
  status,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-stale-users')
ORDER BY start_time DESC 
LIMIT 5;
```

Deberías ver ejecuciones con `status = 'succeeded'`.

---

## 🧪 Probar que Funciona

### Test 1: Limpiar usuarios actuales

1. Ejecuta:
```sql
SELECT * FROM cleanup_stale_user_states();
```

2. Verifica en tu dashboard externo que ya no aparecen usuarios zombie

### Test 2: Simular un cierre abrupto

1. Haz login en la app
2. Espera 1 minuto
3. Cierra la app SIN hacer logout
4. Espera 6 minutos
5. Verifica en el dashboard → El usuario debe aparecer como offline

---

## 📊 Monitoreo Continuo

### Query diaria recomendada:

```sql
SELECT 
  COUNT(*) FILTER (WHERE is_online = true) as online,
  COUNT(*) FILTER (WHERE is_online = false) as offline,
  COUNT(*) FILTER (
    WHERE is_online = true 
    AND last_heartbeat < (NOW() - INTERVAL '5 minutes')
  ) as zombies_pendientes
FROM user_current_state;
```

**Resultado esperado:**
- `zombies_pendientes = 0` (o muy pocos)

---

## ❌ Troubleshooting

### Si el script principal falla:

**Error:** "column last_heartbeat already exists"
- ✅ Ignorar, significa que ya se ejecutó antes

**Error:** "function cleanup_stale_user_states already exists"
- ✅ Ejecutar primero: `DROP FUNCTION IF EXISTS cleanup_stale_user_states;`

### Si el CRON no funciona:

**Error:** "extension pg_cron does not exist"
- ❌ Falta habilitar pg_cron (ver Paso 2)

**Error:** "job already exists"
- ✅ Ejecutar primero: `SELECT cron.unschedule('cleanup-stale-users');`

### Si los usuarios no se marcan offline:

1. Ejecutar manualmente:
```sql
SELECT * FROM cleanup_stale_user_states();
```

2. Si retorna 0 usuarios, verificar:
```sql
-- Ver si hay usuarios zombie
SELECT COUNT(*) 
FROM user_current_state 
WHERE is_online = true 
AND (
  last_heartbeat < (NOW() - INTERVAL '5 minutes')
  OR last_heartbeat IS NULL
);
```

3. Si hay usuarios zombie pero no se limpian:
   - Verificar permisos RLS en `user_current_state`
   - Verificar que el CRON job se está ejecutando
   - Ver logs de errores en `cron.job_run_details`

---

## 🔄 Siguiente Paso (Opcional)

Si quieres **más precisión** (detectar desconexiones en 2-3 min en lugar de 5-10 min):

👉 Implementar **Opción 2** del documento `SOLUCION-DETECCION-DESCONEXIONES.md`

Esto añade heartbeats ligeros desde la app que actualizan `last_heartbeat` cada 60 segundos.

---

## 📁 Archivos Relevantes

- ✅ `database/012_auto_cleanup_stale_users.sql` - Script principal
- ✅ `database/012b_activar_cron_limpieza.sql` - Activar CRON
- 📖 `SOLUCION-DETECCION-DESCONEXIONES.md` - Documentación completa
- 📖 `INTEGRACION-HEARTBEAT-LIGERO.md` - Guía para Opción 2

---

## ⏱️ Resumen de Tiempos

| Escenario | Antes | Después | Mejora |
|-----------|-------|---------|--------|
| Usuario cierra app | ♾️ Queda online forever | 5-10 min → offline | ✅ |
| Pérdida de conexión | ♾️ Queda online forever | 5-10 min → offline | ✅ |
| Logout explícito | ✅ Inmediato | ✅ Inmediato | - |

Con **Opción 2** (heartbeats):
- Todos los escenarios: **2-3 min** → offline ⚡

---

**Última actualización:** 21 de Octubre de 2025







