---
name: Indicativos Automáticos Flow
overview: Implementar el flujo completo para que cuando un usuario se registre o cambie el nombre de su establecimiento, se generen automáticamente 3 indicativos de audio personalizados con TTS + musica de fondo, se guarden en S3 y se programen en la BD para reproducirse cada 30 minutos.
todos:
  - id: lambda-base64
    content: Modificar Lambda para aceptar ttsBase64 ademas de ttsUrl
    status: pending
  - id: sql-migrations
    content: Ejecutar migraciones SQL en Supabase (columna + triggers + pg_net)
    status: pending
  - id: n8n-import
    content: Importar workflow en n8n y configurar credenciales
    status: pending
  - id: n8n-workflow-update
    content: Actualizar nodo ElevenLabs para enviar base64 a Lambda
    status: pending
  - id: connect-webhook
    content: Configurar URL webhook n8n en Supabase
    status: pending
  - id: test-flow
    content: Probar flujo completo con usuario de prueba
    status: pending
---

# Flujo Completo de Indicativos Automaticos

## Arquitectura del Sistema

```mermaid
sequenceDiagram
    participant User as Usuario
    participant Supabase as Supabase DB
    participant n8n as n8n Workflow
    participant ElevenLabs as ElevenLabs TTS
    participant Lambda as Lambda FFmpeg
    participant S3 as S3/CloudFront

    User->>Supabase: Registro completo / Cambia nombre
    Supabase->>n8n: Webhook (pg_net)
    n8n->>Supabase: Borrar indicativos antiguos
    loop 3 indicativos
        n8n->>ElevenLabs: Generar TTS
        ElevenLabs-->>n8n: Audio MP3
        n8n->>Lambda: Mezclar con musica
        Lambda->>S3: Guardar resultado
        Lambda-->>n8n: URL del audio
        n8n->>Supabase: Guardar en contenidos
    end
    n8n->>Supabase: Crear programacion (cada 30 min)
```

## Pasos de Implementacion

### 1. Modificar Lambda para aceptar audio Base64

El workflow de n8n recibe el audio TTS de ElevenLabs como binario. La Lambda actual solo acepta URLs. Hay que modificarla para aceptar tambien `ttsBase64`.

**Archivo:** [lambda/ffmpeg-audio-mixer/index.mjs](lambda/ffmpeg-audio-mixer/index.mjs)

**Cambios:**

- Aceptar parametro `ttsBase64` como alternativa a `ttsUrl`
- Si viene base64, guardarlo en `/tmp` directamente
- Mantener compatibilidad con `ttsUrl`

### 2. Ejecutar Migraciones SQL en Supabase

**Archivo 1:** [database/add-ultimo-cambio-establecimiento.sql](database/add-ultimo-cambio-establecimiento.sql)

- Agrega columna `ultimo_cambio_establecimiento` a tabla `usuarios`
- Crea trigger que limita cambios de nombre a 1 vez por mes
- Crea funcion RPC `puede_cambiar_establecimiento()` para el frontend

**Archivo 2:** [database/indicativos-webhook-setup.sql](database/indicativos-webhook-setup.sql)

- Crea tabla `indicativos_generados` para tracking
- Habilita extension `pg_net`
- Crea funcion `notify_n8n_indicativos()` que envia webhook
- Crea triggers en tabla `usuarios`:
  - `trigger_indicativos_registro` (cuando `registro_completo = true`)
  - `trigger_indicativos_cambio_nombre` (cuando cambia `establecimiento`)

### 3. Configurar n8n

**Archivo workflow:** [n8n/indicativos-workflow.json](n8n/indicativos-workflow.json)

Pasos:

1. Importar el workflow JSON en n8n
2. Crear credencial **Postgres** con datos de Supabase
3. Crear credencial **Header Auth** para ElevenLabs (`xi-api-key`)
4. Configurar variable de entorno `LAMBDA_FFMPEG_URL`
5. Actualizar el nodo ElevenLabs TTS para enviar base64 a la Lambda
6. Activar workflow y copiar URL del webhook

### 4. Conectar Supabase con n8n

Configurar la URL del webhook en Supabase:

```sql
ALTER DATABASE postgres 
SET app.n8n_indicativos_webhook_url = 'https://tu-n8n.com/webhook/indicativos';
```

### 5. Probar el flujo completo

1. Test manual enviando POST al webhook de n8n
2. Verificar que se crean los 3 indicativos en S3
3. Verificar registros en tablas `contenidos`, `programaciones`, `indicativos_generados`
4. Test real: crear usuario de prueba y completar registro

## Credenciales Necesarias

- **API Key ElevenLabs** con permisos TTS (la actual no tiene permisos)
- **Conexion Postgres** de Supabase (host, user, password)
- **URL Lambda FFmpeg:** `https://chskbn3tnfgmcnntxmjmswz6740kjlrx.lambda-url.eu-north-1.on.aws/`

## Resultado Final

Cuando un gestor complete su registro:

- Se generan 3 indicativos:

  1. "Estas escuchando la radio de {establecimiento}"
  2. "{establecimiento}, Radio"
  3. "Bienvenido a {establecimiento}, radio"

- Cada uno dura 10 segundos con fade out
- Se programan para reproducirse cada 30 minutos
- Si cambia el nombre (max 1 vez/mes), se regeneran automaticamente