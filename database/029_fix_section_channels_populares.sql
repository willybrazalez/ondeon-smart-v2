-- ============================================================================
-- ONDEON SMART v2 - FIX: Función rpc_get_section_channels (caso 'populares')
-- ============================================================================
-- Archivo: 029_fix_section_channels_populares.sql
-- Descripción: Corrige el error "aggregate function calls cannot be nested"
-- en la sección de tipo 'populares'
-- ============================================================================

-- Eliminar y recrear la función completa con la corrección
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
    
    -- TIPO: populares (más escuchados) - CORREGIDO
    WHEN 'populares' THEN
      -- Primero calcular los conteos, luego construir el JSON
      SELECT json_agg(
        json_build_object(
          'id', channel_stats.id,
          'nombre', channel_stats.nombre,
          'descripcion', channel_stats.descripcion,
          'imagen_url', channel_stats.imagen_url,
          'play_count', channel_stats.play_count
        ) ORDER BY channel_stats.play_count DESC
      ) INTO v_result
      FROM (
        SELECT 
          c.id,
          c.nombre,
          c.descripcion,
          c.imagen_url,
          COUNT(ph.id) as play_count
        FROM canales c
        LEFT JOIN playback_history ph ON ph.canal_id = c.id 
          AND ph.created_at >= now() - interval '30 days'
        WHERE c.activo = true
        GROUP BY c.id, c.nombre, c.descripcion, c.imagen_url
        ORDER BY COUNT(ph.id) DESC
        LIMIT 20
      ) channel_stats;
    
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

-- Actualizar el comentario
COMMENT ON FUNCTION rpc_get_section_channels IS 'Obtiene canales de una sección según su tipo (sector, favoritos, recientes, populares, destacados, categoria, manual) - v2 corregido';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FUNCIÓN rpc_get_section_channels CORREGIDA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Caso "populares" ahora usa subconsulta para evitar funciones agregadas anidadas';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- FIN DEL ARCHIVO
-- ============================================================================
