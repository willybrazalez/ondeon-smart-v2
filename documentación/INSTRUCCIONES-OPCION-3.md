# ✅ Implementación Opción 3: Dos Botones de Guardado

## 📋 Resumen de Cambios

Se ha implementado la **Opción 3** con las siguientes mejoras:

### 1. ✅ Migración SQL Creada
**Archivo**: `database/015_update_ai_ads_rls_and_tracking.sql`

**Cambios incluidos**:
- ✅ Activar RLS en `ai_generated_ads`
- ✅ Políticas para usuarios autenticados y legacy
- ✅ Columnas nuevas: `text_regeneration_count`, `voice_change_count`
- ✅ Constraints para límite de 3 intentos cada uno

**⚠️ IMPORTANTE**: NO se modifica la tabla `contenidos` porque:
- Usamos `tipo_contenido: 'cuna'` que ya existe
- `s3_key` y `tamaño_bytes` se pasan correctamente en el insert
- NO se necesita columna `descripcion`

### 2. ✅ Frontend Actualizado
**Archivo**: `src/pages/admin/QuickAdsPage.jsx`

**Cambios incluidos**:
- ✅ Estados de tracking: `textRegenerationCount`, `voiceChangeCount`
- ✅ Límites configurados: `MAX_TEXT_REGENERATIONS = 3`, `MAX_VOICE_CHANGES = 3`
- ✅ Verificación de límites en `handleRegenerarTexto()` y `handleVolverAtras()`
- ✅ Contador se incrementa automáticamente en cada intento
- ✅ Nueva función: `guardarAudioEnS3YBD(continuarAProgramacion)`
- ✅ Nueva función: `handleGuardarSinProgramar()`
- ✅ Nueva función: `handleGuardarYProgramar()`
- ✅ Nueva función: `resetearFormulario()` para limpiar todo
- ✅ UI del Paso 4 modificada con:
  - Indicador de intentos (📝 texto, 🎤 voz)
  - Botón "Cambiar Voz" (deshabilitado si alcanza límite)
  - Botón "Guardar sin Programar" (naranja)
  - Botón "Guardar y Programar" (verde)
- ✅ `handleProgramar()` modificado para NO guardar (solo programa)

### 3. ✅ Servicio Actualizado
**Archivo**: `src/services/aiAdService.js`

**Cambios incluidos**:
- ✅ Parámetros nuevos: `textRegenerationCount`, `voiceChangeCount`, `audioSize`
- ✅ Inserción en BD incluye los contadores de intentos
- ✅ Usa `tipo_contenido: 'cuna'` (no se necesita crear tipo 'anuncio')
- ✅ Extrae `s3_key` de la URL del audio
- ✅ Pasa `tamaño_bytes` con el tamaño real del blob
- ✅ Incluye `formato_audio: 'mp3'` y `created_by: userId`

---

## 🚀 PASO FINAL: Ejecutar Migración SQL

**⚠️ IMPORTANTE**: Necesitas ejecutar la migración SQL para que todo funcione correctamente.

### Opción A: Desde el Dashboard de Supabase (Recomendado)

1. Ir a: https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/sql/new
2. Copiar el contenido de `database/015_update_ai_ads_rls_and_tracking.sql`
3. Pegarlo en el editor SQL
4. Click en "Run" ▶️
5. Verificar que aparezca el mensaje: ✅ Migración 015 completada exitosamente

### Opción B: Usar Supabase CLI (Si tienes acceso)

```bash
cd "/Users/willymac/Desktop/MACBOOK PRO 2015/ONDEON/Nuevo ONDEON/frontend-desktop"

# Ejecutar migración
supabase db push
```

### Opción C: Instalar psql y ejecutar

```bash
# Instalar PostgreSQL client (macOS)
brew install postgresql

# Ejecutar migración
psql "postgresql://postgres.nazlyvhndymalevkfpnl:Ondeon2024!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f database/015_update_ai_ads_rls_and_tracking.sql
```

---

## 🔄 Nuevo Flujo de Usuario

### PASO 1: Crear Anuncio
- Usuario ingresa idea y nombre comercial
- Selecciona duración (10" o 15")

### PASO 2: Texto Generado
- Se muestra el texto generado
- Usuario puede:
  - ✅ **Regenerar texto** (máximo 3 veces)
  - ✅ **Editar idea** (volver al Paso 1)
  - ✅ **Continuar a voz**

### PASO 3: Seleccionar Voz
- Usuario escucha previews de voces
- Selecciona una voz
- Click en "Generar Preview"

### PASO 4: Preview del Audio ⭐ NUEVO
- Se muestra el audio temporal
- **Indicador de intentos**:
  - 📝 Regeneraciones de texto: X/3
  - 🎤 Cambios de voz: X/3
- Usuario puede:
  - ✅ **Cambiar Voz** (máximo 3 veces, se deshabilita al alcanzar límite)
  - ✅ **Guardar sin Programar** (guarda en BD y S3, resetea formulario)
  - ✅ **Guardar y Programar** (guarda en BD y S3, va al Paso 5)

### PASO 5: Programar (solo si eligió "Guardar y Programar")
- Seleccionar destinatarios (todos o grupos)
- Configurar frecuencia
- Configurar fecha/hora
- Click en "Programar Anuncio"

---

## 📊 Tablas Afectadas

### `ai_generated_ads` (MODIFICADA)
```sql
ALTER TABLE public.ai_generated_ads
ADD COLUMN text_regeneration_count integer DEFAULT 0 NOT NULL;

ALTER TABLE public.ai_generated_ads
ADD COLUMN voice_change_count integer DEFAULT 0 NOT NULL;

-- RLS activado
ALTER TABLE public.ai_generated_ads ENABLE ROW LEVEL SECURITY;
```

### `contenidos` (NO MODIFICADA)
**✅ Se usa tal como está**:
- Tipo de contenido: `'cuna'` (ya existe en constraint)
- `s3_key`: Se extrae de la URL del audio y se pasa en el insert
- `tamaño_bytes`: Se pasa el tamaño real del blob (`.size`)
- `formato_audio`: Se especifica como `'mp3'`
- `created_by`: Se pasa el `userId`

---

## 🧪 Testing

### Caso 1: Guardar sin Programar
1. Crear anuncio
2. Generar texto
3. Seleccionar voz
4. Generar preview
5. Click en "Guardar sin Programar"
6. **Verificar**:
   - ✅ Audio en S3
   - ✅ Registro en `contenidos`
   - ✅ Registro en `ai_generated_ads` con contadores
   - ✅ Formulario reseteado
   - ✅ NO hay programación

### Caso 2: Guardar y Programar
1. Crear anuncio
2. Generar texto
3. Seleccionar voz
4. Generar preview
5. Click en "Guardar y Programar"
6. Configurar programación
7. Click en "Programar Anuncio"
8. **Verificar**:
   - ✅ Audio en S3
   - ✅ Registro en `contenidos`
   - ✅ Registro en `ai_generated_ads` con contadores
   - ✅ Registro en `programaciones`
   - ✅ Registros en `programacion_destinatarios`

### Caso 3: Límite de Intentos
1. Crear anuncio
2. Generar texto
3. Regenerar texto 3 veces
4. Intentar regenerar 4ta vez
5. **Verificar**:
   - ✅ Se muestra alerta de límite alcanzado
   - ✅ NO se regenera el texto
6. Seleccionar voz y generar preview
7. Cambiar voz 3 veces
8. Intentar cambiar voz 4ta vez
9. **Verificar**:
   - ✅ Botón "Cambiar Voz" deshabilitado
   - ✅ Se muestra texto de límite alcanzado

---

## 📝 Consultas Útiles para Verificar

```sql
-- Ver anuncios con contadores
SELECT 
  titulo,
  text_regeneration_count,
  voice_change_count,
  created_at
FROM ai_generated_ads
ORDER BY created_at DESC
LIMIT 10;

-- Ver RLS activado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'ai_generated_ads';

-- Ver políticas RLS
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ai_generated_ads';

-- Ver constraint actualizado de contenidos
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'contenidos_tipo_contenido_check';
```

---

## ✅ Checklist de Implementación

- [x] Crear migración SQL
- [x] Modificar `QuickAdsPage.jsx`
- [x] Modificar `aiAdService.js`
- [ ] **Ejecutar migración SQL** ⚠️ PENDIENTE
- [ ] Probar "Guardar sin Programar"
- [ ] Probar "Guardar y Programar"
- [ ] Verificar límites de intentos
- [ ] Verificar RLS funciona correctamente

---

## 🎉 Una vez ejecutada la migración

Todo estará listo para usar. El sistema ahora:

1. ✅ Guarda metadatos de intentos
2. ✅ Limita regeneraciones (3 texto, 3 voz)
3. ✅ Permite guardar sin programar
4. ✅ Permite guardar y programar
5. ✅ Tiene RLS activado para seguridad
6. ✅ Usuarios autenticados y legacy pueden acceder

---

**¿Dudas?** Revisa los logs en:
- Frontend: Consola del navegador (F12)
- Backend: Dashboard Supabase → Logs → Functions

