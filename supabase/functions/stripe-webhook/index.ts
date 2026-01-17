/**
 * Edge Function: stripe-webhook
 * 
 * Procesa eventos de Stripe para gestionar suscripciones.
 * 
 * Eventos manejados:
 * - checkout.session.completed: Usuario completó el checkout
 * - customer.subscription.created: Suscripción creada
 * - customer.subscription.updated: Suscripción actualizada (trial→active, etc.)
 * - customer.subscription.deleted: Suscripción cancelada
 * - invoice.payment_succeeded: Pago exitoso
 * - invoice.payment_failed: Pago fallido
 * 
 * Endpoint: /functions/v1/stripe-webhook
 * Method: POST
 * Headers: stripe-signature (requerido)
 * 
 * SEGURIDAD: Verifica la firma del webhook con STRIPE_WEBHOOK_SECRET
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Helper para enviar emails via send-email Edge Function
async function sendEmail(type: string, to: string, data: Record<string, string>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ type, to, data }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error(`Error enviando email ${type}:`, error)
      return false
    }
    
    console.log(`Email ${type} enviado a ${to}`)
    return true
  } catch (error) {
    console.error(`Error enviando email ${type}:`, error)
    return false
  }
}

// Helper para formatear fecha en espanol
function formatDate(date: Date): string {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`
}

serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // Obtener variables de entorno
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeSecretKey || !webhookSecret) {
      console.error('❌ Missing Stripe configuration')
      return new Response(
        JSON.stringify({ error: 'Configuración de webhook no disponible' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inicializar Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Inicializar Supabase con service role
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

    // Obtener firma del webhook
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('❌ No stripe-signature header')
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener body raw para verificar firma
    const body = await req.text()

    // Verificar firma del webhook (usar versión async para Deno)
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: 'Invalid signature', details: err.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📬 Webhook event:', event.type, event.id)

    // Procesar según tipo de evento
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, stripe, session)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(supabase, subscription)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(supabase, stripe, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(supabase, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      default:
        console.log(`⚠️ Evento no manejado: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true, event_type: event.type }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en stripe-webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Maneja checkout.session.completed
 * - Marca registro_pendiente como completado
 * - Crea/actualiza suscripcion en BD
 * - Envia email de bienvenida
 */
async function handleCheckoutCompleted(supabase: any, stripe: Stripe, session: Stripe.Checkout.Session) {
  console.log('Checkout completed:', session.id)
  
  const authUserId = session.metadata?.auth_user_id
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string
  const sessionEmail = session.metadata?.email || session.customer_email
  const sessionNombre = session.metadata?.nombre

  if (!authUserId) {
    console.error('No auth_user_id en metadata del checkout')
    return
  }

  // Obtener detalles de la suscripcion
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Buscar usuario en public.usuarios por auth_user_id
  let { data: usuario, error: userError } = await supabase
    .from('usuarios')
    .select('id, nombre, auth_user_id')
    .eq('auth_user_id', authUserId)
    .single()

  // 🔑 FALLBACK: Si el usuario no existe, crearlo ahora
  // Esto puede pasar si hubo un error en el frontend durante el registro
  if (userError || !usuario) {
    console.log('⚠️ Usuario no encontrado, intentando crear como fallback:', authUserId)
    
    // Obtener email desde auth.users si no tenemos
    let userEmail = sessionEmail
    if (!userEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(authUserId)
      userEmail = authUser?.user?.email
    }
    
    if (!userEmail) {
      console.error('❌ No se pudo obtener email para crear usuario')
      return
    }
    
    // Crear el usuario como fallback
    const { data: newUser, error: createError } = await supabase
      .from('usuarios')
      .insert({
        auth_user_id: authUserId,
        email: userEmail,
        nombre: sessionNombre || userEmail.split('@')[0],
        rol_id: 2, // Gestor
        registro_completo: false, // Se marcará true más abajo
      })
      .select('id, nombre, auth_user_id')
      .single()
    
    if (createError || !newUser) {
      console.error('❌ Error creando usuario como fallback:', createError)
      return
    }
    
    console.log('✅ Usuario creado como fallback:', newUser.id)
    usuario = newUser
  }

  // Obtener email desde auth.users
  const { data: authUser } = await supabase.auth.admin.getUserById(authUserId)
  const userEmail = authUser?.user?.email || session.customer_email

  // Calcular fecha fin de trial
  const trialEnd = subscription.trial_end 
    ? new Date(subscription.trial_end * 1000).toISOString() 
    : null

  const trialEndDate = subscription.trial_end 
    ? new Date(subscription.trial_end * 1000)
    : null

  const precio = ((subscription.items.data[0]?.price?.unit_amount || 0) / 100).toFixed(2)
  const moneda = (subscription.currency || 'eur').toUpperCase()
  const intervalo = subscription.items.data[0]?.price?.recurring?.interval || 'month'

  // Obtener nombre del producto desde Stripe
  let planNombre = 'Ondeón Pro' // default
  const productId = subscription.items.data[0]?.price?.product
  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId as string)
      planNombre = product.name || 'Ondeón Pro'
      console.log('📦 Nombre del producto:', planNombre)
    } catch (e) {
      console.warn('No se pudo obtener el producto:', e)
    }
  }

  // Crear o actualizar suscripcion
  const { error: subError } = await supabase
    .from('suscripciones')
    .upsert({
      usuario_id: usuario.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      estado: subscription.status === 'trialing' ? 'trialing' : 'active',
      fecha_inicio: new Date(subscription.created * 1000).toISOString(),
      fecha_fin_trial: trialEnd,
      fecha_proxima_factura: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString() 
        : null,
      precio_mensual: parseFloat(precio),
      moneda: subscription.currency,
      intervalo_facturacion: intervalo,
      plan_nombre: planNombre,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'usuario_id'
    })

  if (subError) {
    console.error('Error creando suscripcion:', subError)
    return
  }

  // Marcar registro_pendiente como completado
  await supabase
    .from('registros_pendientes')
    .update({ estado: 'completado' })
    .eq('auth_user_id', authUserId)

  // Marcar registro_completo = true en tabla usuarios
  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ registro_completo: true })
    .eq('auth_user_id', authUserId)

  if (updateError) {
    console.error('Error actualizando registro_completo:', updateError)
  } else {
    console.log('registro_completo marcado como TRUE para usuario:', authUserId)
  }

  // Enviar email de bienvenida
  if (userEmail) {
    const userName = usuario.nombre || 'Usuario'
    
    if (subscription.status === 'trialing' && trialEndDate) {
      // Email de inicio de trial
      await sendEmail('trial_started', userEmail, {
        nombre: userName,
        plan_nombre: 'Gestor Pro',
        trial_end_date: formatDate(trialEndDate),
      })
      console.log('Email trial_started enviado a:', userEmail)
    } else {
      // Email de bienvenida general
      const nextBillingDate = subscription.current_period_end 
        ? formatDate(new Date(subscription.current_period_end * 1000))
        : ''
      
      await sendEmail('welcome', userEmail, {
        nombre: userName,
        trial_end_date: trialEndDate ? formatDate(trialEndDate) : nextBillingDate,
        precio: `${precio}${moneda}`,
      })
      console.log('Email welcome enviado a:', userEmail)
    }
  }

  console.log('Suscripcion creada para usuario:', usuario.id)
}

/**
 * Maneja customer.subscription.created
 */
async function handleSubscriptionCreated(supabase: any, subscription: Stripe.Subscription) {
  console.log('📝 Subscription created:', subscription.id)
  // La lógica principal está en handleCheckoutCompleted
}

/**
 * Maneja customer.subscription.updated
 * - Actualiza estado de la suscripción
 * - Actualiza precio, intervalo y nombre del plan
 */
async function handleSubscriptionUpdated(supabase: any, stripe: Stripe, subscription: Stripe.Subscription) {
  console.log('🔄 Subscription updated:', subscription.id, 'Status:', subscription.status)

  // Mapear estado de Stripe a nuestros estados
  let estado: string
  switch (subscription.status) {
    case 'trialing':
      estado = 'trialing'
      break
    case 'active':
      estado = 'active'
      break
    case 'past_due':
      estado = 'past_due'
      break
    case 'canceled':
    case 'unpaid':
      estado = 'cancelled'
      break
    default:
      estado = 'pending'
  }

  // Obtener datos del precio
  const precio = ((subscription.items.data[0]?.price?.unit_amount || 0) / 100).toFixed(2)
  const intervalo = subscription.items.data[0]?.price?.recurring?.interval || 'month'

  // Obtener nombre del producto desde Stripe
  let planNombre: string | undefined
  const productId = subscription.items.data[0]?.price?.product
  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId as string)
      planNombre = product.name
      console.log('📦 Nombre del producto actualizado:', planNombre)
    } catch (e) {
      console.warn('No se pudo obtener el producto:', e)
    }
  }

  // Construir objeto de actualización
  const updateData: any = {
    estado: estado,
    fecha_proxima_factura: subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString() 
      : null,
    cancelado_en: subscription.canceled_at 
      ? new Date(subscription.canceled_at * 1000).toISOString() 
      : null,
    precio_mensual: parseFloat(precio),
    intervalo_facturacion: intervalo,
    updated_at: new Date().toISOString()
  }

  // Solo actualizar plan_nombre si lo obtuvimos
  if (planNombre) {
    updateData.plan_nombre = planNombre
  }

  const { error } = await supabase
    .from('suscripciones')
    .update(updateData)
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('❌ Error actualizando suscripción:', error)
  } else {
    console.log('✅ Suscripción actualizada:', subscription.id, '- Estado:', estado, '- Plan:', planNombre)
  }
}

/**
 * Maneja customer.subscription.deleted
 * - Envia email de cancelacion
 */
async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id)

  // Obtener suscripcion para enviar email
  const { data: suscripcion } = await supabase
    .from('suscripciones')
    .select('usuario_id, fecha_proxima_factura')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  const { error } = await supabase
    .from('suscripciones')
    .update({
      estado: 'cancelled',
      cancelado_en: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('Error marcando suscripcion como cancelada:', error)
  }

  // Enviar email de cancelacion
  if (suscripcion?.usuario_id) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('auth_user_id')
      .eq('id', suscripcion.usuario_id)
      .single()

    if (usuario?.auth_user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(usuario.auth_user_id)
      const userEmail = authUser?.user?.email

      if (userEmail) {
        const accessUntil = suscripcion.fecha_proxima_factura 
          ? formatDate(new Date(suscripcion.fecha_proxima_factura))
          : formatDate(new Date())

        await sendEmail('subscription_cancelled', userEmail, {
          access_until: accessUntil,
        })
        console.log('Email subscription_cancelled enviado a:', userEmail)
      }
    }
  }
}

/**
 * Maneja invoice.payment_succeeded
 * - Registra el pago en historial_pagos
 * - Envia email de confirmacion de pago (solo para renovaciones, no primer pago)
 */
async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  console.log('Payment succeeded:', invoice.id)

  // Obtener suscripcion
  const { data: suscripcion } = await supabase
    .from('suscripciones')
    .select('id, usuario_id, fecha_proxima_factura')
    .eq('stripe_subscription_id', invoice.subscription)
    .single()

  if (!suscripcion) {
    console.log('Suscripcion no encontrada para invoice:', invoice.subscription)
    return
  }

  const amount = ((invoice.amount_paid || 0) / 100).toFixed(2)
  const currency = (invoice.currency || 'eur').toUpperCase()

  // Registrar pago
  const { error } = await supabase
    .from('historial_pagos')
    .insert({
      suscripcion_id: suscripcion.id,
      usuario_id: suscripcion.usuario_id,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: invoice.payment_intent as string,
      monto: parseFloat(amount),
      moneda: invoice.currency,
      estado: 'succeeded',
      descripcion: `Pago de suscripcion - ${invoice.billing_reason}`,
      fecha_pago: new Date((invoice.status_transitions?.paid_at || Date.now() / 1000) * 1000).toISOString()
    })

  if (error) {
    console.error('Error registrando pago:', error)
  }

  // Enviar email solo para renovaciones (no primer pago del trial)
  // billing_reason: 'subscription_cycle' = renovacion, 'subscription_create' = primer pago
  if (invoice.billing_reason === 'subscription_cycle' && suscripcion.usuario_id) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('auth_user_id')
      .eq('id', suscripcion.usuario_id)
      .single()

    if (usuario?.auth_user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(usuario.auth_user_id)
      const userEmail = authUser?.user?.email

      if (userEmail) {
        const nextBillingDate = suscripcion.fecha_proxima_factura
          ? formatDate(new Date(suscripcion.fecha_proxima_factura))
          : ''

        await sendEmail('payment_success', userEmail, {
          amount: `${amount}${currency}`,
          plan_nombre: 'Gestor Pro',
          next_billing_date: nextBillingDate,
        })
        console.log('Email payment_success enviado a:', userEmail)
      }
    }
  }
}

/**
 * Maneja invoice.payment_failed
 * - Marca suscripcion como past_due
 * - Registra intento de pago fallido
 * - Envia email de pago fallido
 */
async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  console.log('Payment failed:', invoice.id)

  // Actualizar estado de suscripcion
  await supabase
    .from('suscripciones')
    .update({
      estado: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', invoice.subscription)

  // Obtener suscripcion para registrar pago fallido
  const { data: suscripcion } = await supabase
    .from('suscripciones')
    .select('id, usuario_id')
    .eq('stripe_subscription_id', invoice.subscription)
    .single()

  const amount = ((invoice.amount_due || 0) / 100).toFixed(2)
  const currency = (invoice.currency || 'eur').toUpperCase()

  if (suscripcion) {
    await supabase
      .from('historial_pagos')
      .insert({
        suscripcion_id: suscripcion.id,
        usuario_id: suscripcion.usuario_id,
        stripe_invoice_id: invoice.id,
        monto: parseFloat(amount),
        moneda: invoice.currency,
        estado: 'failed',
        descripcion: `Pago fallido - ${invoice.billing_reason}`,
        fecha_pago: new Date().toISOString()
      })

    // Enviar email de pago fallido
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('auth_user_id')
      .eq('id', suscripcion.usuario_id)
      .single()

    if (usuario?.auth_user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(usuario.auth_user_id)
      const userEmail = authUser?.user?.email

      if (userEmail) {
        await sendEmail('payment_failed', userEmail, {
          amount: `${amount}${currency}`,
        })
        console.log('Email payment_failed enviado a:', userEmail)
      }
    }
  }
}
