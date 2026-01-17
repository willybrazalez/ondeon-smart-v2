# ⚡ Comandos Rápidos - Anuncios con IA

Copia y pega estos comandos en orden para completar la configuración.

---

## 🗄️ **1. Ejecutar SQL en Supabase**

1. Abre: https://supabase.com/dashboard
2. Click en tu proyecto
3. Click en **SQL Editor** (menú lateral izquierdo)
4. Click en **New Query**
5. Copia TODO el contenido del archivo: `database/014_create_ai_ads_system.sql`
6. Pega y click en **Run** (botón verde) o presiona `Ctrl/Cmd + Enter`
7. ✅ Debe decir "Success. No rows returned"

---

## 🔑 **2. Obtener API Keys**

### OpenAI
```
1. Abre: https://platform.openai.com/api-keys
2. Click: Create new secret key
3. Copia la key (empieza con sk-proj-...)
4. Guárdala en un lugar seguro
```

### ElevenLabs
```
1. Abre: https://elevenlabs.io/app/settings/api-keys
2. Click: Generate API Key  
3. Copia la key (32 caracteres)
4. Guárdala en un lugar seguro
```

---

## ☁️ **3. Configurar Secrets en Supabase**

### Desde Dashboard (Recomendado)

1. Abre: https://supabase.com/dashboard
2. Click en tu proyecto
3. Click en **Edge Functions** (menú lateral)
4. Click en **Manage secrets**
5. Click en **Add new secret**
6. Añade estos 2 secrets:

**Secret 1:**
```
Name: OPENAI_API_KEY
Value: [pega tu key de OpenAI aquí]
```

**Secret 2:**
```
Name: ELEVENLABS_API_KEY
Value: [pega tu key de ElevenLabs aquí]
```

---

## 🚀 **4. Instalar Supabase CLI**

### macOS
```bash
brew install supabase/tap/supabase
```

### Windows (con Scoop)
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Linux/WSL
```bash
brew install supabase/tap/supabase
```

### Alternativa (cualquier OS con Node.js)
```bash
npm install -g supabase
```

---

## 🔗 **5. Link Proyecto**

### Paso 1: Obtener Project Reference

1. Abre: https://supabase.com/dashboard
2. Click en tu proyecto
3. Click en **Settings** (ícono de tuerca) → **General**
4. Copia el **Reference ID** (algo como: `abcdefghijklmnop`)

### Paso 2: Login y Link

```bash
# Login en Supabase
supabase login

# Link tu proyecto (REEMPLAZA con tu Reference ID)
supabase link --project-ref TU_REFERENCE_ID_AQUI

# Ejemplo:
# supabase link --project-ref abcdefghijklmnop
```

---

## 📦 **6. Desplegar Edge Function**

```bash
# Navegar a tu proyecto
cd "/Users/willymac/Desktop/MACBOOK PRO 2015/ONDEON/Nuevo ONDEON/frontend-desktop"

# Desplegar la función
supabase functions deploy generate-ad
```

**✅ Salida esperada:**
```
Deploying Function (project-ref = xxxxx)...
Deployed Function generate-ad
URL: https://xxxxx.supabase.co/functions/v1/generate-ad
```

---

## 🧪 **7. Testing**

### Test 1: Desde CLI

```bash
supabase functions invoke generate-ad \
  --body '{
    "idea": "Descuento del 20% en todos los productos este fin de semana",
    "voiceType": "femenina",
    "empresaNombre": "Mi Empresa Test",
    "duration": 30
  }'
```

**✅ Debe devolver JSON con:**
- `success: true`
- `texto: "..."`
- `audioUrl: "https://..."`

### Test 2: Ver Logs

```bash
supabase functions logs generate-ad --follow
```

(Deja esto corriendo mientras haces pruebas)

### Test 3: Desde la App

```bash
# En una terminal nueva
cd "/Users/willymac/Desktop/MACBOOK PRO 2015/ONDEON/Nuevo ONDEON/frontend-desktop"
npm run dev
```

**Luego en el navegador:**
1. Login como admin
2. Ir a: **Admin** → **Anuncios Rápidos**
3. Escribir una idea
4. Seleccionar voz
5. Click en "Generar Anuncio con IA"
6. ✅ Debe generar texto + audio

---

## 🔍 **8. Verificar en Supabase Dashboard**

### Verificar Edge Function
```
Dashboard → Edge Functions → Debe ver "generate-ad" (Active 🟢)
```

### Verificar Secrets
```
Dashboard → Edge Functions → Manage secrets → Debe ver:
- OPENAI_API_KEY
- ELEVENLABS_API_KEY
```

### Verificar Storage
```
Dashboard → Storage → Debe ver bucket "contenidos"
Debe ser PUBLIC (ícono de globo 🌐)
```

### Verificar Tablas
```
Dashboard → Table Editor → Debe ver:
- ai_generated_ads
- background_music_library
```

---

## ⚠️ **Solución Rápida de Problemas**

### Error: "OPENAI_API_KEY no configurada"
```bash
# Espera 2 minutos y vuelve a desplegar
supabase functions deploy generate-ad
```

### Error: "Failed to upload"
```
1. Dashboard → Storage → Bucket "contenidos"
2. Verificar que es PUBLIC
3. Click en Settings → Hacer público
```

### Error: "Module not found: aiAdService"
```bash
# Reinicia el servidor
npm run dev
```

### Ver todos los logs
```bash
# Logs del Edge Function
supabase functions logs generate-ad

# Logs en tiempo real
supabase functions logs generate-ad --follow
```

---

## ✅ **Checklist Final**

Marca cuando completes cada paso:

- [ ] SQL ejecutado en Supabase
- [ ] API key de OpenAI obtenida
- [ ] API key de ElevenLabs obtenida
- [ ] Secrets configurados en Supabase
- [ ] Supabase CLI instalado
- [ ] Proyecto linked
- [ ] Edge Function desplegada
- [ ] Test CLI funciona
- [ ] Test desde app funciona
- [ ] Audio se reproduce correctamente

---

## 🎉 **¡Listo!**

Si todos los tests pasaron, el sistema está **100% funcional**.

**Tiempo total**: 30-45 minutos

**Próximo uso**: Los admins solo necesitan:
1. Escribir idea
2. Click en "Generar"
3. Programar
4. ¡Listo!

---

**¿Problemas?** → Consulta `GUIA-ANUNCIOS-IA.md` (sección "Solución de Problemas")

