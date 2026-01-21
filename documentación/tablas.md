**tabla playlist**

create table public.playlists (
  id uuid not null default gen_random_uuid (),
  canal_id uuid null,
  nombre text not null,
  fecha_creacion timestamp with time zone null default now(),
  activa boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  tipo text null default 'general'::text,
  repetir_cada integer null,
  repetir_unidad character varying(20) null,
  peso integer null default 1,
  orden character varying(20) null,
  activa_desde timestamp with time zone null,
  activa_hasta timestamp with time zone null,
  constraint playlists_pkey primary key (id),
  constraint playlists_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint playlists_orden_check check (
    (
      (orden)::text = any (array[('aleatorio'::character varying)::text])
    )
  ),
  constraint playlists_repetir_unidad_check check (
    (
      (repetir_unidad)::text = any (array[('canciones'::character varying)::text])
    )
  ),
  constraint playlists_tipo_check check (
    (
      tipo = any (
        array[
          'general'::text,
          'intervalo'::text,
          'rotacion'::text,
          'inmediata'::text
        ]
      )
    )
  ),
  constraint playlists_peso_check check (
    (
      (peso >= 1)
      and (peso <= 20)
    )
  ),
  constraint playlists_estado_check check ((activa = any (array[true, false]))) not VALID
) TABLESPACE pg_default;

create index IF not exists idx_playlists_canal_id on public.playlists using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_playlists_tipo on public.playlists using btree (tipo) TABLESPACE pg_default;

create index IF not exists idx_playlists_canal_activa on public.playlists using btree (canal_id, activa) TABLESPACE pg_default;

create index IF not exists idx_playlists_peso on public.playlists using btree (peso desc) TABLESPACE pg_default;

create index IF not exists idx_playlists_fechas on public.playlists using btree (canal_id, activa, activa_desde, activa_hasta) TABLESPACE pg_default
where
  (activa = true);


**tabla playlist_canciones**

  create table public.playlist_canciones (
  id uuid not null default gen_random_uuid (),
  playlist_id uuid null,
  cancion_id uuid null,
  posicion integer null,
  created_at timestamp with time zone null default now(),
  peso integer null default 1,
  constraint playlist_canciones_pkey primary key (id),
  constraint playlist_canciones_cancion_id_fkey foreign KEY (cancion_id) references canciones (id) on delete CASCADE,
  constraint playlist_canciones_playlist_id_fkey foreign KEY (playlist_id) references playlists (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_playlist_id on public.playlist_canciones using btree (playlist_id) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_peso on public.playlist_canciones using btree (playlist_id, peso) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_playlist_posicion on public.playlist_canciones using btree (playlist_id, posicion) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_cancion_id on public.playlist_canciones using btree (cancion_id) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_lookup on public.playlist_canciones using btree (playlist_id, posicion) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_cancion on public.playlist_canciones using btree (cancion_id) TABLESPACE pg_default;


**tabla canales**

create table public.canales (
  id uuid not null default gen_random_uuid (),
  nombre text not null,
  descripcion text null,
  estado character varying(50) null default 'outdated'::character varying,
  canciones_actuales integer null default 0,
  total_canciones integer null default 25,
  ultima_actualizacion timestamp with time zone null default now(),
  frecuencia_actualizacion integer null default 7,
  nombre_bucket character varying(255) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  total_canciones_actualizacion integer null,
  especialidad_id integer null,
  usuario_id_cliente uuid null,
  es_personalizado boolean null default false,
  imagen_url text null,
  constraint canales_pkey primary key (id),
  constraint canales_especialidad_id_fkey foreign KEY (especialidad_id) references especialidades (id)
) TABLESPACE pg_default;



**tabla empresa_canales**


create table public.empresa_canales (
  id uuid not null default gen_random_uuid (),
  empresa_id uuid null,
  canal_id uuid null,
  constraint empresa_canales_pkey primary key (id),
  constraint empresa_canales_empresa_id_canal_id_key unique (empresa_id, canal_id),
  constraint empresa_canales_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint empresa_canales_empresa_id_fkey foreign KEY (empresa_id) references empresas (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_empresa_canales_empresa on public.empresa_canales using btree (empresa_id) TABLESPACE pg_default;

create index IF not exists idx_empresa_canales_canal on public.empresa_canales using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_empresa_canales_empresa_canal on public.empresa_canales using btree (empresa_id, canal_id) TABLESPACE pg_default;

create index IF not exists idx_empresa_canales_canal_id on public.empresa_canales using btree (canal_id) TABLESPACE pg_default;

**tabla grupo_canales**

create table public.grupo_canales (
  id uuid not null default gen_random_uuid (),
  grupo_id uuid null,
  canal_id uuid null,
  constraint grupo_canales_pkey primary key (id),
  constraint grupo_canales_grupo_id_canal_id_key unique (grupo_id, canal_id),
  constraint grupo_canales_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint grupo_canales_grupo_id_fkey foreign KEY (grupo_id) references grupos (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_grupo_canales_grupo on public.grupo_canales using btree (grupo_id) TABLESPACE pg_default;

create index IF not exists idx_grupo_canales_canal on public.grupo_canales using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_grupo_canales_grupo_canal on public.grupo_canales using btree (grupo_id, canal_id) TABLESPACE pg_default;

create index IF not exists idx_grupo_canales_canal_id on public.grupo_canales using btree (canal_id) TABLESPACE pg_default;



**tabla reproductor_usuario_canales**

create table public.reproductor_usuario_canales (
  id uuid not null default gen_random_uuid (),
  usuario_id uuid null,
  canal_id uuid null,
  activo boolean null default true,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  creado_en timestamp with time zone not null default now(),
  actualizado_en timestamp with time zone not null default now(),
  constraint reproductor_usuario_canales_pkey primary key (id),
  constraint reproductor_usuario_canales_usuario_id_canal_id_key unique (usuario_id, canal_id),
  constraint reproductor_usuario_canales_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint reproductor_usuario_canales_usuario_id_fkey foreign KEY (usuario_id) references usuarios (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_usuario_id on public.reproductor_usuario_canales using btree (usuario_id) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_canal_id on public.reproductor_usuario_canales using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_activo on public.reproductor_usuario_canales using btree (activo) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_usuario_canal on public.reproductor_usuario_canales using btree (usuario_id, canal_id) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_lookup on public.reproductor_usuario_canales using btree (usuario_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_reproductor_usuario_canales_canal on public.reproductor_usuario_canales using btree (canal_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_reproductor_usuario_canales_full on public.reproductor_usuario_canales using btree (usuario_id, canal_id, activo) TABLESPACE pg_default;

create trigger update_reproductor_usuario_canales_updated_at BEFORE
update on reproductor_usuario_canales for EACH row
execute FUNCTION update_updated_at_column ();

**tabla canciones**

create table public.canciones (
  id uuid not null default gen_random_uuid (),
  canal_id uuid null,
  nombre character varying(255) not null,
  artista character varying(255) null,
  genero text null,
  duracion text null,
  url_s3 text null,
  s3_key text null,
  upload_date timestamp with time zone null default now(),
  titulo character varying(255) null,
  bpm integer null default 120,
  estilo_musical text null default 'Desconocido'::text,
  mood text null default 'Neutral'::text,
  release_date date null,
  duration_ms bigint null,
  derechos text null,
  spotify_id text null,
  deezer_id text null,
  apple_id text null,
  youtube_id text null,
  external_urls jsonb null,
  key text null,
  mode smallint null,
  time_signature smallint null,
  energy real null,
  valence real null,
  danceability real null,
  acousticness real null,
  instrumentalness real null,
  liveness real null,
  speechiness real null,
  spectral_centroid real null,
  mfcc jsonb null,
  dynamic_range real null,
  loudness real null,
  mood_tags jsonb null,
  custom_tags jsonb null,
  created_by uuid null,
  constraint canciones_pkey primary key (id),
  constraint canciones_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint canciones_created_by_fkey foreign KEY (created_by) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_canciones_canal_id on public.canciones using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_canciones_genero on public.canciones using btree (genero) TABLESPACE pg_default;

create index IF not exists idx_canciones_mood on public.canciones using btree (mood) TABLESPACE pg_default;

create index IF not exists idx_canciones_bpm on public.canciones using btree (bpm) TABLESPACE pg_default;

create index IF not exists idx_canciones_estilo_musical on public.canciones using btree (estilo_musical) TABLESPACE pg_default;

create unique INDEX IF not exists uq_canciones_nombre on public.canciones using btree (nombre) TABLESPACE pg_default;

create index IF not exists idx_canciones_titulo on public.canciones using gin (
  to_tsvector(
    'spanish'::regconfig,
    (
      (
        (COALESCE(titulo, ''::character varying))::text || ' '::text
      ) || (COALESCE(artista, ''::character varying))::text
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_canciones_spotify on public.canciones using btree (spotify_id) TABLESPACE pg_default;

create index IF not exists idx_canciones_upload_date on public.canciones using btree (upload_date desc) TABLESPACE pg_default;

create index IF not exists idx_canciones_mood_tags on public.canciones using gin (mood_tags) TABLESPACE pg_default;

create index IF not exists idx_canciones_artista on public.canciones using btree (artista) TABLESPACE pg_default;

create index IF not exists idx_canciones_busqueda on public.canciones using btree (titulo, artista) TABLESPACE pg_default;

create index IF not exists idx_canciones_url on public.canciones using btree (url_s3) TABLESPACE pg_default;

create index IF not exists idx_canciones_canal on public.canciones using btree (canal_id) TABLESPACE pg_default;


**tabla admin_asignaciones**

create table public.admin_asignaciones (
  id uuid not null default gen_random_uuid (),
  admin_id uuid not null,
  empresa_id uuid not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint admin_asignaciones_pkey primary key (id),
  constraint admin_asignaciones_unique unique (admin_id, empresa_id),
  constraint admin_asignaciones_admin_id_fkey foreign KEY (admin_id) references usuarios (id) on delete CASCADE,
  constraint admin_asignaciones_created_by_fkey foreign KEY (created_by) references usuarios (id),
  constraint admin_asignaciones_empresa_id_fkey foreign KEY (empresa_id) references empresas (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_admin_asignaciones_admin on public.admin_asignaciones using btree (admin_id) TABLESPACE pg_default;

create index IF not exists idx_admin_asignaciones_empresa on public.admin_asignaciones using btree (empresa_id) TABLESPACE pg_default;

create index IF not exists idx_admin_asignaciones_created on public.admin_asignaciones using btree (created_at desc) TABLESPACE pg_default;

create trigger trigger_validar_admin_rol BEFORE INSERT
or
update on admin_asignaciones for EACH row
execute FUNCTION validar_admin_rol ();


**tabla grupos**

create table public.grupos (
  id uuid not null default extensions.uuid_generate_v4 (),
  nombre text not null,
  descripcion text null,
  empresa_id uuid null,
  usuarios uuid[] null default '{}'::uuid[],
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint grupo_pkey primary key (id),
  constraint grupo_empresa_id_fkey foreign KEY (empresa_id) references empresas (id)
) TABLESPACE pg_default;


**tabla grupo_usuarios**

create table public.grupo_usuarios (
  grupo_id uuid not null,
  usuario_id uuid not null,
  constraint grupo_usuarios_pkey primary key (grupo_id, usuario_id),
  constraint grupo_usuarios_grupo_id_fkey foreign KEY (grupo_id) references grupos (id) on delete CASCADE,
  constraint grupo_usuarios_usuario_id_fkey foreign KEY (usuario_id) references usuarios (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_grupo_usuarios_grupo on public.grupo_usuarios using btree (grupo_id) TABLESPACE pg_default;

create index IF not exists idx_grupo_usuarios_usuario on public.grupo_usuarios using btree (usuario_id) TABLESPACE pg_default;

**tabla empresas**

create table public.empresas (
  id uuid not null default gen_random_uuid (),
  metodo_pago text null,
  razon_social text null,
  cif text null,
  direccion_postal text null,
  codigo_postal text null,
  comunidad_autonoma text null,
  provincia text null,
  localidad text null,
  pais text null,
  datos_bancarios text null,
  documento_sepa_url text null,
  ccaa_code text null,
  provincia_code text null,
  localidad_code text null,
  constraint empresas_pkey primary key (id)
) TABLESPACE pg_default;


**tabla reproductor_usuario_canales**

create table public.reproductor_usuario_canales (
  id uuid not null default gen_random_uuid (),
  usuario_id uuid null,
  canal_id uuid null,
  activo boolean null default true,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  creado_en timestamp with time zone not null default now(),
  actualizado_en timestamp with time zone not null default now(),
  constraint reproductor_usuario_canales_pkey primary key (id),
  constraint reproductor_usuario_canales_usuario_id_canal_id_key unique (usuario_id, canal_id),
  constraint reproductor_usuario_canales_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint reproductor_usuario_canales_usuario_id_fkey foreign KEY (usuario_id) references usuarios (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_usuario_id on public.reproductor_usuario_canales using btree (usuario_id) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_canal_id on public.reproductor_usuario_canales using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_activo on public.reproductor_usuario_canales using btree (activo) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_usuario_canal on public.reproductor_usuario_canales using btree (usuario_id, canal_id) TABLESPACE pg_default;

create index IF not exists idx_reproductor_usuario_canales_lookup on public.reproductor_usuario_canales using btree (usuario_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_reproductor_usuario_canales_canal on public.reproductor_usuario_canales using btree (canal_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_reproductor_usuario_canales_full on public.reproductor_usuario_canales using btree (usuario_id, canal_id, activo) TABLESPACE pg_default;

create trigger update_reproductor_usuario_canales_updated_at BEFORE
update on reproductor_usuario_canales for EACH row
execute FUNCTION update_updated_at_column ();


**tabla canales_genericos**

create table public.canales_genericos (
  id uuid not null default gen_random_uuid (),
  canal_id uuid null,
  is_generic boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint canales_genericos_pkey primary key (id),
  constraint canales_genericos_canal_id_key unique (canal_id),
  constraint canales_genericos_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_canales_genericos_canal_id on public.canales_genericos using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_canales_genericos_is_generic on public.canales_genericos using btree (is_generic) TABLESPACE pg_default;

create index IF not exists idx_canales_genericos_created_at on public.canales_genericos using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_canales_genericos_lookup on public.canales_genericos using btree (is_generic, canal_id) TABLESPACE pg_default
where
  (is_generic = true);

create trigger on_nuevo_canal_generico
after INSERT on canales_genericos for EACH row
execute FUNCTION trigger_nuevo_canal_generico ();

create trigger update_canales_genericos_updated_at BEFORE
update on canales_genericos for EACH row
execute FUNCTION update_updated_at_column ();



**tabla playlist_canciones**

create table public.playlist_canciones (
  id uuid not null default gen_random_uuid (),
  playlist_id uuid null,
  cancion_id uuid null,
  posicion integer null,
  created_at timestamp with time zone null default now(),
  peso integer null default 1,
  constraint playlist_canciones_pkey primary key (id),
  constraint playlist_canciones_cancion_id_fkey foreign KEY (cancion_id) references canciones (id) on delete CASCADE,
  constraint playlist_canciones_playlist_id_fkey foreign KEY (playlist_id) references playlists (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_playlist_id on public.playlist_canciones using btree (playlist_id) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_peso on public.playlist_canciones using btree (playlist_id, peso) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_playlist_posicion on public.playlist_canciones using btree (playlist_id, posicion) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_cancion_id on public.playlist_canciones using btree (cancion_id) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_lookup on public.playlist_canciones using btree (playlist_id, posicion) TABLESPACE pg_default;

create index IF not exists idx_playlist_canciones_cancion on public.playlist_canciones using btree (cancion_id) TABLESPACE pg_default;



**tabla canciones**


create table public.canciones (
  id uuid not null default gen_random_uuid (),
  canal_id uuid null,
  nombre character varying(255) not null,
  artista character varying(255) null,
  genero text null,
  duracion text null,
  url_s3 text null,
  s3_key text null,
  upload_date timestamp with time zone null default now(),
  titulo character varying(255) null,
  bpm integer null default 120,
  estilo_musical text null default 'Desconocido'::text,
  mood text null default 'Neutral'::text,
  release_date date null,
  duration_ms bigint null,
  derechos text null,
  spotify_id text null,
  deezer_id text null,
  apple_id text null,
  youtube_id text null,
  external_urls jsonb null,
  key text null,
  mode smallint null,
  time_signature smallint null,
  energy real null,
  valence real null,
  danceability real null,
  acousticness real null,
  instrumentalness real null,
  liveness real null,
  speechiness real null,
  spectral_centroid real null,
  mfcc jsonb null,
  dynamic_range real null,
  loudness real null,
  mood_tags jsonb null,
  custom_tags jsonb null,
  created_by uuid null,
  constraint canciones_pkey primary key (id),
  constraint canciones_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint canciones_created_by_fkey foreign KEY (created_by) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_canciones_canal_id on public.canciones using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_canciones_genero on public.canciones using btree (genero) TABLESPACE pg_default;

create index IF not exists idx_canciones_mood on public.canciones using btree (mood) TABLESPACE pg_default;

create index IF not exists idx_canciones_bpm on public.canciones using btree (bpm) TABLESPACE pg_default;

create index IF not exists idx_canciones_estilo_musical on public.canciones using btree (estilo_musical) TABLESPACE pg_default;

create unique INDEX IF not exists uq_canciones_nombre on public.canciones using btree (nombre) TABLESPACE pg_default;

create index IF not exists idx_canciones_titulo on public.canciones using gin (
  to_tsvector(
    'spanish'::regconfig,
    (
      (
        (COALESCE(titulo, ''::character varying))::text || ' '::text
      ) || (COALESCE(artista, ''::character varying))::text
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_canciones_spotify on public.canciones using btree (spotify_id) TABLESPACE pg_default;

create index IF not exists idx_canciones_upload_date on public.canciones using btree (upload_date desc) TABLESPACE pg_default;

create index IF not exists idx_canciones_mood_tags on public.canciones using gin (mood_tags) TABLESPACE pg_default;

create index IF not exists idx_canciones_artista on public.canciones using btree (artista) TABLESPACE pg_default;

create index IF not exists idx_canciones_busqueda on public.canciones using btree (titulo, artista) TABLESPACE pg_default;

create index IF not exists idx_canciones_url on public.canciones using btree (url_s3) TABLESPACE pg_default;

create index IF not exists idx_canciones_canal on public.canciones using btree (canal_id) TABLESPACE pg_default;



**tabla playlists**

create table public.playlists (
  id uuid not null default gen_random_uuid (),
  canal_id uuid null,
  nombre text not null,
  fecha_creacion timestamp with time zone null default now(),
  activa boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  tipo text null default 'general'::text,
  repetir_cada integer null,
  repetir_unidad character varying(20) null,
  peso integer null default 1,
  orden character varying(20) null,
  activa_desde timestamp with time zone null,
  activa_hasta timestamp with time zone null,
  constraint playlists_pkey primary key (id),
  constraint playlists_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint playlists_orden_check check (
    (
      (orden)::text = any (array[('aleatorio'::character varying)::text])
    )
  ),
  constraint playlists_repetir_unidad_check check (
    (
      (repetir_unidad)::text = any (array[('canciones'::character varying)::text])
    )
  ),
  constraint playlists_tipo_check check (
    (
      tipo = any (
        array[
          'general'::text,
          'intervalo'::text,
          'rotacion'::text,
          'inmediata'::text
        ]
      )
    )
  ),
  constraint playlists_peso_check check (
    (
      (peso >= 1)
      and (peso <= 20)
    )
  ),
  constraint playlists_estado_check check ((activa = any (array[true, false]))) not VALID
) TABLESPACE pg_default;

create index IF not exists idx_playlists_canal_id on public.playlists using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_playlists_tipo on public.playlists using btree (tipo) TABLESPACE pg_default;

create index IF not exists idx_playlists_canal_activa on public.playlists using btree (canal_id, activa) TABLESPACE pg_default;

create index IF not exists idx_playlists_peso on public.playlists using btree (peso desc) TABLESPACE pg_default;

create index IF not exists idx_playlists_fechas on public.playlists using btree (canal_id, activa, activa_desde, activa_hasta) TABLESPACE pg_default
where
  (activa = true);


**Tabla canales**

create table public.canales (
  id uuid not null default gen_random_uuid (),
  nombre text not null,
  descripcion text null,
  estado character varying(50) null default 'outdated'::character varying,
  canciones_actuales integer null default 0,
  total_canciones integer null default 25,
  ultima_actualizacion timestamp with time zone null default now(),
  frecuencia_actualizacion integer null default 7,
  nombre_bucket character varying(255) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  total_canciones_actualizacion integer null,
  especialidad_id integer null,
  usuario_id_cliente uuid null,
  es_personalizado boolean null default false,
  imagen_url text null,
  constraint canales_pkey primary key (id),
  constraint canales_especialidad_id_fkey foreign KEY (especialidad_id) references especialidades (id)
) TABLESPACE pg_default;


**Tabla contenidos**

create table public.contenidos (
  id uuid not null default gen_random_uuid (),
  nombre character varying(255) not null,
  tipo_contenido text not null,
  url_s3 text not null,
  s3_key text not null,
  tamaño_bytes bigint not null,
  duracion_segundos integer null,
  formato_audio text null,
  etiquetas text[] null,
  metadata jsonb null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  activo boolean null default true,
  constraint contenidos_pkey primary key (id),
  constraint contenidos_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint contenidos_tipo_contenido_check check (
    (
      tipo_contenido = any (
        array[
          'indicativo'::text,
          'mencion'::text,
          'cuna'::text,
          'pieza_divulgativa'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_contenidos_created_at on public.contenidos using btree (created_at) TABLESPACE pg_default;



**Tabla ai_generated_ads**

create table public.ai_generated_ads (
  id uuid not null default gen_random_uuid (),
  titulo text not null,
  idea_original text not null,
  texto_generado text not null,
  ai_provider text not null,
  voice_id text null,
  model_used text null,
  audio_url text null,
  duration_seconds integer null,
  contenido_id uuid null,
  created_by uuid not null,
  empresa_id uuid null,
  empresa_nombre text null,
  created_at timestamp with time zone null default now(),
  metadata jsonb null,
  constraint ai_generated_ads_pkey primary key (id),
  constraint ai_generated_ads_contenido_id_fkey foreign KEY (contenido_id) references contenidos (id) on delete set null,
  constraint ai_generated_ads_created_by_fkey foreign KEY (created_by) references usuarios (id),
  constraint ai_generated_ads_empresa_id_fkey foreign KEY (empresa_id) references empresas (id)
) TABLESPACE pg_default;

create index IF not exists idx_ai_ads_empresa on public.ai_generated_ads using btree (empresa_id) TABLESPACE pg_default;

create index IF not exists idx_ai_ads_creator on public.ai_generated_ads using btree (created_by) TABLESPACE pg_default;

create index IF not exists idx_ai_ads_created on public.ai_generated_ads using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_ai_ads_contenido on public.ai_generated_ads using btree (contenido_id) TABLESPACE pg_default;


* conteniod_asignaciones:

create table public.contenido_asignaciones (
  id uuid not null default gen_random_uuid (),
  contenido_id uuid not null,
  canal_id uuid null,
  empresa_id uuid null,
  sector_id integer null,
  grupo_id uuid null,
  usuario_id uuid null,
  prioridad integer null default 1,
  activo boolean null default true,
  created_at timestamp with time zone null default now(),
  constraint contenido_asignaciones_pkey primary key (id),
  constraint contenido_asignaciones_contenido_id_fkey foreign KEY (contenido_id) references contenidos (id) on delete CASCADE,
  constraint contenido_asignaciones_empresa_id_fkey foreign KEY (empresa_id) references empresas (id),
  constraint contenido_asignaciones_canal_id_fkey foreign KEY (canal_id) references canales (id),
  constraint contenido_asignaciones_sector_id_fkey foreign KEY (sector_id) references sectores (id),
  constraint contenido_asignaciones_usuario_id_fkey foreign KEY (usuario_id) references usuarios (id),
  constraint contenido_asignaciones_grupo_id_fkey foreign KEY (grupo_id) references grupos (id)
) TABLESPACE pg_default;

create index IF not exists idx_contenido_asignaciones_contenido on public.contenido_asignaciones using btree (contenido_id) TABLESPACE pg_default;

create index IF not exists idx_contenido_asignaciones_canal on public.contenido_asignaciones using btree (canal_id) TABLESPACE pg_default;

create index IF not exists idx_contenido_asignaciones_usuario on public.contenido_asignaciones using btree (usuario_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_contenido_asignaciones_empresa on public.contenido_asignaciones using btree (empresa_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_contenido_asignaciones_grupo on public.contenido_asignaciones using btree (grupo_id, activo) TABLESPACE pg_default
where
  (activo = true);

  **Tabla "programaciones"**

  create table public.programaciones (
  id uuid not null default gen_random_uuid (),
  descripcion text null,
  estado character varying(20) null default 'pendiente'::character varying,
  tipo character varying(20) not null,
  fecha_inicio date not null,
  fecha_fin date null,
  frecuencia_minutos integer null default 15,
  daily_mode character varying(20) null,
  cada_dias integer null,
  rango_desde time without time zone null,
  rango_hasta time without time zone null,
  hora_una_vez_dia time without time zone null,
  weekly_mode character varying(20) null,
  weekly_days text[] null,
  weekly_rango_desde time without time zone null,
  weekly_rango_hasta time without time zone null,
  weekly_hora_una_vez time without time zone null,
  annual_date character varying(5) null,
  annual_time time without time zone null,
  terminacion_tipo character varying(20) null default 'nunca'::character varying,
  despues_dias integer null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  updated_at timestamp with time zone null default now(),
  updated_by uuid null,
  prioridad integer null default 0,
  modo_audio character varying(20) null default 'fade_out'::character varying,
  hora_inicio time without time zone null default '08:00:00'::time without time zone,
  hora_fin time without time zone null default '23:59:00'::time without time zone,
  esperar_fin_cancion boolean null default false,
  constraint programaciones_pkey primary key (id),
  constraint programaciones_updated_by_fkey foreign KEY (updated_by) references auth.users (id) on delete set null,
  constraint programaciones_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint programaciones_estado_check check (
    (
      (estado)::text = any (
        (
          array[
            'pendiente'::character varying,
            'activo'::character varying,
            'pausado'::character varying,
            'completado'::character varying,
            'cancelado'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint programaciones_frecuencia_minutos_check check ((frecuencia_minutos > 0)),
  constraint programaciones_modo_audio_check check (
    (
      (modo_audio)::text = any (
        (
          array[
            'fade_out'::character varying,
            'background'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint programaciones_terminacion_tipo_check check (
    (
      (terminacion_tipo)::text = any (
        (
          array[
            'nunca'::character varying,
            'en_fecha'::character varying,
            'despues'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint programaciones_tipo_check check (
    (
      (tipo)::text = any (
        (
          array[
            'una_vez'::character varying,
            'diaria'::character varying,
            'semanal'::character varying,
            'anual'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint programaciones_cada_dias_check check ((cada_dias > 0)),
  constraint programaciones_weekly_mode_check check (
    (
      (weekly_mode)::text = any (
        (
          array[
            'rango'::character varying,
            'una_vez_dia'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint programaciones_daily_mode_check check (
    (
      (daily_mode)::text = any (
        (
          array[
            'cada'::character varying,
            'laborales'::character varying,
            'una_vez_dia'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint programaciones_despues_dias_check check ((despues_dias > 0))
) TABLESPACE pg_default;

create index IF not exists idx_programaciones_estado on public.programaciones using btree (estado) TABLESPACE pg_default;

create index IF not exists idx_programaciones_tipo on public.programaciones using btree (tipo) TABLESPACE pg_default;

create index IF not exists idx_programaciones_fecha_inicio on public.programaciones using btree (fecha_inicio) TABLESPACE pg_default;

create index IF not exists idx_programaciones_created_by on public.programaciones using btree (created_by) TABLESPACE pg_default;

create index IF not exists idx_programaciones_hora_inicio on public.programaciones using btree (hora_inicio) TABLESPACE pg_default;

create index IF not exists idx_programaciones_hora_fin on public.programaciones using btree (hora_fin) TABLESPACE pg_default;

create index IF not exists idx_programaciones_prioridad on public.programaciones using btree (prioridad desc) TABLESPACE pg_default;

create index IF not exists idx_programaciones_esperar_fin on public.programaciones using btree (esperar_fin_cancion) TABLESPACE pg_default
where
  ((estado)::text = 'activo'::text);

create index IF not exists idx_programaciones_modo_audio on public.programaciones using btree (modo_audio) TABLESPACE pg_default;

create index IF not exists idx_programaciones_fechas on public.programaciones using btree (fecha_inicio, fecha_fin, estado) TABLESPACE pg_default;


**Tabla "programacion_destinatarios"**

create table public.programacion_destinatarios (
  id uuid not null default gen_random_uuid (),
  programacion_id uuid not null,
  tipo character varying(20) not null,
  usuario_id uuid null,
  grupo_id uuid null,
  empresa_id uuid null,
  sector_id integer null,
  activo boolean null default true,
  created_at timestamp with time zone null default now(),
  constraint programacion_destinatarios_pkey primary key (id),
  constraint programacion_destinatarios_empresa_id_fkey foreign KEY (empresa_id) references empresas (id) on delete CASCADE,
  constraint programacion_destinatarios_grupo_id_fkey foreign KEY (grupo_id) references grupos (id) on delete CASCADE,
  constraint programacion_destinatarios_programacion_id_fkey foreign KEY (programacion_id) references programaciones (id) on delete CASCADE,
  constraint programacion_destinatarios_sector_id_fkey foreign KEY (sector_id) references sectores (id) on delete CASCADE,
  constraint programacion_destinatarios_usuario_id_fkey foreign KEY (usuario_id) references usuarios (id) on delete CASCADE,
  constraint programacion_destinatarios_tipo_check check (
    (
      (tipo)::text = any (
        (
          array[
            'usuario'::character varying,
            'grupo'::character varying,
            'empresa'::character varying,
            'sector'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint check_single_destinatario check (
    (
      (
        ((tipo)::text = 'usuario'::text)
        and (usuario_id is not null)
        and (grupo_id is null)
        and (empresa_id is null)
        and (sector_id is null)
      )
      or (
        ((tipo)::text = 'grupo'::text)
        and (grupo_id is not null)
        and (usuario_id is null)
        and (empresa_id is null)
        and (sector_id is null)
      )
      or (
        ((tipo)::text = 'empresa'::text)
        and (empresa_id is not null)
        and (usuario_id is null)
        and (grupo_id is null)
        and (sector_id is null)
      )
      or (
        ((tipo)::text = 'sector'::text)
        and (sector_id is not null)
        and (usuario_id is null)
        and (grupo_id is null)
        and (empresa_id is null)
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_prog_dest_prog on public.programacion_destinatarios using btree (programacion_id) TABLESPACE pg_default;

create index IF not exists idx_prog_dest_tipo on public.programacion_destinatarios using btree (tipo) TABLESPACE pg_default;

create index IF not exists idx_prog_dest_user on public.programacion_destinatarios using btree (usuario_id) TABLESPACE pg_default
where
  (usuario_id is not null);

create index IF not exists idx_prog_dest_grupo on public.programacion_destinatarios using btree (grupo_id) TABLESPACE pg_default
where
  (grupo_id is not null);

create index IF not exists idx_prog_dest_empresa on public.programacion_destinatarios using btree (empresa_id) TABLESPACE pg_default
where
  (empresa_id is not null);

create index IF not exists idx_prog_dest_sector on public.programacion_destinatarios using btree (sector_id) TABLESPACE pg_default
where
  (sector_id is not null);

create index IF not exists idx_programacion_destinatarios_usuario on public.programacion_destinatarios using btree (usuario_id, programacion_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_programacion_destinatarios_grupo on public.programacion_destinatarios using btree (grupo_id, programacion_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_programacion_destinatarios_empresa on public.programacion_destinatarios using btree (empresa_id, programacion_id, activo) TABLESPACE pg_default
where
  (activo = true);

  **Tabla "programacion_contenidos"**


create table public.programacion_contenidos (
  id uuid not null default gen_random_uuid (),
  programacion_id uuid not null,
  contenido_id uuid not null,
  orden integer null default 0,
  activo boolean null default true,
  created_at timestamp with time zone null default now(),
  constraint programacion_contenidos_pkey primary key (id),
  constraint programacion_contenidos_programacion_id_contenido_id_key unique (programacion_id, contenido_id),
  constraint programacion_contenidos_contenido_id_fkey foreign KEY (contenido_id) references contenidos (id) on delete CASCADE,
  constraint programacion_contenidos_programacion_id_fkey foreign KEY (programacion_id) references programaciones (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_programacion_contenidos_lookup on public.programacion_contenidos using btree (programacion_id, orden, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_programacion_contenidos_contenido on public.programacion_contenidos using btree (contenido_id, activo) TABLESPACE pg_default
where
  (activo = true);

create index IF not exists idx_prog_contenidos_prog on public.programacion_contenidos using btree (programacion_id) TABLESPACE pg_default;

create index IF not exists idx_prog_contenidos_cont on public.programacion_contenidos using btree (contenido_id) TABLESPACE pg_default;

create index IF not exists idx_prog_contenidos_orden on public.programacion_contenidos using btree (programacion_id, orden) TABLESPACE pg_default;  