-- ============================================================================
-- ONDEON SMART v2 - RESTRINGIR ROL ANON
-- ============================================================================
-- Revocar acceso a usuarios no autenticados

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Asegurar que solo authenticated tiene acceso
GRANT USAGE ON SCHEMA public TO authenticated;

-- Revocar permisos específicos de anon en cada tabla
REVOKE ALL ON sectores FROM anon;
REVOKE ALL ON idiomas FROM anon;
REVOKE ALL ON usuarios FROM anon;
REVOKE ALL ON canales FROM anon;
REVOKE ALL ON sector_canales_recomendados FROM anon;
REVOKE ALL ON playlists FROM anon;
REVOKE ALL ON canciones FROM anon;
REVOKE ALL ON playlist_canciones FROM anon;
REVOKE ALL ON contenidos FROM anon;
REVOKE ALL ON programaciones FROM anon;
REVOKE ALL ON programacion_contenidos FROM anon;
REVOKE ALL ON usuario_programaciones_desactivadas FROM anon;
REVOKE ALL ON user_current_state FROM anon;
REVOKE ALL ON playback_history FROM anon;
