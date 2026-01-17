# 🚀 Guía Paso a Paso: Configuración de CloudFront

## 📋 Paso 1: Get Started (Configuración Inicial)

### 1.1 Distribution Name
- **Nombre**: `musicaondeon-distribution` (o el nombre que prefieras)
- Este nombre se guardará como tag y puedes cambiarlo después

### 1.2 Description (Opcional)
- **Descripción**: `CloudFront distribution para bucket musicaondeon - Acceso seguro a archivos de audio`

### 1.3 Distribution Type
- ✅ **Seleccionar**: `Single website or app`
- Esta es la opción correcta para un solo bucket S3

### 1.4 Domain (Opcional)
- **Dejar vacío por ahora**
- Puedes configurar un dominio personalizado después si lo necesitas
- Por ahora usaremos el dominio de CloudFront (ej: `d1234567890.cloudfront.net`)

### 1.5 Tags (Opcional)
- Puedes agregar tags si quieres organizar recursos
- Ejemplo:
  - Key: `Project`, Value: `Ondeon Smart`
  - Key: `Environment`, Value: `Production`

**Hacer clic en "Next"** ⬇️

---

## 📋 Paso 2: Specify Origin (Configurar Origen)

### 2.1 Origin Domain
- **Seleccionar**: `musicaondeon.s3.eu-north-1.amazonaws.com`
- ⚠️ **IMPORTANTE**: NO seleccionar el bucket directamente, sino el endpoint regional

### 2.2 Origin Name
- Se generará automáticamente basado en el dominio
- Ejemplo: `musicaondeon-s3-eu-north-1`

### 2.3 Origin Access
- ✅ **Seleccionar**: `Origin Access Control settings (recommended)`
- Esta es la opción moderna y recomendada

### 2.4 Origin Access Control
- **Hacer clic en "Create control setting"** (si no existe uno)
- **Nombre**: `musicaondeon-oac`
- **Description**: `Origin Access Control para musicaondeon bucket`
- **Signing behavior**: `Sign requests (recommended)`
- **Origin type**: `S3`
- **Crear** y seleccionarlo

### 2.5 Origin Path
- **Dejar vacío** (a menos que tus archivos estén en una subcarpeta específica)

### 2.6 Origin Shield
- **Dejar desactivado** por ahora (puedes activarlo después si necesitas mejor cache)

**Hacer clic en "Next"** ⬇️

---

## 📋 Paso 3: Enable Security (Habilitar Seguridad)

### 3.1 Viewer Protocol Policy
- ✅ **Seleccionar**: `Redirect HTTP to HTTPS`
- Esto fuerza todas las conexiones a usar HTTPS

### 3.2 Allowed HTTP Methods
- ✅ **Seleccionar**: `GET, HEAD, OPTIONS`
- Solo necesitamos lectura, no escritura desde CloudFront

### 3.3 Cache Policy
- ✅ **Seleccionar**: `CachingOptimized`
- O crear una personalizada si necesitas control específico

### 3.4 Origin Request Policy
- ✅ **Seleccionar**: `CORS-S3Origin` (si necesitas CORS)
- O `None` si no necesitas CORS

### 3.5 Response Headers Policy
- **Opcional**: Crear una si necesitas headers CORS específicos
- Por ahora puedes dejarlo en `None`

**Hacer clic en "Next"** ⬇️

---

## 📋 Paso 4: Get TLS Certificate (Certificado TLS)

### 4.1 Certificate
- ✅ **Seleccionar**: `Default CloudFront certificate (*.cloudfront.net)`
- Esto permite usar el dominio de CloudFront directamente
- Si quieres un dominio personalizado después, puedes agregarlo más tarde

**Hacer clic en "Next"** ⬇️

---

## 📋 Paso 5: Review and Create (Revisar y Crear)

### 5.1 Revisar Configuración

Verificar que todo esté correcto:

- ✅ **Origin Domain**: `musicaondeon.s3.eu-north-1.amazonaws.com`
- ✅ **Origin Access Control**: `musicaondeon-oac` (creado)
- ✅ **Viewer Protocol**: `Redirect HTTP to HTTPS`
- ✅ **HTTP Methods**: `GET, HEAD, OPTIONS`
- ✅ **Cache Policy**: `CachingOptimized`

### 5.2 Price Class
- **Seleccionar**: `Use only North America and Europe` (más económico)
- O `Use all edge locations` si necesitas cobertura global completa

### 5.3 WAF
- **Dejar desactivado** por ahora
- Puedes agregarlo después si necesitas protección adicional

### 5.4 Create Distribution
- **Hacer clic en "Create distribution"**
- ⏱️ **Esperar 15-20 minutos** mientras se despliega

---

## 📋 Paso 6: Configurar Bucket Policy (DESPUÉS de crear CloudFront)

### 6.1 Obtener Bucket Policy desde CloudFront

1. En CloudFront, ir a tu distribución creada
2. Ir a la pestaña **"Origins"**
3. Seleccionar el origin de S3
4. Hacer clic en **"Edit"**
5. En **"Origin access control"**, hacer clic en **"Edit"**
6. **Copiar la Bucket Policy** que aparece en la sección

### 6.2 Aplicar Bucket Policy en S3

1. Ir a S3 → Bucket `musicaondeon`
2. Ir a **"Permissions"** → **"Bucket policy"**
3. Hacer clic en **"Edit"**
4. **Pegar la política** copiada desde CloudFront
5. **Guardar cambios**

La política debería verse similar a:
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

---

## 📋 Paso 7: Anotar el Domain Name de CloudFront

### 7.1 Obtener el Domain Name

1. En CloudFront, ir a tu distribución
2. En la parte superior verás el **"Distribution domain name"**
3. Ejemplo: `d1234567890abcdef.cloudfront.net`
4. **Copiar este dominio** - lo necesitarás para el código

### 7.2 Guardar para Uso en Código

Este dominio se usará en la variable de entorno:
```bash
VITE_CLOUDFRONT_DOMAIN=d1234567890abcdef.cloudfront.net
```

---

## 📋 Paso 8: Bloquear Acceso Público a S3 (ÚLTIMO PASO)

### ⚠️ IMPORTANTE: Solo hacer esto DESPUÉS de verificar que CloudFront funciona

### 8.1 Verificar que CloudFront Funciona

1. Probar acceso a un archivo vía CloudFront:
   ```
   https://TU_DOMAIN.cloudfront.net/canciones/nombre-archivo.mp3
   ```
2. Debe funcionar correctamente

### 8.2 Bloquear Acceso Público

1. Ir a S3 → Bucket `musicaondeon`
2. Ir a **"Permissions"** → **"Block public access (bucket settings)"**
3. Hacer clic en **"Edit"**
4. ✅ **Activar todas las opciones**:
   - ✅ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through new public bucket or access point policies
   - ✅ Block public access and cross-account access to buckets and objects through any public bucket or access point policies
5. **Guardar cambios**
6. Confirmar escribiendo `confirm` en el campo de confirmación

### 8.3 Verificar Bloqueo

1. Intentar acceder a una URL directa de S3:
   ```
   https://musicaondeon.s3.eu-north-1.amazonaws.com/canciones/nombre-archivo.mp3
   ```
2. Debe retornar **403 Forbidden**
3. La URL de CloudFront debe seguir funcionando ✅

---

## ✅ Checklist de Verificación

- [ ] CloudFront distribution creada
- [ ] Origin Access Control configurado
- [ ] Bucket policy aplicada en S3
- [ ] Domain name de CloudFront anotado
- [ ] CloudFront funciona (probado con URL de ejemplo)
- [ ] Acceso público a S3 bloqueado
- [ ] URLs directas de S3 retornan 403
- [ ] URLs de CloudFront funcionan correctamente

---

## 🎯 Próximos Pasos (Después de Configurar CloudFront)

1. Crear utilidad `cloudfrontUrls.js` en el código
2. Actualizar `AudioPlayerService` para usar CloudFront
3. Actualizar otros servicios que usen URLs de S3
4. Configurar variable de entorno `VITE_CLOUDFRONT_DOMAIN`

---

**¿Necesitas ayuda con algún paso específico?** Avísame y te guío en detalle.

