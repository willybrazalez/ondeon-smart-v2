# 🔧 Solución: Detección Automática de Desconexiones

**Fecha:** 21 de Octubre de 2025  
**Problema:** Usuarios aparecen como "online" en el dashboard después de cerrar la app sin logout  
**Estado:** 📋 PROPUESTO - Pendiente de implementación

---

## 🐛 El Problema

Cuando un usuario cierra la app sin hacer logout:

1. ❌ El estado en `user_current_state` NO se actualiza a offline
2. ❌ El dashboard externo sigue mostrándolo como "Playing" o "Paused"
3. ❌ No hay detección automática de desconexiones (heartbeat está desactivado)
4. ✅ Solo se limpia cuando el usuario vuelve a hacer login

**Causa raíz:** El sistema de heartbeat está desactivado en `advancedPresenceService.js` (optimización para reducir egress de base de datos).

---

## ✅ Soluciones (3 opciones)

### **Opción 1: Limpieza automática basada en tiempo (SIN heartbeats) 🟢 MÁS SIMPLE**

**Ventajas:**
- ✅ No requiere cambios en la app frontend
- ✅ Muy bajo consumo de recursos
- ✅ Fácil de implementar (solo SQL)
- ✅ Se ejecuta automáticamente con pg_cron

**Desventajas:**
- ⚠️ Menos preciso (se basa en `updated_at` o cambios de estado)
- ⚠️ Puede marcar como offline a usuarios que solo pausaron la música

**Cómo funciona:**
1. CRON job se ejecuta cada 1-2 minutos
2. Busca usuarios con `is_online = true` pero sin actividad reciente (5+ minutos)
3. Los marca automáticamente como offline

**Implementación:**
```sql
-- Ver archivo: database/012_auto_cleanup_stale_users.sql
-- Ejecutar en Supabase para activar la limpieza automática
```

**Configuración recomendada:**
- Intervalo de limpieza: Cada 2 minutos
- Timeout de inactividad: 5 minutos sin actividad → marcar offline

---

### **Opción 2: Heartbeat ligero + Limpieza automática 🟡 RECOMENDADA**

**Ventajas:**
- ✅ Muy preciso (detecta desconexiones en 1-2 minutos)
- ✅ Bajo consumo (solo actualiza un timestamp, no envía datos completos)
- ✅ Compatible con la optimización de egress existente
- ✅ Funciona incluso si el usuario pausa la música

**Desventajas:**
- ⚠️ Requiere cambios en la app frontend
- ⚠️ Incrementa ligeramente el egress de BD (~50-100 MB/mes con 500 usuarios)

**Cómo funciona:**
1. La app envía un heartbeat (solo timestamp) cada 60 segundos
2. Actualiza `last_heartbeat` en `user_current_state`
3. CRON job limpia usuarios sin heartbeat en 3+ minutos

**Implementación:**

#### A) Cambios en el frontend:

```javascript
// src/services/lightweightHeartbeatService.js
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

class LightweightHeartbeatService {
  constructor() {
    this.userId = null;
    this.heartbeatInterval = null;
    this.intervalMs = 60000; // 1 minuto
  }

  /**
   * Iniciar heartbeat ligero (solo actualiza timestamp)
   */
  start(userId) {
    if (this.heartbeatInterval) {
      logger.warn('⚠️ Heartbeat ya está activo');
      return;
    }

    this.userId = userId;
    
    logger.dev('💓 Iniciando heartbeat ligero cada 60s');

    // Primer heartbeat inmediato
    this.sendHeartbeat();

    // Heartbeat periódico
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);
  }

  /**
   * Enviar heartbeat (solo actualiza timestamp, SIN leer datos)
   */
  async sendHeartbeat() {
    if (!this.userId) return;

    try {
      const { error } = await supabase
        .from('user_current_state')
        .update({ 
          last_heartbeat: new Date().toISOString()
        })
        .eq('usuario_id', this.userId);

      if (error) {
        logger.warn('⚠️ Error enviando heartbeat:', error);
      } else {
        logger.dev('💓 Heartbeat enviado');
      }
    } catch (error) {
      logger.error('❌ Error en heartbeat:', error);
    }
  }

  /**
   * Detener heartbeat
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.userId = null;
      logger.dev('🛑 Heartbeat detenido');
    }
  }
}

export default new LightweightHeartbeatService();
```

#### B) Integrar en AuthContext:

```javascript
// src/contexts/AuthContext.jsx

import lightweightHeartbeatService from '@/services/lightweightHeartbeatService';

// En la función que inicializa al usuario después del login:
useEffect(() => {
  if (user?.id) {
    // Iniciar heartbeat ligero
    lightweightHeartbeatService.start(user.id);
  }
  
  return () => {
    // Limpiar heartbeat al desmontar
    lightweightHeartbeatService.stop();
  };
}, [user?.id]);
```

#### C) Usar el script SQL del Opción 1:

```sql
-- Ejecutar: database/012_auto_cleanup_stale_users.sql
-- Con intervalo de 2 minutos y timeout de 3 minutos (más agresivo que Opción 1)
```

**Consumo estimado:**
- Heartbeats: 1 update/minuto × 500 usuarios = 500 updates/min
- Tamaño: ~100 bytes por update
- Total: ~2.1 GB/mes (aceptable si el presupuesto lo permite)

---

### **Opción 3: Heartbeat completo con Supabase Presence 🔴 MÁS COMPLEJA**

**Ventajas:**
- ✅ Detección instantánea de desconexiones
- ✅ Usa sistema nativo de Supabase (Presence API)
- ✅ No requiere CRON jobs

**Desventajas:**
- ❌ Mayor consumo de egress (~5-10 GB/mes con 500 usuarios)
- ❌ Más complejo de implementar
- ❌ Requiere reescribir el sistema de presencia

**Cómo funciona:**
1. Usar Supabase Realtime Presence API
2. Detecta automáticamente desconexiones de WebSocket
3. Actualiza estado en tiempo real

**Implementación:**
Ver documentación oficial: https://supabase.com/docs/guides/realtime/presence

**Nota:** Esta opción fue descartada previamente por alto consumo de recursos.

---

## 📊 Comparativa de Opciones

| Característica | Opción 1 (Sin heartbeat) | Opción 2 (Heartbeat ligero) | Opción 3 (Presence API) |
|----------------|--------------------------|----------------------------|------------------------|
| **Precisión** | ⚠️ Media (5-10 min) | ✅ Alta (1-3 min) | ✅✅ Muy alta (instantánea) |
| **Consumo BD** | ✅ Muy bajo | ✅ Bajo | ❌ Alto |
| **Complejidad** | ✅ Muy simple | 🟡 Media | ❌ Alta |
| **Cambios en app** | ✅ Ninguno | 🟡 Mínimos | ❌ Grandes |
| **Coste/mes** | ✅ Gratis | ✅ ~$0.50 | ❌ ~$5-10 |
| **Tiempo implementación** | ✅ 30 min | 🟡 2 horas | ❌ 1-2 días |

---

## 🎯 Recomendación

### Para tu caso (dashboard externo):

**Opción 2 (Heartbeat ligero)** es la mejor opción porque:

1. ✅ **Suficientemente precisa** para el dashboard (detecta desconexiones en 2-3 minutos)
2. ✅ **Bajo consumo** (compatible con tu presupuesto actual)
3. ✅ **Fácil de implementar** (2 horas de desarrollo)
4. ✅ **Funciona incluso con música pausada** (a diferencia de Opción 1)

### Plan de implementación:

**Fase 1: Limpieza inmediata (HOY)**
```sql
-- Ejecutar esto AHORA para limpiar usuarios zombie actuales:
SELECT * FROM cleanup_stale_user_states();
```

**Fase 2: Activar limpieza automática (HOY)**
```sql
-- Ejecutar: database/012_auto_cleanup_stale_users.sql
-- Esto previene futuros zombies (aunque con menos precisión)
```

**Fase 3: Implementar heartbeat ligero (ESTA SEMANA)**
- Crear `lightweightHeartbeatService.js`
- Integrar en `AuthContext.jsx`
- Ajustar intervalo del CRON job a 2 minutos

---

## 🧪 Testing

### Probar Opción 1 (Sin heartbeat):

1. Hacer login en la app
2. Esperar 6 minutos sin hacer nada
3. Verificar en el dashboard → Debería aparecer como offline

### Probar Opción 2 (Con heartbeat):

1. Hacer login en la app
2. Verificar en BD que `last_heartbeat` se actualiza cada 60s:
```sql
SELECT usuario_id, last_heartbeat, NOW() - last_heartbeat as tiempo_desde_ultimo
FROM user_current_state 
WHERE usuario_id = 'TU_USER_ID';
```
3. Cerrar la app abruptamente
4. Esperar 3 minutos
5. Verificar en el dashboard → Debería aparecer como offline

---

## 📝 Archivos Creados

1. `database/012_auto_cleanup_stale_users.sql` - Script de limpieza automática
2. `SOLUCION-DETECCION-DESCONEXIONES.md` - Este documento
3. (Pendiente) `src/services/lightweightHeartbeatService.js` - Si eliges Opción 2

---

## ❓ Preguntas Frecuentes

### ¿Por qué no usar window.beforeunload?

`beforeunload` NO es confiable:
- ❌ No funciona en apps Electron al cerrar forzadamente
- ❌ No funciona si el proceso se mata
- ❌ No funciona si se pierde la red

### ¿Los heartbeats afectan el rendimiento?

No significativamente:
- Solo 1 update SQL/minuto por usuario
- No se leen datos (solo se escribe timestamp)
- Consumo: ~100 bytes/heartbeat = 2.1 GB/mes con 500 usuarios

### ¿Qué pasa si el usuario pausa la música?

- **Opción 1:** Puede ser marcado como offline después de 5 minutos (depende de si hay otros eventos)
- **Opción 2:** Sigue enviando heartbeats, NO se marca como offline ✅

### ¿Puedo combinar ambas opciones?

Sí, de hecho es lo recomendado:
1. Implementar Opción 1 HOY (solución temporal)
2. Implementar Opción 2 esta semana (solución permanente)
3. Mantener ambas activas como redundancia

---

## 🚀 Siguientes Pasos

1. ✅ Ejecutar `012_auto_cleanup_stale_users.sql` en Supabase
2. ⏳ Decidir si implementar heartbeat ligero (Opción 2)
3. ⏳ Testear en producción con usuarios reales
4. ⏳ Monitorear consumo de egress durante 1 semana
5. ⏳ Ajustar intervalos según sea necesario

---

## 📞 Soporte

Si necesitas ayuda con la implementación:
- Revisar logs en la app: `logger.dev('💓 Heartbeat...')`
- Verificar CRON jobs: `SELECT * FROM cron.job;`
- Monitorear consumo: Supabase Dashboard → Settings → Usage

---

**Actualizado:** 21 de Octubre de 2025  
**Versión:** 1.0







