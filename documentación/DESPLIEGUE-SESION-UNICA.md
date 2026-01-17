# 🚀 Despliegue de Sesión Única a Producción

## ✅ Estado Actual

### DESARROLLO (localhost:5173)
- ✅ Sesión única funcionando correctamente
- ✅ Modal detecta y cierra sesión
- ✅ Redirección automática funciona

### PRODUCCIÓN (main.dnpo8nagdov1i.amplifyapp.com)
- ❌ SQL desactualizado (error 400 en `start_single_session`)
- ❌ Modal no hace logout completo
- ❌ Redirección no funciona

---

## 📋 Pasos para Desplegar

### 1️⃣ Actualizar Base de Datos en Supabase (URGENTE)

**Ve a Supabase → SQL Editor:**
https://supabase.com/dashboard/project/nazlyvhndymalevkfpnl/sql

**Ejecuta el archivo completo:**
`database/013_single_session_enforcement.sql`

**⚠️ IMPORTANTE:** Este script contiene la corrección del error:
```sql
-- ANTES (causaba error "ambiguous column"):
SELECT closed_sessions_count INTO v_closed_count
FROM close_previous_user_sessions(p_usuario_id, p_device_id);

-- AHORA (corregido):
SELECT r.closed_sessions_count INTO v_closed_count
FROM close_previous_user_sessions(p_usuario_id, p_device_id) AS r;
```

**Verificación:**
Deberías ver: `Success. No rows returned`

---

### 2️⃣ Desplegar Frontend a Producción

#### Opción A: Git Push (Recomendado)

```bash
# 1. Ver cambios
git status

# 2. Agregar archivos modificados
git add src/components/SessionClosedModal.jsx
git add database/013_single_session_enforcement.sql

# 3. Commit
git commit -m "fix: Sesión única - Modal hace logout completo y SQL corregido"

# 4. Push a producción
git push origin main
```

#### Opción B: Despliegue Manual en Amplify

1. Ve a AWS Amplify Console
2. Selecciona tu app
3. Click en "Redeploy this version" o espera el auto-deploy de Git

---

### 3️⃣ Verificar Despliegue

**A. Base de Datos:**
```sql
-- Ejecuta esto en Supabase SQL Editor para verificar:
SELECT * FROM start_single_session(
  'test-user-id'::uuid,
  'test-device-123',
  '{"test": true}'::jsonb,
  '1.0.0'
);
```

Debe retornar:
- `new_session_id`: UUID de la nueva sesión
- `closed_sessions_count`: Número de sesiones cerradas
- `previous_device_id`: Device anterior (o null)

**B. Frontend en Producción:**

1. Abre la consola del navegador en producción
2. Ejecuta este test:
```javascript
const { data, error } = await window.supabase
  .rpc('start_single_session', {
    p_usuario_id: '9fba1a0c-60a4-45df-a16d-bea9923219df',
    p_device_id: 'test-' + Date.now()
  });

console.log('✅ Data:', data);
console.log('❌ Error:', error);
```

**Resultado esperado:**
```javascript
✅ Data: [{
  new_session_id: "uuid...",
  closed_sessions_count: 0-N,
  previous_device_id: "..."
}]
❌ Error: null
```

---

## 🧪 Test de Sesión Única en Producción

### Test 1: Cierre de Sesión Anterior
1. Abre producción en **Navegador 1** (ej: Chrome)
2. Inicia sesión con tu usuario
3. Abre producción en **Navegador 2** (ej: Firefox o ventana incógnito)
4. Inicia sesión con el MISMO usuario

**✅ Resultado Esperado:**
- Navegador 1: Modal "Sesión Cerrada" aparece
- Navegador 1: Reproducción se detiene
- Navegador 1: Redirige al login en 5s o al hacer click
- Navegador 2: Sesión activa, funciona normalmente

### Test 2: Modal Funcional
1. Cuando aparezca el modal en el dispositivo antiguo
2. Verifica:
   - ✅ El audio se detiene
   - ✅ El botón "Ir al Inicio de Sesión" funciona
   - ✅ Redirige automáticamente en 5s
   - ✅ En login, campos vacíos (localStorage limpio)

---

## 📊 Logs a Verificar

**En producción, deberías ver:**

```
🔐 Iniciando sesión única para usuario: xxx
✅ Sesión única iniciada: [uuid]
⚠️ 🔐 N sesión(es) previa(s) cerrada(s)
```

**En el dispositivo desplazado:**
```
🚫 Sesión cerrada detectada - Usuario conectado en otro dispositivo
🚫 Mostrando modal de sesión cerrada
🔄 Cerrando sesión por detección de inicio en otro dispositivo...
```

---

## ❌ Errores Comunes

### Error 1: "column reference is ambiguous"
**Causa:** SQL desactualizado en Supabase  
**Solución:** Re-ejecutar `database/013_single_session_enforcement.sql`

### Error 2: Modal aparece pero no hace logout
**Causa:** Frontend desactualizado en producción  
**Solución:** Hacer git push y esperar re-deploy en Amplify

### Error 3: WebSocket connection failed
**Causa:** Problemas de Realtime (no relacionado con sesión única)  
**Solución:** Verificar configuración RLS en Supabase

---

## 📞 Soporte

Si después del despliegue siguen los errores:
1. Verifica que el SQL se ejecutó correctamente en Supabase
2. Verifica que Amplify desplegó la última versión (revisa el commit)
3. Limpia caché del navegador: `Cmd + Shift + R`
4. Revisa logs de producción en la consola del navegador

