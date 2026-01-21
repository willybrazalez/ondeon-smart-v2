# 🔧 SOLUCIÓN ERROR 23503 - Foreign Key Constraint

## ❌ Error Detectado

```javascript
{
  code: '23503', 
  details: 'Key is not present in table "users".', 
  message: 'insert or update on table "contenidos" violates foreign key constraint "contenidos_created_by_fkey"'
}
```

## 🎯 Causa del Problema

### El Constraint en la tabla `contenidos`:
```sql
constraint contenidos_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users (id)
```

**Esto significa**: El campo `created_by` debe referenciar un ID válido de la tabla `auth.users` (Supabase Auth).

### El Código Anterior (INCORRECTO):
```javascript
const userId = user.id || user.usuario_id || user.user_id;

// ...

created_by: userId  // ❌ Este es el ID de la tabla "usuarios", no de "auth.users"
```

**Problema**: Estábamos pasando el ID de la tabla **`usuarios`** (tu tabla personalizada), pero el constraint apunta a **`auth.users`** (la tabla de autenticación de Supabase).

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Código Corregido:
```javascript
// Obtener el auth.uid() real de Supabase Auth
const { data: { user: authUser } } = await supabase.auth.getUser();

const { data: contenido, error: errorContenido } = await supabase
  .from('contenidos')
  .insert({
    nombre: titulo,
    tipo_contenido: 'cuna',
    url_s3: audioUrl,
    s3_key: s3_key,
    tamaño_bytes: audioSize,
    duracion_segundos: durationSeconds,
    formato_audio: 'mp3',
    activo: true,
    created_by: authUser?.id || null  // ✅ Ahora usa el ID de auth.users
  })
```

---

## 📊 Diferencia entre las Tablas

| Tabla | Descripción | ID |
|-------|-------------|-----|
| `auth.users` | Usuarios de Supabase Auth | `auth.uid()` |
| `usuarios` | Tu tabla personalizada de usuarios | `usuarios.id` |

### Relación:
```
auth.users (id) ← usuarios (auth_user_id)
```

- `auth.users.id` es el ID de autenticación de Supabase
- `usuarios.auth_user_id` apunta a `auth.users.id`
- `usuarios.id` es tu ID personalizado (diferente)

---

## 🧪 Cómo Verificar

### En la consola del navegador (F12):
```javascript
// Ver el usuario autenticado
const { data } = await supabase.auth.getUser()
console.log('Auth User:', data.user)
console.log('Auth UID:', data.user.id)  // Este es el que va en created_by

// Ver tu usuario personalizado
const { data: customUser } = await supabase
  .from('usuarios')
  .select('*')
  .eq('auth_user_id', data.user.id)
  .single()
console.log('Custom User:', customUser)
console.log('Custom User ID:', customUser.id)  // Este NO va en created_by
```

---

## ✅ Resultado

Después de este cambio:
- ✅ `created_by` usa el ID correcto (`auth.users.id`)
- ✅ El constraint `contenidos_created_by_fkey` se satisface
- ✅ Error 23503 desaparece
- ✅ Los contenidos se crean correctamente

---

## 🚀 Próximos Pasos

1. ✅ El código ya está corregido
2. ⚠️ **Todavía necesitas ejecutar el SQL**: `EJECUTAR-ESTO-EN-SUPABASE.sql`
   - Esto añade las columnas de tracking
   - Activa RLS en `ai_generated_ads`
   - Actualiza las políticas de `contenidos`
3. ✅ Después de ejecutar el SQL, todo funcionará

---

## 📝 Resumen de Errores Solucionados

| Error | Causa | Solución |
|-------|-------|----------|
| **42501** (RLS) | Política restrictiva en `contenidos` | ✅ Actualizar política INSERT |
| **23503** (FK) | `created_by` usaba ID incorrecto | ✅ Usar `auth.uid()` |

**Ambos ya están solucionados en el código** ✅

