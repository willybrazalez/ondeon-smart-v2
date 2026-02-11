-- ============================================================================
-- ONDEON SMART v2 - SISTEMA DE SECCIONES Y CATEGORÍAS DE CANALES
-- ============================================================================
-- Archivo: 027_channels_sections_system.sql
-- Descripción: Sistema tipo Spotify para organizar canales en secciones
-- dinámicas, categorías, favoritos y canales destacados.
-- ============================================================================

-- ============================================================================
-- TABLA 1: CATEGORÍAS MUSICALES
-- ============================================================================

CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  icono TEXT, -- Nombre del ícono (ej: 'music', 'jazz', 'chill')
  color_hex TEXT, -- Color para la UI (ej: '#FF5733')
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para categorías activas ordenadas
CREATE INDEX IF NOT EXISTS idx_categorias_activo_orden 
  ON categorias(activo, orden) 
  WHERE activo = true;

COMMENT ON TABLE categorias IS 'Categorías musicales para clasificar canales (Jazz, Pop, Chill, etc.)';

-- ============================================================================
-- TABLA 2: RELACIÓN CANAL-CATEGORÍA (N:N)
-- ============================================================================

CREATE TABLE IF NOT EXISTS categoria_canales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(categoria_id, canal_id)
);

-- Índices para búsquedas bidireccionales
CREATE INDEX IF NOT EXISTS idx_categoria_canales_categoria 
  ON categoria_canales(categoria_id, orden);

CREATE INDEX IF NOT EXISTS idx_categoria_canales_canal 
  ON categoria_canales(canal_id);

COMMENT ON TABLE categoria_canales IS 'Relación muchos a muchos entre categorías y canales';

-- ============================================================================
-- TABLA 3: FAVORITOS DEL USUARIO
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuario_canales_favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, canal_id)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_usuario_favoritos_usuario 
  ON usuario_canales_favoritos(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usuario_favoritos_canal 
  ON usuario_canales_favoritos(canal_id);

COMMENT ON TABLE usuario_canales_favoritos IS 'Canales favoritos marcados por cada usuario';

-- ============================================================================
-- TABLA 4: SECCIONES DEL HOME
-- ============================================================================

CREATE TABLE IF NOT EXISTS secciones_home (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- Tipo de sección que determina la lógica de filtrado
  tipo TEXT NOT NULL CHECK (tipo IN (
    'sector',        -- Filtrado por sector del usuario
    'categoria',     -- Filtrado por categoría específica
    'favoritos',     -- Canales favoritos del usuario
    'recientes',     -- Canales actualizados recientemente
    'populares',     -- Canales más escuchados
    'destacados',    -- Canales marcados como destacados
    'manual'         -- Canales seleccionados manualmente
  )),
  
  -- Configuración JSON para filtros adicionales
  -- Ejemplos:
  --   {"sector_id": "uuid"}
  --   {"categoria_slug": "jazz"}
  --   {"dias_recientes": 7}
  filtro_json JSONB,
  
  -- Control de visualización
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  visible_para_rol TEXT[], -- ['user', 'admin'] o null para todos
  
  -- Metadata
  descripcion TEXT,
  icono TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para secciones activas ordenadas
CREATE INDEX IF NOT EXISTS idx_secciones_home_activo_orden 
  ON secciones_home(activo, orden) 
  WHERE activo = true;

-- Índice para búsqueda por tipo
CREATE INDEX IF NOT EXISTS idx_secciones_home_tipo 
  ON secciones_home(tipo) 
  WHERE activo = true;

COMMENT ON TABLE secciones_home IS 'Secciones dinámicas del home tipo Spotify';
COMMENT ON COLUMN secciones_home.tipo IS 'Determina la lógica de filtrado de canales para esta sección';
COMMENT ON COLUMN secciones_home.filtro_json IS 'Configuración adicional en formato JSON';

-- ============================================================================
-- TABLA 5: CANALES FIJOS EN SECCIONES (TIPO MANUAL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS seccion_canales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seccion_id UUID NOT NULL REFERENCES secciones_home(id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(seccion_id, canal_id)
);

-- Índice para obtener canales de una sección ordenados
CREATE INDEX IF NOT EXISTS idx_seccion_canales_seccion 
  ON seccion_canales(seccion_id, orden);

COMMENT ON TABLE seccion_canales IS 'Canales seleccionados manualmente para secciones tipo "manual"';

-- ============================================================================
-- TABLA 6: AMPLIAR CANALES CON CAMPO DESTACADO
-- ============================================================================

-- Añadir columna destacado a la tabla canales existente
ALTER TABLE canales 
  ADD COLUMN IF NOT EXISTS destacado BOOLEAN DEFAULT false;

-- Índice para canales destacados
CREATE INDEX IF NOT EXISTS idx_canales_destacado 
  ON canales(destacado, orden) 
  WHERE destacado = true AND activo = true;

COMMENT ON COLUMN canales.destacado IS 'Marca canales destacados para sección de recomendados';

-- ============================================================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria_canales ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_canales_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE secciones_home ENABLE ROW LEVEL SECURITY;
ALTER TABLE seccion_canales ENABLE ROW LEVEL SECURITY;

-- Políticas para categorias (lectura pública)
CREATE POLICY "Categorías son públicas para lectura"
  ON categorias FOR SELECT
  TO authenticated
  USING (activo = true);

-- Políticas para categoria_canales (lectura pública)
CREATE POLICY "Relación categoría-canal es pública"
  ON categoria_canales FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para favoritos (usuario solo ve sus propios favoritos)
CREATE POLICY "Usuario puede ver sus favoritos"
  ON usuario_canales_favoritos FOR SELECT
  TO authenticated
  USING (
    usuario_id IN (
      SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Usuario puede insertar sus favoritos"
  ON usuario_canales_favoritos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id IN (
      SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Usuario puede eliminar sus favoritos"
  ON usuario_canales_favoritos FOR DELETE
  TO authenticated
  USING (
    usuario_id IN (
      SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
    )
  );

-- Políticas para secciones_home (lectura pública para activas)
CREATE POLICY "Secciones activas son públicas"
  ON secciones_home FOR SELECT
  TO authenticated
  USING (activo = true);

-- Políticas para seccion_canales (lectura pública)
CREATE POLICY "Canales de sección son públicos"
  ON seccion_canales FOR SELECT
  TO authenticated
  USING (
    seccion_id IN (
      SELECT id FROM secciones_home WHERE activo = true
    )
  );

-- ============================================================================
-- FUNCIONES RPC PARA CONSULTAS OPTIMIZADAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNCIÓN: rpc_get_home_sections
-- Obtiene todas las secciones del home con sus canales correspondientes
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_get_home_sections()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_sector_id UUID;
  v_result JSON;
BEGIN
  -- Obtener usuario_id y sector_id
  SELECT id, sector_id INTO v_usuario_id, v_sector_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('error', 'Usuario no encontrado');
  END IF;
  
  -- Construir el resultado con todas las secciones
  SELECT json_agg(
    json_build_object(
      'id', s.id,
      'titulo', s.titulo,
      'slug', s.slug,
      'tipo', s.tipo,
      'descripcion', s.descripcion,
      'icono', s.icono,
      'orden', s.orden
    ) ORDER BY s.orden
  ) INTO v_result
  FROM secciones_home s
  WHERE s.activo = true
    AND (s.visible_para_rol IS NULL OR 'user' = ANY(s.visible_para_rol));
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: rpc_get_section_channels
-- Obtiene los canales de una sección específica según su tipo
-- ----------------------------------------------------------------------------

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
  v_result JSON;
BEGIN
  -- Obtener usuario_id y sector_id
  SELECT id, sector_id INTO v_usuario_id, v_sector_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('error', 'Usuario no encontrado');
  END IF;
  
  -- Obtener tipo de sección
  SELECT tipo INTO v_seccion_tipo
  FROM secciones_home
  WHERE id = p_seccion_id AND activo = true;
  
  IF v_seccion_tipo IS NULL THEN
    RETURN json_build_object('error', 'Sección no encontrada');
  END IF;
  
  -- Según el tipo de sección, ejecutar la query correspondiente
  CASE v_seccion_tipo
    
    -- TIPO: sector (canales recomendados por sector)
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
      SELECT (filtro_json->>'categoria_id')::UUID INTO v_categoria_id
      FROM secciones_home
      WHERE id = p_seccion_id;
      
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
    
    ELSE
      RETURN json_build_object('error', 'Tipo de sección no soportado');
  END CASE;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: rpc_toggle_favorite_channel
-- Añade o quita un canal de favoritos
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_toggle_favorite_channel(p_canal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_existe BOOLEAN;
BEGIN
  -- Obtener usuario_id
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;
  
  -- Verificar si ya existe
  SELECT EXISTS(
    SELECT 1 FROM usuario_canales_favoritos
    WHERE usuario_id = v_usuario_id AND canal_id = p_canal_id
  ) INTO v_existe;
  
  IF v_existe THEN
    -- Eliminar de favoritos
    DELETE FROM usuario_canales_favoritos
    WHERE usuario_id = v_usuario_id AND canal_id = p_canal_id;
    
    RETURN json_build_object(
      'success', true, 
      'action', 'removed',
      'is_favorite', false
    );
  ELSE
    -- Añadir a favoritos
    INSERT INTO usuario_canales_favoritos (usuario_id, canal_id)
    VALUES (v_usuario_id, p_canal_id);
    
    RETURN json_build_object(
      'success', true, 
      'action', 'added',
      'is_favorite', true
    );
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: rpc_check_is_favorite
-- Verifica si un canal es favorito del usuario
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_check_is_favorite(p_canal_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_is_favorite BOOLEAN;
BEGIN
  -- Obtener usuario_id
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar si existe
  SELECT EXISTS(
    SELECT 1 FROM usuario_canales_favoritos
    WHERE usuario_id = v_usuario_id AND canal_id = p_canal_id
  ) INTO v_is_favorite;
  
  RETURN v_is_favorite;
END;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: rpc_get_user_favorites
-- Obtiene todos los canales favoritos del usuario
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_get_user_favorites()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_result JSON;
BEGIN
  -- Obtener usuario_id
  SELECT id INTO v_usuario_id
  FROM usuarios
  WHERE auth_user_id = auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RETURN '[]'::json;
  END IF;
  
  SELECT json_agg(
    json_build_object(
      'id', c.id,
      'nombre', c.nombre,
      'descripcion', c.descripcion,
      'imagen_url', c.imagen_url,
      'created_at', ucf.created_at
    ) ORDER BY ucf.created_at DESC
  ) INTO v_result
  FROM usuario_canales_favoritos ucf
  JOIN canales c ON c.id = ucf.canal_id
  WHERE ucf.usuario_id = v_usuario_id
    AND c.activo = true;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================================================
-- COMENTARIOS FINALES
-- ============================================================================

COMMENT ON FUNCTION rpc_get_home_sections IS 'Obtiene todas las secciones activas del home';
COMMENT ON FUNCTION rpc_get_section_channels IS 'Obtiene canales de una sección según su tipo (sector, favoritos, recientes, etc.)';
COMMENT ON FUNCTION rpc_toggle_favorite_channel IS 'Añade o quita un canal de favoritos del usuario';
COMMENT ON FUNCTION rpc_check_is_favorite IS 'Verifica si un canal es favorito';
COMMENT ON FUNCTION rpc_get_user_favorites IS 'Obtiene todos los favoritos del usuario';

-- ============================================================================
-- FIN DEL ARCHIVO
-- ============================================================================
