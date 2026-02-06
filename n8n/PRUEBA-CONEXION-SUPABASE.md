# 🧪 Prueba de Conexión a Supabase - Paso a Paso

## 📋 Configuración para tu Proyecto

**Proyecto**: `vqhaoerphnyahnbemmdd`  
**Contraseña**: `gNcilTolun2tk9wV`

---

## ✅ Paso 1: Configuración en n8n

### Opción A: Conexión con Pooler (Recomendada)

En la credencial "Supabase ONDEON" de n8n, configura:

```
Connection: db.vqhaoerphnyahnbemmdd.supabase.co
Database: postgres
User: postgres.vqhaoerphnyahnbemmdd
Password: gNcilTolun2tk9wV
Port: 5432
Maximum Connections: 100
Ignore SSL Issues: ✅ Activado
```

### Opción B: Conexión Directa (Si la A no funciona)

```
Connection: db.vqhaoerphnyahnbemmdd.supabase.co
Database: postgres
User: postgres
Password: gNcilTolun2tk9wV
Port: 5432
Maximum Connections: 100
SSL: Allow (o Ignore SSL Issues)
```

---

## 🔍 Paso 2: Verificar desde Terminal (Diagnóstico)

Para diagnosticar el problema, prueba conectarte desde terminal:

### Instalar psql (si no lo tienes)

**macOS:**
```bash
brew install postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql-client
```

### Prueba 1: Conexión con Pooler

```bash
psql "postgresql://postgres.vqhaoerphnyahnbemmdd:gNcilTolun2tk9wV@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres?sslmode=require"
```

### Prueba 2: Conexión Directa

```bash
psql "postgresql://postgres:gNcilTolun2tk9wV@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres?sslmode=require"
```

### Prueba 3: Con SSL deshabilitado (solo para diagnóstico)

```bash
psql "postgresql://postgres:gNcilTolun2tk9wV@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres?sslmode=disable"
```

**Si alguna de estas conexiones funciona**, entonces el problema está en la configuración de n8n, no en las credenciales.

---

## 🛠️ Paso 3: Soluciones Específicas según el Error

### Error: "password authentication failed"

**Causa**: La contraseña es incorrecta o tiene caracteres especiales mal escapados.

**Solución**:
1. Verifica que la contraseña en Supabase sea exactamente `gNcilTolun2tk9wV`
2. En n8n, asegúrate de copiar la contraseña sin espacios al inicio o final
3. Si la contraseña tiene caracteres especiales, podrías necesitar usar la connection string completa

### Error: "connection refused" o "timeout"

**Causa**: La IP de n8n está bloqueada o hay problemas de red.

**Solución**:
1. Ve a Supabase Dashboard → Settings → Database
2. Busca **Network Restrictions** o **Connection Pooling**
3. Permite todas las IPs temporalmente: `0.0.0.0/0`
4. O agrega la IP específica de tu servidor n8n

### Error: "SSL connection required"

**Causa**: Problema con la configuración SSL.

**Solución**:
1. En n8n, activa **"Ignore SSL Issues (Insecure)"** ✅
2. O configura SSL correctamente con certificados

---

## 🔗 Paso 4: Usar Connection String Completo en n8n

Si los campos individuales no funcionan, prueba usar la connection string completa:

### Connection String para Pooler:
```
postgresql://postgres.vqhaoerphnyahnbemmdd:gNcilTolun2tk9wV@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres?sslmode=require
```

### Connection String para Conexión Directa:
```
postgresql://postgres:gNcilTolun2tk9wV@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres?sslmode=require
```

**En n8n:**
1. Abre la credencial
2. En el campo **"Connection"**, pega la connection string completa
3. Deja los otros campos (User, Password, etc.) vacíos o con valores por defecto
4. Guarda y prueba

---

## ✅ Paso 5: Verificar en Supabase Dashboard

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto `vqhaoerphnyahnbemmdd`
3. Ve a **Settings** → **Database**
4. Verifica:
   - ✅ Que el proyecto esté activo (no pausado)
   - ✅ Que la contraseña sea la correcta
   - ✅ Que no haya restricciones de red bloqueando conexiones

---

## 🧪 Paso 6: Probar con un Nodo Simple en n8n

Crea un workflow de prueba simple:

1. Crea un nuevo workflow en n8n
2. Agrega un nodo **Postgres**
3. Selecciona la credencial "Supabase ONDEON"
4. Configura una query simple:
   ```sql
   SELECT 1 as test;
   ```
5. Ejecuta el workflow
6. Si funciona, el problema está en el workflow principal, no en las credenciales

---

## 📝 Checklist Final

Antes de probar de nuevo, verifica:

- [ ] Contraseña copiada correctamente: `gNcilTolun2tk9wV` (sin espacios)
- [ ] Host correcto: `db.vqhaoerphnyahnbemmdd.supabase.co`
- [ ] Usuario correcto: `postgres.vqhaoerphnyahnbemmdd` (pooler) o `postgres` (directo)
- [ ] Puerto: `5432`
- [ ] Base de datos: `postgres`
- [ ] SSL: "Ignore SSL Issues" activado o "Allow"
- [ ] IP de n8n permitida en Supabase (o todas las IPs permitidas temporalmente)

---

## 🆘 Si Nada Funciona

1. **Resetea la contraseña en Supabase**:
   - Ve a Supabase Dashboard → Settings → Database
   - Haz clic en **"Reset database password"**
   - ⚠️ Esto reiniciará la base de datos, así que hazlo solo si es necesario
   - Usa la nueva contraseña en n8n

2. **Crea una nueva credencial en n8n**:
   - Elimina la credencial actual
   - Crea una nueva desde cero
   - Configura todos los campos de nuevo

3. **Verifica el estado de Supabase**:
   - Revisa https://status.supabase.com
   - Verifica que tu proyecto no esté pausado

---

## 💡 Configuración Recomendada Final

Para tu proyecto específico, usa esta configuración exacta:

```
Connection: db.vqhaoerphnyahnbemmdd.supabase.co
Database: postgres
User: postgres.vqhaoerphnyahnbemmdd
Password: gNcilTolun2tk9wV
Port: 5432
Maximum Connections: 100
Ignore SSL Issues: ✅ Activado
```

O prueba con conexión directa:

```
Connection: db.vqhaoerphnyahnbemmdd.supabase.co
Database: postgres
User: postgres
Password: gNcilTolun2tk9wV
Port: 5432
Maximum Connections: 100
SSL: Allow
```

---

**¿Qué error específico ves cuando pruebas la conexión en n8n?** Comparte el mensaje exacto para ayudarte mejor.
