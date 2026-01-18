# Guía de Migración a Nuevo Proyecto Supabase

> Instrucciones paso a paso para migrar Ondeon Smart a un nuevo proyecto de Supabase

---

## Paso 1: Crear Nuevo Proyecto en Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click en **New Project**
3. Configura:
   - **Organization**: Tu organización
   - **Name**: `ondeon-smart-v2` (o el nombre que prefieras)
   - **Database Password**: Genera una contraseña segura y guárdala
   - **Region**: `eu-west-1` (Frankfurt) o la más cercana
   - **Pricing Plan**: Free o Pro según necesidad
4. Click **Create new project**
5. Espera 2-3 minutos mientras se crea

---

## Paso 2: Obtener Credenciales

Una vez creado el proyecto:

1. Ve a **Settings** → **API**
2. Copia y guarda:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...`
   - **service_role key**: `eyJhbGc...` (⚠️ NUNCA exponer en cliente)

---

## Paso 3: Ejecutar Scripts SQL

### Opción A: Script Consolidado (Recomendado)

1. Ve a **SQL Editor** en el dashboard de Supabase
2. Click **New Query**
3. Ejecuta los scripts en este orden:

```sql
-- Primero: Tablas base (usuarios, empresas, etc.)
-- Estas tablas ya deben existir si importaste el schema

-- Luego: Sistema de presencia
-- Copiar contenido de: database/001_create_presence_system.sql

-- Después: Sistema de anuncios IA
-- Copiar contenido de: database/014_create_ai_ads_system.sql

-- Luego: Sistema de facturación IA
-- Copiar contenido de: database/020_ai_ads_billing_system.sql

-- Después: Suscripciones
-- Copiar contenido de: database/021_suscripciones_gestores.sql

-- Finalmente: Índices de optimización
-- Copiar contenido de: database/OPTIMIZACION-INDICES-DEFINITIVO.sql
```

### Opción B: Script por Script

Ejecutar cada archivo de `database/` en orden numérico:
- 001, 002, 003... hasta 026
- Luego `OPTIMIZACION-INDICES-DEFINITIVO.sql`

---

## Paso 4: Habilitar Realtime

1. Ve a **Database** → **Replication**
2. Habilita Realtime para estas tablas:
   - `user_current_state`
   - `programaciones`
   - `programacion_destinatarios`
   - `playlists`
   - `playlist_canciones`
   - `canales`
   - `contenido_asignaciones`

O via SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE user_current_state;
ALTER PUBLICATION supabase_realtime ADD TABLE programaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE programacion_destinatarios;
ALTER PUBLICATION supabase_realtime ADD TABLE playlists;
ALTER PUBLICATION supabase_realtime ADD TABLE playlist_canciones;
```

---

## Paso 5: Desplegar Edge Functions

### 5.1 Instalar Supabase CLI

```bash
npm install -g supabase
```

### 5.2 Vincular proyecto

```bash
cd /ruta/a/ondeon-smart-v2
supabase login
supabase link --project-ref TU_PROJECT_REF
```

El `project-ref` lo encuentras en **Settings** → **General** → **Reference ID**

### 5.3 Desplegar funciones

```bash
# Desplegar todas las Edge Functions
supabase functions deploy login
supabase functions deploy change-password
supabase functions deploy generate-ad
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook
supabase functions deploy send-email
supabase functions deploy cleanup-pendientes
```

---

## Paso 6: Configurar Secrets

### 6.1 Via CLI (Recomendado)

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-TU_CLAVE
supabase secrets set ELEVENLABS_API_KEY=sk_TU_CLAVE
supabase secrets set ONDEON_LAMBDA_S3_URL=https://TU_LAMBDA_URL
supabase secrets set STRIPE_SECRET_KEY=sk_live_TU_CLAVE
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TU_CLAVE
```

### 6.2 Via Dashboard

1. Ve a **Edge Functions** → **Manage secrets**
2. Añade cada secret:

| Secret | Descripción |
|--------|-------------|
| `OPENAI_API_KEY` | Clave de OpenAI para GPT-4 |
| `ELEVENLABS_API_KEY` | Clave de ElevenLabs para TTS |
| `ONDEON_LAMBDA_S3_URL` | URL de Lambda para mixer de audio |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |

---

## Paso 7: Configurar Webhook de Stripe

1. Ve a [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. URL: `https://TU_PROYECTO.supabase.co/functions/v1/stripe-webhook`
4. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copia el **Signing secret** y configúralo como `STRIPE_WEBHOOK_SECRET`

---

## Paso 8: Actualizar Variables de Entorno

Actualiza el archivo `.env` en el proyecto:

```env
# Supabase - NUEVO PROYECTO
VITE_SUPABASE_URL=https://TU_NUEVO_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ_TU_NUEVA_ANON_KEY

# CloudFront (mantener igual si no cambia)
VITE_CLOUDFRONT_DOMAIN=d2ozw1d1zbl64l.cloudfront.net

# Feature flags
VITE_ENABLE_PRESENCE=1
VITE_APP_VERSION=web-2.0.0
```

---

## Paso 9: Verificar Migración

### 9.1 Verificar tablas
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver ~30 tablas.

### 9.2 Verificar funciones RPC
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION';
```

### 9.3 Verificar Edge Functions

```bash
supabase functions list
```

### 9.4 Probar la app

```bash
npm run dev
# Abrir http://localhost:5173
# Intentar login y verificar que funciona
```

---

## Paso 10: Migrar Datos (Opcional)

Si necesitas migrar datos del proyecto anterior:

### 10.1 Exportar datos del proyecto antiguo

Via pgAdmin o pg_dump:
```bash
pg_dump -h HOST_ANTIGUO -U postgres -d postgres \
  --data-only --inserts \
  -t usuarios -t empresas -t canales \
  > datos_exportados.sql
```

### 10.2 Importar en proyecto nuevo

```bash
psql -h HOST_NUEVO -U postgres -d postgres < datos_exportados.sql
```

O via SQL Editor en Supabase.

---

## Checklist Final

- [ ] Proyecto creado en Supabase
- [ ] Credenciales guardadas (URL, anon key, service role)
- [ ] Scripts SQL ejecutados
- [ ] Realtime habilitado en tablas
- [ ] Edge Functions desplegadas
- [ ] Secrets configurados
- [ ] Webhook de Stripe configurado
- [ ] `.env` actualizado
- [ ] App probada y funcionando

---

## Troubleshooting

### Error: "relation does not exist"
Las tablas base (usuarios, empresas, etc.) deben existir antes de ejecutar los scripts de migración.

### Error: "permission denied"
Verificar que el usuario tiene permisos. Usar el SQL Editor con rol de admin.

### Edge Function no responde
1. Verificar que los secrets están configurados
2. Ver logs: `supabase functions logs NOMBRE_FUNCION`

### Realtime no funciona
1. Verificar que la tabla está en la publicación
2. Verificar políticas RLS permiten SELECT

---

## Soporte

Si encuentras problemas:
1. Revisa los logs en Supabase Dashboard → Logs
2. Verifica la configuración de RLS
3. Comprueba que todos los secrets están configurados
