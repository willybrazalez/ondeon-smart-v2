-- ===================================================================
-- OPTIMIZACIÓN DE ÍNDICES - VERSIÓN CORREGIDA
-- ===================================================================
-- 
-- Esta es la versión corregida que omite columnas que no existen
-- en tu esquema de base de datos.
--
-- EJECUTAR EN: Panel de Supabase > SQL Editor
-- DURACIÓN ESTIMADA: 2-5 minutos
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
-- 2. ÍNDICES PARA PLAYLISTS (segunda consulta más frecuente)
-- ===================================================================

-- Índice para playlists activas por canal
CREATE INDEX IF NOT EXISTS idx_playlists_canal_activa 
ON playlists(canal_id, activa) 
WHERE activa = true;

-- Índice para ordenamiento por peso (prioridad)
CREATE INDEX IF NOT EXISTS idx_playlists_peso 
ON playlists(canal_id, peso DESC, activa) 
WHERE activa = true;

-- ✅ CORREGIDO: Índice simplificado sin usar_franja_horaria
-- Solo indexamos campos que sabemos que existen
CREATE INDEX IF NOT EXISTS idx_playlists_basico 
ON playlists(canal_id, activa, tipo) 
WHERE activa = true;

-- Índice para playlists agendadas
CREATE INDEX IF NOT EXISTS idx_playlists_agendadas 
ON playlists(canal_id, tipo, activa, fecha, hora) 
WHERE tipo = 'agendada' AND activa = true;

-- ===================================================================
-- 3. ÍNDICES PARA CANCIONES Y PLAYLIST_CANCIONES (muy frecuente)
-- ===================================================================

-- Índice para canciones de playlist (consulta MUY frecuente)
CREATE INDEX IF NOT EXISTS idx_playlist_canciones_lookup 
ON playlist_canciones(playlist_id, posicion ASC);

-- Índice para búsqueda de canciones por ID
CREATE INDEX IF NOT EXISTS idx_playlist_canciones_cancion 
ON playlist_canciones(cancion_id);

-- Índice para búsqueda de canciones por título y artista
CREATE INDEX IF NOT EXISTS idx_canciones_busqueda 
ON canciones(titulo, artista);

-- Índice para búsqueda por URL (verificaciones de existencia)
CREATE INDEX IF NOT EXISTS idx_canciones_url 
ON canciones(url_s3);

-- ===================================================================
-- 4. ÍNDICES PARA HISTORIAL DE REPRODUCCIÓN
-- ===================================================================

-- Índice para playback_history (escritura MUY frecuente)
CREATE INDEX IF NOT EXISTS idx_playback_history_usuario_fecha 
ON playback_history(usuario_id, timestamp DESC);

-- Índice para consultas de historial por canal
CREATE INDEX IF NOT EXISTS idx_playback_history_canal_fecha 
ON playback_history(canal_id, timestamp DESC);

-- Índice para análisis de eventos
CREATE INDEX IF NOT EXISTS idx_playback_history_tipo_evento 
ON playback_history(tipo_evento, timestamp DESC);

-- ===================================================================
-- 5. ÍNDICES PARA USUARIOS Y GRUPOS
-- ===================================================================

-- Índice para búsqueda de usuario por username (login legacy)
CREATE INDEX IF NOT EXISTS idx_usuarios_username 
ON usuarios(username);

-- Índice para relación usuario → grupo
CREATE INDEX IF NOT EXISTS idx_usuarios_grupo 
ON usuarios(grupo_id);

-- Índice para relación usuario → empresa
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa 
ON usuarios(empresa_id);

-- ===================================================================
-- 6. ÍNDICES PARA CANALES GENÉRICOS
-- ===================================================================

-- Índice para canales genéricos activos
CREATE INDEX IF NOT EXISTS idx_canales_genericos_lookup 
ON canales_genericos(is_generic, canal_id) 
WHERE is_generic = true;

-- ===================================================================
-- 7. ÍNDICES PARA CONTENIDOS ASIGNADOS Y PROGRAMACIONES
-- ===================================================================

-- Índice para contenidos asignados activos por usuario
CREATE INDEX IF NOT EXISTS idx_contenido_asignaciones_usuario 
ON contenido_asignaciones(usuario_id, activo) 
WHERE activo = true;

-- Índice para contenidos por canal
CREATE INDEX IF NOT EXISTS idx_contenido_asignaciones_canal 
ON contenido_asignaciones(canal_id, activo) 
WHERE activo = true;

-- Índice para programaciones activas
CREATE INDEX IF NOT EXISTS idx_programaciones_estado 
ON programaciones(estado, fecha_inicio, fecha_fin) 
WHERE estado = 'activo';

-- Índice para destinatarios de programación
CREATE INDEX IF NOT EXISTS idx_programacion_destinatarios_usuario 
ON programacion_destinatarios(usuario_id, programacion_id);

-- Índice para contenidos de programación
CREATE INDEX IF NOT EXISTS idx_programacion_contenidos_lookup 
ON programacion_contenidos(programacion_id, orden ASC, activo) 
WHERE activo = true;

-- ===================================================================
-- 8. ÍNDICES PARA RELACIONES DE CANALES (JERARQUÍA)
-- ===================================================================

-- Índice para canales de usuario
CREATE INDEX IF NOT EXISTS idx_usuario_canales_lookup 
ON usuario_canales(usuario_id, canal_id);

-- Índice para canales de grupo
CREATE INDEX IF NOT EXISTS idx_grupo_canales_lookup 
ON grupo_canales(grupo_id, canal_id);

-- Índice para canales de empresa
CREATE INDEX IF NOT EXISTS idx_empresa_canales_lookup 
ON empresa_canales(empresa_id, canal_id);

-- ===================================================================
-- 9. MANTENIMIENTO Y OPTIMIZACIÓN
-- ===================================================================

-- Analizar tablas para actualizar estadísticas del query planner
ANALYZE reproductor_usuario_canales;
ANALYZE playlists;
ANALYZE playlist_canciones;
ANALYZE canciones;
ANALYZE playback_history;
ANALYZE usuarios;
ANALYZE canales_genericos;
ANALYZE contenido_asignaciones;
ANALYZE programaciones;

-- ===================================================================
-- 10. VERIFICACIÓN
-- ===================================================================

-- Ver índices creados
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Verificar tamaño de índices
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size('public.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'reproductor_usuario_canales',
        'playlists',
        'playlist_canciones',
        'canciones',
        'playback_history'
    )
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- ===================================================================
-- RESUMEN FINAL
-- ===================================================================

SELECT 
    'Optimización completada' as estado,
    COUNT(*) as indices_creados
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

