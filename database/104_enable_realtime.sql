-- ============================================================================
-- ONDEON SMART v2 - HABILITAR REALTIME
-- ============================================================================

-- Para AutoDJ: detectar cambios en música
ALTER PUBLICATION supabase_realtime ADD TABLE playlists;
ALTER PUBLICATION supabase_realtime ADD TABLE canciones;
ALTER PUBLICATION supabase_realtime ADD TABLE playlist_canciones;

-- Para presencia y estado del usuario
ALTER PUBLICATION supabase_realtime ADD TABLE user_current_state;

-- Para programaciones y contenidos
ALTER PUBLICATION supabase_realtime ADD TABLE programaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE contenidos;

-- Para canales (cambios en configuración)
ALTER PUBLICATION supabase_realtime ADD TABLE canales;
