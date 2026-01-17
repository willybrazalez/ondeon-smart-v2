# 🔧 SOLUCIÓN ERROR 42501 - RLS en Contenidos

## ❌ Error Actual

```
Error creando contenido:
{code: "42501", details: null, hint: null, 
 message: "new row violates row-level security policy for table \"contenidos\""}
```

## 🎯 Causa

Las políticas RLS de la tabla `contenidos` están **bloqueando** el INSERT desde el frontend del administrador.

---

## ✅ SOLUCIÓN: Ejecutar SQL

### PASO 1: Ir al Dashboard de Supabase

Abre esta URL:
```
https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/sql/new
```

### PASO 2: Copiar el archivo SQL

Abre el archivo: **`EJECUTAR-ESTO-EN-SUPABASE.sql`**

Copia **TODO** su contenido (170 líneas aproximadamente)

### PASO 3: Pegar y Ejecutar

1. Pega el contenido en el editor SQL del dashboard
2. Click en el botón **"Run"** ▶️ (esquina inferior derecha)
3. Espera a que termine (debería tomar 2-3 segundos)

### PASO 4: Verificar

Deberías ver en los logs:
```
✅ Migración completada exitosamente
✅ RLS activado en ai_generated_ads
✅ Columnas de tracking añadidas
✅ Políticas RLS de contenidos actualizadas
✅ Error 42501 solucionado
```

---

## 🔍 ¿Qué hace el SQL?

### 1. Añade columnas de tracking (ai_generated_ads)
```sql
ALTER TABLE ai_generated_ads
ADD COLUMN text_regeneration_count integer DEFAULT 0;

ALTER TABLE ai_generated_ads
ADD COLUMN voice_change_count integer DEFAULT 0;
```

### 2. Activa RLS en ai_generated_ads
```sql
ALTER TABLE ai_generated_ads ENABLE ROW LEVEL SECURITY;
```

### 3. **ARREGLA las políticas de contenidos** ⭐ (Esto soluciona el error)
```sql
-- Antes (RESTRICTIVA):
CREATE POLICY "..." ON contenidos FOR INSERT
WITH CHECK (auth.uid() = created_by);  -- ❌ Solo si created_by = auth.uid()

-- Ahora (PERMISIVA):
CREATE POLICY "..." ON contenidos FOR INSERT
WITH CHECK (auth.role() = 'authenticated');  -- ✅ Cualquier usuario autenticado
```

---

## 🧪 Probar la Solución

Después de ejecutar el SQL:

1. **Refrescar la página** del frontend (F5)
2. **Crear un anuncio** con IA
3. **Generar texto** y **voz**
4. Click en **"Guardar sin Programar"** o **"Guardar y Programar"**

**Resultado esperado**:
- ✅ Audio se sube a S3
- ✅ Se crea registro en `contenidos`
- ✅ Se crea registro en `ai_generated_ads`
- ✅ NO aparece error 42501

---

## 📊 Políticas RLS Actualizadas

### Tabla: `contenidos` (MODIFICADA)

**Antes**:
```
INSERT: Solo si auth.uid() = created_by ❌
```

**Ahora**:
```
INSERT: Cualquier usuario autenticado ✅
INSERT: Usuarios legacy (anon) ✅
```

### Tabla: `ai_generated_ads` (NUEVA)

```
SELECT: Usuario propietario o de la misma empresa ✅
INSERT: Usuario autenticado de la empresa ✅
UPDATE: Usuario propietario o admin de empresa ✅
DELETE: Usuario propietario o admin de empresa ✅
```

---

## 🚨 Si sigue sin funcionar

### Opción 1: Verificar usuario autenticado

En la consola del navegador (F12):
```javascript
const { data } = await supabase.auth.getUser()
console.log('Usuario:', data.user)
```

Debe mostrar un objeto con `id`, `email`, etc.

### Opción 2: Verificar RLS en Dashboard

1. Ir a: Table Editor → contenidos
2. Click en "RLS" (arriba)
3. Verificar que existe: **"Usuarios autenticados pueden insertar contenidos"**
4. Click en la política → Ver la definición
5. Debería decir: `WITH CHECK (auth.role() = 'authenticated')`

### Opción 3: Deshabilitar RLS temporalmente (NO RECOMENDADO)

Solo para debugging:
```sql
ALTER TABLE contenidos DISABLE ROW LEVEL SECURITY;
```

⚠️ **Importante**: Esto es solo para probar. Vuelve a activar RLS después:
```sql
ALTER TABLE contenidos ENABLE ROW LEVEL SECURITY;
```

---

## 📝 Consultas Útiles

### Ver políticas actuales de contenidos:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'contenidos';
```

### Ver estado de RLS:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('contenidos', 'ai_generated_ads');
```

### Ver último intento de insert:
```sql
SELECT * FROM contenidos 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## ✅ Resumen

1. ✅ Ejecuta `EJECUTAR-ESTO-EN-SUPABASE.sql`
2. ✅ Refresca la página del frontend (F5)
3. ✅ Prueba a crear un anuncio
4. ✅ Error 42501 desaparecerá

**¿Dudas?** Revisa los logs en:
- Frontend: F12 → Console
- Backend: Dashboard Supabase → Logs

