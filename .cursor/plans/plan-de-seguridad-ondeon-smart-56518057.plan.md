<!-- 56518057-5e77-4c87-8558-27eba2ca098c 7b6aa86f-97e0-4a9c-999f-8bfb91f8d8d2 -->
# Plan de Acción: Remediar Vulnerabilidades de Seguridad

## Resumen Ejecutivo

Este plan aborda **4 vulnerabilidades CRÍTICAS**, **4 problemas de severidad ALTA**, **4 problemas MEDIA** y **2 hallazgos BAJOS** identificados en el informe de seguridad. El enfoque es por fases, priorizando la remediación inmediata de los problemas críticos.

---

## FASE 1: VULNERABILIDADES CRÍTICAS (7 días - $11K-20K)

### 1.1 ✅ Eliminar contraseñas en texto plano (CRÍTICO) - COMPLETADO

**Estado**: ✅ **COMPLETAMENTE RESUELTO** - Código legacy inseguro eliminado

**Verificación realizada**:

- ✅ Función insegura `signInWithUsuarios` eliminada de `src/lib/api.js`
- ✅ `AuthContext.jsx` ahora usa exclusivamente `signInLegacyEdge` que llama a la Edge Function segura
- ✅ Edge Function `/functions/v1/login` maneja contraseñas hasheadas con bcrypt
- ✅ Script SQL `database/017_hash_passwords_usuarios.sql` disponible para migración

**Resultado**: El sistema ahora usa exclusivamente la Edge Function segura que valida contraseñas hasheadas. No existe código que compare contraseñas en texto plano.

---

### 1.2 Implementar CSP restrictivo en Electron (CRÍTICO)

**Problema**: CSP completamente eliminado en `electron/main.cjs` líneas 48-63, y `webSecurity: false` en línea 79.

**Contexto: ¿Por qué necesitamos WebSockets?**

La aplicación requiere conexiones WebSocket a Supabase Realtime para:

1. **Programaciones en tiempo real**: Cuando un administrador crea, edita o elimina programaciones, los usuarios deben recibir estos cambios instantáneamente sin necesidad de recargar la aplicación
2. **Sistema de presencia**: Detectar cuando usuarios se conectan/desconectan para el dashboard de administración
3. **Cambios en asignaciones**: Detectar cuando se asignan programaciones a usuarios específicos (`programacion_destinatarios`)
4. **Cambios en contenidos**: Detectar cuando se modifican contenidos de programaciones (`programacion_contenidos`)

**¿Por qué CSP causó un problema?**

- **Versión Web**: Los WebSockets pueden desconectarse cuando el navegador suspende la conexión (pantalla bloqueada, pestaña inactiva). Por esto se implementó un sistema híbrido WebSocket + Polling como fallback
- **App Nativa (Electron)**: La app nunca se desconecta realmente, pero cuando `webSecurity: true` estaba habilitado en producción, Electron aplicaba CSP por defecto que bloqueaba conexiones WebSocket (`wss://`) a Supabase
- **Solución temporal**: Se deshabilitó completamente CSP (`webSecurity: false`) y se eliminaron headers CSP para permitir WebSockets, pero esto elimina protecciones de seguridad importantes

**Archivos afectados**:

- `electron/main.cjs` (líneas 48-63, 79)

**Acciones**:

1. Implementar CSP específico que permita WebSockets a Supabase pero bloquee otros riesgos
2. Configurar `webSecurity: true` con CSP personalizado en lugar de deshabilitarlo completamente
3. Permitir solo conexiones a dominios conocidos (Supabase, APIs necesarias)
4. Bloquear `eval()`, `inline scripts` no confiables, y recursos externos no autorizados
5. **Nota importante**: La app nativa no tiene el problema de desconexión de WebSockets que tiene la versión web, por lo que el CSP puede ser más restrictivo

**Archivos a modificar**:

- `electron/main.cjs` - Implementar CSP restrictivo pero funcional

**CSP propuesto**:

```
default-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https:;
```

**Consideración especial**: Para la versión web, mantener el sistema híbrido WebSocket + Polling ya implementado, ya que los WebSockets pueden desconectarse. Para la app nativa, el CSP puede ser más restrictivo porque la conexión es estable.

---

### 1.3 Habilitar validación de entrada del servidor (CRÍTICO)

**Problema**: Falta validación robusta de entrada en Edge Functions y endpoints.

**Archivos afectados**:

- `supabase/functions/login/index.ts`
- `supabase/functions/generate-ad/index.ts`
- Otras Edge Functions

**Acciones**:

1. Implementar validación de tipos, rangos y formatos en todas las Edge Functions
2. Sanitizar inputs para prevenir inyección SQL (aunque Supabase lo previene, validar igual)
3. Validar longitud máxima de strings, formatos de email, etc.
4. Implementar rate limiting básico para prevenir ataques de fuerza bruta
5. Validar autenticación y autorización en cada endpoint

**Archivos a modificar**:

- `supabase/functions/login/index.ts` - Añadir validaciones robustas
- `supabase/functions/generate-ad/index.ts` - Validar inputs
- Crear módulo compartido de validación si hay múltiples funciones

**Validaciones necesarias**:

- Username: 3-50 caracteres, solo alfanuméricos y guiones
- Password: mínimo 8 caracteres, verificar fortaleza
- Rate limiting: máximo 5 intentos de login por IP cada 15 minutos

---

### 1.4 Restringir CORS (CRÍTICO)

**Problema**: CORS configurado con `'Access-Control-Allow-Origin': '*'` permitiendo cualquier origen.

**Archivos afectados**:

- `supabase/functions/login/index.ts` (línea 23)
- `supabase/functions/generate-ad/index.ts` (línea 30)

**Acciones**:

1. Restringir CORS a dominios específicos de la aplicación
2. Configurar lista blanca de orígenes permitidos
3. Validar origen en cada request
4. Configurar headers CORS apropiados (credentials, métodos permitidos)

**Archivos a modificar**:

- `supabase/functions/login/index.ts` - Restringir CORS
- `supabase/functions/generate-ad/index.ts` - Restringir CORS
- Crear configuración centralizada de CORS permitidos

---

## FASE 2: PROBLEMAS DE SEVERIDAD ALTA (30 días - $9K-18K)

### 2.1 Implementar rate limiting avanzado

**Acciones**:

1. Implementar rate limiting por usuario/IP en Edge Functions
2. Configurar límites diferentes por tipo de operación
3. Implementar backoff exponencial para intentos fallidos
4. Registrar intentos sospechosos para análisis

---

### 2.2 Mejorar logging y monitoreo de seguridad

**Acciones**:

1. Implementar logging estructurado de eventos de seguridad
2. Registrar todos los intentos de login (exitosos y fallidos)
3. Alertar sobre patrones sospechosos (múltiples fallos, IPs desconocidas)
4. Implementar dashboard de seguridad básico

---

### 2.3 Revisar y fortalecer políticas RLS

**Acciones**:

1. Auditar todas las políticas RLS existentes
2. Verificar que todas las tablas sensibles tengan RLS habilitado
3. Implementar políticas faltantes según documentación de seguridad
4. Probar políticas con diferentes roles de usuario

**Archivos a revisar**:

- `database/FIX-RLS-*.sql` (múltiples archivos)
- Verificar implementación según `documentación/SEGURIDAD-FILTRADO-EMPRESAS.md`

---

### 2.4 Implementar validación de tokens y sesiones

**Acciones**:

1. Validar expiración de tokens en cada request
2. Implementar refresh tokens seguros
3. Invalidar sesiones al detectar actividad sospechosa
4. Implementar logout forzado para sesiones comprometidas

---

## FASE 3: PROBLEMAS DE SEVERIDAD MEDIA (90 días - $21K-31K)

### 3.1 Auditoría de código para inyección SQL/XSS

**Acciones**:

1. Revisar todas las queries a la base de datos
2. Verificar uso de parámetros preparados (Supabase lo hace automáticamente)
3. Auditar renderizado de datos del usuario para prevenir XSS
4. Implementar sanitización de outputs

---

### 3.2 Mejorar manejo de errores

**Acciones**:

1. Evitar exponer información sensible en mensajes de error
2. Implementar mensajes de error genéricos para usuarios
3. Logging detallado solo en servidor/logs internos
4. Manejar errores de forma consistente

---

### 3.3 Implementar headers de seguridad HTTP

**Acciones**:

1. Verificar implementación de headers en `public/_headers`
2. Añadir headers faltantes (HSTS, X-Frame-Options, etc.)
3. Configurar headers en Edge Functions
4. Verificar headers en Electron

**Archivos a revisar**:

- `public/_headers` (ya tiene algunos headers)
- Headers en Edge Functions

---

### 3.4 Revisar dependencias y actualizar vulnerabilidades

**Acciones**:

1. Ejecutar auditoría de dependencias (`npm audit`)
2. Actualizar dependencias con vulnerabilidades conocidas
3. Implementar proceso de actualización regular
4. Configurar alertas automáticas para nuevas vulnerabilidades

---

## FASE 4: HALLAZGOS BAJOS/INFORMATIVOS (Opcional - $600-900)

### 4.1 Documentación de seguridad

**Acciones**:

1. Documentar políticas de seguridad
2. Crear guía de mejores prácticas para desarrolladores
3. Documentar proceso de respuesta a incidentes

### 4.2 Mejoras menores

**Acciones**:

1. Optimizar configuración de seguridad
2. Implementar mejoras de UX relacionadas con seguridad
3. Revisar y mejorar mensajes de error para usuarios

---

## Cronograma de Implementación

### Semana 1-2 (CRÍTICOS)

- Días 1-3: Eliminar contraseñas en texto plano
- Días 4-5: Implementar CSP restrictivo
- Días 6-7: Validación de entrada y CORS

### Semana 3-4 (CRÍTICOS - Continuación)

- Completar tareas pendientes de Fase 1
- Testing y verificación

### Semana 5-8 (ALTA)

- Implementar rate limiting
- Mejorar logging
- Revisar RLS
- Validación de tokens

### Semana 9-20 (MEDIA)

- Auditorías de código
- Mejoras de errores
- Headers de seguridad
- Actualización de dependencias

---

## Recursos Necesarios

**Equipo Fase 1**: 4-6 desarrolladores

**Equipo Fases 2-3**: 2-5 desarrolladores

**Herramientas**: $3K-19K/año (monitoreo, análisis de seguridad)

**Costos únicos**: $400-900 (herramientas de auditoría)

---

## Métricas de Éxito

- ✅ 0 contraseñas en texto plano en base de datos
- ✅ CSP implementado y funcionando con WebSockets
- ✅ 100% de endpoints con validación de entrada
- ✅ CORS restringido a orígenes específicos
- ✅ Rate limiting activo en todos los endpoints críticos
- ✅ Logging de seguridad implementado
- ✅ Todas las tablas sensibles con RLS habilitado

---

## Notas Importantes

1. **Migración de usuarios**: La eliminación de `signInWithUsuarios` requiere migrar todos los usuarios al sistema de Edge Function
2. **CSP y WebSockets**: El CSP debe permitir conexiones WebSocket a Supabase para mantener funcionalidad de tiempo real
3. **Testing**: Cada cambio requiere testing exhaustivo para no romper funcionalidad existente
4. **Rollback plan**: Tener plan de rollback para cada cambio crítico
5. **Comunicación**: Informar a usuarios sobre cambios en autenticación si es necesario