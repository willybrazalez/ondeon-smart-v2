# Testing E2E - Sistema de Indicativos Automáticos

## Checklist de Despliegue

Antes de testear, verificar que todo está desplegado:

- [ ] **Lambda FFmpeg** desplegada en AWS
- [ ] **Música de fondo** subida a S3 (`indicativos/musica/fondo-1.mp3`, etc.)
- [ ] **Migraciones SQL** ejecutadas en Supabase
- [ ] **Workflow n8n** importado y activado
- [ ] **Credenciales n8n** configuradas (Supabase, ElevenLabs)
- [ ] **URL del webhook** configurada en Supabase

## Test 1: Lambda FFmpeg

### Verificar que la Lambda funciona

```bash
# Primero subir un audio de prueba a S3
# Luego probar la Lambda

curl -X POST "https://tu-lambda-ffmpeg.lambda-url.eu-north-1.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{
    "ttsUrl": "https://d2ozw1d1zbl64l.cloudfront.net/test/sample-tts.mp3",
    "backgroundMusicKey": "indicativos/musica/fondo-1.mp3",
    "outputKey": "indicativos/test/test-output.mp3",
    "ttsVolume": 1.0,
    "musicVolume": 0.15
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "outputUrl": "https://d2ozw1d1zbl64l.cloudfront.net/indicativos/test/test-output.mp3",
  "outputKey": "indicativos/test/test-output.mp3",
  "duration": 5.5
}
```

### Verificar el audio resultante
- Descargar el audio de la URL
- Verificar que tiene TTS + música de fondo
- Verificar que el volumen de la música está reducido

## Test 2: Database Webhooks

### Verificar triggers en Supabase

```sql
-- Ver triggers creados
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE 'trigger_indicativos%';

-- Debe mostrar:
-- trigger_indicativos_registro | INSERT | AFTER
-- trigger_indicativos_registro | UPDATE | AFTER
-- trigger_indicativos_cambio_nombre | UPDATE | AFTER
```

### Verificar función de validación

```sql
-- Probar la función puede_cambiar_establecimiento
SELECT puede_cambiar_establecimiento('uuid-de-un-usuario-existente');
```

## Test 3: Workflow n8n Manual

### Enviar webhook de prueba

```bash
curl -X POST "https://tu-n8n.com/webhook/indicativos" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "registro_completado",
    "usuario_id": "UUID_USUARIO_TEST",
    "auth_user_id": "UUID_AUTH_TEST",
    "establecimiento": "Bar de Pruebas",
    "email": "test@ondeon.es",
    "timestamp": "2026-01-13T20:00:00Z"
  }'
```

### Verificar en n8n
1. Ir a **Executions**
2. Ver que la ejecución completó sin errores
3. Revisar cada paso del workflow

### Verificar en Supabase

```sql
-- Ver contenidos creados
SELECT id, nombre, tipo_contenido, url_s3, duracion_segundos, created_at
FROM contenidos
WHERE tipo_contenido = 'indicativo'
ORDER BY created_at DESC
LIMIT 10;

-- Ver programación creada
SELECT id, nombre, frecuencia_minutos, activo
FROM programaciones
WHERE nombre LIKE 'Indicativos%'
ORDER BY created_at DESC
LIMIT 5;

-- Ver tracking
SELECT *
FROM indicativos_generados
ORDER BY generado_en DESC
LIMIT 5;
```

## Test 4: Flujo Completo (Registro Real)

### Crear usuario de prueba

1. Ir a la página de registro
2. Completar el formulario con:
   - Email: `test-indicativos@ondeon.es`
   - Nombre establecimiento: `Restaurante Prueba E2E`
3. Completar el pago (modo test de Stripe)
4. Verificar que el usuario se creó con `registro_completo = true`

### Verificar generación automática

Esperar 30-60 segundos y verificar:

```sql
-- Ver si se generaron indicativos
SELECT 
  ig.establecimiento_nombre,
  ig.estado,
  ig.generado_en,
  array_length(ig.contenido_ids, 1) as num_indicativos,
  p.nombre as programacion_nombre
FROM indicativos_generados ig
LEFT JOIN programaciones p ON p.id = ig.programacion_id
WHERE ig.establecimiento_nombre = 'Restaurante Prueba E2E';
```

### Verificar los audios

1. Obtener las URLs de los contenidos
2. Reproducir cada uno
3. Verificar que dicen correctamente el nombre del establecimiento

## Test 5: Cambio de Nombre de Establecimiento

### Verificar restricción de 1 vez/mes

```sql
-- Intentar cambiar nombre (debería fallar si ya cambió este mes)
UPDATE usuarios 
SET establecimiento = 'Nuevo Nombre'
WHERE id = 'UUID_USUARIO_TEST';

-- Si falla, verificar el mensaje de error
```

### Verificar regeneración de indicativos

Si el cambio está permitido:
1. Cambiar el nombre del establecimiento
2. Verificar que el webhook se dispara
3. Verificar que los indicativos antiguos se borran
4. Verificar que se crean nuevos indicativos con el nuevo nombre

## Test 6: Reproducción de Indicativos

### Verificar programación activa

```sql
-- Ver programaciones activas del usuario
SELECT 
  p.id,
  p.nombre,
  p.frecuencia_minutos,
  p.activo,
  COUNT(pc.id) as num_contenidos
FROM programaciones p
LEFT JOIN programacion_contenidos pc ON pc.programacion_id = p.id
WHERE p.usuario_id = 'UUID_USUARIO_TEST'
AND p.nombre LIKE 'Indicativos%'
GROUP BY p.id;
```

### Probar en el reproductor

1. Login con el usuario de prueba
2. Iniciar reproducción de música
3. Esperar 30 minutos (o modificar frecuencia para test)
4. Verificar que se reproduce un indicativo

## Errores Comunes y Soluciones

### Error: "Webhook no recibido en n8n"
- Verificar URL del webhook en Supabase
- Verificar que el workflow está activado
- Verificar logs de pg_net en Supabase

### Error: "ElevenLabs API failed"
- Verificar API key
- Verificar créditos disponibles
- Verificar que el Voice ID existe

### Error: "Lambda timeout"
- Aumentar timeout a 60s
- Verificar que FFmpeg layer está correcto
- Verificar tamaño de archivos de entrada

### Error: "No se creó la programación"
- Verificar que existe la tabla `programaciones`
- Verificar permisos del usuario de Postgres
- Ver logs detallados en n8n

## Métricas de Éxito

| Métrica | Valor Esperado |
|---------|----------------|
| Tiempo total de generación | < 30 segundos |
| Indicativos generados | 3 por usuario |
| Programación creada | 1 por usuario |
| Errores en workflow | 0% |

## Limpieza Post-Test

```sql
-- Eliminar datos de prueba
DELETE FROM indicativos_generados WHERE establecimiento_nombre LIKE '%Prueba%';
DELETE FROM programaciones WHERE nombre LIKE '%Prueba%';
DELETE FROM contenidos WHERE nombre LIKE '%Prueba%';

-- O usar el usuario específico
DELETE FROM indicativos_generados WHERE usuario_id = 'UUID_USUARIO_TEST';
```
