# 🔧 Solución: Errores 403 en Producción (URLs de S3)

## 🚨 Problema Identificado

En producción, la aplicación intenta cargar archivos de audio directamente desde S3 (`musicaondeon.s3.eu-north-1.amazonaws.com`) en lugar de usar CloudFront, lo que resulta en errores **403 Forbidden**.

### Evidencia de los Logs

```
musicaondeon.s3.eu-north-1.amazonaws.com/musica/Simone.MP3:1
Failed to load resource: the server responded with a status of 403 (Forbidden)

musicaondeon.s3.eu-north-1.amazonaws.com/musica/ondeon/1762966800819-5dfnws-Ey__ey__1_.mp3
GET https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/ondeon/1762966800819-5dfnws-Ey__ey__1_.mp3 403 (Forbidden)
```

✅ **En desarrollo funciona correctamente** (probablemente porque S3 permite acceso directo en desarrollo o CloudFront está configurado localmente).

❌ **En producción falla** porque no se están convirtiendo las URLs a CloudFront.

---

## 🎯 Causa Raíz

La variable de entorno `VITE_CLOUDFRONT_DOMAIN` **no está configurada durante el build de producción**.

### Cómo funciona el código actual

```javascript
// src/lib/cloudfrontUrls.js
const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN || 
                          'd2ozw1d1zbl64l.cloudfront.net'; // Fallback
```

Durante el build de Vite:
1. Vite reemplaza `import.meta.env.VITE_CLOUDFRONT_DOMAIN` con el valor de la variable de entorno
2. Si la variable **no existe**, reemplaza con `undefined`
3. El código queda: `const CLOUDFRONT_DOMAIN = undefined || 'd2ozw1d1zbl64l.cloudfront.net'`
4. **Debería funcionar el fallback**, pero algo más está fallando

---

## ✅ Solución Inmediata

### Opción 1: Crear archivo `.env` (Recomendado)

Crear un archivo `.env` en la raíz del proyecto con:

```bash
# .env
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

**Importante**: Este archivo está en `.gitignore` por seguridad. Cada desarrollador y el servidor de CI/CD deben tener su propio `.env`.

### Opción 2: Variable de entorno en el script de build

Modificar `package.json` para incluir la variable en los comandos de build:

```json
{
  "scripts": {
    "electron:build:win": "cross-env IS_ELECTRON=true VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net npm run build && electron-builder --win --publish=never",
    "electron:build:mac": "cross-env IS_ELECTRON=true VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net npm run build && electron-builder --mac --publish=never"
  }
}
```

### Opción 3: Crear `.env.production` (Producción específica)

Crear un archivo `.env.production` que solo se usa en builds de producción:

```bash
# .env.production
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

---

## 🔍 Verificación del Problema

### Paso 1: Verificar si el dominio está hardcodeado

Buscar en el código compilado (`dist/`):

```bash
grep -r "musicaondeon.s3.eu-north-1.amazonaws.com" dist/
```

Si encuentra coincidencias, significa que las URLs **no se están convirtiendo**.

### Paso 2: Verificar si CloudFront está configurado correctamente

```bash
# Probar acceso directo a CloudFront
curl -I https://d2ozw1d1zbl64l.cloudfront.net/musica/ondeon/test.mp3

# Debe devolver 200 OK (o 404 si el archivo no existe)
# NO debe devolver 403 Forbidden
```

### Paso 3: Verificar políticas de S3

Las políticas de S3 deben estar configuradas para:
- ✅ **Bloquear** acceso público directo a S3
- ✅ **Permitir** acceso desde CloudFront usando OAI (Origin Access Identity)

---

## 🚀 Pasos para Implementar la Solución

### 1. Crear archivo `.env`

```bash
cd /path/to/frontend-desktop
cat > .env << 'EOF'
# CloudFront Domain
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
EOF
```

### 2. Verificar que el archivo existe

```bash
cat .env
```

### 3. Limpiar builds anteriores

```bash
rm -rf dist/
rm -rf release/
rm -rf out/
```

### 4. Hacer un nuevo build

```bash
# Para Windows
npm run electron:build:win

# Para macOS
npm run electron:build:mac
```

### 5. Verificar el build resultante

```bash
# Buscar referencias a S3 directo (no debería encontrar ninguna)
grep -r "musicaondeon.s3.eu-north-1.amazonaws.com" dist/

# Buscar referencias a CloudFront (debería encontrar)
grep -r "d2ozw1d1zbl64l.cloudfront.net" dist/
```

---

## 🔒 Configuración de CloudFront (si no está configurado)

Si CloudFront aún no está configurado correctamente:

### 1. Verificar origen de CloudFront

- **Origin Domain**: `musicaondeon.s3.eu-north-1.amazonaws.com`
- **Origin Access**: Usar OAI (Origin Access Identity)
- **Behavior**: Allow GET, HEAD, OPTIONS

### 2. Configurar políticas de S3

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity [ID]"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::musicaondeon/*"
    }
  ]
}
```

### 3. Bloquear acceso público directo a S3

En la configuración del bucket S3:
- ✅ **Block all public access**: Enabled
- ✅ Solo permitir acceso desde CloudFront

---

## 📋 Checklist de Verificación

Antes de hacer el próximo release:

- [ ] Archivo `.env` creado con `VITE_CLOUDFRONT_DOMAIN`
- [ ] Build limpio ejecutado (`rm -rf dist/ && npm run build`)
- [ ] Verificado que no hay URLs de S3 directo en `dist/`
- [ ] CloudFront configurado y funcionando
- [ ] S3 configurado para bloquear acceso público directo
- [ ] Probado en un entorno de prueba antes de release
- [ ] Documentación actualizada para otros desarrolladores

---

## 🐛 Debugging Adicional

Si después de implementar la solución aún hay problemas:

### Verificar en runtime (consola del navegador/Electron)

```javascript
// En la consola de DevTools de la aplicación
console.log('CloudFront Domain:', import.meta.env.VITE_CLOUDFRONT_DOMAIN);

// Probar la conversión manualmente
import { convertToCloudFrontUrl } from './src/lib/cloudfrontUrls.js';
console.log(convertToCloudFrontUrl('https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/test.mp3'));
// Debería devolver: https://d2ozw1d1zbl64l.cloudfront.net/musica/test.mp3
```

### Logs útiles

Buscar en los logs de la aplicación:
```
🔗 URL convertida a CloudFront: { original: ..., cloudfront: ... }
```

Si este log **no aparece**, significa que `convertToCloudFrontUrl()` no se está ejecutando.

---

## 📞 Soporte

Si después de seguir estos pasos el problema persiste:

1. Verificar que CloudFront esté desplegado y accesible
2. Verificar políticas de CORS en CloudFront
3. Revisar logs de CloudFront para ver qué requests están llegando
4. Contactar al equipo de infraestructura para revisar configuración de AWS

---

## 🎯 Resumen Ejecutivo

**Problema**: URLs de S3 directo causando errores 403 en producción.

**Causa**: Variable de entorno `VITE_CLOUDFRONT_DOMAIN` no configurada en tiempo de build.

**Solución**: Crear archivo `.env` con la variable antes de hacer el build.

**Tiempo estimado**: 5 minutos + tiempo de rebuild.

**Prioridad**: 🔴 **CRÍTICA** - La aplicación no funciona en producción sin esto.




