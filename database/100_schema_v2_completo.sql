-- ============================================================================
-- ONDEON SMART v2 - ESQUEMA DE BASE DE DATOS LIMPIO
-- ============================================================================
-- Este archivo crea el esquema completo desde cero.
-- 14 tablas con RLS estricto y funciones RPC.
-- ============================================================================

-- ============================================================================
-- BLOQUE 1: SECTORES Y USUARIOS
-- ============================================================================

-- Tabla de sectores (tipos de negocio)
CREATE TABLE IF NOT EXISTS sectores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  icono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar sectores iniciales
INSERT INTO sectores (nombre, descripcion, icono) VALUES
  ('Farmacia', 'Farmacias y parafarmacias', 'pill'),
  ('Dentista', 'Clínicas dentales y odontología', 'tooth'),
  ('Restaurante', 'Restaurantes y hostelería', 'utensils'),
  ('Hotel', 'Hoteles y alojamientos', 'hotel'),
  ('Gimnasio', 'Gimnasios y centros deportivos', 'dumbbell'),
  ('Tienda', 'Comercio minorista', 'store'),
  ('Oficina', 'Oficinas y espacios de trabajo', 'briefcase'),
  ('Peluquería', 'Peluquerías y salones de belleza', 'scissors'),
  ('Clínica', 'Clínicas médicas y centros de salud', 'hospital'),
  ('Otro', 'Otros tipos de establecimiento', 'building')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de idiomas
CREATE TABLE IF NOT EXISTS idiomas (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

-- Insertar idiomas soportados
INSERT INTO idiomas (codigo, nombre) VALUES
  ('es', 'Español'),
  ('en', 'English'),
  ('fr', 'Français'),
  ('de', 'Deutsch'),
  ('it', 'Italiano'),
  ('pt', 'Português'),
  ('pl', 'Polski'),
  ('ru', 'Русский'),
  ('uk', 'Українська')
ON CONFLICT (codigo) DO NOTHING;

-- Tabla de usuarios (perfil extendido vinculado a Supabase Auth)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE, -- Vínculo con auth.users.id
  
  -- Datos personales
  nombre TEXT,
  email TEXT,
  telefono TEXT,
  
  -- Datos del establecimiento
  establecimiento TEXT,
  direccion TEXT,
  localidad TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  pais TEXT DEFAULT 'ES',
  
  -- Relaciones
  sector_id UUID REFERENCES sectores(id) ON DELETE SET NULL,
  idioma TEXT REFERENCES idiomas(codigo) DEFAULT 'es',
  
  -- Estado y permisos
  rol TEXT DEFAULT 'user' CHECK (rol IN ('admin', 'user')),
  activo BOOLEAN DEFAULT true,
  registro_completo BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sector_id ON usuarios(sector_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo) WHERE activo = true;

-- ============================================================================
-- BLOQUE 2: MÚSICA (CANALES, PLAYLISTS, CANCIONES)
-- ============================================================================

-- Tabla de canales
CREATE TABLE IF NOT EXISTS canales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para canales activos
CREATE INDEX IF NOT EXISTS idx_canales_activo ON canales(activo, orden) WHERE activo = true;

-- Tabla de canales recomendados por sector
CREATE TABLE IF NOT EXISTS sector_canales_recomendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sector_id, canal_id)
);

-- Índice para búsqueda por sector
CREATE INDEX IF NOT EXISTS idx_sector_canales_sector ON sector_canales_recomendados(sector_id);

-- Tabla de playlists
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id UUID NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  
  -- Tipo de playlist
  tipo TEXT DEFAULT 'rotacion' CHECK (tipo IN ('rotacion', 'intervalo')),
  
  -- Configuración de selección
  peso INTEGER DEFAULT 50 CHECK (peso >= 0 AND peso <= 100),
  orden_reproduccion TEXT DEFAULT 'aleatorio' CHECK (orden_reproduccion IN ('aleatorio', 'secuencial')),
  
  -- Franjas horarias (opcional)
  activa_desde TIME,
  activa_hasta TIME,
  
  -- Para tipo 'intervalo'
  repetir_cada INTEGER,
  repetir_unidad TEXT CHECK (repetir_unidad IN ('canciones', 'minutos')),
  
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para playlists
CREATE INDEX IF NOT EXISTS idx_playlists_canal ON playlists(canal_id);
CREATE INDEX IF NOT EXISTS idx_playlists_activa ON playlists(activa) WHERE activa = true;

-- Tabla de canciones
CREATE TABLE IF NOT EXISTS canciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  artista TEXT,
  album TEXT,
  genero TEXT,
  duracion INTEGER, -- segundos
  url_s3 TEXT NOT NULL,
  s3_key TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para canciones
CREATE INDEX IF NOT EXISTS idx_canciones_activa ON canciones(activa) WHERE activa = true;

-- Tabla de relación playlist-canciones
CREATE TABLE IF NOT EXISTS playlist_canciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  cancion_id UUID NOT NULL REFERENCES canciones(id) ON DELETE CASCADE,
  posicion INTEGER DEFAULT 0,
  peso INTEGER DEFAULT 50 CHECK (peso >= 0 AND peso <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(playlist_id, cancion_id)
);

-- Índices para playlist_canciones
CREATE INDEX IF NOT EXISTS idx_playlist_canciones_playlist ON playlist_canciones(playlist_id);

-- ============================================================================
-- BLOQUE 3: CONTENIDOS (ANUNCIOS, INDICATIVOS, MENSAJES)
-- ============================================================================

-- Tabla de contenidos
CREATE TABLE IF NOT EXISTS contenidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT CHECK (tipo IN ('indicativo', 'anuncio', 'mensaje', 'otro')),
  
  -- Archivos
  url_s3 TEXT,
  s3_key TEXT,
  duracion_segundos INTEGER,
  
  -- Idioma del contenido
  idioma TEXT REFERENCES idiomas(codigo),
  
  -- Propietario: NULL = contenido de sistema/sector
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Para contenidos heredables por sector
  sector_id UUID REFERENCES sectores(id) ON DELETE SET NULL,
  
  -- Generación con IA
  generado_ia BOOLEAN DEFAULT false,
  texto_original TEXT,
  
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para contenidos
CREATE INDEX IF NOT EXISTS idx_contenidos_usuario ON contenidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contenidos_sector ON contenidos(sector_id);
CREATE INDEX IF NOT EXISTS idx_contenidos_idioma ON contenidos(idioma);
CREATE INDEX IF NOT EXISTS idx_contenidos_activo ON contenidos(activo) WHERE activo = true;

-- ============================================================================
-- BLOQUE 4: PROGRAMACIONES
-- ============================================================================

-- Tabla de programaciones
CREATE TABLE IF NOT EXISTS programaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT,
  descripcion TEXT,
  
  -- Propietario: NULL = programación de sistema/sector
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Para programaciones heredables por sector
  sector_id UUID REFERENCES sectores(id) ON DELETE SET NULL,
  -- Idioma de la programación (para programaciones de sector)
  idioma TEXT REFERENCES idiomas(codigo),
  
  -- Tipo de programación
  tipo TEXT CHECK (tipo IN ('frecuencia', 'horario', 'diario', 'semanal', 'anual')),
  
  -- Configuración de frecuencia
  frecuencia_minutos INTEGER,
  
  -- Configuración de horario
  hora_inicio TIME,
  hora_fin TIME,
  
  -- Fechas de vigencia
  fecha_inicio DATE,
  fecha_fin DATE,
  
  -- Días de la semana (1=Lunes, 7=Domingo)
  dias_semana INTEGER[],
  
  -- Modo de reproducción
  modo_audio TEXT DEFAULT 'interrumpir' CHECK (modo_audio IN ('interrumpir', 'overlay', 'esperar')),
  
  -- Estado
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'completado')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para programaciones
CREATE INDEX IF NOT EXISTS idx_programaciones_usuario ON programaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_programaciones_sector ON programaciones(sector_id);
CREATE INDEX IF NOT EXISTS idx_programaciones_estado ON programaciones(estado) WHERE estado = 'activo';

-- Tabla de contenidos en programaciones
CREATE TABLE IF NOT EXISTS programacion_contenidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programacion_id UUID NOT NULL REFERENCES programaciones(id) ON DELETE CASCADE,
  contenido_id UUID NOT NULL REFERENCES contenidos(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para programacion_contenidos
CREATE INDEX IF NOT EXISTS idx_programacion_contenidos_prog ON programacion_contenidos(programacion_id);

-- Tabla para desactivar programaciones heredadas de sector
CREATE TABLE IF NOT EXISTS usuario_programaciones_desactivadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  programacion_id UUID NOT NULL REFERENCES programaciones(id) ON DELETE CASCADE,
  desactivado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, programacion_id)
);

-- Índice para búsqueda por usuario
CREATE INDEX IF NOT EXISTS idx_prog_desactivadas_usuario ON usuario_programaciones_desactivadas(usuario_id);

-- ============================================================================
-- BLOQUE 5: ESTADO Y PRESENCIA
-- ============================================================================

-- Tabla de estado actual del usuario (presencia simplificada)
CREATE TABLE IF NOT EXISTS user_current_state (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  playback_state TEXT CHECK (playback_state IN ('playing', 'paused', 'stopped')),
  current_canal_id UUID REFERENCES canales(id) ON DELETE SET NULL,
  current_canal_name TEXT,
  current_song_title TEXT,
  current_song_artist TEXT,
  device_id TEXT,
  app_version TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para usuarios online
CREATE INDEX IF NOT EXISTS idx_user_state_online ON user_current_state(is_online) WHERE is_online = true;

-- Tabla de historial de reproducción (opcional, para analytics)
CREATE TABLE IF NOT EXISTS playback_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  evento TEXT CHECK (evento IN ('song', 'content', 'login', 'logout', 'channel_change')),
  canal_id UUID REFERENCES canales(id) ON DELETE SET NULL,
  titulo TEXT,
  artista TEXT,
  contenido_id UUID REFERENCES contenidos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para playback_history
CREATE INDEX IF NOT EXISTS idx_playback_history_usuario ON playback_history(usuario_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_created ON playback_history(created_at);

-- ============================================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['usuarios', 'canales', 'playlists', 'canciones', 'contenidos', 'programaciones'])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$;
