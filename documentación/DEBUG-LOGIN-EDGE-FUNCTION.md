# 🔍 Debug: Error 401 en Edge Function de Login

## 🚨 Problema Actual

El login está fallando con error **401 (Unauthorized)** en la Edge Function `/functions/v1/login`.

## 📋 Pasos para Diagnosticar

### Paso 1: Verificar que la Edge Function está desplegada

```bash
# Verificar funciones desplegadas
supabase functions list

# Debe mostrar "login" en la lista
```

Si no está desplegada:
```bash
supabase functions deploy login
```

### Paso 2: Ver logs de la Edge Function

**Opción A: Desde Supabase Dashboard (Recomendado)**

1. Ve a: https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/functions
2. Click en la función **login**
3. Ve a la pestaña **Logs**
4. Intenta hacer login desde la aplicación
5. Los logs aparecerán en tiempo real

**Opción B: Actualizar Supabase CLI (si quieres usar CLI)**

```bash
# Actualizar Supabase CLI
brew upgrade supabase/tap/supabase  # Mac
# o
npm install -g supabase@latest      # Windows/Linux

# Luego ver logs
supabase functions logs login
```

**Opción C: Usar curl para probar directamente**

```bash
curl -X POST https://nazlyvhndymalevkfpnl.supabase.co/functions/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "TikiTakaAlbatera",
    "password": "TikiTakaRadio"
  }' -v
```

Luego revisa los logs en el Dashboard.

**Logs esperados:**
- ✅ `🔐 Login attempt: { username: "...", hasPassword: true }`
- ✅ `🔍 Buscando usuario: ...`
- ✅ `✅ Usuario encontrado: ...`
- ✅ `🔐 Verificando contraseña: ...`
- ✅ `✅ Login exitoso para usuario: ...`

**Si ves errores:**
- ❌ `❌ Usuario no encontrado` → El usuario no existe en la BD
- ❌ `❌ Contraseña inválida` → La contraseña no coincide
- ❌ `❌ Error verificando hash bcrypt` → Problema con bcrypt

### Paso 3: Verificar usuario en la base de datos

Ejecuta en Supabase SQL Editor:

```sql
-- Verificar que el usuario existe
SELECT 
  id,
  username,
  CASE 
    WHEN password LIKE '$2%' THEN '✅ Hasheada'
    WHEN password IS NULL OR password = '' THEN '⚠️ Sin password'
    ELSE '❌ Texto plano'
  END as estado_password,
  LEFT(password, 30) || '...' as password_preview
FROM usuarios
WHERE username = 'TikiTakaAlbatera';
```

**Resultado esperado:**
- Debe existir el usuario
- La contraseña debe estar hasheada (empezar con `$2`)

### Paso 4: Probar login directamente con la Edge Function

```bash
# Probar login directamente (con verbose para ver detalles)
curl -X POST https://nazlyvhndymalevkfpnl.supabase.co/functions/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "TikiTakaAlbatera",
    "password": "TikiTakaRadio"
  }' -v
```

**Respuesta exitosa esperada:**
```json
{
  "user": {
    "id": "...",
    "username": "TikiTakaAlbatera",
    "rol_id": 1,
    ...
  },
  "success": true
}
```

**Si hay error 401:**
- Revisa los logs en el Dashboard
- Verifica que el usuario existe y tiene contraseña

### Paso 5: Verificar variables de entorno de la Edge Function

En Supabase Dashboard:
1. Ve a **Edge Functions** → **Manage secrets**
2. Verifica que existen:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

Si no existen, añádelas:
- `SUPABASE_URL`: `https://nazlyvhndymalevkfpnl.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Tu Service Role Key (Settings → API → service_role key)

## 🔧 Soluciones Comunes

### Problema: "Usuario no encontrado"

**Causa:** El username no existe en la tabla `usuarios`

**Solución:**
1. Verifica que el usuario existe:
```sql
SELECT * FROM usuarios WHERE username = 'TikiTakaAlbatera';
```

2. Verifica que el username es exacto (case-sensitive en algunos casos)

### Problema: "Contraseña inválida"

**Causa:** La contraseña no coincide con el hash almacenado

**Solución:**
1. Verifica que la contraseña en la BD está hasheada correctamente
2. Si está en texto plano, la Edge Function debería hashearla automáticamente
3. Si está hasheada pero no funciona, puede ser un problema con bcrypt

### Problema: "Error verificando hash bcrypt"

**Causa:** Problema con la librería bcrypt en Deno

**Solución:**
1. Verifica que `deno.json` tiene el import correcto:
```json
{
  "imports": {
    "bcrypt": "https://deno.land/x/bcrypt@v0.4.1/mod.ts"
  }
}
```

2. Si sigue fallando, prueba con otra versión:
```typescript
import { compare, hash } from 'https://esm.sh/bcryptjs@2.4.3'
```

### Problema: Edge Function no responde

**Causa:** La función no está desplegada o hay un error de sintaxis

**Solución:**
1. Verifica que está desplegada: `supabase functions list`
2. Revisa logs de errores: `supabase functions logs login`
3. Verifica sintaxis del código TypeScript

## 📊 Checklist de Verificación

- [ ] Edge Function está desplegada (`supabase functions list`)
- [ ] Variables de entorno configuradas (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Usuario existe en la tabla `usuarios`
- [ ] Contraseña está hasheada (empieza con `$2`)
- [ ] Logs muestran el flujo completo sin errores
- [ ] Login funciona con curl directo

## 🆘 Si Nada Funciona

1. **Revisa logs completos en el Dashboard:**
   - Ve a: https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/functions
   - Click en **login** → Pestaña **Logs**
   - Filtra por "Error" o "Warning" si hay muchos logs

2. **Verifica el código de la Edge Function:**
   - Asegúrate de que `deno.json` existe
   - Verifica que los imports son correctos
   - Revisa que no hay errores de sintaxis

3. **Prueba con un usuario de prueba:**
   - Crea un usuario nuevo con contraseña conocida
   - Hashea la contraseña manualmente
   - Intenta hacer login

4. **Contacta soporte:**
   - Comparte los logs completos
   - Indica qué pasos ya intentaste
   - Menciona el error específico que ves

