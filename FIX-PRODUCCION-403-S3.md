# 🚨 FIX URGENTE: Errores 403 en Producción

## El Problema

La aplicación en **producción** muestra errores 403 al intentar reproducir audio:

```
❌ GET https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/ondeon/cancion.mp3 403 (Forbidden)
❌ Error en audio: MEDIA_ERR_SRC_NOT_SUPPORTED
```

✅ En **desarrollo** funciona perfectamente.
❌ En **producción** (Electron builds) falla.

---

## La Causa

La variable de entorno `VITE_CLOUDFRONT_DOMAIN` **no está configurada** durante el build de producción, por lo que las URLs de audio NO se convierten de S3 a CloudFront.

---

## La Solución (5 minutos)

### Paso 1: Crear archivo `.env`

```bash
# Desde la raíz del proyecto
cp env.template.txt .env
```

El archivo `.env` debe contener:

```bash
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

### Paso 2: Limpiar builds anteriores

```bash
rm -rf dist/ release/ out/
```

### Paso 3: Hacer nuevo build

```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac
```

### Paso 4: Verificar que funciona

```bash
# NO debe encontrar URLs de S3 directo
grep -r "musicaondeon.s3.eu-north-1.amazonaws.com" dist/

# SÍ debe encontrar URLs de CloudFront
grep -r "d2ozw1d1zbl64l.cloudfront.net" dist/
```

---

## ¿Por qué pasa esto?

1. El código **SÍ tiene** la función `convertToCloudFrontUrl()` que convierte URLs de S3 a CloudFront
2. Pero Vite necesita la variable de entorno **en tiempo de build** para que funcione
3. Sin el archivo `.env`, la variable es `undefined` y algo falla en la conversión
4. El build resultante intenta acceder directamente a S3, que devuelve 403

---

## Documentación Completa

- 📖 [Solución detallada](./documentación/SOLUCION-PROBLEMA-PRODUCCION-S3.md)
- 🏗️ [Instrucciones de build](./documentación/INSTRUCCIONES-BUILD-PRODUCCION.md)
- 🔧 [Configuración de CloudFront](./documentación/GUIA-CLOUDFRONT-PASO-A-PASO.md)

---

## Verificación Rápida

Después de implementar el fix:

```bash
# 1. Verificar que .env existe
cat .env

# 2. Limpiar
rm -rf dist/

# 3. Build
npm run electron:build:win

# 4. Verificar
grep -r "s3.eu-north-1" dist/  # No debe encontrar nada
```

---

## Siguiente Release

Para el próximo release (v0.0.34):

1. ✅ Asegurar que `.env` está configurado
2. ✅ Build limpio
3. ✅ Verificar que no hay URLs de S3 directo en `dist/`
4. ✅ Probar en un entorno limpio antes de publicar

**Prioridad: 🔴 CRÍTICA** - La aplicación NO funciona en producción sin este fix.

