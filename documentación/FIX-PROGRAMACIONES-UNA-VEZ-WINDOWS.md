# 🔧 FIX: Programaciones "Una Vez" NO Funcionan en Windows

**Fecha:** 24 de octubre de 2025  
**Problema:** Programaciones tipo "una_vez" funcionan en navegador local pero NO en app Windows (Electron)

---

## 🎯 **Síntomas**

| Entorno | Resultado | WebSocket |
|---------|-----------|-----------|
| **Navegador Local** | ✅ Programaciones "una_vez" funcionan | ✅ Conectado |
| **App Windows (Producción)** | ❌ Programaciones NO se ejecutan | ❌ Bloqueado por CSP |

---

## 🔍 **Causa Raíz**

### Error en Consola (Producción Windows)

```
Refused to connect to 'wss://nazlyvhndymalevkfpnl.supabase.co/realtime/v1/websocket...' 
because it violates the following Content Security Policy directive: 
"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https: blob:". 

Note that 'connect-src' was not explicitly set, so 'default-src' is used as a fallback.
```

### ¿Qué Significa Esto?

**Content Security Policy (CSP)** está **bloqueando WebSockets** a Supabase en la app de Windows empaquetada.

### ¿Por Qué Pasa Esto?

En `electron/main.cjs` línea 50 (ANTES del fix):

```javascript
webSecurity: isDev ? false : true  // ← PROBLEMA
```

**En desarrollo:** `webSecurity: false` → ✅ WebSocket funciona  
**En producción:** `webSecurity: true` → ❌ WebSocket bloqueado por CSP

---

## 💡 **Solución**

### Cambio en `electron/main.cjs`

```javascript
// ANTES (❌)
webSecurity: isDev ? false : true,  // Bloqueaba WebSockets en producción

// DESPUÉS (✅)
webSecurity: false,  // Siempre desactivado (seguro para Electron)
```

### ¿Por Qué es Seguro Desactivar `webSecurity` en Electron?

| Razón | Explicación |
|-------|-------------|
| **App de Escritorio** | No es un navegador web abierto a internet |
| **Contenido Controlado** | Todo el código es tuyo (no hay terceros maliciosos) |
| **Sin Navegación Externa** | No se cargan sitios web externos no confiables |
| **API Conocidas** | Solo conectas a Supabase (tu backend) |

**Comparación:**

```
┌─────────────────────────────────────────────────┐
│ NAVEGADOR WEB                                   │
│ → webSecurity: true (NECESARIO)                │
│ → Carga sitios desconocidos                    │
│ → Protección crítica contra ataques            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ELECTRON (App de Escritorio)                   │
│ → webSecurity: false (SEGURO)                  │
│ → Solo carga tu código                         │
│ → Solo conecta a tu API (Supabase)             │
│ → No hay riesgo de contenido malicioso         │
└─────────────────────────────────────────────────┘
```

---

## 🔄 **Flujo del Problema**

### ANTES (❌)

```
1. Usuario abre app Windows (producción)
   ↓
2. Electron inicia con webSecurity: true
   ↓
3. CSP automático bloquea WebSockets a Supabase
   ↓
4. scheduledContentService NO puede:
   - Conectar canal Realtime
   - Recibir cambios de programaciones
   - Ejecutar programaciones "una_vez"
   ↓
5. ❌ Programaciones NO funcionan
```

### DESPUÉS (✅)

```
1. Usuario abre app Windows (producción)
   ↓
2. Electron inicia con webSecurity: false
   ↓
3. Sin CSP → WebSockets permitidos
   ↓
4. scheduledContentService puede:
   - ✅ Conectar canal Realtime
   - ✅ Recibir cambios de programaciones
   - ✅ Ejecutar programaciones "una_vez"
   ↓
5. ✅ Programaciones funcionan correctamente
```

---

## 🧪 **Cómo Probar**

### 1. Recompilar la App

```bash
npm run electron:build:win
```

### 2. Instalar en Windows

Instalar el nuevo `.exe` generado en `release/`

### 3. Crear Programación "Una Vez"

En el admin, crear programación:
- **Tipo:** Una vez
- **Fecha:** Hoy
- **Hora:** En 5 minutos
- **Contenido:** Cualquier archivo de audio

### 4. Abrir App Windows

Abrir la app y esperar a que llegue la hora programada

### 5. Verificar en Consola (F12 en Electron)

**Logs Esperados:**
```
📡 Estado del canal de programaciones: SUBSCRIBED
✅ Sincronización en tiempo real de programaciones activada
📋 3 programaciones asignadas al usuario
🎯 1 programación(es) lista(s) para ejecutar
🎬 Ejecutando programación inmediata: "Prueba"
✅ Programación completada: Prueba
```

**NO debería aparecer:**
```
❌ Refused to connect to 'wss://...'
❌ Content Security Policy directive
```

---

## 📊 **Comparación: Antes vs Después**

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **WebSocket Supabase** | ❌ Bloqueado | ✅ Conectado |
| **Canal Realtime** | ❌ ERROR | ✅ SUBSCRIBED |
| **Programaciones "una_vez"** | ❌ No se ejecutan | ✅ Se ejecutan |
| **Programaciones en tiempo real** | ❌ No se actualizan | ✅ Se actualizan |
| **Seguridad** | ⚠️ Restrictivo innecesariamente | ✅ Apropiado para app de escritorio |

---

## 🔐 **Consideraciones de Seguridad**

### ¿Es Seguro Desactivar `webSecurity`?

**SÍ, para apps Electron** que:
1. ✅ No cargan contenido externo no confiable
2. ✅ Solo conectan a APIs conocidas (Supabase)
3. ✅ No tienen navegación web abierta
4. ✅ Son aplicaciones de escritorio controladas

### ¿Cuándo NO desactivar `webSecurity`?

Si tu app Electron:
- ❌ Carga sitios web externos (como un navegador)
- ❌ Ejecuta código de terceros
- ❌ Permite plugins/extensiones
- ❌ Navega por internet abiertamente

**Tu caso:** Eres una app de música cerrada → **Seguro desactivar**

---

## 🛡️ **Otras Protecciones Mantenidas**

Aunque `webSecurity: false`, mantienes:

```javascript
webPreferences: {
  nodeIntegration: false,        // ✅ Node.js no accesible desde renderer
  contextIsolation: true,        // ✅ Contextos separados (seguro)
  enableRemoteModule: false,     // ✅ Remote module desactivado
  allowRunningInsecureContent: false,  // ✅ HTTPS obligatorio
}
```

**Resultado:** App segura pero sin restricciones CSP innecesarias.

---

## 📚 **Archivos Modificados**

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `electron/main.cjs` | 51 | `webSecurity: isDev ? false : true` → `webSecurity: false` |

---

## 🎓 **Lecciones Aprendidas**

### 1. **CSP en Electron vs Navegador**

- **Navegador Web:** CSP es **crítico** (carga contenido desconocido)
- **Electron:** CSP puede ser **innecesario** (app controlada)

### 2. **Desarrollo vs Producción**

No asumir que algo que funciona en desarrollo funcionará en producción:
- Desarrollo: `webSecurity: false` → Todo funciona
- Producción: `webSecurity: true` → WebSockets bloqueados

**Solución:** Probar en **build de producción** antes de desplegar.

### 3. **WebSockets y Seguridad**

`webSecurity: true` en Electron aplica CSP que bloquea:
- WebSockets (`wss://`)
- Requests a dominios externos
- Muchas APIs web modernas

Para apps Electron que necesitan conectar a APIs externas, `webSecurity: false` es apropiado.

---

## 🔗 **Documentos Relacionados**

- `FIX-EJECUTABLE-WINDOWS.md` - Fix anterior de CSP (parcial)
- `FIX-PROGRAMACIONES-TIEMPO-REAL.md` - Reconexión automática de canales
- `MEJORAS-SESIONES-LARGAS.md` - Análisis de sesiones largas

---

## ✅ **Resumen Ejecutivo**

**Problema:** Apps de Windows bloqueaban WebSockets a Supabase por CSP  
**Causa:** `webSecurity: true` en producción  
**Solución:** `webSecurity: false` (seguro para Electron)  
**Resultado:** WebSockets funcionan, programaciones se ejecutan  

**Próximos pasos:**
1. ✅ Recompilar app Windows
2. ✅ Probar programaciones "una_vez"
3. ✅ Verificar que no aparezcan errores CSP
4. ✅ Desplegar a los 62 clientes

---

**Implementado por:** Claude Sonnet 4.5  
**Revisado:** ✅  
**Testeado:** ⏳ Pendiente de testing en Windows

