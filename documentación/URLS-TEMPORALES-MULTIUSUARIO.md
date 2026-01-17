# 🔄 URLs Temporales con Múltiples Usuarios

## ❓ Preguntas Frecuentes

### 1. ¿Varios usuarios pueden escuchar el mismo archivo con URLs temporales?

**Respuesta: SÍ, absolutamente** ✅

#### Cómo Funciona

```
Usuario A quiere escuchar "cancion.mp3"
↓
Solicita URL temporal → Backend genera:
https://cloudfront.net/musica/cancion.mp3?Expires=123&Signature=abc...

Usuario B quiere escuchar "cancion.mp3" (mismo archivo)
↓
Solicita URL temporal → Backend genera:
https://cloudfront.net/musica/cancion.mp3?Expires=456&Signature=xyz...
(Diferente firma y expiración, pero mismo archivo)

Usuario C quiere escuchar "cancion.mp3" (mismo archivo)
↓
Solicita URL temporal → Backend genera:
https://cloudfront.net/musica/cancion.mp3?Expires=789&Signature=def...
(Otra firma y expiración diferente)
```

**Resultado:**
- ✅ Todos escuchan el **mismo archivo físico**
- ✅ Cada uno tiene su **propia URL temporal única**
- ✅ Las URLs expiran **independientemente**
- ✅ No hay conflictos ni problemas

---

### 2. ¿Qué guardamos en la tabla `canciones.url_s3`?

**Respuesta: Guardamos el `s3_key` o la URL permanente de S3** ✅

#### Opción A: Guardar s3_key (Recomendado)

```sql
-- En la tabla canciones
url_s3: "musica/cancion.mp3"  -- Solo la ruta, sin dominio
```

**Ventajas:**
- ✅ Más flexible (puedes cambiar dominio fácilmente)
- ✅ Más limpio
- ✅ Independiente del proveedor (S3, CloudFront, etc.)

#### Opción B: Guardar URL completa de S3

```sql
-- En la tabla canciones
url_s3: "https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/cancion.mp3"
```

**Ventajas:**
- ✅ Compatible con código existente
- ✅ La función `convertToCloudFrontUrl()` la convierte automáticamente

#### Opción C: Guardar URL de CloudFront permanente (NO recomendado)

```sql
-- NO hacer esto si usas URLs temporales
url_s3: "https://d2ozw1d1zbl64l.cloudfront.net/musica/cancion.mp3"
```

**Problema:** Si usas URLs temporales, esta URL no se usará directamente.

---

## 📊 Flujo Completo: BD → Reproducción

### Escenario: Usuario Reproduce Canción

```
1. App carga canción desde BD
   ↓
   BD retorna: {
     id: "123",
     titulo: "Mi Canción",
     url_s3: "musica/cancion.mp3"  ← Guardado en BD
   }
   
2. App necesita reproducir
   ↓
   Extrae s3_key: "musica/cancion.mp3"
   
3. App solicita URL temporal al backend
   ↓
   POST /api/get-signed-url
   { s3Key: "musica/cancion.mp3", userId: "user-456" }
   
4. Backend genera URL temporal
   ↓
   Retorna: {
     url: "https://cloudfront.net/musica/cancion.mp3?Expires=...&Signature=...",
     expiresIn: 3600
   }
   
5. App usa URL temporal para reproducir
   ↓
   audio.src = signedUrl
   ✅ Reproduce correctamente
```

---

## 💾 Qué Guardar en la Base de Datos

### Recomendación: Guardar `s3_key` (solo la ruta)

```sql
-- Ejemplo en tabla canciones
CREATE TABLE canciones (
  id UUID PRIMARY KEY,
  titulo VARCHAR(255),
  artista VARCHAR(255),
  url_s3 TEXT,  -- Guardar: "musica/cancion.mp3" o "contenidos/ads/anuncio.mp3"
  -- ...
);

-- Ejemplos de valores para url_s3:
INSERT INTO canciones (url_s3) VALUES 
  ('musica/cancion.mp3'),
  ('contenidos/ads/anuncio.mp3'),
  ('musica/1758288649213_Wilkkcotmusic_-_HeyNow_Remix.mp3');
```

### Por Qué Guardar Solo s3_key

1. **Flexibilidad**: Puedes cambiar de S3 a otro servicio sin cambiar BD
2. **Limpieza**: No dependes de URLs específicas
3. **Compatibilidad**: Funciona con URLs temporales y permanentes
4. **Migración fácil**: Si cambias de CloudFront, solo cambias el código

---

## 🔄 Comparación: URLs Permanentes vs Temporales

### Con URLs Permanentes (Actual)

```javascript
// En BD guardas:
url_s3: "https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/cancion.mp3"

// En código:
const cloudFrontUrl = convertToCloudFrontUrl(cancion.url_s3);
audio.src = cloudFrontUrl;
// Resultado: https://d2ozw1d1zbl64l.cloudfront.net/musica/cancion.mp3
```

**Ventaja:** Simple, directo  
**Desventaja:** URL permanente, menos seguro

---

### Con URLs Temporales (Spotify-style)

```javascript
// En BD guardas:
url_s3: "musica/cancion.mp3"  // Solo s3_key

// En código:
const s3Key = cancion.url_s3;  // Ya es s3_key
const signedUrl = await getSignedAudioUrl(s3Key);
audio.src = signedUrl;
// Resultado: https://d2ozw1d1zbl64l.cloudfront.net/musica/cancion.mp3?Expires=...&Signature=...
```

**Ventaja:** Más seguro, URLs temporales  
**Desventaja:** Más complejo, requiere backend

---

## 📝 Migración de Base de Datos (Si Cambias a URLs Temporales)

### Si Actualmente Guardas URLs Completas

```sql
-- Opción 1: Extraer s3_key de URLs existentes
UPDATE canciones 
SET url_s3 = REPLACE(
  REPLACE(url_s3, 'https://musicaondeon.s3.eu-north-1.amazonaws.com/', ''),
  'https://d2ozw1d1zbl64l.cloudfront.net/', ''
)
WHERE url_s3 LIKE '%/%';

-- Opción 2: Crear columna nueva y migrar gradualmente
ALTER TABLE canciones ADD COLUMN s3_key TEXT;

UPDATE canciones 
SET s3_key = REPLACE(
  REPLACE(url_s3, 'https://musicaondeon.s3.eu-north-1.amazonaws.com/', ''),
  'https://d2ozw1d1zbl64l.cloudfront.net/', ''
)
WHERE url_s3 IS NOT NULL;
```

---

## 🎯 Recomendación Final

### Para Tu Caso Actual (URLs Permanentes)

**Guardar en BD:**
```sql
url_s3: "musica/cancion.mp3"  -- Solo s3_key (recomendado)
-- O
url_s3: "https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/cancion.mp3"  -- URL completa (también funciona)
```

**En código:**
```javascript
// Convierte automáticamente a CloudFront
const cloudFrontUrl = convertToCloudFrontUrl(cancion.url_s3);
```

---

### Si Migras a URLs Temporales

**Guardar en BD:**
```sql
url_s3: "musica/cancion.mp3"  -- Solo s3_key (OBLIGATORIO)
```

**En código:**
```javascript
// Solicita URL temporal al backend
const signedUrl = await getSignedAudioUrl(cancion.url_s3);
```

---

## ✅ Respuestas Directas

### 1. ¿Varios usuarios pueden escuchar el mismo archivo?

**SÍ** ✅
- Cada usuario obtiene su propia URL temporal única
- Todas apuntan al mismo archivo físico
- No hay conflictos

### 2. ¿Qué guardamos en `url_s3`?

**Recomendado:** Solo `s3_key` (ej: `"musica/cancion.mp3"`)

**También funciona:** URL completa de S3 (se convierte automáticamente)

**NO guardar:** URL temporal de CloudFront (se genera dinámicamente)

### 3. ¿Ya no guardamos nada?

**NO**, seguimos guardando:
- ✅ `s3_key` o URL de S3 en `url_s3`
- ✅ Las URLs temporales se generan **dinámicamente** cuando se necesitan
- ✅ No se guardan en BD (serían inútiles porque expiran)

---

## 📊 Ejemplo Práctico

### Escenario: 3 Usuarios Escuchan la Misma Canción

**En BD (una sola vez):**
```sql
INSERT INTO canciones (id, titulo, url_s3) VALUES 
  ('123', 'Mi Canción', 'musica/cancion.mp3');
```

**Usuario A reproduce:**
```javascript
// 1. Obtiene de BD
const cancion = { id: '123', url_s3: 'musica/cancion.mp3' }

// 2. Solicita URL temporal
const urlA = await getSignedAudioUrl('musica/cancion.mp3');
// Resultado: https://cloudfront.net/musica/cancion.mp3?Expires=1000&Signature=abc...

// 3. Reproduce
audio.src = urlA;  // ✅ Funciona
```

**Usuario B reproduce (mismo archivo):**
```javascript
// 1. Obtiene de BD (mismo registro)
const cancion = { id: '123', url_s3: 'musica/cancion.mp3' }

// 2. Solicita URL temporal (diferente a Usuario A)
const urlB = await getSignedAudioUrl('musica/cancion.mp3');
// Resultado: https://cloudfront.net/musica/cancion.mp3?Expires=2000&Signature=xyz...
// (Diferente firma y expiración)

// 3. Reproduce
audio.src = urlB;  // ✅ Funciona (mismo archivo, diferente URL)
```

**Usuario C reproduce (mismo archivo):**
```javascript
// Mismo proceso, URL temporal diferente
const urlC = await getSignedAudioUrl('musica/cancion.mp3');
// Resultado: https://cloudfront.net/musica/cancion.mp3?Expires=3000&Signature=def...
audio.src = urlC;  // ✅ Funciona
```

**Resultado:**
- ✅ 3 usuarios escuchan el mismo archivo
- ✅ Cada uno tiene su propia URL temporal
- ✅ Las URLs expiran independientemente
- ✅ En BD solo hay 1 registro con `s3_key`

---

## 🔑 Puntos Clave

1. **BD guarda identificador**: `s3_key` o URL de S3 (no URL temporal)
2. **URLs temporales se generan**: Dinámicamente cuando se necesitan
3. **Múltiples usuarios**: Cada uno obtiene su propia URL temporal
4. **Mismo archivo físico**: Todas las URLs apuntan al mismo archivo en S3
5. **Sin conflictos**: Las URLs temporales son independientes

---

**Última actualización:** Noviembre 2025

