-- ============================================================
-- ARREGLAR FOREIGN KEYS DE CANALES
-- ============================================================
-- El problema: canal_id y current_canal_id apuntan a canales_genericos
-- La solución: Cambiarlos para que apunten a canales
-- ============================================================

-- 1. Arreglar user_activity_events.canal_id
ALTER TABLE user_activity_events 
DROP CONSTRAINT IF EXISTS user_activity_events_canal_id_fkey;

ALTER TABLE user_activity_events 
ADD CONSTRAINT user_activity_events_canal_id_fkey 
FOREIGN KEY (canal_id) 
REFERENCES canales(id) 
ON DELETE SET NULL;

-- 2. Arreglar user_current_state.current_canal_id
ALTER TABLE user_current_state 
DROP CONSTRAINT IF EXISTS user_current_state_current_canal_id_fkey;

ALTER TABLE user_current_state 
ADD CONSTRAINT user_current_state_current_canal_id_fkey 
FOREIGN KEY (current_canal_id) 
REFERENCES canales(id) 
ON DELETE SET NULL;

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Foreign Keys actualizados:';
  RAISE NOTICE '   - user_activity_events.canal_id → canales(id)';
  RAISE NOTICE '   - user_current_state.current_canal_id → canales(id)';
END $$;

