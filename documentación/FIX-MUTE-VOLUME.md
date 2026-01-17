# 🔧 Fix: Volumen en Mute Restaurado Incorrectamente

**Fecha:** 21 de Octubre de 2025  
**Actualización Final:** 21 de Octubre de 2025 (15:35)  
**Archivo:** `src/services/audioPlayerService.js`  
**Problema:** Después de reproducir contenido programado, la nueva canción sonaba con volumen del contenido (0.192) aunque la música estuviera en mute (0).

---

## 🐛 El Problema REAL (Actualización Final)

### ⚠️ Bug Real Descubierto en Producción:

Después de investigación profunda, descubrimos que el problema NO era que el contenido debiera estar en mute, sino un **bug de event listeners persistentes**.

#### El Comportamiento CORRECTO es:
1. ✅ **Música en mute** → NO se oye
2. ✅ **Contenido programado** → SÍ se oye (independiente del mute de música)
3. ❌ **Nueva canción después del contenido** → DEBERÍA estar en silencio (mute) pero SONABA

#### El Bug Técnico:

**En iOS, el sistema reutiliza el reproductor principal para contenido programado** (línea 1740-1743):
```javascript
if (shouldReuseMainPlayer) {
  contentPlayer = mainPlayer;  // ← Mismo reproductor que la música
}
```

**El problema:**
1. Se agregan event listeners de `canplay` al reproductor (línea 2042-2047)
2. El listener aplica `contentPlayer.volume = this.contentVolume * this.masterVolume` (0.192)
3. Cuando termina el contenido, AutoDJ carga una **nueva canción en el MISMO reproductor**
4. El event listener `canplay` **todavía está activo** y se dispara de nuevo
5. Aplica el volumen del contenido (0.192) a la NUEVA CANCIÓN en lugar del volumen de música (0)

**Logs del Bug:**
```
🔍 calculateVolume() - musicVolume: 0 masterVolume: 0.8 → resultado: 0
🔊 Volumen inicial aplicado al cargar: 0  ← CORRECTO!
...
🎵 Contenido listo para reproducir  ← Event listener del contenido se dispara
🔊 Volumen final aplicado al reproductor: 0.192  ← ¡SOBRESCRIBE el mute!
```

---

## 🐛 El Problema Original (Ya Resuelto)

### Escenario del Bug:

1. **Usuario escucha música al 80%** ✅
2. **Se reproduce contenido programado/manual**  
   → Sistema guarda: `originalVolume = 0.8`
3. **Usuario pone el volumen en MUTE (0)** mientras se reproduce el contenido ⚠️
4. **Contenido termina**
5. **Sistema restaura volumen a 0.8** ❌ **IGNORA EL MUTE**

### Causa Raíz:

En los métodos `playContentWithFade()` y `playContentWithBackground()`, el volumen original se capturaba **AL INICIO** del contenido:

```javascript
// ❌ ANTES (línea 1731 y 2268)
const originalVolume = this.musicVolume * this.masterVolume;
const volumenOriginalMusica = this.musicVolume;
```

Luego, al finalizar el contenido, se restauraba a ese valor guardado, sin verificar si el usuario había cambiado el volumen mientras tanto.

```javascript
// ❌ ANTES
if (originalVolume > 0) {
  await this.fadeInAudio(contentPlayer, originalVolume); // Usa valor guardado
}
```

---

## ✅ La Solución FINAL

### Fix DEFINITIVO: Event Listeners con `{once: true}` ⭐ CRÍTICO

El problema era que los event listeners `canplay` y `loadstart` **NO se removían** después de reproducir el contenido, por lo que se disparaban de nuevo al cargar la nueva canción.

**La Solución:**
Agregar `{once: true}` a los event listeners para que **se auto-remuevan** después de dispararse una vez.

**Antes:**
```javascript
// ❌ ANTES - Event listeners permanecen activos
contentPlayer.addEventListener('loadstart', () => {
  logger.dev('🎵 Iniciando carga del contenido...');
});

contentPlayer.addEventListener('canplay', () => {
  logger.dev('🎵 Contenido listo para reproducir');
  contentPlayer.volume = this.contentVolume * this.masterVolume;  // ← Se dispara para la NUEVA canción
  logger.dev('🔊 Volumen final aplicado al reproductor:', contentPlayer.volume);
});
```

**Ahora:**
```javascript
// ✅ AHORA - Event listeners se auto-remueven
contentPlayer.addEventListener('loadstart', () => {
  logger.dev('🎵 Iniciando carga del contenido...');
}, {once: true});  // ← Solo se dispara UNA VEZ

contentPlayer.addEventListener('canplay', () => {
  logger.dev('🎵 Contenido listo para reproducir');
  contentPlayer.volume = this.contentVolume * this.masterVolume;
  logger.dev('🔊 Volumen final aplicado al reproductor:', contentPlayer.volume);
}, {once: true});  // ← Solo se dispara UNA VEZ para el CONTENIDO
```

---

### Fix #1: Restauración Inteligente del Volumen (Mantenido)

```javascript
// ✅ Consultar en tiempo real
const volumenActual = this.musicVolume * this.masterVolume;

if (volumenActual > 0) {
  await this.fadeInAudio(contentPlayer, volumenActual); // Usa valor actual
  logger.dev(`✅ Volumen restaurado al ${(volumenActual * 100).toFixed(0)}%`);
} else {
  contentPlayer.volume = 0;
  logger.dev('🔇 Música en MUTE - manteniendo silencio');
}
```

---

## 📍 Archivos Modificados

### 1. `src/services/audioPlayerService.js`

#### **Fix DEFINITIVO: Event Listeners con `{once: true}`**

**Líneas 2037-2052** - `playContentWithFade()` - Event listeners:
```javascript
// 🔧 CRÍTICO: Agregar event listeners con {once: true} para evitar que afecten la siguiente canción
// (especialmente en iOS donde se reutiliza el reproductor principal)
contentPlayer.addEventListener('loadstart', () => {
  logger.dev('🎵 Iniciando carga del contenido...');
}, {once: true});  // ← CLAVE: Solo se dispara UNA VEZ

contentPlayer.addEventListener('canplay', () => {
  logger.dev('🎵 Contenido listo para reproducir');
  // Forzar aplicación del volumen justo antes de reproducir
  contentPlayer.volume = this.contentVolume * this.masterVolume;
  logger.dev('🔊 Volumen final aplicado al reproductor:', contentPlayer.volume);
}, {once: true});  // ← CLAVE: Solo se dispara UNA VEZ para el CONTENIDO

contentPlayer.addEventListener('volumechange', () => {
  logger.dev('🔊 Cambio de volumen detectado:', contentPlayer.volume);
}, {once: false}); // Este puede quedarse para debugging
```

---

#### **Fix #1: Restauración Inteligente del Volumen (Mantenido)**

**Método: `playContentWithFade()` (Contenido Manual)**

**Líneas 1890-1918** - Restauración normal (fin de contenido):
```javascript
// 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
const volumenActual = this.musicVolume * this.masterVolume;

if (volumenActual > 0) {
  await this.fadeInAudio(contentPlayer, volumenActual);
  logger.dev(`✅ Canción original restaurada con fade in (iOS) al ${(volumenActual * 100).toFixed(0)}%`);
} else {
  contentPlayer.volume = 0;
  logger.dev('🔇 Música en MUTE - canción continúa sin sonido (iOS)');
}
```

**Líneas 1977-2004** - Restauración tras error:
```javascript
// 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
const volumenActual = this.musicVolume * this.masterVolume;

if (volumenActual > 0) {
  await this.fadeInAudio(contentPlayer, volumenActual);
  logger.dev(`✅ Canción restaurada tras error al ${(volumenActual * 100).toFixed(0)}%`);
} else {
  contentPlayer.volume = 0;
  logger.dev('🔇 Música en MUTE - canción restaurada sin sonido (error path)');
}
```

#### **Método: `playContentWithBackground()` (Contenido Programado con Música de Fondo)**

**Líneas 2326-2337** - Restauración normal (fin de contenido):
```javascript
// 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
const volumenActual = this.musicVolume;

if (volumenActual > 0) {
  await this.transicionarVolumen(volumenActual, 1000);
  logger.dev(`🔼 Volumen de música restaurado: ${(volumenActual * 100).toFixed(0)}%`);
} else {
  await this.transicionarVolumen(0, 0);
  logger.dev('🔇 Música en MUTE - manteniendo silencio');
}
```

**Líneas 2363-2372** - Restauración tras error:
```javascript
// 🔧 CRÍTICO: Consultar this.musicVolume EN TIEMPO REAL, no el guardado
const volumenActual = this.musicVolume;

if (volumenActual > 0) {
  await this.transicionarVolumen(volumenActual, 1000);
  logger.dev(`🔼 Volumen restaurado tras error: ${(volumenActual * 100).toFixed(0)}%`);
} else {
  await this.transicionarVolumen(0, 0);
  logger.dev('🔇 Música en MUTE - manteniendo silencio tras error');
}
```

---

## 🧪 Casos de Prueba

### ✅ Caso 1: Mute Durante Contenido Manual
1. Música sonando al 80%
2. Usuario reproduce contenido manual desde "Programación"
3. Usuario baja volumen a 0 mientras suena el contenido
4. Contenido termina
5. **Resultado esperado:** Música continúa sin sonido (volumen 0)
6. **Resultado anterior:** Música volvía al 80%

### ✅ Caso 2: Mute Durante Contenido Programado
1. Música sonando al 60%
2. Se reproduce indicativo programado (con música de fondo al 20%)
3. Usuario baja volumen a 0 durante el indicativo
4. Indicativo termina
5. **Resultado esperado:** Música continúa sin sonido (volumen 0)
6. **Resultado anterior:** Música volvía al 60%

### ✅ Caso 3: Subir Volumen Durante Contenido
1. Música en mute (0%)
2. Se reproduce contenido programado
3. Usuario sube volumen al 50% durante el contenido
4. Contenido termina
5. **Resultado esperado:** Música restaurada al 50%
6. **Resultado anterior:** Música quedaba en 0%

### ✅ Caso 4: Sin Cambios de Volumen
1. Música al 70%
2. Se reproduce contenido
3. Usuario NO toca el volumen
4. Contenido termina
5. **Resultado esperado:** Música restaurada al 70% (como siempre)

---

## 📊 Beneficios del Fix

1. ✅ **Respeta la intención del usuario**: Si pones mute, la música se queda en mute
2. ✅ **Funciona en ambos métodos**: `playContentWithFade` y `playContentWithBackground`
3. ✅ **Funciona en iOS**: Tanto en modo de reutilización de reproductor como en modo normal
4. ✅ **Funciona en errores**: También respeta el volumen si el contenido falla
5. ✅ **Sin efectos secundarios**: No cambia ningún otro comportamiento

---

## 🎯 Requisito Clave del Usuario

> **"Si pongo en mute el volumen de la música, bajo ningún puto concepto, ni al acabar la canción, ni al cambiar de canción, ni al reproducir el contenido (manual/programado) debe escucharse la canción, porque el volumen está en mute. ¿Entendido?"**

**Estado:** ✅ **RESUELTO**

Ahora el sistema **SIEMPRE** consulta el volumen actual en el momento de restauración, garantizando que el mute se respeta en **TODOS** los escenarios.

---

## 🔍 Verificación

### Test DEFINITIVO: Event Listeners con `{once: true}`

1. **Bajar volumen de música a 0 (MUTE)**
2. **Esperar a que se ejecute contenido programado automáticamente**
3. **El contenido SÍ debe sonar** (correcto)
4. **Cuando termina el contenido, se carga nueva canción**
5. **Verificar en logs:**
   - ✅ Debe aparecer: `🔍 calculateVolume() - musicVolume: 0 masterVolume: 0.8 → resultado: 0`
   - ✅ Debe aparecer: `🔊 Volumen inicial aplicado al cargar: 0`
   - ✅ Debe aparecer: `🎵 Canción anterior ya terminó - NO restaurar`
   - ❌ NO debe aparecer: `🔊 Volumen final aplicado al reproductor: 0.192` (después de cargar nueva canción)
6. **La nueva canción NO debe sonar** (porque música está en mute)

### Test Adicional: Restauración Inteligente (Fix #1)

1. **Reproducir música al 80%**
2. **Lanzar contenido manual desde "Programación"**
3. **Bajar volumen a 0 mientras se reproduce el contenido**
4. **Esperar a que termine el contenido**
5. **Buscar en logs:**
   - ✅ Debe aparecer: `🔇 Música en MUTE - manteniendo silencio`
   - ❌ NO debe aparecer: `🔼 Volumen de música restaurado: X%`

---

## 📝 Notas Técnicas

### Por qué NO guardamos el volumen al inicio:

El valor de `this.musicVolume` puede cambiar **durante** la reproducción del contenido:
- El usuario puede mover el slider
- Puede presionar teclas multimedia
- Puede usar controles del navegador

Por eso, **SIEMPRE** debemos consultar `this.musicVolume` en el **momento exacto** de la restauración.

### Diferencia entre los dos métodos:

- **`playContentWithFade`**: Usa `this.musicVolume * this.masterVolume`  
  (para iOS con reutilización de reproductor)

- **`playContentWithBackground`**: Usa `this.musicVolume` directamente  
  (porque `transicionarVolumen` ya aplica `masterVolume` internamente)

---

## 📊 Resumen de Fixes

| Fix | Problema | Solución | Líneas Modificadas |
|-----|----------|----------|-------------------|
| **DEFINITIVO** | Event listeners persistentes sobrescriben volumen de nueva canción | Usar `{once: true}` en event listeners | 2037-2052 |
| **#1** | Volumen restaurado incorrectamente | Consultar `this.musicVolume` en tiempo real | 1890-1918, 1977-2004, 2326-2372 |

---

## ✅ Estado Final

✅ **Fix DEFINITIVO Completado**: Event listeners con `{once: true}`  
✅ **Fix #1 Mantenido**: Restauración inteligente del volumen  
✅ **Sin errores de linter**  
✅ **Comportamiento correcto confirmado por usuario**  
✅ **Documentación actualizada**  

**Resultado:** El sistema ahora funciona correctamente:
- ✅ Música en mute → NO se oye
- ✅ Contenido programado → SÍ se oye (independiente del mute de música)
- ✅ Nueva canción después del contenido → RESPETA el mute de música

---

**Autor:** Sistema de Fix Automático  
**Primera versión:** 21 de Octubre de 2025 (14:00)  
**Actualización final:** 21 de Octubre de 2025 (15:35)

