-- ============================================================================
-- SISTEMA DE ANUNCIOS GENERADOS CON IA
-- Descripción: Tablas para almacenar anuncios generados con OpenAI y ElevenLabs
-- Fecha: 2025-11-03
-- ============================================================================

-- ============================================================================
-- TABLA 1: ai_generated_ads
-- Propósito: Almacenar anuncios generados con IA (texto + audio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_generated_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadatos del anuncio
  titulo text NOT NULL,
  idea_original text NOT NULL, -- La idea que proporcionó el admin
  texto_generado text NOT NULL, -- Texto generado por GPT-4
  
  -- IA utilizada
  ai_provider text NOT NULL, -- 'openai' o 'elevenlabs'
  voice_id text, -- ID de voz de ElevenLabs (ej: 'pNInz6obpgDQGcFmaJgB')
  model_used text, -- Modelo usado (ej: 'gpt-4', 'eleven_multilingual_v2')
  
  -- Archivos generados
  audio_url text, -- URL del audio en Supabase Storage
  duration_seconds integer, -- Duración del audio en segundos
  
  -- Relación con contenido
  contenido_id uuid REFERENCES contenidos(id) ON DELETE SET NULL,
  
  -- Metadatos de creación
  created_by uuid REFERENCES usuarios(id) NOT NULL,
  empresa_id uuid REFERENCES empresas(id),
  empresa_nombre text, -- Nombre comercial usado en el anuncio
  created_at timestamptz DEFAULT now(),
  
  -- Metadata adicional (JSON flexible)
  metadata jsonb
);

-- Comentarios para documentación
COMMENT ON TABLE ai_generated_ads IS 'Anuncios generados con IA (OpenAI + ElevenLabs)';
COMMENT ON COLUMN ai_generated_ads.idea_original IS 'Idea original proporcionada por el admin';
COMMENT ON COLUMN ai_generated_ads.texto_generado IS 'Texto del anuncio generado por GPT-4';
COMMENT ON COLUMN ai_generated_ads.empresa_nombre IS 'Nombre comercial de la empresa usado en el anuncio';
COMMENT ON COLUMN ai_generated_ads.metadata IS 'Configuración adicional: voiceType, targetAudience, backgroundMusic, etc.';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ai_ads_empresa ON ai_generated_ads(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ai_ads_creator ON ai_generated_ads(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_ads_created ON ai_generated_ads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_ads_contenido ON ai_generated_ads(contenido_id);

-- ============================================================================
-- TABLA 2: background_music_library
-- Propósito: Biblioteca de música de fondo para anuncios
-- ============================================================================
CREATE TABLE IF NOT EXISTS background_music_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información de la pista musical
  nombre text NOT NULL,
  descripcion text,
  categoria text NOT NULL, -- 'energica', 'corporativa', 'suave', 'motivadora', 'relajante'
  duracion_segundos integer NOT NULL,
  
  -- Archivos de audio
  url_audio text NOT NULL, -- URL del archivo completo en Storage
  url_preview text, -- URL de preview (primeros 10 segundos)
  
  -- Metadatos musicales
  bpm integer, -- Beats por minuto
  mood text, -- 'happy', 'serious', 'calm', 'exciting', 'energetic'
  tags text[], -- Array de tags para búsqueda: ['commercial', 'upbeat', 'modern']
  
  -- Control de derechos
  royalty_free boolean DEFAULT true,
  licencia text, -- Información de licencia si aplica
  autor text, -- Autor o fuente de la música
  
  -- Control de sistema
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Comentarios para documentación
COMMENT ON TABLE background_music_library IS 'Biblioteca de música de fondo para anuncios';
COMMENT ON COLUMN background_music_library.categoria IS 'Categoría de música: energica, corporativa, suave, motivadora, relajante';
COMMENT ON COLUMN background_music_library.mood IS 'Mood/ambiente: happy, serious, calm, exciting, energetic';
COMMENT ON COLUMN background_music_library.tags IS 'Tags para búsqueda y filtrado (array de texto)';
COMMENT ON COLUMN background_music_library.royalty_free IS 'true si la música es libre de derechos';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_music_categoria ON background_music_library(categoria);
CREATE INDEX IF NOT EXISTS idx_music_mood ON background_music_library(mood);
CREATE INDEX IF NOT EXISTS idx_music_activo ON background_music_library(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_music_tags ON background_music_library USING GIN (tags);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_background_music_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_background_music_updated_at
  BEFORE UPDATE ON background_music_library
  FOR EACH ROW
  EXECUTE FUNCTION update_background_music_updated_at();

-- ============================================================================
-- DATOS DE EJEMPLO PARA MÚSICA (Opcional - descomentar si quieres datos demo)
-- ============================================================================
-- NOTA: Estos son ejemplos. Deberás subir música real a Supabase Storage
-- y actualizar las URLs antes de usar.

/*
INSERT INTO background_music_library (nombre, descripcion, categoria, duracion_segundos, url_audio, bpm, mood, tags, autor) VALUES
  (
    'Energía Corporativa',
    'Música corporativa moderna y motivadora, ideal para anuncios comerciales',
    'corporativa',
    30,
    'https://tu-proyecto.supabase.co/storage/v1/object/public/contenidos/background-music/energia-corporativa.mp3',
    120,
    'exciting',
    ARRAY['commercial', 'upbeat', 'corporate', 'modern'],
    'Bensound'
  ),
  (
    'Ambiente Suave',
    'Música de fondo suave y relajante para anuncios tranquilos',
    'suave',
    30,
    'https://tu-proyecto.supabase.co/storage/v1/object/public/contenidos/background-music/ambiente-suave.mp3',
    80,
    'calm',
    ARRAY['soft', 'ambient', 'relaxing', 'gentle'],
    'Incompetech'
  ),
  (
    'Motivación Positiva',
    'Música energética y positiva para mensajes inspiradores',
    'energica',
    30,
    'https://tu-proyecto.supabase.co/storage/v1/object/public/contenidos/background-music/motivacion-positiva.mp3',
    130,
    'happy',
    ARRAY['energetic', 'positive', 'commercial', 'uplifting'],
    'YouTube Audio Library'
  ),
  (
    'Profesional Confiable',
    'Música corporativa seria y profesional',
    'corporativa',
    30,
    'https://tu-proyecto.supabase.co/storage/v1/object/public/contenidos/background-music/profesional-confiable.mp3',
    100,
    'serious',
    ARRAY['corporate', 'professional', 'trustworthy', 'business'],
    'Bensound'
  ),
  (
    'Ritmo Comercial',
    'Música con ritmo perfecto para anuncios de ofertas y promociones',
    'motivadora',
    30,
    'https://tu-proyecto.supabase.co/storage/v1/object/public/contenidos/background-music/ritmo-comercial.mp3',
    125,
    'energetic',
    ARRAY['commercial', 'promo', 'sale', 'upbeat'],
    'Incompetech'
  );
*/

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Ejecuta estas queries para verificar que las tablas se crearon correctamente:

-- SELECT * FROM ai_generated_ads LIMIT 1;
-- SELECT * FROM background_music_library LIMIT 1;

-- Ver estructura de las tablas:
-- \d ai_generated_ads
-- \d background_music_library

