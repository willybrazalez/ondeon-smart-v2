# 🔐 Guía: Cambiar o Recuperar Contraseña

## 📋 Resumen

Esta guía explica cómo cambiar o recuperar tu contraseña desde la página de login. El sistema detecta automáticamente si eres un usuario **legacy** (tabla `usuarios`) o un usuario de **Supabase Auth** y muestra el flujo apropiado.

**Tiempo estimado:** 2-3 minutos  
**Requisitos:** Conocer tu usuario o email

---

## 🎯 Tipos de Usuarios

El sistema soporta **dos tipos de usuarios**:

### Usuarios Legacy
- Usuarios que se autentican usando la tabla `usuarios`
- Tienen un `username` y `password` almacenados en la base de datos
- Pueden cambiar su contraseña directamente (con o sin contraseña actual)

### Usuarios Supabase Auth
- Usuarios que se autentican con Supabase Auth
- Tienen un `email` registrado en Supabase
- Reciben un email con enlace para restablecer su contraseña

---

## 📝 Pasos para Cambiar la Contraseña

### Paso 1: Acceder al Modal de Cambio de Contraseña

1. Ve a la página de **Iniciar Sesión** (`/login`)
2. Haz clic en el enlace **"¿Olvidaste tu contraseña?"** que se encuentra debajo del campo de contraseña
3. Se abrirá un modal con el formulario de cambio de contraseña

**Nota:** El campo de usuario se prellenará automáticamente con el valor que hayas ingresado en el campo "Correo o usuario" del formulario de login (si existe).

### Paso 2: Completar el Formulario

El sistema detecta automáticamente tu tipo de usuario y muestra el formulario apropiado:

#### Para Usuarios Legacy:

El formulario incluye los siguientes campos:

1. **Usuario** (requerido)
   - Tu nombre de usuario en el sistema
   - Este campo se prellena automáticamente si ya ingresaste tu usuario en el formulario de login

2. **Contraseña Actual** (opcional si olvidaste tu contraseña)
   - Ingresa tu contraseña actual para verificar tu identidad
   - Si olvidaste tu contraseña, marca el checkbox "Olvidé mi contraseña actual"
   - ⚠️ **Advertencia:** Cambiar sin contraseña actual es menos seguro

3. **Checkbox "Olvidé mi contraseña actual"**
   - Marca esta opción si no recuerdas tu contraseña actual
   - Al marcarlo, el campo de contraseña actual se deshabilita
   - Aparecerá una advertencia de seguridad

4. **Nueva Contraseña** (requerido)
   - Ingresa la nueva contraseña que deseas usar
   - Debe tener al menos **6 caracteres**

5. **Confirmar Nueva Contraseña** (requerido)
   - Vuelve a ingresar la nueva contraseña para confirmarla
   - Debe coincidir exactamente con la nueva contraseña

#### Para Usuarios Supabase Auth:

El formulario solo requiere:

1. **Email** (requerido)
   - Tu dirección de email registrada en Supabase
   - Este campo se prellena automáticamente si ya ingresaste tu email en el formulario de login
   - Se enviará un email con un enlace para restablecer tu contraseña

### Paso 3: Validaciones

El sistema realizará validaciones diferentes según tu tipo de usuario:

#### Para Usuarios Legacy:
- ✅ Si proporcionas contraseña actual, debe ser correcta
- ✅ La nueva contraseña debe tener al menos 6 caracteres
- ✅ Las contraseñas nuevas deben coincidir
- ✅ Si proporcionas contraseña actual, la nueva debe ser diferente

#### Para Usuarios Supabase Auth:
- ✅ El email debe ser válido (contener @)
- ✅ El email debe estar registrado en Supabase

### Paso 4: Enviar el Formulario

#### Para Usuarios Legacy:
1. Haz clic en el botón **"Cambiar Contraseña"**
2. Espera a que se procese la solicitud (verás un mensaje de "Cambiando...")
3. Si todo es correcto, verás un mensaje de éxito: **"Contraseña actualizada exitosamente"**
4. El modal se cerrará automáticamente después de 2 segundos

#### Para Usuarios Supabase Auth:
1. Haz clic en el botón **"Enviar Email"**
2. Espera a que se procese la solicitud (verás un mensaje de "Enviando...")
3. Si todo es correcto, verás un mensaje de éxito: **"Se ha enviado un email con instrucciones para restablecer tu contraseña"**
4. Revisa tu bandeja de entrada (y spam) para encontrar el email
5. Haz clic en el enlace del email para restablecer tu contraseña
6. El modal se cerrará automáticamente después de 3 segundos

---

## ⚠️ Mensajes de Error Comunes

### "Contraseña actual incorrecta" (Solo usuarios legacy)
- **Causa:** La contraseña que ingresaste en "Contraseña Actual" no coincide con tu contraseña actual
- **Solución:** 
  - Verifica que estés escribiendo correctamente tu contraseña actual
  - Asegúrate de que no tengas activado el bloqueo de mayúsculas (Caps Lock)
  - Si olvidaste tu contraseña, marca el checkbox "Olvidé mi contraseña actual"

### "La nueva contraseña debe tener al menos 6 caracteres"
- **Causa:** La nueva contraseña es demasiado corta
- **Solución:** Usa una contraseña de al menos 6 caracteres

### "Las contraseñas nuevas no coinciden"
- **Causa:** Los campos "Nueva Contraseña" y "Confirmar Nueva Contraseña" tienen valores diferentes
- **Solución:** Asegúrate de escribir exactamente la misma contraseña en ambos campos

### "La nueva contraseña debe ser diferente a la actual"
- **Causa:** Estás intentando usar la misma contraseña que ya tienes
- **Solución:** Elige una contraseña diferente a la actual

### "Usuario no encontrado" (Solo usuarios legacy)
- **Causa:** No se pudo identificar tu usuario en el sistema
- **Solución:** Verifica que el usuario ingresado sea correcto. Si el problema persiste, contacta a un administrador

### "Error al enviar el email de recuperación" (Solo usuarios Supabase Auth)
- **Causa:** El email no está registrado en Supabase o hay un problema con el servicio de email
- **Solución:** 
  - Verifica que el email sea correcto
  - Asegúrate de que el email esté registrado en Supabase
  - Si el problema persiste, contacta a un administrador

---

## 🔒 Seguridad

### ¿Cómo funciona la seguridad?

1. **Verificación de identidad:** Debes proporcionar tu contraseña actual para cambiar la contraseña
2. **Hasheo seguro:** La nueva contraseña se hashea usando bcrypt antes de guardarse en la base de datos
3. **Validación en servidor:** Todas las validaciones se realizan en el servidor (Edge Function) para mayor seguridad
4. **Sin exposición:** La contraseña nunca se transmite o almacena en texto plano

### Recomendaciones de Seguridad

- ✅ Usa contraseñas fuertes (mínimo 8 caracteres, con mayúsculas, minúsculas, números y símbolos)
- ✅ No compartas tu contraseña con nadie
- ✅ Cambia tu contraseña periódicamente
- ✅ No uses la misma contraseña en múltiples servicios
- ✅ Si sospechas que tu contraseña fue comprometida, cámbiala inmediatamente

---

## 🛠️ Para Administradores

### Desplegar la Edge Function

Si la funcionalidad no está disponible, asegúrate de que la Edge Function `change-password` esté desplegada:

```bash
# Desde la raíz del proyecto
cd supabase/functions/change-password
supabase functions deploy change-password
```

### Verificar que la Edge Function esté funcionando

Puedes probar la Edge Function directamente usando curl:

```bash
curl -X POST https://[TU-PROYECTO].supabase.co/functions/v1/change-password \
  -H "Content-Type: application/json" \
  -H "apikey: [TU-ANON-KEY]" \
  -H "Authorization: Bearer [TU-ANON-KEY]" \
  -d '{
    "username": "usuario_prueba",
    "currentPassword": "password_actual",
    "newPassword": "nueva_password123"
  }'
```

### Troubleshooting

Si un usuario reporta problemas para cambiar su contraseña:

1. **Verificar que el usuario existe:**
   ```sql
   SELECT id, username FROM usuarios WHERE username = 'nombre_usuario';
   ```

2. **Verificar que tiene contraseña:**
   ```sql
   SELECT id, username, 
          CASE 
            WHEN password LIKE '$2%' THEN 'Hasheada'
            WHEN password IS NULL OR password = '' THEN 'Sin password'
            ELSE 'Texto plano'
          END as tipo_password
   FROM usuarios 
   WHERE username = 'nombre_usuario';
   ```

3. **Verificar logs de la Edge Function:**
   - Ve a Supabase Dashboard > Edge Functions > change-password > Logs
   - Busca errores relacionados con el usuario

---

## 📚 Información Técnica

### Arquitectura

- **Frontend:** `src/pages/LoginPage.jsx` - Modal integrado en la página de login
- **API Client:** `src/lib/api.js` - Función `changePasswordLegacyEdge()`
- **Edge Function:** `supabase/functions/change-password/index.ts` - Lógica de negocio y seguridad
- **Base de datos:** Tabla `usuarios` - Almacenamiento de contraseñas hasheadas

### Flujo de Datos

```
Usuario → LoginPage (click "¿Olvidaste tu contraseña?") 
  → Modal de cambio de contraseña 
    → authApi.changePasswordLegacyEdge() 
      → Edge Function (change-password) 
        → Verifica contraseña actual
        → Hashea nueva contraseña con bcrypt
        → Actualiza tabla usuarios
        → Retorna éxito/error
```

### Hasheo de Contraseñas

- **Algoritmo:** bcrypt
- **Cost factor:** 10 (balance entre seguridad y rendimiento)
- **Formato:** `$2a$10$...` o `$2b$10$...`

---

## ❓ Preguntas Frecuentes

### ¿Puedo cambiar mi contraseña si soy un usuario de Supabase Auth?

Sí, el sistema detecta automáticamente si eres un usuario de Supabase Auth y te muestra un formulario diferente. Solo necesitas ingresar tu email y recibirás un enlace para restablecer tu contraseña.

### ¿Qué pasa si olvido mi contraseña?

**Para usuarios legacy:**
- Puedes marcar el checkbox "Olvidé mi contraseña actual" en el modal
- Esto te permitirá cambiar tu contraseña sin verificar la actual
- ⚠️ Ten en cuenta que esto es menos seguro, úsalo solo si realmente olvidaste tu contraseña

**Para usuarios Supabase Auth:**
- El sistema te enviará automáticamente un email con un enlace para restablecer tu contraseña
- Revisa tu bandeja de entrada y spam

### ¿Puedo usar la misma contraseña que tenía antes?

No, la nueva contraseña debe ser diferente a la actual. Esto es una medida de seguridad.

### ¿Cuánto tiempo tarda el cambio de contraseña?

El cambio de contraseña es instantáneo. Una vez que recibas el mensaje de éxito, tu nueva contraseña ya está activa.

### ¿Necesito cerrar sesión después de cambiar la contraseña?

No es necesario cerrar sesión inmediatamente, pero se recomienda hacerlo para asegurar que todas las sesiones usen la nueva contraseña.

---

## 📞 Soporte

Si tienes problemas para cambiar tu contraseña:

1. Verifica que cumples con todos los requisitos de validación
2. Intenta cerrar sesión y volver a iniciar sesión
3. Contacta a un administrador del sistema
4. Proporciona el mensaje de error exacto que recibes

---

**Última actualización:** Enero 2025  
**Versión:** 1.0

