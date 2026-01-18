# Esquema Completo de Base de Datos - Ondeon Smart

> Documento generado para replicar la estructura en un nuevo proyecto Supabase
> Fecha: 2026-01-18

---

## 1. TABLAS PRINCIPALES

### 1.1 Usuarios y Autenticación

#### `usuarios` (Tabla Legacy Principal)
```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nombre TEXT,
  apellidos TEXT,
  telefono TEXT,
  username TEXT UNIQUE,
  password TEXT,  -- Hash bcrypt para usuarios legacy
  rol_id INTEGER DEFAULT 2,  -- 1=basico, 2=gestor, 3=admin
  activo BOOLEAN DEFAULT true,
  empresa_id UUID REFERENCES empresas(id),
  establecimiento TEXT,
  auth_user_id UUID UNIQUE,  -- Vincula con auth.users
  registro_completo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_auth_user_id ON usuarios(auth_user_id) WHERE auth_user_id IS NOT NULL;
```

#### `suscripciones`
```sql
CREATE TABLE suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  estado TEXT NOT NULL DEFAULT 'pending' 
    CHECK (estado IN ('pending', 'trialing', 'active', 'past_due', 'cancelled')),
  fecha_inicio TIMESTAMPTZ,
  fecha_fin_trial TIMESTAMPTZ,
  fecha_proxima_factura TIMESTAMPTZ,
  cancelado_en TIMESTAMPTZ,
  plan_nombre TEXT DEFAULT 'Gestor',
  precio_mensual DECIMAL(10,2),
  moneda TEXT DEFAULT 'eur',
  intervalo_facturacion TEXT DEFAULT 'month',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `registros_pendientes`
```sql
CREATE TABLE registros_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  nombre TEXT,
  telefono TEXT,
  nombre_negocio TEXT,
  metodo_auth TEXT CHECK (metodo_auth IN ('google', 'apple', 'email')),
  stripe_checkout_session_id TEXT,
  expira_en TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado', 'expirado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `historial_pagos`
```sql
CREATE TABLE historial_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suscripcion_id UUID REFERENCES suscripciones(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_charge_id TEXT,
  monto DECIMAL(10,2) NOT NULL,
  moneda TEXT DEFAULT 'eur',
  estado TEXT NOT NULL CHECK (estado IN ('succeeded', 'failed', 'pending', 'refunded', 'disputed')),
  descripcion TEXT,
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 1.2 Sistema de Presencia

#### `user_current_state`
```sql
CREATE TABLE user_current_state (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  playback_state TEXT CHECK (playback_state IN ('playing', 'paused', 'stopped')),
  current_canal_id UUID REFERENCES canales_genericos(id) ON DELETE SET NULL,
  current_canal_name TEXT,
  current_song_title TEXT,
  current_song_artist TEXT,
  current_song_started_at TIMESTAMPTZ,
  current_session_id UUID REFERENCES user_presence_sessions(id) ON DELETE SET NULL,
  device_id TEXT,
  app_version TEXT,
  metadata JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `user_presence_sessions`
```sql
CREATE TABLE user_presence_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id TEXT,
  device_info JSONB,
  app_version TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'disconnected')),
  total_duration_seconds INTEGER
);
```

#### `user_activity_events`
```sql
CREATE TABLE user_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  session_id UUID REFERENCES user_presence_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'song_changed', 'channel_changed', 'playback_state_changed',
    'scheduled_content_started', 'scheduled_content_ended',
    'manual_content_started', 'manual_content_ended', 'playback_error'
  )),
  canal_id UUID REFERENCES canales_genericos(id) ON DELETE SET NULL,
  canal_name TEXT,
  content_title TEXT,
  content_artist TEXT,
  content_duration_seconds INTEGER,
  event_data JSONB
);
```

---

### 1.3 Música y Canales

#### `canales`
```sql
CREATE TABLE canales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `canales_genericos`
```sql
CREATE TABLE canales_genericos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  color TEXT,
  genero TEXT,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `canales_ia`
```sql
CREATE TABLE canales_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  modelo_ia TEXT,
  configuracion JSONB,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `reproductor_usuario_canales`
```sql
CREATE TABLE reproductor_usuario_canales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal_id UUID REFERENCES canales(id),
  canal_generico_id UUID REFERENCES canales_genericos(id),
  canal_ia_id UUID REFERENCES canales_ia(id),
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `playlists`
```sql
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  canal_id UUID REFERENCES canales(id),
  imagen_url TEXT,
  activa BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `canciones`
```sql
CREATE TABLE canciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  artista TEXT,
  album TEXT,
  duracion_segundos INTEGER,
  url_audio TEXT NOT NULL,
  genero TEXT,
  bpm INTEGER,
  metadata JSONB,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `playlist_canciones`
```sql
CREATE TABLE playlist_canciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  cancion_id UUID NOT NULL REFERENCES canciones(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, cancion_id)
);
```

---

### 1.4 Contenido y Programaciones

#### `contenidos`
```sql
CREATE TABLE contenidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('anuncio', 'indicativo', 'promocion', 'otro')),
  url_audio TEXT NOT NULL,
  duracion_segundos INTEGER,
  empresa_id UUID REFERENCES empresas(id),
  marca_id UUID REFERENCES marcas(id),
  activo BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `contenido_asignaciones`
```sql
CREATE TABLE contenido_asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contenido_id UUID NOT NULL REFERENCES contenidos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `programaciones`
```sql
CREATE TABLE programaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('una_vez', 'diaria', 'semanal', 'mensual')),
  fecha_inicio DATE,
  fecha_fin DATE,
  hora_inicio TIME NOT NULL,
  hora_fin TIME,
  dias_semana INTEGER[], -- [1,2,3,4,5] para L-V
  activa BOOLEAN DEFAULT true,
  empresa_id UUID REFERENCES empresas(id),
  created_by UUID REFERENCES usuarios(id),
  modified_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `programacion_destinatarios`
```sql
CREATE TABLE programacion_destinatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programacion_id UUID NOT NULL REFERENCES programaciones(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `programacion_contenidos`
```sql
CREATE TABLE programacion_contenidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programacion_id UUID NOT NULL REFERENCES programaciones(id) ON DELETE CASCADE,
  contenido_id UUID NOT NULL REFERENCES contenidos(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `programacion_logs`
```sql
CREATE TABLE programacion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programacion_id UUID REFERENCES programaciones(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  resultado TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 1.5 Anuncios IA

#### `ai_generated_ads`
```sql
CREATE TABLE ai_generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  idea_original TEXT NOT NULL,
  texto_generado TEXT NOT NULL,
  ai_provider TEXT NOT NULL,
  voice_id TEXT,
  model_used TEXT,
  audio_url TEXT,
  duration_seconds INTEGER,
  contenido_id UUID REFERENCES contenidos(id) ON DELETE SET NULL,
  created_by UUID REFERENCES usuarios(id) NOT NULL,
  empresa_id UUID REFERENCES empresas(id),
  empresa_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);
```

#### `ai_ads_usage_tracking`
```sql
CREATE TABLE ai_ads_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  empresa_id UUID REFERENCES empresas(id),
  ai_ad_id UUID REFERENCES ai_generated_ads(id),
  tipo_operacion TEXT NOT NULL,
  tokens_usados INTEGER,
  caracteres_tts INTEGER,
  costo_estimado DECIMAL(10,4),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `background_music_library`
```sql
CREATE TABLE background_music_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT NOT NULL,
  duracion_segundos INTEGER NOT NULL,
  url_audio TEXT NOT NULL,
  url_preview TEXT,
  bpm INTEGER,
  mood TEXT,
  tags TEXT[],
  royalty_free BOOLEAN DEFAULT true,
  licencia TEXT,
  autor TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 1.6 Organizacional

#### `empresas`
```sql
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  razon_social TEXT,
  cif TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  logo_url TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `marcas`
```sql
CREATE TABLE marcas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  logo_url TEXT,
  colores JSONB,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `marca_empresas`
```sql
CREATE TABLE marca_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id UUID NOT NULL REFERENCES marcas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(marca_id, empresa_id)
);
```

#### `marca_contenidos`
```sql
CREATE TABLE marca_contenidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id UUID NOT NULL REFERENCES marcas(id) ON DELETE CASCADE,
  contenido_id UUID NOT NULL REFERENCES contenidos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `grupos`
```sql
CREATE TABLE grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  empresa_id UUID REFERENCES empresas(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `grupo_usuarios`
```sql
CREATE TABLE grupo_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grupo_id, usuario_id)
);
```

#### `admin_asignaciones`
```sql
CREATE TABLE admin_asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  marca_id UUID REFERENCES marcas(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 1.7 Historial

#### `playback_history`
```sql
CREATE TABLE playback_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal_id UUID REFERENCES canales(id),
  canal_name TEXT,
  song_title TEXT,
  song_artist TEXT,
  song_duration INTEGER,
  playback_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. VISTAS

```sql
-- Vista: Usuarios online
CREATE OR REPLACE VIEW v_users_online AS
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_name,
  u.email,
  ucs.playback_state,
  ucs.current_canal_name,
  ucs.current_song_title,
  ucs.last_seen_at
FROM usuarios u
INNER JOIN user_current_state ucs ON u.id = ucs.usuario_id
WHERE ucs.is_online = true;

-- Vista: Estadísticas 24h
CREATE OR REPLACE VIEW v_user_stats_24h AS
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_name,
  COUNT(CASE WHEN uae.event_type = 'song_changed' THEN 1 END) as songs_played,
  COUNT(CASE WHEN uae.event_type = 'channel_changed' THEN 1 END) as channel_changes
FROM usuarios u
LEFT JOIN user_activity_events uae ON u.id = uae.usuario_id 
  AND uae.created_at > (now() - interval '24 hours')
GROUP BY u.id, u.nombre;

-- Vista: Suscripciones activas
CREATE OR REPLACE VIEW v_suscripciones_activas AS
SELECT 
  s.id as suscripcion_id,
  s.usuario_id,
  u.email,
  u.nombre,
  s.estado,
  s.fecha_fin_trial
FROM suscripciones s
INNER JOIN usuarios u ON s.usuario_id = u.id
WHERE u.rol_id = 2;

-- Vista: Uso de IA por empresa
CREATE OR REPLACE VIEW ai_ads_usage_summary_by_company AS
SELECT 
  empresa_id,
  COUNT(*) as total_ads,
  SUM(tokens_usados) as total_tokens,
  SUM(caracteres_tts) as total_chars_tts
FROM ai_ads_usage_tracking
GROUP BY empresa_id;

-- Vista: Uso mensual de IA
CREATE OR REPLACE VIEW ai_ads_monthly_usage AS
SELECT 
  DATE_TRUNC('month', created_at) as mes,
  empresa_id,
  COUNT(*) as ads_generados,
  SUM(costo_estimado) as costo_total
FROM ai_ads_usage_tracking
GROUP BY DATE_TRUNC('month', created_at), empresa_id;
```

---

## 3. FUNCIONES RPC

```sql
-- Autorización del reproductor
CREATE OR REPLACE FUNCTION fn_reproductor_autorizacion(p_usuario_id UUID)
RETURNS TABLE(autorizado BOOLEAN, mensaje TEXT) AS $$
BEGIN
  -- Lógica de autorización
  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Heartbeat v2
CREATE OR REPLACE FUNCTION fn_reproductor_heartbeat_v2(
  p_usuario_id UUID,
  p_device_id TEXT,
  p_canal_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  UPDATE user_current_state
  SET last_seen_at = NOW(), is_online = true
  WHERE usuario_id = p_usuario_id;
  RETURN '{"ok": true}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Iniciar sesión única
CREATE OR REPLACE FUNCTION start_single_session(
  p_usuario_id UUID,
  p_device_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Cerrar sesiones previas
  UPDATE user_presence_sessions
  SET status = 'disconnected', ended_at = NOW()
  WHERE usuario_id = p_usuario_id AND status = 'active';
  
  -- Crear nueva sesión
  INSERT INTO user_presence_sessions (usuario_id, device_id)
  VALUES (p_usuario_id, p_device_id)
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Cerrar sesiones previas
CREATE OR REPLACE FUNCTION close_previous_user_sessions(p_usuario_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_presence_sessions
  SET status = 'disconnected', ended_at = NOW()
  WHERE usuario_id = p_usuario_id AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Verificar sesión de dispositivo
CREATE OR REPLACE FUNCTION check_device_session(
  p_usuario_id UUID,
  p_device_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_presence_sessions
    WHERE usuario_id = p_usuario_id 
    AND device_id = p_device_id 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql;

-- Actualizar actividad de sesión
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_presence_sessions
  SET last_activity_at = now()
  WHERE id = p_session_id AND status = 'active';
END;
$$ LANGUAGE plpgsql;
```

---

## 4. TRIGGERS

```sql
-- Trigger: Actualizar updated_at en user_current_state
CREATE OR REPLACE FUNCTION update_current_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_current_state_timestamp
  BEFORE UPDATE ON user_current_state
  FOR EACH ROW
  EXECUTE FUNCTION update_current_state_timestamp();

-- Trigger: Auto-crear usuario gestor desde auth.users
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rol_id INTEGER;
  v_nombre TEXT;
BEGIN
  v_rol_id := COALESCE((NEW.raw_user_meta_data->>'rol_id')::INTEGER, 2);
  
  IF v_rol_id = 2 THEN
    v_nombre := COALESCE(
      NEW.raw_user_meta_data->>'nombre',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );
    
    INSERT INTO public.usuarios (auth_user_id, email, nombre, rol_id, activo)
    VALUES (NEW.id, NEW.email, v_nombre, 2, true)
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
```

---

## 5. EDGE FUNCTIONS

| Función | Descripción | Secrets Requeridos |
|---------|-------------|-------------------|
| `login` | Login usuarios legacy | `SUPABASE_SERVICE_ROLE_KEY` |
| `change-password` | Cambio contraseña | `SUPABASE_SERVICE_ROLE_KEY` |
| `generate-ad` | Generar anuncios IA | `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ONDEON_LAMBDA_S3_URL` |
| `stripe-checkout` | Crear checkout Stripe | `STRIPE_SECRET_KEY` |
| `stripe-portal` | Portal cliente Stripe | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | Webhooks de Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `send-email` | Envío emails | `RESEND_API_KEY` (o similar) |
| `cleanup-pendientes` | Limpiar registros | `SUPABASE_SERVICE_ROLE_KEY` |

---

## 6. REALTIME

Tablas con Realtime habilitado:
- `user_current_state`
- `programaciones`
- `programacion_destinatarios`
- `playlists`
- `playlist_canciones`

---

## 7. RLS (Row Level Security)

### Ejemplo para `user_current_state`:
```sql
ALTER TABLE user_current_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own state" ON user_current_state
  FOR SELECT USING (usuario_id IN (
    SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update own state" ON user_current_state
  FOR UPDATE USING (usuario_id IN (
    SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
  ));
```

### Ejemplo para `suscripciones`:
```sql
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON suscripciones
  FOR SELECT USING (usuario_id IN (
    SELECT id FROM usuarios WHERE auth_user_id = auth.uid()
  ));
```

---

## 8. ORDEN DE EJECUCIÓN

Para replicar en nuevo proyecto:

1. Crear proyecto en Supabase
2. Ejecutar scripts en orden:
   - `001_create_presence_system.sql`
   - `002_migrate_from_playback_history.sql`
   - `003_enable_realtime_and_rls.sql`
   - ... hasta `026_fix_presence_column_names.sql`
   - `OPTIMIZACION-INDICES-DEFINITIVO.sql`
3. Configurar Secrets en Edge Functions
4. Desplegar Edge Functions
5. Habilitar Realtime en tablas necesarias
6. Actualizar `.env` con nueva URL y keys

---

## 9. VARIABLES DE ENTORNO

```env
# Cliente (con prefijo VITE_)
VITE_SUPABASE_URL=https://NUEVO-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase Secrets (configurar en dashboard)
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=sk_...
ONDEON_LAMBDA_S3_URL=https://...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
