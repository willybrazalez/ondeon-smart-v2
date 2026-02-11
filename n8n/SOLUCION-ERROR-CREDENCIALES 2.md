# 🔧 Solución: Error en Credenciales de Supabase

## 🔍 Diagnóstico del Problema

Basado en tu configuración actual:
- **Host**: `db.vqhaoerphnyahnbemmdd.supabase.co` ✅
- **User**: `postgres.vqhaoerphnyahnbemmdd` ✅ (formato pooler)
- **Port**: `5432` ✅
- **SSL**: Ignorar problemas activado ✅

## ✅ Soluciones Paso a Paso

### Solución 1: Verificar Contraseña (Más Común)

1. **Obtén la contraseña correcta desde Supabase**:
   - Ve a [Supabase Dashboard](https://app.supabase.com)
   - Selecciona tu proyecto (`vqhaoerphnyahnbemmdd`)
   - Ve a **Settings** → **Database**
   - En la sección **Database password**, puedes:
     - Ver la contraseña si la tienes guardada
     - O hacer clic en **Reset database password** (⚠️ esto reiniciará la BD)

2. **Actualiza la contraseña en n8n**:
   - Abre la credencial "Supabase ONDEON" en n8n
   - Pega la contraseña correcta
   - Guarda los cambios
   - Prueba la conexión

### Solución 2: Verificar Permisos de IP

Supabase puede estar bloqueando la IP de tu servidor n8n:

1. **Obtén la IP de tu servidor n8n**:
   - Si n8n está en un servidor, obtén su IP pública
   - Puedes usar: `curl ifconfig.me` desde el servidor
   - O revisa los logs de n8n para ver la IP

2. **Permite la IP en Supabase**:
   - Ve a Supabase Dashboard → Settings → Database
   - Busca **Network Restrictions** o **Connection Pooling**
   - Agrega la IP de n8n a la lista de IPs permitidas
   - O temporalmente, permite todas las IPs (0.0.0.0/0) para probar

### Solución 3: Probar Conexión Directa (Sin Pooler)

El formato `postgres.vqhaoerphnyahnbemmdd` es para el pooler. Prueba con conexión directa:

1. **Edita la credencial en n8n**:
   ```
   Host: db.vqhaoerphnyahnbemmdd.supabase.co
   Database: postgres
   User: postgres  ← Cambia esto (sin el .vqhaoerphnyahnbemmdd)
   Password: [tu-contraseña]
   Port: 5432
   SSL: Allow (o Ignore SSL Issues)
   ```

2. **Guarda y prueba**

### Solución 4: Usar Connection String Completo

En lugar de campos individuales, prueba usar la connection string completa:

1. **Obtén la connection string desde Supabase**:
   - Ve a Supabase Dashboard → Settings → Database
   - En **Connection string**, selecciona **URI**
   - Copia la cadena completa (ej: `postgresql://postgres:[PASSWORD]@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres`)

2. **En n8n, usa el campo "Connection"**:
   - En lugar de llenar Host, User, Password por separado
   - Pega la connection string completa en el campo "Connection"
   - Deja los otros campos vacíos o con valores por defecto

### Solución 5: Verificar SSL/TLS

Si tienes problemas con SSL:

1. **Opción A: Ignorar SSL (Temporal para pruebas)**:
   - Activa "Ignore SSL Issues (Insecure)" ✅ (ya lo tienes activado)

2. **Opción B: Configurar SSL correctamente**:
   - Desactiva "Ignore SSL Issues"
   - Selecciona "Allow" en SSL
   - Verifica que el certificado de Supabase sea válido

### Solución 6: Probar Conexión desde Terminal

Para diagnosticar el problema, prueba conectarte desde terminal:

```bash
# Instala psql si no lo tienes
# macOS: brew install postgresql
# Linux: sudo apt-get install postgresql-client

# Prueba conexión directa
psql "postgresql://postgres:[TU-PASSWORD]@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres?sslmode=require"

# O con el formato pooler
psql "postgresql://postgres.vqhaoerphnyahnbemmdd:[TU-PASSWORD]@db.vqhaoerphnyahnbemmdd.supabase.co:5432/postgres?sslmode=require"
```

Si esto funciona, el problema está en la configuración de n8n. Si no funciona, el problema está en Supabase o la contraseña.

## 🔍 Verificar el Error Específico

En n8n, cuando pruebes la conexión, revisa el mensaje de error exacto:

- **"password authentication failed"** → Contraseña incorrecta
- **"connection refused"** → IP bloqueada o puerto incorrecto
- **"SSL connection required"** → Problema con SSL
- **"timeout"** → IP bloqueada o firewall
- **"database does not exist"** → Nombre de base de datos incorrecto

## 📋 Checklist de Verificación

Antes de probar de nuevo, verifica:

- [ ] Contraseña copiada correctamente (sin espacios extra)
- [ ] Usuario correcto (`postgres` o `postgres.vqhaoerphnyahnbemmdd`)
- [ ] Host correcto (`db.vqhaoerphnyahnbemmdd.supabase.co`)
- [ ] Puerto correcto (`5432`)
- [ ] Base de datos correcta (`postgres`)
- [ ] IP de n8n permitida en Supabase
- [ ] SSL configurado (Allow o Ignore)

## 🆘 Si Nada Funciona

1. **Crea una nueva credencial desde cero**:
   - Elimina la credencial actual
   - Crea una nueva con el nombre "Supabase Postgres"
   - Configura todos los campos de nuevo

2. **Verifica el proyecto de Supabase**:
   - Asegúrate de que el proyecto esté activo
   - Verifica que no esté pausado
   - Revisa los logs en Supabase Dashboard

3. **Contacta soporte**:
   - Si el problema persiste, puede ser un problema del lado de Supabase
   - Revisa el estado de Supabase: https://status.supabase.com

## 💡 Configuración Recomendada Final

Para tu proyecto específico (`vqhaoerphnyahnbemmdd`), usa esta configuración:

```
Connection: db.vqhaoerphnyahnbemmdd.supabase.co
Database: postgres
User: postgres.vqhaoerphnyahnbemmdd
Password: [tu-contraseña-de-supabase]
Port: 5432
Maximum Connections: 100
Ignore SSL Issues: ✅ Activado (para pruebas)
```

O si prefieres conexión directa:

```
Connection: db.vqhaoerphnyahnbemmdd.supabase.co
Database: postgres
User: postgres
Password: [tu-contraseña-de-supabase]
Port: 5432
Maximum Connections: 100
SSL: Allow
```

---

**¿Qué error específico ves en n8n?** Comparte el mensaje de error exacto para ayudarte mejor.
