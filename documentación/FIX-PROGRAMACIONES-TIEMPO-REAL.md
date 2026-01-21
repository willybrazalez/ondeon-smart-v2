# 🔧 FIX: Reconexión Automática del Canal de Programaciones

**Fecha:** 24 de octubre de 2025  
**Problema:** Programaciones no se detectan en tiempo real después de estar en segundo plano por horas

---

## 🎯 **Problema Identificado**

### Síntomas

Después de **5h 38m de sesión en segundo plano**, el usuario reportó:

✅ **Heartbeat funcionando** (usuario aparecía como "en línea")  
❌ **Programaciones NO se detectaron** en tiempo real  
❌ **Canal de Realtime desconectado** sin reconectarse

### Causa Raíz

El `scheduledContentService` tenía reconexión automática **limitada**:
- Solo **5 intentos** de reconexión (ahora **10**)
- Flag `isReconnecting` se quedaba **bloqueado** después de errores
- No se reseteaba correctamente tras reconexión exitosa

### Comparación con Local vs Desarrollo

| Entorno | Resultado | Canal Realtime |
|---------|-----------|----------------|
| **LOCAL** | ✅ Programación ejecutada correctamente | ✅ Conectado |
| **DESARROLLO** | ❌ Programación NO ejecutada | ❌ Desconectado |

**Logs de Desarrollo:**
```
❌ Error conectando canal de presencia: CHANNEL_ERROR
❌ Error conectando canal de eventos: CHANNEL_ERROR
net::ERR_CONNECTION_CLOSED
```

---

## 💡 **Solución Implementada**

### Mejoras en `scheduledContentService.js`

#### 1. **Aumentar Reintentos de Reconexión**
```javascript
// ANTES
this.maxReconnectAttempts = 5;

// AHORA
this.maxReconnectAttempts = 10; // Duplicado para mayor resiliencia
```

#### 2. **Agregar Timer de Reconexión Limpiable**
```javascript
this.reconnectTimer = null; // NUEVO: Timer para limpieza controlada
```

**Beneficios:**
- Se puede cancelar reconexiones pendientes al detener el servicio
- Evita memory leaks

#### 3. **Resetear Flag `isReconnecting` en Errores**
```javascript
try {
  // ... intentar reconexión ...
} catch (error) {
  logger.error('❌ Error en reconexión...', error);
  
  // 🔧 CRÍTICO: Resetear flag para permitir próximo intento
  this.isReconnecting = false;
  
  if (this.reconnectAttempts < this.maxReconnectAttempts) {
    this.intentarReconexionRealtime(); // Nuevo intento
  } else {
    this.resetReconnection(); // Resetear todo
  }
}
```

**Antes:** Si fallaba la reconexión, el flag quedaba en `true` → bloqueaba futuros intentos  
**Ahora:** Se resetea inmediatamente → permite reintentar

#### 4. **Nuevo Método `resetReconnection()`**
```javascript
resetReconnection() {
  this.isReconnecting = false;
  this.reconnectAttempts = 0;
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
```

**Usado en:**
- ✅ Reconexión exitosa (`SUBSCRIBED`)
- ❌ Máximo de intentos alcanzado
- 🛑 Detención del servicio

#### 5. **Mejorar Logs de Reconexión**
```javascript
// Logs más descriptivos para debugging
logger.dev(`🔄 Reconectando canal de programaciones en ${delay/1000}s (intento #${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
logger.error('❌ Error en canal de programaciones - iniciando reconexión automática');
logger.warn('⚠️ Canal de programaciones cerrado - iniciando reconexión automática');
```

#### 6. **Limpieza en `detener()`**
```javascript
detener() {
  // ... código existente ...
  
  // 🔧 NUEVO: Detener timer de reconexión
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  
  // ... limpiar realtime ...
  
  this.reconnectAttempts = 0;
  this.isReconnecting = false; // 🔧 NUEVO: Resetear flag
}
```

---

## 🔄 **Flujo de Reconexión (Mejorado)**

```
┌─────────────────────────────────────────────────────────┐
│ 1. Canal desconectado (CHANNEL_ERROR / CLOSED)         │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Verificar: ¿isReconnecting ya activo?               │
│    NO → Continuar    SÍ → Ignorar (evitar paralelismo) │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ 3. isReconnecting = true                                 │
│    reconnectAttempts++                                   │
│    Calcular delay con backoff exponencial (1s → 60s)   │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ 4. reconnectTimer = setTimeout(...)                      │
│    Esperar delay antes de reconectar                    │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Intentar reconexión:                                  │
│    a) limpiarRealtime()                                 │
│    b) await sleep(1s)                                   │
│    c) configurarRealtime()                              │
└──────────────────────┬──────────────────────────────────┘
                       ↓
              ┌────────┴────────┐
              ↓                 ↓
    ┌─────────────────┐   ┌──────────────────┐
    │ 6a. ÉXITO       │   │ 6b. ERROR        │
    │ (SUBSCRIBED)    │   │                  │
    └────────┬────────┘   └──────┬───────────┘
             ↓                    ↓
    ┌─────────────────┐   ┌──────────────────┐
    │ resetReconnection│   │ isReconnecting =│
    │ - flag = false  │   │ false           │
    │ - attempts = 0  │   │                  │
    │ - timer cleared │   │ intentos < max? │
    └─────────────────┘   └──────┬───────────┘
                                  ↓
                          ┌──────────────────┐
                          │ SÍ → Reintentar  │
                          │ NO → Resetear    │
                          └──────────────────┘
```

---

## ✅ **Resultado Esperado**

### Antes (❌)
- Sesión de 5h → Canal desconectado
- **NO se reconecta automáticamente**
- Programaciones no se ejecutan (aunque estén programadas)
- Usuario parece "en línea" pero sistema no funciona

### Después (✅)
- Sesión de 5h → Canal desconectado
- **Se reconecta automáticamente** (hasta 10 intentos)
- Programaciones se ejecutan correctamente
- Sistema completamente funcional en segundo plano

---

## 🔧 **Similitudes con Otros Servicios**

Esta mejora **alinea** `scheduledContentService` con:

### 1. `lightweightHeartbeatService`
- ✅ Reconexión con backoff exponencial
- ✅ Reseteo de flag `isReconnecting` en errores
- ✅ Método `resetReconnection()`

### 2. `optimizedPresenceService`
- ✅ Reconexión robusta de canales Realtime
- ✅ Manejo de `CHANNEL_ERROR` y `CLOSED`
- ✅ Logs descriptivos

---

## 📊 **Impacto en Escalabilidad**

### Tráfico de Red
- **No aumenta** (solo reconexiones tras interrupciones)
- Backoff exponencial evita saturar servidor (1s → 60s)

### Estabilidad
- **Mejora significativa** para sesiones largas (horas/días)
- Garantiza que programaciones se ejecuten incluso tras interrupciones de red

### Experiencia del Usuario
- **Sin intervención manual** requerida
- Sistema se auto-recupera silenciosamente

---

## 🧪 **Cómo Probar**

### Escenario de Prueba 1: Sesión Larga
1. Iniciar sesión con programación activa
2. Dejar app en segundo plano por **2-3 horas**
3. Verificar logs: `📡 Estado del canal de programaciones: SUBSCRIBED`
4. Confirmar que programación se ejecuta a la hora programada

### Escenario de Prueba 2: Pérdida de Red
1. Iniciar sesión con programación activa
2. Desconectar red WiFi por **2 minutos**
3. Reconectar red
4. Verificar logs: `🔄 Reconectando canal de programaciones...`
5. Confirmar reconexión exitosa: `✅ Sincronización en tiempo real de programaciones activada`

### Logs a Buscar (Éxito)
```
💓 Heartbeat OK - last_seen_at actualizado
🔄 Reconectando canal de programaciones en Xs (intento #Y/10)...
🔌 Intento de reconexión #Y/10...
📡 Estado del canal de programaciones: SUBSCRIBED
✅ Sincronización en tiempo real de programaciones activada
```

---

## 📚 **Archivos Modificados**

| Archivo | Cambios |
|---------|---------|
| `src/services/scheduledContentService.js` | - Aumentar `maxReconnectAttempts` a 10<br>- Agregar `reconnectTimer` y limpieza<br>- Nuevo método `resetReconnection()`<br>- Resetear `isReconnecting` en errores<br>- Mejorar logs de reconexión |

---

## 🎓 **Lecciones Aprendidas**

### 1. **Flags de Bloqueo Requieren Limpieza en TODOS los Caminos**
- ✅ Éxito → Resetear
- ❌ Error → Resetear
- 🛑 Detener → Resetear

### 2. **Reconexión Automática es Crítica para Apps de Larga Duración**
- No asumir que la conexión se mantendrá por horas
- Los navegadores pueden pausar/suspender timers en segundo plano
- Los canales de Realtime pueden desconectarse silenciosamente

### 3. **Logs Descriptivos Facilitan Debugging**
- Indicar **qué** canal se está reconectando
- Indicar **cuántos** intentos van/quedan
- Distinguir entre **errores temporales** y **permanentes**

---

## 🔗 **Documentos Relacionados**

- `FIX-RECONEXION-CANALES-REALTIME.md` - Fix de reconexión para `optimizedPresenceService`
- `MEJORAS-SESIONES-LARGAS.md` - Análisis completo de sesiones largas
- `INFORME-OPTIMIZACION-EGRESS.md` - Optimizaciones de tráfico de red

---

**Implementado por:** Claude Sonnet 4.5  
**Revisado:** ✅  
**Testeado:** ⏳ Pendiente (próxima sesión larga)




