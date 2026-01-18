-- ============================================================================
-- ONDEON SMART v2 - ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Políticas de seguridad para que los usuarios solo accedan a sus datos.
-- ============================================================================

-- ============================================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE idiomas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE canales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_canales_recomendados ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE canciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_canciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE contenidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE programaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE programacion_contenidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_programaciones_desactivadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_current_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS: SECTORES (lectura pública para autenticados)
-- ============================================================================

DROP POLICY IF EXISTS sectores_select ON sectores;
CREATE POLICY sectores_select ON sectores
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Solo admin puede modificar
DROP POLICY IF EXISTS sectores_admin ON sectores;
CREATE POLICY sectores_admin ON sectores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: IDIOMAS (lectura pública para autenticados)
-- ============================================================================

DROP POLICY IF EXISTS idiomas_select ON idiomas;
CREATE POLICY idiomas_select ON idiomas
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Solo admin puede modificar
DROP POLICY IF EXISTS idiomas_admin ON idiomas;
CREATE POLICY idiomas_admin ON idiomas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: USUARIOS (solo su propio perfil)
-- ============================================================================

-- Usuario puede ver y editar su propio perfil
DROP POLICY IF EXISTS usuarios_own ON usuarios;
CREATE POLICY usuarios_own ON usuarios
  FOR ALL
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Admin puede ver todos los usuarios
DROP POLICY IF EXISTS usuarios_admin_select ON usuarios;
CREATE POLICY usuarios_admin_select ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid() AND u.rol = 'admin')
  );

-- Admin puede modificar todos los usuarios
DROP POLICY IF EXISTS usuarios_admin_all ON usuarios;
CREATE POLICY usuarios_admin_all ON usuarios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid() AND u.rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: CANALES (lectura pública, solo admin modifica)
-- ============================================================================

DROP POLICY IF EXISTS canales_select ON canales;
CREATE POLICY canales_select ON canales
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Admin puede todo
DROP POLICY IF EXISTS canales_admin ON canales;
CREATE POLICY canales_admin ON canales
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: SECTOR_CANALES_RECOMENDADOS (lectura pública, solo admin modifica)
-- ============================================================================

DROP POLICY IF EXISTS sector_canales_select ON sector_canales_recomendados;
CREATE POLICY sector_canales_select ON sector_canales_recomendados
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS sector_canales_admin ON sector_canales_recomendados;
CREATE POLICY sector_canales_admin ON sector_canales_recomendados
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: PLAYLISTS (lectura pública, solo admin modifica)
-- ============================================================================

DROP POLICY IF EXISTS playlists_select ON playlists;
CREATE POLICY playlists_select ON playlists
  FOR SELECT
  TO authenticated
  USING (activa = true);

DROP POLICY IF EXISTS playlists_admin ON playlists;
CREATE POLICY playlists_admin ON playlists
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: CANCIONES (lectura pública, solo admin modifica)
-- ============================================================================

DROP POLICY IF EXISTS canciones_select ON canciones;
CREATE POLICY canciones_select ON canciones
  FOR SELECT
  TO authenticated
  USING (activa = true);

DROP POLICY IF EXISTS canciones_admin ON canciones;
CREATE POLICY canciones_admin ON canciones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: PLAYLIST_CANCIONES (lectura pública, solo admin modifica)
-- ============================================================================

DROP POLICY IF EXISTS playlist_canciones_select ON playlist_canciones;
CREATE POLICY playlist_canciones_select ON playlist_canciones
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS playlist_canciones_admin ON playlist_canciones;
CREATE POLICY playlist_canciones_admin ON playlist_canciones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: CONTENIDOS
-- Lectura: propios + de su sector
-- Escritura: solo propios
-- ============================================================================

DROP POLICY IF EXISTS contenidos_select ON contenidos;
CREATE POLICY contenidos_select ON contenidos
  FOR SELECT
  TO authenticated
  USING (
    -- Contenidos propios
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    -- Contenidos de su sector (en su idioma o sin idioma específico)
    (
      sector_id = (SELECT sector_id FROM usuarios WHERE auth_user_id = auth.uid())
      AND usuario_id IS NULL
      AND (idioma IS NULL OR idioma = (SELECT idioma FROM usuarios WHERE auth_user_id = auth.uid()))
    )
    OR
    -- Admin ve todo
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS contenidos_insert ON contenidos;
CREATE POLICY contenidos_insert ON contenidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Solo puede crear contenidos propios (se asigna su usuario_id)
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    -- Admin puede crear cualquier contenido
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS contenidos_update ON contenidos;
CREATE POLICY contenidos_update ON contenidos
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS contenidos_delete ON contenidos;
CREATE POLICY contenidos_delete ON contenidos
  FOR DELETE
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: PROGRAMACIONES
-- Lectura: propias + de su sector (no desactivadas)
-- Escritura: solo propias
-- ============================================================================

DROP POLICY IF EXISTS programaciones_select ON programaciones;
CREATE POLICY programaciones_select ON programaciones
  FOR SELECT
  TO authenticated
  USING (
    -- Programaciones propias
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    -- Programaciones de su sector (no desactivadas, en su idioma o sin idioma)
    (
      sector_id = (SELECT sector_id FROM usuarios WHERE auth_user_id = auth.uid())
      AND usuario_id IS NULL
      AND (idioma IS NULL OR idioma = (SELECT idioma FROM usuarios WHERE auth_user_id = auth.uid()))
      AND id NOT IN (
        SELECT programacion_id 
        FROM usuario_programaciones_desactivadas 
        WHERE usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
      )
    )
    OR
    -- Admin ve todo
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS programaciones_insert ON programaciones;
CREATE POLICY programaciones_insert ON programaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS programaciones_update ON programaciones;
CREATE POLICY programaciones_update ON programaciones
  FOR UPDATE
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

DROP POLICY IF EXISTS programaciones_delete ON programaciones;
CREATE POLICY programaciones_delete ON programaciones
  FOR DELETE
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: PROGRAMACION_CONTENIDOS
-- Lectura: si puede ver la programación
-- Escritura: si puede modificar la programación
-- ============================================================================

DROP POLICY IF EXISTS prog_contenidos_select ON programacion_contenidos;
CREATE POLICY prog_contenidos_select ON programacion_contenidos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programaciones p
      WHERE p.id = programacion_contenidos.programacion_id
      AND (
        p.usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
        OR p.sector_id = (SELECT sector_id FROM usuarios WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS prog_contenidos_modify ON programacion_contenidos;
CREATE POLICY prog_contenidos_modify ON programacion_contenidos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programaciones p
      WHERE p.id = programacion_contenidos.programacion_id
      AND (
        p.usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
      )
    )
  );

-- ============================================================================
-- POLÍTICAS: USUARIO_PROGRAMACIONES_DESACTIVADAS
-- Solo el propio usuario
-- ============================================================================

DROP POLICY IF EXISTS prog_desactivadas_own ON usuario_programaciones_desactivadas;
CREATE POLICY prog_desactivadas_own ON usuario_programaciones_desactivadas
  FOR ALL
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- POLÍTICAS: USER_CURRENT_STATE
-- Solo su propio estado
-- ============================================================================

DROP POLICY IF EXISTS state_own ON user_current_state;
CREATE POLICY state_own ON user_current_state
  FOR ALL
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
  );

-- Admin puede ver todos los estados (para panel de gestión)
DROP POLICY IF EXISTS state_admin_select ON user_current_state;
CREATE POLICY state_admin_select ON user_current_state
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- POLÍTICAS: PLAYBACK_HISTORY
-- Solo su propio historial
-- ============================================================================

DROP POLICY IF EXISTS history_own ON playback_history;
CREATE POLICY history_own ON playback_history
  FOR ALL
  TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
  );

-- Admin puede ver todo el historial
DROP POLICY IF EXISTS history_admin_select ON playback_history;
CREATE POLICY history_admin_select ON playback_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE auth_user_id = auth.uid() AND rol = 'admin')
  );

-- ============================================================================
-- PERMISOS DE TABLAS
-- ============================================================================

-- Permitir a usuarios autenticados acceder a las tablas (RLS filtra)
GRANT SELECT ON sectores TO authenticated;
GRANT SELECT ON idiomas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON usuarios TO authenticated;
GRANT SELECT ON canales TO authenticated;
GRANT SELECT ON sector_canales_recomendados TO authenticated;
GRANT SELECT ON playlists TO authenticated;
GRANT SELECT ON canciones TO authenticated;
GRANT SELECT ON playlist_canciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contenidos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON programaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON programacion_contenidos TO authenticated;
GRANT SELECT, INSERT, DELETE ON usuario_programaciones_desactivadas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_current_state TO authenticated;
GRANT SELECT, INSERT ON playback_history TO authenticated;

-- Admin tiene todos los permisos (las políticas ya lo manejan)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
