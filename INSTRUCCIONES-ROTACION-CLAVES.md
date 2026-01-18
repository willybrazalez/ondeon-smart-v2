# Instrucciones para Rotación de Claves

Este documento contiene los pasos exactos para rotar las claves comprometidas.

---

## 1. AWS Credentials (CRÍTICO - Hacer primero)

Las credenciales AWS fueron expuestas en documentación. Deben rotarse inmediatamente.

### Paso 1: Crear nueva Access Key en AWS IAM

1. Ve a: https://console.aws.amazon.com/iam/
2. En el menú lateral: **Users**
3. Busca y selecciona el usuario que usa Lambda (probablemente `ondeon-lambda` o similar)
4. Tab: **Security credentials**
5. Sección: **Access keys**
6. Click: **Create access key**
7. Selecciona: **Application running outside AWS** → Next
8. **IMPORTANTE**: Copia y guarda las nuevas credenciales:
   - Access key ID: `AKIA...`
   - Secret access key: `...`

### Paso 2: Actualizar en AWS Lambda

1. Ve a: https://console.aws.amazon.com/lambda/
2. Encuentra las funciones Lambda de Ondeon (busca `ondeon` o `ffmpeg`)
3. Para cada función:
   - Tab: **Configuration** → **Environment variables**
   - Edit y actualiza:
     - `ONDEON_AWS_ACCESS_KEY_ID` → nueva Access Key
     - `ONDEON_AWS_SECRET_ACCESS_KEY` → nuevo Secret
   - Click: **Save**

### Paso 3: Desactivar clave antigua

1. Vuelve a IAM → Users → Security credentials
2. Busca la Access Key antigua: `AKIA2UXNIRK2SKA2APEW`
3. Click: **Actions** → **Deactivate**
4. Espera 24-48h y verifica que todo funciona
5. Luego: **Actions** → **Delete**

### Verificación
```bash
# Probar que la app puede subir archivos
# (crear un anuncio de prueba en la app)
```

---

## 2. OpenAI API Key

### Paso 1: Revocar clave antigua

1. Ve a: https://platform.openai.com/api-keys
2. Busca la clave comprometida
3. Click: **Revoke** (o el icono de basura)

### Paso 2: Crear nueva clave

1. Click: **Create new secret key**
2. Nombre: `ondeon-production`
3. **COPIA LA CLAVE** (solo se muestra una vez)

### Paso 3: Actualizar en Supabase

```bash
# Desde la carpeta del proyecto
supabase secrets set OPENAI_API_KEY=sk-proj-NUEVA_CLAVE_AQUI
```

O via Dashboard:
1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. **Edge Functions** → **Manage secrets**
4. Busca `OPENAI_API_KEY` → Edit → Pega nueva clave

### Verificación
```bash
# Invocar la Edge Function
supabase functions invoke generate-ad --body '{"mode":"text","idea":"Prueba","empresaNombre":"Test"}'
```

---

## 3. ElevenLabs API Key

### Paso 1: Regenerar clave

1. Ve a: https://elevenlabs.io/app/settings/api-keys
2. Click: **Regenerate** en la clave actual
3. **COPIA LA NUEVA CLAVE**

### Paso 2: Actualizar en Supabase

```bash
supabase secrets set ELEVENLABS_API_KEY=sk_NUEVA_CLAVE_AQUI
```

### Verificación
```bash
# Probar listado de voces
supabase functions invoke generate-ad --body '{"mode":"list-voices"}'
```

---

## 4. Google Maps API Key

### Paso 1: Configurar restricciones (NO es necesario regenerar)

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Selecciona tu API Key
3. **Application restrictions**:
   - Selecciona: **HTTP referrers (websites)**
   - Añade estos patrones:
     ```
     https://*.ondeon.es/*
     https://ondeon.es/*
     http://localhost:*/*
     http://127.0.0.1:*/*
     ```
4. **API restrictions**:
   - Selecciona: **Restrict key**
   - Marca solo: **Maps JavaScript API**
5. Click: **Save**

### Paso 2 (Opcional): Si quieres regenerar la clave

1. Click: **Regenerate key**
2. Actualiza en `.env`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=AIzaNUEVA_CLAVE
   ```
3. Rebuild: `npm run build`

---

## Verificación Final

Después de rotar todas las claves, verifica que todo funciona:

### 1. App funciona normalmente
```bash
npm run dev
# Abrir http://localhost:5173
# Login y probar reproducción
```

### 2. Generación de anuncios funciona
- Crear un anuncio de prueba en la app
- Verificar que se genera el texto (OpenAI)
- Verificar que se genera el audio (ElevenLabs)
- Verificar que se sube a S3 (Lambda/AWS)

### 3. Edge Functions responden
```bash
supabase functions invoke generate-ad --body '{"mode":"list-voices"}'
# Debe retornar lista de voces de ElevenLabs
```

---

## Resumen de Claves Rotadas

| Servicio | Acción | Estado |
|----------|--------|--------|
| AWS | Rotar Access Key en IAM | ⬜ Pendiente |
| AWS | Actualizar en Lambda | ⬜ Pendiente |
| AWS | Desactivar clave antigua | ⬜ Pendiente |
| OpenAI | Revocar y crear nueva | ⬜ Pendiente |
| OpenAI | Actualizar en Supabase Secrets | ⬜ Pendiente |
| ElevenLabs | Regenerar clave | ⬜ Pendiente |
| ElevenLabs | Actualizar en Supabase Secrets | ⬜ Pendiente |
| Google Maps | Configurar restricciones | ⬜ Pendiente |

Marca cada paso como completado (✅) a medida que lo hagas.
