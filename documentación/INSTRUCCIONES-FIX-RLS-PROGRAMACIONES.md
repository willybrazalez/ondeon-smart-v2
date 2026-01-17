# 🔧 Solución: Error 42501 - RLS en Programaciones

## ❌ Error Detectado

```
Error code: 42501
Message: "new row violates row-level security policy for table \"programaciones\""
```

---

## 🎯 Causa

Las tablas relacionadas con programaciones no tienen políticas RLS configuradas, por lo que tanto usuarios autenticados como legacy (anon) no pueden insertar, actualizar o eliminar registros.

---

## ✅ Solución

### Paso 1: Ejecutar SQL en Supabase Dashboard

1. Ve a **Supabase Dashboard** → tu proyecto `nazlyvhndymalevkfpnl`
2. Click en **SQL Editor** (menú lateral izquierdo)
3. Click en **"New Query"**
4. Copia y pega el contenido completo del archivo:
   **`FIX-RLS-PROGRAMACIONES.sql`**
5. Click en **"Run"** (o presiona `Ctrl/Cmd + Enter`)

### Paso 2: Verificar las políticas

Ejecuta este query para confirmar que se crearon correctamente:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('programaciones', 'programacion_contenidos', 'programacion_destinatarios')
ORDER BY tablename, policyname;
```

Deberías ver **24 políticas** en total:
- 8 para `programaciones` (4 authenticated + 4 anon)
- 8 para `programacion_contenidos`
- 8 para `programacion_destinatarios`

---

## 🔧 Cambios en el Código

### `aiAdService.js` - Actualizado ✅

Se añadió el campo **`tipo: 'usuario'`** al insertar destinatarios:

```javascript
// Antes (causaba error de constraint)
const destinatarios = usuariosIds.map(userId => ({
  programacion_id: programacion.id,
  usuario_id: userId,
  activo: true
}));

// Ahora (correcto)
const destinatarios = usuariosIds.map(userId => ({
  programacion_id: programacion.id,
  tipo: 'usuario', // ✅ Campo obligatorio
  usuario_id: userId,
  activo: true
}));
```

---

## 📊 Tablas Afectadas

### 1. `programaciones`
Campos principales:
- `tipo`: 'diaria' | 'semanal' | 'anual'
- `estado`: 'pendiente' | 'activo' | 'pausado' | 'completado' | 'cancelado'
- `modo_audio`: 'fade_out' | 'background' | 'silencio'
- Configuraciones de periodicidad (daily_mode, weekly_days, etc.)

### 2. `programacion_contenidos`
Relaciona una programación con sus contenidos:
- `programacion_id` → `programaciones.id`
- `contenido_id` → `contenidos.id`
- `orden`, `activo`

### 3. `programacion_destinatarios`
Define a quién se envía la programación:
- `programacion_id` → `programaciones.id`
- **`tipo`**: 'usuario' | 'grupo' | 'empresa' | 'sector' (obligatorio)
- `usuario_id`, `grupo_id`, `empresa_id`, `sector_id` (según tipo)

---

## 🧪 Prueba después de ejecutar

1. **Refresca la aplicación** (F5 o Ctrl/Cmd + R)
2. Ve a **Anuncios con IA** → **Crear anuncio**
3. Completa los pasos 1-4
4. Click en **"Guardar y Programar"**
5. Configura la programación completa
6. Click en **"Programar Anuncio"**

**Resultado esperado**: 
- ✅ Sin errores 42501
- ✅ Mensaje: "¡Anuncio programado exitosamente!"
- ✅ Se crearon registros en `programaciones`, `programacion_contenidos` y `programacion_destinatarios`

---

## 🔍 Verificación en Base de Datos

Después de programar un anuncio, verifica:

```sql
-- Ver última programación creada
SELECT * FROM programaciones 
ORDER BY created_at DESC 
LIMIT 1;

-- Ver contenido asociado
SELECT pc.*, c.nombre 
FROM programacion_contenidos pc
JOIN contenidos c ON c.id = pc.contenido_id
WHERE pc.programacion_id = '[UUID-DE-LA-PROGRAMACION]';

-- Ver destinatarios
SELECT pd.*, u.nombre, u.username
FROM programacion_destinatarios pd
LEFT JOIN usuarios u ON u.id = pd.usuario_id
WHERE pd.programacion_id = '[UUID-DE-LA-PROGRAMACION]';
```

---

## ⚠️ Notas Importantes

1. **Políticas Permisivas**: Las políticas actuales son muy permisivas (`USING (true)`) para facilitar el desarrollo. En producción, considera restringirlas según tus reglas de negocio.

2. **Usuarios Legacy (anon)**: Las políticas también cubren usuarios sin sesión autenticada, lo cual es necesario para tu sistema actual.

3. **Campo `tipo` obligatorio**: Asegúrate de siempre incluir el campo `tipo` al insertar en `programacion_destinatarios`.

4. **Constraint de destinatario único**: La tabla tiene un constraint que verifica que solo se especifique un tipo de destinatario a la vez (usuario O grupo O empresa O sector).

---

## 📁 Archivos Creados/Modificados

1. ✅ **`FIX-RLS-PROGRAMACIONES.sql`** - SQL para ejecutar en Supabase
2. ✅ **`src/services/aiAdService.js`** - Añadido campo `tipo` a destinatarios
3. ✅ **`INSTRUCCIONES-FIX-RLS-PROGRAMACIONES.md`** - Este archivo

---

**Ejecuta el SQL y prueba de nuevo!** 🚀

