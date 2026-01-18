/**
 * API de Stripe para Frontend
 * 
 * SEGURIDAD:
 * - Este archivo SOLO usa la PUBLISHABLE KEY (pk_live_xxx)
 * - Las operaciones sensibles se hacen via Edge Functions
 * - NUNCA se exponen claves secretas (sk_live_xxx) en frontend
 */

import { loadStripe } from '@stripe/stripe-js'
import logger from './logger'

// Cargar Stripe.js con la publishable key (es pública y segura)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// URL base de las Edge Functions de Supabase
const EDGE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

// Anon key para autenticar las llamadas a Edge Functions
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Price IDs de Stripe (TEST)
export const STRIPE_PRICES = {
  basico: {
    mensual: 'price_1Sojx8P5ynRjXl9TaOrZwRzq',
    anual: 'price_1Sojx8P5ynRjXl9TrpTLcHiu',
    nombre: 'Ondeón Básico',
    precioMensual: 23,
    precioAnual: 216, // €18/mes
  },
  pro: {
    mensual: 'price_1Sojx8P5ynRjXl9TMzFI4Rk5',
    anual: 'price_1Sojx8P5ynRjXl9TvDcxGyqy',
    nombre: 'Ondeón Pro',
    precioMensual: 28,
    precioAnual: 276, // €23/mes
  }
}

/**
 * Headers comunes para llamadas a Edge Functions
 */
const getHeaders = (accessToken = null) => ({
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
})

/**
 * API de Stripe para gestores
 */
export const stripeApi = {
  /**
   * Crear sesión de checkout para suscripción
   * @param {Object} params - Parámetros del checkout
   * @param {string} params.auth_user_id - UUID del usuario en Supabase Auth
   * @param {string} params.email - Email del usuario
   * @param {string} params.nombre - Nombre del usuario
   * @param {string} params.price_id - ID del precio en Stripe
   * @param {string} params.plan_nombre - Nombre del plan (Básico/Pro)
   * @param {string} [params.telefono] - Teléfono (opcional)
   * @param {string} [params.nombre_negocio] - Nombre del negocio (opcional)
   * @param {string} [params.success_url] - URL de redirección tras éxito
   * @param {string} [params.cancel_url] - URL de redirección si cancela
   * @returns {Promise<{checkout_url: string, session_id: string}>}
   */
  async createCheckoutSession({ 
    auth_user_id, 
    email, 
    nombre, 
    price_id,
    plan_nombre,
    telefono, 
    nombre_negocio,
    success_url,
    cancel_url 
  }) {
    try {
      logger.dev('💳 Creando sesión de checkout...', { price_id, plan_nombre })

      const response = await fetch(`${EDGE_FUNCTIONS_URL}/stripe-checkout`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          auth_user_id,
          email,
          nombre,
          price_id,
          plan_nombre,
          telefono,
          nombre_negocio,
          success_url: success_url || `${window.location.origin}/gestor?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancel_url || `${window.location.origin}/registro?cancelled=true`
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creando checkout')
      }

      const data = await response.json()
      logger.dev('✅ Checkout session creada:', data.session_id)

      return data
    } catch (error) {
      logger.error('❌ Error en createCheckoutSession:', error)
      throw error
    }
  },

  /**
   * Redirigir al checkout de Stripe
   * @param {string} checkoutUrl - URL del checkout session
   */
  redirectToCheckout(checkoutUrl) {
    if (!checkoutUrl) return
    window.open(checkoutUrl, '_blank')
  },

  /**
   * Crear sesión de checkout y redirigir automáticamente
   * @param {Object} params - Mismos parámetros que createCheckoutSession
   */
  async startCheckout(params) {
    const { checkout_url } = await this.createCheckoutSession(params)
    this.redirectToCheckout(checkout_url)
  },

  /**
   * Obtener URL del Customer Portal de Stripe
   * @param {string} auth_user_id - UUID del usuario en Supabase Auth
   * @param {string} [return_url] - URL de retorno tras cerrar el portal
   * @param {string} [flow_type] - Tipo de flujo directo (payment_method_update, subscription_cancel, subscription_update)
   * @returns {Promise<{portal_url: string}>}
   */
  async getPortalUrl(auth_user_id, return_url = null, flow_type = null) {
    try {
      logger.dev('🔧 Obteniendo URL del portal...', { flow_type })

      const response = await fetch(`${EDGE_FUNCTIONS_URL}/stripe-portal`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          auth_user_id,
          return_url: return_url || `${window.location.origin}/gestor`,
          flow_type
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error obteniendo portal')
      }

      const data = await response.json()
      logger.dev('✅ Portal URL obtenida')

      return data
    } catch (error) {
      logger.error('❌ Error en getPortalUrl:', error)
      throw error
    }
  },

  /**
   * Abrir el Customer Portal en una nueva pestaña
   * @param {string} auth_user_id - UUID del usuario
   * @param {string} [return_url] - URL de retorno
   * @param {string} [flow_type] - Tipo de flujo directo
   */
  async openPortal(auth_user_id, return_url = null, flow_type = null) {
    const { portal_url } = await this.getPortalUrl(auth_user_id, return_url, flow_type)
    window.open(portal_url, '_blank')
  },

  /**
   * Abrir portal directamente a actualizar método de pago
   */
  async openUpdatePaymentMethod(auth_user_id, return_url = null) {
    return this.openPortal(auth_user_id, return_url, 'payment_method_update')
  },

  /**
   * Abrir portal directamente a cancelar suscripción
   */
  async openCancelSubscription(auth_user_id, return_url = null) {
    return this.openPortal(auth_user_id, return_url, 'subscription_cancel')
  },

  /**
   * Abrir portal directamente a cambiar plan
   */
  async openUpdateSubscription(auth_user_id, return_url = null) {
    return this.openPortal(auth_user_id, return_url, 'subscription_update')
  },

  /**
   * Verificar si el checkout fue exitoso (desde URL params)
   * @returns {boolean}
   */
  wasCheckoutSuccessful() {
    const params = new URLSearchParams(window.location.search)
    return params.has('session_id')
  },

  /**
   * Verificar si el checkout fue cancelado (desde URL params)
   * @returns {boolean}
   */
  wasCheckoutCancelled() {
    const params = new URLSearchParams(window.location.search)
    return params.get('cancelled') === 'true'
  },

  /**
   * Obtener session_id de la URL (tras checkout exitoso)
   * @returns {string|null}
   */
  getSessionIdFromUrl() {
    const params = new URLSearchParams(window.location.search)
    return params.get('session_id')
  },

  /**
   * Obtener instancia de Stripe.js (para uso avanzado)
   * @returns {Promise<Stripe>}
   */
  async getStripe() {
    return await stripePromise
  }
}

export default stripeApi
