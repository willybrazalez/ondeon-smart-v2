# 📋 Instrucciones de Actualización - Workflow Indicativos Automáticos

## 🔄 Cambios Realizados

Este workflow ha sido actualizado desde una versión anterior para funcionar con el proyecto actual de Supabase. Los principales cambios incluyen:

### ✅ Mejoras Implementadas

1. **Credenciales con Placeholders**: Se eliminaron los IDs hardcodeados de credenciales y se reemplazaron con placeholders que debes configurar
2. **Compatibilidad con Estructura Actual**: Las queries SQL han sido ajustadas para funcionar con la estructura de tablas actual:
   - Usa `tipo_contenido` en lugar de `tipo`
   - Usa `created_by` (auth_user_id) directamente
   - Compatible con `programacion_destinatarios`
3. **Variables de Entorno**: Soporte para variables de entorno en n8n:
   - `ELEVENLABS_VOICE_ID` (opcional, tiene valor por defecto)
   - `LAMBDA_FFMPEG_URL` (opcional, tiene valor por defecto)
4. **Manejo Mejorado de Eventos**: El nodo "Extraer Datos" ahora maneja tanto `registro_completado` como `cambio_establecimiento`

---

## 🚀 Paso 1: Importar el Workflow

1. Abre tu instancia de n8n
2. Ve a **Workflows** → **Import from File**
3. Selecciona el archivo `indicativos-workflow-actualizado.json`
4. El workflow se importará con todos los nodos

---

## 🔐 Paso 2: Configurar Credenciales

### A. Credencial de Supabase Postgres

1. Ve a **Credentials** → **Add Credential** → **Postgres**
2. **Obtén los datos de conexión desde Supabase Dashboard**:
   - Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
   - Ve a **Settings** → **Database**
   - En la sección **Connection string**, selecciona **URI** o **Session mode**
   - Copia la información de conexión

3. Configura con los datos de tu proyecto Supabase. **IMPORTANTE**: Hay dos formas de conectarse:

   **Opción 1: Conexión Directa (Recomendada para n8n)**
   ```
   Host: db.[TU-PROJECT-REF].supabase.co
   Database: postgres
   User: postgres
   Password: [tu-contraseña-de-supabase]
   Port: 5432
   SSL: Allow (o "Ignore SSL Issues" si tienes problemas)
   ```

   **Opción 2: Connection Pooler (Si la directa no funciona)**
   ```
   Host: db.[TU-PROJECT-REF].supabase.co
   Database: postgres
   User: postgres.[TU-PROJECT-REF]
   Password: [tu-contraseña-de-supabase]
   Port: 5432
   SSL: Allow
   ```

   **⚠️ NOTA**: Reemplaza `[TU-PROJECT-REF]` con el ID de tu proyecto (ej: `vqhaoerphnyahnbemmdd`)

4. Guarda como **"Supabase Postgres"**
5. **IMPORTANTE**: Copia el ID de la credencial (aparece en la URL o en los detalles)

### 🔍 Solución de Problemas de Conexión

Si tienes errores de conexión, verifica:

1. **Contraseña Correcta**: 
   - Ve a Supabase Dashboard → Settings → Database
   - Si no recuerdas la contraseña, puedes resetearla (esto reiniciará la base de datos)

2. **Formato del Usuario**:
   - Para conexión directa: `postgres`
   - Para pooler: `postgres.[PROJECT-REF]`
   - En tu caso actual: `postgres.vqhaoerphnyahnbemmdd` (pooler)

3. **Permitir IP de n8n**:
   - Ve a Supabase Dashboard → Settings → Database
   - En **Connection Pooling** o **Network Restrictions**
   - Agrega la IP de tu servidor n8n (o permite todas las IPs temporalmente para probar)

4. **SSL**:
   - Si tienes problemas con SSL, activa "Ignore SSL Issues (Insecure)" temporalmente
   - Para producción, configura SSL correctamente

### B. Credencial de ElevenLabs API

1. Ve a **Credentials** → **Add Credential** → **Header Auth**
2. Configura:
   - **Name**: `xi-api-key`
   - **Value**: `[tu-api-key-de-elevenlabs]`
3. Guarda como **"ElevenLabs API"**
4. **IMPORTANTE**: Copia el ID de la credencial

---

## 🔧 Paso 3: Actualizar IDs de Credenciales en el Workflow

Debes reemplazar los placeholders en el workflow con los IDs reales de tus credenciales:

### 3.1 Actualizar Credencial de Postgres

1. Abre cada nodo que use Postgres:
   - **Borrar Indicativos Antiguos**
   - **Guardar en Contenidos**
   - **Crear Programación**
2. En cada uno, haz clic en **Credentials** → **Select Credential**
3. Selecciona **"Supabase Postgres"**
4. O manualmente, edita el JSON del workflow y reemplaza:
   ```json
   "id": "SUPABASE_POSTGRES_CREDENTIAL_ID"
   ```
   Por el ID real de tu credencial (ej: `"I1wsGQdEYLn2pjZi"`)

### 3.2 Actualizar Credencial de ElevenLabs

1. Abre el nodo **ElevenLabs TTS**
2. Haz clic en **Credentials** → **Select Credential**
3. Selecciona **"ElevenLabs API"**
4. O manualmente, edita el JSON del workflow y reemplaza:
   ```json
   "id": "ELEVENLABS_CREDENTIAL_ID"
   ```
   Por el ID real de tu credencial

---

## 🌍 Paso 4: Configurar Variables de Entorno (Opcional)

Si quieres usar variables de entorno en lugar de valores hardcodeados:

1. Ve a **Settings** → **Environment Variables** en n8n
2. Agrega estas variables (opcionales, tienen valores por defecto):

```bash
# Voice ID de ElevenLabs (opcional, por defecto: fRDnLmEYnsOOldlrmhg5)
ELEVENLABS_VOICE_ID=fRDnLmEYnsOOldlrmhg5

# URL de Lambda FFmpeg (opcional, tiene valor por defecto)
LAMBDA_FFMPEG_URL=https://chskbn3tnfgmcnntxmjmswz6740kjlrx.lambda-url.eu-north-1.on.aws/
```

**Nota**: Si no configuras estas variables, el workflow usará los valores por defecto.

---

## 🔗 Paso 5: Activar el Workflow y Obtener URL del Webhook

1. Activa el workflow haciendo clic en el toggle en la esquina superior derecha
2. Haz clic en el nodo **Webhook Trigger**
3. Copia la **Production URL** (ej: `https://tu-n8n.com/webhook/indicativos`)

---

## 🗄️ Paso 6: Configurar Webhook en Supabase

Ejecuta este comando SQL en Supabase para configurar la URL del webhook:

```sql
ALTER DATABASE postgres 
SET app.n8n_indicativos_webhook_url = 'https://tu-n8n.com/webhook/indicativos';
```

**Reemplaza** `https://tu-n8n.com/webhook/indicativos` con la URL real de tu webhook de n8n.

---

## ✅ Paso 7: Verificar la Configuración

### Verificar Triggers en Supabase

Ejecuta esta query para verificar que los triggers están activos:

```sql
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_indicativos%';
```

Debes ver 2 triggers:
- `trigger_indicativos_registro`
- `trigger_indicativos_cambio_nombre`

### Verificar Tabla de Tracking

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'indicativos_generados'
ORDER BY ordinal_position;
```

---

## 🧪 Paso 8: Probar el Workflow

### Test Manual

Envía un POST al webhook de n8n:

```bash
curl -X POST "https://tu-n8n.com/webhook/indicativos" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "registro_completado",
    "usuario_id": "uuid-del-usuario-de-prueba",
    "auth_user_id": "uuid-auth-del-usuario",
    "establecimiento": "Café Ejemplo",
    "email": "test@example.com"
  }'
```

### Verificar Resultados

1. **En n8n**: Ve a **Executions** para ver el historial de ejecuciones
2. **En Supabase**: Ejecuta estas queries:

```sql
-- Ver indicativos generados
SELECT 
  ig.establecimiento_nombre,
  ig.estado,
  ig.generado_en,
  array_length(ig.contenido_ids, 1) as num_indicativos
FROM indicativos_generados ig
ORDER BY ig.generado_en DESC
LIMIT 5;

-- Ver contenidos creados
SELECT 
  nombre,
  tipo_contenido,
  url_s3,
  duracion_segundos,
  created_at
FROM contenidos
WHERE tipo_contenido = 'indicativo'
ORDER BY created_at DESC
LIMIT 5;

-- Ver programaciones creadas
SELECT 
  descripcion,
  tipo,
  frecuencia_minutos,
  estado,
  created_at
FROM programaciones
WHERE descripcion LIKE 'Indicativos Automáticos%'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🔍 Troubleshooting

### Error: "Postgres connection failed"
- ✅ **Ver guía detallada**: Consulta `SOLUCION-ERROR-CREDENCIALES.md` para solución paso a paso
- ✅ Verifica que las credenciales de Supabase sean correctas
- ✅ Verifica que la IP de n8n esté permitida en Supabase (Settings → Database → Network Restrictions)
- ✅ Prueba con conexión directa (`User: postgres`) en lugar de pooler (`User: postgres.[PROJECT-REF]`)
- ✅ Verifica la contraseña en Supabase Dashboard → Settings → Database

### Error: "ElevenLabs API error"
- ✅ Verifica que la API key de ElevenLabs sea válida
- ✅ Verifica que tengas créditos disponibles en ElevenLabs

### Error: "Lambda timeout"
- ✅ Verifica que la URL de Lambda sea correcta
- ✅ Verifica que los archivos de música de fondo existan en S3 en la ruta `indicativos/musica/fondo-1.mp3`, `fondo-2.mp3`, `fondo-3.mp3`

### Los indicativos no se programan
- ✅ Verifica que la tabla `programaciones` exista
- ✅ Verifica que la tabla `programacion_destinatarios` exista
- ✅ Verifica permisos del usuario de Postgres

### El webhook no se dispara desde Supabase
- ✅ Verifica que los triggers estén activos (ver Paso 7)
- ✅ Verifica que la URL del webhook esté configurada correctamente en Supabase
- ✅ Verifica los logs de Supabase para ver si hay errores en `notify_n8n_indicativos()`

---

## 📊 Estructura del Flujo

```
Webhook → Responder OK → Extraer Datos → Borrar Antiguos → Crear Textos
                                                                    ↓
                                                          ElevenLabs TTS
                                                                    ↓
                                                          Combinar Datos
                                                                    ↓
                                                          Lambda FFmpeg Mixer
                                                                    ↓
                                                          Preservar Datos Lambda
                                                                    ↓
                                                          Guardar en Contenidos
                                                                    ↓
                                                          Agrupar para Programación
                                                                    ↓
                                                          Crear Programación
```

---

## 💰 Costos Estimados

| Servicio | Costo por Usuario |
|----------|-------------------|
| ElevenLabs (3 audios ~5s) | ~$0.05 |
| Lambda FFmpeg | ~$0.001 |
| S3 Storage | ~$0.0001/mes |
| **Total** | **~$0.05** |

---

## 📝 Notas Importantes

1. **Credenciales**: Los IDs de credenciales son específicos de cada instancia de n8n. Debes configurarlos manualmente después de importar el workflow.

2. **Variables de Entorno**: Son opcionales. Si no las configuras, el workflow usará valores por defecto.

3. **Voice ID de ElevenLabs**: El valor por defecto es `fRDnLmEYnsOOldlrmhg5`. Puedes cambiarlo en el nodo ElevenLabs TTS o usando la variable de entorno.

4. **Música de Fondo**: El workflow espera que existan 3 archivos de música en S3:
   - `indicativos/musica/fondo-1.mp3`
   - `indicativos/musica/fondo-2.mp3`
   - `indicativos/musica/fondo-3.mp3`

5. **Programación**: Los indicativos se programan para reproducirse cada 30 minutos automáticamente.

---

## 🔄 Actualizaciones Futuras

Si necesitas modificar:
- **Textos de los indicativos**: Edita el nodo "Crear Textos"
- **Voz de ElevenLabs**: Cambia el Voice ID en el nodo "ElevenLabs TTS" o usa la variable de entorno
- **Frecuencia de reproducción**: Modifica `frecuencia_minutos` en el nodo "Crear Programación"
- **Volumen de música**: Modifica `musicVolume` en el nodo "Lambda FFmpeg Mixer"

---

¡Listo! El workflow está actualizado y listo para usar. 🎉
