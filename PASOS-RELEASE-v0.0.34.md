# 🚀 Pasos para Release v0.0.34 (Fix CloudFront)

## 📋 Checklist Pre-Release

### 1. Configurar Variables de Entorno

```bash
# Crear archivo .env
cp env.template.txt .env

# Verificar contenido
cat .env
# Debe contener: VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

### 2. Actualizar Versión

```bash
# Editar package.json
# Cambiar: "version": "0.0.33" → "version": "0.0.34"
```

O usar npm:
```bash
npm version patch  # Incrementa de 0.0.33 a 0.0.34
```

### 3. Limpiar Builds Anteriores

```bash
rm -rf dist/
rm -rf release/
rm -rf out/
rm -rf node_modules/.vite
```

### 4. Verificar que el código está actualizado

```bash
# Verificar que tienes el commit de CloudFront
git log --oneline | grep -i cloudfront

# Debe aparecer:
# 3bc6514 feat: implement CloudFront integration for S3 URLs
```

### 5. Build de Producción

#### Windows

```bash
npm run electron:build:win
```

#### macOS

```bash
# Con firma
npm run electron:build:mac

# Sin firma (para testing)
npm run electron:build:mac:unsigned
```

### 6. Verificar el Build

```bash
# NO debe encontrar URLs de S3 directo
grep -r "musicaondeon.s3.eu-north-1.amazonaws.com" dist/

# SÍ debe encontrar URLs de CloudFront
grep -r "d2ozw1d1zbl64l.cloudfront.net" dist/
```

**Resultado esperado:**
```
✅ No se encontraron URLs de S3 directo
✅ Se encontraron URLs de CloudFront en varios archivos
```

### 7. Testing Local

#### Probar el instalador localmente

```bash
# Windows
./release/Ondeon-Smart-0.0.34-win-x64.exe

# macOS
open ./release/Ondeon-Smart-0.0.34-x64.dmg
```

#### Verificar funcionalidad

- [ ] ✅ Aplicación inicia correctamente
- [ ] ✅ Login funciona
- [ ] ✅ **Audio se reproduce SIN errores 403**
- [ ] ✅ AutoDJ cambia de canción correctamente
- [ ] ✅ Contenido programado se reproduce
- [ ] ✅ No hay errores en consola relacionados con S3

### 8. Commit y Tag

```bash
# Commit del cambio de versión
git add package.json package-lock.json
git commit -m "chore: release v0.0.34 - fix CloudFront URLs"

# Crear tag
git tag v0.0.34

# Push
git push origin main
git push origin v0.0.34
```

### 9. Publicar Release en GitHub

#### Opción A: Manual

1. Ir a: https://github.com/ondeon/ondeon-smart-releases/releases
2. Click "Draft a new release"
3. Tag: `v0.0.34`
4. Title: `v0.0.34 - Fix CloudFront URLs (403 errors)`
5. Descripción:

```markdown
## 🔧 Correcciones

- ✅ **FIX CRÍTICO**: Resuelve errores 403 al cargar audio en producción
- ✅ Implementa conversión automática de URLs de S3 a CloudFront
- ✅ Mejora significativa en la carga de archivos de audio

## 📦 Cambios Técnicos

- Implementada función `convertToCloudFrontUrl()` para todas las URLs de audio
- Configurada variable de entorno `VITE_CLOUDFRONT_DOMAIN`
- Optimizada distribución de contenido mediante CloudFront

## ⚠️ Notas Importantes

Esta actualización resuelve el problema crítico donde la aplicación no podía reproducir 
audio en producción (errores 403 Forbidden). **Se recomienda actualizar inmediatamente.**

## 🔄 Auto-Update

La aplicación se actualizará automáticamente en el próximo inicio.
```

6. Subir archivos:
   - `Ondeon-Smart-0.0.34-win-x64.exe`
   - `Ondeon-Smart-0.0.34-win-ia32.exe`
   - `Ondeon-Smart-0.0.34-x64.dmg` (macOS Intel)
   - `Ondeon-Smart-0.0.34-arm64.dmg` (macOS Apple Silicon)
   - `latest.yml` (para auto-update Windows)
   - `latest-mac.yml` (para auto-update macOS)

7. Publicar release

#### Opción B: Automático (si está configurado)

```bash
# electron-builder puede publicar automáticamente
npm run electron:build:win -- --publish always
npm run electron:build:mac -- --publish always
```

### 10. Verificar Auto-Update

Después de publicar:

1. Abrir una instalación antigua (v0.0.33)
2. La app debe detectar la actualización
3. Descargar e instalar v0.0.34 automáticamente

---

## 📊 Comparación de Versiones

| Versión | Fecha | CloudFront | Estado Audio |
|---------|-------|------------|--------------|
| v0.0.33 | 16 Nov | ❌ No | ❌ 403 Errors |
| v0.0.34 | 18 Nov | ✅ Sí | ✅ Funciona |

---

## 🐛 Troubleshooting

### El build sigue teniendo URLs de S3 directo

**Causa:** No se configuró `.env` o no se limpió el build anterior.

**Solución:**
```bash
rm -rf dist/ node_modules/.vite
cp env.template.txt .env
npm run electron:build:win
```

### Auto-update no funciona

**Causa:** Los archivos `latest.yml` no se publicaron correctamente.

**Solución:** Verificar que `latest.yml` y `latest-mac.yml` estén en el release de GitHub.

### Usuarios reportan que sigue sin funcionar

**Causa:** Los usuarios están usando una versión cacheada o no se actualizó.

**Solución:**
1. Verificar que el release v0.0.34 esté publicado en GitHub
2. Pedir a los usuarios que reinstalen manualmente
3. Verificar que `electron-updater` está funcionando correctamente

---

## ✅ Checklist Final

Antes de marcar como completado:

- [ ] `.env` configurado correctamente
- [ ] Versión actualizada a 0.0.34 en `package.json`
- [ ] Build limpio ejecutado
- [ ] Build verificado (sin URLs de S3 directo)
- [ ] Probado localmente en Windows Y macOS
- [ ] Audio se reproduce sin errores 403
- [ ] Commit y tag creados
- [ ] Release publicado en GitHub
- [ ] Instaladores subidos correctamente
- [ ] Auto-update verificado
- [ ] Documentación actualizada

---

## 🎯 Resumen Ejecutivo

**Problema:** v0.0.33 no incluye el código de CloudFront (commit del 17 Nov)

**Solución:** Release v0.0.34 con CloudFront implementado + `.env` configurado

**Tiempo estimado:** 30-45 minutos (incluyendo builds y testing)

**Prioridad:** 🔴 **CRÍTICA** - Usuarios en producción no pueden usar la aplicación




