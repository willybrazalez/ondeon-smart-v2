# Ondeon SMART - Aplicación de Escritorio y Web

Aplicación multiplataforma para el sistema de reproducción automática de Ondeon SMART.

## ⚠️ CONFIGURACIÓN OBLIGATORIA

**IMPORTANTE:** Antes de hacer cualquier build, debes configurar las variables de entorno:

```bash
# 1. Copiar el template
cp env.template.txt .env

# 2. El archivo .env debe contener:
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
```

Sin esta configuración, la aplicación **fallará en producción** con errores 403 al cargar audio.

📖 **Documentación completa:** [FIX-PRODUCCION-403-S3.md](./FIX-PRODUCCION-403-S3.md)

---

## 🖥️ Build de Aplicación de Escritorio (Electron)

### Requisitos Previos

1. Node.js 18.x o superior
2. npm o yarn
3. Variables de entorno configuradas (ver arriba)

### Instalación

```bash
npm install
```

### Build para Producción

```bash
# Limpiar builds anteriores
rm -rf dist/ release/ out/

# Windows
npm run electron:build:win

# macOS (con firma)
npm run electron:build:mac

# macOS (sin firma - desarrollo)
npm run electron:build:mac:unsigned

# Ambas plataformas
npm run electron:build:all
```

### Desarrollo

```bash
# Modo desarrollo (hot reload)
npm run electron:dev

# Solo web (sin Electron)
npm run dev
```

📖 **Instrucciones detalladas:** [INSTRUCCIONES-BUILD-PRODUCCION.md](./documentación/INSTRUCCIONES-BUILD-PRODUCCION.md)

---

## 🌐 Despliegue Web (AWS Amplify)

### Configuración Automática

1. **Conectar repositorio a Amplify:**
   - Ve a la consola de AWS Amplify
   - Selecciona "New app" > "Host web app"
   - Conecta tu repositorio de GitHub/GitLab/Bitbucket
   - Selecciona la rama principal (main/master)

2. **Configuración de build:**
   - El archivo `amplify.yml` ya está configurado
   - Build settings:
     - Build command: `npm run build`
     - Output directory: `dist`
     - Node.js version: 18.x (recomendado)

3. **Variables de entorno:**
   - Configura las siguientes variables en Amplify:
     ```
     VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net
     VITE_SUPABASE_URL=tu_url_de_supabase
     VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
     ```

### Configuración Manual

Si necesitas configurar manualmente:

1. **Instalar dependencias:**
   ```bash
   npm ci
   ```

2. **Build de producción:**
   ```bash
   npm run build
   ```

3. **Archivos de salida:**
   - Los archivos se generan en la carpeta `dist/`
   - Amplify servirá estos archivos automáticamente

### Características del Despliegue

- ✅ **SPA Routing:** Configurado con `_redirects` para React Router
- ✅ **Optimización:** Build optimizado con Vite
- ✅ **Caché:** Configurado para mejorar rendimiento
- ✅ **HTTPS:** Automático en Amplify
- ✅ **CDN:** Distribución global automática

### Estructura del Proyecto

```
frontend-desktop/
├── src/                    # Código fuente
├── public/                 # Archivos estáticos
├── dist/                   # Build de producción
├── amplify.yml            # Configuración de Amplify
├── _redirects             # Redirecciones SPA
└── package.json           # Dependencias y scripts
```

### Notas Importantes

- **Electron:** Este proyecto también incluye configuración para Electron (desktop), pero Amplify solo despliega la versión web
- **Variables de entorno:** Asegúrate de configurar las variables de Supabase en la consola de Amplify
- **Dominio personalizado:** Puedes configurar un dominio personalizado en la consola de Amplify

### Troubleshooting

#### 🚨 Error 403 al cargar audio en producción

**Síntoma:** La aplicación funciona en desarrollo pero falla en producción con:
```
GET https://musicaondeon.s3.eu-north-1.amazonaws.com/musica/... 403 (Forbidden)
```

**Causa:** Falta configurar `VITE_CLOUDFRONT_DOMAIN` antes del build.

**Solución:**
```bash
# 1. Crear .env
cp .env.template .env

# 2. Limpiar y rebuild
rm -rf dist/ release/
npm run electron:build:win  # o :mac
```

📖 **Documentación completa:** [FIX-PRODUCCION-403-S3.md](./FIX-PRODUCCION-403-S3.md)

#### Otros problemas comunes

1. **Build falla:** Revisa los logs en la consola de Amplify
2. **Variables de entorno:** Verifica que estén configuradas correctamente
3. **Rutas no funcionan:** Confirma que el archivo `_redirects` esté en `public/`
4. **Electron no inicia:** Ejecuta `npm install` y verifica versión de Node.js

### Soporte

- 📖 [Documentación completa](./documentación/)
- 🔧 [Guía de CloudFront](./documentación/GUIA-CLOUDFRONT-PASO-A-PASO.md)
- 🐛 [Issues en GitHub](https://github.com/ondeon/ondeon-smart-releases/issues)
- 📧 Para problemas específicos de Amplify, consulta la [documentación oficial de AWS Amplify](https://docs.aws.amazon.com/amplify/) 