/**
 * Edge Function: change-password
 * 
 * Cambio de contraseña para usuarios legacy de la tabla usuarios
 * Requiere la contraseña actual para verificar identidad
 * Hashea la nueva contraseña con bcrypt antes de guardarla
 * 
 * Endpoint: /functions/v1/change-password
 * Method: POST
 * Body: { username: string, currentPassword: string, newPassword: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import bcryptjs from 'https://esm.sh/bcryptjs@2.4.3'

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
    const { username, currentPassword, newPassword, skipCurrentPasswordCheck } = await req.json()

    console.log('🔐 Cambio de contraseña solicitado para:', username, { skipCurrentPasswordCheck })

    // Validar campos requeridos
    if (!username || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Username y nueva contraseña son requeridos' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validar que la nueva contraseña tenga al menos 6 caracteres
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validar que la nueva contraseña sea diferente a la actual (solo si se proporciona contraseña actual)
    if (currentPassword && currentPassword === newPassword) {
      return new Response(
        JSON.stringify({ error: 'La nueva contraseña debe ser diferente a la actual' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials')
      return new Response(
        JSON.stringify({ error: 'Error de configuración del servidor' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar usuario en la tabla usuarios
    console.log('🔍 Buscando usuario:', username)
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('username', username)
      .maybeSingle()

    if (usuarioError) {
      console.error('❌ Error buscando usuario:', usuarioError)
      return new Response(
        JSON.stringify({ error: 'Error de autenticación', details: usuarioError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!usuario) {
      console.error('❌ Usuario no encontrado:', username)
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Usuario encontrado:', { id: usuario.id, username: usuario.username })

    // Verificar contraseña actual (solo si se proporciona y no se omite la verificación)
    let passwordValid = true // Por defecto true si se omite la verificación
    
    if (!skipCurrentPasswordCheck && currentPassword) {
      const storedPassword = usuario.password

      if (!storedPassword) {
        console.error('❌ Usuario sin contraseña configurada:', username)
        return new Response(
          JSON.stringify({ error: 'Usuario sin contraseña configurada' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Detectar si la contraseña está hasheada (bcrypt empieza con $2a$, $2b$, $2y$)
      const isHashed = storedPassword.startsWith('$2a$') || 
                       storedPassword.startsWith('$2b$') || 
                       storedPassword.startsWith('$2y$') ||
                       storedPassword.startsWith('$2$')

      console.log('🔐 Verificando contraseña actual:', { 
        isHashed, 
        passwordPrefix: storedPassword.substring(0, 10) 
      })

      if (isHashed) {
        // Verificar contraseña hasheada con bcryptjs
        try {
          console.log('🔐 Comparando contraseña actual con bcryptjs...')
          passwordValid = bcryptjs.compareSync(currentPassword, storedPassword)
          console.log('🔐 Resultado bcryptjs:', passwordValid)
        } catch (bcryptError) {
          console.error('❌ Error verificando hash bcryptjs:', bcryptError)
          return new Response(
            JSON.stringify({ 
              error: 'Error de autenticación', 
              details: bcryptError.message 
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      } else {
        // Compatibilidad temporal: verificar contraseña en texto plano
        console.log('🔐 Comparando texto plano (modo migración)...')
        passwordValid = currentPassword === storedPassword
        console.log('🔐 Resultado texto plano:', passwordValid)
      }

      if (!passwordValid) {
        console.error('❌ Contraseña actual inválida para usuario:', username)
        return new Response(
          JSON.stringify({ error: 'Contraseña actual incorrecta' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    } else if (!skipCurrentPasswordCheck && !currentPassword) {
      // Si no se omite la verificación pero no se proporciona contraseña actual
      return new Response(
        JSON.stringify({ error: 'Debes proporcionar tu contraseña actual o marcar que la olvidaste' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.log('⚠️ Cambio de contraseña sin verificación de contraseña actual (modo recuperación)')
    }

    // Hashear la nueva contraseña
    console.log('🔐 Hasheando nueva contraseña...')
    const hashedNewPassword = bcryptjs.hashSync(newPassword, 10) // cost factor 10

    // Actualizar contraseña en la base de datos
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ password: hashedNewPassword })
      .eq('id', usuario.id)

    if (updateError) {
      console.error('❌ Error actualizando contraseña:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Error al actualizar la contraseña', 
          details: updateError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Contraseña actualizada exitosamente para usuario:', username)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Contraseña actualizada exitosamente' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error en change-password:', error)
    console.error('❌ Stack trace:', error.stack)
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

