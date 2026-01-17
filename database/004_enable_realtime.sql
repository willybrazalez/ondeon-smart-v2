-- ============================================================================
-- HABILITAR REALTIME - Script Simple y Limpio
-- ============================================================================

-- Habilitar Realtime para las 3 tablas
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_activity_events;
ALTER PUBLICATION supabase_realtime ADD TABLE user_current_state;

-- Listo! Ejecuta este script completo de una vez

