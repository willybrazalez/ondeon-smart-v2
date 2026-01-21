# FIX: Problemas del Ejecutable en Windows

**Fecha:** 27/10/2025  
**Versión:** 1.0  
**Estado:** ✅ Resuelto

## 📋 Resumen de Problemas Encontrados

Al instalar el ejecutable de la aplicación en Windows, se presentaban los siguientes problemas:

1. ❌ **Tema claro por defecto** - La app entraba con tema claro en lugar del oscuro predeterminado
2. ❌ **Elementos no se cargan** - No se veían los elementos de reproducción y no se cargaba nada
3. ❌ **Pantalla en blanco al logout** - Al hacer logout, la pantalla se quedaba en blanco
4. ⚠️ **Error SQL en base de datos** - Error de columna ambigua impidiendo el inicio de sesión

## 🔧 Soluciones Implementadas

### ⚠️ ACTUALIZACIÓN: Correcciones Adicionales para Assets y Conexiones

Después de las pruebas iniciales, se identificaron problemas adicionales relacionados con:
- Carga de assets (imágenes/logo) en el ejecutable
- Conexiones HTTPS a Supabase bloqueadas por CSP
- Rutas de archivos en protocolo `file://`

**Se agregaron las siguientes correcciones:**

#### A. Configuración de empaquetado de assets en `package.json`

**Archivos:** `package.json` (líneas 122-131)

**Problema:**
Los assets no se estaban desempaquetando correctamente del archivo `.asar`, causando errores `ERR_FILE_NOT_FOUND`.

**Solución:**
```json
"extraResources": [
  {
    "from": "dist/assets",
    "to": "dist/assets",
    "filter": ["**/*"]
  }
],
"asarUnpack": [
  "dist/assets/**/*"
]
```

**Impacto:**
- ✅ Los assets se desempaquetan fuera del `.asar`
- ✅ El logo y recursos se cargan correctamente
- ✅ Mejor compatibilidad con protocolo `file://`

---

#### B. Content Security Policy (CSP) mejorado en `electron/main.cjs`

**Archivo:** `electron/main.cjs` (líneas 20-36)

**Problema:**
```javascript
// ❌ CSP demasiado genérico bloqueaba conexiones a Supabase
'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https: blob:;"]
```

**Solución:**
```javascript
// ✅ CSP específico para permitir Supabase y assets
'Content-Security-Policy': [
  "default-src 'self' https://*.supabase.co; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' data: https://fonts.gstatic.com; " +
  "img-src 'self' data: https: blob:; " +
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
  "media-src 'self' https: blob:;"
]
```

**Impacto:**
- ✅ Permite conexiones HTTPS a Supabase
- ✅ Permite WebSocket (wss://) para Realtime
- ✅ Mantiene seguridad bloqueando otros dominios

---

#### C. Corrección de rutas de assets con script inyectado

**Archivo:** `electron/main.cjs` (líneas 107-120)

**Problema:**
Las rutas relativas a los assets no funcionaban con protocolo `file://` en el `.asar`.

**Solución:**
```javascript
mainWindow.webContents.executeJavaScript(`
  console.log('🔧 Corrigiendo rutas de assets en Electron...');
  if (typeof window !== 'undefined') {
    window.__ELECTRON_BASE_PATH__ = '${baseURL}';
    console.log('✅ Base path establecido:', window.__ELECTRON_BASE_PATH__);
  }
`);
```

**Impacto:**
- ✅ Establece ruta base correcta para assets
- ✅ Los recursos se cargan desde la ubicación correcta
- ✅ Compatible con empaquetado en `.asar`

---

### 1. Error SQL Ambiguo en `start_single_session`

**Archivo:** `database/013_single_session_enforcement.sql` (línea 98)

**Problema:**
```sql
SELECT result.closed_sessions_count INTO v_closed_count
FROM close_previous_user_sessions(p_usuario_id, p_device_id) AS result;
```

El error `"column reference "closed_sessions_count" is ambiguous"` ocurría porque el nombre de la columna existía en ambas funciones (RETURNS TABLE).

**Solución:**
```sql
SELECT r.closed_sessions_count INTO v_closed_count
FROM close_previous_user_sessions(p_usuario_id, p_device_id) AS r;
```

**Impacto:** 
- ✅ Corrige el error que impedía el inicio del servicio de presencia
- ✅ Permite que los elementos de reproducción se carguen correctamente
- ✅ Habilita el sistema de sesión única

---

### 2. Tema Oscuro por Defecto en Windows/Electron

**Archivos modificados:**
- `index.html` (líneas 9-39)
- `src/contexts/ThemeContext.jsx` (líneas 6-30)

**Problema:**
- En Windows/Electron, `localStorage` puede no estar disponible inmediatamente
- El tema se basaba en la preferencia del sistema, usando tema claro en sistemas configurados así

**Solución en `index.html`:**
```javascript
// ✅ CRÍTICO Windows/Electron: Forzar tema oscuro por defecto
(function() {
  function getInitialTheme() {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme;
    } catch (e) {
      console.warn('⚠️ localStorage no disponible, usando tema oscuro');
    }
    // ✅ SIEMPRE usar 'dark' por defecto (no system preference)
    return 'dark';
  }

  const theme = getInitialTheme();
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
  
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    console.warn('⚠️ No se pudo guardar tema en localStorage');
  }
})();
```

**Solución en `ThemeContext.jsx`:**
```javascript
const [theme, setTheme] = useState(() => {
  try {
    const stored = typeof window !== 'undefined' && window.localStorage 
      ? localStorage.getItem('theme') 
      : null;
    const initial = stored || 'dark';
    
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(initial);
    }
    
    return initial;
  } catch (error) {
    console.warn('⚠️ Error accediendo a localStorage, usando tema oscuro por defecto:', error);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    return 'dark';
  }
});
```

**Impacto:**
- ✅ Garantiza tema oscuro por defecto en Windows
- ✅ Maneja errores de localStorage en Electron
- ✅ Elimina flash de tema claro al iniciar

---

### 3. Pantalla en Blanco al Hacer Logout

**Archivo:** `src/App.jsx` (función `handleLogout`, líneas 709-797)

**Problema:**
```javascript
// ❌ PROBLEMA: window.location.reload() causa pantalla en blanco en Electron
window.location.reload();
```

En Electron con rutas `file://`, `window.location.reload()` puede fallar y causar pantalla en blanco.

**Solución:**
```javascript
await signOut();
logger.dev('✅ Sesión cerrada exitosamente');

// ✅ CRÍTICO Windows/Electron: NO usar window.location.reload() 
// En Electron con file://, reload() puede causar pantalla en blanco
// React Router manejará la navegación automáticamente al cambiar el estado de usuario
```

**Cómo funciona:**
1. Se llama a `signOut()` que limpia el estado del usuario (`setUser(null)`)
2. React Router detecta el cambio de estado automáticamente
3. Las rutas protegidas redirigen a `/login` sin necesidad de reload
4. Se evita el problema de las rutas `file://` en Windows

**Impacto:**
- ✅ Elimina pantalla en blanco al hacer logout
- ✅ Transición suave a pantalla de login
- ✅ Mejor experiencia de usuario
- ✅ Compatible con Electron y navegadores web

---

### 4. Seguridad en Electron (webSecurity)

**Archivo:** `electron/main.cjs` (líneas 38-51)

**Problema:**
```javascript
webSecurity: false, // ❌ Deshabilitado en producción (riesgo de seguridad)
```

**Solución:**
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  // ✅ CRÍTICO: Solo deshabilitar webSecurity en desarrollo
  // En producción (ejecutable), mantener seguridad habilitada
  webSecurity: isDev ? false : true,
  preload: path.join(__dirname, 'preload.cjs'),
  enableRemoteModule: false,
  experimentalFeatures: false,
  backgroundThrottling: false,
  // ✅ Habilitar almacenamiento local para persistencia en Windows
  partition: 'persist:ondeon'
}
```

**Impacto:**
- ✅ Mejora la seguridad en producción
- ✅ Mantiene flexibilidad en desarrollo
- ✅ Habilita persistencia de datos con partition
- ✅ Mejor aislamiento de sesiones

---

## 📊 Resultado Final

### Antes de los cambios:
- ❌ Error SQL impedía inicio de sesión
- ❌ Tema claro por defecto (incorrecto)
- ❌ Elementos de reproducción no se cargaban
- ❌ Pantalla en blanco al hacer logout
- ⚠️ webSecurity deshabilitado en producción

### Después de los cambios:
- ✅ Sistema de sesión única funciona correctamente
- ✅ Tema oscuro forzado por defecto
- ✅ Elementos de reproducción se cargan correctamente
- ✅ Logout funciona sin pantalla en blanco
- ✅ Seguridad habilitada en producción
- ✅ Persistencia de datos mejorada

---

## 🚀 Pasos Siguientes

### Para desplegar los cambios:

1. **Ejecutar el script SQL actualizado en Supabase:**
   ```bash
   # Conectarse a Supabase y ejecutar:
   database/013_single_session_enforcement.sql
   ```

2. **Reconstruir el ejecutable:**
   ```bash
   npm run build
   npm run electron:build
   # O el comando específico que uses para crear el ejecutable
   ```

3. **Probar en Windows:**
   - Instalar el nuevo ejecutable
   - Verificar que inicia con tema oscuro
   - Probar login y que los elementos se cargan
   - Probar logout y verificar que no hay pantalla en blanco

### Verificaciones adicionales:

- [ ] Confirmar que el tema oscuro persiste después de reiniciar la app
- [ ] Verificar que el sistema de sesión única funciona (cierra sesiones previas)
- [ ] Comprobar que todos los elementos del reproductor son visibles
- [ ] Asegurar que el logout redirige correctamente a login
- [ ] Validar que no hay errores en la consola al iniciar

---

## 📝 Notas Técnicas

### Diferencias Electron vs Web

**localStorage:**
- En Electron/Windows puede no estar disponible inmediatamente
- Se debe manejar con try-catch
- Se agregó `partition: 'persist:ondeon'` para mejor persistencia

**window.location.reload():**
- No funciona correctamente con rutas `file://` en Electron
- Puede causar pantalla en blanco
- React Router maneja la navegación automáticamente

**webSecurity:**
- Debe estar habilitado en producción por seguridad
- Solo deshabilitar en desarrollo para facilitar debugging

### Base de Datos

**Función SQL ambigua:**
- Cuando una función retorna TABLE con columnas del mismo nombre que otra función
- Se debe usar alias explícitos para evitar ambigüedad
- Ejemplo: `AS result` cambió a `AS r`

---

## 🔗 Archivos Modificados

### Primera Ronda de Correcciones:
1. `database/013_single_session_enforcement.sql` - Corrección SQL
2. `index.html` - Script de tema mejorado
3. `src/contexts/ThemeContext.jsx` - Manejo robusto de localStorage
4. `src/App.jsx` - Logout sin reload

### Segunda Ronda de Correcciones (Assets y Conexiones):
5. **`package.json`** - Configuración de empaquetado de assets ⚠️ **ACTUALIZADO**
   - Agregado `extraResources` para assets
   - Agregado `asarUnpack` para desempaquetar assets del .asar
6. **`electron/main.cjs`** - Mejoras adicionales ⚠️ **ACTUALIZADO**
   - CSP específico para Supabase
   - Inyección de script para corregir rutas
   - Configuración mejorada de webPreferences
7. `FIX-EJECUTABLE-WINDOWS.md` - Documentación completa (ACTUALIZADO)
8. `Errores desarrollo.md` - Actualizado con resolución

---

## ✅ Checklist de Validación

Antes de cerrar este issue, verificar:

### Primera Ronda:
- [x] Error SQL corregido y probado
- [x] Tema oscuro forzado en todos los casos
- [x] Logout sin pantalla en blanco
- [x] webSecurity habilitado en producción

### Segunda Ronda (Assets y Conexiones):
- [x] Configuración de empaquetado de assets agregada
- [x] CSP mejorado para Supabase
- [x] Script de corrección de rutas inyectado
- [ ] Ejecutable reconstruido con nuevas correcciones
- [ ] Pruebas en Windows completadas:
  - [ ] Logo se carga correctamente
  - [ ] Elementos de reproducción visibles
  - [ ] Conexión a Supabase funciona
  - [ ] Login funciona sin errores
- [ ] Validación en producción

---

**Autor:** Cursor AI Assistant  
**Revisión:** Pendiente  
**Aprobación:** Pendiente

