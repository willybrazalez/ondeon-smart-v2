# 📧 Configuración de Emails con Resend

## 1. Templates para Supabase Auth

Los correos de **confirmación de email** y **reset de contraseña** se envían automáticamente por Supabase usando Resend (SMTP).

### Configurar en Supabase Dashboard:

1. Ve a **Authentication → Email Templates**

2. **Confirm signup**:
   - Subject: `Confirma tu email - Ondeón`
   - Body: Copia el contenido de `confirmacion-email.html`

3. **Reset password**:
   - Subject: `Restablecer contraseña - Ondeón`
   - Body: Copia el contenido de `reset-password.html`

4. **Magic Link** (opcional):
   - Subject: `Tu enlace de acceso - Ondeón`
   - Puedes adaptar el template de confirmación

---

## 2. Edge Function send-email

Para emails adicionales (bienvenida, notificaciones de suscripción).

### Configurar la API Key de Resend:

```bash
# En Supabase Dashboard → Edge Functions → Secrets
# O via CLI:
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxx
```

### Deploy de la función:

```bash
cd /path/to/frontend-desktop
supabase functions deploy send-email
```

### Uso:

```typescript
// Desde el frontend o otra Edge Function
const response = await fetch('https://nazlyvhndymalevkfpnl.supabase.co/functions/v1/send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <SUPABASE_ANON_KEY>'
  },
  body: JSON.stringify({
    type: 'welcome',  // Tipo de email
    to: 'usuario@ejemplo.com',
    data: {
      nombre: 'Juan',
      trial_end_date: '20 de enero de 2026'
    }
  })
})
```

### Tipos de email disponibles:

| Tipo | Descripción | Datos requeridos |
|------|-------------|------------------|
| `welcome` | Bienvenida | `nombre`, `trial_end_date` |
| `trial_started` | Trial iniciado | `plan_nombre`, `trial_end_date` |
| `trial_ending` | Trial por expirar | `days_remaining`, `precio` |
| `payment_success` | Pago exitoso | `amount`, `plan_nombre`, `next_billing_date`, `invoice_url` |
| `payment_failed` | Pago fallido | `amount` |
| `subscription_cancelled` | Cancelación | `access_until` |

---

## 3. Integrar con Stripe Webhook

Para enviar emails automáticamente cuando ocurren eventos de suscripción, modifica `stripe-webhook/index.ts`:

```typescript
// Después de procesar el evento, enviar email
async function sendEmail(type: string, to: string, data: any) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({ type, to, data })
  })
}

// En checkout.session.completed:
await sendEmail('welcome', email, {
  nombre: metadata.nombre,
  trial_end_date: formatDate(subscription.trial_end)
})

// En invoice.payment_succeeded:
await sendEmail('payment_success', email, {
  amount: formatCurrency(invoice.amount_paid),
  plan_nombre: 'Gestor',
  next_billing_date: formatDate(subscription.current_period_end)
})

// En invoice.payment_failed:
await sendEmail('payment_failed', email, {
  amount: formatCurrency(invoice.amount_due)
})
```

---

## 4. Verificación de dominio

Para que los emails no vayan a spam, asegúrate de que en Resend:

1. El dominio `ondeon.es` está **verificado** ✅
2. Los registros DNS están configurados:
   - SPF ✅
   - DKIM ✅
   - DMARC ✅ (recomendado)

---

## 5. Testing

Para probar los emails sin enviarlos realmente, usa el endpoint de preview:

```bash
curl -X POST https://nazlyvhndymalevkfpnl.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{
    "type": "welcome",
    "to": "tu-email@ejemplo.com",
    "data": {
      "nombre": "Test User",
      "trial_end_date": "20 de enero de 2026"
    }
  }'
```
