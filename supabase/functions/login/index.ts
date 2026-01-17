/**
 * Edge Function: login
 * 
 * Autenticación legacy para usuarios de la tabla usuarios
 * Verifica contraseñas hasheadas con bcrypt
 * 
 * Compatible con:
 * - Contraseñas hasheadas (bcrypt)
 * - Contraseñas en texto plano (durante migración - se hashean automáticamente)
 * 
 * Endpoint: /functions/v1/login
 * Method: POST
 * Body: { username: string, password: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Usar bcryptjs en lugar de bcrypt (compatible con Deno Edge Runtime)
// bcryptjs se importa como namespace, no como named exports
import bcryptjs from 'https://esm.sh/bcryptjs@2.4.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar CORS preflight (debe retornar 200 OK)
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { username, password } = await req.json()

    console.log('🔐 Login attempt:', { username, hasPassword: !!password })

    if (!username || !password) {
      console.error('❌ Missing credentials')
      return new Response(
        JSON.stringify({ error: 'Username y password son requeridos' }),
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
        JSON.stringify({ error: 'Credenciales inválidas' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Usuario encontrado:', { id: usuario.id, username: usuario.username, hasPassword: !!usuario.password })

    // Verificar contraseña
    let passwordValid = false
    const storedPassword = usuario.password

    if (!storedPassword) {
      console.error('❌ Usuario sin contraseña:', username)
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

    console.log('🔐 Verificando contraseña:', { 
      isHashed, 
      passwordPrefix: storedPassword.substring(0, 10) 
    })

    if (isHashed) {
      // Verificar contraseña hasheada con bcryptjs (síncrono)
      try {
        console.log('🔐 Comparando con bcryptjs...')
        // bcryptjs.compareSync es síncrono, no necesita await
        passwordValid = bcryptjs.compareSync(password, storedPassword)
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
      // ⚠️ ADVERTENCIA: Esto es solo durante la migración
      console.log('🔐 Comparando texto plano (modo migración)...')
      passwordValid = password === storedPassword
      console.log('🔐 Resultado texto plano:', passwordValid)
      
      // Si la verificación es exitosa, hashear automáticamente para la próxima vez
      if (passwordValid) {
        try {
          console.log('🔐 Hasheando contraseña automáticamente...')
          // bcryptjs.hashSync es síncrono, no necesita await
          const hashedPassword = bcryptjs.hashSync(password, 10) // cost factor 10
          const { error: updateError } = await supabase
            .from('usuarios')
            .update({ password: hashedPassword })
            .eq('id', usuario.id)
          
          if (updateError) {
            console.error('❌ Error actualizando contraseña:', updateError)
          } else {
            console.log(`✅ Contraseña hasheada automáticamente para usuario: ${username}`)
          }
        } catch (hashError) {
          console.error('❌ Error hasheando contraseña:', hashError)
          // No fallar el login si el hashing falla, solo loguear el error
        }
      }
    }

    if (!passwordValid) {
      console.error('❌ Contraseña inválida para usuario:', username)
      return new Response(
        JSON.stringify({ error: 'Credenciales inválidas' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Login exitoso para usuario:', username)

    // Login exitoso - retornar datos del usuario (sin la contraseña)
    const { password: _, ...userWithoutPassword } = usuario

    return new Response(
      JSON.stringify({ 
        user: userWithoutPassword,
        success: true 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error en login:', error)
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

