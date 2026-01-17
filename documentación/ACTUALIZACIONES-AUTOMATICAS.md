# 🔄 Sistema de Actualizaciones Automáticas

## 📋 Resumen

**Ondeon Smart** utiliza `electron-updater` con **GitHub Releases** para distribuir actualizaciones automáticas tanto en Windows como en macOS.

---

## ✅ Cómo funciona (ambas plataformas)

### 1️⃣ **Al iniciar la aplicación:**
- Espera 5 segundos
- Se conecta a `github.com/ondeon/ondeon-smart-releases`
- Compara la versión actual con la última publicada
- Descarga automáticamente si hay una nueva versión

### 2️⃣ **Durante la descarga:**
- Muestra progreso en consola
- Notifica al usuario cuando está disponible
- No interrumpe el uso de la aplicación

### 3️⃣ **Al completar la descarga:**
- Notifica que está lista para instalar
- Espera 3 segundos
- Reinicia e instala automáticamente

---

## 🪟 Windows - Configuración actual

### ✅ **Estado:** FUNCIONANDO

**Archivos generados:**
```
Ondeon-Smart-0.0.19.exe         (241MB) - Universal installer
Ondeon-Smart-0.0.19-x64.exe     (124MB) - 64-bit only
Ondeon-Smart-0.0.19-ia32.exe    (118MB) - 32-bit only
latest.yml                      (metadata)
```

**Características:**
- ✅ Actualizaciones automáticas funcionan **con o sin firma**
- ✅ Instalador NSIS con opciones de usuario
- ✅ Soporte para 32 y 64 bits
- ✅ Auto-inicio opcional durante instalación
- ✅ Delta updates (solo descarga diferencias)

**Firma de código (opcional pero recomendada):**
- Sin firma: Windows SmartScreen puede mostrar advertencia
- Con firma: Instalación sin advertencias

---

## 🍎 macOS - Configuración nueva

### ⚠️ **Estado:** CONFIGURADO pero SIN FIRMAR

**Archivos generados:**
```
Ondeon-Smart-0.0.19-x64.dmg      (168MB) - Intel Macs
Ondeon-Smart-0.0.19-arm64.dmg    (163MB) - Apple Silicon (M1/M2/M3)
Ondeon-Smart-0.0.19-x64.zip      (161MB) - Intel Macs
Ondeon-Smart-0.0.19-arm64.zip    (156MB) - Apple Silicon
latest-mac.yml                   (metadata)
```

**Características:**
- ✅ Soporte universal (Intel + Apple Silicon)
- ✅ DMG para instalación manual
- ✅ ZIP para actualizaciones automáticas
- ⚠️ **REQUIERE FIRMA para auto-actualización**

### 🔐 **CRÍTICO: Firma de código en Mac**

A diferencia de Windows, **macOS Gatekeeper BLOQUEA** las actualizaciones automáticas de apps sin firmar.

**Sin firma de código:**
- ❌ Actualizaciones automáticas NO funcionan
- ⚠️ Usuario ve advertencia "desarrollador no identificado"
- ⚠️ Debe hacer clic derecho > Abrir para ejecutar
- ✅ Funciona perfectamente en tu Mac de desarrollo

**Con firma de código:**
- ✅ Actualizaciones automáticas funcionan
- ✅ Sin advertencias de seguridad
- ✅ Distribución profesional
- ✅ Puede distribuirse fuera de la App Store

---

## 🔐 Configurar Firma de Código para Mac

### **Requisitos:**

1. **Cuenta de Apple Developer** ($99/año)
2. **Certificado "Developer ID Application"** (ya lo tienes: K4TADJ2262)
3. **Resolver certificado duplicado** (tienes el mismo en 2 keychains)
4. **Credenciales de notarización:**
   - Apple ID
   - Contraseña específica de app
   - Team ID (ya tienes: K4TADJ2262)

### **Paso 1: Resolver certificado duplicado**

```bash
# Ver certificados disponibles
security find-identity -v -p codesigning

# Eliminar duplicado del keychain del sistema
# (mantener solo el de login.keychain-db)
```

### **Paso 2: Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto:

```bash
# .env (NO SUBIR A GIT)
APPLE_ID=tu-apple-id@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=K4TADJ2262
```

### **Paso 3: Compilar con firma**

```bash
# Compilar con firma automática
npm run electron:build:mac

# El proceso:
# 1. Compila la app
# 2. Firma con Developer ID
# 3. Sube a Apple para notarización
# 4. Apple valida (tarda 2-5 minutos)
# 5. Descarga y adjunta el ticket de notarización
# 6. Genera los instaladores finales
```

---

## 📦 Proceso de Publicación

### **1. Incrementar versión**

```bash
npm run release:patch  # 0.0.19 -> 0.0.20
npm run release:minor  # 0.0.19 -> 0.1.0
npm run release:major  # 0.0.19 -> 1.0.0
```

### **2. Compilar para ambas plataformas**

```bash
# Solo Windows (si estás en Windows)
npm run electron:build:win

# Solo Mac (si estás en Mac)
npm run electron:build:mac

# Ambos (si estás en Mac)
npm run electron:build:all
```

### **3. Subir a GitHub Releases**

```bash
# Crear release en GitHub
gh release create v0.0.20 \
  release/Ondeon-Smart-0.0.20.exe \
  release/Ondeon-Smart-0.0.20-x64.exe \
  release/Ondeon-Smart-0.0.20-ia32.exe \
  release/Ondeon-Smart-0.0.20-x64.dmg \
  release/Ondeon-Smart-0.0.20-arm64.dmg \
  release/Ondeon-Smart-0.0.20-x64.zip \
  release/Ondeon-Smart-0.0.20-arm64.zip \
  release/latest.yml \
  release/latest-mac.yml \
  --title "v0.0.20" \
  --notes "Descripción de cambios"
```

### **4. Archivos necesarios en GitHub Release**

#### Para Windows:
- `Ondeon-Smart-X.X.X.exe` (instalador universal)
- `Ondeon-Smart-X.X.X-x64.exe` (64-bit)
- `Ondeon-Smart-X.X.X-ia32.exe` (32-bit)
- `latest.yml` (metadata para actualizaciones)

#### Para Mac:
- `Ondeon-Smart-X.X.X-x64.dmg` (Intel, instalación manual)
- `Ondeon-Smart-X.X.X-arm64.dmg` (Apple Silicon, instalación manual)
- `Ondeon-Smart-X.X.X-x64.zip` (Intel, auto-actualización)
- `Ondeon-Smart-X.X.X-arm64.zip` (Apple Silicon, auto-actualización)
- `latest-mac.yml` (metadata para actualizaciones)

---

## 🔍 Detección de Plataforma y Arquitectura

**electron-updater detecta automáticamente:**

| Usuario tiene | Descarga |
|---------------|----------|
| Windows 64-bit | `Ondeon-Smart-X.X.X-x64.exe` |
| Windows 32-bit | `Ondeon-Smart-X.X.X-ia32.exe` |
| Mac Intel | `Ondeon-Smart-X.X.X-x64.zip` |
| Mac Apple Silicon (M1/M2/M3) | `Ondeon-Smart-X.X.X-arm64.zip` |

No necesitas código adicional, `electron-updater` lo maneja solo.

---

## 🧪 Probar Actualizaciones (Desarrollo)

### **Simular actualización:**

1. Cambia la versión en `package.json` a una inferior:
   ```json
   "version": "0.0.18"
   ```

2. Compila:
   ```bash
   npm run electron:build:mac  # o :win
   ```

3. Ejecuta la app compilada

4. La app detectará la versión 0.0.19 en GitHub y descargará

### **Ver logs de actualización:**

- **Consola de DevTools** (Cmd/Ctrl + Shift + I)
- **Archivo de logs:**
  - macOS: `~/Library/Application Support/Ondeon-Smart/logs/main.log`
  - Windows: `%APPDATA%\Ondeon-Smart\logs\main.log`

---

## ⚙️ Configuración en código

### `electron/main.cjs` (líneas 139-148):

```javascript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'ondeon',
  repo: 'ondeon-smart-releases'  // ← Repositorio PÚBLICO
});
```

### `package.json` (build config):

```json
"build": {
  "appId": "com.ondeon.smart",
  "productName": "Ondeon-Smart",
  "publish": {
    "provider": "github",
    "owner": "ondeon",
    "repo": "ondeon-smart-releases"
  }
}
```

---

## 📊 Formato de `latest.yml` y `latest-mac.yml`

Estos archivos se generan automáticamente al compilar:

### `latest.yml` (Windows):
```yaml
version: 0.0.19
files:
  - url: Ondeon-Smart-0.0.19.exe
    sha512: [hash]
    size: 253113735
  - url: Ondeon-Smart-0.0.19-x64.exe
    sha512: [hash]
    size: 130007879
releaseDate: '2025-10-27T19:03:45.362Z'
```

### `latest-mac.yml` (Mac):
```yaml
version: 0.0.19
files:
  - url: Ondeon-Smart-0.0.19-x64.zip
    sha512: [hash]
    size: [size]
  - url: Ondeon-Smart-0.0.19-arm64.zip
    sha512: [hash]
    size: [size]
releaseDate: '2025-10-28T12:00:00.000Z'
```

---

## 🚨 Solución de Problemas

### **"Error verificando actualizaciones"**

**Posibles causas:**
- Repositorio no existe o es privado
- Sin conexión a Internet
- GitHub temporalmente no disponible

**Solución:**
- Verificar que el repositorio sea público
- Verificar que exista un release con los archivos correctos

### **"Actualización descargada pero no se instala" (Mac)**

**Causa:** App sin firmar

**Solución:**
- Firmar la app con certificado Developer ID
- O instalar manualmente desde el DMG

### **"Certificado ambiguo" (Mac)**

**Causa:** Mismo certificado en múltiples keychains

**Solución:**
```bash
# Eliminar del keychain del sistema
sudo security delete-identity \
  -c "Developer ID Application: Ondeon Grupo SL." \
  /Library/Keychains/System.keychain
```

---

## 📝 Checklist de Publicación

- [ ] Incrementar versión en `package.json`
- [ ] Compilar para Windows
- [ ] Compilar para Mac (con firma si es posible)
- [ ] Verificar que se generaron todos los archivos
- [ ] Crear GitHub Release con la nueva versión
- [ ] Subir todos los ejecutables e instaladores
- [ ] Subir `latest.yml` y `latest-mac.yml`
- [ ] Probar descarga manual desde GitHub
- [ ] Probar actualización automática desde versión anterior

---

## 🎯 Estado Actual (v0.0.19)

| Plataforma | Build | Firma | Auto-actualización |
|------------|-------|-------|-------------------|
| Windows x64 | ✅ | ❌ | ✅ (funciona sin firma) |
| Windows ia32 | ✅ | ❌ | ✅ (funciona sin firma) |
| Mac Intel | ✅ | ❌ | ⚠️ (requiere firma) |
| Mac Apple Silicon | ✅ | ❌ | ⚠️ (requiere firma) |

---

## 📚 Recursos

- [electron-updater docs](https://www.electron.build/auto-update)
- [Firma de código en Mac](https://developer.apple.com/support/code-signing/)
- [GitHub Releases API](https://docs.github.com/es/rest/releases)
- [Notarización de apps Mac](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

**Última actualización:** 28 de octubre de 2025  
**Versión actual:** 0.0.19

