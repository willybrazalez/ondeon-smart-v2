-- ===================================================================
-- OPTIMIZACIÓN DE ÍNDICES - VERSIÓN SIMPLIFICADA (SOLO COLUMNAS BÁSICAS)
-- ===================================================================
-- 
-- Esta versión solo usa columnas estándar que existen en casi todas las BD
-- 
-- EJECUTAR EN: Panel de Supabase > SQL Editor
-- DURACIÓN ESTIMADA: 1-2 minutos
-- IMPACTO: Mejora velocidad de consultas hasta 10x
--
-- ===================================================================

-- ===================================================================
-- 1. ÍNDICES PARA CANALES DE USUARIO (consulta MÁS frecuente)
-- ===================================================================

-- Índice para búsqueda rápida de canales activos por usuario
CREATE INDEX IF NOT EXISTS idx_reproductor_usuario_canales_lookup 
ON reproductor_usuario_canales(usuario_id, activo) 
WHERE activo = true;

-- Índice para búsqueda inversa (canal → usuarios)
CREATE INDEX IF NOT EXISTS idx_reproductor_usuario_canales_canal 
ON reproductor_usuario_canales(canal_id, activo) 
WHERE activo = true;

-- Índice compuesto para JOINs frecuentes
CREATE INDEX IF NOT EXISTS idx_reproductor_usuario_canales_full 
ON reproductor_usuario_canales(usuario_id, canal_id, activo);

-- ===================================================================
-- 2. ÍNDICES PARA PLAYLISTS
-- ===================================================================

-- Índice para playlists activas por canal
CREATE INDEX IF NOT EXISTS idx_playlists_canal_activa 
ON playlists(canal_id, activa) 
WHERE activa = true;

-- Índice para ordenamiento por peso (si existe)
CREATE INDEX IF NOT EXISTS idx_playlists_peso 
ON playlists(canal_id, activa);

-- Índice simple por tipo (si existe la columna tipo)
CREATE INDEX IF NOT EXISTS idx_playlists_tipo 
ON playlists(tipo, activa) 
WHERE activa = true;

-- ===================================================================
-- 3. ÍNDICES PARA PLAYLIST_CANCIONES (MUY IMPORTANTE)
-- ===================================================================

-- Índice para canciones de playlist (consulta MUY frecuente)
CREATE INDEX IF NOT EXISTS idx_playlist_canciones_lookup 
ON playlist_canciones(playlist_id, posicion);

-- Índice para búsqueda de canciones por ID
CREATE INDEX IF NOT EXISTS idx_playlist_canciones_cancion 
ON playlist_canciones(cancion_id);

-- ===================================================================
-- 4. ÍNDICES PARA CANCIONES
-- ===================================================================

-- Índice para búsqueda de canciones por título
CREATE INDEX IF NOT EXISTS idx_canciones_titulo 
ON canciones(titulo);

-- Índice para búsqueda por artista
CREATE INDEX IF NOT EXISTS idx_canciones_artista 
ON canciones(artista);

-- Índice para búsqueda por URL
CREATE INDEX IF NOT EXISTS idx_canciones_url 
ON canciones(url_s3);

-- ===================================================================
-- 5. ÍNDICES PARA PLAYBACK_HISTORY (MUY IMPORTANTE)
-- ===================================================================

-- Índice para historial por usuario y timestamp
CREATE INDEX IF NOT EXISTS idx_playback_history_usuario 
ON playback_history(usuario_id, timestamp DESC);

-- Índice para historial por canal
CREATE INDEX IF NOT EXISTS idx_playback_history_canal 
ON playback_history(canal_id, timestamp DESC);

-- Índice para tipo de evento
CREATE INDEX IF NOT EXISTS idx_playback_history_tipo 
ON playback_history(tipo_evento, timestamp DESC);

-- ===================================================================
-- 6. ÍNDICES PARA USUARIOS
-- ===================================================================

-- Índice para búsqueda por username (login)
CREATE INDEX IF NOT EXISTS idx_usuarios_username 
ON usuarios(username);

-- Índice para relación usuario → grupo
CREATE INDEX IF NOT EXISTS idx_usuarios_grupo 
ON usuarios(grupo_id);

-- ===================================================================
-- 7. ÍNDICES PARA CANALES GENÉRICOS
-- ===================================================================

-- Índice para canales genéricos
CREATE INDEX IF NOT EXISTS idx_canales_genericos_lookup 
ON canales_genericos(is_generic, canal_id) 
WHERE is_generic = true;

-- ===================================================================
-- 8. ÍNDICES PARA CONTENIDOS Y PROGRAMACIONES
-- ===================================================================

-- Índice para contenidos asignados por usuario
CREATE INDEX IF NOT EXISTS idx_contenido_asignaciones_usuario 
ON contenido_asignaciones(usuario_id, activo) 
WHERE activo = true;

-- Índice para contenidos por canal
CREATE INDEX IF NOT EXISTS idx_contenido_asignaciones_canal 
ON contenido_asignaciones(canal_id, activo) 
WHERE activo = true;

-- Índice para programaciones activas
CREATE INDEX IF NOT EXISTS idx_programaciones_estado 
ON programaciones(estado);

-- Índice para destinatarios de programación
CREATE INDEX IF NOT EXISTS idx_programacion_destinatarios_usuario 
ON programacion_destinatarios(usuario_id, programacion_id);

-- Índice para contenidos de programación
CREATE INDEX IF NOT EXISTS idx_programacion_contenidos_lookup 
ON programacion_contenidos(programacion_id, orden, activo) 
WHERE activo = true;

-- ===================================================================
-- 9. MANTENIMIENTO Y OPTIMIZACIÓN
-- ===================================================================

-- Analizar tablas para actualizar estadísticas
ANALYZE reproductor_usuario_canales;
ANALYZE playlists;
ANALYZE playlist_canciones;
ANALYZE canciones;
ANALYZE playback_history;
ANALYZE usuarios;

-- ===================================================================
-- 10. VERIFICACIÓN FINAL
-- ===================================================================

-- Mostrar resumen
SELECT 
    'Optimización completada exitosamente' as estado,
    COUNT(*) as total_indices_creados
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

-- Mostrar lista de índices creados
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

