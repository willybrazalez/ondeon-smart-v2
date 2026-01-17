/**
 * Edge Function: cleanup-pendientes
 * 
 * Limpia registros pendientes expirados (usuarios que no completaron el pago).
 * - Elimina usuarios de auth.users
 * - Marca registros como expirados
 * 
 * Debe ejecutarse como cron job (cada hora o diario).
 * 
 * Endpoint: /functions/v1/cleanup-pendientes
 * Method: POST (o GET para cron)
 * Headers: Authorization con service_role key para cron
 * 
 * Para configurar como cron en Supabase:
 * 1. Ir a Database > Extensions > pg_cron
 * 2. Crear job que llame a esta función periódicamente
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // Obtener variables de entorno
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Configuración no disponible' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inicializar Supabase con service role (necesario para eliminar usuarios)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🧹 Iniciando limpieza de registros pendientes expirados...')

    // Buscar registros pendientes expirados
    const { data: registrosExpirados, error: fetchError } = await supabase
      .from('registros_pendientes')
      .select('id, auth_user_id, email')
      .eq('estado', 'pendiente')
      .lt('expira_en', new Date().toISOString())

    if (fetchError) {
      console.error('❌ Error buscando registros expirados:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Error buscando registros', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!registrosExpirados || registrosExpirados.length === 0) {
      console.log('✅ No hay registros pendientes expirados')
      return new Response(
        JSON.stringify({ 
          message: 'No hay registros para limpiar',
          registros_procesados: 0,
          auth_users_eliminados: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Encontrados ${registrosExpirados.length} registros expirados`)

    let authUsersEliminados = 0
    let registrosProcesados = 0
    const errores: string[] = []

    // Procesar cada registro
    for (const registro of registrosExpirados) {
      try {
        console.log(`🔄 Procesando: ${registro.email} (${registro.auth_user_id})`)

        // 1. Eliminar usuario de auth.users
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(
          registro.auth_user_id
        )

        if (deleteAuthError) {
          console.error(`⚠️ Error eliminando auth user ${registro.auth_user_id}:`, deleteAuthError)
          errores.push(`Auth delete failed for ${registro.email}: ${deleteAuthError.message}`)
        } else {
          authUsersEliminados++
          console.log(`✅ Usuario auth eliminado: ${registro.email}`)
        }

        // 2. Eliminar registro de public.usuarios (si existe)
        // El usuario podría haberse creado via trigger
        const { error: deleteUsuarioError } = await supabase
          .from('usuarios')
          .delete()
          .eq('auth_user_id', registro.auth_user_id)

        if (deleteUsuarioError) {
          console.log(`⚠️ No se pudo eliminar de usuarios (puede que no exista):`, deleteUsuarioError.message)
        }

        // 3. Marcar registro pendiente como expirado
        const { error: updateError } = await supabase
          .from('registros_pendientes')
          .update({ estado: 'expirado' })
          .eq('id', registro.id)

        if (updateError) {
          console.error(`⚠️ Error actualizando registro ${registro.id}:`, updateError)
          errores.push(`Update failed for ${registro.email}: ${updateError.message}`)
        } else {
          registrosProcesados++
        }

      } catch (err) {
        console.error(`❌ Error procesando ${registro.email}:`, err)
        errores.push(`Exception for ${registro.email}: ${err.message}`)
      }
    }

    const resultado = {
      message: 'Limpieza completada',
      registros_procesados: registrosProcesados,
      auth_users_eliminados: authUsersEliminados,
      errores: errores.length > 0 ? errores : undefined,
      timestamp: new Date().toISOString()
    }

    console.log('✅ Limpieza completada:', resultado)

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en cleanup-pendientes:', error)
    return new Response(
      JSON.stringify({ error: 'Error en limpieza', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
