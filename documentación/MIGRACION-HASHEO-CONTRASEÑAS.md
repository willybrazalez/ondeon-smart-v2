# 🔐 Migración: Hashear Contraseñas Legacy

## 📋 Resumen

Este proceso migra todas las contraseñas en texto plano de la tabla `usuarios` a formato hasheado (bcrypt) y actualiza la Edge Function de login para verificar hashes.

**Tiempo estimado:** 10-15 minutos  
**Impacto:** Mejora significativa de seguridad

---

## ⚠️ IMPORTANTE ANTES DE EMPEZAR

1. **Backup:** Supabase hace backups automáticos, pero verifica que estén activos
2. **Horario:** Ejecuta durante horario de bajo tráfico si es posible
3. **Pruebas:** Prueba primero con un usuario de prueba

---

## 📝 Paso 1: Ejecutar Script SQL de Migración

### 1.1 Abrir SQL Editor en Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Click en **SQL Editor** (menú lateral)
3. Click en **New Query**

### 1.2 Ejecutar Script de Migración

1. Copia **TODO** el contenido de: `database/017_hash_passwords_usuarios.sql`
2. Pégalo en el SQL Editor
3. Click en **Run** (o Ctrl/Cmd + Enter)

### 1.3 Verificar Resultados

El script mostrará:
- ✅ Estado antes de la migración (cuántas contraseñas en texto plano)
- ✅ Cuántas contraseñas se hashearon
- ✅ Estado después de la migración

**Resultado esperado:**
```
✅ Contraseñas hasheadas: [número de usuarios]
```

**Si hay timeout:**
- El UPDATE puede tardar si hay muchos usuarios
- Usa esta versión en lotes (procesa 100 usuarios a la vez):
```sql
WITH usuarios_a_hashear AS (
  SELECT id, password
  FROM usuarios
  WHERE password IS NOT NULL
    AND password != ''
    AND password NOT LIKE '$2%'
  LIMIT 100
)
UPDATE usuarios u
SET password = crypt(u.password, gen_salt('bf', 10))
FROM usuarios_a_hashear uah
WHERE u.id = uah.id;
```
- Ejecuta esta query múltiples veces hasta que no actualice más registros
- Verifica cuántos quedan con:
```sql
SELECT COUNT(*) 
FROM usuarios
WHERE password IS NOT NULL
  AND password != ''
  AND password NOT LIKE '$2%';
```

---

## 🚀 Paso 2: Desplegar Edge Function Actualizada

### 2.1 Verificar Supabase CLI

```bash
# Verificar que tienes Supabase CLI instalado
supabase --version

# Si no lo tienes, instálalo:
# Mac:
brew install supabase/tap/supabase

# Windows/Linux:
npm install -g supabase
```

### 2.2 Login y Link Proyecto

```bash
# Login en Supabase
supabase login

# Link tu proyecto (reemplaza con tu Project Reference ID)
supabase link --project-ref nazlyvhndymalevkfpnl
```

**Obtener Project Reference ID:**
- Ve a Supabase Dashboard → Settings → General
- Copia el "Reference ID"

### 2.3 Desplegar Edge Function

```bash
# Navegar a tu proyecto
cd "/Users/willymac/Desktop/MACBOOK PRO 2015/ONDEON/Nuevo ONDEON/frontend-desktop"

# Desplegar la función login
supabase functions deploy login
```

**✅ Salida esperada:**
```
Deploying Function (project-ref = xxxxx)...
Deployed Function login
URL: https://xxxxx.supabase.co/functions/v1/login
```

---

## 🧪 Paso 3: Probar la Migración

### 3.1 Probar Login con Usuario Existente

1. Abre tu aplicación
2. Intenta hacer login con un usuario existente
3. Debe funcionar normalmente

### 3.2 Verificar Logs de Edge Function

```bash
# Ver logs en tiempo real
supabase functions logs login --follow
```

**Mientras pruebas login, deberías ver:**
- ✅ `✅ Contraseña hasheada automáticamente para usuario: [username]` (si encuentra texto plano)
- ✅ Login exitoso

### 3.3 Verificar en Base de Datos

```sql
-- Verificar que las contraseñas están hasheadas
SELECT 
  username,
  CASE 
    WHEN password LIKE '$2%' THEN '✅ Hasheada'
    WHEN password IS NULL OR password = '' THEN '⚠️ Sin password'
    ELSE '❌ Texto plano'
  END as estado_password
FROM usuarios
LIMIT 10;
```

**Todos deben mostrar "✅ Hasheada"**

---

## 🔍 Paso 4: Verificación Final

### 4.1 Verificar Estado de Contraseñas

```sql
SELECT 
  CASE 
    WHEN password LIKE '$2%' THEN 'Hasheada'
    WHEN password IS NULL OR password = '' THEN 'Sin password'
    ELSE 'Texto plano'
  END as tipo_password,
  COUNT(*) as cantidad
FROM usuarios
GROUP BY tipo_password
ORDER BY cantidad DESC;
```

**Resultado esperado:**
- ✅ Todas las contraseñas deben estar "Hasheada"
- ❌ No debe haber "Texto plano"

### 4.2 Probar Varios Usuarios

Prueba login con al menos 3-5 usuarios diferentes para asegurar que todo funciona.

---

## 🐛 Solución de Problemas

### Problema: Timeout en SQL

**Solución:**
Ejecuta el UPDATE en lotes más pequeños usando CTE:

```sql
-- Procesar en lotes de 100 usuarios
WITH usuarios_a_hashear AS (
  SELECT id, password
  FROM usuarios
  WHERE password IS NOT NULL
    AND password != ''
    AND password NOT LIKE '$2%'
  LIMIT 100
)
UPDATE usuarios u
SET password = crypt(u.password, gen_salt('bf', 10))
FROM usuarios_a_hashear uah
WHERE u.id = uah.id;

-- Ejecuta esta query múltiples veces hasta que no actualice más registros
-- Verifica cuántos quedan:
SELECT COUNT(*) 
FROM usuarios
WHERE password IS NOT NULL
  AND password != ''
  AND password NOT LIKE '$2%';
```

### Problema: Error en Edge Function "bcrypt not found"

**Solución:**
Verifica que el archivo `deno.json` existe y tiene el import correcto:

```json
{
  "imports": {
    "bcrypt": "https://deno.land/x/bcrypt@v0.4.1/mod.ts"
  }
}
```

Si sigue fallando, prueba con otra versión:

```typescript
import { compare, hash } from 'https://esm.sh/bcryptjs@2.4.3'
```

### Problema: Login falla después de migración

**Solución:**
1. Verifica que la Edge Function está desplegada correctamente
2. Revisa los logs: `supabase functions logs login --follow`
3. Verifica que el usuario existe y tiene contraseña hasheada

### Problema: Usuarios no pueden hacer login

**Solución temporal:**
La Edge Function tiene compatibilidad con texto plano durante la migración. Si un usuario tiene contraseña en texto plano, se hasheará automáticamente al hacer login.

---

## ✅ Checklist de Verificación

- [ ] Script SQL ejecutado sin errores
- [ ] Todas las contraseñas están hasheadas (verificación SQL)
- [ ] Edge Function desplegada correctamente
- [ ] Login funciona con usuarios existentes
- [ ] Logs de Edge Function muestran actividad normal
- [ ] Al menos 3 usuarios probados exitosamente

---

## 📊 Estado Post-Migración

Después de la migración:

✅ **Seguridad mejorada:**
- Contraseñas hasheadas con bcrypt (cost factor 10)
- No se pueden ver contraseñas originales
- Cumple con estándares de seguridad modernos

✅ **Compatibilidad mantenida:**
- Sistema legacy sigue funcionando
- Usuarios pueden seguir usando username/password
- No requiere cambios en el frontend

✅ **Migración automática:**
- Si queda alguna contraseña en texto plano, se hasheará automáticamente al hacer login
- No requiere intervención manual

---

## 🔄 Próximos Pasos (Opcional)

Una vez que todas las contraseñas estén hasheadas:

1. **Eliminar compatibilidad con texto plano** (después de 1-2 semanas)
   - Remover la lógica de texto plano de la Edge Function
   - Solo aceptar contraseñas hasheadas

2. **Implementar cambio de contraseña** (futuro)
   - Página de perfil para cambiar contraseña
   - Edge Function para cambio de contraseña

3. **Monitoreo**
   - Revisar logs periódicamente
   - Verificar que no hay intentos de login con texto plano

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs de la Edge Function
2. Verifica el estado de las contraseñas en la BD
3. Consulta esta documentación
4. Revisa la documentación de Supabase: https://supabase.com/docs

