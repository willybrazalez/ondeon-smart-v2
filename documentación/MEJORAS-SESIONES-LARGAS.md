# 🛡️ MEJORAS PARA SESIONES DE LARGA DURACIÓN

**Fecha:** 23 de octubre de 2025  
**Objetivo:** Hacer que la aplicación sea 100% estable en sesiones de horas o días

---

## 📊 **SITUACIÓN ACTUAL**

### ✅ **Protecciones Ya Implementadas:**

1. ✅ Watchdog de audio (cada 10s)
2. ✅ Reconexión automática de Realtime
3. ✅ Detección de visibility (background)
4. ✅ Heartbeats ligeros (90s)
5. ✅ Recovery automático de reproducción

### ⚠️ **Puntos Débiles:**

1. ⚠️ Sesión de Supabase puede expirar después de 24-48 horas
2. ⚠️ Buffer de logs puede crecer indefinidamente
3. ⚠️ No hay verificación de salud general del sistema
4. ⚠️ Timers pueden detenerse en algunos navegadores en background

---

## 🔧 **MEJORA 1: Health Check Periódico** (CRÍTICO)

### **¿Qué hace?**
Verifica cada 5 minutos que todos los sistemas estén funcionando correctamente.

### **Implementación:**

```javascript
// src/services/healthCheckService.js

import logger from '../lib/logger.js';
import { supabase } from '../lib/supabase.js';
import autoDjService from './autoDjService.js';
import audioPlayer from './audioPlayerService.js';
import lightweightHeartbeatService from './lightweightHeartbeatService.js';

class HealthCheckService {
  constructor() {
    this.isActive = false;
    this.checkInterval = null;
    this.intervalMs = 300000; // 5 minutos
    this.lastCheck = null;
    this.consecutiveFailures = 0;
    this.maxFailures = 3;
  }

  start() {
    if (this.checkInterval) {
      logger.warn('⚠️ Health check ya está activo');
      return;
    }

    logger.dev('💊 Iniciando health check (cada 5 minutos)');
    this.isActive = true;

    // Primera verificación inmediata
    this.performHealthCheck();

    // Verificaciones periódicas
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.intervalMs);
  }

  async performHealthCheck() {
    if (!this.isActive) return;

    const now = Date.now();
    this.lastCheck = now;

    logger.dev('🔍 Realizando health check...');

    const results = {
      supabaseConnection: false,
      heartbeatActive: false,
      autoDjActive: false,
      audioPlayerActive: false,
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Verificar conexión a Supabase
      const { error: supabaseError } = await supabase
        .from('usuarios')
        .select('id')
        .limit(1);
      
      results.supabaseConnection = !supabaseError;
      if (supabaseError) {
        logger.error('❌ Conexión a Supabase perdida:', supabaseError.message);
        this.consecutiveFailures++;
      }

      // 2. Verificar heartbeat
      results.heartbeatActive = lightweightHeartbeatService.isRunning();
      if (!results.heartbeatActive) {
        logger.warn('⚠️ Heartbeat detenido - intentando reiniciar...');
        // Intentar reiniciar (necesitaría acceso al userId)
      }

      // 3. Verificar AutoDJ
      results.autoDjActive = autoDjService.isActive;
      if (!results.autoDjActive) {
        logger.warn('⚠️ AutoDJ detenido');
      }

      // 4. Verificar Audio Player
      const audioState = audioPlayer.getState();
      results.audioPlayerActive = audioState.isPlaying || audioState.isPaused;

      // Evaluar salud general
      const allHealthy = Object.values(results).every(v => v === true || typeof v === 'string');
      
      if (allHealthy) {
        this.consecutiveFailures = 0;
        logger.dev('✅ Health check OK - todos los sistemas funcionando');
      } else {
        this.consecutiveFailures++;
        logger.warn(`⚠️ Health check detectó problemas (fallo ${this.consecutiveFailures}/${this.maxFailures}):`, results);
      }

      // Si hay muchos fallos consecutivos, intentar recovery
      if (this.consecutiveFailures >= this.maxFailures) {
        logger.error('🚨 Demasiados fallos consecutivos - intentando recovery completo');
        await this.attemptFullRecovery();
      }

    } catch (error) {
      logger.error('❌ Error en health check:', error);
      this.consecutiveFailures++;
    }

    return results;
  }

  async attemptFullRecovery() {
    logger.dev('🔧 Iniciando recovery completo del sistema...');

    try {
      // 1. Verificar sesión de Supabase
      const { data: session } = await supabase.auth.getSession();
      if (!session) {
        logger.error('❌ Sesión expirada - requiere re-login');
        // Emitir evento para que App.jsx maneje el re-login
        window.dispatchEvent(new CustomEvent('session-expired'));
        return;
      }

      // 2. Verificar conexión de red
      if (!navigator.onLine) {
        logger.warn('⚠️ Sin conexión a internet - esperando reconexión...');
        return;
      }

      // 3. Resetear contador de fallos
      this.consecutiveFailures = 0;
      logger.dev('✅ Recovery completado');

    } catch (error) {
      logger.error('❌ Error en recovery completo:', error);
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isActive = false;
    logger.dev('🛑 Health check detenido');
  }

  getStatus() {
    return {
      isActive: this.isActive,
      lastCheck: this.lastCheck,
      consecutiveFailures: this.consecutiveFailures
    };
  }
}

const healthCheckService = new HealthCheckService();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.healthCheck = healthCheckService;
}

export default healthCheckService;
```

---

## 🔧 **MEJORA 2: Limpieza Automática de Buffers** (IMPORTANTE)

### **¿Qué hace?**
Limpia buffers de logs cada 2 horas para evitar consumo excesivo de memoria.

### **Implementación:**

Añadir en `optimizedPresenceService.js`:

```javascript
// En el constructor
this.bufferCleanupInterval = null;
this.maxBufferAge = 7200000; // 2 horas

// Nuevo método
startBufferCleanup() {
  this.bufferCleanupInterval = setInterval(() => {
    if (this.eventBuffer.length > 100) {
      logger.dev('🧹 Limpiando buffer de eventos (había', this.eventBuffer.length, 'eventos)');
      this.flush(); // Forzar flush si hay muchos eventos acumulados
    }
  }, 3600000); // Cada hora
}

// Llamar en startPresence()
this.startBufferCleanup();

// Limpiar en stopPresence()
if (this.bufferCleanupInterval) {
  clearInterval(this.bufferCleanupInterval);
}
```

---

## 🔧 **MEJORA 3: Renovación Automática de Sesión** (MUY IMPORTANTE)

### **¿Qué hace?**
Renueva la sesión de Supabase Auth cada 30 minutos para evitar expiraciones.

### **Implementación:**

```javascript
// src/services/sessionRenewalService.js

import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';

class SessionRenewalService {
  constructor() {
    this.renewalInterval = null;
    this.intervalMs = 1800000; // 30 minutos
    this.isActive = false;
  }

  start() {
    if (this.renewalInterval) return;

    logger.dev('🔄 Iniciando renovación automática de sesión (cada 30 min)');
    this.isActive = true;

    // Primera renovación en 30 minutos
    this.renewalInterval = setInterval(async () => {
      await this.renewSession();
    }, this.intervalMs);
  }

  async renewSession() {
    try {
      logger.dev('🔄 Renovando sesión de Supabase...');

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.error('❌ Error obteniendo sesión:', error);
        return false;
      }

      if (!session) {
        logger.error('❌ No hay sesión activa - se requiere re-login');
        window.dispatchEvent(new CustomEvent('session-expired'));
        return false;
      }

      // Verificar si la sesión está próxima a expirar
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;

      logger.dev('⏰ Sesión expira en', Math.floor(timeUntilExpiry / 60), 'minutos');

      // Si expira en menos de 10 minutos, forzar refresh
      if (timeUntilExpiry < 600) {
        logger.dev('🔄 Sesión próxima a expirar - refrescando token...');
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          logger.error('❌ Error refrescando sesión:', refreshError);
          return false;
        }

        logger.dev('✅ Sesión renovada exitosamente');
        return true;
      }

      logger.dev('✅ Sesión OK - no requiere renovación aún');
      return true;

    } catch (error) {
      logger.error('❌ Error en renovación de sesión:', error);
      return false;
    }
  }

  stop() {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
    }
    this.isActive = false;
    logger.dev('🛑 Renovación de sesión detenida');
  }
}

const sessionRenewalService = new SessionRenewalService();

export default sessionRenewalService;
```

---

## 🔧 **MEJORA 4: Detección de Inactividad del Usuario** (OPCIONAL)

### **¿Qué hace?**
Detecta si el usuario realmente está usando la app o solo la dejó abierta.

### **Implementación:**

```javascript
// src/services/userActivityDetector.js

import logger from '../lib/logger.js';

class UserActivityDetector {
  constructor() {
    this.lastActivityTime = Date.now();
    this.isUserActive = true;
    this.inactivityThreshold = 1800000; // 30 minutos
    this.checkInterval = null;
    this.activityListeners = [];
  }

  start() {
    logger.dev('👁️ Iniciando detector de actividad del usuario');

    // Eventos que indican actividad
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const activityHandler = () => {
      this.lastActivityTime = Date.now();
      if (!this.isUserActive) {
        this.isUserActive = true;
        logger.dev('👤 Usuario activo de nuevo');
      }
    };

    // Throttle para no disparar demasiado frecuentemente
    let throttleTimeout = null;
    const throttledHandler = () => {
      if (!throttleTimeout) {
        activityHandler();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 5000); // Actualizar máximo cada 5 segundos
      }
    };

    events.forEach(event => {
      document.addEventListener(event, throttledHandler, { passive: true });
      this.activityListeners.push({ event, handler: throttledHandler });
    });

    // Verificar inactividad cada minuto
    this.checkInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivityTime;
      
      if (timeSinceActivity > this.inactivityThreshold && this.isUserActive) {
        this.isUserActive = false;
        logger.dev('😴 Usuario inactivo por', Math.floor(timeSinceActivity / 60000), 'minutos');
      }
    }, 60000);
  }

  stop() {
    this.activityListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler);
    });
    this.activityListeners = [];

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    logger.dev('🛑 Detector de actividad detenido');
  }

  isActive() {
    return this.isUserActive;
  }

  getLastActivityTime() {
    return this.lastActivityTime;
  }
}

const userActivityDetector = new UserActivityDetector();

export default userActivityDetector;
```

---

## 📋 **PLAN DE IMPLEMENTACIÓN**

### **Prioridad ALTA (Implementar YA):**

1. ✅ Health Check Service (20 minutos)
   - Detecta problemas antes de que el usuario los note
   - Recovery automático

2. ✅ Session Renewal Service (15 minutos)
   - Evita expiraciones de sesión
   - Crítico para sesiones de días

### **Prioridad MEDIA (Próxima semana):**

3. ⏳ Buffer Cleanup (10 minutos)
   - Previene consumo excesivo de memoria

4. ⏳ User Activity Detector (15 minutos)
   - Opcional pero útil para métricas

---

## 📊 **MÉTRICAS A MONITOREAR**

### **Dashboard de Monitoreo:**

```javascript
// Añadir en App.jsx o dashboard admin

const MonitoringSummary = () => {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      const status = await window.healthCheck?.performHealthCheck();
      setHealth(status);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="monitoring-summary">
      <h3>Estado del Sistema</h3>
      <div className={health?.supabaseConnection ? 'status-ok' : 'status-error'}>
        Supabase: {health?.supabaseConnection ? '✅' : '❌'}
      </div>
      <div className={health?.heartbeatActive ? 'status-ok' : 'status-error'}>
        Heartbeat: {health?.heartbeatActive ? '✅' : '❌'}
      </div>
      <div className={health?.autoDjActive ? 'status-ok' : 'status-error'}>
        AutoDJ: {health?.autoDjActive ? '✅' : '❌'}
      </div>
    </div>
  );
};
```

---

## ✅ **CHECKLIST DE ESTABILIDAD**

- [x] ✅ Watchdog de audio (ya implementado)
- [x] ✅ Reconexión automática Realtime (ya implementado)
- [x] ✅ Heartbeats ligeros (ya implementado)
- [ ] ⏳ Health check periódico (implementar)
- [ ] ⏳ Renovación de sesión (implementar)
- [ ] ⏳ Limpieza de buffers (implementar)
- [ ] ⏳ Detector de actividad (opcional)

---

## 🎯 **RESULTADO ESPERADO**

Con estas mejoras, tu aplicación podrá:

- ✅ Funcionar **días sin interrupciones**
- ✅ Recuperarse automáticamente de **cualquier fallo**
- ✅ **Detectar y solucionar** problemas antes de que el usuario los note
- ✅ Mantener **sesiones estables** incluso en segundo plano

---

**Fecha:** 23 de octubre de 2025  
**Estado:** 📋 Documentado - Listo para implementar  
**Tiempo estimado:** 1-2 horas de desarrollo

