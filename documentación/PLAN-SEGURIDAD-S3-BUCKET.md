# 🔒 Plan de Seguridad: Bloqueo de Acceso Público al Bucket S3

## 📋 Problema Identificado

El bucket S3 `musicaondeon` está configurado como **completamente público**, lo que significa que:
- ✅ Cualquiera puede acceder a los archivos si conoce la URL
- ✅ No hay control de acceso ni autenticación
- ✅ Riesgo de costos inesperados por tráfico no autorizado
- ✅ Posible pérdida de contenido protegido

## 🎯 Solución Propuesta

Implementar **CloudFront con Origin Access Control (OAC)** para:
- ✅ **URLs permanentes**: Las URLs no expiran (compatibles con archivos existentes)
- ✅ **Bloqueo de acceso directo**: S3 solo accesible a través de CloudFront
- ✅ **Mejor rendimiento**: CDN global con cache
- ✅ **Control de acceso**: Posibilidad de agregar restricciones por dominio/origen
- ✅ **Sin cambios en código**: Solo cambiar el dominio base de las URLs

---

## 📝 Pasos de Implementación

### FASE 1: Configurar CloudFront Distribution

#### 1.1 Crear CloudFront Distribution

En la consola de AWS CloudFront:

1. **Crear nueva distribución**
   - **Origin Domain**: Seleccionar `musicaondeon.s3.eu-north-1.amazonaws.com`
   - **Name**: `musicaondeon` (o el que prefieras)
   - **Origin Access**: Seleccionar **"Origin Access Control settings (recommended)"**
   - **Origin Access Control**: Crear nuevo OAC con nombre `musicaondeon-oac`
   - **Viewer Protocol Policy**: `Redirect HTTP to HTTPS` (recomendado) o `HTTPS Only`
   - **Allowed HTTP Methods**: `GET, HEAD, OPTIONS` (suficiente para lectura)
   - **Cache Policy**: `CachingOptimized` o crear una personalizada
   - **Price Class**: `Use all edge locations` o `Use only North America and Europe` (más económico)

2. **Configurar CORS** (si es necesario)
   - En **Response headers policy**, agregar headers CORS necesarios

3. **Crear distribución** y esperar a que se despliegue (~15-20 minutos)

4. **Anotar el Domain Name** de CloudFront (ej: `d1234567890.cloudfront.net`)

#### 1.2 Configurar Bucket Policy para CloudFront

Después de crear la distribución, AWS generará una política de bucket. Debes aplicarla:

1. En CloudFront, ir a la distribución creada
2. Ir a la pestaña **Origins**
3. Seleccionar el origin de S3
4. En **Origin access control**, hacer clic en **Edit**
5. Copiar la **Bucket policy** sugerida
6. En S3, ir a **Permisos** → **Bucket policy**
7. Pegar y guardar la política

La política debería verse así:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::musicaondeon/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

#### 1.3 Bloquear Acceso Público Directo a S3

Ahora que CloudFront está configurado, bloquear acceso directo:

1. En S3, ir a **Permisos** → **Bloqueo de acceso público**
2. Activar **"Bloquear todo el acceso público"**:
   - ✅ Bloquear el acceso público a buckets y objetos concedido a través de nuevas listas de control de acceso (ACL)
   - ✅ Bloquear el acceso público a buckets y objetos concedido a través de cualquier lista de control de acceso (ACL)
   - ✅ Bloquear el acceso público a buckets y objetos concedido a través de políticas de bucket y puntos de acceso públicas nuevas
   - ✅ Bloquear el acceso público y entre cuentas a buckets y objetos concedido a través de cualquier política de bucket y puntos de acceso pública

3. Guardar cambios

**✅ RESULTADO**: 
- Las URLs directas de S3 (`https://musicaondeon.s3.eu-north-1.amazonaws.com/...`) dejarán de funcionar
- Solo funcionarán las URLs de CloudFront (`https://d1234567890.cloudfront.net/...`)

---

### FASE 2: Crear Utilidad para Convertir URLs a CloudFront

#### 2.1 Crear Función Helper para Conversión de URLs

**Archivo**: `src/lib/cloudfrontUrls.js`

```javascript
/**
 * Utilidad para convertir URLs de S3 a URLs de CloudFront
 */

// Configuración de CloudFront (debe estar en variables de entorno)
const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN || 
                          process.env.VITE_CLOUDFRONT_DOMAIN || 
                          'd1234567890.cloudfront.net'; // Reemplazar con tu dominio real

const S3_BUCKET_DOMAIN = 'musicaondeon.s3.eu-north-1.amazonaws.com';
const S3_REGION = 'eu-north-1';

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

/**
 * Extraer s3_key de una URL (S3 o CloudFront)
 * @param {string} url - URL completa
 * @returns {string} s3_key
 */
export function extractS3KeyFromUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remover el '/' inicial
  } catch (e) {
    // Si ya es un s3_key directo, retornarlo
    return url;
  }
}

/**
 * Verificar si una URL es de S3 (necesita conversión)
 * @param {string} url - URL a verificar
 * @returns {boolean}
 */
export function isS3Url(url) {
  if (!url) return false;
  return url.includes('s3') && url.includes('amazonaws.com');
}
```

---

### FASE 3: Actualizar AudioPlayerService

#### 3.1 Modificar loadSong para Usar URLs de CloudFront

**Archivo**: `src/services/audioPlayerService.js`

**Cambios en el método `loadSong`**:

```javascript
import { convertToCloudFrontUrl } from '../lib/cloudfrontUrls.js';

async loadSong(song, preloadNext = false) {
  try {
    const songTitle = song?.canciones?.titulo || song?.titulo || 'Sin título';
    logger.dev(`🎵 ${preloadNext ? 'Precargando siguiente' : 'Cargando'} canción:`, songTitle);
    
    if (!song?.canciones?.url_s3 && !song?.url_s3) {
      throw new Error(`No se encontró URL de audio para: ${songTitle}`);
    }

    // Obtener URL original
    const originalUrl = song?.canciones?.url_s3 || song?.url_s3;
    
    // Convertir a URL de CloudFront (si es necesario)
    const audioUrl = convertToCloudFrontUrl(originalUrl);
    logger.dev('🔗 URL convertida a CloudFront:', audioUrl);
    
    // ... resto del código existente usando audioUrl ...
    
    audio.src = audioUrl; // Usar URL de CloudFront
    // ... resto del código sin cambios ...
  } catch (error) {
    logger.error('❌ Error cargando canción:', error);
    throw error;
  }
}
```

**Nota**: El resto del código de `loadSong` permanece igual, solo cambia la URL que se asigna a `audio.src`.

---

### FASE 4: Actualizar Otros Servicios

#### 4.1 Actualizar scheduledContentService.js

Buscar todos los lugares donde se use `url_s3` y convertir a CloudFront:

```javascript
import { convertToCloudFrontUrl } from '../lib/cloudfrontUrls.js';

// Donde se use contenido.url_s3:
const cloudFrontUrl = convertToCloudFrontUrl(contenido.url_s3);
```

#### 4.2 Actualizar ContentManagementPage.jsx

El reproductor de preview también debe usar URLs de CloudFront:

```javascript
import { convertToCloudFrontUrl } from '../lib/cloudfrontUrls.js';

// En el preview:
if (contenido.url_s3) {
  audioPlayer.src = convertToCloudFrontUrl(contenido.url_s3);
}
```

#### 4.3 Actualizar QuickAdsPage.jsx

Los previews de anuncios deben usar URLs de CloudFront:

```javascript
import { convertToCloudFrontUrl } from '../lib/cloudfrontUrls.js';

// En los previews hardcodeados, actualizar las URLs:
preview_url: convertToCloudFrontUrl('contenidos/ads/Guillermo+Anuncios+Inmediatos.mp3')
```

#### 4.4 Buscar y Reemplazar en Todo el Código

Buscar todas las ocurrencias de URLs de S3 y reemplazarlas:

```bash
# Buscar URLs de S3
grep -r "musicaondeon.s3.eu-north-1.amazonaws.com" src/
```

Reemplazar manualmente o crear un script de migración.

---

### FASE 5: Actualizar Base de Datos (Opcional pero Recomendado)

#### 5.1 Migración de URLs en Base de Datos

**Opción A: Mantener URLs y Convertir en Runtime** (Más simple)
- No cambiar nada en la BD
- La función `convertToCloudFrontUrl()` maneja la conversión automáticamente
- ✅ Sin migración de datos
- ✅ Compatible con URLs existentes

**Opción B: Actualizar URLs en BD** (Más limpio a largo plazo)
- Crear script SQL para actualizar todas las URLs de S3 a CloudFront
- Ejemplo:
```sql
UPDATE canciones 
SET url_s3 = REPLACE(
  url_s3, 
  'https://musicaondeon.s3.eu-north-1.amazonaws.com/',
  'https://d1234567890.cloudfront.net/'
)
WHERE url_s3 LIKE '%s3.eu-north-1.amazonaws.com%';

-- Repetir para otras tablas que tengan url_s3
UPDATE contenidos SET url_s3 = REPLACE(...);
UPDATE programaciones SET url_s3 = REPLACE(...);
```

**Recomendación**: Empezar con Opción A (conversión en runtime) y luego migrar a Opción B cuando sea conveniente.

---

## 🧪 Plan de Pruebas

### Prueba 1: Verificar Bloqueo de Acceso Directo a S3
1. Activar bloqueo de acceso público en S3
2. Intentar acceder a una URL directa de S3 → Debe fallar con 403 Forbidden
3. Verificar que CloudFront funciona → Debe servir el archivo correctamente

### Prueba 2: Reproducción de Audio
1. Iniciar reproducción de una canción
2. Verificar en DevTools que la URL es de CloudFront (no S3)
3. Verificar que el audio se reproduce sin problemas
4. Verificar que funciona con URLs antiguas (conversión automática)

### Prueba 3: Contenidos Programados
1. Programar un contenido
2. Verificar que se reproduce correctamente con URL de CloudFront
3. Verificar que funciona en modo fade_out y background

### Prueba 4: Previews y Administración
1. Verificar previews en ContentManagementPage
2. Verificar previews en QuickAdsPage
3. Verificar que todos los reproductores funcionan

### Prueba 5: Performance y Cache
1. Verificar que CloudFront está cacheando correctamente
2. Verificar tiempos de carga (deben ser mejores con CDN)
3. Verificar que funciona desde diferentes ubicaciones geográficas

---

## ⚠️ Consideraciones Importantes

### URLs Permanentes
- ✅ **Las URLs de CloudFront son permanentes** - No expiran
- ✅ Compatible con archivos existentes en la base de datos
- ✅ No requiere regeneración de URLs
- ✅ Funciona con URLs antiguas (conversión automática)

### Performance
- ✅ **Mejor rendimiento**: CloudFront es un CDN global
- ✅ **Cache automático**: Reduce carga en S3
- ✅ **Menor latencia**: Archivos servidos desde edge locations cercanas
- ⚠️ Primera carga puede ser lenta (cache miss), luego es instantáneo

### Costos
- **CloudFront**: 
  - Primeros 10 TB: $0.085 por GB (más económico que S3 directo)
  - Requests: $0.0075 por 10,000 requests GET
- **S3**: 
  - Solo almacenamiento y requests desde CloudFront (más barato)
  - Sin tráfico público no autorizado
- **Ahorro estimado**: Reducción de costos por tráfico no autorizado + mejor cache

### Seguridad Adicional (Opcional)

Si necesitas más seguridad, puedes agregar:

1. **Restricción por Referer**:
   - En CloudFront, crear una **Response headers policy**
   - Agregar validación de `Referer` header
   - Solo permitir acceso desde tu dominio

2. **Signed URLs de CloudFront** (si necesitas URLs temporales):
   - Usar CloudFront Signed URLs para acceso con expiración
   - Requiere configuración adicional

3. **WAF (Web Application Firewall)**:
   - Agregar reglas de seguridad en CloudFront
   - Bloquear bots, rate limiting, etc.

### Rollback
Si hay problemas, se puede:
1. Desactivar temporalmente el bloqueo de acceso público en S3
2. Revertir cambios en el código (quitar conversión a CloudFront)
3. Las URLs directas de S3 volverán a funcionar
4. CloudFront seguirá funcionando en paralelo (no afecta)

---

## 📅 Cronograma Sugerido

1. **Día 1**: 
   - Crear CloudFront distribution (15-20 min de despliegue)
   - Configurar bucket policy para CloudFront
   - **NO bloquear acceso público todavía**

2. **Día 1-2**: 
   - Crear utilidad `cloudfrontUrls.js`
   - Actualizar AudioPlayerService
   - Actualizar otros servicios

3. **Día 2**: 
   - Pruebas con CloudFront activo pero S3 aún público
   - Verificar que todo funciona correctamente

4. **Día 3** (en horario de bajo tráfico):
   - Activar bloqueo de acceso público en S3
   - Verificar que URLs directas de S3 fallan
   - Verificar que CloudFront sigue funcionando
   - Monitoreo intensivo

5. **Día 4**: 
   - Pruebas completas en producción
   - Monitoreo de errores y performance
   - Ajustes si es necesario

---

## ✅ Checklist Final

### Configuración AWS
- [ ] CloudFront distribution creada y desplegada
- [ ] Origin Access Control (OAC) configurado
- [ ] Bucket policy aplicada (permite acceso desde CloudFront)
- [ ] Bloqueo de acceso público activado en S3
- [ ] Variable de entorno `VITE_CLOUDFRONT_DOMAIN` configurada

### Código Frontend
- [ ] Utilidad `cloudfrontUrls.js` creada
- [ ] AudioPlayerService actualizado
- [ ] scheduledContentService actualizado
- [ ] ContentManagementPage actualizado
- [ ] QuickAdsPage actualizado
- [ ] Todas las URLs de S3 convertidas a CloudFront

### Pruebas
- [ ] URLs directas de S3 bloqueadas (403)
- [ ] URLs de CloudFront funcionando
- [ ] Reproducción de audio funciona
- [ ] Contenidos programados funcionan
- [ ] Previews funcionan
- [ ] Conversión automática de URLs antiguas funciona

### Monitoreo
- [ ] CloudFront metrics configurados
- [ ] Alertas de errores configuradas
- [ ] Performance monitoreado
- [ ] Costos verificados

---

## 📚 Referencias

- [AWS CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
- [AWS S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
- [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)
- Documentación existente: `documentación/lambda.md`

## 🔑 Variables de Entorno Necesarias

Agregar a `.env` o configuración de despliegue:

```bash
VITE_CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
```

Reemplazar `d1234567890.cloudfront.net` con el dominio real de tu distribución CloudFront.

---

**Última actualización**: Noviembre 2025  
**Estado**: Plan de acción - Pendiente de implementación

