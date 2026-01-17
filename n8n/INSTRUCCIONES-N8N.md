# Configuración del Workflow n8n - Indicativos Automáticos

## Resumen

Este workflow genera automáticamente 3 indicativos de audio personalizados cuando un usuario se registra o cambia el nombre de su establecimiento.

## Flujo del Workflow

```
Webhook → Responder OK → Borrar Antiguos → Preparar Textos → Loop x3
                                                               ↓
                                              ElevenLabs TTS ←─┘
                                                    ↓
                                           Lambda FFmpeg Mixer
                                                    ↓
                                          Guardar en Contenidos
                                                    ↓
                                             ¿Es el último?
                                              ↓         ↓
                                    [Sí] Crear    [No] Continuar
                                    Programación      Loop
```

## Paso 1: Importar el Workflow

1. Abrir n8n
2. Ir a **Workflows** → **Import from File**
3. Seleccionar `indicativos-workflow.json`
4. El workflow se importará con todos los nodos

## Paso 2: Configurar Credenciales

### A. Supabase Postgres

1. Ir a **Credentials** → **Add Credential** → **Postgres**
2. Configurar:
   - **Host**: `db.nazlyvhndymalevkfpnl.supabase.co`
   - **Database**: `postgres`
   - **User**: `postgres`
   - **Password**: (contraseña de la BD)
   - **Port**: `5432`
   - **SSL**: `Allow`
3. Guardar como "Supabase Postgres"
4. Copiar el ID de la credencial

### B. ElevenLabs API

1. Ir a **Credentials** → **Add Credential** → **Header Auth**
2. Configurar:
   - **Name**: `xi-api-key`
   - **Value**: `tu-api-key-de-elevenlabs`
3. Guardar como "ElevenLabs API"
4. Copiar el ID de la credencial

### C. Variables de Entorno

En n8n, configurar las siguientes variables de entorno:

```bash
# En docker-compose o configuración de n8n
N8N_CUSTOM_EXTENSIONS=
LAMBDA_FFMPEG_URL=https://tu-lambda-ffmpeg.lambda-url.eu-north-1.on.aws/
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # ID de voz en español
```

## Paso 3: Actualizar IDs de Credenciales

Editar el workflow y reemplazar los placeholders:

1. Abrir cada nodo de Postgres y seleccionar la credencial "Supabase Postgres"
2. Abrir el nodo "ElevenLabs TTS" y seleccionar la credencial "ElevenLabs API"

## Paso 4: Configurar el Webhook

1. Activar el workflow
2. Copiar la URL del webhook (ej: `https://tu-n8n.com/webhook/indicativos`)
3. Configurar esta URL en Supabase:

```sql
ALTER DATABASE postgres SET app.n8n_indicativos_webhook_url = 'https://tu-n8n.com/webhook/indicativos';
```

## Paso 5: Probar el Workflow

### Test Manual

Enviar un POST al webhook:

```bash
curl -X POST "https://tu-n8n.com/webhook/indicativos" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "registro_completado",
    "usuario_id": "uuid-del-usuario",
    "auth_user_id": "uuid-auth",
    "establecimiento": "Café Ejemplo",
    "email": "test@example.com"
  }'
```

### Verificar Resultados

1. Revisar la ejecución en n8n
2. Verificar en Supabase:
   - Tabla `contenidos`: 3 nuevos registros tipo 'indicativo'
   - Tabla `programaciones`: 1 nueva programación
   - Tabla `indicativos_generados`: 1 registro de tracking

## Configuración de Voces ElevenLabs

### Voces Recomendadas en Español

| Voice ID | Nombre | Estilo |
|----------|--------|--------|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Femenina, profesional |
| `AZnzlk1XvdvUeBnXmlld` | Domi | Masculina, clara |
| `EXAVITQu4vr4xnSDxMaL` | Bella | Femenina, cálida |

Para cambiar la voz, modificar el nodo "ElevenLabs TTS":
- Cambiar el Voice ID en la URL

## Textos de los Indicativos

Los textos están definidos en el nodo "Preparar Textos":

```javascript
[
  `Estás escuchando la radio de ${establecimiento}`,
  `${establecimiento}, Radio`,
  `Bienvenido a ${establecimiento}, radio`
]
```

Para modificar los textos, editar este nodo.

## Troubleshooting

### Error: "ElevenLabs API error"
- Verificar que la API key es válida
- Verificar que tienes créditos en ElevenLabs

### Error: "Lambda timeout"
- Aumentar el timeout de la Lambda a 60s
- Verificar que FFmpeg layer está correctamente configurado

### Error: "Postgres connection failed"
- Verificar credenciales de Supabase
- Verificar que la IP de n8n está en la whitelist

### Los indicativos no se programan
- Verificar que la tabla `programaciones` existe
- Verificar permisos del usuario de Postgres

## Monitoreo

### Ver Ejecuciones

En n8n, ir a **Executions** para ver el historial de ejecuciones.

### Ver Indicativos Generados

```sql
SELECT 
  ig.establecimiento_nombre,
  ig.estado,
  ig.generado_en,
  array_length(ig.contenido_ids, 1) as num_indicativos
FROM indicativos_generados ig
ORDER BY ig.generado_en DESC;
```

## Costos Estimados

| Servicio | Costo por Usuario |
|----------|-------------------|
| ElevenLabs (3 audios ~5s) | ~$0.05 |
| Lambda FFmpeg | ~$0.001 |
| S3 Storage | ~$0.0001/mes |
| **Total** | **~$0.05** |

## Mantenimiento

### Actualizar Textos
1. Editar nodo "Preparar Textos"
2. Guardar workflow
3. Los nuevos usuarios tendrán los textos actualizados

### Cambiar Voz
1. Obtener nuevo Voice ID de ElevenLabs
2. Editar nodo "ElevenLabs TTS"
3. Cambiar el Voice ID en la URL

### Agregar Más Indicativos
1. Modificar array de textos en "Preparar Textos"
2. Ajustar condición en "Es el Ultimo?" 
3. Actualizar query de "Crear Programación"
