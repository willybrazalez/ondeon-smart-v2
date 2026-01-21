# 🔐 Resolver Certificado Duplicado para Firma de Código

## 🚨 Problema Actual

Tienes **dos certificados idénticos** de "Developer ID Application: Ondeon Grupo SL." instalados en dos keychains diferentes:
- `System.keychain` (keychain del sistema)
- `login.keychain-db` (keychain de usuario)

Esto causa un error de ambigüedad cuando intentas firmar la app:
```
Developer ID Application: Ondeon Grupo SL. (K4TADJ2262): ambiguous
```

---

## ✅ Solución: Eliminar el certificado duplicado del keychain del sistema

### **Paso 1: Abrir "Acceso a llaveros" (Keychain Access)**

1. Abre **Spotlight** (Cmd + Espacio)
2. Escribe "Acceso a llaveros" o "Keychain Access"
3. Presiona Enter

### **Paso 2: Seleccionar el keychain del sistema**

1. En la barra lateral izquierda, sección **"Llaveros"**
2. Clic en **"Sistema"** (System)

### **Paso 3: Buscar el certificado**

1. En el campo de búsqueda (arriba a la derecha), escribe:
   ```
   Ondeon Grupo
   ```

2. Deberías ver el certificado:
   ```
   Developer ID Application: Ondeon Grupo SL. (K4TADJ2262)
   ```

### **Paso 4: Eliminar el certificado del keychain del sistema**

1. **Clic derecho** en el certificado
2. Selecciona **"Eliminar"** o **"Delete"**
3. Te pedirá tu **contraseña de administrador** → Ingrésala
4. Confirma la eliminación

### **Paso 5: Verificar que solo quede uno**

```bash
security find-identity -v -p codesigning
```

Ahora deberías ver **solo UN** certificado de Ondeon:
```
  4) 4B930682DF655FB17E7755F466223B8979D9F6F1 "Developer ID Application: Ondeon Grupo SL. (K4TADJ2262)"
```

---

## 🔧 Configurar Firma Automática

Una vez eliminado el duplicado, actualiza `package.json`:

```json
"mac": {
  ...
  "identity": "4B930682DF655FB17E7755F466223B8979D9F6F1",
  ...
}
```

---

## 🚀 Compilar con Firma

### **Sin notarización** (firma local):
```bash
npm run electron:build:mac
```

### **Con notarización** (distribución pública):

1. Crea variables de entorno:
```bash
export APPLE_ID="tu-email@ondeon.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="K4TADJ2262"
```

2. Compila y notariza:
```bash
npm run electron:build:mac
```

El proceso de notarización tarda **2-5 minutos**. Apple verificará la app y adjuntará el ticket de notarización.

---

## 📝 Generar Contraseña Específica de App

Para la notarización necesitas una **contraseña específica de app** (no tu contraseña normal de Apple ID):

1. Ve a https://appleid.apple.com
2. Inicia sesión con tu Apple ID
3. Ve a **Seguridad** → **Contraseñas específicas de app**
4. Clic en **"Generar contraseña"**
5. Dale un nombre: "Ondeon Smart Notarization"
6. Copia la contraseña generada (formato: xxxx-xxxx-xxxx-xxxx)
7. Guárdala en un lugar seguro

---

## 🎯 Estado Actual vs Objetivo

### **Estado Actual** (sin firma):
```bash
# Compilación actual
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac
```

**Resultado:**
- ✅ Genera DMG y ZIP
- ✅ Genera `latest-mac.yml`
- ✅ Funciona en tu Mac
- ⚠️ Sin firma
- ❌ Usuarios verán advertencia de seguridad
- ❌ Auto-actualización NO funciona

### **Objetivo** (con firma y notarización):
```bash
# Después de resolver el certificado duplicado
npm run electron:build:mac
```

**Resultado:**
- ✅ Genera DMG y ZIP
- ✅ Genera `latest-mac.yml`
- ✅ App firmada con Developer ID
- ✅ App notarizada por Apple
- ✅ Sin advertencias de seguridad
- ✅ **Auto-actualización funciona perfectamente**

---

## 🔍 Verificar que la firma funcionó

Después de compilar con firma, verifica:

```bash
# Ver firma de la app
codesign -dv --verbose=4 release/mac/Ondeon-Smart.app

# Ver notarización
spctl -a -vv release/mac/Ondeon-Smart.app
```

Deberías ver:
```
Authority=Developer ID Application: Ondeon Grupo SL. (K4TADJ2262)
```

---

## 📦 Publicar en GitHub Releases

Una vez firmado y notarizado:

```bash
./scripts/publish-release.sh 0.0.19
```

Esto subirá:
- `Ondeon-Smart-0.0.19-x64.dmg` (Intel)
- `Ondeon-Smart-0.0.19-arm64.dmg` (Apple Silicon)
- `Ondeon-Smart-0.0.19-x64.zip` (Intel)
- `Ondeon-Smart-0.0.19-arm64.zip` (Apple Silicon)
- `latest-mac.yml` (metadata)
- Y todos los archivos de Windows

---

## ⚡ Solución Temporal (ACTUAL)

Mientras resuelves el certificado, puedes usar:

### **Compilar sin firma:**
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac
```

### **Publicar en GitHub:**
```bash
./scripts/publish-release.sh 0.0.19
```

### **Resultado:**
- ✅ Archivos disponibles para descarga
- ✅ `latest-mac.yml` resuelve el error 404
- ⚠️ Los usuarios deberán instalar manualmente (clic derecho > Abrir)
- ❌ Auto-actualización no funciona hasta que firmes

---

## 🎓 Resumen

1. **AHORA:** Compila sin firma → funciona pero con advertencias
2. **Elimina el certificado duplicado** → usa "Acceso a llaveros"
3. **Actualiza package.json** → agrega el hash del certificado
4. **Compila con firma** → apps firmadas profesionalmente
5. **Configura notarización** (opcional) → distribución sin advertencias
6. **Publica en GitHub** → auto-actualización funciona

---

## 📞 Ayuda

Si tienes problemas:

1. Verifica certificados:
```bash
security find-identity -v -p codesigning
```

2. Verifica que solo hay uno de Ondeon

3. Compila sin firma primero para verificar que todo funciona

4. Luego agrega la firma

---

**Última actualización:** 28 de octubre de 2025  
**Versión actual:** 0.0.19 (sin firma)  
**Próximo paso:** Eliminar certificado duplicado

