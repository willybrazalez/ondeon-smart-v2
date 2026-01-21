# ✅ SOLUCIÓN: Error PGRST204 - Columnas inexistentes

## 🐛 Error Detectado

```
Error: PGRST204
Could not find the 'fecha_inicio' column of 'contenido_asignaciones' in the schema cache
```

---

## 🔍 Causa del Problema

El código intentaba insertar columnas que **NO existen** en la tabla `contenido_asignaciones`:

```javascript
// ❌ ANTES (INCORRECTO)
.insert({
  contenido_id: contenido.id,
  empresa_id: empresaId,
  tipo_contenido: 'cuna',      // ❌ Esta columna NO existe
  activo: true,
  fecha_inicio: new Date().toISOString(),  // ❌ Esta columna NO existe
  prioridad: 1
})
```

---

## 📋 Estructura Real de `contenido_asignaciones`

Según `tablas.md` (líneas 704-738), la tabla solo tiene estas columnas:

```sql
CREATE TABLE contenido_asignaciones (
  id uuid PRIMARY KEY,
  contenido_id uuid NOT NULL,
  canal_id uuid NULL,
  empresa_id uuid NULL,
  sector_id integer NULL,
  grupo_id uuid NULL,
  usuario_id uuid NULL,
  prioridad integer DEFAULT 1,
  activo boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
```

**Columnas disponibles**:
- ✅ `id`
- ✅ `contenido_id`
- ✅ `canal_id`
- ✅ `empresa_id`
- ✅ `sector_id`
- ✅ `grupo_id`
- ✅ `usuario_id`
- ✅ `prioridad`
- ✅ `activo`
- ✅ `created_at`

**Columnas que NO existen**:
- ❌ `fecha_inicio`
- ❌ `tipo_contenido`

---

## ✅ Solución Implementada

### Código corregido en `aiAdService.js`:

```javascript
// ✅ AHORA (CORRECTO)
const { data: asignacion, error: errorAsignacion } = await supabase
  .from('contenido_asignaciones')
  .insert({
    contenido_id: contenido.id,
    empresa_id: empresaId,
    activo: true,
    prioridad: 1
  })
  .select()
  .single();
```

**Cambios realizados**:
1. ✅ Eliminada columna `tipo_contenido` (no existe en la tabla)
2. ✅ Eliminada columna `fecha_inicio` (no existe en la tabla)
3. ✅ Solo se insertan columnas que existen: `contenido_id`, `empresa_id`, `activo`, `prioridad`
4. ✅ `created_at` se genera automáticamente con el default `now()`

---

## 📂 Archivo Modificado

**`/src/services/aiAdService.js`** - Línea 280-285

Función: `guardarAnuncio()`

---

## 🎯 Por qué funcionará ahora

1. ✅ **Solo usa columnas existentes**: El INSERT solo incluye columnas que están en la tabla
2. ✅ **Sin conflicto con el schema**: No hay referencias a columnas inexistentes
3. ✅ **Valores por defecto funcionan**: `created_at` se genera automáticamente
4. ✅ **Estructura mínima válida**: Solo los campos esenciales para la asignación

---

## 🧪 Cómo Verificar

### 1. **Refresca la aplicación**
```bash
Ctrl/Cmd + R
```

### 2. **Crea un anuncio con IA**
- Escribe una idea
- Genera el texto
- Selecciona una voz
- Genera el audio
- Click en "Guardar sin Programar" o "Guardar y Programar"

### 3. **Observa la consola**
Deberías ver:
```
📎 Creando asignación de contenido a empresa: [uuid]
✅ Contenido asignado a empresa: [uuid]
✅ Anuncio guardado exitosamente (contenido + ai_ad + asignación)
```

### 4. **Verifica en Supabase Dashboard**
```sql
-- Ver la asignación creada
SELECT * FROM contenido_asignaciones 
WHERE empresa_id = '[tu-empresa-id]'
ORDER BY created_at DESC 
LIMIT 1;

-- Resultado esperado:
-- id | contenido_id | empresa_id | activo | prioridad | created_at
-- ---|--------------|------------|--------|-----------|------------
-- ...| [uuid]       | [uuid]     | true   | 1         | [timestamp]
```

---

## 📊 Datos que se Guardan

Después de guardar un anuncio con IA, se crean **3 registros**:

### 1. `contenidos`
```sql
{
  nombre: "Anuncio [Empresa] - [Fecha]",
  tipo_contenido: "cuna",
  url_s3: "[url-s3]",
  s3_key: "[key]",
  tamaño_bytes: [size],
  duracion_segundos: 10 o 15,
  formato_audio: "mp3",
  activo: true,
  created_by: [auth.uid]
}
```

### 2. `ai_generated_ads`
```sql
{
  titulo: "Anuncio [Empresa] - [Fecha]",
  idea_original: "[texto del usuario]",
  texto_generado: "[texto de GPT-4]",
  voice_id: "[elevenlabs-voice-id]",
  audio_url: "[url-s3]",
  empresa_id: [uuid],
  created_by: [usuario-id]
}
```

### 3. `contenido_asignaciones` (NUEVO - CORREGIDO)
```sql
{
  contenido_id: [uuid del contenido creado],
  empresa_id: [uuid de la empresa],
  activo: true,
  prioridad: 1,
  created_at: [timestamp automático]
}
```

---

## ⚠️ Nota Importante

Si en el futuro se necesita almacenar:
- **Fecha de inicio**: Usar el campo `created_at` (ya existe)
- **Tipo de contenido**: No es necesario, ya está en la tabla `contenidos`

Si realmente se necesitan estas columnas, habría que:
1. Crear una migración SQL para añadirlas a la tabla
2. Actualizar los índices si es necesario
3. Actualizar el código para usarlas

Pero **actualmente no son necesarias** para el funcionamiento del sistema.

---

## 🚀 ¿Listo para Probar?

1. **Refresca la página** (Ctrl/Cmd + R)
2. **Crea un nuevo anuncio con IA**
3. **Guarda sin programar o programa**
4. **El error ya NO debería aparecer** ✅

---

**¡Error solucionado!** 🎉

El INSERT ahora solo usa columnas que existen en la tabla `contenido_asignaciones`.

