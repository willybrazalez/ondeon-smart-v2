/**
 * Edge Function: generate-ad
 * 
 * Genera anuncios profesionales con IA en dos modos:
 * 
 * MODO 1 - Solo texto (mode: 'text'):
 *   - Genera texto del anuncio con OpenAI GPT-4
 *   - No genera audio ni sube nada a S3
 * 
 * MODO 2 - Solo audio (mode: 'audio'):
 *   - Recibe texto ya generado
 *   - Convierte texto a audio con ElevenLabs TTS
 *   - (Opcional) Mezcla audio con música de fondo
 *   - Sube audio FINAL a AWS S3 mediante Lambda
 * 
 * MODO 3 - Listar voces (mode: 'list-voices'):
 *   - Obtiene las voces disponibles de ElevenLabs
 * 
 * Variables de entorno requeridas:
 * - OPENAI_API_KEY
 * - ELEVENLABS_API_KEY
 * - ONDEON_LAMBDA_S3_URL (URL de la función Lambda para S3)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Configurar CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Manejar OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { mode = 'text' } = body
    
    console.log(`🚀 Modo: ${mode}`)

    // MODO: LISTAR VOCES DE ELEVENLABS
    if (mode === 'list-voices') {
      console.log('🎤 Obteniendo voces de ElevenLabs...')
      
      const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
      if (!elevenlabsApiKey) {
        throw new Error('ELEVENLABS_API_KEY no configurada')
      }

      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': elevenlabsApiKey,
        }
      })

      if (!voicesResponse.ok) {
        const errorData = await voicesResponse.text()
        console.error('❌ Error de ElevenLabs:', errorData)
        throw new Error(`ElevenLabs API error: ${voicesResponse.status}`)
      }

      const voicesData = await voicesResponse.json()
      
      return new Response(
        JSON.stringify({
          success: true,
          voices: voicesData.voices
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // MODO: GENERAR SOLO TEXTO
    if (mode === 'text') {
      console.log('📝 Generando solo texto...')
      
      const { 
        idea, 
        targetAudience = 'general',
        empresaNombre,
        duration = 30
      } = body

      console.log('📝 Parámetros recibidos:', {
        idea: idea?.substring(0, 50) + '...',
        empresaNombre,
        duration
      })

      // Validaciones
      if (!idea || !empresaNombre) {
        throw new Error('Faltan parámetros requeridos: idea y empresaNombre')
      }

      // GENERAR TEXTO CON OPENAI GPT-4
      console.log('🤖 Generando texto con GPT-4...')
      
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY no configurada')
      }

      const prompt = `CONTEXT AND ROLE:
You are an expert copywriter specialized in audiomarketing, in-store radio, and corporate radio. You create creative, original, and distinctive advertising messages for point-of-sale broadcasts.

IMPORTANT: The listener is ALREADY inside the establishment at this moment, so the message must invite immediate consumption.

AD INFORMATION:
- Company/Brand: ${empresaNombre}
- Ad idea: ${idea}
- Target audience: ${targetAudience}
- Target duration: ${duration} seconds (maximum ${Math.floor(duration * 2.5)} words)

CRITICAL INSTRUCTIONS:
1. **LANGUAGE DETECTION**: You MUST respond in the EXACT SAME LANGUAGE as the user's idea ("${idea}"). 
   - If the idea is in Spanish, respond in Spanish
   - If the idea is in English, respond in English
   - If the idea is in any other language, respond in that language
2. You MUST naturally include the brand "${empresaNombre}" in the copy
3. Include the word "Here" (or its equivalent: "Aquí" in Spanish, "Hier" in German, etc.) when it makes sense
4. The message must be ORIGINAL, FRIENDLY, and convey TRUST
5. Tone: Warm, close, persuasive, and action-oriented for immediate consumption
6. The listener should feel invited to consume RIGHT NOW
7. Create a memorable, clear, and direct message

RESPONSE FORMAT:
Only provide the ad text, without titles, introductions, or additional explanations. The text must be ready to be read by an ElevenLabs voice.

FINAL VERIFICATION:
Before responding, make sure that:
✓ You respond in the SAME LANGUAGE as the user's idea
✓ You include the brand "${empresaNombre}"
✓ You use "Here" (or equivalent) when natural
✓ The message is original and friendly
✓ It invites immediate consumption
✓ It can be read in ${duration} seconds

AD TEXT:`

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 250,
          temperature: 0.8,
          presence_penalty: 0.2,
          frequency_penalty: 0.3
        })
      })

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.text()
        console.error('❌ Error de OpenAI:', errorData)
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData}`)
      }

      const openaiData = await openaiResponse.json()
      let textoGenerado = openaiData.choices[0].message.content.trim()
      
      console.log('✅ Texto inicial generado:', textoGenerado.substring(0, 100) + '...')

      // SEGUNDO PROMPT: Optimizar formato para TTS (invisible para el usuario)
      console.log('🔧 Aplicando optimización de formato TTS...')
      
      const formatPrompt = `You are an expert in optimizing texts for Text-To-Speech (TTS).

Your task is to improve the following advertising text so it reads correctly with a synthetic voice, applying these rules:

STRICT FORMATTING RULES:

CURRENCIES (apply based on language):
- If "€" appears → write "euro" or "euros" (Spanish: "euro"/"euros", English: "euro"/"euros")
- If "$" appears → write "dollar" or "dollars" (Spanish: "dólar"/"dólares", English: "dollar"/"dollars")
- If "£" appears → write "pound" or "pounds" (Spanish: "libra"/"libras", English: "pound"/"pounds")
- Currency values: adapt to language (Spanish: 4,5 → "4 con 50", English: 4.5 → "4 point 5" or "4 dollars and 50 cents")

TIME FORMATS (adapt to language):
For Spanish:
- 10pm or 22:00 → "diez de la noche"
- 10am or 10:00 → "diez de la mañana"
- 14h or 14:00 → "dos de la tarde"
- Use natural format: "de la mañana", "de la tarde", "de la noche"

For English:
- 10pm or 22:00 → "ten p m" or "ten in the evening"
- 10am or 10:00 → "ten a m" or "ten in the morning"
- 2pm or 14:00 → "two p m" or "two in the afternoon"
- Use natural format: "in the morning", "in the afternoon", "in the evening"

OTHER:
- NO asterisks, NO unnecessary CAPITALS, NO emojis
- Natural and conversational language
- Optimized for TTS pronunciation

CRITICAL:
- DO NOT change the content or message of the text
- DO NOT add or remove information
- ONLY apply the formatting rules above
- Keep the SAME LANGUAGE as the original text
- Return ONLY the optimized text, no explanations

ORIGINAL TEXT:
${textoGenerado}

OPTIMIZED TEXT:`

      const formatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: formatPrompt
          }],
          max_tokens: 300,
          temperature: 0.3, // Menor temperatura para ser más preciso
          presence_penalty: 0,
          frequency_penalty: 0
        })
      })

      if (!formatResponse.ok) {
        console.warn('⚠️ Error en optimización de formato, usando texto original')
        // Si falla el segundo prompt, continuar con el texto original
      } else {
        const formatData = await formatResponse.json()
        textoGenerado = formatData.choices[0].message.content.trim()
        console.log('✅ Texto optimizado para TTS:', textoGenerado.substring(0, 100) + '...')
      }

      // Retornar solo el texto, SIN generar audio
      return new Response(
        JSON.stringify({
          success: true,
          texto: textoGenerado,
          model: 'gpt-4',
          metadata: {
            duration,
            empresaNombre,
            targetAudience,
            generatedAt: new Date().toISOString()
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // MODO: GENERAR SOLO AUDIO
    if (mode === 'audio') {
      console.log('🎤 Generando solo audio...')
      
      const { 
        texto,
        voiceId,
        backgroundMusicId = null,
        backgroundMusicUrl = null,
        musicVolume = 0.15
      } = body

      console.log('🎤 Parámetros recibidos:', {
        textoLength: texto?.length,
        voiceId,
        conMusica: !!backgroundMusicId
      })

      // Validaciones
      if (!texto || !voiceId) {
        throw new Error('Faltan parámetros requeridos: texto y voiceId')
      }

      // GENERAR AUDIO CON ELEVENLABS
      console.log('🎤 Generando audio con ElevenLabs...')
      
      const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
      if (!elevenlabsApiKey) {
        throw new Error('ELEVENLABS_API_KEY no configurada')
      }
      
      const audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenlabsApiKey,
          },
          body: JSON.stringify({
            text: texto,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true
            }
          }),
        }
      )

      if (!audioResponse.ok) {
        const errorData = await audioResponse.text()
        console.error('❌ Error de ElevenLabs:', errorData)
        throw new Error(`ElevenLabs API error: ${audioResponse.status} - ${errorData}`)
      }

      const audioBlob = await audioResponse.arrayBuffer()
      console.log('✅ Audio generado, tamaño:', audioBlob.byteLength, 'bytes')

      // TODO: MEZCLAR CON MÚSICA DE FONDO (Implementar en Fase 3)
      // Por ahora, el audio final es solo la voz
      let finalAudioBlob = audioBlob
      let hasBackgroundMusic = false

      if (backgroundMusicId && backgroundMusicUrl) {
        console.log('ℹ️ Música de fondo solicitada, pero mezcla no implementada aún')
        // En Fase 3: implementar mezcla con FFmpeg
        hasBackgroundMusic = false
      }

      // SUBIR AUDIO FINAL A AWS S3 MEDIANTE LAMBDA
      console.log('☁️ Subiendo audio FINAL a AWS S3 mediante Lambda...')
      
      const lambdaUrl = Deno.env.get('ONDEON_LAMBDA_S3_URL')
      const s3Bucket = 'musicaondeon'
      const awsRegion = 'eu-north-1'
      
      if (!lambdaUrl) {
        throw new Error('ONDEON_LAMBDA_S3_URL no configurada')
      }

      const fileName = `contenidos/ads/ad-${crypto.randomUUID()}.mp3`
      
      // PASO 1: Obtener URL prefirmada de Lambda
      console.log('📝 Paso 1: Obteniendo URL prefirmada de Lambda...')
      const lambdaResponse = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileName,
          fileType: 'audio/mpeg'
        })
      })

      if (!lambdaResponse.ok) {
        const errorText = await lambdaResponse.text()
        console.error('❌ Error obteniendo URL prefirmada:', errorText)
        throw new Error(`Lambda error: ${lambdaResponse.status} - ${errorText}`)
      }

      const { signedUrl } = await lambdaResponse.json()
      console.log('✅ URL prefirmada obtenida')

      // PASO 2: Subir archivo a S3 usando URL prefirmada
      console.log('📤 Paso 2: Subiendo archivo a S3...')
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: finalAudioBlob,
        headers: { 
          'Content-Type': 'audio/mpeg'
        }
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('❌ Error subiendo a S3:', errorText)
        throw new Error(`S3 upload failed: ${uploadResponse.status} - ${errorText}`)
      }

      const publicUrl = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${fileName}`
      console.log('✅ Audio FINAL subido exitosamente:', publicUrl)

      // RESPUESTA EXITOSA CON AUDIO
      return new Response(
        JSON.stringify({
          success: true,
          audioUrl: publicUrl,
          voiceId,
          hasBackgroundMusic,
          backgroundMusicId: hasBackgroundMusic ? backgroundMusicId : null,
          metadata: {
            generatedAt: new Date().toISOString(),
            audioSize: audioBlob.byteLength
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // MODO: GENERAR AUDIO PREVIEW (devuelve base64, NO sube a S3)
    if (mode === 'audio-preview') {
      console.log('🎤 Generando preview de audio (sin subir a S3)...')
      
      const { 
        texto,
        voiceId,
        voiceSettings
      } = body

      console.log('🎤 Parámetros recibidos:', {
        textoLength: texto?.length,
        voiceId,
        voiceSettings
      })

      // Validaciones
      if (!texto || !voiceId) {
        throw new Error('Faltan parámetros requeridos: texto y voiceId')
      }

      // Configuraciones individuales de cada voz (hardcodeadas)
      const VOICE_CONFIGS: Record<string, any> = {
        'fRDnLmEYnsOOldlrmhg5': { // Guillermo (Dinámica)
          speed: 1.00,
          stability: 0.30,
          similarity: 0.50,
          style: 0.0  // No especificado en el nuevo CSV
        },
        '4XB9B4QMeOzSMctqzMZb': { // Begoña
          speed: 1.11,
          stability: 0.30,
          similarity: 0.20,
          style: 0.0
        },
        'aEkhnfGzn6pyq6uZfs3O': { // Pablo
          speed: 1.00,
          stability: 0.31,
          similarity: 0.01,
          style: 0.0
        },
        'BXtvkfRgOYGPQKVRgufE': { // Maite
          speed: 1.05,
          stability: 0.39,
          similarity: 0.0,
          style: 0.0
        },
        'LwzHYaKvQlWNZWOmVAWy': { // Eva
          speed: 1.04,
          stability: 0.40,
          similarity: 0.10,
          style: 0.0
        },
        'jq4oWAZkNWlzc4Oyj4KK': { // Pepón
          speed: 1.05,
          stability: 0.35,
          similarity: 0.10,
          style: 0.0
        },
        'SF7YwxoUtCja63SMKTim': { // Lolo
          speed: 1.00,
          stability: 0.50,
          similarity: 0.17,
          style: 0.0
        },
        'AjUAlEekKaRSqXq4JsM0': { // María
          speed: 1.09,
          stability: 0.93,
          similarity: 0.88,
          style: 0.0
        }
      }

      // Usar configuración específica de la voz, o la enviada desde frontend, o defaults como último recurso
      const settings = voiceSettings || VOICE_CONFIGS[voiceId] || {
        stability: 1.0,
        similarity: 1.0,
        style: 0.5,
        speed: 1.0
      }

      // GENERAR AUDIO CON ELEVENLABS
      console.log('🎤 Generando audio con ElevenLabs con settings personalizados:', settings)
      console.log('🎙️  Voice ID:', voiceId)
      
      const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
      if (!elevenlabsApiKey) {
        throw new Error('ELEVENLABS_API_KEY no configurada')
      }

      // Preparar configuración completa de voz con todos los parámetros individuales
      const requestBody: any = {
        text: texto,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: settings.stability || 1.0,
          similarity_boost: settings.similarity || 1.0,
          style: settings.style || 0.5,
          use_speaker_boost: true,
          speed: settings.speed || 1.0  // Rango permitido: 0.7 - 1.2
        }
      }

      console.log('📤 Request body para ElevenLabs:', JSON.stringify(requestBody, null, 2))
      
      const audioResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenlabsApiKey,
          },
          body: JSON.stringify(requestBody),
        }
      )

      if (!audioResponse.ok) {
        const errorData = await audioResponse.text()
        console.error('❌ Error de ElevenLabs:', errorData)
        throw new Error(`ElevenLabs API error: ${audioResponse.status} - ${errorData}`)
      }

      const audioBuffer = await audioResponse.arrayBuffer()
      console.log('✅ Audio generado, tamaño:', audioBuffer.byteLength, 'bytes')

      // Convertir a base64 (procesando byte por byte para evitar call stack overflow)
      console.log('🔄 Convirtiendo audio a base64...')
      let base64Audio = ''
      try {
        const uint8Array = new Uint8Array(audioBuffer)
        let binary = ''
        
        // Procesar byte por byte (más lento pero seguro)
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i])
        }
        
        base64Audio = btoa(binary)
        console.log('✅ Conversión a base64 completada, tamaño:', base64Audio.length, 'caracteres')
      } catch (error) {
        console.error('❌ Error convirtiendo a base64:', error)
        throw new Error(`Error convirtiendo audio a base64: ${error.message}`)
      }

      // RESPUESTA CON AUDIO EN BASE64 (temporal)
      return new Response(
        JSON.stringify({
          success: true,
          audioBase64: base64Audio,
          metadata: {
            generatedAt: new Date().toISOString(),
            audioSize: audioBuffer.byteLength
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // MODO: GUARDAR AUDIO EN S3 (recibe base64)
    if (mode === 'save-audio') {
      console.log('☁️ Guardando audio en S3...')
      
      const { audioBase64 } = body

      if (!audioBase64) {
        throw new Error('Falta parámetro requerido: audioBase64')
      }

      // Convertir base64 a ArrayBuffer
      const binaryString = atob(audioBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const audioBuffer = bytes.buffer

      console.log('📦 Audio recibido, tamaño:', audioBuffer.byteLength, 'bytes')

      // SUBIR A AWS S3 MEDIANTE LAMBDA
      const lambdaUrl = Deno.env.get('ONDEON_LAMBDA_S3_URL')
      const s3Bucket = 'musicaondeon'
      const awsRegion = 'eu-north-1'
      
      if (!lambdaUrl) {
        throw new Error('ONDEON_LAMBDA_S3_URL no configurada')
      }

      const fileName = `contenidos/ads/ad-${crypto.randomUUID()}.mp3`
      
      // PASO 1: Obtener URL prefirmada de Lambda
      console.log('📝 Paso 1: Obteniendo URL prefirmada de Lambda...')
      const lambdaResponse = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileName,
          fileType: 'audio/mpeg'
        })
      })

      if (!lambdaResponse.ok) {
        const errorText = await lambdaResponse.text()
        console.error('❌ Error obteniendo URL prefirmada:', errorText)
        throw new Error(`Lambda error: ${lambdaResponse.status} - ${errorText}`)
      }

      const { signedUrl } = await lambdaResponse.json()
      console.log('✅ URL prefirmada obtenida')

      // PASO 2: Subir archivo a S3 usando URL prefirmada
      console.log('📤 Paso 2: Subiendo archivo a S3...')
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: audioBuffer,
        headers: { 
          'Content-Type': 'audio/mpeg'
        }
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('❌ Error subiendo a S3:', errorText)
        throw new Error(`S3 upload failed: ${uploadResponse.status} - ${errorText}`)
      }

      const publicUrl = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${fileName}`
      console.log('✅ Audio FINAL guardado en S3:', publicUrl)

      // RESPUESTA EXITOSA CON URL DE S3
      return new Response(
        JSON.stringify({
          success: true,
          audioUrl: publicUrl,
          metadata: {
            savedAt: new Date().toISOString(),
            audioSize: audioBuffer.byteLength
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Si no es ningún modo reconocido
    throw new Error(`Modo no reconocido: ${mode}`)

  } catch (error) {
    console.error('❌ Error en generate-ad:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

/* 
NOTAS PARA DESPLIEGUE:

1. Configurar secrets en Supabase:
   supabase secrets set OPENAI_API_KEY=tu-api-key
   supabase secrets set ELEVENLABS_API_KEY=tu-api-key
   supabase secrets set ONDEON_LAMBDA_S3_URL=tu-lambda-url

2. Desplegar función:
   supabase functions deploy generate-ad

3. Testing:
   # Listar voces disponibles:
   supabase functions invoke generate-ad --body '{"mode":"list-voices"}'
   
   # Generar solo texto:
   supabase functions invoke generate-ad --body '{"mode":"text","idea":"Descuento del 20%","empresaNombre":"Farmacia Test"}'
   
   # Generar solo audio (requiere texto previo y voiceId):
   supabase functions invoke generate-ad --body '{"mode":"audio","texto":"Hola, esto es una prueba","voiceId":"EXAVITQu4vr4xnSDxMaL"}'

4. Ver logs:
   supabase functions logs generate-ad
*/

