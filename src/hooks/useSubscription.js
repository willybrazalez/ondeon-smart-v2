import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import logger from '@/lib/logger'

/**
 * Estados de suscripción posibles
 */
export const SUBSCRIPTION_STATUS = {
  PENDING: 'pending',      // Checkout iniciado pero no completado
  TRIALING: 'trialing',    // En período de prueba (7 días)
  ACTIVE: 'active',        // Pagando activamente
  PAST_DUE: 'past_due',    // Pago fallido, en período de gracia
  CANCELLED: 'cancelled',  // Cancelada o expirada
  NONE: 'none'             // Sin suscripción
}

/**
 * Hook para gestionar el estado de suscripción del usuario
 * Solo aplica para usuarios con rol_id = 2 (Gestores)
 */
export const useSubscription = () => {
  const { user, isLegacyUser, userRole } = useAuth()
  
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar suscripción
  const loadSubscription = useCallback(async () => {
    // Solo cargar para usuarios rol_id = 2 (gestores)
    if (!user || userRole !== 2) {
      setSubscription(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Obtener auth_user_id según tipo de usuario
      let authUserId = null
      
      if (isLegacyUser) {
        // Para usuarios legacy, buscar por id en la tabla usuarios
        const userId = user?.id || user?.usuario_id || user?.user_id
        const { data: userData } = await supabase
          .from('usuarios')
          .select('auth_user_id')
          .eq('id', userId)
          .single()
        
        authUserId = userData?.auth_user_id
      } else {
        // Para usuarios de Supabase Auth
        authUserId = user?.id
      }

      if (!authUserId) {
        logger.dev('⚠️ Usuario sin auth_user_id - probablemente usuario legacy sin suscripción')
        setSubscription(null)
        setLoading(false)
        return
      }

      // Llamar a la función RPC para obtener suscripción
      const { data, error: rpcError } = await supabase
        .rpc('get_subscription_by_auth_user', { p_auth_user_id: authUserId })

      if (rpcError) {
        // Si la función no existe, intentar consulta directa
        logger.warn('⚠️ RPC get_subscription_by_auth_user no disponible, usando consulta directa')
        
        // Obtener usuario_id primero
        const { data: usuarioData } = await supabase
          .from('usuarios')
          .select('id')
          .eq('auth_user_id', authUserId)
          .single()

        if (usuarioData) {
          // Primero buscar suscripciones activas o en trial (prioridad)
          let { data: subData, error: subError } = await supabase
            .from('suscripciones')
            .select('*')
            .eq('usuario_id', usuarioData.id)
            .in('estado', ['active', 'trialing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Si no hay suscripción activa/trialing, buscar la más reciente de cualquier estado
          if (!subData) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('suscripciones')
              .select('*')
              .eq('usuario_id', usuarioData.id)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            
            subData = fallbackData
            subError = fallbackError
          }

          if (subError && subError.code !== 'PGRST116') { // PGRST116 = no rows
            throw subError
          }

          if (subData) {
            // Calcular días restantes de trial
            let diasTrialRestantes = 0
            if (subData.estado === 'trialing' && subData.fecha_fin_trial) {
              const finTrial = new Date(subData.fecha_fin_trial)
              const ahora = new Date()
              diasTrialRestantes = Math.max(0, Math.ceil((finTrial - ahora) / (1000 * 60 * 60 * 24)))
            }

            logger.dev('📊 Suscripción encontrada:', { estado: subData.estado, id: subData.id })
            setSubscription({
              ...subData,
              dias_trial_restantes: diasTrialRestantes
            })
          } else {
            setSubscription(null)
          }
        } else {
          setSubscription(null)
        }
      } else if (data && data.length > 0) {
        setSubscription(data[0])
      } else {
        setSubscription(null)
      }

    } catch (err) {
      logger.error('❌ Error cargando suscripción:', err)
      setError(err.message)
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [user, isLegacyUser, userRole])

  // Cargar al montar y cuando cambie el usuario
  useEffect(() => {
    loadSubscription()
  }, [loadSubscription])

  // Verificar si la suscripción permite acceso completo
  const hasActiveSubscription = useCallback(() => {
    if (!subscription) return false
    return subscription.estado === SUBSCRIPTION_STATUS.TRIALING || 
           subscription.estado === SUBSCRIPTION_STATUS.ACTIVE
  }, [subscription])

  // Verificar si está en trial
  const isInTrial = useCallback(() => {
    return subscription?.estado === SUBSCRIPTION_STATUS.TRIALING
  }, [subscription])

  // Verificar si el pago falló
  const isPaymentFailed = useCallback(() => {
    return subscription?.estado === SUBSCRIPTION_STATUS.PAST_DUE
  }, [subscription])

  // Verificar si está cancelada
  const isCancelled = useCallback(() => {
    return subscription?.estado === SUBSCRIPTION_STATUS.CANCELLED
  }, [subscription])

  // Obtener días restantes de trial
  const getTrialDaysRemaining = useCallback(() => {
    if (!subscription || subscription.estado !== SUBSCRIPTION_STATUS.TRIALING) return 0
    return subscription.dias_trial_restantes || 0
  }, [subscription])

  // Obtener estado legible
  const getStatusLabel = useCallback(() => {
    if (!subscription) return 'Sin suscripción'
    
    switch (subscription.estado) {
      case SUBSCRIPTION_STATUS.TRIALING:
        return `Trial (${getTrialDaysRemaining()} días restantes)`
      case SUBSCRIPTION_STATUS.ACTIVE:
        return 'Activa'
      case SUBSCRIPTION_STATUS.PAST_DUE:
        return 'Pago pendiente'
      case SUBSCRIPTION_STATUS.CANCELLED:
        return 'Cancelada'
      case SUBSCRIPTION_STATUS.PENDING:
        return 'Pendiente de pago'
      default:
        return 'Desconocido'
    }
  }, [subscription, getTrialDaysRemaining])

  // Obtener color del estado para UI
  const getStatusColor = useCallback(() => {
    if (!subscription) return 'gray'
    
    switch (subscription.estado) {
      case SUBSCRIPTION_STATUS.TRIALING:
        return 'blue'
      case SUBSCRIPTION_STATUS.ACTIVE:
        return 'green'
      case SUBSCRIPTION_STATUS.PAST_DUE:
        return 'orange'
      case SUBSCRIPTION_STATUS.CANCELLED:
        return 'red'
      case SUBSCRIPTION_STATUS.PENDING:
        return 'yellow'
      default:
        return 'gray'
    }
  }, [subscription])

  return {
    // Estado
    subscription,
    loading,
    error,
    
    // Verificaciones
    hasActiveSubscription,
    isInTrial,
    isPaymentFailed,
    isCancelled,
    
    // Getters
    getTrialDaysRemaining,
    getStatusLabel,
    getStatusColor,
    
    // Acciones
    refresh: loadSubscription,
    
    // Constantes
    SUBSCRIPTION_STATUS
  }
}

export default useSubscription
