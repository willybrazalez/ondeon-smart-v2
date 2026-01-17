# 🔧 FIX: Reconexión Fallida Después de Pantalla Bloqueada

**Fecha:** 24 de octubre de 2025  
**Problema:** Después de 1 hora con pantalla bloqueada, los canales NO se reconectan al desbloquear

---

## 🎯 **Síntoma Reportado**

| Situación | Resultado |
|-----------|-----------|
| Dejar app 1 hora en segundo plano | ✅ OK |
| Con pantalla bloqueada (Windows lock) | ⚠️ Red suspendida |
| Desbloquear pantalla y volver a la app | ❌ Canales NO reconectan |
| Programaciones "una_vez" | ❌ NO se ejecutan |

**Logs observados:**
```
❌ Error conectando canal de presencia: CHANNEL_ERROR
❌ Error conectando canal de eventos: CHANNEL_ERROR  
❌ Error en canal de programaciones - Iniciando reconexión automática
```

**Importante:** Ya NO hay errores de CSP → El fix de `webSecurity: false` funcionó ✅

---

## 🔍 **Causa Raíz**

### 1. Windows Bloqueo de Pantalla Suspende la Red

Cuando Windows bloquea la pantalla (ahorro de energía):
```
Pantalla bloqueada → Windows suspende red → WebSockets cerrados
```

### 2. Sistema de Reconexión se Quedó sin Intentos

```javascript
this.maxReconnectAttempts = 10; // Solo 10 intentos

// Mientras dormía:
Intento 1 → FAIL (red suspendida)
Intento 2 → FAIL (red suspendida)
...
Intento 10 → FAIL (red suspendida)
→ Se rinde, NO más intentos

// Cuando vuelves:
Usuario desbloquea → Red activa ✅
Pero reconexión YA se rindió → Canal sigue muerto ❌
```

### 3. Page Visibility NO Reseteaba Intentos

El código anterior solo **verificaba** si debía reconectar, pero:
- ❌ NO reseteaba el contador de intentos fallidos
- ❌ NO forzaba reconexión inmediata
- ❌ NO recargaba programaciones después de reconectar

---

## 💡 **Solución Implementada**

### Mejora en `scheduledContentService.js`

#### ANTES (❌ Pasivo)
```javascript
configurarPageVisibility() {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // Solo verificar si está desconectado
      if (this.realtimeStatus !== 'SUBSCRIBED' && !this.isReconnecting) {
        this.configurarRealtime(); // Reconectar
      }
    }
  };
}
```

**Problema:** Si ya alcanzó 10 intentos, `isReconnecting` queda en `true` o el contador en máximo → NO reintenta.

#### DESPUÉS (✅ Agresivo)
```javascript
configurarPageVisibility() {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      logger.dev('📱 App visible de nuevo - FORZANDO verificación completa...');
      
      if (this.realtimeStatus !== 'SUBSCRIBED') {
        logger.warn('⚠️ Canal desconectado - FORZANDO reconexión inmediata...');
        
        // 🔧 CRÍTICO: Resetear intentos fallidos previos
        this.resetReconnection();
        
        // 🔧 CRÍTICO: Forzar reconexión AHORA
        this.configurarRealtime();
        
        // 🔧 CRÍTICO: Recargar programaciones después de 3s
        setTimeout(async () => {
          if (this.realtimeStatus === 'SUBSCRIBED') {
            await this.cargarProgramacionesUsuario();
            logger.dev(`✅ ${this.programaciones.length} programaciones recargadas`);
          } else {
            this.intentarReconexionRealtime(); // Reintentar
          }
        }, 3000);
      } else {
        // Canal conectado - recargar por si hubo cambios
        this.recargarProgramaciones();
      }
    }
  };
}
```

**Beneficios:**
1. ✅ **Resetea contador** → Permite 10 intentos nuevos
2. ✅ **Fuerza reconexión** → No espera, conecta YA
3. ✅ **Recarga programaciones** → Obtiene cambios recientes
4. ✅ **Reintenta si falla** → No se rinde tras primer intento

---

## 🔄 **Flujo Nuevo**

### Escenario: 1 Hora con Pantalla Bloqueada

```
09:00 → Usuario deja app funcionando ✅
        Canal: SUBSCRIBED
        
09:05 → Bloquea pantalla (Win + L)
        Windows suspende red ⚠️
        
09:06 → WebSocket se cierra ❌
        Intenta reconectar automáticamente
        
09:06-09:15 → 10 intentos de reconexión (todos fallan)
              Red sigue suspendida
              Se rinde después de intento 10 ❌
              
10:00 → Usuario desbloquea pantalla ✅
        Windows reactiva red ✅
        
10:00 → Page Visibility detecta: "App visible"
        
        ┌──────────────────────────────────┐
        │ 🔧 NUEVO FLUJO AGRESIVO          │
        ├──────────────────────────────────┤
        │ 1. Detecta canal desconectado    │
        │ 2. Resetea intentos (0/10)       │
        │ 3. Fuerza reconexión YA          │
        │ 4. Espera 3 segundos             │
        │ 5. Verifica si conectó           │
        │ 6. Recarga programaciones        │
        └──────────────────────────────────┘
        
10:00 → ✅ Canal: SUBSCRIBED
        ✅ Programaciones recargadas
        ✅ Sistema completamente funcional
```

---

## 📊 **Comparación: Antes vs Después**

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Desbloquear pantalla** | ⚠️ Verifica pasivamente | ✅ Fuerza reconexión agresiva |
| **Contador de intentos** | ❌ Se mantiene en 10/10 | ✅ Se resetea a 0/10 |
| **Recarga programaciones** | ❌ NO recarga | ✅ Recarga automáticamente |
| **Tiempo de recuperación** | ❌ NUNCA (se quedó muerto) | ✅ 3-5 segundos |
| **Logs al volver** | ❌ Silencio (ya se rindió) | ✅ "FORZANDO reconexión inmediata" |

---

## 🧪 **Cómo Probar**

### Test 1: Pantalla Bloqueada Corta (15 minutos)

1. Abrir app Windows
2. Bloquear pantalla (Win + L)
3. Esperar 15 minutos
4. Desbloquear
5. **Verificar en consola (F12):**
   ```
   📱 App visible de nuevo - FORZANDO verificación completa...
   ⚠️ Canal desconectado - FORZANDO reconexión inmediata...
   ✅ Canal reconectado - recargando programaciones...
   ✅ X programaciones recargadas después de reconexión
   ```

### Test 2: Pantalla Bloqueada Larga (1 hora)

1. Abrir app Windows
2. Bloquear pantalla (Win + L)  
3. Esperar 1 hora
4. Desbloquear
5. **Verificar en consola (F12):**
   - NO debería aparecer: `CHANNEL_ERROR`
   - SÍ debería aparecer: `✅ Canal reconectado`

### Test 3: Programación "Una Vez"

1. Bloquear pantalla por 30 minutos
2. Crear programación para dentro de 2 minutos
3. Desbloquear
4. Esperar a la hora programada
5. **Resultado esperado:** Programación se ejecuta ✅

---

## ⚠️ **Limitaciones Conocidas**

### 1. Delay de 3 Segundos

Hay un delay de 3 segundos antes de verificar si reconectó:
```javascript
setTimeout(async () => { ... }, 3000);
```

**Razón:** Dar tiempo a que el WebSocket se establezca completamente.

**Impacto:** Si una programación debía ejecutarse en esos 3 segundos, podría perderse.

**Mitigación:** El timer local (cada 10s) sigue verificando programaciones.

### 2. Sin Reconexión Durante Bloqueo

Mientras la pantalla está bloqueada:
- Windows suspende la red
- Los reintentos fallan
- Cuando desbloqueas, se reconecta

**No hay forma de evitar esto** - es comportamiento de Windows.

### 3. WiFi vs Ethernet

- **WiFi:** Más susceptible a suspensión
- **Ethernet:** Menos problemas

**Recomendación para clientes:** Usar Ethernet en PCs que estén 24/7.

---

## 🔐 **Configuración Windows Recomendada**

Para minimizar suspensiones de red:

### Opción 1: Deshabilitar Suspensión de Red

```
Panel de Control 
→ Opciones de Energía 
→ Cambiar configuración del plan
→ Cambiar configuración avanzada de energía
→ Adaptador de red inalámbrica
→ Modo de ahorro de energía
→ Con batería: Rendimiento máximo
→ Conectado: Rendimiento máximo
```

### Opción 2: Deshabilitar Bloqueo Automático

```
Configuración de Windows
→ Cuentas
→ Opciones de inicio de sesión
→ "Requerir inicio de sesión"
→ Seleccionar "Nunca"
```

**Nota:** Menos seguro, solo para PCs dedicados al reproductor.

---

## 📚 **Archivos Modificados**

| Archivo | Cambio |
|---------|--------|
| `src/services/scheduledContentService.js` | Mejora en `configurarPageVisibility()` - reconexión forzada agresiva |

---

## 🔗 **Documentos Relacionados**

- `FIX-PROGRAMACIONES-TIEMPO-REAL.md` - Reconexión automática básica
- `FIX-PROGRAMACIONES-UNA-VEZ-WINDOWS.md` - Fix de CSP en Electron
- `MEJORAS-SESIONES-LARGAS.md` - Análisis general de sesiones largas

---

## ✅ **Próximos Pasos**

1. **Recompilar la app:** `npm run electron:build:win`
2. **Probar con pantalla bloqueada** por 30-60 minutos
3. **Verificar logs** al desbloquear
4. **Confirmar** que programaciones se ejecutan

---

**Implementado por:** Claude Sonnet 4.5  
**Revisado:** ✅  
**Testeado:** ⏳ Pendiente (requiere recompilación y test real)

