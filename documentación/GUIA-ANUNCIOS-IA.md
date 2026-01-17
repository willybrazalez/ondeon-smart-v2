# 🤖 Guía Completa: Sistema de Anuncios con IA

Sistema completo para generar y programar anuncios profesionales usando **OpenAI GPT-4** y **ElevenLabs TTS**.

---

## 📋 **Archivos Creados**

✅ **Base de Datos**:
- `database/014_create_ai_ads_system.sql` - Tablas necesarias

✅ **Backend (Edge Function)**:
- `supabase/functions/generate-ad/index.ts` - Función principal
- `supabase/functions/generate-ad/deno.json` - Configuración

✅ **Frontend**:
- `src/services/aiAdService.js` - Servicio de IA
- `src/pages/admin/QuickAdsPage.jsx` - Interfaz completa

---

## 🚀 **PASO 1: Configurar Base de Datos**

### 1.1 Ejecutar SQL en Supabase

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Click en **SQL Editor** (menú lateral)
3. Click en **New Query**
4. Copia y pega el contenido de `database/014_create_ai_ads_system.sql`
5. Click en **Run** (o Ctrl/Cmd + Enter)
6. Verifica que no haya errores

### 1.2 Verificar Tablas

Ejecuta estas queries para verificar:

```sql
-- Verificar tabla de anuncios IA
SELECT * FROM ai_generated_ads LIMIT 1;

-- Verificar tabla de música
SELECT * FROM background_music_library LIMIT 1;

-- Ver estructura completa
\d ai_generated_ads
\d background_music_library
```

---

## 🔑 **PASO 2: Obtener API Keys**

### 2.1 OpenAI (GPT-4)

1. Ve a: https://platform.openai.com/api-keys
2. Click en **Create new secret key**
3. Nombre: `ondeon-ai-ads`
4. **IMPORTANTE**: Copia la key inmediatamente (solo se muestra una vez)
5. Guárdala de forma segura

**Formato**: `sk-proj-xxxxxxxxxxxxx...`

**Costo estimado**: ~$0.03 por anuncio

### 2.2 ElevenLabs (TTS)

1. Ve a: https://elevenlabs.io/app/settings/api-keys
2. Click en **Generate API Key**
3. **IMPORTANTE**: Copia la key inmediatamente
4. Guárdala de forma segura

**Formato**: `xxxxxxxxxxxxxxxxxxxxxxxxx` (32 caracteres)

**Costo estimado**: ~$0.24 por anuncio (30 segundos)

---

## ☁️ **PASO 3: Configurar Supabase**

### 3.1 Configurar Secrets (API Keys)

#### Opción A: Desde Dashboard (Recomendado)

1. Ve a tu proyecto en Supabase
2. Click en **Edge Functions** (menú lateral)
3. Click en **Manage secrets**
4. Añade estos 2 secrets:

```
OPENAI_API_KEY = sk-proj-xxxxxxxxxxxxx...
ELEVENLABS_API_KEY = xxxxxxxxxxxxxxxxx...
```

#### Opción B: Desde CLI

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx...
supabase secrets set ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxx...
```

### 3.2 Verificar Bucket de Storage

1. Ve a **Storage** en Supabase Dashboard
2. Verifica que existe el bucket `contenidos`
3. Si no existe:
   - Click en **New bucket**
   - Nombre: `contenidos`
   - Public: **SÍ**
   - Click en **Create bucket**

---

## 🛠️ **PASO 4: Instalar y Configurar Supabase CLI**

### 4.1 Instalar CLI

#### macOS:
```bash
brew install supabase/tap/supabase
```

#### Windows:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Linux/WSL:
```bash
brew install supabase/tap/supabase
```

#### Alternativa (npm):
```bash
npm install -g supabase
```

### 4.2 Login y Link

```bash
# 1. Login
supabase login

# 2. Obtener Project Reference
# Ve a: Settings > General > Reference ID en Supabase Dashboard

# 3. Link tu proyecto
supabase link --project-ref TU_PROJECT_REF

# Ejemplo:
# supabase link --project-ref abcdefghijklmnop
```

---

## 📦 **PASO 5: Desplegar Edge Function**

### 5.1 Navegar a tu proyecto

```bash
cd "/Users/willymac/Desktop/MACBOOK PRO 2015/ONDEON/Nuevo ONDEON/frontend-desktop"
```

### 5.2 Desplegar la función

```bash
supabase functions deploy generate-ad
```

**Salida esperada**:
```
✓ Deployed Function generate-ad
URL: https://xxxxxx.supabase.co/functions/v1/generate-ad
```

### 5.3 Verificar función en Dashboard

1. Ve a **Edge Functions** en Supabase Dashboard
2. Debe aparecer `generate-ad`
3. Estado: **Active** 🟢

---

## 🧪 **PASO 6: Testing**

### 6.1 Test desde CLI

```bash
supabase functions invoke generate-ad \
  --body '{
    "idea": "Descuento del 20% en todos los productos",
    "voiceType": "femenina",
    "empresaNombre": "Farmacia Test",
    "duration": 30
  }'
```

**Respuesta esperada**:
```json
{
  "success": true,
  "texto": "¡Atención! Esta semana en Farmacia Test...",
  "audioUrl": "https://...storage.../ads/ad-xxxxx.mp3",
  "voiceId": "EXAVITQu4vr4xnSDxMaL",
  "model": "gpt-4"
}
```

### 6.2 Ver Logs

```bash
supabase functions logs generate-ad --follow
```

### 6.3 Test desde la App

1. Inicia tu aplicación:
```bash
npm run dev
```

2. Navega a: **Admin** → **Anuncios Rápidos**

3. Prueba el flujo completo:
   - Escribe una idea
   - Selecciona tipo de voz
   - Click en "Generar con IA"
   - Escucha el resultado
   - Programa para usuarios

---

## 🐛 **Solución de Problemas**

### Problema 1: Error "OPENAI_API_KEY no configurada"

**Solución**:
1. Verifica que configuraste el secret en Supabase
2. Espera 2-3 minutos y vuelve a desplegar:
```bash
supabase functions deploy generate-ad
```

### Problema 2: Error "Failed to upload to Storage"

**Solución**:
1. Verifica que el bucket `contenidos` existe
2. Verifica que es **público**
3. Verifica los permisos RLS de la tabla `contenidos`

### Problema 3: Audio no se genera

**Solución**:
1. Verifica logs del Edge Function:
```bash
supabase functions logs generate-ad
```

2. Verifica que tu cuenta de ElevenLabs tiene créditos
3. Verifica la API key de ElevenLabs

### Problema 4: "Cannot find module aiAdService"

**Solución**:
```bash
# Reinicia el servidor de desarrollo
npm run dev
```

### Problema 5: Programación no aparece en usuarios

**Solución**:
1. Verifica en Supabase SQL Editor:
```sql
SELECT * FROM programaciones ORDER BY created_at DESC LIMIT 5;
SELECT * FROM programacion_destinatarios ORDER BY created_at DESC LIMIT 10;
```

2. Verifica que `scheduledContentService` esté activo en el navegador del usuario
3. Abre consola del navegador y busca logs: `scheduledContent`

---

## 📊 **Verificar que Todo Funciona**

### Checklist Completo

#### Base de Datos
- [ ] Tabla `ai_generated_ads` existe
- [ ] Tabla `background_music_library` existe
- [ ] Bucket `contenidos` existe y es público

#### Edge Function
- [ ] Función `generate-ad` desplegada
- [ ] Secrets configurados (OpenAI + ElevenLabs)
- [ ] Test desde CLI funciona

#### Frontend
- [ ] Página carga sin errores
- [ ] Se muestra el nombre de la empresa
- [ ] Botón "Generar con IA" funciona
- [ ] Audio se reproduce correctamente
- [ ] Programación se guarda en BD

#### Sistema Completo
- [ ] Generar anuncio (texto + audio)
- [ ] Escuchar anuncio generado
- [ ] Programar para todos los usuarios
- [ ] Programar para grupos específicos
- [ ] Anuncio suena automáticamente en usuarios

---

## 💰 **Costos Estimados**

### Por Anuncio Generado

| Servicio | Costo Aprox. |
|----------|--------------|
| OpenAI GPT-4 (100 tokens) | $0.03 |
| ElevenLabs TTS (30s) | $0.24 |
| Supabase Storage (5 MB) | < $0.001 |
| **TOTAL** | **~$0.27** |

### Mensual (Estimación)

- 50 anuncios/mes: **$13.50**
- 100 anuncios/mes: **$27**
- 200 anuncios/mes: **$54**

**Nota**: Precios aproximados, pueden variar según los planes contratados.

---

## 🎵 **FASE 3: Música de Fondo (Opcional)**

Esta funcionalidad está preparada pero **no implementada** en el Edge Function actual.

### Para implementarla:

1. Subir música royalty-free a Storage
2. Insertar registros en `background_music_library`
3. Implementar mezcla con FFmpeg en el Edge Function
4. Añadir selector de música en `QuickAdsPage.jsx`

**Recursos de música gratuita**:
- Bensound.com
- Incompetech.com
- YouTube Audio Library

---

## 📚 **Recursos Adicionales**

### Documentación

- **OpenAI**: https://platform.openai.com/docs/api-reference
- **ElevenLabs**: https://elevenlabs.io/docs/api-reference
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

### Soporte

- **OpenAI Help**: https://help.openai.com/
- **ElevenLabs Discord**: https://discord.gg/elevenlabs
- **Supabase Discord**: https://discord.supabase.com/

---

## ✅ **Checklist Final**

Antes de dar por terminada la implementación:

### Configuración
- [ ] Base de datos: Tablas creadas
- [ ] OpenAI: API key obtenida y configurada
- [ ] ElevenLabs: API key obtenida y configurada
- [ ] Supabase: Secrets configurados
- [ ] Supabase: Bucket storage creado
- [ ] Supabase CLI: Instalado y linked
- [ ] Edge Function: Desplegada

### Testing
- [ ] Test CLI: Funciona
- [ ] Test UI: Genera anuncio
- [ ] Test UI: Audio se reproduce
- [ ] Test UI: Programación se guarda
- [ ] Test real: Anuncio suena en usuario

### Producción
- [ ] Verificar costos actuales
- [ ] Configurar límites de uso (opcional)
- [ ] Documentar para otros admins
- [ ] Capacitar usuarios administradores

---

## 🎉 **¡Sistema Listo!**

Si completaste todos los pasos, tu sistema de anuncios con IA está **100% funcional**.

Los administradores pueden ahora:
1. Escribir una idea en segundos
2. Generar anuncio profesional con IA
3. Programarlo para miles de usuarios
4. Todo automático y sin intervención manual

**¿Preguntas o problemas?**
Revisa la sección de "Solución de Problemas" o consulta los logs en Supabase Dashboard.

