**tabla marcas**

create table public.marcas (
  id uuid not null default gen_random_uuid (),
  nombre character varying(255) not null,
  descripcion text null,
  logo_url text null,
  email_contacto character varying(255) null,
  telefono_contacto character varying(50) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  activa boolean null default true,
  constraint marcas_pkey primary key (id),
  constraint marcas_nombre_key unique (nombre)
) TABLESPACE pg_default;

create index IF not exists idx_marcas_nombre on public.marcas using btree (nombre) TABLESPACE pg_default;

create index IF not exists idx_marcas_activa on public.marcas using btree (activa) TABLESPACE pg_default;

create index IF not exists idx_marcas_created on public.marcas using btree (created_at desc) TABLESPACE pg_default;


**tabla marca_grupos**

create table public.marca_grupos (
  id uuid not null default gen_random_uuid (),
  marca_id uuid not null,
  grupo_id uuid not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint marca_grupos_pkey primary key (id),
  constraint marca_grupos_unique unique (grupo_id),
  constraint marca_grupos_grupo_id_fkey foreign KEY (grupo_id) references grupos (id) on delete CASCADE,
  constraint marca_grupos_marca_id_fkey foreign KEY (marca_id) references marcas (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_marca_grupos_marca on public.marca_grupos using btree (marca_id) TABLESPACE pg_default;

create index IF not exists idx_marca_grupos_grupo on public.marca_grupos using btree (grupo_id) TABLESPACE pg_default;



**TABLA marca_empresas**

create table public.marca_empresas (
  id uuid not null default gen_random_uuid (),
  marca_id uuid not null,
  empresa_id uuid not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint marca_empresas_pkey primary key (id),
  constraint marca_empresas_unique unique (empresa_id),
  constraint marca_empresas_empresa_id_fkey foreign KEY (empresa_id) references empresas (id) on delete CASCADE,
  constraint marca_empresas_marca_id_fkey foreign KEY (marca_id) references marcas (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_marca_empresas_marca on public.marca_empresas using btree (marca_id) TABLESPACE pg_default;

create index IF not exists idx_marca_empresas_empresa on public.marca_empresas using btree (empresa_id) TABLESPACE pg_default;


**Tabla marca_contenidos**

create table public.marca_contenidos (
  id uuid not null default gen_random_uuid (),
  marca_id uuid not null,
  contenido_id uuid not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint marca_contenidos_pkey primary key (id),
  constraint marca_contenidos_marca_id_contenido_id_key unique (marca_id, contenido_id),
  constraint marca_contenidos_contenido_id_fkey foreign KEY (contenido_id) references contenidos (id) on delete CASCADE,
  constraint marca_contenidos_marca_id_fkey foreign KEY (marca_id) references marcas (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_marca_contenidos_marca on public.marca_contenidos using btree (marca_id) TABLESPACE pg_default;

create index IF not exists idx_marca_contenidos_contenido on public.marca_contenidos using btree (contenido_id) TABLESPACE pg_default;


**marca_canales**

create table public.marca_canales (
  id uuid not null default gen_random_uuid (),
  marca_id uuid not null,
  canal_id uuid not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint marca_canales_pkey primary key (id),
  constraint marca_canales_marca_id_canal_id_key unique (marca_id, canal_id),
  constraint marca_canales_canal_id_fkey foreign KEY (canal_id) references canales (id) on delete CASCADE,
  constraint marca_canales_marca_id_fkey foreign KEY (marca_id) references marcas (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_marca_canales_marca on public.marca_canales using btree (marca_id) TABLESPACE pg_default;

create index IF not exists idx_marca_canales_canal on public.marca_canales using btree (canal_id) TABLESPACE pg_default;