/**
 * Edge Function: stripe-checkout
 * 
 * Crea una sesión de Stripe Checkout para suscripción de gestores.
 * - Cobro inmediato (sin trial de Stripe - el trial se gestiona en la app)
 * - Tarjeta obligatoria
 * - Actualiza registros_pendientes
 * 
 * Endpoint: /functions/v1/stripe-checkout
 * Method: POST
 * Body: { auth_user_id, email, nombre, success_url, cancel_url }
 * 
 * SEGURIDAD: Esta función usa STRIPE_SECRET_KEY que NUNCA se expone al frontend
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    // Obtener variables de entorno (SECRETAS - solo disponibles en Edge Functions)
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeSecretKey) {
      console.error('❌ Missing Stripe configuration')
      return new Response(
        JSON.stringify({ error: 'Configuración de Stripe no disponible' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inicializar Stripe con la clave secreta
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Inicializar Supabase con service role (para escribir en BD)
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

    // Obtener datos del request
    const { 
      auth_user_id, 
      email, 
      nombre, 
      price_id, 
      plan_nombre,
      telefono, 
      nombre_negocio, 
      success_url, 
      cancel_url 
    } = await req.json()

    console.log('💳 Stripe Checkout request:', { auth_user_id, email, nombre, price_id, plan_nombre })

    // Validar datos requeridos
    if (!auth_user_id || !email || !price_id) {
      return new Response(
        JSON.stringify({ error: 'auth_user_id, email y price_id son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar que el price_id sea uno de los permitidos
    // 🔧 TEST MODE: Price IDs de Stripe Test
    const allowedPriceIds = [
      // Nuevos precios (Enero 2026)
      'price_1Sr57jP5ynRjXl9Tv4wCtIKc', // Básico mensual €10
      'price_1Sr57tP5ynRjXl9T4gchtSmT', // Básico anual €96
      'price_1Sr583P5ynRjXl9TWcSnhKiD', // Pro mensual €18
      'price_1Sr583P5ynRjXl9Tc2qdU3eL', // Pro anual €168
      // Precios antiguos (mantener temporalmente para suscripciones existentes)
      'price_1Sojx8P5ynRjXl9TaOrZwRzq', // Básico mensual antiguo
      'price_1Sojx8P5ynRjXl9TrpTLcHiu', // Básico anual antiguo
      'price_1Sojx8P5ynRjXl9TMzFI4Rk5', // Pro mensual antiguo
      'price_1Sojx8P5ynRjXl9TvDcxGyqy', // Pro anual antiguo
    ]
    
    if (!allowedPriceIds.includes(price_id)) {
      console.error('❌ Price ID no válido:', price_id)
      return new Response(
        JSON.stringify({ error: 'Plan no válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar si ya existe un customer de Stripe para este usuario
    let stripeCustomerId: string | undefined

    // Buscar customer existente por email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    })

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id
      console.log('✅ Customer existente encontrado:', stripeCustomerId)

      // 🔒 VALIDACIÓN ANTI-DUPLICADOS: Verificar si ya tiene suscripción activa
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'all', // Incluir todas para verificar
        limit: 10
      })

      // Buscar suscripciones activas o en trial
      const activeSubscription = existingSubscriptions.data.find(
        sub => sub.status === 'active' || sub.status === 'trialing'
      )

      if (activeSubscription) {
        console.log('⚠️ Usuario ya tiene suscripción activa:', activeSubscription.id, 'Estado:', activeSubscription.status)
        
        // Retornar error informativo en lugar de crear otra suscripción
        return new Response(
          JSON.stringify({ 
            error: 'Ya tienes una suscripción activa',
            message: 'Ya dispones de una suscripción. Puedes gestionarla desde el panel de usuario.',
            existing_subscription_id: activeSubscription.id,
            status: activeSubscription.status
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar también suscripciones pendientes de pago (past_due)
      const pendingSubscription = existingSubscriptions.data.find(
        sub => sub.status === 'past_due'
      )

      if (pendingSubscription) {
        console.log('⚠️ Usuario tiene suscripción con pago pendiente:', pendingSubscription.id)
        return new Response(
          JSON.stringify({ 
            error: 'Tienes un pago pendiente',
            message: 'Tu suscripción tiene un pago pendiente. Por favor, actualiza tu método de pago desde el panel.',
            existing_subscription_id: pendingSubscription.id,
            status: 'past_due'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ No hay suscripciones activas, continuando con checkout...')
    } else {
      // Crear nuevo customer en Stripe
      const customer = await stripe.customers.create({
        email: email,
        name: nombre || email.split('@')[0],
        metadata: {
          auth_user_id: auth_user_id,
          telefono: telefono || '',
          nombre_negocio: nombre_negocio || ''
        }
      })
      stripeCustomerId = customer.id
      console.log('✅ Nuevo customer creado:', stripeCustomerId)
    }

    // URLs por defecto si no se proporcionan
    const defaultSuccessUrl = `${req.headers.get('origin') || 'https://ondeon.es'}/descarga?session_id={CHECKOUT_SESSION_ID}`
    const defaultCancelUrl = `${req.headers.get('origin') || 'https://ondeon.es'}/registro?cancelled=true`

    // Crear sesión de Checkout (cobro inmediato, sin trial de Stripe)
    // El trial se gestiona en el frontend de la app
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_collection: 'always', // Tarjeta obligatoria
      line_items: [
        {
          price: price_id, // Price ID dinámico del frontend
          quantity: 1,
        },
      ],
      subscription_data: {
        // Sin trial_period_days - cobro inmediato
        // El trial de la app se gestiona independientemente en el frontend
        metadata: {
          auth_user_id: auth_user_id,
          plan_nombre: plan_nombre || 'Plan Gestor'
        }
      },
      success_url: success_url || defaultSuccessUrl,
      cancel_url: cancel_url || defaultCancelUrl,
      metadata: {
        auth_user_id: auth_user_id,
        email: email,
        nombre: nombre || '',
        plan_nombre: plan_nombre || 'Plan Gestor'
      },
      // Configuración adicional
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      locale: 'es', // Español
    })

    console.log('✅ Checkout session creada:', session.id)

    // Guardar en registros_pendientes
    const { error: insertError } = await supabase
      .from('registros_pendientes')
      .upsert({
        auth_user_id: auth_user_id,
        email: email,
        nombre: nombre,
        telefono: telefono,
        nombre_negocio: nombre_negocio,
        metodo_auth: 'email', // Se puede mejorar para detectar OAuth
        stripe_checkout_session_id: session.id,
        estado: 'pendiente',
        expira_en: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
      }, {
        onConflict: 'auth_user_id'
      })

    if (insertError) {
      console.error('⚠️ Error guardando registro pendiente:', insertError)
      // No fallar el checkout por esto
    }

    // Retornar URL del checkout (el frontend redirige aquí)
    return new Response(
      JSON.stringify({ 
        checkout_url: session.url,
        session_id: session.id,
        customer_id: stripeCustomerId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error en stripe-checkout:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error creando sesión de checkout',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
