-- =====================================================
-- Migración: 025_cleanup_duplicate_presence_functions
-- Fecha: 2026-01-16
-- Descripción: Limpieza de funciones de presencia duplicadas
-- =====================================================
-- Problema resuelto: Error "function X is not unique" causado
-- por múltiples versiones de funciones con firmas similares
-- =====================================================

-- 1. ELIMINAR TODAS las versiones de funciones problemáticas

-- close_previous_user_sessions
DROP FUNCTION IF EXISTS close_previous_user_sessions(uuid, text);
DROP FUNCTION IF EXISTS close_previous_user_sessions(uuid, text, uuid);

-- fn_reproductor_heartbeat
DROP FUNCTION IF EXISTS fn_reproductor_heartbeat(uuid, text, uuid, text, text, text);
DROP FUNCTION IF EXISTS fn_reproductor_heartbeat(uuid, text, text, text, inet);

-- fn_reproductor_heartbeat_v2
DROP FUNCTION IF EXISTS fn_reproductor_heartbeat_v2(uuid, text, uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS fn_reproductor_heartbeat_v2(uuid, text, text, text, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS fn_reproductor_heartbeat_v2(uuid, text, text, text, jsonb, jsonb, jsonb, text, text, text);

-- update_session_activity  
DROP FUNCTION IF EXISTS update_session_activity(uuid);
DROP FUNCTION IF EXISTS update_session_activity(uuid, uuid);

-- start_single_session
DROP FUNCTION IF EXISTS start_single_session(uuid, text, jsonb, text);

-- check_device_session
DROP FUNCTION IF EXISTS check_device_session(uuid, text);

-- 2. RECREAR funciones únicas con resolve_usuario_id

-- Helper function resolve_usuario_id
-- Resuelve tanto usuarios.id como auth_user_id a usuarios.id
CREATE OR REPLACE FUNCTION resolve_usuario_id(p_input_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id uuid;
BEGIN
    -- Primero verificar si el ID es directamente un usuarios.id
    SELECT id INTO v_usuario_id
    FROM usuarios
    WHERE id = p_input_id;
    
    IF v_usuario_id IS NOT NULL THEN
        RETURN v_usuario_id;
    END IF;
    
    -- Si no, buscar por auth_user_id
    SELECT id INTO v_usuario_id
    FROM usuarios
    WHERE auth_user_id = p_input_id;
    
    RETURN v_usuario_id; -- Puede ser NULL si no se encuentra
END;
$$;

-- close_previous_user_sessions (versión única con 3 parámetros)
CREATE OR REPLACE FUNCTION close_previous_user_sessions(
    p_usuario_id uuid,
    p_new_device_id text DEFAULT NULL,
    p_keep_session_id uuid DEFAULT NULL
)
RETURNS TABLE(closed_sessions_count integer, session_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resolved_id uuid;
    v_closed_count integer := 0;
    v_closed_ids uuid[];
BEGIN
    -- Resolver el ID correcto
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN QUERY SELECT 0::integer, ARRAY[]::uuid[];
        RETURN;
    END IF;
    
    -- Cerrar sesiones anteriores
    WITH closed AS (
        UPDATE user_presence_sessions
        SET 
            estado = 'disconnected',
            desconectado_at = NOW(),
            ultima_actividad = NOW()
        WHERE usuario_id = v_resolved_id
          AND estado = 'connected'
          AND (p_keep_session_id IS NULL OR id != p_keep_session_id)
          AND (p_new_device_id IS NULL OR device_id != p_new_device_id)
        RETURNING id
    )
    SELECT COUNT(*)::integer, ARRAY_AGG(id)
    INTO v_closed_count, v_closed_ids
    FROM closed;
    
    RETURN QUERY SELECT COALESCE(v_closed_count, 0), COALESCE(v_closed_ids, ARRAY[]::uuid[]);
END;
$$;

-- start_single_session
CREATE OR REPLACE FUNCTION start_single_session(
    p_usuario_id uuid,
    p_device_id text DEFAULT 'default',
    p_device_info jsonb DEFAULT '{}',
    p_app_version text DEFAULT NULL
)
RETURNS TABLE(new_session_id uuid, closed_sessions_count integer, previous_device_id text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resolved_id uuid;
    v_new_session_id uuid;
    v_closed_count integer := 0;
    v_prev_device text;
BEGIN
    -- Resolver el ID correcto
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado: %', p_usuario_id;
    END IF;
    
    -- Obtener device_id anterior si existe
    SELECT ups.device_id INTO v_prev_device
    FROM user_presence_sessions ups
    WHERE ups.usuario_id = v_resolved_id
      AND ups.estado = 'connected'
    ORDER BY ups.conectado_at DESC
    LIMIT 1;
    
    -- Cerrar sesiones anteriores del mismo usuario
    SELECT cps.closed_sessions_count INTO v_closed_count
    FROM close_previous_user_sessions(v_resolved_id, p_device_id, NULL) cps;
    
    -- Crear nueva sesión
    INSERT INTO user_presence_sessions (
        usuario_id,
        device_id,
        device_info,
        app_version,
        estado,
        conectado_at,
        ultima_actividad
    ) VALUES (
        v_resolved_id,
        p_device_id,
        p_device_info,
        p_app_version,
        'connected',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_session_id;
    
    -- Actualizar estado actual del usuario
    INSERT INTO user_current_state (usuario_id, status, device_id, ultimo_heartbeat, online)
    VALUES (v_resolved_id, 'online', p_device_id, NOW(), true)
    ON CONFLICT (usuario_id) DO UPDATE SET
        status = 'online',
        device_id = EXCLUDED.device_id,
        ultimo_heartbeat = NOW(),
        online = true;
    
    RETURN QUERY SELECT v_new_session_id, COALESCE(v_closed_count, 0), v_prev_device;
END;
$$;

-- update_session_activity (versión única)
CREATE OR REPLACE FUNCTION update_session_activity(
    p_session_id uuid,
    p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resolved_id uuid;
BEGIN
    -- Actualizar actividad de la sesión
    UPDATE user_presence_sessions
    SET ultima_actividad = NOW()
    WHERE id = p_session_id;
    
    -- Si se proporciona usuario_id, actualizar también su estado
    IF p_usuario_id IS NOT NULL THEN
        v_resolved_id := resolve_usuario_id(p_usuario_id);
        
        IF v_resolved_id IS NOT NULL THEN
            UPDATE user_current_state
            SET ultimo_heartbeat = NOW(), online = true
            WHERE usuario_id = v_resolved_id;
        END IF;
    END IF;
END;
$$;

-- check_device_session
CREATE OR REPLACE FUNCTION check_device_session(
    p_usuario_id uuid,
    p_device_id text
)
RETURNS TABLE(has_active_session boolean, is_same_device boolean, active_device_id text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resolved_id uuid;
    v_has_session boolean := false;
    v_same_device boolean := false;
    v_active_device text;
BEGIN
    -- Resolver el ID correcto
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN QUERY SELECT false, false, NULL::text;
        RETURN;
    END IF;
    
    -- Buscar sesión activa
    SELECT 
        true,
        ups.device_id = p_device_id,
        ups.device_id
    INTO v_has_session, v_same_device, v_active_device
    FROM user_presence_sessions ups
    WHERE ups.usuario_id = v_resolved_id
      AND ups.estado = 'connected'
    ORDER BY ups.conectado_at DESC
    LIMIT 1;
    
    RETURN QUERY SELECT 
        COALESCE(v_has_session, false),
        COALESCE(v_same_device, false),
        v_active_device;
END;
$$;

-- fn_reproductor_heartbeat (versión principal)
CREATE OR REPLACE FUNCTION fn_reproductor_heartbeat(
    p_usuario_id uuid,
    p_device_id text DEFAULT 'default',
    p_canal_id uuid DEFAULT NULL,
    p_canal_nombre text DEFAULT NULL,
    p_cancion_titulo text DEFAULT NULL,
    p_cancion_artista text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resolved_id uuid;
BEGIN
    -- Resolver el ID correcto
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Actualizar estado del usuario
    INSERT INTO user_current_state (
        usuario_id, 
        status, 
        device_id, 
        ultimo_heartbeat, 
        online,
        canal_actual_id,
        canal_actual_nombre,
        cancion_actual_titulo,
        cancion_actual_artista
    )
    VALUES (
        v_resolved_id, 
        'online', 
        p_device_id, 
        NOW(), 
        true,
        p_canal_id,
        p_canal_nombre,
        p_cancion_titulo,
        p_cancion_artista
    )
    ON CONFLICT (usuario_id) DO UPDATE SET
        status = 'online',
        device_id = EXCLUDED.device_id,
        ultimo_heartbeat = NOW(),
        online = true,
        canal_actual_id = COALESCE(EXCLUDED.canal_actual_id, user_current_state.canal_actual_id),
        canal_actual_nombre = COALESCE(EXCLUDED.canal_actual_nombre, user_current_state.canal_actual_nombre),
        cancion_actual_titulo = COALESCE(EXCLUDED.cancion_actual_titulo, user_current_state.cancion_actual_titulo),
        cancion_actual_artista = COALESCE(EXCLUDED.cancion_actual_artista, user_current_state.cancion_actual_artista);
    
    -- Actualizar última actividad de la sesión
    UPDATE user_presence_sessions
    SET ultima_actividad = NOW()
    WHERE usuario_id = v_resolved_id
      AND device_id = p_device_id
      AND estado = 'connected';
END;
$$;

-- fn_reproductor_heartbeat_v2 (versión principal unificada)
CREATE OR REPLACE FUNCTION fn_reproductor_heartbeat_v2(
    p_usuario_id uuid,
    p_device_id text DEFAULT 'default',
    p_canal_id uuid DEFAULT NULL,
    p_canal_nombre text DEFAULT NULL,
    p_cancion_titulo text DEFAULT NULL,
    p_cancion_artista text DEFAULT NULL,
    p_app_version text DEFAULT NULL,
    p_playback_state text DEFAULT 'playing'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_resolved_id uuid;
    v_result jsonb;
BEGIN
    -- Resolver el ID correcto
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;
    
    -- Actualizar estado del usuario
    INSERT INTO user_current_state (
        usuario_id, 
        status, 
        device_id, 
        ultimo_heartbeat, 
        online,
        canal_actual_id,
        canal_actual_nombre,
        cancion_actual_titulo,
        cancion_actual_artista,
        app_version,
        playback_state
    )
    VALUES (
        v_resolved_id, 
        'online', 
        p_device_id, 
        NOW(), 
        true,
        p_canal_id,
        p_canal_nombre,
        p_cancion_titulo,
        p_cancion_artista,
        p_app_version,
        p_playback_state
    )
    ON CONFLICT (usuario_id) DO UPDATE SET
        status = 'online',
        device_id = EXCLUDED.device_id,
        ultimo_heartbeat = NOW(),
        online = true,
        canal_actual_id = COALESCE(EXCLUDED.canal_actual_id, user_current_state.canal_actual_id),
        canal_actual_nombre = COALESCE(EXCLUDED.canal_actual_nombre, user_current_state.canal_actual_nombre),
        cancion_actual_titulo = COALESCE(EXCLUDED.cancion_actual_titulo, user_current_state.cancion_actual_titulo),
        cancion_actual_artista = COALESCE(EXCLUDED.cancion_actual_artista, user_current_state.cancion_actual_artista),
        app_version = COALESCE(EXCLUDED.app_version, user_current_state.app_version),
        playback_state = COALESCE(EXCLUDED.playback_state, user_current_state.playback_state);
    
    -- Actualizar última actividad de la sesión
    UPDATE user_presence_sessions
    SET ultima_actividad = NOW()
    WHERE usuario_id = v_resolved_id
      AND device_id = p_device_id
      AND estado = 'connected';
    
    RETURN jsonb_build_object(
        'success', true,
        'usuario_id', v_resolved_id,
        'timestamp', NOW()
    );
END;
$$;

-- COMENTARIOS
COMMENT ON FUNCTION resolve_usuario_id IS 'Resuelve tanto usuarios.id como auth_user_id a usuarios.id interno';
COMMENT ON FUNCTION close_previous_user_sessions IS 'Cierra sesiones anteriores de un usuario - acepta usuarios.id o auth_user_id';
COMMENT ON FUNCTION start_single_session IS 'Inicia sesión única para un usuario - acepta usuarios.id o auth_user_id';
COMMENT ON FUNCTION check_device_session IS 'Verifica si hay sesión activa para un usuario/dispositivo';
COMMENT ON FUNCTION fn_reproductor_heartbeat IS 'Heartbeat del reproductor v1 - acepta usuarios.id o auth_user_id';
COMMENT ON FUNCTION fn_reproductor_heartbeat_v2 IS 'Heartbeat del reproductor v2 con más info - acepta usuarios.id o auth_user_id';
