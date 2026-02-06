-- ============================================================================
-- ONDEON SMART v2 - DATOS INICIALES PARA CATEGORÍAS Y SECCIONES
-- ============================================================================
-- Archivo: 028_seed_categories_sections.sql
-- Descripción: Inserta categorías musicales y secciones del home iniciales
-- Dependencias: Requiere 027_channels_sections_system.sql ejecutado primero
-- ============================================================================

-- ============================================================================
-- INSERTAR CATEGORÍAS MUSICALES
-- ============================================================================

INSERT INTO categorias (nombre, slug, descripcion, icono, color_hex, orden, activo) VALUES
  ('Jazz', 'jazz', 'Jazz suave y sofisticado para ambientes elegantes', 'music-note', '#4A90E2', 1, true),
  ('Pop', 'pop', 'Los mejores éxitos del pop de todos los tiempos', 'star', '#FF6B9D', 2, true),
  ('Rock', 'rock', 'Rock clásico y leyendas del género', 'guitar', '#E74C3C', 3, true),
  ('Chill', 'chill', 'Música relajante y ambient para desconectar', 'cloud', '#95E1D3', 4, true),
  ('Acústico', 'acustico', 'Música acústica íntima y cercana', 'music', '#F9C74F', 5, true),
  ('Electrónica', 'electronica', 'Beats electrónicos y música de baile', 'zap', '#9B59B6', 6, true),
  ('Soul & Funk', 'soul-funk', 'Soul, funk y R&B clásico', 'heart', '#FF8C42', 7, true),
  ('Clásica', 'clasica', 'Música clásica atemporal', 'book', '#6C5CE7', 8, true),
  ('Latino', 'latino', 'Ritmos latinos y música tropical', 'sun', '#FD79A8', 9, true),
  ('Años 70-80', '70-80', 'Los grandes éxitos de los 70 y 80', 'disc', '#FFA502', 10, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- INSERTAR SECCIONES DEL HOME
-- ============================================================================

-- Sección 1: Para tu sector (dinámica según sector del usuario)
INSERT INTO secciones_home (titulo, slug, tipo, orden, activo, descripcion, icono) VALUES
  ('Para tu establecimiento', 'para-tu-sector', 'sector', 1, true, 
   'Canales recomendados para tu tipo de negocio', 'store')
ON CONFLICT (slug) DO NOTHING;

-- Sección 2: Tus favoritos
INSERT INTO secciones_home (titulo, slug, tipo, orden, activo, descripcion, icono) VALUES
  ('Tus favoritos', 'favoritos', 'favoritos', 2, true,
   'Canales que has marcado como favoritos', 'heart')
ON CONFLICT (slug) DO NOTHING;

-- Sección 3: Destacados
INSERT INTO secciones_home (titulo, slug, tipo, orden, activo, descripcion, icono) VALUES
  ('Destacados', 'destacados', 'destacados', 3, true,
   'Los canales más recomendados por ONDEON', 'star')
ON CONFLICT (slug) DO NOTHING;

-- Sección 4: Recién actualizados
INSERT INTO secciones_home (titulo, slug, tipo, orden, activo, descripcion, icono) VALUES
  ('Recién actualizados', 'recientes', 'recientes', 4, true,
   'Canales con contenido nuevo esta semana', 'refresh-cw')
ON CONFLICT (slug) DO NOTHING;

-- Sección 5: Más escuchados
INSERT INTO secciones_home (titulo, slug, tipo, orden, activo, descripcion, icono) VALUES
  ('Más escuchados', 'populares', 'populares', 5, true,
   'Los canales más populares este mes', 'trending-up')
ON CONFLICT (slug) DO NOTHING;

-- Sección 6: Jazz y Soul (categoría específica)
DO $$
DECLARE
  v_jazz_id UUID;
BEGIN
  SELECT id INTO v_jazz_id FROM categorias WHERE slug = 'jazz';
  
  IF v_jazz_id IS NOT NULL THEN
    INSERT INTO secciones_home (titulo, slug, tipo, filtro_json, orden, activo, descripcion, icono) VALUES
      ('Jazz y Soul', 'jazz-soul', 'categoria', 
       json_build_object('categoria_id', v_jazz_id)::jsonb,
       6, true, 'Para ambientes sofisticados y elegantes', 'music')
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- Sección 7: Chill y Relax (categoría específica)
DO $$
DECLARE
  v_chill_id UUID;
BEGIN
  SELECT id INTO v_chill_id FROM categorias WHERE slug = 'chill';
  
  IF v_chill_id IS NOT NULL THEN
    INSERT INTO secciones_home (titulo, slug, tipo, filtro_json, orden, activo, descripcion, icono) VALUES
      ('Chill y Relax', 'chill-relax', 'categoria',
       json_build_object('categoria_id', v_chill_id)::jsonb,
       7, true, 'Música relajante para desconectar', 'cloud')
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- Sección 8: Rock Classics (categoría específica)
DO $$
DECLARE
  v_rock_id UUID;
BEGIN
  SELECT id INTO v_rock_id FROM categorias WHERE slug = 'rock';
  
  IF v_rock_id IS NOT NULL THEN
    INSERT INTO secciones_home (titulo, slug, tipo, filtro_json, orden, activo, descripcion, icono) VALUES
      ('Rock Classics', 'rock-classics', 'categoria',
       json_build_object('categoria_id', v_rock_id)::jsonb,
       8, true, 'Las leyendas del rock', 'guitar')
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- Sección 9: Éxitos del Pop (categoría específica)
DO $$
DECLARE
  v_pop_id UUID;
BEGIN
  SELECT id INTO v_pop_id FROM categorias WHERE slug = 'pop';
  
  IF v_pop_id IS NOT NULL THEN
    INSERT INTO secciones_home (titulo, slug, tipo, filtro_json, orden, activo, descripcion, icono) VALUES
      ('Éxitos del Pop', 'exitos-pop', 'categoria',
       json_build_object('categoria_id', v_pop_id)::jsonb,
       9, true, 'Los mejores hits del pop', 'star')
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- Sección 10: Latinos y Tropicales (categoría específica)
DO $$
DECLARE
  v_latino_id UUID;
BEGIN
  SELECT id INTO v_latino_id FROM categorias WHERE slug = 'latino';
  
  IF v_latino_id IS NOT NULL THEN
    INSERT INTO secciones_home (titulo, slug, tipo, filtro_json, orden, activo, descripcion, icono) VALUES
      ('Latinos y Tropicales', 'latinos-tropicales', 'categoria',
       json_build_object('categoria_id', v_latino_id)::jsonb,
       10, true, 'Ritmos calientes y tropicales', 'sun')
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- ESTADÍSTICAS INSERTADAS
-- ============================================================================

DO $$
DECLARE
  v_categorias_count INTEGER;
  v_secciones_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_categorias_count FROM categorias;
  SELECT COUNT(*) INTO v_secciones_count FROM secciones_home;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATOS INICIALES INSERTADOS CORRECTAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categorías musicales: %', v_categorias_count;
  RAISE NOTICE 'Secciones del home: %', v_secciones_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- FIN DEL ARCHIVO
-- ============================================================================
