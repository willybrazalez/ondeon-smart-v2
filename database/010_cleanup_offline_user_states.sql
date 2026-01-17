-- ============================================================
-- LIMPIEZA DE DATOS RESIDUALES EN user_current_state
-- ============================================================
-- Problema: Usuarios offline tienen datos "congelados" de cuando
-- se desconectaron (playback_state, canal, canción, etc.)
--
-- Solución: Limpiar todos los datos de reproducción para usuarios
-- que están offline (is_online = false)
-- ============================================================

-- ============================================================
-- PASO 1: Revisar el estado actual
-- ============================================================

-- Ver cuántos usuarios offline tienen datos residuales
SELECT 
  COUNT(*) as usuarios_offline_con_datos,
  COUNT(CASE WHEN playback_state IS NOT NULL THEN 1 END) as con_playback_state,
  COUNT(CASE WHEN current_canal_name IS NOT NULL THEN 1 END) as con_canal,
  COUNT(CASE WHEN current_song_title IS NOT NULL THEN 1 END) as con_cancion
FROM user_current_state
WHERE is_online = false;

-- Ver ejemplos de datos residuales
SELECT 
  usuario_id,
  is_online,
  playback_state,
  current_canal_name,
  current_song_title,
  last_seen_at
FROM user_current_state
WHERE is_online = false
  AND (
    playback_state IS NOT NULL 
    OR current_canal_name IS NOT NULL 
    OR current_song_title IS NOT NULL
  )
LIMIT 10;

-- ============================================================
-- PASO 2: Limpiar datos residuales
-- ============================================================

-- Limpiar TODOS los datos de reproducción para usuarios offline
UPDATE user_current_state
SET 
  playback_state = NULL,
  current_canal_id = NULL,
  current_canal_name = NULL,
  current_song_title = NULL,
  current_song_artist = NULL,
  current_song_started_at = NULL,
  updated_at = NOW()
WHERE is_online = false;

-- ============================================================
-- PASO 3: Verificación
-- ============================================================

-- Verificar que la limpieza funcionó
SELECT 
  COUNT(*) as usuarios_offline,
  COUNT(CASE WHEN playback_state IS NOT NULL THEN 1 END) as con_playback_state,
  COUNT(CASE WHEN current_canal_name IS NOT NULL THEN 1 END) as con_canal,
  COUNT(CASE WHEN current_song_title IS NOT NULL THEN 1 END) as con_cancion
FROM user_current_state
WHERE is_online = false;

-- Resultado esperado: Todos los contadores deben ser 0 excepto usuarios_offline

-- Ver estado final
SELECT 
  usuario_id,
  is_online,
  playback_state,
  current_canal_name,
  current_song_title,
  last_seen_at
FROM user_current_state
WHERE is_online = false
LIMIT 10;

-- ============================================================
-- NOTAS
-- ============================================================
-- 
-- ✅ Este script limpia datos "congelados" de sesiones anteriores
-- ✅ Solo afecta a usuarios offline (is_online = false)
-- ✅ Los usuarios online mantienen sus datos
-- ✅ A partir de ahora, el logout limpiará automáticamente estos campos
-- 
-- ⚠️ Ejecutar este script una sola vez
-- ⚠️ Si hay usuarios que están realmente offline, sus datos se limpiarán
-- 
-- ============================================================

