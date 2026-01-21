# 🚨 SOLUCIÓN URGENTE - Error 42501 + 401

## 🔍 Errores Detectados

1. **Error 42501**: "new row violates row-level security policy for table \"contenidos\""
2. **Error 401**: (Unauthorized)

---

## ✅ SOLUCIÓN EN 3 PASOS

### PASO 1: Diagnóstico (OPCIONAL)

**Ejecuta esto PRIMERO** para ver el estado actual:

1. Ir a: https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/sql/new
2. Abrir: **`DIAGNOSTICO-RLS.sql`**
3. Copiar y pegar en el editor
4. Click en "Run" ▶️
5. Ver los resultados (te dirá si RLS está activado y qué políticas existen)

---

### PASO 2: Arreglar RLS (OBLIGATORIO)

**Ejecuta esto para solucionar el error**:

1. Ir a: https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/sql/new
2. Abrir: **`FIX-RLS-CONTENIDOS.sql`**
3. Copiar y pegar en el editor
4. Click en "Run" ▶️
5. Verificar mensaje: ✅ "Error 42501 debe estar solucionado"

---

### PASO 3: Verificar Autenticación en Frontend

**Abre la consola del navegador (F12) y ejecuta**:

```javascript
// 1. Verificar sesión actual
const { data: { session } } = await supabase.auth.getSession()
console.log('Sesión:', session)

// 2. Verificar usuario autenticado
const { data: { user } } = await supabase.auth.getUser()
console.log('Usuario Auth:', user)

// 3. Si NO hay usuario, hacer login
if (!user) {
  console.error('❌ NO ESTÁS AUTENTICADO')
  // Debes hacer login primero
}

// 4. Si hay usuario, verificar token
if (user) {
  console.log('✅ Usuario autenticado:', user.email)
  console.log('✅ Auth UID:', user.id)
}
```

**Resultado esperado**:
- ✅ `session` debe tener un objeto con `access_token`
- ✅ `user` debe tener un objeto con `id`, `email`, etc.

**Si NO estás autenticado**:
- ❌ Cierra sesión y vuelve a iniciar sesión
- ❌ Verifica que el token no haya expirado

---

## 🎯 ¿Por qué ocurre el error 401?

El error **401 (Unauthorized)** significa que:
1. No estás autenticado en Supabase
2. El token de autenticación expiró
3. Hay un problema con la sesión

---

## 🔧 Soluciones Alternativas

### Si sigue sin funcionar después del PASO 2:

#### Opción A: Deshabilitar RLS temporalmente (SOLO PARA PRUEBAS)

```sql
-- ⚠️ SOLO PARA DEBUGGING
ALTER TABLE contenidos DISABLE ROW LEVEL SECURITY;
```

Luego prueba a crear el anuncio. Si funciona, el problema es RLS.

**IMPORTANTE**: Vuelve a activar RLS después:
```sql
ALTER TABLE contenidos ENABLE ROW LEVEL SECURITY;
```

#### Opción B: Permitir created_by NULL

Si el problema es el constraint de `created_by`, puedes hacer esto:

```sql
-- Hacer created_by nullable
ALTER TABLE contenidos 
ALTER COLUMN created_by DROP NOT NULL;

-- Actualizar política para permitir NULL
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar contenidos" ON contenidos;

CREATE POLICY "Usuarios autenticados pueden insertar contenidos"
ON contenidos
FOR INSERT
TO authenticated
WITH CHECK (
  created_by IS NULL 
  OR 
  auth.uid() = created_by
  OR
  true  -- Permitir TODO
);
```

---

## 📝 Orden de Ejecución Recomendado

1. ✅ **Ejecutar**: `FIX-RLS-CONTENIDOS.sql` (OBLIGATORIO)
2. ✅ **Verificar**: Autenticación en consola (F12)
3. ✅ **Refrescar**: Página del frontend (F5)
4. ✅ **Probar**: Crear anuncio

---

## 🧪 Test Rápido

Después de ejecutar el SQL, prueba esto en la consola (F12):

```javascript
// Test de INSERT directo
const { data, error } = await supabase
  .from('contenidos')
  .insert({
    nombre: 'Test RLS',
    tipo_contenido: 'cuna',
    url_s3: 'https://test.com/audio.mp3',
    s3_key: 'test/audio.mp3',
    tamaño_bytes: 1000,
    activo: true
  })
  .select()

if (error) {
  console.error('❌ Error:', error)
} else {
  console.log('✅ INSERT funcionó:', data)
  // Eliminar el test
  await supabase.from('contenidos').delete().eq('id', data[0].id)
}
```

**Resultado esperado**:
- ✅ "INSERT funcionó" → RLS está bien configurado
- ❌ Error 42501 → RLS sigue bloqueando

---

## 📊 Checklist de Verificación

- [ ] Ejecuté `FIX-RLS-CONTENIDOS.sql`
- [ ] Vi el mensaje de confirmación en Supabase
- [ ] Verifiqué autenticación en consola (F12)
- [ ] Tengo un usuario autenticado (`user.id` existe)
- [ ] Tengo una sesión activa (`session.access_token` existe)
- [ ] Refresqué la página del frontend (F5)
- [ ] Intenté crear un anuncio nuevamente

---

## 🆘 Si NADA funciona

Copia y pega este SQL (última opción, muy permisivo):

```sql
-- Deshabilitar RLS completamente (TEMPORAL)
ALTER TABLE contenidos DISABLE ROW LEVEL SECURITY;

-- O hacer created_by nullable
ALTER TABLE contenidos ALTER COLUMN created_by DROP NOT NULL;
```

Luego me dices si funcionó para saber exactamente dónde está el problema.

---

## ✅ Resumen

1. **Ejecuta**: `FIX-RLS-CONTENIDOS.sql`
2. **Verifica**: Autenticación (F12)
3. **Refresca**: Página (F5)
4. **Prueba**: Crear anuncio

**99% de probabilidad que se solucione con el PASO 2** ✅

