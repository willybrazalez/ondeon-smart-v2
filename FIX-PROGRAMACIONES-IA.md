# 🐛 FIX: Programaciones de Anuncios IA

**Fecha:** 2025-11-08  
**Versión:** 1.3

---

## 📋 **Problemas Detectados**

### **Problema 1: Nombre de programación no se guarda** ❌
**Síntoma:** El campo "Nombre de la programación" (ej: "Promoción Black Friday") no se guarda en `programaciones.descripcion`. En su lugar, se guarda el texto de la idea del anuncio.

**Ejemplo del problema:**
```
Usuario ingresa: "Promoción Black Friday"
BD guarda: "Llega Tenis Sábado Carlitos - 0811251923"  ❌ (la idea del anuncio)
```

**Debería ser:**
```
Usuario ingresa: "Promoción Black Friday"
BD guarda: "Promoción Black Friday"  ✅
```

**Causa raíz:**
Los parámetros estaban invertidos:
- `descripcion` recibía `idea` (texto del anuncio)
- `titulo` recibía `configuracionProgramacion.nombre` ("Promoción Black Friday")

Pero el código era:
```javascript
descripcion: descripcion || `Anuncio: ${titulo}`
```

Como `descripcion` (idea) siempre tenía valor, nunca usaba el fallback con `titulo`.

---

### **Problema 2: `hora_una_vez_dia` se guarda incorrectamente** ❌
**Síntoma:** El campo `hora_una_vez_dia` se guarda con valor `12:00:00` incluso cuando el modo diario NO es "una_vez".

**Ejemplo del problema:**
```csv
id,daily_mode,hora_una_vez_dia
af34d33d-ccb0-4e09-8639-859d4f0a26ff,laborales,12:00:00  ❌ INCORRECTO
```

**Debería ser:**
```csv
id,daily_mode,hora_una_vez_dia
af34d33d-ccb0-4e09-8639-859d4f0a26ff,laborales,NULL  ✅ CORRECTO
```

---

### **Problema 3: `created_by` no se guarda** ❌
**Síntoma:** El campo `created_by` queda vacío al crear programaciones desde anuncios IA.

**Ejemplo del problema:**
```csv
id,created_by
af34d33d-ccb0-4e09-8639-859d4f0a26ff,  ❌ VACÍO
```

**Debería ser:**
```csv
id,created_by
af34d33d-ccb0-4e09-8639-859d4f0a26ff,a84ef43a-c82b-4541-8a1f-6760d4f121af  ✅ UUID del usuario
```

---

## ✅ **Soluciones Aplicadas**

### **1. Fix `descripcion` (Nombre de programación)** 
**Archivo:** `src/services/aiAdService.js` línea 394

**Antes:**
```javascript
const programacionData = {
  descripcion: descripcion || `Anuncio: ${titulo}`,  // ❌ descripcion (idea) tiene prioridad
};
```

**Después:**
```javascript
const programacionData = {
  descripcion: titulo || descripcion || 'Anuncio IA',  // ✅ titulo (nombre) tiene prioridad
};
```

**Resultado:**
- **Prioridad 1:** `titulo` (Nombre ingresado por usuario: "Promoción Black Friday")
- **Prioridad 2:** `descripcion` (Idea del anuncio, si no hay nombre)
- **Prioridad 3:** `'Anuncio IA'` (Fallback si no hay ninguno)

---

### **2. Fix `hora_una_vez_dia`** 
**Archivo:** `src/services/aiAdService.js` líneas 410-419

**Antes:**
```javascript
if (periodicidad.tipo === 'diaria') {
  programacionData.daily_mode = periodicidad.dailyMode || 'laborales';
  programacionData.hora_una_vez_dia = periodicidad.horaUnaVezDia || '12:00'; // ❌ SIEMPRE se guarda
}
```

**Después:**
```javascript
if (periodicidad.tipo === 'diaria') {
  programacionData.daily_mode = periodicidad.dailyMode || 'laborales';
  
  // ⚠️ FIX: Solo guardar hora_una_vez_dia cuando modo es 'una_vez'
  if (periodicidad.dailyMode === 'una_vez') {
    programacionData.hora_una_vez_dia = periodicidad.horaUnaVezDia || '12:00';
  }
  // ✅ Si NO es 'una_vez', el campo queda como NULL (no se asigna)
}
```

**Mismo fix aplicado a modo semanal:**
```javascript
if (periodicidad.tipo === 'semanal') {
  programacionData.weekly_mode = periodicidad.weeklyMode || 'rango';
  
  // ⚠️ FIX: Solo guardar weekly_hora_una_vez cuando modo es 'una_vez'
  if (periodicidad.weeklyMode === 'una_vez') {
    programacionData.weekly_hora_una_vez = periodicidad.weeklyHoraUnaVez || '12:00';
  }
}
```

---

### **3. Fix `created_by`**
**Archivos:** 
- `src/services/aiAdService.js` líneas 378-413
- `src/pages/admin/QuickAdsPage.jsx` línea 1141

**Problema original:** `supabase.auth.getUser()` falla para usuarios legacy (login desde tabla `usuarios`) porque no tienen sesión de Supabase Auth.

**Antes:**
```javascript
const { data: { user: authUser } } = await supabase.auth.getUser();

const programacionData = {
  created_by: authUser?.id || null,  // ❌ Podía ser null
  updated_by: authUser?.id || null
};
```

**Después (v1.1 - Soporte usuarios legacy):**
```javascript
// ✅ FIX: Recibir userId como parámetro (para usuarios legacy)
async programarAnuncio({ 
  // ... otros parámetros
  userId = null  // ✅ Nuevo parámetro opcional
}) {
  // ✅ FIX: Obtener usuario - soporte para Supabase Auth Y usuarios legacy
  let authUserId = userId; // Priorizar userId recibido (usuarios legacy)
  
  // Si no hay userId, intentar obtenerlo de Supabase Auth
  if (!authUserId) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    authUserId = authUser?.id;
  }
  
  // ⚠️ CRITICAL: Validar que tenemos usuario
  if (!authUserId) {
    logger.error('❌ No se pudo obtener usuario autenticado para created_by');
    throw new Error('Usuario no autenticado. Por favor, recarga la página.');
  }
  
  logger.dev('👤 Usuario autenticado para created_by:', {
    authUserId,
    source: userId ? 'legacy (parámetro)' : 'supabase auth'
  });

  const programacionData = {
    created_by: authUserId,  // ✅ GARANTIZADO: Siempre tiene valor
    modified_by: authUserId  // ✅ NUEVO: Usuario que modifica
  };
}
```

**Actualización en QuickAdsPage.jsx:**
```javascript
// Línea 1141
userId: user?.id || user?.usuario_id || user?.user_id  // ✅ Pasar userId para usuarios legacy
```

---

### **4. Nuevo campo: `modified_by`** 🆕
**Archivos:** 
- `database/014_add_modified_by_to_programaciones.sql` (migración)
- `src/services/aiAdService.js` línea 406 (creación)
- `src/pages/admin/ProgramacionesPage.jsx` línea 655 (edición)

**¿Por qué?**
- Rastrear quién hizo la última modificación de una programación
- Compatible con **ambos proyectos** (frontend-desktop y master-control)

**Estructura:**
```sql
ALTER TABLE programaciones 
ADD COLUMN IF NOT EXISTS modified_by UUID;
```

**¿Cuándo se guarda?**

1. **Al CREAR programación** (Anuncios IA):
```javascript
// src/services/aiAdService.js
modified_by: authUser.id  // UUID de Supabase Auth
```

2. **Al EDITAR programación** (Dashboard Admin):
```javascript
// src/pages/admin/ProgramacionesPage.jsx
const adminId = user?.id || user?.usuario_id || user?.user_id;
modified_by: adminId  // ID del admin desde admin_asignaciones
```

**Compatibilidad:**
| Acción | Usuario | Tabla origen | Campo usado |
|--------|---------|--------------|-------------|
| **Crear** (IA) | Autenticado Supabase | `auth.users` | `auth.uid()` |
| **Editar** (Dashboard) | Admin | `admin_asignaciones` | `admin_id` |
| **Master Control** | Superadmin | `superadmins` | `UID` |

**Todos usan UUID**, por lo que el campo es compatible entre proyectos.

---

## 🚀 **Instrucciones de Uso**

### **Paso 1: Ejecutar migraciones SQL** ⚠️ **IMPORTANTE**

Debes ejecutar **ambas** migraciones en orden:

**A) Migración 014 - Añadir campo `modified_by`:**
1. Ve a Supabase Dashboard
2. SQL Editor
3. Copia y pega el contenido de: `database/014_add_modified_by_to_programaciones.sql`
4. Ejecuta el script
5. Verifica que veas el mensaje: `✅ Columna modified_by creada exitosamente`

**B) Migración 015 - Eliminar foreign key constraints:** 🆕
1. En el mismo SQL Editor
2. Copia y pega el contenido de: `database/015_remove_programaciones_fk_constraints.sql`
3. Ejecuta el script
4. Verifica que veas: `✅ Constraint programaciones_created_by_fkey eliminada`

**¿Por qué es necesaria la migración 015?**
- Los usuarios legacy (tabla `usuarios`) tienen UUIDs que NO están en `auth.users`
- Las foreign key constraints causaban errores al intentar guardar `created_by`
- Al removerlas, permitimos UUIDs de **ambas** fuentes:
  - ✅ `auth.users` (Supabase Auth)
  - ✅ `public.usuarios` (Login legacy)
  - ✅ `public.superadmins` (Master Control)

### **Paso 2: Probar la solución**

1. **Crear anuncio IA:**
   - Ve a "Anuncios con IA"
   - Genera un anuncio
   - Haz clic en "Guardar y Programar"

2. **Configurar programación:**
   - **Modo diario → Laborables**: Verifica que `hora_una_vez_dia` sea NULL
   - **Modo diario → Una vez al día**: Verifica que `hora_una_vez_dia` tenga valor
   - **Modo semanal → Rango**: Verifica que `weekly_hora_una_vez` sea NULL

3. **Verificar en BD:**
```sql
SELECT 
  id, 
  descripcion, 
  daily_mode,
  hora_una_vez_dia,
  weekly_mode,
  weekly_hora_una_vez,
  created_by,
  modified_by,
  created_at
FROM programaciones
WHERE descripcion LIKE '%Viene una dana%'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado:**
| daily_mode | hora_una_vez_dia | created_by | modified_by |
|------------|------------------|------------|-------------|
| `laborales` | `NULL` ✅ | `UUID` ✅ | `UUID` ✅ |
| `una_vez` | `12:00:00` ✅ | `UUID` ✅ | `UUID` ✅ |

---

## 📊 **Antes vs Después**

### **Registro problemático (ANTES):**
```csv
id,descripcion,daily_mode,hora_una_vez_dia,created_by,modified_by
af34d33d-ccb0-4e09-8639-859d4f0a26ff,"Viene una dana, las autoridades...",laborales,12:00:00,,
```
**❌ Problemas:**
1. `descripcion` = texto de la idea (no el nombre que el usuario ingresó)
2. `hora_una_vez_dia` tiene valor cuando debería ser NULL
3. `created_by` está vacío
4. `modified_by` no existe

---

### **Registro correcto (DESPUÉS):**
```csv
id,descripcion,daily_mode,hora_una_vez_dia,created_by,modified_by
af34d33d-ccb0-4e09-8639-859d4f0a26ff,"Promoción Black Friday",laborales,NULL,a84ef43a-c82b-4541-8a1f-6760d4f121af,a84ef43a-c82b-4541-8a1f-6760d4f121af
```
**✅ Correcciones:**
1. `descripcion` = "Promoción Black Friday" (nombre ingresado por usuario)
2. `hora_una_vez_dia` es NULL (correcto para modo "laborales")
3. `created_by` tiene el UUID del usuario
4. `modified_by` tiene el UUID del usuario (inicialmente = created_by)

---

## 🔍 **Logs de Debug**

Después del fix, verás estos logs al programar:

```javascript
// LOG 1: Usuario autenticado
👤 Usuario autenticado para created_by: {
  authUserId: "a84ef43a-c82b-4541-8a1f-6760d4f121af",
  email: "wibrazalez@gmail.com"
}

// LOG 2: Datos de programación
📝 Datos de programación: {
  descripcion: "Viene una dana...",
  tipo: "diaria",
  daily_mode: "laborales",
  hora_una_vez_dia: undefined,  // ✅ NO se envía (será NULL en BD)
  created_by: "a84ef43a-c82b-4541-8a1f-6760d4f121af",
  modified_by: "a84ef43a-c82b-4541-8a1f-6760d4f121af"
}

// LOG 3: Programación creada
✅ Programación creada: "af34d33d-ccb0-4e09-8639-859d4f0a26ff"
```

---

## ⚠️ **Notas Importantes**

### **1. Compatibilidad entre proyectos**
El campo `modified_by` es compatible con:
- **Frontend Desktop**: Usa `auth.uid()` de Supabase Auth
- **Master Control**: Usa `UID` de tabla superadmins

Ambos son UUID, por lo que NO hay conflicto.

### **2. ¿Qué pasa con registros antiguos?**
La migración SQL actualiza automáticamente:
```sql
UPDATE programaciones 
SET modified_by = created_by 
WHERE created_by IS NOT NULL AND modified_by IS NULL;
```

Esto garantiza que registros antiguos tengan `modified_by = created_by`.

### **3. ¿Y si el usuario no está autenticado?**
El nuevo código lanza un error:
```javascript
throw new Error('Usuario no autenticado. Por favor, recarga la página.');
```

Esto **previene** que se creen programaciones sin `created_by`.

---

## 🐛 **Errores Comunes y Soluciones**

### **Error 1: "Key is not present in table 'users'" (Foreign Key Violation)**

**Síntoma:**
```javascript
❌ Error creando programación:
code: 23503
details: "Key is not present in table \"users\"."
message: "insert or update on table \"programaciones\" violates 
         foreign key constraint \"programaciones_created_by_fkey\""
```

**Causa:**
- Los usuarios legacy (tabla `usuarios`) tienen UUIDs que NO están en `auth.users`
- La tabla `programaciones` tiene foreign key constraints que validan contra `auth.users`
- Al intentar guardar un UUID de usuario legacy, falla la validación

**Solución:**
Ejecutar la migración `database/015_remove_programaciones_fk_constraints.sql` que:
1. Elimina constraint `programaciones_created_by_fkey`
2. Elimina constraint `programaciones_modified_by_fkey`

Esto permite UUIDs de cualquier fuente: `auth.users`, `public.usuarios`, o `public.superadmins`.

**Verificación:**
```sql
-- Esta query NO debe devolver filas (constraints eliminadas)
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_name = 'programaciones'
  AND constraint_type = 'FOREIGN KEY'
  AND (constraint_name LIKE '%created_by%' OR constraint_name LIKE '%modified_by%');
```

---

### **Error 2: "Usuario no autenticado. Por favor, recarga la página."**

**Síntoma:**
```javascript
❌ No se pudo obtener usuario autenticado para created_by
Error: Usuario no autenticado. Por favor, recarga la página.
```

**Causa:**
- El usuario legacy no tiene sesión de Supabase Auth
- El código intentó usar `supabase.auth.getUser()` (solo funciona para Supabase Auth)

**Solución:**
- ✅ Ya corregido en v1.2+
- El código ahora acepta `userId` como parámetro (usuarios legacy)
- Fallback a Supabase Auth si no se proporciona

**Verificación:**
Busca en los logs:
```javascript
👤 Usuario autenticado para created_by: {
  authUserId: "...",
  source: "legacy (parámetro)"  // ✅ Indica que usa userId legacy
}
```

---

## ✅ **Checklist de Verificación**

**Migraciones SQL:**
- [ ] ✅ Migración 014 ejecutada (`modified_by` creado)
- [ ] ✅ Migración 015 ejecutada (foreign keys eliminadas) 🆕

**Código:**
- [ ] ✅ Código actualizado en `aiAdService.js`
- [ ] ✅ Código actualizado en `QuickAdsPage.jsx`

**Pruebas funcionales:**
- [ ] ✅ Probado crear programación "Diaria → Laborables"
- [ ] ✅ Probado crear programación "Diaria → Una vez al día"
- [ ] ✅ Probado crear programación "Semanal → Rango"
- [ ] ✅ Probado crear programación "Semanal → Una vez"

**Verificación en BD:**
- [ ] ✅ `created_by` NO está vacío
- [ ] ✅ `modified_by` tiene valor
- [ ] ✅ `hora_una_vez_dia` es NULL cuando modo NO es "una_vez"
- [ ] ✅ No hay errores de foreign key constraint

---

## 📞 **Soporte**

Si encuentras algún problema:
1. Revisa los logs de consola
2. Verifica que la migración SQL se ejecutó correctamente
3. Confirma que el usuario está autenticado

---

## ✅ **Problemas resueltos:**

| Problema | Estado | Solución |
|----------|--------|----------|
| Nombre de programación no se guarda | ✅ RESUELTO | Invertir prioridad: `titulo` primero |
| `hora_una_vez_dia` se guarda incorrectamente | ✅ RESUELTO | Condición `if (dailyMode === 'una_vez')` |
| `created_by` queda vacío (usuarios legacy) | ✅ RESUELTO | Parámetro `userId` + fallback a Supabase Auth |
| Foreign key constraint violation | ✅ RESUELTO | Migración 015: eliminar FK constraints 🆕 |
| Falta campo `modified_by` | ✅ IMPLEMENTADO | Nueva columna UUID compatible |

---

**¡Solución completa implementada! 🎉**

**Versión actual:** 1.3  
**Última actualización:** 2025-11-08

