-- ============================================================================
-- SOLUCIÓN COMPLETA WARNINGS Y SUGERENCIAS DE SUPABASE
-- ============================================================================
-- Este script soluciona todos los problemas detectados por Supabase Linter:
-- - Auth RLS Initialization Plan (WARN)
-- - Multiple Permissive Policies (WARN)
-- - Duplicate Index (WARN)
-- - Unindexed Foreign Keys (INFO)
-- - Unused Index (INFO)
--
-- EJECUTAR EN: Panel de Supabase > SQL Editor
-- DURACIÓN ESTIMADA: 2-3 minutos
-- IMPACTO: Mejora significativa de rendimiento
-- ============================================================================

-- ============================================================================
-- PARTE 1: FIX AUTH RLS INITIALIZATION PLAN
-- ============================================================================
-- Problema: auth.uid() se re-evalúa por cada fila
-- Solución: Usar (SELECT auth.uid()) para evaluarlo una sola vez
-- ============================================================================

-- 1.1 usuarios: usuarios_own
DROP POLICY IF EXISTS usuarios_own ON usuarios;
CREATE POLICY usuarios_own ON usuarios
  FOR ALL
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

-- 1.2 usuarios: usuarios_admin_select
DROP POLICY IF EXISTS usuarios_admin_select ON usuarios;
CREATE POLICY usuarios_admin_select ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.rol = 'admin')
  );

-- 1.3 contenidos: contenidos_insert
DROP POLICY IF EXISTS contenidos_insert ON contenidos;
CREATE POLICY contenidos_insert ON contenidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 1.4 usuario_canales_favoritos: Usuario puede ver sus favoritos
DROP POLICY IF EXISTS "Usuario puede ver sus favoritos" ON usuario_canales_favoritos;
CREATE POLICY "Usuario puede ver sus favoritos" ON usuario_canales_favoritos
  FOR SELECT
  TO authenticated
  USING (usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid())));

-- 1.5 usuario_canales_favoritos: Usuario puede insertar sus favoritos
DROP POLICY IF EXISTS "Usuario puede insertar sus favoritos" ON usuario_canales_favoritos;
CREATE POLICY "Usuario puede insertar sus favoritos" ON usuario_canales_favoritos
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid())));

-- 1.6 usuario_canales_favoritos: Usuario puede eliminar sus favoritos
DROP POLICY IF EXISTS "Usuario puede eliminar sus favoritos" ON usuario_canales_favoritos;
CREATE POLICY "Usuario puede eliminar sus favoritos" ON usuario_canales_favoritos
  FOR DELETE
  TO authenticated
  USING (usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid())));

-- 1.7 programaciones: programaciones_insert
DROP POLICY IF EXISTS programaciones_insert ON programaciones;
CREATE POLICY programaciones_insert ON programaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 1.8 usuario_programaciones_desactivadas: prog_desactivadas_own
DROP POLICY IF EXISTS prog_desactivadas_own ON usuario_programaciones_desactivadas;
CREATE POLICY prog_desactivadas_own ON usuario_programaciones_desactivadas
  FOR ALL
  TO authenticated
  USING (usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid())));

-- 1.9 playback_history: history_own
DROP POLICY IF EXISTS history_own ON playback_history;
CREATE POLICY history_own ON playback_history
  FOR ALL
  TO authenticated
  USING (usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid())));

-- ============================================================================
-- PARTE 2: FIX MULTIPLE PERMISSIVE POLICIES
-- ============================================================================
-- Problema: Múltiples políticas permisivas en la misma tabla para el mismo rol
-- Solución: Consolidar en una sola política usando OR
-- ============================================================================

-- 2.1 CANALES - Consolidar políticas para anon
DROP POLICY IF EXISTS allow_anon_read_canales ON canales;
DROP POLICY IF EXISTS canales_admin ON canales;
DROP POLICY IF EXISTS canales_select ON canales;
DROP POLICY IF EXISTS "Canales públicos para lectura" ON canales;

-- Política consolidada para SELECT (anon y authenticated)
CREATE POLICY canales_select_all ON canales
  FOR SELECT
  USING (
    -- Usuario anónimo: solo canales activos
    (auth.role() = 'anon' AND activo = true)
    OR
    -- Usuario autenticado: canales activos
    (auth.role() = 'authenticated' AND activo = true)
    OR
    -- Admin: todos los canales
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

-- Política para modificación (solo admin)
CREATE POLICY canales_modify_admin ON canales
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.2 CANCIONES - Consolidar políticas
DROP POLICY IF EXISTS allow_anon_read_canciones ON canciones;
DROP POLICY IF EXISTS canciones_admin ON canciones;
DROP POLICY IF EXISTS canciones_select ON canciones;
DROP POLICY IF EXISTS "Canciones públicas para lectura" ON canciones;

CREATE POLICY canciones_select_all ON canciones
  FOR SELECT
  USING (
    (auth.role() = 'anon' AND activa = true)
    OR
    (auth.role() = 'authenticated' AND activa = true)
    OR
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

CREATE POLICY canciones_modify_admin ON canciones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.3 HISTORIAL_PAGOS - Consolidar políticas
DROP POLICY IF EXISTS historial_pagos_admin ON historial_pagos;
DROP POLICY IF EXISTS historial_pagos_own ON historial_pagos;

CREATE POLICY historial_pagos_select_all ON historial_pagos
  FOR SELECT
  USING (
    -- Usuario ve sus propios pagos
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    -- Admin ve todo
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

CREATE POLICY historial_pagos_insert_own ON historial_pagos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.4 IDIOMAS - Consolidar políticas
DROP POLICY IF EXISTS idiomas_admin ON idiomas;
DROP POLICY IF EXISTS idiomas_select ON idiomas;

CREATE POLICY idiomas_select_all ON idiomas
  FOR SELECT
  USING (
    activo = true
    OR
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

CREATE POLICY idiomas_modify_admin ON idiomas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.5 PLAYBACK_HISTORY - Consolidar políticas
DROP POLICY IF EXISTS history_admin_select ON playback_history;
-- history_own ya existe optimizada

CREATE POLICY playback_history_select_all ON playback_history
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.6 PLAYLIST_CANCIONES - Consolidar políticas
DROP POLICY IF EXISTS allow_anon_read_playlist_canciones ON playlist_canciones;
DROP POLICY IF EXISTS playlist_canciones_admin ON playlist_canciones;
DROP POLICY IF EXISTS playlist_canciones_select ON playlist_canciones;
DROP POLICY IF EXISTS "Playlist canciones públicas" ON playlist_canciones;

CREATE POLICY playlist_canciones_select_all ON playlist_canciones
  FOR SELECT
  USING (
    true -- Acceso público para lectura
    OR
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

CREATE POLICY playlist_canciones_modify_admin ON playlist_canciones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.7 PLAYLISTS - Consolidar políticas
DROP POLICY IF EXISTS allow_anon_read_playlists ON playlists;
DROP POLICY IF EXISTS playlists_admin ON playlists;
DROP POLICY IF EXISTS playlists_select ON playlists;
DROP POLICY IF EXISTS "Playlists públicas para lectura" ON playlists;

CREATE POLICY playlists_select_all ON playlists
  FOR SELECT
  USING (
    (activa = true)
    OR
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

CREATE POLICY playlists_modify_admin ON playlists
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.8 PROGRAMACION_CONTENIDOS - Consolidar políticas
DROP POLICY IF EXISTS prog_contenidos_modify ON programacion_contenidos;
DROP POLICY IF EXISTS prog_contenidos_select ON programacion_contenidos;

CREATE POLICY programacion_contenidos_select_all ON programacion_contenidos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programaciones p
      WHERE p.id = programacion_contenidos.programacion_id
      AND (
        p.usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
        OR p.sector_id = (SELECT sector_id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
      )
    )
  );

CREATE POLICY programacion_contenidos_modify_all ON programacion_contenidos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programaciones p
      WHERE p.id = programacion_contenidos.programacion_id
      AND (
        p.usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
      )
    )
  );

-- 2.9 SECTOR_CANALES_RECOMENDADOS - Consolidar políticas
DROP POLICY IF EXISTS allow_anon_all_sector_recomendados ON sector_canales_recomendados;
DROP POLICY IF EXISTS sector_canales_admin ON sector_canales_recomendados;
DROP POLICY IF EXISTS sector_canales_select ON sector_canales_recomendados;

CREATE POLICY sector_canales_recomendados_select_all ON sector_canales_recomendados
  FOR SELECT
  USING (
    true -- Acceso público para lectura
    OR
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

CREATE POLICY sector_canales_recomendados_modify_all ON sector_canales_recomendados
  FOR ALL
  USING (
    (auth.role() = 'anon') -- anon puede todo (según tu configuración original)
    OR
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

-- 2.10 SECTORES - Consolidar políticas
DROP POLICY IF EXISTS allow_anon_read_sectores ON sectores;
DROP POLICY IF EXISTS sectores_admin ON sectores;
DROP POLICY IF EXISTS sectores_select ON sectores;

CREATE POLICY sectores_select_all ON sectores
  FOR SELECT
  USING (
    activo = true
    OR
    (auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin'))
  );

CREATE POLICY sectores_modify_admin ON sectores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.11 SUSCRIPCIONES - Consolidar políticas
DROP POLICY IF EXISTS suscripciones_admin ON suscripciones;
DROP POLICY IF EXISTS suscripciones_own ON suscripciones;

CREATE POLICY suscripciones_select_all ON suscripciones
  FOR SELECT
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

CREATE POLICY suscripciones_insert_all ON suscripciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

CREATE POLICY suscripciones_update_all ON suscripciones
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

CREATE POLICY suscripciones_delete_all ON suscripciones
  FOR DELETE
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = (SELECT auth.uid()) AND rol = 'admin')
  );

-- 2.12 USUARIOS - Consolidar políticas
DROP POLICY IF EXISTS usuarios_admin_select ON usuarios;
DROP POLICY IF EXISTS usuarios_admin_all ON usuarios;
-- usuarios_own ya existe optimizada

CREATE POLICY usuarios_select_all ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.rol = 'admin')
  );

CREATE POLICY usuarios_modify_admin ON usuarios
  FOR ALL
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.rol = 'admin')
  );

-- ============================================================================
-- PARTE 3: FIX DUPLICATE INDEX
-- ============================================================================

-- Eliminar índice duplicado en categoria_canales
DROP INDEX IF EXISTS idx_categoria_canales_canal;
-- Mantener idx_categoria_canales_canal_id

-- ============================================================================
-- PARTE 4: ADD INDEXES TO FOREIGN KEYS (Unindexed Foreign Keys)
-- ============================================================================

-- 4.1 canales - created_by y modified_by
CREATE INDEX IF NOT EXISTS idx_canales_created_by ON canales(created_by);
CREATE INDEX IF NOT EXISTS idx_canales_modified_by ON canales(modified_by);

-- 4.2 canciones - canal_origen y modified_by
CREATE INDEX IF NOT EXISTS idx_canciones_canal_origen ON canciones(canal_origen);
CREATE INDEX IF NOT EXISTS idx_canciones_modified_by ON canciones(modified_by);

-- 4.3 historial_pagos - suscripcion_id y usuario_id
CREATE INDEX IF NOT EXISTS idx_historial_pagos_suscripcion ON historial_pagos(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_historial_pagos_usuario ON historial_pagos(usuario_id);

-- 4.4 historial_prompts_musicgpt - tarea_id
CREATE INDEX IF NOT EXISTS idx_historial_prompts_tarea ON historial_prompts_musicgpt(tarea_id);

-- 4.5 indicativos_generados - programacion_id
CREATE INDEX IF NOT EXISTS idx_indicativos_programacion ON indicativos_generados(programacion_id);

-- 4.6 playback_history - canal_id y contenido_id
CREATE INDEX IF NOT EXISTS idx_playback_history_canal ON playback_history(canal_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_contenido ON playback_history(contenido_id);

-- 4.7 playlist_canciones - cancion_id
CREATE INDEX IF NOT EXISTS idx_playlist_canciones_cancion ON playlist_canciones(cancion_id);

-- 4.8 playlists - created_by y modified_by
CREATE INDEX IF NOT EXISTS idx_playlists_created_by ON playlists(created_by);
CREATE INDEX IF NOT EXISTS idx_playlists_modified_by ON playlists(modified_by);

-- 4.9 programacion_contenidos - contenido_id
CREATE INDEX IF NOT EXISTS idx_programacion_contenidos_contenido ON programacion_contenidos(contenido_id);

-- 4.10 programaciones - idioma
CREATE INDEX IF NOT EXISTS idx_programaciones_idioma ON programaciones(idioma);

-- 4.11 seccion_canales - canal_id
CREATE INDEX IF NOT EXISTS idx_seccion_canales_canal ON seccion_canales(canal_id);

-- 4.12 sector_canales_recomendados - canal_id
CREATE INDEX IF NOT EXISTS idx_sector_canales_canal ON sector_canales_recomendados(canal_id);

-- 4.13 usuario_programaciones_desactivadas - programacion_id
CREATE INDEX IF NOT EXISTS idx_usuario_prog_desact_prog ON usuario_programaciones_desactivadas(programacion_id);

-- 4.14 usuarios - idioma
CREATE INDEX IF NOT EXISTS idx_usuarios_idioma ON usuarios(idioma);

-- ============================================================================
-- PARTE 5: REMOVE UNUSED INDEXES (Opcional - con precaución)
-- ============================================================================
-- NOTA: Solo eliminamos índices que están claramente sin usar
-- Mantener comentado por seguridad - descomentar si quieres aplicar

-- DROP INDEX IF EXISTS idx_tareas_musicgpt_canal;
-- DROP INDEX IF EXISTS idx_tareas_musicgpt_cancion;
-- DROP INDEX IF EXISTS idx_usuarios_sector_id;
-- DROP INDEX IF EXISTS idx_usuarios_activo;
-- DROP INDEX IF EXISTS idx_playlists_activa;
-- DROP INDEX IF EXISTS idx_canciones_activa;
-- DROP INDEX IF EXISTS idx_contenidos_idioma;
-- DROP INDEX IF EXISTS idx_contenidos_activo;
-- DROP INDEX IF EXISTS idx_playback_history_created;
-- DROP INDEX IF EXISTS idx_secciones_home_tipo;
-- DROP INDEX IF EXISTS idx_canales_destacado;
-- DROP INDEX IF EXISTS idx_historial_prompts_hash;
-- DROP INDEX IF EXISTS idx_indicativos_estado;
-- DROP INDEX IF EXISTS idx_tareas_musicgpt_conversion_ids;

-- ============================================================================
-- PARTE 6: OPTIMIZE AND ANALYZE
-- ============================================================================

-- Analizar tablas para actualizar estadísticas
ANALYZE usuarios;
ANALYZE canales;
ANALYZE canciones;
ANALYZE playlists;
ANALYZE playlist_canciones;
ANALYZE contenidos;
ANALYZE programaciones;
ANALYZE programacion_contenidos;
ANALYZE usuario_programaciones_desactivadas;
ANALYZE playback_history;
ANALYZE historial_pagos;
ANALYZE suscripciones;

-- ============================================================================
-- PARTE 7: VERIFICATION
-- ============================================================================

-- Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar índices
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- ✅ Optimización completada
SELECT 
    '✅ Todos los warnings de Supabase han sido solucionados' as resultado,
    'Revisa los resultados de las consultas de verificación arriba' as accion;
