# 🔧 Configuración de Variables de Entorno

## 📋 Variables Necesarias

### VITE_CLOUDFRONT_DOMAIN

**Descripción**: Dominio de CloudFront para servir archivos de S3 de forma segura.

**Valor actual**: `d2ozw1d1zbl64l.cloudfront.net`

**Dónde se usa**: 
- `src/lib/cloudfrontUrls.js` - Conversión de URLs de S3 a CloudFront
- Todos los servicios que reproducen audio o contenido

---

## 📁 Dónde Guardar las Variables de Entorno

### Opción 1: Archivo `.env` (Recomendado para desarrollo local)

1. **Crear archivo `.env` en la raíz del proyecto** (mismo nivel que `package.json`)

2. **Agregar la variable**:
```bash
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

3. **El archivo `.env` debe estar en `.gitignore`** (no se sube al repositorio)

### Opción 2: Archivo `.env.local` (Alternativa)

Similar a `.env` pero tiene prioridad y es específico para tu máquina local.

```bash
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

### Opción 3: Variables de Entorno del Sistema

Puedes configurar variables de entorno directamente en tu sistema:

**macOS/Linux**:
```bash
export VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

**Windows (PowerShell)**:
```powershell
$env:VITE_CLOUDFRONT_DOMAIN="d2ozw1d1zbl64l.cloudfront.net"
```

---

## 🚀 Para Producción/Despliegue

### Vercel/Netlify/Vite Hosting

Configurar en el panel de control del hosting:
- Variable: `VITE_CLOUDFRONT_DOMAIN`
- Valor: `d2ozw1d1zbl64l.cloudfront.net`

### Electron (Aplicación Desktop)

Las variables de entorno funcionan igual. Asegúrate de que `.env` esté en la raíz del proyecto.

---

## ✅ Verificar que Funciona

1. **Reiniciar el servidor de desarrollo** después de crear/modificar `.env`:
```bash
npm run dev
```

2. **Verificar en la consola del navegador**:
```javascript
console.log(import.meta.env.VITE_CLOUDFRONT_DOMAIN);
// Debe mostrar: d2ozw1d1zbl64l.cloudfront.net
```

3. **Probar reproducción de audio** - Las URLs deben convertirse automáticamente a CloudFront

---

## 📝 Notas Importantes

- ⚠️ **Las variables deben empezar con `VITE_`** para ser accesibles desde el código del cliente
- ⚠️ **Reiniciar el servidor** después de cambiar variables de entorno
- ⚠️ **`.env` no debe subirse a Git** - ya debería estar en `.gitignore`
- ✅ **`.env.example`** puede subirse como plantilla (sin valores sensibles)

---

## 🔄 Si Cambias el Dominio de CloudFront

Si en el futuro cambias el dominio de CloudFront:

1. Actualizar `.env` con el nuevo dominio
2. Reiniciar el servidor de desarrollo
3. Las URLs se convertirán automáticamente al nuevo dominio

