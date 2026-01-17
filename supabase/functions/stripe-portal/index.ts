/**
 * Edge Function: stripe-portal
 * 
 * Genera una URL del Stripe Customer Portal para que el usuario
 * pueda gestionar su suscripción (actualizar tarjeta, cancelar, ver facturas).
 * 
 * Endpoint: /functions/v1/stripe-portal
 * Method: POST
 * Body: { auth_user_id, return_url?, flow_type? }
 * 
 * flow_type puede ser:
 * - null/undefined: Portal genérico
 * - 'payment_method_update': Ir directo a actualizar método de pago
 * - 'subscription_cancel': Ir directo a cancelar suscripción
 * - 'subscription_update': Ir directo a cambiar plan
 * 
 * SEGURIDAD: Esta función usa STRIPE_SECRET_KEY que NUNCA se expone al frontend
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    // Obtener variables de entorno
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

    // Inicializar Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Inicializar Supabase
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

    // Obtener datos del request
    const { auth_user_id, return_url, flow_type } = await req.json()

    console.log('🔧 Portal request for auth_user_id:', auth_user_id, 'flow_type:', flow_type)

    if (!auth_user_id) {
      return new Response(
        JSON.stringify({ error: 'auth_user_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id')
      .eq('auth_user_id', auth_user_id)
      .single()

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar suscripción del usuario
    const { data: suscripcion } = await supabase
      .from('suscripciones')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('usuario_id', usuario.id)
      .single()

    if (!suscripcion?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No se encontró suscripción activa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Configurar opciones del portal
    const portalOptions: any = {
      customer: suscripcion.stripe_customer_id,
      return_url: return_url || `${req.headers.get('origin') || 'https://ondeon.es'}/gestor`,
    }

    // Agregar flow_data si se especifica un flujo directo
    if (flow_type && suscripcion.stripe_subscription_id) {
      switch (flow_type) {
        case 'payment_method_update':
          portalOptions.flow_data = {
            type: 'payment_method_update',
          }
          break
        case 'subscription_cancel':
          portalOptions.flow_data = {
            type: 'subscription_cancel',
            subscription_cancel: {
              subscription: suscripcion.stripe_subscription_id,
            },
          }
          break
        case 'subscription_update':
          portalOptions.flow_data = {
            type: 'subscription_update',
            subscription_update: {
              subscription: suscripcion.stripe_subscription_id,
            },
          }
          break
      }
    }

    // Crear sesión del portal
    const portalSession = await stripe.billingPortal.sessions.create(portalOptions)

    console.log('✅ Portal session created:', portalSession.id, 'flow:', flow_type || 'default')

    return new Response(
      JSON.stringify({ portal_url: portalSession.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en stripe-portal:', error)
    return new Response(
      JSON.stringify({ error: 'Error creando sesión del portal', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
