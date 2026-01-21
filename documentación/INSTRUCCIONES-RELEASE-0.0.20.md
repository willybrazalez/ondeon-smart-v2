# 📦 Release v0.0.20 - Instrucciones de Publicación

## ✅ Archivos listos para subir

### **Para Windows:**
- `Ondeon-Smart-0.0.20.exe` (241M) - Instalador completo
- `Ondeon-Smart-0.0.20-x64.exe` (124M) - Instalador 64-bit
- `Ondeon-Smart-0.0.20-ia32.exe` (118M) - Instalador 32-bit
- `Ondeon-Smart-0.0.20.exe.blockmap` (258K)
- `Ondeon-Smart-0.0.20-x64.exe.blockmap` (134K)
- `Ondeon-Smart-0.0.20-ia32.exe.blockmap` (127K)
- `latest.yml` (661B) - **IMPORTANTE para auto-updates**

### **Para Mac:**
- `Ondeon-Smart-darwin-arm64-0.0.20.zip` (2.9G) - **IMPORTANTE para auto-updates**
- `Ondeon-Smart-0.0.20-arm64.dmg` (2.8G) - Para descarga manual
- `latest-mac.yml` (371B) - **IMPORTANTE para auto-updates**

---

## 🚀 Pasos para publicar en GitHub

### **Opción 1: Interfaz Web de GitHub** (Recomendado)

1. Ve a tu repositorio: `https://github.com/ondeon/ondeon-smart-releases`
2. Haz clic en **"Releases"** en el menú lateral derecho
3. Haz clic en **"Draft a new release"**
4. Configura el release:
   - **Tag version:** `v0.0.20`
   - **Release title:** `Ondeon Smart v0.0.20`
   - **Description:** Escribe las novedades de esta versión
5. **Arrastra y suelta** todos los archivos listados arriba (10 archivos en total)
6. Marca la casilla **"Set as the latest release"**
7. Haz clic en **"Publish release"**

### **Opción 2: GitHub CLI** (Más rápido)

```bash
cd "/Users/willymac/Desktop/MACBOOK PRO 2015/ONDEON/Nuevo ONDEON/frontend-desktop/release"

# Crear el release
gh release create v0.0.20 \
  --repo ondeon/ondeon-smart-releases \
  --title "Ondeon Smart v0.0.20" \
  --notes "Nueva versión con soporte para Mac (Apple Silicon)" \
  Ondeon-Smart-0.0.20.exe \
  Ondeon-Smart-0.0.20-x64.exe \
  Ondeon-Smart-0.0.20-ia32.exe \
  Ondeon-Smart-0.0.20.exe.blockmap \
  Ondeon-Smart-0.0.20-x64.exe.blockmap \
  Ondeon-Smart-0.0.20-ia32.exe.blockmap \
  Ondeon-Smart-darwin-arm64-0.0.20.zip \
  Ondeon-Smart-0.0.20-arm64.dmg \
  latest.yml \
  latest-mac.yml
```

---

## ⚠️ Importante

### **Verificaciones antes de publicar:**
- ✅ Los archivos Windows están firmados digitalmente
- ✅ La aplicación Mac está firmada con tu Developer ID
- ✅ Los archivos `latest.yml` y `latest-mac.yml` tienen los checksums correctos
- ✅ La versión en `package.json` es `0.0.20`

### **Después de publicar:**
- El sistema de auto-updates detectará automáticamente la nueva versión
- Windows buscará `latest.yml` y descargará el `.exe` correspondiente
- Mac buscará `latest-mac.yml` y descargará el `.zip`
- Los usuarios recibirán una notificación para actualizar

---

## 📝 Notas

- **Los archivos `.blockmap`** son opcionales pero mejoran la velocidad de descarga incremental
- **El archivo `.dmg`** es solo para descarga manual desde el navegador
- **El archivo `.zip`** es el que usa `electron-updater` para actualizaciones automáticas en Mac
- **Ambos sistemas conviven sin problema** en el mismo release

---

## 🔄 Actualizaciones futuras

Para futuras versiones, repite este proceso:
1. Actualiza la versión en `package.json`
2. Ejecuta `npm run electron:build:win`
3. Ejecuta `npm run electron:build:mac:forge`
4. Los archivos YAML se generan automáticamente en `/release`
5. Sube todo a un nuevo release en GitHub

