-- ============================================================================
-- SETUP: Database Webhooks para Indicativos Automáticos
-- ============================================================================
-- Este script configura los triggers y webhooks necesarios para disparar
-- la generación automática de indicativos cuando:
-- 1. Un usuario completa su registro (registro_completo = true)
-- 2. Un usuario cambia el nombre de su establecimiento
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear tabla para tracking de indicativos generados
-- ============================================================================

CREATE TABLE IF NOT EXISTS indicativos_generados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    establecimiento_nombre TEXT NOT NULL,
    contenido_ids UUID[] NOT NULL DEFAULT '{}',
    programacion_id UUID REFERENCES programaciones(id) ON DELETE SET NULL,
    generado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado TEXT NOT NULL DEFAULT 'generando', -- generando, completado, error
    error_mensaje TEXT,
    
    -- Índices
    CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_indicativos_usuario ON indicativos_generados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_indicativos_estado ON indicativos_generados(estado);

-- ============================================================================
-- PASO 2: Función para notificar a n8n via pg_net (HTTP request)
-- ============================================================================

-- Primero, habilitar la extensión pg_net si no está habilitada
-- (Esto permite hacer HTTP requests desde PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Función que envía webhook a n8n
CREATE OR REPLACE FUNCTION notify_n8n_indicativos()
RETURNS TRIGGER AS $$
DECLARE
    n8n_webhook_url TEXT;
    payload JSONB;
    response_id BIGINT;
BEGIN
    -- URL del webhook de n8n (configurar en Supabase secrets o hardcodear)
    -- Obtener de variable de entorno o usar valor por defecto
    n8n_webhook_url := current_setting('app.n8n_indicativos_webhook_url', true);
    
    -- Si no está configurada, usar un placeholder (se debe configurar después)
    IF n8n_webhook_url IS NULL OR n8n_webhook_url = '' THEN
        n8n_webhook_url := 'https://tu-n8n-instance.com/webhook/indicativos';
        RAISE WARNING 'n8n webhook URL no configurada, usando placeholder: %', n8n_webhook_url;
    END IF;
    
    -- Construir payload según el tipo de evento
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.registro_completo = false AND NEW.registro_completo = true) THEN
        -- Nuevo registro completado
        payload := jsonb_build_object(
            'event_type', 'registro_completado',
            'usuario_id', NEW.id,
            'auth_user_id', NEW.auth_user_id,
            'establecimiento', COALESCE(NEW.establecimiento, NEW.nombre, 'Mi Establecimiento'),
            'email', NEW.email,
            'timestamp', NOW()
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.establecimiento IS DISTINCT FROM NEW.establecimiento THEN
        -- Cambio de nombre de establecimiento
        payload := jsonb_build_object(
            'event_type', 'cambio_establecimiento',
            'usuario_id', NEW.id,
            'auth_user_id', NEW.auth_user_id,
            'establecimiento_anterior', OLD.establecimiento,
            'establecimiento_nuevo', NEW.establecimiento,
            'email', NEW.email,
            'timestamp', NOW()
        );
    ELSE
        -- No es un evento que nos interese
        RETURN NEW;
    END IF;
    
    -- Enviar HTTP request a n8n usando pg_net
    SELECT net.http_post(
        url := n8n_webhook_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := payload
    ) INTO response_id;
    
    RAISE NOTICE 'Webhook enviado a n8n, response_id: %', response_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log del error pero no fallar la transacción
        RAISE WARNING 'Error enviando webhook a n8n: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PASO 3: Crear triggers
-- ============================================================================

-- Eliminar triggers existentes si los hay
DROP TRIGGER IF EXISTS trigger_indicativos_registro ON usuarios;
DROP TRIGGER IF EXISTS trigger_indicativos_cambio_nombre ON usuarios;

-- Trigger para registro completado
CREATE TRIGGER trigger_indicativos_registro
    AFTER INSERT OR UPDATE OF registro_completo ON usuarios
    FOR EACH ROW
    WHEN (NEW.registro_completo = true AND NEW.rol_id = 2)  -- Solo gestores
    EXECUTE FUNCTION notify_n8n_indicativos();

-- Trigger para cambio de establecimiento
CREATE TRIGGER trigger_indicativos_cambio_nombre
    AFTER UPDATE OF establecimiento ON usuarios
    FOR EACH ROW
    WHEN (
        NEW.establecimiento IS DISTINCT FROM OLD.establecimiento 
        AND NEW.rol_id = 2  -- Solo gestores
        AND NEW.registro_completo = true
    )
    EXECUTE FUNCTION notify_n8n_indicativos();

-- ============================================================================
-- PASO 4: Configurar la URL del webhook (ejecutar después de crear workflow en n8n)
-- ============================================================================

-- Ejecutar este comando para configurar la URL del webhook:
-- ALTER DATABASE postgres SET app.n8n_indicativos_webhook_url = 'https://tu-n8n.com/webhook/xxx';

-- O usar este comando SQL:
-- SELECT set_config('app.n8n_indicativos_webhook_url', 'https://tu-n8n.com/webhook/xxx', false);

-- ============================================================================
-- PASO 5: Verificar la configuración
-- ============================================================================

-- Ver triggers creados
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_indicativos%';

-- ============================================================================
-- NOTA: Alternativa usando Supabase Database Webhooks (Dashboard)
-- ============================================================================
-- Si prefieres configurar via Dashboard en lugar de pg_net:
-- 
-- 1. Ir a Supabase Dashboard > Database > Webhooks
-- 2. Crear webhook "indicativos-registro":
--    - Table: usuarios
--    - Events: INSERT, UPDATE
--    - URL: https://tu-n8n.com/webhook/indicativos
--    - HTTP Headers: Content-Type: application/json
--    
-- Esta opción es más fácil de configurar pero menos flexible que pg_net.
-- ============================================================================

COMMENT ON FUNCTION notify_n8n_indicativos() IS 
'Función que notifica a n8n cuando un usuario completa registro o cambia nombre de establecimiento.
Requiere configurar app.n8n_indicativos_webhook_url con la URL del webhook de n8n.';

COMMENT ON TABLE indicativos_generados IS
'Tabla para tracking de indicativos automáticos generados por usuario.
Permite saber qué indicativos tiene cada usuario y cuándo se generaron.';
