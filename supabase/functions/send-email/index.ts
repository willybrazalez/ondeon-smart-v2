import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'Ondeon <hola@ondeon.es>'

const COLORS = {
  primary: '#7eb8da',
  primaryLight: '#a8d0e6',
  accent: '#A2D9F7',
  background: '#0f1219',
  cardBg: '#1a1e26',
  textWhite: '#ffffff',
  textGray: '#9ca3af',
  textMuted: '#6b7280',
  textDark: '#4b5563',
  warning: '#fbbf24',
  error: '#ef4444',
  success: '#22c55e',
}

const baseTemplate = (content: string, preheader: string = '') => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ondeon</title>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Quicksand', 'Segoe UI', sans-serif; background-color: ${COLORS.background};">
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>
  
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table role="presentation" style="max-width: 420px; width: 100%; border-collapse: collapse;">
          
          <tr>
            <td align="center" style="padding-bottom: 40px;">
              <img src="https://main.dnpo8nagdov1i.amplifyapp.com/assets/icono-ondeon.png" alt="Ondeon" width="56" height="56" style="display: block;">
            </td>
          </tr>
          
          <tr>
            <td style="background-color: ${COLORS.cardBg}; border-radius: 20px; padding: 48px 36px; border: 1px solid rgba(162, 217, 247, 0.1);">
              ${content}
            </td>
          </tr>
          
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${COLORS.textMuted};">
                Dudas? <a href="mailto:hola@ondeon.es" style="color: ${COLORS.accent}; text-decoration: none;">hola@ondeon.es</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: ${COLORS.textDark};">2026 Ondeon</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

const button = (text: string, url: string) => `
<table role="presentation" style="width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 8px 0;">
      <a href="${url}" 
         style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%); color: #1a1e26; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 12px; letter-spacing: 0.2px;">
        ${text}
      </a>
    </td>
  </tr>
</table>
`

const divider = () => `<div style="height: 1px; background: rgba(255,255,255,0.08); margin: 28px 0;"></div>`

const infoBox = (text: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') => {
  const colors = {
    info: { bg: 'rgba(162, 217, 247, 0.08)', border: 'rgba(162, 217, 247, 0.2)', text: COLORS.accent },
    warning: { bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.2)', text: COLORS.warning },
    success: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: COLORS.success },
    error: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: COLORS.error },
  }
  const c = colors[type]
  return `<div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 10px; padding: 14px 16px; margin: 20px 0;">
    <p style="margin: 0; font-size: 13px; color: ${c.text}; text-align: center;">${text}</p>
  </div>`
}

const templates: Record<string, (data: any) => { subject: string; html: string }> = {
  
  welcome: (data) => ({
    subject: 'Bienvenido a Ondeon',
    html: baseTemplate(`
      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${COLORS.textWhite}; text-align: center; letter-spacing: -0.3px;">
        Bienvenido, ${data.nombre || 'Usuario'}
      </h1>
      
      <p style="margin: 0 0 28px 0; font-size: 15px; color: ${COLORS.textGray}; text-align: center; line-height: 1.6;">
        Tu cuenta esta lista. Ya puedes disfrutar de musica profesional en tu negocio.
      </p>
      
      ${infoBox(`<strong style="font-size: 18px;">7 dias gratis</strong><br><span style="font-size: 12px; opacity: 0.8;">Finaliza el ${data.trial_end_date || 'proximamente'}</span>`, 'info')}
      
      ${button('Descargar app', 'https://main.dnpo8nagdov1i.amplifyapp.com/download')}
      
      ${divider()}
      
      <p style="margin: 0; font-size: 13px; color: ${COLORS.textMuted}; text-align: center;">
        Despues del trial: ${data.precio || '28EUR'}/mes
      </p>
    `, 'Tu cuenta esta lista. Descarga la app y empieza tu prueba de 7 dias.')
  }),
  
  trial_started: (data) => ({
    subject: 'Tu prueba gratuita ha comenzado',
    html: baseTemplate(`
      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${COLORS.textWhite}; text-align: center; letter-spacing: -0.3px;">
        Tu prueba ha comenzado
      </h1>
      
      <p style="margin: 0 0 28px 0; font-size: 15px; color: ${COLORS.textGray}; text-align: center; line-height: 1.6;">
        Tienes acceso completo durante 7 dias
      </p>
      
      <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0;"><span style="color: ${COLORS.textGray}; font-size: 14px;">Plan</span></td>
            <td style="padding: 6px 0; text-align: right;"><span style="color: ${COLORS.textWhite}; font-size: 14px; font-weight: 600;">${data.plan_nombre || 'Gestor'}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0;"><span style="color: ${COLORS.textGray}; font-size: 14px;">Finaliza</span></td>
            <td style="padding: 6px 0; text-align: right;"><span style="color: ${COLORS.accent}; font-size: 14px; font-weight: 600;">${data.trial_end_date || '7 dias'}</span></td>
          </tr>
        </table>
      </div>
      
      ${button('Ir a Ondeon', 'https://main.dnpo8nagdov1i.amplifyapp.com')}
    `, 'Tu periodo de prueba de 7 dias ha comenzado.')
  }),
  
  trial_ending: (data) => ({
    subject: `Tu prueba termina en ${data.days_remaining || '2'} dias`,
    html: baseTemplate(`
      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${COLORS.textWhite}; text-align: center; letter-spacing: -0.3px;">
        Tu prueba termina pronto
      </h1>
      
      <p style="margin: 0 0 28px 0; font-size: 15px; color: ${COLORS.textGray}; text-align: center; line-height: 1.6;">
        Quedan <strong style="color: ${COLORS.warning};">${data.days_remaining || '2'} dias</strong> de tu periodo gratuito
      </p>
      
      ${infoBox('Asegurate de tener un metodo de pago valido para continuar sin interrupciones.', 'warning')}
      
      ${button('Gestionar suscripcion', 'https://main.dnpo8nagdov1i.amplifyapp.com/gestor')}
      
      ${divider()}
      
      <p style="margin: 0; font-size: 13px; color: ${COLORS.textMuted}; text-align: center;">
        Despues del trial: <strong style="color: ${COLORS.textWhite};">${data.precio || '28EUR'}/mes</strong>
      </p>
    `, `Quedan ${data.days_remaining || '2'} dias de tu prueba gratuita.`)
  }),
  
  payment_success: (data) => ({
    subject: 'Pago recibido',
    html: baseTemplate(`
      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${COLORS.textWhite}; text-align: center; letter-spacing: -0.3px;">
        Pago recibido
      </h1>
      
      <p style="margin: 0 0 28px 0; font-size: 15px; color: ${COLORS.textGray}; text-align: center; line-height: 1.6;">
        Gracias por confiar en Ondeon
      </p>
      
      <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0;"><span style="color: ${COLORS.textGray}; font-size: 14px;">Importe</span></td>
            <td style="padding: 6px 0; text-align: right;"><span style="color: ${COLORS.success}; font-size: 18px; font-weight: 700;">${data.amount || '28,00EUR'}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0;"><span style="color: ${COLORS.textGray}; font-size: 14px;">Plan</span></td>
            <td style="padding: 6px 0; text-align: right;"><span style="color: ${COLORS.textWhite}; font-size: 14px;">${data.plan_nombre || 'Gestor'}</span></td>
          </tr>
          <tr>
            <td style="padding: 6px 0;"><span style="color: ${COLORS.textGray}; font-size: 14px;">Proxima factura</span></td>
            <td style="padding: 6px 0; text-align: right;"><span style="color: ${COLORS.textWhite}; font-size: 14px;">${data.next_billing_date || 'En 30 dias'}</span></td>
          </tr>
        </table>
      </div>
      
      ${button('Ver detalles', data.invoice_url || 'https://main.dnpo8nagdov1i.amplifyapp.com/gestor')}
    `, `Pago de ${data.amount || '28,00EUR'} recibido.`)
  }),
  
  payment_failed: (data) => ({
    subject: 'Problema con tu pago',
    html: baseTemplate(`
      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${COLORS.textWhite}; text-align: center; letter-spacing: -0.3px;">
        Problema con tu pago
      </h1>
      
      <p style="margin: 0 0 28px 0; font-size: 15px; color: ${COLORS.textGray}; text-align: center; line-height: 1.6;">
        No pudimos procesar el pago de <strong style="color: ${COLORS.textWhite};">${data.amount || '28,00EUR'}</strong>
      </p>
      
      ${infoBox('Actualiza tu metodo de pago para evitar la interrupcion del servicio.', 'error')}
      
      ${button('Actualizar pago', 'https://main.dnpo8nagdov1i.amplifyapp.com/gestor')}
      
      ${divider()}
      
      <p style="margin: 0; font-size: 12px; color: ${COLORS.textMuted}; text-align: center;">
        Reintentaremos el cobro en 24-48 horas
      </p>
    `, 'No pudimos procesar tu pago. Actualiza tu metodo de pago.')
  }),
  
  subscription_cancelled: (data) => ({
    subject: 'Suscripcion cancelada',
    html: baseTemplate(`
      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${COLORS.textWhite}; text-align: center; letter-spacing: -0.3px;">
        Suscripcion cancelada
      </h1>
      
      <p style="margin: 0 0 28px 0; font-size: 15px; color: ${COLORS.textGray}; text-align: center; line-height: 1.6;">
        Lamentamos verte partir
      </p>
      
      ${infoBox(`Tu acceso continua hasta el <strong>${data.access_until || 'fin del periodo actual'}</strong>`, 'info')}
      
      ${button('Reactivar', 'https://main.dnpo8nagdov1i.amplifyapp.com/registro')}
      
      ${divider()}
      
      <p style="margin: 0; font-size: 12px; color: ${COLORS.textMuted}; text-align: center;">
        Fue un error? <a href="mailto:hola@ondeon.es" style="color: ${COLORS.accent}; text-decoration: none;">Contactanos</a>
      </p>
    `, 'Tu suscripcion ha sido cancelada.')
  }),
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no configurada')
    }

    const { type, to, data } = await req.json()

    console.log('Enviando email:', { type, to })

    if (!templates[type]) {
      throw new Error(`Tipo de email no valido: ${type}. Tipos validos: ${Object.keys(templates).join(', ')}`)
    }

    const { subject, html } = templates[type](data || {})

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Error de Resend:', result)
      throw new Error(result.message || 'Error enviando email')
    }

    console.log('Email enviado:', result.id)

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
