# 🔐 CloudFront Signed URLs - Guía Completa

## 📋 ¿Qué son las URLs Temporales/Signed URLs?

### Concepto Básico

Las **Signed URLs** (URLs firmadas) son URLs que:
- ✅ Tienen una **firma criptográfica** que valida su autenticidad
- ✅ Tienen una **fecha de expiración** (ej: 1 hora, 24 horas)
- ✅ Solo funcionan durante el tiempo especificado
- ✅ Son **únicas** para cada solicitud (opcional)

### Ejemplo Visual

**URL Permanente (Actual):**
```
https://d2ozw1d1zbl64l.cloudfront.net/musica/cancion.mp3
```
- ✅ Funciona siempre
- ❌ Si alguien la conoce, puede acceder indefinidamente

**URL Temporal/Signed (Spotify-style):**
```
https://d2ozw1d1zbl64l.cloudfront.net/musica/cancion.mp3?
  Expires=1734567890&
  Signature=abc123def456...&
  Key-Pair-Id=APKAIOSFODNN7EXAMPLE
```
- ✅ Funciona solo hasta `Expires` (ej: 1 hora)
- ✅ Después de expirar, retorna 403 Forbidden
- ✅ La firma valida que la URL es legítima

---

## 🔄 Cómo Funciona el Flujo

### Flujo Actual (URLs Permanentes)

```
1. Usuario hace login → Autenticado ✅
2. App carga canción → Obtiene URL de BD
3. URL: https://cloudfront.net/musica/cancion.mp3
4. Reproductor usa URL → Funciona siempre
```

**Problema:** Si alguien copia la URL, puede usarla indefinidamente.

---

### Flujo con Signed URLs (Spotify-style)

```
1. Usuario hace login → Autenticado ✅
2. Usuario quiere reproducir canción
3. App solicita URL temporal al backend:
   POST /api/get-audio-url
   { songId: "123", userId: "user-456" }
   
4. Backend verifica:
   - ¿Usuario autenticado? ✅
   - ¿Tiene permiso para esta canción? ✅
   - Genera URL firmada que expira en 1 hora
   
5. Backend retorna:
   {
     url: "https://cloudfront.net/musica/cancion.mp3?Expires=...&Signature=...",
     expiresIn: 3600
   }
   
6. App usa URL temporal → Funciona por 1 hora
7. Después de 1 hora → URL expira (403)
8. Si usuario sigue escuchando → App solicita nueva URL
```

**Ventaja:** URLs expiran automáticamente, más seguro.

---

## 🛠️ Implementación con CloudFront

### Requisitos Previos

1. **Key Pair de CloudFront** (crear en AWS)
2. **Backend/Supabase Edge Function** (para generar URLs)
3. **Modificar frontend** (para solicitar URLs al backend)

---

## 📝 Paso 1: Crear Key Pair en CloudFront

### 1.1 Generar Key Pair

```bash
# Opción 1: Usar OpenSSL (recomendado)
openssl genrsa -out private_key.pem 2048
openssl rsa -pubout -in private_key.pem -out public_key.pem

# Opción 2: Usar AWS CLI
aws cloudfront create-public-key --public-key-config file://public_key.pem
```

### 1.2 Subir Public Key a CloudFront

1. Ve a **CloudFront** → **Public keys**
2. Haz clic en **Create public key**
3. Pega el contenido de `public_key.pem`
4. Guarda el **Key Pair ID** (ej: `APKAIOSFODNN7EXAMPLE`)

### 1.3 Configurar Key Group

1. Ve a **CloudFront** → **Key groups**
2. Crea un nuevo **Key group**
3. Agrega tu public key
4. Asocia el Key group a tu distribución CloudFront

---

## 📝 Paso 2: Crear Edge Function en Supabase

### 2.1 Crear Función: `get-signed-audio-url`

**Archivo:** `supabase/functions/get-signed-audio-url/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createHash, createSign } from 'https://deno.land/std@0.168.0/node/crypto.ts'

// Configuración CloudFront
const CLOUDFRONT_DOMAIN = Deno.env.get('CLOUDFRONT_DOMAIN') || 'd2ozw1d1zbl64l.cloudfront.net'
const KEY_PAIR_ID = Deno.env.get('CLOUDFRONT_KEY_PAIR_ID') || 'APKAIOSFODNN7EXAMPLE'
const PRIVATE_KEY = Deno.env.get('CLOUDFRONT_PRIVATE_KEY') || ''

serve(async (req) => {
  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener usuario desde token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener parámetros
    const { s3Key, expiresIn = 3600 } = await req.json()
    
    if (!s3Key) {
      return new Response(
        JSON.stringify({ error: 's3Key requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generar URL firmada
    const signedUrl = generateCloudFrontSignedUrl(s3Key, expiresIn)
    
    return new Response(
      JSON.stringify({ 
        url: signedUrl,
        expiresIn: expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Generar URL firmada de CloudFront
 */
function generateCloudFrontSignedUrl(s3Key: string, expiresIn: number): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn
  const url = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`
  
  // Crear política de firma
  const policy = JSON.stringify({
    Statement: [{
      Resource: url,
      Condition: {
        DateLessThan: {
          'AWS:EpochTime': expires
        }
      }
    }]
  })
  
  // Firmar política
  const signature = signPolicy(policy)
  
  // Construir URL firmada
  const signedUrl = `${url}?Expires=${expires}&Signature=${signature}&Key-Pair-Id=${KEY_PAIR_ID}`
  
  return signedUrl
}

/**
 * Firmar política con clave privada
 */
function signPolicy(policy: string): string {
  // Implementación de firma RSA-SHA1
  // Nota: Requiere biblioteca de criptografía
  // En producción, usa una biblioteca adecuada para Deno
  
  // Ejemplo simplificado (necesitas implementar correctamente)
  const sign = createSign('RSA-SHA1')
  sign.update(policy)
  const signature = sign.sign(PRIVATE_KEY, 'base64')
  
  // Codificar para URL
  return encodeURIComponent(signature)
}
```

---

## 📝 Paso 3: Actualizar Frontend

### 3.1 Crear Servicio para Obtener URLs Firmadas

**Archivo:** `src/lib/signedAudioUrls.js`

```javascript
import { supabase } from './supabase.js';

/**
 * Obtener URL firmada temporal para un archivo de audio
 * @param {string} s3Key - Clave del archivo en S3 (ej: "musica/cancion.mp3")
 * @param {number} expiresIn - Tiempo de expiración en segundos (default: 3600 = 1 hora)
 * @returns {Promise<string>} URL firmada temporal
 */
export async function getSignedAudioUrl(s3Key, expiresIn = 3600) {
  try {
    // Obtener token de autenticación
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Usuario no autenticado');
    }

    // Llamar a Edge Function
    const { data, error } = await supabase.functions.invoke('get-signed-audio-url', {
      body: { s3Key, expiresIn },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) throw error;
    
    return data.url;
  } catch (error) {
    console.error('Error obteniendo URL firmada:', error);
    throw error;
  }
}

/**
 * Cache simple para URLs firmadas (evitar múltiples requests)
 */
const urlCache = new Map();
const CACHE_DURATION = 50 * 60 * 1000; // 50 minutos (menos que expiración de 1 hora)

export async function getSignedAudioUrlCached(s3Key, expiresIn = 3600) {
  const cacheKey = `${s3Key}_${expiresIn}`;
  const cached = urlCache.get(cacheKey);
  
  // Verificar si la URL cacheada aún es válida (no expirada)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  
  // Obtener nueva URL firmada
  const signedUrl = await getSignedAudioUrl(s3Key, expiresIn);
  
  // Guardar en cache con tiempo de expiración
  urlCache.set(cacheKey, {
    url: signedUrl,
    expiresAt: Date.now() + (expiresIn * 1000) - (10 * 60 * 1000) // 10 min antes de expirar
  });
  
  return signedUrl;
}
```

### 3.2 Actualizar AudioPlayerService

**Archivo:** `src/services/audioPlayerService.js`

```javascript
import { getSignedAudioUrlCached } from '../lib/signedAudioUrls.js';
import { extractS3KeyFromUrl } from '../lib/cloudfrontUrls.js';

async loadSong(song, preloadNext = false) {
  try {
    const songTitle = song?.canciones?.titulo || song?.titulo || 'Sin título';
    logger.dev(`🎵 Cargando canción:`, songTitle);
    
    if (!song?.canciones?.url_s3 && !song?.url_s3) {
      throw new Error(`No se encontró URL de audio para: ${songTitle}`);
    }

    const originalUrl = song?.canciones?.url_s3 || song?.url_s3;
    
    // Extraer s3_key de la URL
    const s3Key = extractS3KeyFromUrl(originalUrl);
    
    // Obtener URL firmada temporal
    logger.dev('🔐 Obteniendo URL firmada temporal para:', s3Key);
    const signedUrl = await getSignedAudioUrlCached(s3Key, 3600); // Expira en 1 hora
    logger.dev('✅ URL firmada obtenida:', signedUrl);
    
    // ... resto del código usando signedUrl ...
    
    audio.src = signedUrl;
    // ... resto del código ...
  } catch (error) {
    logger.error('❌ Error cargando canción:', error);
    throw error;
  }
}
```

---

## 🔄 Flujo Completo con Signed URLs

### Escenario: Usuario Reproduce Canción

```
1. Usuario hace clic en "Reproducir"
   ↓
2. AudioPlayerService.loadSong() se ejecuta
   ↓
3. Extrae s3_key de la URL de BD
   Ejemplo: "musica/cancion.mp3"
   ↓
4. Llama a getSignedAudioUrlCached()
   ↓
5. Verifica cache:
   - ¿Hay URL válida en cache? → Usa cache
   - ¿No hay cache o expiró? → Solicita nueva
   ↓
6. Supabase Edge Function genera URL firmada:
   - Expira en 1 hora
   - Firma criptográfica única
   - URL: https://cloudfront.net/musica/cancion.mp3?Expires=...&Signature=...
   ↓
7. Frontend recibe URL firmada
   ↓
8. Reproductor usa URL → Funciona por 1 hora
   ↓
9. Si URL expira durante reproducción:
   - Reproductor detecta error 403
   - Solicita nueva URL automáticamente
   - Continúa reproducción sin interrupciones
```

---

## ✅ Ventajas de Signed URLs

### Seguridad

1. **URLs temporales**: Expiran automáticamente
2. **Firma criptográfica**: No se pueden falsificar
3. **Control de acceso**: Solo usuarios autenticados pueden obtener URLs
4. **Auditoría**: Puedes rastrear quién accede a qué

### Ejemplo de Seguridad

**Sin Signed URLs:**
```
Usuario copia URL → https://cloudfront.net/musica/cancion.mp3
Usuario comparte URL → Otros pueden acceder indefinidamente ❌
```

**Con Signed URLs:**
```
Usuario copia URL → https://cloudfront.net/musica/cancion.mp3?Expires=1734567890&Signature=...
URL expira en 1 hora → Después de eso, retorna 403 Forbidden ✅
Usuario comparte URL → Otros pueden acceder solo por 1 hora ✅
```

---

## ⚠️ Consideraciones

### Ventajas

- ✅ Más seguro (URLs expiran)
- ✅ Control de acceso por tiempo
- ✅ Similar a Spotify/Apple Music
- ✅ Previene compartir URLs indefinidamente

### Desventajas

- ❌ Más complejo (requiere backend)
- ❌ Más requests al servidor
- ❌ URLs no permanentes (puede afectar cache)
- ❌ Si URL expira durante reproducción, necesita regenerar

### Solución para URLs que Expiran Durante Reproducción

```javascript
// En audioPlayerService.js
audio.addEventListener('error', async (e) => {
  if (e.target.error?.code === 4 || e.target.status === 403) {
    // URL expirada, obtener nueva
    logger.dev('🔄 URL expirada, obteniendo nueva...');
    const newSignedUrl = await getSignedAudioUrlCached(s3Key);
    audio.src = newSignedUrl;
    audio.play();
  }
});
```

---

## 📊 Comparación: URLs Permanentes vs Temporales

| Aspecto | URLs Permanentes | URLs Temporales |
|---------|------------------|-----------------|
| **Seguridad** | Media | Alta |
| **Complejidad** | Baja | Media-Alta |
| **Performance** | Alta (mejor cache) | Media (más requests) |
| **Mantenimiento** | Baja | Media |
| **Costo** | Bajo | Medio (más requests) |
| **Similar a Spotify** | ❌ | ✅ |

---

## 🎯 Recomendación

### Para Tu Caso de Uso

**URLs Permanentes (Actual) son suficientes si:**
- ✅ Tu aplicación es privada (usuarios autenticados)
- ✅ Las URLs no son fácilmente descubribles
- ✅ No tienes problemas de compartir URLs
- ✅ Quieres mejor performance y cache

**URLs Temporales (Signed URLs) son mejores si:**
- ✅ Necesitas máximo nivel de seguridad
- ✅ Quieres prevenir compartir URLs
- ✅ Necesitas auditoría de acceso
- ✅ Quieres estar al nivel de Spotify

---

## 🚀 ¿Quieres Implementarlo?

Si decides implementar Signed URLs, necesitarás:

1. ✅ Crear Key Pair en CloudFront
2. ✅ Crear Edge Function en Supabase
3. ✅ Actualizar frontend para usar URLs temporales
4. ✅ Manejar renovación automática de URLs expiradas

**Tiempo estimado:** 4-6 horas de desarrollo

**¿Quieres que te ayude a implementarlo paso a paso?**

---

**Última actualización:** Noviembre 2025

