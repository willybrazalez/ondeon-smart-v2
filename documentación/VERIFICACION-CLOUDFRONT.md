# ✅ Guía de Verificación: CloudFront y S3

## 📋 Después de Crear la Distribución CloudFront

### Paso 1: Anotar el Domain Name de CloudFront

1. En CloudFront, ve a tu distribución `musicaondeon-distribution`
2. En la parte superior verás el **"Distribution domain name"**
3. Ejemplo: `d1234567890abcdef.cloudfront.net`
4. **Copia este dominio** - lo necesitarás para el código
d2ozw1d1zbl64l.cloudfront.net
---

## ✅ Punto 2: Verificar que CloudFront Actualizó la Bucket Policy de S3

### 2.1 Verificar en S3

1. Ve a **S3** → Bucket `musicaondeon`
2. Ve a **"Permissions"** → **"Bucket policy"**
3. Deberías ver una política similar a esta:

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
          "AWS:SourceArn": "arn:aws:cloudfront::TU_ACCOUNT_ID:distribution/TU_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

### 2.2 ¿Qué buscar?

- ✅ Debe existir una bucket policy (no estar vacía)
- ✅ Debe tener `"Service": "cloudfront.amazonaws.com"` en el Principal
- ✅ Debe tener `"Action": "s3:GetObject"`
- ✅ Debe tener el ARN de tu distribución CloudFront en la condición

### 2.3 Si NO aparece automáticamente

Si CloudFront no actualizó automáticamente la política:

1. Ve a CloudFront → Tu distribución
2. Ve a la pestaña **"Origins"**
3. Selecciona el origin de S3
4. Haz clic en **"Edit"**
5. En **"Origin access control"**, haz clic en **"Edit"**
6. Copia la **Bucket policy** que aparece
7. Pégalo en S3 → Permissions → Bucket policy
8. Guarda cambios

---

## ✅ Punto 3: Probar Acceso a un Archivo vía CloudFront

### 3.1 Obtener una URL de Ejemplo de S3

Primero necesitas saber qué archivos tienes en S3:

1. Ve a **S3** → Bucket `musicaondeon`
2. Navega por las carpetas para encontrar un archivo de ejemplo
3. Por ejemplo: `canciones/nombre-cancion.mp3` o `contenidos/ads/anuncio.mp3`
4. **Anota la ruta completa** del archivo

### 3.2 Construir URL de CloudFront

Formato de URL:
```
https://TU_DOMAIN.cloudfront.net/RUTA_DEL_ARCHIVO
```

Ejemplo:
```
https://d1234567890abcdef.cloudfront.net/canciones/nombre-cancion.mp3
```

### 3.3 Probar en el Navegador

1. Abre una nueva pestaña en tu navegador
2. Pega la URL de CloudFront
3. Debe:
   - ✅ Cargar el archivo (si es audio, debe reproducirse o descargarse)
   - ✅ Mostrar el contenido correcto
   - ✅ No mostrar error 403 o 404

### 3.4 Probar con cURL (Terminal)

Si prefieres usar terminal:

```bash
# Reemplaza con tu dominio y ruta real
curl -I https://TU_DOMAIN.cloudfront.net/canciones/nombre-cancion.mp3
```

Deberías ver:
```
HTTP/2 200
content-type: audio/mpeg
content-length: [tamaño del archivo]
...
```

### 3.5 Verificar en DevTools del Navegador

1. Abre **DevTools** (F12)
2. Ve a la pestaña **Network**
3. Intenta acceder a la URL de CloudFront
4. Verifica:
   - ✅ Status: `200 OK`
   - ✅ Headers muestran `x-cache: Hit from cloudfront` o `Miss from cloudfront`
   - ✅ Content-Type correcto (ej: `audio/mpeg`)

### 3.6 Si Obtienes Error 403

Si ves `403 Forbidden`:

1. Verifica que la bucket policy esté correcta (Punto 2)
2. Verifica que el archivo existe en S3
3. Verifica que la ruta en la URL sea correcta (case-sensitive)
4. Espera unos minutos más (CloudFront puede tardar en propagar cambios)

### 3.7 Si Obtienes Error 404

Si ves `404 Not Found`:

1. Verifica que el archivo existe en S3 con esa ruta exacta
2. Verifica que la ruta en la URL coincida exactamente (incluye mayúsculas/minúsculas)
3. Verifica que no haya espacios o caracteres especiales mal codificados

---

## ✅ Punto 4: Bloquear Acceso Público a S3 (ÚLTIMO PASO)

### ⚠️ IMPORTANTE: Solo hacer esto DESPUÉS de verificar que CloudFront funciona

### 4.1 Verificar que CloudFront Funciona Primero

**ANTES de bloquear acceso público**, asegúrate de que:

- ✅ CloudFront sirve archivos correctamente (Punto 3 verificado)
- ✅ Tienes al menos una URL de CloudFront funcionando
- ✅ La bucket policy está configurada correctamente

### 4.2 Bloquear Acceso Público en S3

1. Ve a **S3** → Bucket `musicaondeon`
2. Ve a **"Permissions"** → **"Block public access (bucket settings)"**
3. Haz clic en **"Edit"**
4. ✅ **Activa TODAS las opciones**:
   - ✅ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through new public bucket or access point policies
   - ✅ Block public access and cross-account access to buckets and objects through any public bucket or access point policies
5. Haz clic en **"Save changes"**
6. Confirma escribiendo `confirm` en el campo de confirmación
7. Haz clic en **"Confirm"**

### 4.3 Verificar que el Bloqueo Funciona

#### 4.3.1 Probar URL Directa de S3 (Debe Fallar)

Intenta acceder a una URL directa de S3:

```
https://musicaondeon.s3.eu-north-1.amazonaws.com/canciones/nombre-cancion.mp3
```

**Resultado esperado:**
- ❌ Debe retornar **403 Forbidden**
- ❌ No debe servir el archivo
- ✅ Mensaje de error: "Access Denied" o similar

#### 4.3.2 Probar URL de CloudFront (Debe Funcionar)

Intenta acceder a la misma URL pero vía CloudFront:

```
https://TU_DOMAIN.cloudfront.net/canciones/nombre-cancion.mp3
```

**Resultado esperado:**
- ✅ Debe servir el archivo correctamente
- ✅ Status 200 OK
- ✅ Archivo accesible

### 4.4 Si CloudFront Deja de Funcionar Después del Bloqueo

Si después de bloquear acceso público, CloudFront también deja de funcionar:

1. Verifica que la bucket policy esté correcta (debe permitir acceso desde CloudFront)
2. Verifica que el Origin Access Control esté configurado en CloudFront
3. Espera 5-10 minutos (puede tardar en propagarse)
4. Si sigue sin funcionar, revisa la bucket policy y asegúrate de que incluya el ARN correcto de CloudFront

---

## 📋 Checklist Final de Verificación

- [ ] CloudFront distribution creada y desplegada
- [ ] Domain name de CloudFront anotado
- [ ] Bucket policy en S3 configurada correctamente
- [ ] Al menos una URL de CloudFront funciona (200 OK)
- [ ] URL directa de S3 bloqueada (403 Forbidden)
- [ ] URL de CloudFront sigue funcionando después del bloqueo
- [ ] Variable de entorno `VITE_CLOUDFRONT_DOMAIN` configurada

---

## 🔍 Comandos Útiles para Verificación

### Verificar Bucket Policy desde Terminal (AWS CLI)

```bash
aws s3api get-bucket-policy --bucket musicaondeon --output json | jq .
```

### Listar Archivos en S3

```bash
aws s3 ls s3://musicaondeon/ --recursive
```

### Probar URL de CloudFront

```bash
# Reemplaza con tu dominio y ruta
curl -I https://TU_DOMAIN.cloudfront.net/canciones/archivo.mp3
```

### Ver Headers Completos

```bash
curl -v https://TU_DOMAIN.cloudfront.net/canciones/archivo.mp3 2>&1 | grep -i "HTTP\|x-cache\|content-type"
```

---

## 🆘 Solución de Problemas

### Problema: CloudFront retorna 403 después de bloquear S3

**Solución:**
1. Verifica que la bucket policy permita acceso desde CloudFront
2. Verifica que el ARN de la distribución en la policy sea correcto
3. Espera 5-10 minutos para que se propague

### Problema: No encuentro archivos en S3 para probar

**Solución:**
1. Usa la consola de S3 para navegar por las carpetas
2. O usa AWS CLI: `aws s3 ls s3://musicaondeon/ --recursive`
3. Cualquier archivo de audio sirve para la prueba

### Problema: La bucket policy no se actualizó automáticamente

**Solución:**
1. Ve a CloudFront → Origins → Edit
2. Copia la bucket policy sugerida
3. Pégalo manualmente en S3 → Permissions → Bucket policy

---

¿Necesitas ayuda con algún paso específico? Avísame y te guío en detalle.

