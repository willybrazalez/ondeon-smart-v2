# Guía de In-App Purchases con RevenueCat

## ✅ COMPLETADO

### Código y configuración básica:
- [x] SDK RevenueCat instalado (iOS + Android)
- [x] Servicio `purchaseService.js` creado
- [x] `RegisterPage.jsx` actualizado con lógica IAP
- [x] `App.jsx` inicializa RevenueCat automáticamente
- [x] API key iOS configurada: `appl_XjzyPaMTwAAyvXzHQyYmVailow4`
- [x] Servidor MCP conectado para gestión rápida

### RevenueCat configurado:
- [x] Proyecto creado: `Ondeon Grupo S.L.` (ID: `projbe3868d8`)
- [x] App iOS añadida: `com.ondeon.smart`
- [x] Entitlement `ondeon_premium` creado
- [x] Offering `default` creado
- [x] 4 productos creados en App Store Connect vía MCP

### Productos en App Store Connect:
- [x] `ondeon_basico_mensual` - Configurado con precio
- [x] `ondeon_basico_anual` - Creado (pendiente configurar precio)
- [x] `ondeon_pro_mensual` - Creado (pendiente configurar precio)
- [x] `ondeon_pro_anual` - Creado (pendiente configurar precio)

---

## 📋 PENDIENTE

### 1. Configurar precios en App Store Connect

Ve a **App Store Connect** → **Ondeon Smart** → **Suscripciones**

Para cada producto nuevo (`ondeon_basico_anual`, `ondeon_pro_mensual`, `ondeon_pro_anual`):

1. **Click en el producto**
2. **Precio de suscripción** → "Añadir precio"
   - Básico anual: **€96/año**
   - Pro mensual: **€18/mes**
   - Pro anual: **€168/año**
3. **Guardar**
4. **Oferta introductoria** → "Crear oferta"
   - Tipo: Prueba gratuita
   - Duración: **7 días**
   - Países: Todos

### 2. Añadir idiomas a los productos (opcional)

Por cada producto, en la sección "Idioma":
- Español ✅ (ya configurado)
- Inglés (recomendado)
- Alemán (recomendado)

**Textos sugeridos:**

#### Inglés:
- Básico Mensual: `Professional music + commercial license`
- Básico Anual: `Professional music + license. Save 22%`
- Pro Mensual: `Everything in Basic + AI Audio Marketing`
- Pro Anual: `Everything in Basic + AI Marketing. Save 22%`

#### Alemán:
- Básico Mensual: `Professionelle Musik + Lizenz`
- Básico Anual: `Professionelle Musik + Lizenz. Spare 22%`
- Pro Mensual: `Alles von Basic + KI Audio Marketing`
- Pro Anual: `Alles von Basic + KI Marketing. Spare 22%`

### 3. Google Play Console (cuando esté verificada tu cuenta)

**3.1. Crear la app:**
- Package name: `com.ondeon.smart`
- Nombre: `Ondeon Smart`

**3.2. Crear 4 productos de suscripción:**
- ID: `ondeon_basico_mensual` - €10/mes
- ID: `ondeon_basico_anual` - €96/año
- ID: `ondeon_pro_mensual` - €18/mes
- ID: `ondeon_pro_anual` - €168/año
- Trial: 7 días en todos

**3.3. Conectar con RevenueCat:**
- Generar JSON de credenciales en Google Play Console
- Subir a RevenueCat en Apps & providers → New App → Google Play
- Copiar API key de Android

**3.4. Actualizar el código:**
```javascript
// src/services/purchaseService.js línea 14
android: 'goog_TU_API_KEY_AQUI',
```

### 4. Probar compras en TestFlight (iOS)

**4.1. Crear usuarios de Sandbox:**
- App Store Connect → Usuarios y acceso → Sandbox → Testers
- Crear un usuario de prueba con email de prueba

**4.2. Build de la app:**
```bash
npm run build
npx cap sync
npx cap open ios
```

**4.3. En Xcode:**
- Subir a TestFlight
- Invitar testers

**4.4. Probar compra:**
- Abrir app desde TestFlight
- Ir a paso 5 de registro
- Intentar comprar
- Debería aparecer el diálogo nativo de Apple

---

## 🔧 Arquitectura final del sistema de pagos

```
┌─────────────────────────────────────────────┐
│           Usuario en navegador web          │
│              ↓                              │
│         Stripe Checkout                     │
│         (sistema actual)                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         Usuario en app iOS nativa           │
│              ↓                              │
│      Apple In-App Purchase                  │
│              ↓                              │
│          RevenueCat SDK                     │
│              ↓                              │
│      RevenueCat Backend                     │
│              ↓                              │
│    Webhook a tu Edge Function               │
│              ↓                              │
│   Actualiza tabla suscripciones             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│       Usuario en app Android nativa         │
│              ↓                              │
│      Google Play Billing                    │
│              ↓                              │
│          RevenueCat SDK                     │
│              ↓                              │
│      RevenueCat Backend                     │
│              ↓                              │
│    Webhook a tu Edge Function               │
│              ↓                              │
│   Actualiza tabla suscripciones             │
└─────────────────────────────────────────────┘
```

### Ventajas de RevenueCat:

1. **Unifica todo** - Un solo backend para iOS, Android, Web
2. **Cross-platform** - Usuario compra en iOS, usa en Android
3. **Webhooks** - Notifica a tu backend de eventos de suscripción
4. **Analytics** - Dashboard con métricas unificadas
5. **Restaurar compras** - Maneja automáticamente
6. **Trials** - Gestiona períodos de prueba
7. **Cumplimiento** - Apple/Google requieren IAP, RevenueCat lo simplifica

### ¿Por qué no solo Stripe?

**Apple y Google lo prohíben explícitamente:**
- App Store Review Guidelines 3.1.1
- Google Play Developer Policy

Si usas Stripe en apps nativas para contenido digital:
- ❌ Rechazan la app en revisión
- ❌ Suspenden tu cuenta de desarrollador
- ❌ Pueden eliminar la app si lo detectan después

**Stripe solo puede usarse para:**
- ✅ Compras en navegador web
- ✅ Bienes físicos
- ✅ Servicios no digitales

---

## ✅ ESTADO ACTUAL - Test Store funcionando

El sistema de In-App Purchases está **100% funcional** usando Test Store:
- ✅ Compras simuladas funcionan
- ✅ Diálogo nativo de Apple aparece
- ✅ Redirige al gestor correctamente
- ✅ Entitlement `ondeon_premium` se activa

**LIMITACIÓN:** Test Store no muestra precios reales ni pide tarjeta (solo botón "Test valid purchase")

---

## 🔄 Para cambiar a App Store real (cuando esté listo)

### Edita el archivo: `src/services/purchaseService.js`

**Línea 10:**
```javascript
// Cambiar de:
const REVENUECAT_API_KEY = 'test_jdprYCydVqfUlXYMsAHCHWkuQhA';

// A:
const REVENUECAT_API_KEY = 'appl_XjzyPaMTwAAyvXzHQyYmVailow4';
```

**Líneas 109-120:**
```javascript
// Cambiar de:
const productIds = {
  basico: { mensual: 'monthly', anual: 'yearly' },
  pro: { mensual: 'monthly', anual: 'yearly' }
};

// A:
const productIds = {
  basico: { 
    mensual: 'ondeon_basico_mensual', 
    anual: 'ondeon_basico_anual' 
  },
  pro: { 
    mensual: 'ondeon_pro_mensual', 
    anual: 'ondeon_pro_anual' 
  }
};
```

Luego:
```bash
npm run build
npx cap sync
```

---

## 🎯 Próximos pasos inmediatos

### 1. Configurar precios en App Store Connect (5 min)

Para cada producto (`ondeon_basico_anual`, `ondeon_pro_mensual`, `ondeon_pro_anual`):
- Click en el producto
- Precio de suscripción → Añadir precio
- Configurar trial de 7 días
- Guardar

### 2. Crear usuario Sandbox para pruebas (2 min)

1. **App Store Connect** → **Usuarios y acceso** → **Sandbox** → **Testers**
2. Click **"+"** para añadir tester
3. Email: `prueba@ondeon.test` (o similar)
4. Contraseña: Cualquiera (guárdala)
5. País: España
6. **Guardar**

### 3. Configurar iPhone con usuario Sandbox

1. **En el iPhone:** Ajustes → App Store
2. Scroll abajo → **Sandbox Account**
3. Inicia sesión con el usuario que creaste
4. **Importante:** NO uses tu Apple ID real, solo el de Sandbox

### 4. Probar compra con flujo real

- Ejecuta la app desde Xcode
- Ve al paso 5 de registro
- Pulsa "Empezar 7 días gratis"
- **Verás el diálogo REAL de Apple con:**
  - Precio real (€10, €96, €18, o €168)
  - Botón "Subscribe"
  - Touch ID / Face ID
  - Confirmación de suscripción
- **NO SE COBRA** (es Sandbox) pero el flujo es idéntico a producción

---

## 📱 API Keys de RevenueCat

### Para desarrollo (Test Mode):
- **iOS:** `appl_XjzyPaMTwAAyvXzHQyYmVailow4`
- **Android:** Pendiente configurar Google Play
- **Public API (v1):** `sk_FxfdxEpBqaUctdgZSlWEYmHOakqvW`

### IDs importantes:
- **Project ID:** `projbe3868d8`
- **Bundle ID:** `com.ondeon.smart`
- **Entitlement:** `ondeon_premium`
- **Offering:** `default`

---

## 🆘 Troubleshooting

### Error: "No products available"
→ Verifica que los productos tengan precio configurado en App Store Connect

### Error: "Purchase not allowed"
→ Verifica que estés usando una cuenta Sandbox en el dispositivo de pruebas

### Error: "Invalid product identifier"
→ Verifica que los IDs en el código coincidan exactamente con App Store Connect

### La compra no se procesa:
→ Revisa los logs en RevenueCat Dashboard → Customers

---

**Última actualización:** 21 enero 2026
