# 🔄 Migración a CloudFront - Guía para Proyecto de Administración

## 📋 Resumen Ejecutivo

**Fecha:** Noviembre 2025  
**Cambio:** Migración de URLs directas de S3 a CloudFront  
**Impacto:** Solo lectura de archivos (reproducción/preview)  
**Eliminación/Escritura:** Sin cambios (siguen funcionando igual)

---

## 🎯 ¿Qué Cambió?

### Antes
- URLs directas de S3: `https://musicaondeon.s3.eu-north-1.amazonaws.com/archivo.mp3`
- Acceso público al bucket S3
- Riesgo de seguridad

### Después
- URLs de CloudFront: `https://d2ozw1d1zbl64l.cloudfront.net/archivo.mp3`
- Bucket S3 bloqueado (solo accesible vía CloudFront)
- Mayor seguridad y mejor rendimiento

---

## ✅ ¿Qué NO Cambió?

- ✅ **Funciones de eliminación** siguen funcionando igual (solo BD)
- ✅ **Funciones de subida** siguen funcionando igual (Lambda)
- ✅ **Base de datos** no necesita cambios (conversión automática)
- ✅ **APIs y servicios** siguen igual

---

## 🔧 Cambios Necesarios en el Código

### Paso 1: Crear Utilidad de Conversión

**Archivo:** `src/lib/cloudfrontUrls.js` (o equivalente en tu proyecto)

```javascript
/**
 * Utilidad para convertir URLs de S3 a URLs de CloudFront
 */

// Configuración de CloudFront (debe estar en variables de entorno)
const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN || 
                          'd2ozw1d1zbl64l.cloudfront.net'; // Fallback

/**
 * Convertir URL de S3 a URL de CloudFront
 * @param {string} s3Url - URL completa de S3 o s3_key
 * @returns {string} URL de CloudFront
 */
export function convertToCloudFrontUrl(s3Url) {
  if (!s3Url) return null;
  
  // Si ya es una URL de CloudFront, retornarla tal cual
  if (s3Url.includes('cloudfront.net')) {
    return s3Url;
  }
  
  // Si es un s3_key (sin http/https), construir URL de CloudFront
  if (!s3Url.startsWith('http')) {
    return `https://${CLOUDFRONT_DOMAIN}/${s3Url}`;
  }
  
  try {
    const urlObj = new URL(s3Url);
    
    // Si es URL de S3, extraer el path y construir URL de CloudFront
    if (urlObj.hostname.includes('s3') && urlObj.hostname.includes('amazonaws.com')) {
      const s3Key = urlObj.pathname.substring(1); // Remover '/' inicial
      return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
    }
    
    // Si no es S3, retornar original (podría ser otro servicio)
    return s3Url;
  } catch (e) {
    // Si falla el parsing, asumir que es un s3_key y construir URL
    return `https://${CLOUDFRONT_DOMAIN}/${s3Url}`;
  }
}
```

---

### Paso 2: Actualizar Lugares que Usan URLs de S3

#### 2.1 Reproductores de Audio/Video

**ANTES:**
```javascript
const audio = new Audio(contenido.url_s3);
audio.play();
```

**DESPUÉS:**
```javascript
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

const cloudFrontUrl = convertToCloudFrontUrl(contenido.url_s3);
const audio = new Audio(cloudFrontUrl);
audio.play();
```

#### 2.2 Previews/Thumbnails de Archivos

**ANTES:**
```javascript
<img src={contenido.url_s3} alt="Preview" />
```

**DESPUÉS:**
```javascript
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

<img src={convertToCloudFrontUrl(contenido.url_s3)} alt="Preview" />
```

#### 2.3 URLs Hardcodeadas

**ANTES:**
```javascript
const previewUrl = 'https://musicaondeon.s3.eu-north-1.amazonaws.com/contenidos/ads/anuncio.mp3';
```

**DESPUÉS:**
```javascript
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

const previewUrl = convertToCloudFrontUrl('contenidos/ads/anuncio.mp3');
// O si ya tienes la URL completa:
const previewUrl = convertToCloudFrontUrl('https://musicaondeon.s3.eu-north-1.amazonaws.com/contenidos/ads/anuncio.mp3');
```

---

### Paso 3: Configurar Variable de Entorno

**Archivo:** `.env` o `.env.local`

```bash
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

**Importante:** 
- Las variables deben empezar con `VITE_` para ser accesibles desde el código del cliente
- Reiniciar el servidor de desarrollo después de agregar/modificar variables

---

## 🔍 Buscar Lugares que Necesitan Cambios

### Comandos Útiles

```bash
# Buscar URLs directas de S3
grep -r "musicaondeon.s3.eu-north-1.amazonaws.com" src/

# Buscar uso de url_s3 en reproductores
grep -r "url_s3" src/ --include="*.js" --include="*.jsx" | grep -i "audio\|video\|img\|src"

# Buscar new Audio() o new Video()
grep -r "new Audio\|new Video" src/
```

---

## 📝 Checklist de Migración

- [ ] Crear archivo `cloudfrontUrls.js` con la función de conversión
- [ ] Agregar variable de entorno `VITE_CLOUDFRONT_DOMAIN`
- [ ] Buscar todos los lugares que usan `url_s3` para reproducción/preview
- [ ] Actualizar reproductores de audio/video
- [ ] Actualizar previews/thumbnails de imágenes
- [ ] Actualizar URLs hardcodeadas
- [ ] Probar reproducción de archivos
- [ ] Verificar que las URLs sean de CloudFront en DevTools
- [ ] Reiniciar servidor de desarrollo

---

## 🧪 Verificación

### 1. Verificar en Código

```javascript
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

const testUrl = 'https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/cancion.mp3';
const cloudFrontUrl = convertToCloudFrontUrl(testUrl);
console.log(cloudFrontUrl);
// Debe mostrar: https://d2ozw1d1zbl64l.cloudfront.net/musica/cancion.mp3
```

### 2. Verificar en Navegador (DevTools)

1. Abre DevTools → Network
2. Reproduce un archivo de audio/video
3. Busca el archivo en la pestaña Network
4. Verifica que la URL sea: `https://d2ozw1d1zbl64l.cloudfront.net/...`
5. Verifica headers: `x-cache: Hit from cloudfront` o `Miss from cloudfront`

### 3. Verificar que S3 Está Bloqueado

Intenta acceder directamente a una URL de S3:
```
https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/cancion.mp3
```

**Resultado esperado:** `403 Forbidden` ✅

---

## ⚠️ Puntos Importantes

### ✅ Lo que SÍ Funciona con CloudFront

- ✅ Reproducción de audio/video
- ✅ Previews/thumbnails
- ✅ Descarga de archivos (si está implementada)
- ✅ Conversión automática de URLs antiguas

### ❌ Lo que NO Funciona con CloudFront

- ❌ Escritura directa a S3 (usa Lambda como antes)
- ❌ Eliminación directa de archivos (usa Lambda/BD como antes)

### 🔄 Compatibilidad

- ✅ **URLs antiguas de S3** se convierten automáticamente
- ✅ **URLs de CloudFront** se mantienen tal cual
- ✅ **s3_key** (sin http) se convierte a CloudFront
- ✅ **Otros servicios** (no S3) se mantienen sin cambios

---

## 📚 Ejemplos Completos

### Ejemplo 1: Reproductor de Audio Simple

```javascript
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

function AudioPlayer({ contenido }) {
  const handlePlay = () => {
    const cloudFrontUrl = convertToCloudFrontUrl(contenido.url_s3);
    const audio = new Audio(cloudFrontUrl);
    audio.play();
  };
  
  return <button onClick={handlePlay}>Reproducir</button>;
}
```

### Ejemplo 2: Componente con Preview

```javascript
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

function ContentCard({ contenido }) {
  const previewUrl = convertToCloudFrontUrl(contenido.url_s3);
  
  return (
    <div>
      <img src={previewUrl} alt={contenido.nombre} />
      <audio src={previewUrl} controls />
    </div>
  );
}
```

### Ejemplo 3: Lista de Archivos

```javascript
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

function FileList({ archivos }) {
  return archivos.map(archivo => {
    const cloudFrontUrl = convertToCloudFrontUrl(archivo.url_s3);
    return (
      <div key={archivo.id}>
        <a href={cloudFrontUrl} download>{archivo.nombre}</a>
      </div>
    );
  });
}
```

---

## 🆘 Solución de Problemas

### Problema: Las URLs no se convierten

**Solución:**
1. Verificar que `cloudfrontUrls.js` existe y está importado
2. Verificar que la variable `VITE_CLOUDFRONT_DOMAIN` está configurada
3. Reiniciar el servidor de desarrollo

### Problema: Error 403 al acceder a archivos

**Solución:**
1. Verificar que CloudFront está configurado correctamente
2. Verificar que la bucket policy permite acceso desde CloudFront
3. Verificar que el archivo existe en S3

### Problema: URLs antiguas no funcionan

**Solución:**
- Las URLs antiguas de S3 ahora retornan 403 (esperado)
- La función `convertToCloudFrontUrl()` convierte automáticamente
- Si hay URLs hardcodeadas, actualizarlas manualmente

---

## 📞 Contacto y Soporte

**Dominio CloudFront:** `d2ozw1d1zbl64l.cloudfront.net`  
**Bucket S3:** `musicaondeon`  
**Región:** `eu-north-1`

**Documentación completa:**
- `documentación/PLAN-SEGURIDAD-S3-BUCKET.md` - Plan completo
- `documentación/GUIA-CLOUDFRONT-PASO-A-PASO.md` - Configuración AWS
- `documentación/VERIFICACION-CLOUDFRONT.md` - Verificación

---

## ✅ Resumen Final

1. **Crear** `cloudfrontUrls.js` con función de conversión
2. **Agregar** variable de entorno `VITE_CLOUDFRONT_DOMAIN`
3. **Buscar** todos los lugares que usan `url_s3` para lectura
4. **Actualizar** para usar `convertToCloudFrontUrl()`
5. **Probar** que todo funciona correctamente

**Tiempo estimado:** 1-2 horas dependiendo del tamaño del proyecto

---

**Última actualización:** Noviembre 2025  
**Estado:** ✅ Implementado en proyecto principal

