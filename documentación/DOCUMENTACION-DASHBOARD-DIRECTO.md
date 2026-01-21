# 📚 Documentación del Sistema "En Directo" - Índice

Documentación completa del sistema de presencia y actividad en tiempo real para el dashboard externo de Ondeon.

---

## 📂 Archivos Disponibles

### 🚀 Para Empezar Rápido
**Archivo:** `DASHBOARD-DIRECTO-QUICKSTART.md`

**Para quién:** Desarrollador que quiere empezar YA  
**Tiempo de lectura:** 10 minutos  
**Contenido:**
- ✅ Setup en 10 minutos
- ✅ Código listo para copiar y pegar
- ✅ Ejemplos completos de React
- ✅ Troubleshooting básico
- ✅ Respuesta clara a: "¿Se limpia la sesión en logout?"

**📖 [Leer DASHBOARD-DIRECTO-QUICKSTART.md](./DASHBOARD-DIRECTO-QUICKSTART.md)**

---

### 📚 Documentación Técnica Completa
**Archivo:** `SISTEMA-PRESENCIA-DASHBOARD.md`

**Para quién:** Desarrollador que necesita entender el sistema a fondo  
**Tiempo de lectura:** 40+ minutos  
**Contenido:**
- ✅ Arquitectura completa del sistema
- ✅ Estructura detallada de base de datos
- ✅ Todos los tipos de eventos con ejemplos
- ✅ API Reference completa
- ✅ Ejemplos en React, Vue, Angular, Vanilla JS
- ✅ Best practices y optimizaciones
- ✅ Seguridad (RLS) y permisos
- ✅ FAQ extendido (15+ preguntas)

**📖 [Leer SISTEMA-PRESENCIA-DASHBOARD.md](./SISTEMA-PRESENCIA-DASHBOARD.md)**

---

## 🗺️ ¿Qué Documento Usar?

### Usa QUICKSTART si...
- ✅ Quieres empezar a programar HOY
- ✅ Necesitas código de ejemplo rápido
- ✅ Ya tienes experiencia con Supabase
- ✅ Solo necesitas lo básico para funcionar

### Usa DOCUMENTACIÓN COMPLETA si...
- ✅ Necesitas entender cómo funciona todo
- ✅ Vas a implementar features avanzadas
- ✅ Tienes dudas técnicas específicas
- ✅ Necesitas optimizar rendimiento
- ✅ Quieres ver todos los casos de uso posibles

---

## 🎯 Recomendación

**Mejor estrategia:**
1. 📖 Lee primero **QUICKSTART** (10 min)
2. 💻 Implementa el ejemplo básico (2-4 horas)
3. 📚 Consulta **DOCUMENTACIÓN COMPLETA** cuando necesites más detalles

---

## 📊 Scripts SQL Necesarios

Todos los scripts SQL están en la carpeta `/database/`:

```
/database/
  ├── 001_create_presence_system.sql    ← Tablas, vistas, índices
  ├── 004_enable_realtime.sql           ← Habilitar Realtime
  ├── 005_enable_rls.sql                ← Seguridad (RLS)
  └── 006_fix_canal_foreign_key.sql     ← Correcciones
```

**📌 Ejecutarlos en ese orden en el SQL Editor de Supabase**

---

## 🔑 Credenciales Necesarias

Para implementar el dashboard necesitas:

1. **URL del proyecto Supabase**
   - Formato: `https://[project-id].supabase.co`
   - Obtener en: Supabase Dashboard → Settings → API

2. **Anon Key (pública)**
   - Es segura de compartir
   - Obtener en: Supabase Dashboard → Settings → API

3. **Usuario Admin**
   - Email y password de un usuario con `rol_id = 2` o `3`
   - O credenciales de superadmin (tabla `superadmins`)
   - ⚠️ **Necesario** para ver datos de todos los usuarios

---

## 🚀 Quick Start en 3 Pasos

### 1. Instalar
```bash
npm install @supabase/supabase-js
```

### 2. Configurar
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://tu-proyecto.supabase.co',
  'tu_anon_key'
)

await supabase.auth.signInWithPassword({
  email: 'admin@ejemplo.com',
  password: 'password'
})
```

### 3. Escuchar
```javascript
const channel = supabase.channel('users-presence')

channel.on('presence', { event: 'sync' }, () => {
  const users = Object.values(channel.presenceState()).flat()
  console.log('Usuarios online:', users)
})

channel.subscribe()
```

**✅ ¡Listo! Ya estás recibiendo usuarios online en tiempo real**

---

## ❓ Preguntas Frecuentes

### ¿El sistema limpia la sesión cuando un usuario hace logout?
**Sí, completamente.** Cuando un usuario hace logout:
- ✅ La sesión se marca como `disconnected`
- ✅ Se registra la hora de logout (`ended_at`)
- ✅ Se calcula la duración total de la sesión
- ✅ El usuario aparece como `is_online = false`
- ✅ Se dispara evento `presence:leave` en Realtime
- ✅ El dashboard lo elimina automáticamente de la lista

Ver más detalles en `DASHBOARD-DIRECTO-QUICKSTART.md` → Sección "Detección de Logout"

### ¿Cuánto consume el sistema?
- **62 usuarios:** ~55 MB/mes
- **500 usuarios:** ~2.5 GB/mes (1% del límite de 250GB)
- **Capacidad máxima:** 10,000+ usuarios

### ¿Necesito configurar algo en Supabase?
Sí, ejecutar los scripts SQL de la carpeta `/database/` en orden. Eso crea:
- 3 tablas principales
- 4 vistas para consultas
- Índices para rendimiento
- RLS para seguridad
- Realtime habilitado

### ¿Qué frameworks puedo usar?
- ✅ React (ejemplos incluidos)
- ✅ Vue (ejemplos incluidos)
- ✅ Angular (ejemplos incluidos)
- ✅ Vanilla JS (ejemplos incluidos)
- ✅ Next.js, Nuxt, SvelteKit, etc. (compatible)

---

## 🔍 Contenido por Documento

### DASHBOARD-DIRECTO-QUICKSTART.md
- Resumen ejecutivo
- Setup en 10 minutos
- Ejemplo completo de React
- Estructura de datos clave
- Detección de logout (IMPORTANTE)
- Problemas comunes y soluciones
- Checklist de implementación

### SISTEMA-PRESENCIA-DASHBOARD.md
- Arquitectura del sistema
- Estructura de base de datos detallada
- Eventos en tiempo real (todos los tipos)
- Cómo conectarse al sistema
- Ejemplos de implementación (múltiples frameworks)
- API Reference completa
- Best practices
- Troubleshooting avanzado
- FAQ extendido (15+ preguntas)
- Seguridad y RLS
- Optimizaciones de rendimiento

---

## 📞 Soporte

**Para dudas:**
1. ✅ Consultar primero los documentos
2. ✅ Revisar scripts SQL en `/database/`
3. ✅ Verificar logs en consola del navegador
4. ✅ Contactar al equipo de Ondeon Frontend

**Documentación oficial de Supabase:**
- Realtime: https://supabase.com/docs/guides/realtime
- JavaScript Client: https://supabase.com/docs/reference/javascript

---

## 🎉 ¡Todo Listo!

Tienes todo lo necesario para crear un dashboard completo de monitoreo en tiempo real.

**Recomendación:** Empieza por el QUICKSTART y consulta la documentación completa cuando necesites más detalles.

**Tiempo estimado total:** 2-3 días de desarrollo

¡Buena suerte! 🚀

---

**Versión:** 1.1  
**Fecha:** 20 de Octubre de 2025  
**Equipo:** Ondeon Frontend

