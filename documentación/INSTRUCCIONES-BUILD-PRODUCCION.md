# 🏗️ Instrucciones para Build de Producción

## ⚠️ IMPORTANTE: Configuración Obligatoria

Antes de hacer cualquier build de producción, **DEBES** configurar las variables de entorno.

---

## 📋 Paso a Paso

### 1. Configurar Variables de Entorno

#### Opción A: Crear archivo `.env` (Recomendado)

```bash
# Desde la raíz del proyecto
cp .env.template .env

# Editar el archivo .env con tus valores
nano .env  # o el editor que prefieras
```

Contenido mínimo del `.env`:

```bash
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

#### Opción B: Variables de entorno del sistema

**macOS/Linux:**
```bash
export VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

**Windows (PowerShell):**
```powershell
$env:VITE_CLOUDFRONT_DOMAIN="d2ozw1d1zbl64l.cloudfront.net"
```

**Windows (CMD):**
```cmd
set VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

---

### 2. Limpiar Builds Anteriores

```bash
# Eliminar carpetas de build anteriores
rm -rf dist/
rm -rf release/
rm -rf out/

# O en Windows (PowerShell):
Remove-Item -Recurse -Force dist, release, out
```

---

### 3. Ejecutar Build

#### Build para Windows

```bash
npm run electron:build:win
```

**Build sin firma (más rápido para testing):**
```bash
npm run electron:build:win -- --publish=never
```

#### Build para macOS

```bash
# Con firma (requiere certificado)
npm run electron:build:mac

# Sin firma (para desarrollo)
npm run electron:build:mac:unsigned
```

#### Build para ambas plataformas

```bash
npm run electron:build:all
```

---

### 4. Verificar el Build

Después del build, verifica que las URLs estén correctas:

```bash
# Buscar referencias a S3 directo (NO debería encontrar ninguna)
grep -r "musicaondeon.s3.eu-north-1.amazonaws.com" dist/

# Buscar referencias a CloudFront (SÍ debería encontrar)
grep -r "d2ozw1d1zbl64l.cloudfront.net" dist/
```

**Resultado esperado:**
- ❌ No debe haber URLs de `musicaondeon.s3.eu-north-1.amazonaws.com`
- ✅ Debe haber URLs de `d2ozw1d1zbl64l.cloudfront.net`

---

## 🚨 Problemas Comunes

### Error: "VITE_CLOUDFRONT_DOMAIN is not defined"

**Causa:** No se configuró la variable de entorno antes del build.

**Solución:**
```bash
# Verificar que el archivo .env existe
ls -la .env

# Verificar el contenido
cat .env

# Si no existe, crearlo:
cp env.template.txt .env
```

### Build exitoso pero aplicación muestra errores 403

**Causa:** El build se hizo sin la variable de entorno configurada.

**Solución:**
1. Configurar `.env` correctamente
2. Limpiar builds: `rm -rf dist/`
3. Hacer build nuevamente: `npm run electron:build:win`

### CloudFront devuelve 403

**Causa:** Configuración incorrecta de CloudFront o S3.

**Solución:** Ver [SOLUCION-PROBLEMA-PRODUCCION-S3.md](./SOLUCION-PROBLEMA-PRODUCCION-S3.md)

---

## 📦 Ubicación de los Archivos Generados

Después del build, los archivos se encuentran en:

```
release/
├── Ondeon-Smart-0.0.33-win-x64.exe         # Instalador Windows 64-bit
├── Ondeon-Smart-0.0.33-win-ia32.exe        # Instalador Windows 32-bit
├── Ondeon-Smart-0.0.33-x64.dmg             # Instalador macOS Intel
├── Ondeon-Smart-0.0.33-arm64.dmg           # Instalador macOS Apple Silicon
├── Ondeon-Smart-0.0.33-x64.zip             # Portable macOS Intel
└── Ondeon-Smart-0.0.33-arm64.zip           # Portable macOS Apple Silicon
```

---

## 🔐 Firma de Aplicaciones

### macOS (Code Signing)

```bash
# Verificar certificado disponible
security find-identity -v -p codesigning

# Build con firma
npm run electron:build:mac

# Notarización (Apple)
npm run notarize
```

### Windows (Code Signing)

Requiere certificado `.pfx` o `.p12`:

```bash
# Configurar variables de entorno
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your-password

# Build con firma
npm run electron:build:win
```

---

## 🧪 Testing del Build

### Probar localmente antes de release

```bash
# Ejecutar el instalador/app generado
# Windows:
./release/Ondeon-Smart-0.0.33-win-x64.exe

# macOS:
open ./release/Ondeon-Smart-0.0.33-x64.dmg
```

### Verificar funcionalidad

1. ✅ Aplicación inicia correctamente
2. ✅ Puede hacer login
3. ✅ Puede reproducir audio sin errores 403
4. ✅ Puede cambiar de canal
5. ✅ AutoDJ funciona correctamente
6. ✅ Contenido programado se reproduce

---

## 📊 Checklist Pre-Release

Antes de publicar un release:

- [ ] `.env` configurado con `VITE_CLOUDFRONT_DOMAIN`
- [ ] Versión actualizada en `package.json`
- [ ] Changelog actualizado
- [ ] Build limpio ejecutado
- [ ] Build verificado (sin URLs de S3 directo)
- [ ] Probado en máquina limpia (Windows Y macOS)
- [ ] Todos los tests pasan
- [ ] No hay errores en consola
- [ ] Audio se reproduce correctamente
- [ ] Firma de código aplicada (si aplica)
- [ ] Release notes preparadas

---

## 🚀 Publicación del Release

### GitHub Releases (Automático)

El proyecto está configurado para auto-update desde GitHub:

```bash
# 1. Crear tag de versión
git tag v0.0.34
git push origin v0.0.34

# 2. Subir archivos a GitHub Release
# (puede ser automático con electron-builder)
```

### Manual

1. Ir a: https://github.com/ondeon/ondeon-smart-releases/releases
2. Click "Draft a new release"
3. Crear tag (ej: v0.0.34)
4. Subir archivos desde `release/`
5. Escribir release notes
6. Publicar

---

## 📞 Soporte

Si tienes problemas durante el build:

1. Revisa los logs de error
2. Verifica que todas las dependencias estén instaladas
3. Limpia node_modules: `rm -rf node_modules && npm install`
4. Consulta [SOLUCION-PROBLEMA-PRODUCCION-S3.md](./SOLUCION-PROBLEMA-PRODUCCION-S3.md)

---

## 🎯 Comandos Rápidos de Referencia

```bash
# Setup inicial
cp .env.template .env
npm install

# Build completo (Windows)
rm -rf dist/ release/ && npm run electron:build:win

# Build completo (macOS)
rm -rf dist/ release/ && npm run electron:build:mac

# Verificar build
grep -r "s3.eu-north-1.amazonaws.com" dist/

# Testing local
./release/Ondeon-Smart-*.exe  # Windows
open ./release/Ondeon-Smart-*.dmg  # macOS
```

