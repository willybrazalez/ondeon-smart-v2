-- ============================================================================
-- ONDEON SMART v2 - REESTRUCTURACIÓN COMPLETA DE CANALES Y SECTORES
-- ============================================================================
-- Archivo: 031_reestructuracion_completa.sql
-- Descripción: Reestructuración de sectores, categorías y canales con
--              metadatos para análisis con Essentia (IA)
-- Total: 9 sectores + 7 categorías + 160 canales
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: PREPARACIÓN - Añadir columna criterios_musicales a canales
-- ============================================================================

-- Añadir columna para metadatos de Essentia en canciones
ALTER TABLE canciones ADD COLUMN IF NOT EXISTS metadatos_essentia JSONB;

COMMENT ON COLUMN canciones.metadatos_essentia IS 'Metadatos extraídos por Essentia: bpm, key, scale, arousal, valence, moods, géneros, etc.';

-- Añadir columna para criterios de matching IA en canales
ALTER TABLE canales ADD COLUMN IF NOT EXISTS criterios_musicales JSONB;

COMMENT ON COLUMN canales.criterios_musicales IS 'Criterios para matching IA: rangos de bpm, moods, géneros permitidos, etc.';

-- Añadir columna para identificar canales de sector
ALTER TABLE canales ADD COLUMN IF NOT EXISTS sector_exclusivo_id UUID REFERENCES sectores(id) ON DELETE SET NULL;

COMMENT ON COLUMN canales.sector_exclusivo_id IS 'Si no es NULL, este canal pertenece exclusivamente a este sector';

-- Crear índice para canales por sector
CREATE INDEX IF NOT EXISTS idx_canales_sector_exclusivo ON canales(sector_exclusivo_id) WHERE sector_exclusivo_id IS NOT NULL;

-- ============================================================================
-- SECCIÓN 2: LIMPIAR DATOS ANTERIORES
-- ============================================================================

-- Desactivar canales anteriores (no eliminamos para preservar historial)
UPDATE canales SET activo = false WHERE activo = true;

-- Limpiar relaciones anteriores
DELETE FROM categoria_canales;
DELETE FROM sector_canales_recomendados;
DELETE FROM seccion_canales;

-- Limpiar categorías anteriores
DELETE FROM categorias;

-- Limpiar secciones anteriores
DELETE FROM secciones_home;

-- Limpiar sectores anteriores
DELETE FROM sectores;

-- ============================================================================
-- SECCIÓN 3: INSERTAR 9 SECTORES EMPRESARIALES
-- ============================================================================

INSERT INTO sectores (nombre, descripcion, icono) VALUES
  ('Hostelería', 'Restaurantes, bares, cafeterías, hoteles', 'utensils'),
  ('Retail / Comercio', 'Tiendas, boutiques, supermercados', 'store'),
  ('Salud', 'Farmacias, clínicas, dentistas, ópticas', 'hospital'),
  ('Bienestar', 'Spas, gimnasios, centros de yoga', 'heart'),
  ('Belleza', 'Peluquerías, barberías, estéticas', 'scissors'),
  ('Oficinas / Coworking', 'Espacios de trabajo', 'briefcase'),
  ('Educación', 'Academias, guarderías, bibliotecas', 'book'),
  ('Servicios profesionales', 'Bancos, seguros, inmobiliarias', 'building'),
  ('Ocio / Entretenimiento', 'Cines, boleras, salas de juego', 'gamepad')
ON CONFLICT (nombre) DO UPDATE SET 
  descripcion = EXCLUDED.descripcion,
  icono = EXCLUDED.icono;

-- ============================================================================
-- SECCIÓN 4: INSERTAR 7 CATEGORÍAS MUSICALES
-- ============================================================================

INSERT INTO categorias (nombre, slug, descripcion, icono, color_hex, orden) VALUES
  ('FM Radio', 'fm-radio', 'Emisoras y estilo radio tradicional', 'radio', '#E74C3C', 1),
  ('Mix Animado', 'mix-animado', 'Música energética para ambientes dinámicos', 'bolt', '#F39C12', 2),
  ('Concentración', 'concentracion', 'Música para enfoque y productividad', 'brain', '#3498DB', 3),
  ('Mix Latino', 'mix-latino', 'Música latina en todas sus variantes', 'fire', '#E67E22', 4),
  ('Para todos los gustos', 'para-todos', 'Mezclas eclécticas y variadas', 'music', '#9B59B6', 5),
  ('En plan relajado', 'relajado', 'Música chill y ambiente tranquilo', 'cloud', '#1ABC9C', 6),
  ('Géneros', 'generos', 'Géneros musicales puros', 'vinyl', '#34495E', 7)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  icono = EXCLUDED.icono,
  color_hex = EXCLUDED.color_hex,
  orden = EXCLUDED.orden;

-- ============================================================================
-- SECCIÓN 5: INSERTAR 70 CANALES DE CATEGORÍAS
-- ============================================================================

-- Variables para IDs de categorías
DO $$
DECLARE
  v_cat_radio UUID;
  v_cat_animado UUID;
  v_cat_concentracion UUID;
  v_cat_latino UUID;
  v_cat_todos UUID;
  v_cat_relajado UUID;
  v_cat_generos UUID;
BEGIN
  -- Obtener IDs de categorías
  SELECT id INTO v_cat_radio FROM categorias WHERE slug = 'fm-radio';
  SELECT id INTO v_cat_animado FROM categorias WHERE slug = 'mix-animado';
  SELECT id INTO v_cat_concentracion FROM categorias WHERE slug = 'concentracion';
  SELECT id INTO v_cat_latino FROM categorias WHERE slug = 'mix-latino';
  SELECT id INTO v_cat_todos FROM categorias WHERE slug = 'para-todos';
  SELECT id INTO v_cat_relajado FROM categorias WHERE slug = 'relajado';
  SELECT id INTO v_cat_generos FROM categorias WHERE slug = 'generos';

  -- ========================================
  -- CATEGORÍA: FM Radio (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, criterios_musicales) VALUES
  ('Radio Hits', 'Éxitos actuales formato radio', 1, true, '{
    "bpm_min": 100, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 5, "valence_max": 9,
    "mood_aggressive_max": 0.3,
    "mood_happy_min": 0.4,
    "mood_party_min": 0.3,
    "mood_relaxed_max": 0.5,
    "mood_sad_max": 0.3,
    "danceability_min": 0.4,
    "voice_instrumental": "voice",
    "genres_allowed": ["Pop", "Electronic---Synth-pop", "Rock---Pop Rock"],
    "genres_excluded": ["Rock---Metal", "Classical"],
    "descripcion_canal": "Éxitos actuales formato radio"
  }'::jsonb),
  ('Radio Clásica', 'Música clásica formato radio', 2, true, '{
    "bpm_min": 60, "bpm_max": 100,
    "arousal_min": 2, "arousal_max": 6,
    "valence_min": 4, "valence_max": 8,
    "mood_aggressive_max": 0.15,
    "mood_happy_min": 0.2,
    "mood_relaxed_min": 0.4,
    "mood_sad_max": 0.4,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical"],
    "descripcion_canal": "Música clásica formato radio"
  }'::jsonb),
  ('Radio Jazz', 'Jazz clásico y contemporáneo', 3, true, '{
    "bpm_min": 80, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 4, "valence_max": 8,
    "mood_aggressive_max": 0.2,
    "mood_happy_min": 0.3,
    "mood_relaxed_min": 0.3,
    "genres_allowed": ["Jazz", "Jazz---Smooth Jazz", "Jazz---Bossa Nova"],
    "descripcion_canal": "Jazz clásico y contemporáneo"
  }'::jsonb),
  ('Radio Oldies', 'Éxitos de los 60s-80s', 4, true, '{
    "bpm_min": 100, "bpm_max": 130,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "mood_party_min": 0.3,
    "voice_instrumental": "voice",
    "genres_allowed": ["Pop", "Rock---Classic Rock", "Funk / Soul---Disco"],
    "descripcion_canal": "Éxitos de los 60s-80s"
  }'::jsonb),
  ('Radio Lounge', 'Ambiente lounge/chill', 5, true, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "danceability_min": 0.3,
    "genres_allowed": ["Electronic---Downtempo", "Electronic---Chillout", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Ambiente lounge/chill"
  }'::jsonb),
  ('Radio Pop', 'Pop internacional actual', 6, true, '{
    "bpm_min": 100, "bpm_max": 128,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "mood_party_min": 0.3,
    "danceability_min": 0.5,
    "voice_instrumental": "voice",
    "genres_allowed": ["Pop", "Electronic---Synth-pop", "Electronic---Dance-pop"],
    "descripcion_canal": "Pop internacional actual"
  }'::jsonb),
  ('Radio Latina', 'Hits latinos formato radio', 7, true, '{
    "bpm_min": 90, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "mood_party_min": 0.4,
    "danceability_min": 0.5,
    "voice_instrumental": "voice",
    "genres_allowed": ["Latin", "Latin---Reggaeton", "Latin---Salsa", "Latin---Bachata"],
    "descripcion_canal": "Hits latinos formato radio"
  }'::jsonb),
  ('Radio Soft', 'Baladas y música suave', 8, true, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "mood_sad_max": 0.4,
    "voice_instrumental": "voice",
    "genres_allowed": ["Pop---Ballad", "Rock---Soft Rock", "Funk / Soul---Soul"],
    "descripcion_canal": "Baladas y música suave"
  }'::jsonb),
  ('Radio Dance', 'Dance/electrónica comercial', 9, true, '{
    "bpm_min": 120, "bpm_max": 135,
    "arousal_min": 6, "arousal_max": 9,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.6,
    "danceability_min": 0.7,
    "genres_allowed": ["Electronic---House", "Electronic---Dance-pop", "Electronic---Eurodance"],
    "descripcion_canal": "Dance/electrónica comercial"
  }'::jsonb),
  ('Radio Acoustic', 'Versiones acústicas', 10, true, '{
    "bpm_min": 80, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 4, "valence_max": 8,
    "mood_aggressive_max": 0.15,
    "mood_relaxed_min": 0.4,
    "mood_acoustic_min": 0.7,
    "genres_allowed": ["Folk", "Pop---Singer-Songwriter", "Rock---Acoustic"],
    "descripcion_canal": "Versiones acústicas"
  }'::jsonb);

  -- Asociar canales a categoría FM Radio
  INSERT INTO categoria_canales (categoria_id, canal_id, orden)
  SELECT v_cat_radio, id, orden FROM canales WHERE nombre LIKE 'Radio %' AND activo = true;

  -- ========================================
  -- CATEGORÍA: Mix Animado (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, criterios_musicales) VALUES
  ('Party Vibes', 'Fiesta y celebración', 11, true, '{
    "bpm_min": 120, "bpm_max": 135,
    "arousal_min": 7, "arousal_max": 9,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "mood_party_min": 0.7,
    "danceability_min": 0.7,
    "genres_allowed": ["Electronic---House", "Pop", "Latin---Reggaeton"],
    "descripcion_canal": "Fiesta y celebración"
  }'::jsonb),
  ('Workout Energy', 'Energía para entrenar', 12, true, '{
    "bpm_min": 130, "bpm_max": 160,
    "arousal_min": 8, "arousal_max": 9,
    "valence_min": 6, "valence_max": 9,
    "mood_aggressive_min": 0.3,
    "mood_party_min": 0.5,
    "danceability_min": 0.6,
    "mood_electronic_min": 0.4,
    "genres_allowed": ["Electronic---House", "Electronic---Techno", "Hip Hop", "Rock---Hard Rock"],
    "descripcion_canal": "Energía para entrenar"
  }'::jsonb),
  ('Feel Good Hits', 'Canciones alegres y positivas', 13, true, '{
    "bpm_min": 110, "bpm_max": 130,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.7,
    "mood_sad_max": 0.15,
    "danceability_min": 0.5,
    "genres_allowed": ["Pop", "Funk / Soul---Disco", "Electronic---Synth-pop"],
    "descripcion_canal": "Canciones alegres y positivas"
  }'::jsonb),
  ('Dance Floor', 'Electrónica bailable', 14, true, '{
    "bpm_min": 125, "bpm_max": 140,
    "arousal_min": 7, "arousal_max": 9,
    "valence_min": 6, "valence_max": 9,
    "mood_party_min": 0.7,
    "danceability_min": 0.8,
    "mood_electronic_min": 0.7,
    "genres_allowed": ["Electronic---House", "Electronic---Techno", "Electronic---Trance"],
    "descripcion_canal": "Electrónica bailable"
  }'::jsonb),
  ('Summer Beats', 'Ritmos veraniegos', 15, true, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "mood_party_min": 0.5,
    "danceability_min": 0.5,
    "genres_allowed": ["Pop", "Latin", "Electronic---Tropical House", "Reggae"],
    "descripcion_canal": "Ritmos veraniegos"
  }'::jsonb),
  ('Retro Party', 'Clásicos de fiesta', 16, true, '{
    "bpm_min": 115, "bpm_max": 135,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "mood_party_min": 0.6,
    "danceability_min": 0.6,
    "genres_allowed": ["Funk / Soul---Disco", "Pop", "Electronic---Euro-Disco"],
    "descripcion_canal": "Clásicos de fiesta 70s-90s"
  }'::jsonb),
  ('Urban Groove', 'Hip-hop y R&B animado', 17, true, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.4,
    "danceability_min": 0.5,
    "genres_allowed": ["Hip Hop", "Funk / Soul---Contemporary R&B", "Funk / Soul---Neo Soul"],
    "descripcion_canal": "Hip-hop y R&B animado"
  }'::jsonb),
  ('Rock Energy', 'Rock energético', 18, true, '{
    "bpm_min": 120, "bpm_max": 150,
    "arousal_min": 7, "arousal_max": 9,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_min": 0.3,
    "mood_aggressive_max": 0.7,
    "mood_party_min": 0.4,
    "genres_allowed": ["Rock---Hard Rock", "Rock---Alternative Rock", "Rock---Punk"],
    "descripcion_canal": "Rock energético"
  }'::jsonb),
  ('Latin Fire', 'Latino bailable', 19, true, '{
    "bpm_min": 100, "bpm_max": 135,
    "arousal_min": 6, "arousal_max": 9,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.6,
    "danceability_min": 0.7,
    "genres_allowed": ["Latin---Salsa", "Latin---Reggaeton", "Latin---Cumbia", "Latin---Merengue"],
    "descripcion_canal": "Latino bailable"
  }'::jsonb),
  ('Pop Explosion', 'Pop uptempo', 20, true, '{
    "bpm_min": 115, "bpm_max": 130,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.5,
    "danceability_min": 0.6,
    "voice_instrumental": "voice",
    "genres_allowed": ["Pop", "Electronic---Synth-pop", "Electronic---Dance-pop"],
    "descripcion_canal": "Pop uptempo"
  }'::jsonb);

  -- Asociar canales a categoría Mix Animado
  INSERT INTO categoria_canales (categoria_id, canal_id, orden)
  SELECT v_cat_animado, id, orden FROM canales 
  WHERE nombre IN ('Party Vibes', 'Workout Energy', 'Feel Good Hits', 'Dance Floor', 
                   'Summer Beats', 'Retro Party', 'Urban Groove', 'Rock Energy', 
                   'Latin Fire', 'Pop Explosion') AND activo = true;

  -- ========================================
  -- CATEGORÍA: Concentración (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, criterios_musicales) VALUES
  ('Deep Focus', 'Ambient minimalista', 21, true, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 1, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.7,
    "mood_sad_max": 0.3,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "Electronic---Minimal"],
    "descripcion_canal": "Ambient minimalista para concentración profunda"
  }'::jsonb),
  ('Study Flow', 'Lo-fi y beats suaves', 22, true, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "mood_sad_max": 0.3,
    "genres_allowed": ["Electronic---Downtempo", "Hip Hop---Instrumental"],
    "descripcion_canal": "Lo-fi y beats suaves para estudiar"
  }'::jsonb),
  ('Piano Calm', 'Piano instrumental', 23, true, '{
    "bpm_min": 60, "bpm_max": 90,
    "arousal_min": 1, "arousal_max": 4,
    "valence_min": 4, "valence_max": 8,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "mood_acoustic_min": 0.6,
    "genres_allowed": ["Classical", "New Age"],
    "descripcion_canal": "Piano instrumental relajante"
  }'::jsonb),
  ('Nature Sounds', 'Sonidos naturales con música', 24, true, '{
    "bpm_min": 50, "bpm_max": 80,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "New Age"],
    "descripcion_canal": "Sonidos naturales con música ambiental"
  }'::jsonb),
  ('Minimal Tech', 'Electrónica minimalista', 25, true, '{
    "bpm_min": 100, "bpm_max": 120,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.15,
    "mood_party_max": 0.3,
    "mood_electronic_min": 0.7,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Minimal Techno", "Electronic---Tech House"],
    "descripcion_canal": "Electrónica minimalista para trabajar"
  }'::jsonb),
  ('Classical Focus', 'Clásica para concentración', 26, true, '{
    "bpm_min": 60, "bpm_max": 100,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 4, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.4,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical---Baroque", "Classical---Romantic", "Classical---Modern"],
    "descripcion_canal": "Música clásica para concentración"
  }'::jsonb),
  ('Ambient Work', 'Texturas ambientales', 27, true, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 1, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.7,
    "voice_instrumental": "instrumental",
    "mood_electronic_min": 0.3,
    "genres_allowed": ["Electronic---Ambient", "Electronic---Dark Ambient"],
    "descripcion_canal": "Texturas ambientales para trabajar"
  }'::jsonb),
  ('Soft Electronic', 'Electrónica suave', 28, true, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.4,
    "mood_electronic_min": 0.5,
    "genres_allowed": ["Electronic---Chillout", "Electronic---Downtempo"],
    "descripcion_canal": "Electrónica suave para concentración"
  }'::jsonb),
  ('Zen Garden', 'Oriental y meditativo', 29, true, '{
    "bpm_min": 50, "bpm_max": 80,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "mood_acoustic_min": 0.4,
    "genres_allowed": ["New Age", "Folk, World, &amp; Country---Asian"],
    "descripcion_canal": "Música oriental y meditativa"
  }'::jsonb),
  ('Brain Waves', 'Música binaural y enfoque', 30, true, '{
    "bpm_min": 60, "bpm_max": 80,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 6,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "New Age"],
    "descripcion_canal": "Música binaural para enfoque profundo"
  }'::jsonb);

  -- Asociar canales a categoría Concentración
  INSERT INTO categoria_canales (categoria_id, canal_id, orden)
  SELECT v_cat_concentracion, id, orden FROM canales 
  WHERE nombre IN ('Deep Focus', 'Study Flow', 'Piano Calm', 'Nature Sounds',
                   'Minimal Tech', 'Classical Focus', 'Ambient Work', 'Soft Electronic',
                   'Zen Garden', 'Brain Waves') AND activo = true;

  -- ========================================
  -- CATEGORÍA: Mix Latino (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, criterios_musicales) VALUES
  ('Salsa Clásica', 'Salsa tradicional', 31, true, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.5,
    "danceability_min": 0.6,
    "genres_allowed": ["Latin---Salsa", "Latin---Son"],
    "descripcion_canal": "Salsa clásica tradicional"
  }'::jsonb),
  ('Reggaetón Hits', 'Reggaetón actual', 32, true, '{
    "bpm_min": 88, "bpm_max": 100,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.6,
    "danceability_min": 0.7,
    "genres_allowed": ["Latin---Reggaeton"],
    "descripcion_canal": "Reggaetón actual y urbano"
  }'::jsonb),
  ('Bachata Romántica', 'Bachata y merengue', 33, true, '{
    "bpm_min": 80, "bpm_max": 140,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.4,
    "mood_romantic_min": 0.4,
    "danceability_min": 0.5,
    "genres_allowed": ["Latin---Bachata", "Latin---Merengue"],
    "descripcion_canal": "Bachata romántica y merengue"
  }'::jsonb),
  ('Latin Pop', 'Pop latino actual', 34, true, '{
    "bpm_min": 95, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "danceability_min": 0.5,
    "voice_instrumental": "voice",
    "genres_allowed": ["Latin---Latin Pop", "Pop"],
    "descripcion_canal": "Pop latino actual"
  }'::jsonb),
  ('Tropical Vibes', 'Cumbia y tropical', 35, true, '{
    "bpm_min": 90, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.5,
    "danceability_min": 0.6,
    "genres_allowed": ["Latin---Cumbia", "Latin---Tropical"],
    "descripcion_canal": "Cumbia y ritmos tropicales"
  }'::jsonb),
  ('Boleros', 'Boleros clásicos', 36, true, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 3, "valence_max": 7,
    "mood_romantic_min": 0.5,
    "mood_relaxed_min": 0.4,
    "mood_sad_max": 0.5,
    "voice_instrumental": "voice",
    "genres_allowed": ["Latin---Bolero"],
    "descripcion_canal": "Boleros clásicos románticos"
  }'::jsonb),
  ('Flamenco Chill', 'Flamenco fusión', 37, true, '{
    "bpm_min": 80, "bpm_max": 115,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 4, "valence_max": 8,
    "mood_relaxed_min": 0.3,
    "mood_acoustic_min": 0.4,
    "genres_allowed": ["Folk, World, &amp; Country---Flamenco"],
    "descripcion_canal": "Flamenco fusión y chill"
  }'::jsonb),
  ('Bossa Nova', 'Bossa nova y MPB', 38, true, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.3,
    "mood_acoustic_min": 0.4,
    "genres_allowed": ["Jazz---Bossa Nova", "Latin---MPB"],
    "descripcion_canal": "Bossa nova brasileña"
  }'::jsonb),
  ('Latin Jazz', 'Jazz latino', 39, true, '{
    "bpm_min": 90, "bpm_max": 125,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.4,
    "mood_party_min": 0.3,
    "genres_allowed": ["Jazz---Latin Jazz", "Jazz---Afro-Cuban Jazz"],
    "descripcion_canal": "Jazz latino y afrocubano"
  }'::jsonb),
  ('Urbano Latino', 'Urbano y trap latino', 40, true, '{
    "bpm_min": 85, "bpm_max": 105,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 4, "valence_max": 7,
    "mood_party_min": 0.4,
    "danceability_min": 0.5,
    "genres_allowed": ["Hip Hop---Trap", "Latin---Reggaeton"],
    "descripcion_canal": "Urbano y trap latino"
  }'::jsonb);

  -- Asociar canales a categoría Mix Latino
  INSERT INTO categoria_canales (categoria_id, canal_id, orden)
  SELECT v_cat_latino, id, orden FROM canales 
  WHERE nombre IN ('Salsa Clásica', 'Reggaetón Hits', 'Bachata Romántica', 'Latin Pop',
                   'Tropical Vibes', 'Boleros', 'Flamenco Chill', 'Bossa Nova',
                   'Latin Jazz', 'Urbano Latino') AND activo = true;

  -- ========================================
  -- CATEGORÍA: Para todos los gustos (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, criterios_musicales) VALUES
  ('Mainstream Mix', 'Hits de todos los géneros', 41, true, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.4,
    "danceability_min": 0.4,
    "genres_allowed": ["Pop", "Rock---Pop Rock", "Electronic---Synth-pop"],
    "descripcion_canal": "Hits mainstream de todos los géneros"
  }'::jsonb),
  ('Decades Mix', 'Éxitos de todas las décadas', 42, true, '{
    "bpm_min": 90, "bpm_max": 125,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "genres_allowed": ["Pop", "Rock", "Funk / Soul"],
    "descripcion_canal": "Éxitos de todas las décadas"
  }'::jsonb),
  ('World Music', 'Música del mundo', 43, true, '{
    "bpm_min": 80, "bpm_max": 125,
    "arousal_min": 3, "arousal_max": 7,
    "valence_min": 4, "valence_max": 8,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Folk, World, &amp; Country"],
    "descripcion_canal": "Música del mundo y étnica"
  }'::jsonb),
  ('Acoustic Covers', 'Covers acústicos variados', 44, true, '{
    "bpm_min": 80, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 4, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_acoustic_min": 0.7,
    "genres_allowed": ["Folk", "Pop---Singer-Songwriter", "Rock---Acoustic"],
    "descripcion_canal": "Covers acústicos de éxitos"
  }'::jsonb),
  ('Easy Listening', 'Fácil escucha general', 45, true, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.15,
    "mood_relaxed_min": 0.3,
    "genres_allowed": ["Pop", "Jazz---Smooth Jazz", "Electronic---Chillout"],
    "descripcion_canal": "Música fácil de escuchar"
  }'::jsonb),
  ('Crossover Hits', 'Cruces de géneros', 46, true, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.4,
    "danceability_min": 0.4,
    "genres_allowed": ["Pop", "Electronic", "Hip Hop", "Latin"],
    "descripcion_canal": "Hits que cruzan géneros"
  }'::jsonb),
  ('Feel Good Mix', 'Música positiva variada', 47, true, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "mood_sad_max": 0.15,
    "genres_allowed": ["Pop", "Funk / Soul", "Reggae"],
    "descripcion_canal": "Música positiva para sentirse bien"
  }'::jsonb),
  ('Dinner Music', 'Para ambiente de cena', 48, true, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "genres_allowed": ["Jazz---Smooth Jazz", "Jazz---Bossa Nova", "Classical"],
    "descripcion_canal": "Música elegante para cenas"
  }'::jsonb),
  ('Coffee Shop', 'Estilo cafetería', 49, true, '{
    "bpm_min": 85, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_acoustic_min": 0.3,
    "genres_allowed": ["Folk", "Jazz---Smooth Jazz", "Pop---Indie Pop"],
    "descripcion_canal": "Ambiente de cafetería"
  }'::jsonb),
  ('Sunday Morning', 'Relajado dominical', 50, true, '{
    "bpm_min": 75, "bpm_max": 100,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Folk", "Jazz---Smooth Jazz", "Pop---Singer-Songwriter"],
    "descripcion_canal": "Música relajada para domingo"
  }'::jsonb);

  -- Asociar canales a categoría Para todos los gustos
  INSERT INTO categoria_canales (categoria_id, canal_id, orden)
  SELECT v_cat_todos, id, orden FROM canales 
  WHERE nombre IN ('Mainstream Mix', 'Decades Mix', 'World Music', 'Acoustic Covers',
                   'Easy Listening', 'Crossover Hits', 'Feel Good Mix', 'Dinner Music',
                   'Coffee Shop', 'Sunday Morning') AND activo = true;

  -- ========================================
  -- CATEGORÍA: En plan relajado (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, criterios_musicales) VALUES
  ('Chill Out', 'Chill electrónico', 51, true, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.6,
    "mood_electronic_min": 0.4,
    "genres_allowed": ["Electronic---Chillout", "Electronic---Downtempo"],
    "descripcion_canal": "Chill electrónico relajante"
  }'::jsonb),
  ('Smooth Jazz', 'Jazz suave', 52, true, '{
    "bpm_min": 70, "bpm_max": 100,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.6,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Jazz---Smooth Jazz", "Jazz---Cool Jazz"],
    "descripcion_canal": "Jazz suave y relajante"
  }'::jsonb),
  ('Acoustic Calm', 'Acústico relajante', 53, true, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 8,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.7,
    "mood_acoustic_min": 0.7,
    "genres_allowed": ["Folk", "Pop---Singer-Songwriter"],
    "descripcion_canal": "Música acústica calmada"
  }'::jsonb),
  ('Soft Piano', 'Piano relajante', 54, true, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 1, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.7,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "New Age"],
    "descripcion_canal": "Piano suave y relajante"
  }'::jsonb),
  ('Downtempo', 'Downtempo y trip-hop', 55, true, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.15,
    "mood_relaxed_min": 0.5,
    "mood_electronic_min": 0.4,
    "genres_allowed": ["Electronic---Downtempo", "Electronic---Trip Hop"],
    "descripcion_canal": "Downtempo y trip-hop"
  }'::jsonb),
  ('Spa Relax', 'Música de spa', 56, true, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["New Age", "Electronic---Ambient"],
    "descripcion_canal": "Música relajante de spa"
  }'::jsonb),
  ('Evening Jazz', 'Jazz nocturno', 57, true, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "mood_romantic_min": 0.3,
    "genres_allowed": ["Jazz---Cool Jazz", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Jazz para noches tranquilas"
  }'::jsonb),
  ('Indie Chill', 'Indie alternativo suave', 58, true, '{
    "bpm_min": 85, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 4, "valence_max": 7,
    "mood_relaxed_min": 0.4,
    "mood_sad_max": 0.4,
    "genres_allowed": ["Rock---Indie Rock", "Pop---Indie Pop"],
    "descripcion_canal": "Indie alternativo suave"
  }'::jsonb),
  ('Soul Smooth', 'Soul y R&B suave', 59, true, '{
    "bpm_min": 75, "bpm_max": 100,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_romantic_min": 0.3,
    "genres_allowed": ["Funk / Soul---Soul", "Funk / Soul---Neo Soul"],
    "descripcion_canal": "Soul y R&B suave"
  }'::jsonb),
  ('Sunset Vibes', 'Atardecer y ambiente', 60, true, '{
    "bpm_min": 85, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Electronic---Chillout", "Electronic---Tropical House"],
    "descripcion_canal": "Vibes de atardecer"
  }'::jsonb);

  -- Asociar canales a categoría En plan relajado
  INSERT INTO categoria_canales (categoria_id, canal_id, orden)
  SELECT v_cat_relajado, id, orden FROM canales 
  WHERE nombre IN ('Chill Out', 'Smooth Jazz', 'Acoustic Calm', 'Soft Piano',
                   'Downtempo', 'Spa Relax', 'Evening Jazz', 'Indie Chill',
                   'Soul Smooth', 'Sunset Vibes') AND activo = true;

  -- ========================================
  -- CATEGORÍA: Géneros (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, criterios_musicales) VALUES
  ('Pure Rock', 'Rock clásico y moderno', 61, true, '{
    "bpm_min": 110, "bpm_max": 145,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 4, "valence_max": 8,
    "mood_aggressive_min": 0.2,
    "mood_aggressive_max": 0.6,
    "genres_allowed": ["Rock---Classic Rock", "Rock---Alternative Rock", "Rock---Hard Rock"],
    "descripcion_canal": "Rock puro clásico y moderno"
  }'::jsonb),
  ('Pure Pop', 'Pop en estado puro', 62, true, '{
    "bpm_min": 100, "bpm_max": 130,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "danceability_min": 0.5,
    "voice_instrumental": "voice",
    "genres_allowed": ["Pop"],
    "descripcion_canal": "Pop en estado puro"
  }'::jsonb),
  ('Pure Jazz', 'Jazz tradicional', 63, true, '{
    "bpm_min": 80, "bpm_max": 130,
    "arousal_min": 3, "arousal_max": 7,
    "valence_min": 4, "valence_max": 8,
    "genres_allowed": ["Jazz"],
    "descripcion_canal": "Jazz tradicional y puro"
  }'::jsonb),
  ('Pure Classical', 'Música clásica', 64, true, '{
    "bpm_min": 60, "bpm_max": 140,
    "arousal_min": 2, "arousal_max": 7,
    "valence_min": 3, "valence_max": 8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical"],
    "descripcion_canal": "Música clásica pura"
  }'::jsonb),
  ('Pure Electronic', 'Electrónica pura', 65, true, '{
    "bpm_min": 120, "bpm_max": 145,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.4,
    "danceability_min": 0.6,
    "mood_electronic_min": 0.8,
    "genres_allowed": ["Electronic---House", "Electronic---Techno", "Electronic---Trance"],
    "descripcion_canal": "Electrónica pura"
  }'::jsonb),
  ('Pure Soul', 'Soul y Motown', 66, true, '{
    "bpm_min": 80, "bpm_max": 115,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "genres_allowed": ["Funk / Soul---Soul", "Funk / Soul---Motown"],
    "descripcion_canal": "Soul clásico y Motown"
  }'::jsonb),
  ('Pure Blues', 'Blues auténtico', 67, true, '{
    "bpm_min": 70, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 3, "valence_max": 7,
    "mood_sad_max": 0.5,
    "genres_allowed": ["Blues"],
    "descripcion_canal": "Blues auténtico"
  }'::jsonb),
  ('Pure Country', 'Country y americana', 68, true, '{
    "bpm_min": 90, "bpm_max": 130,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 4, "valence_max": 8,
    "mood_acoustic_min": 0.3,
    "genres_allowed": ["Folk, World, &amp; Country---Country"],
    "descripcion_canal": "Country y americana"
  }'::jsonb),
  ('Pure Funk', 'Funk y groove', 69, true, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.4,
    "danceability_min": 0.6,
    "genres_allowed": ["Funk / Soul---Funk", "Funk / Soul---P.Funk"],
    "descripcion_canal": "Funk y groove puro"
  }'::jsonb),
  ('Pure Reggae', 'Reggae y dub', 70, true, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Reggae", "Reggae---Dub"],
    "descripcion_canal": "Reggae y dub"
  }'::jsonb);

  -- Asociar canales a categoría Géneros
  INSERT INTO categoria_canales (categoria_id, canal_id, orden)
  SELECT v_cat_generos, id, orden FROM canales 
  WHERE nombre IN ('Pure Rock', 'Pure Pop', 'Pure Jazz', 'Pure Classical',
                   'Pure Electronic', 'Pure Soul', 'Pure Blues', 'Pure Country',
                   'Pure Funk', 'Pure Reggae') AND activo = true;

END $$;

-- ============================================================================
-- SECCIÓN 6: INSERTAR 90 CANALES DE SECTORES (10 por sector)
-- ============================================================================

DO $$
DECLARE
  v_sector_hosteleria UUID;
  v_sector_retail UUID;
  v_sector_salud UUID;
  v_sector_bienestar UUID;
  v_sector_belleza UUID;
  v_sector_oficinas UUID;
  v_sector_educacion UUID;
  v_sector_servicios UUID;
  v_sector_ocio UUID;
BEGIN
  -- Obtener IDs de sectores
  SELECT id INTO v_sector_hosteleria FROM sectores WHERE nombre = 'Hostelería';
  SELECT id INTO v_sector_retail FROM sectores WHERE nombre = 'Retail / Comercio';
  SELECT id INTO v_sector_salud FROM sectores WHERE nombre = 'Salud';
  SELECT id INTO v_sector_bienestar FROM sectores WHERE nombre = 'Bienestar';
  SELECT id INTO v_sector_belleza FROM sectores WHERE nombre = 'Belleza';
  SELECT id INTO v_sector_oficinas FROM sectores WHERE nombre = 'Oficinas / Coworking';
  SELECT id INTO v_sector_educacion FROM sectores WHERE nombre = 'Educación';
  SELECT id INTO v_sector_servicios FROM sectores WHERE nombre = 'Servicios profesionales';
  SELECT id INTO v_sector_ocio FROM sectores WHERE nombre = 'Ocio / Entretenimiento';

  -- ========================================
  -- SECTOR: Hostelería (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Bistro Elegante', 'Jazz suave para restaurantes', 101, true, v_sector_hosteleria, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Jazz---Smooth Jazz", "Jazz---Cool Jazz"],
    "descripcion_canal": "Jazz elegante para restaurantes de alta cocina"
  }'::jsonb),
  ('Terraza Chill', 'Ambiente terraza mediterránea', 102, true, v_sector_hosteleria, '{
    "bpm_min": 85, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.4,
    "genres_allowed": ["Electronic---Chillout", "Jazz---Bossa Nova", "Folk, World, &amp; Country---Flamenco"],
    "descripcion_canal": "Ambiente mediterráneo para terrazas"
  }'::jsonb),
  ('Bar Nocturno', 'Lounge para bares nocturnos', 103, true, v_sector_hosteleria, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 4, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.3,
    "mood_relaxed_min": 0.3,
    "genres_allowed": ["Electronic---House", "Electronic---Lounge", "Jazz---Nu Jazz"],
    "descripcion_canal": "Ambiente lounge para bares nocturnos"
  }'::jsonb),
  ('Café Parisino', 'Chanson y jazz café', 104, true, v_sector_hosteleria, '{
    "bpm_min": 75, "bpm_max": 100,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 4, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_romantic_min": 0.3,
    "mood_acoustic_min": 0.4,
    "genres_allowed": ["Pop---Chanson", "Jazz---Cool Jazz"],
    "descripcion_canal": "Estilo café parisino"
  }'::jsonb),
  ('Hotel Lobby', 'Elegante para recepciones', 105, true, v_sector_hosteleria, '{
    "bpm_min": 70, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Jazz---Smooth Jazz", "New Age"],
    "descripcion_canal": "Música elegante para lobbies de hotel"
  }'::jsonb),
  ('Brunch Vibes', 'Domingo de brunch animado', 106, true, v_sector_hosteleria, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 4, "arousal_max": 6,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_relaxed_min": 0.3,
    "genres_allowed": ["Pop---Indie Pop", "Folk", "Jazz---Bossa Nova"],
    "descripcion_canal": "Ambiente de brunch dominical"
  }'::jsonb),
  ('Tapas y Vino', 'Flamenco chill y latino suave', 107, true, v_sector_hosteleria, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_acoustic_min": 0.3,
    "genres_allowed": ["Folk, World, &amp; Country---Flamenco", "Latin---Bossa Nova", "Jazz---Latin Jazz"],
    "descripcion_canal": "Ambiente español para tapas"
  }'::jsonb),
  ('Coctelería', 'Sofisticado para cócteles', 108, true, v_sector_hosteleria, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 4, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.3,
    "mood_relaxed_min": 0.3,
    "genres_allowed": ["Electronic---Lounge", "Jazz---Nu Jazz", "Funk / Soul---Neo Soul"],
    "descripcion_canal": "Ambiente sofisticado de coctelería"
  }'::jsonb),
  ('Gastro Fusión', 'Moderno para restaurantes fusion', 109, true, v_sector_hosteleria, '{
    "bpm_min": 85, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Electronic---Downtempo", "Jazz---Nu Jazz", "Electronic---Trip Hop"],
    "descripcion_canal": "Ambiente moderno para restaurantes fusion"
  }'::jsonb),
  ('Noche Latina', 'Latino suave para cenas', 110, true, v_sector_hosteleria, '{
    "bpm_min": 85, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_romantic_min": 0.3,
    "genres_allowed": ["Latin---Bossa Nova", "Latin---Bolero", "Jazz---Latin Jazz"],
    "descripcion_canal": "Latino suave para cenas románticas"
  }'::jsonb);

  -- Asociar canales de hostelería al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_hosteleria, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_hosteleria;

  -- ========================================
  -- SECTOR: Retail / Comercio (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Shopping Hits', 'Pop actual para tiendas', 111, true, v_sector_retail, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "danceability_min": 0.5,
    "genres_allowed": ["Pop", "Electronic---Synth-pop"],
    "descripcion_canal": "Pop actual para tiendas de moda"
  }'::jsonb),
  ('Boutique Chic', 'Sofisticado para boutiques', 112, true, v_sector_retail, '{
    "bpm_min": 95, "bpm_max": 115,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "mood_relaxed_min": 0.3,
    "genres_allowed": ["Electronic---Chillout", "Pop---Indie Pop", "Electronic---Lounge"],
    "descripcion_canal": "Ambiente sofisticado para boutiques"
  }'::jsonb),
  ('Supermercado Mix', 'Variado y familiar', 113, true, v_sector_retail, '{
    "bpm_min": 100, "bpm_max": 120,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 9,
    "mood_happy_min": 0.4,
    "genres_allowed": ["Pop", "Rock---Pop Rock", "Latin---Latin Pop"],
    "descripcion_canal": "Mix variado para supermercados"
  }'::jsonb),
  ('Moda Urbana', 'Urbano moderno para streetwear', 114, true, v_sector_retail, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.4,
    "danceability_min": 0.5,
    "genres_allowed": ["Hip Hop", "Electronic---House", "Funk / Soul---Contemporary R&B"],
    "descripcion_canal": "Urbano moderno para tiendas streetwear"
  }'::jsonb),
  ('Tienda Tech', 'Electrónica moderna', 115, true, v_sector_retail, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 4, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_electronic_min": 0.5,
    "genres_allowed": ["Electronic---Minimal", "Electronic---IDM", "Electronic---Synth-pop"],
    "descripcion_canal": "Electrónica moderna para tiendas tech"
  }'::jsonb),
  ('Centro Comercial', 'Mainstream para malls', 116, true, v_sector_retail, '{
    "bpm_min": 105, "bpm_max": 128,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "danceability_min": 0.5,
    "genres_allowed": ["Pop", "Electronic---Dance-pop", "Latin---Latin Pop"],
    "descripcion_canal": "Hits mainstream para centros comerciales"
  }'::jsonb),
  ('Outlet Deals', 'Energético para outlets', 117, true, v_sector_retail, '{
    "bpm_min": 110, "bpm_max": 130,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.4,
    "danceability_min": 0.6,
    "genres_allowed": ["Pop", "Electronic---House", "Latin---Reggaeton"],
    "descripcion_canal": "Energético para tiendas outlet"
  }'::jsonb),
  ('Luxury Store', 'Elegante para lujo', 118, true, v_sector_retail, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "genres_allowed": ["Classical", "Jazz---Smooth Jazz", "Electronic---Lounge"],
    "descripcion_canal": "Ambiente elegante para tiendas de lujo"
  }'::jsonb),
  ('Kids Store', 'Alegre para tiendas infantiles', 119, true, v_sector_retail, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.7,
    "mood_sad_max": 0.1,
    "genres_allowed": ["Pop", "Funk / Soul---Disco"],
    "descripcion_canal": "Música alegre para tiendas infantiles"
  }'::jsonb),
  ('Home & Deco', 'Chill para decoración', 120, true, v_sector_retail, '{
    "bpm_min": 85, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_acoustic_min": 0.3,
    "genres_allowed": ["Folk", "Pop---Indie Pop", "Electronic---Chillout"],
    "descripcion_canal": "Ambiente chill para tiendas de decoración"
  }'::jsonb);

  -- Asociar canales de retail al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_retail, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_retail;

  -- ========================================
  -- SECTOR: Salud (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Sala de Espera', 'Relajante para esperas', 121, true, v_sector_salud, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "Classical", "New Age"],
    "descripcion_canal": "Música muy relajante para salas de espera"
  }'::jsonb),
  ('Farmacia Calm', 'Tranquilo para farmacias', 122, true, v_sector_salud, '{
    "bpm_min": 65, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "genres_allowed": ["Electronic---Chillout", "Classical", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Ambiente tranquilo para farmacias"
  }'::jsonb),
  ('Clínica Serena', 'Ambiente clínico relajante', 123, true, v_sector_salud, '{
    "bpm_min": 60, "bpm_max": 80,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "New Age"],
    "descripcion_canal": "Ambiente sereno para clínicas"
  }'::jsonb),
  ('Dental Relax', 'Reduce ansiedad dental', 124, true, v_sector_salud, '{
    "bpm_min": 55, "bpm_max": 75,
    "arousal_min": 1, "arousal_max": 2,
    "valence_min": 4, "valence_max": 6,
    "mood_aggressive_max": 0.01,
    "mood_relaxed_min": 0.9,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "New Age"],
    "descripcion_canal": "Música para reducir ansiedad en dentistas"
  }'::jsonb),
  ('Óptica Moderna', 'Contemporáneo suave', 125, true, v_sector_salud, '{
    "bpm_min": 75, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.5,
    "genres_allowed": ["Electronic---Chillout", "Pop---Indie Pop"],
    "descripcion_canal": "Ambiente contemporáneo para ópticas"
  }'::jsonb),
  ('Consulta Médica', 'Profesional y calmado', 126, true, v_sector_salud, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.7,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Electronic---Ambient"],
    "descripcion_canal": "Ambiente profesional para consultas"
  }'::jsonb),
  ('Pediatría Suave', 'Suave para niños', 127, true, v_sector_salud, '{
    "bpm_min": 70, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.6,
    "mood_happy_min": 0.3,
    "genres_allowed": ["New Age", "Classical"],
    "descripcion_canal": "Música suave para pediatría"
  }'::jsonb),
  ('Fisio Activa', 'Motivación suave para fisio', 128, true, v_sector_salud, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Electronic---Chillout", "Pop---Indie Pop"],
    "descripcion_canal": "Motivación suave para fisioterapia"
  }'::jsonb),
  ('Centro Médico', 'Neutro y profesional', 129, true, v_sector_salud, '{
    "bpm_min": 65, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Electronic---Ambient", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Ambiente neutro para centros médicos"
  }'::jsonb),
  ('Laboratorio Zen', 'Ambiente laboratorio', 130, true, v_sector_salud, '{
    "bpm_min": 60, "bpm_max": 80,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 4, "valence_max": 6,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "New Age"],
    "descripcion_canal": "Ambiente zen para laboratorios"
  }'::jsonb);

  -- Asociar canales de salud al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_salud, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_salud;

  -- ========================================
  -- SECTOR: Bienestar (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Spa Sanctuary', 'Relajación profunda spa', 131, true, v_sector_bienestar, '{
    "bpm_min": 50, "bpm_max": 75,
    "arousal_min": 1, "arousal_max": 2,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.01,
    "mood_relaxed_min": 0.9,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["New Age", "Electronic---Ambient"],
    "descripcion_canal": "Relajación profunda para spas"
  }'::jsonb),
  ('Yoga Flow', 'Para sesiones de yoga', 132, true, v_sector_bienestar, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 1, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.7,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["New Age", "Electronic---Ambient", "Folk, World, &amp; Country---Indian Classical"],
    "descripcion_canal": "Música para sesiones de yoga"
  }'::jsonb),
  ('Gym Power', 'Energía para entrenar', 133, true, v_sector_bienestar, '{
    "bpm_min": 130, "bpm_max": 160,
    "arousal_min": 7, "arousal_max": 9,
    "valence_min": 6, "valence_max": 9,
    "mood_aggressive_min": 0.3,
    "mood_party_min": 0.5,
    "danceability_min": 0.7,
    "genres_allowed": ["Electronic---House", "Electronic---Techno", "Hip Hop", "Rock---Hard Rock"],
    "descripcion_canal": "Alta energía para entrenamientos"
  }'::jsonb),
  ('Pilates Calm', 'Concentrado para pilates', 134, true, v_sector_bienestar, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Chillout", "New Age"],
    "descripcion_canal": "Concentración para pilates"
  }'::jsonb),
  ('Meditación Guía', 'Ambiente meditativo', 135, true, v_sector_bienestar, '{
    "bpm_min": 40, "bpm_max": 65,
    "arousal_min": 1, "arousal_max": 2,
    "valence_min": 4, "valence_max": 6,
    "mood_aggressive_max": 0.01,
    "mood_relaxed_min": 0.9,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["New Age", "Electronic---Ambient"],
    "descripcion_canal": "Ambiente para meditación"
  }'::jsonb),
  ('Cardio Blast', 'Alta intensidad cardio', 136, true, v_sector_bienestar, '{
    "bpm_min": 140, "bpm_max": 170,
    "arousal_min": 8, "arousal_max": 9,
    "valence_min": 6, "valence_max": 9,
    "mood_aggressive_min": 0.4,
    "mood_party_min": 0.6,
    "danceability_min": 0.8,
    "genres_allowed": ["Electronic---House", "Electronic---Techno", "Electronic---Trance"],
    "descripcion_canal": "Máxima intensidad para cardio"
  }'::jsonb),
  ('Stretching Zone', 'Estiramientos suaves', 137, true, v_sector_bienestar, '{
    "bpm_min": 70, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "genres_allowed": ["Electronic---Chillout", "New Age"],
    "descripcion_canal": "Música para estiramientos"
  }'::jsonb),
  ('Wellness Pool', 'Para zonas de piscina', 138, true, v_sector_bienestar, '{
    "bpm_min": 75, "bpm_max": 100,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Electronic---Chillout", "Electronic---Tropical House"],
    "descripcion_canal": "Ambiente para zonas de piscina"
  }'::jsonb),
  ('Sauna Relax', 'Calma para saunas', 139, true, v_sector_bienestar, '{
    "bpm_min": 50, "bpm_max": 75,
    "arousal_min": 1, "arousal_max": 2,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.01,
    "mood_relaxed_min": 0.9,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["New Age", "Electronic---Ambient"],
    "descripcion_canal": "Calma profunda para saunas"
  }'::jsonb),
  ('Functional Training', 'Entrenamiento funcional', 140, true, v_sector_bienestar, '{
    "bpm_min": 120, "bpm_max": 145,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_aggressive_min": 0.2,
    "mood_party_min": 0.4,
    "danceability_min": 0.6,
    "genres_allowed": ["Electronic---House", "Hip Hop", "Rock---Alternative Rock"],
    "descripcion_canal": "Energía para entrenamiento funcional"
  }'::jsonb);

  -- Asociar canales de bienestar al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_bienestar, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_bienestar;

  -- ========================================
  -- SECTOR: Belleza (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Salón Trendy', 'Pop moderno para salones', 141, true, v_sector_belleza, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "danceability_min": 0.5,
    "genres_allowed": ["Pop", "Electronic---Synth-pop"],
    "descripcion_canal": "Pop moderno para salones de belleza"
  }'::jsonb),
  ('Barbería Classic', 'Rock y soul para barberías', 142, true, v_sector_belleza, '{
    "bpm_min": 90, "bpm_max": 120,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.4,
    "genres_allowed": ["Rock---Classic Rock", "Funk / Soul---Soul", "Blues"],
    "descripcion_canal": "Rock y soul clásico para barberías"
  }'::jsonb),
  ('Nail Spa', 'Chill para manicuras', 143, true, v_sector_belleza, '{
    "bpm_min": 85, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Electronic---Chillout", "Pop---Indie Pop"],
    "descripcion_canal": "Ambiente chill para manicuras"
  }'::jsonb),
  ('Color & Style', 'Moderno y energético', 144, true, v_sector_belleza, '{
    "bpm_min": 100, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.3,
    "genres_allowed": ["Pop", "Electronic---House", "Funk / Soul---Contemporary R&B"],
    "descripcion_canal": "Moderno y energético para coloristas"
  }'::jsonb),
  ('Estética Zen', 'Relajante para tratamientos', 145, true, v_sector_belleza, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.7,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["New Age", "Electronic---Ambient"],
    "descripcion_canal": "Ambiente zen para tratamientos faciales"
  }'::jsonb),
  ('Hair Studio', 'Urbano para estudios', 146, true, v_sector_belleza, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.4,
    "genres_allowed": ["Hip Hop", "Funk / Soul---Contemporary R&B", "Electronic---House"],
    "descripcion_canal": "Urbano moderno para estudios de pelo"
  }'::jsonb),
  ('Beauty Lounge', 'Elegante para centros premium', 147, true, v_sector_belleza, '{
    "bpm_min": 85, "bpm_max": 110,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.4,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Electronic---Lounge", "Jazz---Nu Jazz", "Electronic---Chillout"],
    "descripcion_canal": "Ambiente elegante para centros premium"
  }'::jsonb),
  ('Men''s Grooming', 'Masculino para barberías', 148, true, v_sector_belleza, '{
    "bpm_min": 95, "bpm_max": 115,
    "arousal_min": 4, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Rock---Classic Rock", "Blues", "Funk / Soul---Soul"],
    "descripcion_canal": "Ambiente masculino para grooming"
  }'::jsonb),
  ('Makeup Session', 'Energético para maquillaje', 149, true, v_sector_belleza, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.4,
    "genres_allowed": ["Pop", "Electronic---Dance-pop", "Funk / Soul---Disco"],
    "descripcion_canal": "Energético para sesiones de maquillaje"
  }'::jsonb),
  ('Spa Facial', 'Suave para faciales', 150, true, v_sector_belleza, '{
    "bpm_min": 65, "bpm_max": 90,
    "arousal_min": 1, "arousal_max": 3,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.8,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["New Age", "Electronic---Ambient"],
    "descripcion_canal": "Música suave para tratamientos faciales"
  }'::jsonb);

  -- Asociar canales de belleza al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_belleza, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_belleza;

  -- ========================================
  -- SECTOR: Oficinas / Coworking (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Focus Mode', 'Concentración profunda', 151, true, v_sector_oficinas, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "Electronic---Minimal"],
    "descripcion_canal": "Concentración profunda para trabajo"
  }'::jsonb),
  ('Creative Space', 'Inspiración creativa', 152, true, v_sector_oficinas, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Electronic---Downtempo", "Pop---Indie Pop", "Electronic---IDM"],
    "descripcion_canal": "Inspiración para trabajo creativo"
  }'::jsonb),
  ('Meeting Room', 'Fondo para reuniones', 153, true, v_sector_oficinas, '{
    "bpm_min": 70, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.5,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Jazz---Smooth Jazz", "Classical", "Electronic---Ambient"],
    "descripcion_canal": "Fondo discreto para reuniones"
  }'::jsonb),
  ('Startup Energy', 'Motivación para startups', 154, true, v_sector_oficinas, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.3,
    "genres_allowed": ["Pop---Indie Pop", "Electronic---Synth-pop", "Rock---Alternative Rock"],
    "descripcion_canal": "Energía motivacional para startups"
  }'::jsonb),
  ('Executive Lounge', 'Elegante para ejecutivos', 155, true, v_sector_oficinas, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 8,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.5,
    "genres_allowed": ["Jazz---Smooth Jazz", "Classical", "Electronic---Lounge"],
    "descripcion_canal": "Ambiente elegante para ejecutivos"
  }'::jsonb),
  ('Coworking Vibes', 'Ambiente colaborativo', 156, true, v_sector_oficinas, '{
    "bpm_min": 85, "bpm_max": 110,
    "arousal_min": 4, "arousal_max": 6,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.4,
    "genres_allowed": ["Pop---Indie Pop", "Electronic---Chillout", "Hip Hop---Instrumental"],
    "descripcion_canal": "Ambiente para espacios de coworking"
  }'::jsonb),
  ('Break Room', 'Para zonas de descanso', 157, true, v_sector_oficinas, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 4, "arousal_max": 6,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_relaxed_min": 0.3,
    "genres_allowed": ["Pop", "Folk", "Funk / Soul---Soul"],
    "descripcion_canal": "Ambiente para zonas de descanso"
  }'::jsonb),
  ('Deadline Push', 'Productividad intensa', 158, true, v_sector_oficinas, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.3,
    "danceability_min": 0.4,
    "genres_allowed": ["Electronic---House", "Electronic---Minimal Techno"],
    "descripcion_canal": "Productividad para fechas límite"
  }'::jsonb),
  ('Monday Motivation', 'Empezar la semana', 159, true, v_sector_oficinas, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "genres_allowed": ["Pop", "Funk / Soul---Soul", "Rock---Pop Rock"],
    "descripcion_canal": "Motivación para empezar la semana"
  }'::jsonb),
  ('Friday Wind Down', 'Cerrar la semana', 160, true, v_sector_oficinas, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_relaxed_min": 0.5,
    "mood_happy_min": 0.4,
    "genres_allowed": ["Electronic---Chillout", "Folk", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Relajación para cerrar la semana"
  }'::jsonb);

  -- Asociar canales de oficinas al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_oficinas, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_oficinas;

  -- ========================================
  -- SECTOR: Educación (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Biblioteca Silencio', 'Muy suave para estudiar', 161, true, v_sector_educacion, '{
    "bpm_min": 50, "bpm_max": 75,
    "arousal_min": 1, "arousal_max": 2,
    "valence_min": 4, "valence_max": 6,
    "mood_aggressive_max": 0.01,
    "mood_relaxed_min": 0.9,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "Classical"],
    "descripcion_canal": "Silencio musical para bibliotecas"
  }'::jsonb),
  ('Guardería Alegre', 'Infantil y alegre', 162, true, v_sector_educacion, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 8, "valence_max": 9,
    "mood_happy_min": 0.8,
    "mood_sad_max": 0.05,
    "genres_allowed": ["Pop", "Children"],
    "descripcion_canal": "Música alegre para guarderías"
  }'::jsonb),
  ('Academia Focus', 'Concentración estudiantes', 163, true, v_sector_educacion, '{
    "bpm_min": 65, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "Classical"],
    "descripcion_canal": "Concentración para academias"
  }'::jsonb),
  ('Recreo Activo', 'Energía para recreos', 164, true, v_sector_educacion, '{
    "bpm_min": 110, "bpm_max": 135,
    "arousal_min": 7, "arousal_max": 9,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.7,
    "mood_party_min": 0.5,
    "genres_allowed": ["Pop", "Electronic---Dance-pop"],
    "descripcion_canal": "Energía para tiempos de recreo"
  }'::jsonb),
  ('Sala de Estudio', 'Ambiente de estudio', 165, true, v_sector_educacion, '{
    "bpm_min": 60, "bpm_max": 85,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Electronic---Ambient", "Classical", "Hip Hop---Instrumental"],
    "descripcion_canal": "Ambiente para salas de estudio"
  }'::jsonb),
  ('Música Infantil', 'Canciones para niños', 166, true, v_sector_educacion, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.7,
    "genres_allowed": ["Children", "Pop"],
    "descripcion_canal": "Canciones infantiles educativas"
  }'::jsonb),
  ('Universidad Chill', 'Lo-fi para universitarios', 167, true, v_sector_educacion, '{
    "bpm_min": 70, "bpm_max": 95,
    "arousal_min": 2, "arousal_max": 5,
    "valence_min": 4, "valence_max": 7,
    "mood_relaxed_min": 0.5,
    "genres_allowed": ["Hip Hop---Instrumental", "Electronic---Downtempo"],
    "descripcion_canal": "Lo-fi chill para universitarios"
  }'::jsonb),
  ('Arte y Creatividad', 'Inspiración artística', 168, true, v_sector_educacion, '{
    "bpm_min": 75, "bpm_max": 100,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Classical", "Electronic---IDM", "Jazz"],
    "descripcion_canal": "Inspiración para clases de arte"
  }'::jsonb),
  ('Idiomas World', 'Multicultural suave', 169, true, v_sector_educacion, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "genres_allowed": ["Folk, World, &amp; Country", "Jazz---Bossa Nova", "Latin"],
    "descripcion_canal": "Música multicultural para idiomas"
  }'::jsonb),
  ('Graduación', 'Celebración académica', 170, true, v_sector_educacion, '{
    "bpm_min": 100, "bpm_max": 125,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "mood_party_min": 0.4,
    "genres_allowed": ["Pop", "Rock---Pop Rock", "Classical"],
    "descripcion_canal": "Celebración para graduaciones"
  }'::jsonb);

  -- Asociar canales de educación al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_educacion, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_educacion;

  -- ========================================
  -- SECTOR: Servicios Profesionales (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Banca Elegante', 'Sofisticado para bancos', 171, true, v_sector_servicios, '{
    "bpm_min": 70, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.5,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Ambiente sofisticado para bancos"
  }'::jsonb),
  ('Sala de Espera Pro', 'Profesional neutro', 172, true, v_sector_servicios, '{
    "bpm_min": 65, "bpm_max": 85,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Electronic---Ambient", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Ambiente profesional para esperas"
  }'::jsonb),
  ('Inmobiliaria Premium', 'Aspiracional para inmob.', 173, true, v_sector_servicios, '{
    "bpm_min": 80, "bpm_max": 100,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "mood_relaxed_min": 0.4,
    "genres_allowed": ["Electronic---Lounge", "Jazz---Smooth Jazz", "Pop---Indie Pop"],
    "descripcion_canal": "Ambiente aspiracional para inmobiliarias"
  }'::jsonb),
  ('Seguros Confianza', 'Transmite seguridad', 174, true, v_sector_servicios, '{
    "bpm_min": 70, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.5,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Jazz---Smooth Jazz"],
    "descripcion_canal": "Ambiente de confianza para aseguradoras"
  }'::jsonb),
  ('Asesoría Calm', 'Ambiente de consultoría', 175, true, v_sector_servicios, '{
    "bpm_min": 65, "bpm_max": 85,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Electronic---Ambient"],
    "descripcion_canal": "Ambiente calmado para asesorías"
  }'::jsonb),
  ('Legal Office', 'Serio y profesional', 176, true, v_sector_servicios, '{
    "bpm_min": 60, "bpm_max": 80,
    "arousal_min": 2, "arousal_max": 3,
    "valence_min": 4, "valence_max": 6,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical"],
    "descripcion_canal": "Ambiente serio para bufetes"
  }'::jsonb),
  ('Gestión Administrativa', 'Neutro para gestorías', 177, true, v_sector_servicios, '{
    "bpm_min": 70, "bpm_max": 90,
    "arousal_min": 2, "arousal_max": 4,
    "valence_min": 4, "valence_max": 7,
    "mood_aggressive_max": 0.05,
    "mood_relaxed_min": 0.5,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical", "Jazz---Smooth Jazz", "Electronic---Ambient"],
    "descripcion_canal": "Ambiente neutro para gestorías"
  }'::jsonb),
  ('Inversiones', 'Sofisticado financiero', 178, true, v_sector_servicios, '{
    "bpm_min": 75, "bpm_max": 95,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 7,
    "mood_aggressive_max": 0.1,
    "mood_relaxed_min": 0.4,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Jazz---Smooth Jazz", "Electronic---Lounge"],
    "descripcion_canal": "Ambiente sofisticado para finanzas"
  }'::jsonb),
  ('Notaría Clásica', 'Tradicional y serio', 179, true, v_sector_servicios, '{
    "bpm_min": 60, "bpm_max": 80,
    "arousal_min": 2, "arousal_max": 3,
    "valence_min": 4, "valence_max": 6,
    "mood_aggressive_max": 0.02,
    "mood_relaxed_min": 0.6,
    "voice_instrumental": "instrumental",
    "genres_allowed": ["Classical---Baroque", "Classical---Romantic"],
    "descripcion_canal": "Ambiente clásico para notarías"
  }'::jsonb),
  ('Atención Cliente', 'Agradable para atención', 180, true, v_sector_servicios, '{
    "bpm_min": 75, "bpm_max": 95,
    "arousal_min": 3, "arousal_max": 5,
    "valence_min": 5, "valence_max": 8,
    "mood_happy_min": 0.3,
    "mood_relaxed_min": 0.4,
    "genres_allowed": ["Pop---Light Music", "Jazz---Smooth Jazz", "Electronic---Chillout"],
    "descripcion_canal": "Ambiente agradable para atención al cliente"
  }'::jsonb);

  -- Asociar canales de servicios al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_servicios, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_servicios;

  -- ========================================
  -- SECTOR: Ocio / Entretenimiento (10 canales)
  -- ========================================
  INSERT INTO canales (nombre, descripcion, orden, activo, sector_exclusivo_id, criterios_musicales) VALUES
  ('Cinema Lobby', 'Épico para lobbies de cine', 181, true, v_sector_ocio, '{
    "bpm_min": 80, "bpm_max": 105,
    "arousal_min": 4, "arousal_max": 7,
    "valence_min": 5, "valence_max": 8,
    "mood_epic_min": 0.4,
    "genres_allowed": ["Stage &amp; Screen---Score", "Stage &amp; Screen---Soundtrack"],
    "descripcion_canal": "Bandas sonoras épicas para cines"
  }'::jsonb),
  ('Bowling Nights', 'Fiesta para boleras', 182, true, v_sector_ocio, '{
    "bpm_min": 115, "bpm_max": 135,
    "arousal_min": 7, "arousal_max": 9,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "mood_party_min": 0.7,
    "danceability_min": 0.7,
    "genres_allowed": ["Pop", "Rock---Classic Rock", "Electronic---Dance-pop"],
    "descripcion_canal": "Fiesta nocturna para boleras"
  }'::jsonb),
  ('Arcade Retro', '80s para arcades', 183, true, v_sector_ocio, '{
    "bpm_min": 110, "bpm_max": 135,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.5,
    "mood_electronic_min": 0.4,
    "genres_allowed": ["Electronic---Synth-pop", "Pop", "Electronic---Synthwave"],
    "descripcion_canal": "Música retro 80s para arcades"
  }'::jsonb),
  ('Karaoke Party', 'Hits cantables', 184, true, v_sector_ocio, '{
    "bpm_min": 100, "bpm_max": 130,
    "arousal_min": 5, "arousal_max": 8,
    "valence_min": 6, "valence_max": 9,
    "mood_happy_min": 0.5,
    "mood_party_min": 0.5,
    "voice_instrumental": "voice",
    "genres_allowed": ["Pop", "Rock---Pop Rock", "Funk / Soul---Disco"],
    "descripcion_canal": "Hits populares para karaoke"
  }'::jsonb),
  ('Escape Room', 'Tensión y misterio', 185, true, v_sector_ocio, '{
    "bpm_min": 90, "bpm_max": 115,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 3, "valence_max": 6,
    "mood_dark_min": 0.4,
    "mood_happy_max": 0.4,
    "genres_allowed": ["Stage &amp; Screen---Score", "Electronic---Dark Ambient"],
    "descripcion_canal": "Tensión y misterio para escape rooms"
  }'::jsonb),
  ('Laser Tag', 'Energía para laser tag', 186, true, v_sector_ocio, '{
    "bpm_min": 125, "bpm_max": 150,
    "arousal_min": 8, "arousal_max": 9,
    "valence_min": 6, "valence_max": 9,
    "mood_aggressive_min": 0.3,
    "mood_party_min": 0.5,
    "danceability_min": 0.6,
    "genres_allowed": ["Electronic---Techno", "Electronic---Drum n Bass", "Electronic---Dubstep"],
    "descripcion_canal": "Energía extrema para laser tag"
  }'::jsonb),
  ('Mini Golf', 'Divertido y familiar', 187, true, v_sector_ocio, '{
    "bpm_min": 95, "bpm_max": 120,
    "arousal_min": 5, "arousal_max": 7,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "genres_allowed": ["Pop", "Funk / Soul---Disco", "Rock---Pop Rock"],
    "descripcion_canal": "Ambiente divertido para mini golf"
  }'::jsonb),
  ('Gaming Zone', 'Electrónica para gaming', 188, true, v_sector_ocio, '{
    "bpm_min": 120, "bpm_max": 145,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 5, "valence_max": 8,
    "mood_party_min": 0.4,
    "mood_electronic_min": 0.7,
    "genres_allowed": ["Electronic---Techno", "Electronic---House", "Electronic---Dubstep"],
    "descripcion_canal": "Electrónica para zonas de gaming"
  }'::jsonb),
  ('Party Room', 'Celebraciones y fiestas', 189, true, v_sector_ocio, '{
    "bpm_min": 115, "bpm_max": 135,
    "arousal_min": 7, "arousal_max": 9,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.7,
    "mood_party_min": 0.8,
    "danceability_min": 0.7,
    "genres_allowed": ["Pop", "Electronic---Dance-pop", "Latin---Reggaeton"],
    "descripcion_canal": "Música de fiesta para celebraciones"
  }'::jsonb),
  ('Fun Center', 'Familiar y animado', 190, true, v_sector_ocio, '{
    "bpm_min": 105, "bpm_max": 130,
    "arousal_min": 6, "arousal_max": 8,
    "valence_min": 7, "valence_max": 9,
    "mood_happy_min": 0.6,
    "mood_party_min": 0.5,
    "genres_allowed": ["Pop", "Funk / Soul---Disco", "Electronic---Dance-pop"],
    "descripcion_canal": "Ambiente animado para centros de diversión"
  }'::jsonb);

  -- Asociar canales de ocio al sector
  INSERT INTO sector_canales_recomendados (sector_id, canal_id, orden)
  SELECT v_sector_ocio, id, orden FROM canales WHERE sector_exclusivo_id = v_sector_ocio;

END $$;

-- ============================================================================
-- SECCIÓN 7: ACTUALIZAR SECCIONES_HOME CON NUEVOS TIPOS
-- ============================================================================

-- Modificar tipo de sección para incluir nuevos valores
ALTER TABLE secciones_home DROP CONSTRAINT IF EXISTS secciones_home_tipo_check;
ALTER TABLE secciones_home ADD CONSTRAINT secciones_home_tipo_check 
  CHECK (tipo IN (
    'sector',        -- Canales exclusivos del sector del usuario
    'categoria',     -- Filtrado por categoría específica
    'favoritos',     -- Canales favoritos del usuario
    'recientes',     -- Canales actualizados recientemente
    'populares',     -- Canales más escuchados
    'destacados',    -- Canales marcados como destacados
    'manual',        -- Canales seleccionados manualmente
    'todos',         -- NUEVO: Todos los canales
    'nuevos',        -- NUEVO: Canales nuevos (últimos 30 días)
    'estacional'     -- NUEVO: Canales estacionales (activos según temporada)
  ));

-- Insertar las nuevas secciones del home
DO $$
DECLARE
  v_cat_radio UUID;
  v_cat_animado UUID;
  v_cat_concentracion UUID;
  v_cat_latino UUID;
  v_cat_todos UUID;
  v_cat_relajado UUID;
  v_cat_generos UUID;
BEGIN
  -- Obtener IDs de categorías
  SELECT id INTO v_cat_radio FROM categorias WHERE slug = 'fm-radio';
  SELECT id INTO v_cat_animado FROM categorias WHERE slug = 'mix-animado';
  SELECT id INTO v_cat_concentracion FROM categorias WHERE slug = 'concentracion';
  SELECT id INTO v_cat_latino FROM categorias WHERE slug = 'mix-latino';
  SELECT id INTO v_cat_todos FROM categorias WHERE slug = 'para-todos';
  SELECT id INTO v_cat_relajado FROM categorias WHERE slug = 'relajado';
  SELECT id INTO v_cat_generos FROM categorias WHERE slug = 'generos';

  INSERT INTO secciones_home (titulo, slug, tipo, orden, activo, descripcion, icono, filtro_json) VALUES
    ('Recomendados para ti', 'recomendados', 'sector', 1, true, 'Canales exclusivos según tu sector', 'star', NULL),
    ('Novedades', 'novedades', 'nuevos', 2, true, 'Canales añadidos recientemente', 'sparkles', '{"dias_recientes": 30}'::jsonb),
    ('Estacionales', 'estacionales', 'estacional', 3, false, 'Canales de temporada', 'calendar', NULL),
    ('Todos los canales', 'todos-canales', 'todos', 4, true, 'Todos los canales disponibles', 'grid', NULL),
    ('FM Radio', 'fm-radio-section', 'categoria', 5, true, 'Emisoras y estilo radio tradicional', 'radio', json_build_object('categoria_id', v_cat_radio)::jsonb),
    ('Mix Animado', 'mix-animado-section', 'categoria', 6, true, 'Música energética para ambientes dinámicos', 'bolt', json_build_object('categoria_id', v_cat_animado)::jsonb),
    ('Concentración', 'concentracion-section', 'categoria', 7, true, 'Música para enfoque y productividad', 'brain', json_build_object('categoria_id', v_cat_concentracion)::jsonb),
    ('Mix Latino', 'mix-latino-section', 'categoria', 8, true, 'Música latina en todas sus variantes', 'fire', json_build_object('categoria_id', v_cat_latino)::jsonb),
    ('Para todos los gustos', 'para-todos-section', 'categoria', 9, true, 'Mezclas eclécticas y variadas', 'music', json_build_object('categoria_id', v_cat_todos)::jsonb),
    ('En plan relajado', 'relajado-section', 'categoria', 10, true, 'Música chill y ambiente tranquilo', 'cloud', json_build_object('categoria_id', v_cat_relajado)::jsonb),
    ('Géneros', 'generos-section', 'categoria', 11, true, 'Géneros musicales puros', 'vinyl', json_build_object('categoria_id', v_cat_generos)::jsonb);
END $$;

-- ============================================================================
-- SECCIÓN 8: ACTUALIZAR RPC rpc_get_section_channels
-- ============================================================================

CREATE OR REPLACE FUNCTION rpc_get_section_channels(p_seccion_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_sector_id UUID;
  v_seccion_tipo TEXT;
  v_categoria_id UUID;
  v_filtro JSONB;
  v_result JSON;
BEGIN
  -- Obtener usuario_id y sector_id
  SELECT id, sector_id INTO v_usuario_id, v_sector_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('error', 'Usuario no encontrado');
  END IF;
  
  -- Obtener tipo de sección y filtro
  SELECT tipo, filtro_json INTO v_seccion_tipo, v_filtro
  FROM secciones_home
  WHERE id = p_seccion_id AND activo = true;
  
  IF v_seccion_tipo IS NULL THEN
    RETURN json_build_object('error', 'Sección no encontrada');
  END IF;
  
  -- Según el tipo de sección, ejecutar la query correspondiente
  CASE v_seccion_tipo
    
    -- TIPO: sector (canales exclusivos del sector del usuario)
    WHEN 'sector' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'orden', scr.orden
        ) ORDER BY scr.orden
      ) INTO v_result
      FROM sector_canales_recomendados scr
      JOIN canales c ON c.id = scr.canal_id
      WHERE scr.sector_id = v_sector_id
        AND c.activo = true
      LIMIT 20;
    
    -- TIPO: favoritos (canales favoritos del usuario)
    WHEN 'favoritos' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'fecha_favorito', ucf.created_at
        ) ORDER BY ucf.created_at DESC
      ) INTO v_result
      FROM usuario_canales_favoritos ucf
      JOIN canales c ON c.id = ucf.canal_id
      WHERE ucf.usuario_id = v_usuario_id
        AND c.activo = true
      LIMIT 20;
    
    -- TIPO: nuevos (canales creados recientemente)
    WHEN 'nuevos' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'created_at', c.created_at
        ) ORDER BY c.created_at DESC
      ) INTO v_result
      FROM canales c
      WHERE c.activo = true
        AND c.created_at >= now() - interval '30 days'
      LIMIT 20;
    
    -- TIPO: recientes (canales actualizados recientemente)
    WHEN 'recientes' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'updated_at', c.updated_at
        ) ORDER BY c.updated_at DESC
      ) INTO v_result
      FROM canales c
      WHERE c.activo = true
        AND c.updated_at >= now() - interval '7 days'
      LIMIT 20;
    
    -- TIPO: populares (más escuchados)
    WHEN 'populares' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'play_count', COUNT(ph.id)
        ) ORDER BY COUNT(ph.id) DESC
      ) INTO v_result
      FROM canales c
      LEFT JOIN playback_history ph ON ph.canal_id = c.id 
        AND ph.created_at >= now() - interval '30 days'
      WHERE c.activo = true
      GROUP BY c.id
      LIMIT 20;
    
    -- TIPO: destacados (canales marcados como destacados)
    WHEN 'destacados' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'orden', c.orden
        ) ORDER BY c.orden
      ) INTO v_result
      FROM canales c
      WHERE c.activo = true
        AND c.destacado = true
      LIMIT 20;
    
    -- TIPO: categoria (filtrado por categoría)
    WHEN 'categoria' THEN
      -- Buscar categoria_id del filtro_json
      v_categoria_id := (v_filtro->>'categoria_id')::UUID;
      
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'orden', cc.orden
        ) ORDER BY cc.orden
      ) INTO v_result
      FROM categoria_canales cc
      JOIN canales c ON c.id = cc.canal_id
      WHERE cc.categoria_id = v_categoria_id
        AND c.activo = true
      LIMIT 20;
    
    -- TIPO: manual (canales seleccionados manualmente)
    WHEN 'manual' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'orden', sc.orden
        ) ORDER BY sc.orden
      ) INTO v_result
      FROM seccion_canales sc
      JOIN canales c ON c.id = sc.canal_id
      WHERE sc.seccion_id = p_seccion_id
        AND c.activo = true
      LIMIT 20;
    
    -- TIPO: todos (todos los canales activos)
    WHEN 'todos' THEN
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'orden', c.orden
        ) ORDER BY c.orden
      ) INTO v_result
      FROM canales c
      WHERE c.activo = true;
    
    -- TIPO: estacional (canales estacionales activos)
    WHEN 'estacional' THEN
      -- Por ahora retornamos vacío, se activará según temporada
      SELECT json_agg(
        json_build_object(
          'id', c.id,
          'nombre', c.nombre,
          'descripcion', c.descripcion,
          'imagen_url', c.imagen_url,
          'orden', sc.orden
        ) ORDER BY sc.orden
      ) INTO v_result
      FROM seccion_canales sc
      JOIN canales c ON c.id = sc.canal_id
      WHERE sc.seccion_id = p_seccion_id
        AND c.activo = true
      LIMIT 20;
    
    ELSE
      RETURN json_build_object('error', 'Tipo de sección no soportado');
  END CASE;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================================
-- SECCIÓN 9: ÍNDICES ADICIONALES PARA RENDIMIENTO
-- ============================================================================

-- Índice para búsqueda por fecha de creación (para tipo 'nuevos')
CREATE INDEX IF NOT EXISTS idx_canales_created_at ON canales(created_at DESC) WHERE activo = true;

-- Índice para canales por categoría
CREATE INDEX IF NOT EXISTS idx_categoria_canales_canal_id ON categoria_canales(canal_id);

-- ============================================================================
-- SECCIÓN 10: COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE sectores IS 'Sectores empresariales: Hostelería, Retail, Salud, Bienestar, Belleza, Oficinas, Educación, Servicios, Ocio';
COMMENT ON TABLE categorias IS 'Categorías musicales: FM Radio, Mix Animado, Concentración, Mix Latino, Para todos los gustos, En plan relajado, Géneros';
COMMENT ON COLUMN canales.criterios_musicales IS 'JSON con criterios de matching para IA (Essentia): bpm_min/max, arousal, valence, moods, géneros, etc.';
COMMENT ON COLUMN canales.sector_exclusivo_id IS 'Si no es NULL, indica que el canal es exclusivo para ese sector';

-- ============================================================================
-- FIN DEL ARCHIVO
-- ============================================================================ 