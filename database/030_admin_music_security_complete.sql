-- ============================================================================
-- ONDEON SMART v2 - SISTEMA DE SEGURIDAD PARA ADMINISTRACIÓN MUSICAL
-- ============================================================================
-- Archivo: 030_admin_music_security_complete.sql
-- Descripción: Sistema multicapa de seguridad para el panel de administración
-- musical. Solo miembros del equipo Ondeón pueden acceder.
-- ============================================================================

-- ============================================================================
-- TABLA 1: WHITELIST DE ADMINISTRADORES MUSICALES
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_musical_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  nombre TEXT,
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_whitelist_email ON admin_musical_whitelist(LOWER(email)) WHERE activo = true;

COMMENT ON TABLE admin_musical_whitelist IS 'Lista blanca de emails autorizados para acceder al panel de administración musical';

-- Insertar emails del equipo Ondeón (AJUSTAR CON EMAILS REALES)
INSERT INTO admin_musical_whitelist (email, nombre, notas) VALUES
  ('admin@ondeon.es', 'Administrador Principal', 'Acceso completo al sistema'),
  ('guillermo@ondeon.es', 'Guillermo', 'Desarrollador y gestor'),
  ('musica@ondeon.es', 'Gestor Musical', 'Gestión de contenido musical')
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- TABLA 2: REGISTRO DE AUDITORÍA
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_musical_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  admin_id UUID REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  entidad_tipo TEXT NOT NULL,
  entidad_id UUID,
  detalles JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_musical_audit_log(admin_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entidad ON admin_musical_audit_log(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_musical_audit_log(created_at DESC);

COMMENT ON TABLE admin_musical_audit_log IS 'Registro de auditoría de todas las acciones de administración musical';

-- ============================================================================
-- CAMPOS DE AUDITORÍA EN TABLAS MUSICALES
-- ============================================================================

-- Agregar campos a canales
ALTER TABLE canales ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES usuarios(id);
ALTER TABLE canales ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES usuarios(id);

-- Agregar campos a playlists
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES usuarios(id);
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES usuarios(id);

-- Agregar campos a canciones + hash para duplicados
ALTER TABLE canciones ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES usuarios(id);
ALTER TABLE canciones ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES usuarios(id);
ALTER TABLE canciones ADD COLUMN IF NOT EXISTS hash_sha256 TEXT UNIQUE;

-- Índice para hash
CREATE INDEX IF NOT EXISTS idx_canciones_hash ON canciones(hash_sha256);

COMMENT ON COLUMN canciones.hash_sha256 IS 'SHA-256 hash del archivo MP3 para detección de duplicados';

-- ============================================================================
-- FUNCIÓN: VERIFICAR SI USUARIO ES ADMIN MUSICAL
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin_musical()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Obtener email del usuario autenticado
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  IF v_user_email IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar si está en la whitelist activa
  SELECT EXISTS(
    SELECT 1 FROM admin_musical_whitelist
    WHERE LOWER(email) = LOWER(v_user_email)
    AND activo = true
  ) INTO v_is_admin;
  
  RETURN v_is_admin;
END;
$$;

COMMENT ON FUNCTION is_admin_musical IS 'Verifica si el usuario autenticado es admin musical autorizado según whitelist';

-- ============================================================================
-- FUNCIÓN: REGISTRAR ACCIÓN DE AUDITORÍA
-- ============================================================================

CREATE OR REPLACE FUNCTION log_admin_action(
  p_accion TEXT,
  p_entidad_tipo TEXT,
  p_entidad_id UUID,
  p_detalles JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
  v_admin_id UUID;
BEGIN
  -- Obtener datos del admin
  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT id INTO v_admin_id FROM usuarios WHERE auth_user_id = auth.uid();
  
  -- Registrar acción
  INSERT INTO admin_musical_audit_log (
    admin_email,
    admin_id,
    accion,
    entidad_tipo,
    entidad_id,
    detalles
  ) VALUES (
    v_admin_email,
    v_admin_id,
    p_accion,
    p_entidad_tipo,
    p_entidad_id,
    p_detalles
  );
END;
$$;

COMMENT ON FUNCTION log_admin_action IS 'Registra una acción de administración musical en el audit log';

-- ============================================================================
-- TRIGGERS DE AUDITORÍA
-- ============================================================================

-- Trigger para canciones
CREATE OR REPLACE FUNCTION trigger_audit_canciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_admin_action('crear_cancion', 'cancion', NEW.id, 
      jsonb_build_object('titulo', NEW.titulo, 'artista', NEW.artista));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_admin_action('actualizar_cancion', 'cancion', NEW.id, 
      jsonb_build_object('titulo', NEW.titulo));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_admin_action('eliminar_cancion', 'cancion', OLD.id, 
      jsonb_build_object('titulo', OLD.titulo, 'artista', OLD.artista));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_canciones_changes ON canciones;
CREATE TRIGGER audit_canciones_changes
AFTER INSERT OR UPDATE OR DELETE ON canciones
FOR EACH ROW
EXECUTE FUNCTION trigger_audit_canciones();

-- Trigger para canales
CREATE OR REPLACE FUNCTION trigger_audit_canales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_admin_action('crear_canal', 'canal', NEW.id, 
      jsonb_build_object('nombre', NEW.nombre));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_admin_action('actualizar_canal', 'canal', NEW.id, 
      jsonb_build_object('nombre', NEW.nombre));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_admin_action('eliminar_canal', 'canal', OLD.id, 
      jsonb_build_object('nombre', OLD.nombre));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_canales_changes ON canales;
CREATE TRIGGER audit_canales_changes
AFTER INSERT OR UPDATE OR DELETE ON canales
FOR EACH ROW
EXECUTE FUNCTION trigger_audit_canales();

-- Trigger para playlists
CREATE OR REPLACE FUNCTION trigger_audit_playlists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_admin_action('crear_playlist', 'playlist', NEW.id, 
      jsonb_build_object('nombre', NEW.nombre, 'canal_id', NEW.canal_id));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_admin_action('actualizar_playlist', 'playlist', NEW.id, 
      jsonb_build_object('nombre', NEW.nombre));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_admin_action('eliminar_playlist', 'playlist', OLD.id, 
      jsonb_build_object('nombre', OLD.nombre));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_playlists_changes ON playlists;
CREATE TRIGGER audit_playlists_changes
AFTER INSERT OR UPDATE OR DELETE ON playlists
FOR EACH ROW
EXECUTE FUNCTION trigger_audit_playlists();

-- ============================================================================
-- RLS POLICIES (SEGURIDAD DE DATOS)
-- ============================================================================

-- Habilitar RLS en tablas
ALTER TABLE admin_musical_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_musical_audit_log ENABLE ROW LEVEL SECURITY;

-- WHITELIST: Solo admins musicales pueden verla/modificarla
DROP POLICY IF EXISTS "Whitelist solo visible para admins musicales" ON admin_musical_whitelist;
CREATE POLICY "Whitelist solo visible para admins musicales"
  ON admin_musical_whitelist FOR SELECT
  TO authenticated
  USING (is_admin_musical());

DROP POLICY IF EXISTS "Whitelist solo modificable por admins musicales" ON admin_musical_whitelist;
CREATE POLICY "Whitelist solo modificable por admins musicales"
  ON admin_musical_whitelist FOR ALL
  TO authenticated
  USING (is_admin_musical())
  WITH CHECK (is_admin_musical());

-- AUDIT LOG: Solo admins pueden leer
DROP POLICY IF EXISTS "Audit log solo visible para admins musicales" ON admin_musical_audit_log;
CREATE POLICY "Audit log solo visible para admins musicales"
  ON admin_musical_audit_log FOR SELECT
  TO authenticated
  USING (is_admin_musical());

-- CANCIONES: Solo admins musicales pueden escribir (lectura pública)
DROP POLICY IF EXISTS "Canciones públicas para lectura" ON canciones;
CREATE POLICY "Canciones públicas para lectura"
  ON canciones FOR SELECT
  TO authenticated
  USING (activa = true);

DROP POLICY IF EXISTS "Solo admin musical puede modificar canciones" ON canciones;
DROP POLICY IF EXISTS "Solo admin musical puede crear canciones" ON canciones;
DROP POLICY IF EXISTS "Solo admin musical puede actualizar canciones" ON canciones;
DROP POLICY IF EXISTS "Solo admin musical puede eliminar canciones" ON canciones;

CREATE POLICY "Solo admin musical puede crear canciones"
  ON canciones FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_musical());

CREATE POLICY "Solo admin musical puede actualizar canciones"
  ON canciones FOR UPDATE
  TO authenticated
  USING (is_admin_musical())
  WITH CHECK (is_admin_musical());

CREATE POLICY "Solo admin musical puede eliminar canciones"
  ON canciones FOR DELETE
  TO authenticated
  USING (is_admin_musical());

-- CANALES: Solo admins musicales pueden escribir (lectura pública)
DROP POLICY IF EXISTS "Canales públicos para lectura" ON canales;
CREATE POLICY "Canales públicos para lectura"
  ON canales FOR SELECT
  TO authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "Solo admin musical puede modificar canales" ON canales;
DROP POLICY IF EXISTS "Solo admin musical puede crear canales" ON canales;
DROP POLICY IF EXISTS "Solo admin musical puede actualizar canales" ON canales;
DROP POLICY IF EXISTS "Solo admin musical puede eliminar canales" ON canales;

CREATE POLICY "Solo admin musical puede crear canales"
  ON canales FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_musical());

CREATE POLICY "Solo admin musical puede actualizar canales"
  ON canales FOR UPDATE
  TO authenticated
  USING (is_admin_musical())
  WITH CHECK (is_admin_musical());

CREATE POLICY "Solo admin musical puede eliminar canales"
  ON canales FOR DELETE
  TO authenticated
  USING (is_admin_musical());

-- PLAYLISTS: Solo admins musicales pueden escribir (lectura pública)
DROP POLICY IF EXISTS "Playlists públicas para lectura" ON playlists;
CREATE POLICY "Playlists públicas para lectura"
  ON playlists FOR SELECT
  TO authenticated
  USING (activa = true);

DROP POLICY IF EXISTS "Solo admin musical puede modificar playlists" ON playlists;
DROP POLICY IF EXISTS "Solo admin musical puede crear playlists" ON playlists;
DROP POLICY IF EXISTS "Solo admin musical puede actualizar playlists" ON playlists;
DROP POLICY IF EXISTS "Solo admin musical puede eliminar playlists" ON playlists;

CREATE POLICY "Solo admin musical puede crear playlists"
  ON playlists FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_musical());

CREATE POLICY "Solo admin musical puede actualizar playlists"
  ON playlists FOR UPDATE
  TO authenticated
  USING (is_admin_musical())
  WITH CHECK (is_admin_musical());

CREATE POLICY "Solo admin musical puede eliminar playlists"
  ON playlists FOR DELETE
  TO authenticated
  USING (is_admin_musical());

-- PLAYLIST_CANCIONES: Solo admins musicales pueden escribir
DROP POLICY IF EXISTS "Playlist canciones públicas" ON playlist_canciones;
CREATE POLICY "Playlist canciones públicas"
  ON playlist_canciones FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo admin musical puede modificar playlist_canciones" ON playlist_canciones;
CREATE POLICY "Solo admin musical puede modificar playlist_canciones"
  ON playlist_canciones FOR ALL
  TO authenticated
  USING (is_admin_musical())
  WITH CHECK (is_admin_musical());

-- ============================================================================
-- FUNCIONES RPC PARA GESTIÓN DE WHITELIST
-- ============================================================================

-- Verificar si el usuario actual es admin musical
CREATE OR REPLACE FUNCTION rpc_check_is_admin_musical()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN is_admin_musical();
END;
$$;

COMMENT ON FUNCTION rpc_check_is_admin_musical IS 'RPC para verificar si el usuario actual es admin musical (para frontend)';

-- Obtener logs de auditoría (paginado)
CREATE OR REPLACE FUNCTION rpc_get_audit_logs(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_entidad_tipo TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  admin_email TEXT,
  accion TEXT,
  entidad_tipo TEXT,
  entidad_id UUID,
  detalles JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo admins pueden ver logs
  IF NOT is_admin_musical() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  
  RETURN QUERY
  SELECT 
    l.id,
    l.admin_email,
    l.accion,
    l.entidad_tipo,
    l.entidad_id,
    l.detalles,
    l.created_at
  FROM admin_musical_audit_log l
  WHERE 
    (p_entidad_tipo IS NULL OR l.entidad_tipo = p_entidad_tipo)
    AND (p_admin_email IS NULL OR l.admin_email = p_admin_email)
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION rpc_get_audit_logs IS 'Obtiene logs de auditoría con filtros opcionales (solo admins)';

-- ============================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON COLUMN admin_musical_whitelist.email IS 'Email del administrador autorizado (case insensitive)';
COMMENT ON COLUMN admin_musical_whitelist.activo IS 'Si false, el admin pierde acceso inmediatamente';
COMMENT ON COLUMN admin_musical_audit_log.accion IS 'Acción realizada (crear_canal, subir_cancion, etc.)';
COMMENT ON COLUMN admin_musical_audit_log.detalles IS 'Información adicional en formato JSON';

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================

-- Verificar que todo funciona
DO $$
BEGIN
  RAISE NOTICE '✅ Sistema de seguridad para administración musical instalado correctamente';
  RAISE NOTICE '📧 Emails autorizados: %', (SELECT string_agg(email, ', ') FROM admin_musical_whitelist WHERE activo = true);
END $$;
