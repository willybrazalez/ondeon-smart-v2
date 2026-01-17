-- =====================================================
-- Migración: 026_fix_presence_column_names
-- Fecha: 2026-01-16
-- Descripción: Corrección de nombres de columnas en funciones de presencia
-- =====================================================
-- Problema: Las funciones usaban nombres de columnas incorrectos
-- 
-- Columnas correctas en user_presence_sessions:
--   status (no "estado"), started_at (no "conectado_at"), 
--   ended_at (no "desconectado_at"), last_activity_at (no "ultima_actividad")
--
-- Columnas correctas en user_current_state:
--   is_online (no "online"), last_seen_at, last_heartbeat,
--   current_canal_id, current_canal_name, current_song_title, current_song_artist
-- =====================================================

-- Eliminar funciones anteriores
DROP FUNCTION IF EXISTS close_previous_user_sessions(uuid, text, uuid);
DROP FUNCTION IF EXISTS start_single_session(uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS update_session_activity(uuid, uuid);
DROP FUNCTION IF EXISTS check_device_session(uuid, text);
DROP FUNCTION IF EXISTS fn_reproductor_heartbeat(uuid, text, uuid, text, text, text);
DROP FUNCTION IF EXISTS fn_reproductor_heartbeat_v2(uuid, text, uuid, text, text, text, text, text);

-- close_previous_user_sessions - CORREGIDO
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
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN QUERY SELECT 0::integer, ARRAY[]::uuid[];
        RETURN;
    END IF;
    
    WITH closed AS (
        UPDATE user_presence_sessions
        SET 
            status = 'disconnected',
            ended_at = NOW(),
            last_activity_at = NOW()
        WHERE usuario_id = v_resolved_id
          AND status = 'active'
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

-- start_single_session - CORREGIDO
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
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado: %', p_usuario_id;
    END IF;
    
    -- Obtener device_id anterior
    SELECT ups.device_id INTO v_prev_device
    FROM user_presence_sessions ups
    WHERE ups.usuario_id = v_resolved_id
      AND ups.status = 'active'
    ORDER BY ups.started_at DESC
    LIMIT 1;
    
    -- Cerrar sesiones anteriores
    SELECT cps.closed_sessions_count INTO v_closed_count
    FROM close_previous_user_sessions(v_resolved_id, p_device_id, NULL) cps;
    
    -- Crear nueva sesión
    INSERT INTO user_presence_sessions (
        usuario_id,
        device_id,
        device_info,
        app_version,
        status,
        started_at,
        last_activity_at
    ) VALUES (
        v_resolved_id,
        p_device_id,
        p_device_info,
        p_app_version,
        'active',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_session_id;
    
    -- Actualizar estado actual del usuario
    INSERT INTO user_current_state (
        usuario_id, 
        is_online, 
        device_id, 
        last_seen_at,
        last_heartbeat,
        current_session_id,
        session_started_at,
        updated_at
    )
    VALUES (
        v_resolved_id, 
        true, 
        p_device_id, 
        NOW(),
        NOW(),
        v_new_session_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (usuario_id) DO UPDATE SET
        is_online = true,
        device_id = EXCLUDED.device_id,
        last_seen_at = NOW(),
        last_heartbeat = NOW(),
        current_session_id = EXCLUDED.current_session_id,
        session_started_at = NOW(),
        updated_at = NOW();
    
    RETURN QUERY SELECT v_new_session_id, COALESCE(v_closed_count, 0), v_prev_device;
END;
$$;

-- update_session_activity - CORREGIDO
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
    UPDATE user_presence_sessions
    SET last_activity_at = NOW()
    WHERE id = p_session_id;
    
    IF p_usuario_id IS NOT NULL THEN
        v_resolved_id := resolve_usuario_id(p_usuario_id);
        
        IF v_resolved_id IS NOT NULL THEN
            UPDATE user_current_state
            SET last_heartbeat = NOW(), 
                last_seen_at = NOW(),
                is_online = true,
                updated_at = NOW()
            WHERE usuario_id = v_resolved_id;
        END IF;
    END IF;
END;
$$;

-- check_device_session - CORREGIDO
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
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN QUERY SELECT false, false, NULL::text;
        RETURN;
    END IF;
    
    SELECT 
        true,
        ups.device_id = p_device_id,
        ups.device_id
    INTO v_has_session, v_same_device, v_active_device
    FROM user_presence_sessions ups
    WHERE ups.usuario_id = v_resolved_id
      AND ups.status = 'active'
    ORDER BY ups.started_at DESC
    LIMIT 1;
    
    RETURN QUERY SELECT 
        COALESCE(v_has_session, false),
        COALESCE(v_same_device, false),
        v_active_device;
END;
$$;

-- fn_reproductor_heartbeat - CORREGIDO
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
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN;
    END IF;
    
    INSERT INTO user_current_state (
        usuario_id, 
        is_online, 
        device_id, 
        last_seen_at,
        last_heartbeat,
        current_canal_id,
        current_canal_name,
        current_song_title,
        current_song_artist,
        updated_at
    )
    VALUES (
        v_resolved_id, 
        true, 
        p_device_id, 
        NOW(),
        NOW(),
        p_canal_id,
        p_canal_nombre,
        p_cancion_titulo,
        p_cancion_artista,
        NOW()
    )
    ON CONFLICT (usuario_id) DO UPDATE SET
        is_online = true,
        device_id = EXCLUDED.device_id,
        last_seen_at = NOW(),
        last_heartbeat = NOW(),
        current_canal_id = COALESCE(EXCLUDED.current_canal_id, user_current_state.current_canal_id),
        current_canal_name = COALESCE(EXCLUDED.current_canal_name, user_current_state.current_canal_name),
        current_song_title = COALESCE(EXCLUDED.current_song_title, user_current_state.current_song_title),
        current_song_artist = COALESCE(EXCLUDED.current_song_artist, user_current_state.current_song_artist),
        updated_at = NOW();
    
    UPDATE user_presence_sessions
    SET last_activity_at = NOW()
    WHERE usuario_id = v_resolved_id
      AND device_id = p_device_id
      AND status = 'active';
END;
$$;

-- fn_reproductor_heartbeat_v2 - CORREGIDO
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
BEGIN
    v_resolved_id := resolve_usuario_id(p_usuario_id);
    
    IF v_resolved_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;
    
    INSERT INTO user_current_state (
        usuario_id, 
        is_online, 
        device_id, 
        last_seen_at,
        last_heartbeat,
        current_canal_id,
        current_canal_name,
        current_song_title,
        current_song_artist,
        app_version,
        playback_state,
        updated_at
    )
    VALUES (
        v_resolved_id, 
        true, 
        p_device_id, 
        NOW(),
        NOW(),
        p_canal_id,
        p_canal_nombre,
        p_cancion_titulo,
        p_cancion_artista,
        p_app_version,
        p_playback_state,
        NOW()
    )
    ON CONFLICT (usuario_id) DO UPDATE SET
        is_online = true,
        device_id = EXCLUDED.device_id,
        last_seen_at = NOW(),
        last_heartbeat = NOW(),
        current_canal_id = COALESCE(EXCLUDED.current_canal_id, user_current_state.current_canal_id),
        current_canal_name = COALESCE(EXCLUDED.current_canal_name, user_current_state.current_canal_name),
        current_song_title = COALESCE(EXCLUDED.current_song_title, user_current_state.current_song_title),
        current_song_artist = COALESCE(EXCLUDED.current_song_artist, user_current_state.current_song_artist),
        app_version = COALESCE(EXCLUDED.app_version, user_current_state.app_version),
        playback_state = COALESCE(EXCLUDED.playback_state, user_current_state.playback_state),
        updated_at = NOW();
    
    UPDATE user_presence_sessions
    SET last_activity_at = NOW()
    WHERE usuario_id = v_resolved_id
      AND device_id = p_device_id
      AND status = 'active';
    
    RETURN jsonb_build_object(
        'success', true,
        'usuario_id', v_resolved_id,
        'timestamp', NOW()
    );
END;
$$;

-- COMENTARIOS
COMMENT ON FUNCTION close_previous_user_sessions IS 'Cierra sesiones anteriores - usa columnas correctas: status, ended_at, last_activity_at';
COMMENT ON FUNCTION start_single_session IS 'Inicia sesión única - usa columnas correctas: status=active, started_at, last_activity_at';
COMMENT ON FUNCTION check_device_session IS 'Verifica sesión activa - usa status=active, started_at';
COMMENT ON FUNCTION fn_reproductor_heartbeat IS 'Heartbeat v1 - usa is_online, last_seen_at, current_canal_id, etc.';
COMMENT ON FUNCTION fn_reproductor_heartbeat_v2 IS 'Heartbeat v2 - usa is_online, last_seen_at, current_canal_id, etc.';
