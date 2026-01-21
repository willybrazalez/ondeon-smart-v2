-- ============================================================================
-- ONDEON SMART - Datos iniciales de música
-- ============================================================================
-- Este script contiene los datos de canales, playlists y canciones
-- Ya ejecutado en Supabase - UUIDs reales generados
-- ============================================================================

-- URL base Supabase Storage: https://vqhaoerphnyahnbemmdd.supabase.co/storage/v1/object/public/portadas-canales/
-- URL base CloudFront música: https://d2ozw1d1zbl64l.cloudfront.net/musica/

-- ============================================================================
-- CANALES CREADOS (UUIDs reales)
-- ============================================================================
-- Pop Classics:    a8f13501-6cf4-4ad9-9e2a-b6395a29fc8e
-- Rock Legends:    dd7d3486-353e-4527-a093-45fc676ab6c0
-- 70s Hits:        c73be5a5-8244-4e60-8a24-7d22c1d8c2d8
-- 80s Vibes:       6910b984-a73c-40b9-86c4-18aea1d8427b
-- Soul & Funk:     d8f92b8b-6543-43ff-ba43-967f981f9c93
-- Acoustic Chill:  c900ed05-0a2a-4a69-aa1d-644f21b7e0cf

-- ============================================================================
-- PLAYLISTS CREADAS (UUIDs reales)
-- ============================================================================
-- Pop Classics Mix:      7070b62a-5213-4073-8d01-61c9ce3110e4
-- Rock Legends Mix:      78e579d0-bdad-4ba6-b18f-eed19ac5f6d3
-- 70s Greatest Hits:     2c32fb0e-3a78-4fe9-a747-c48da84b1d58
-- 80s Greatest Hits:     b7e6d93c-61d3-4f69-90ce-982e6e7637ad
-- Soul & Funk Classics:  5be6de42-eb3c-438c-94bb-48332ffa02ee
-- Acoustic Sessions:     e594b742-f755-4f0c-90ff-205606060c1d

-- ============================================================================
-- CANCIONES CREADAS (19 canciones)
-- ============================================================================
-- Stayin Alive (Bee Gees):               75c4b589-7ca2-4151-ace6-f2ae9e32c351
-- Rock Around The Clock (Bill Haley):    595aacb8-1068-4978-b1e9-97c951074b95
-- Lean on Me (Bill Withers):             fb27dcbb-ad5d-4df3-9253-b5cb50686e4a
-- Its Still Rock And Roll To Me:         ba17d996-1fe4-408a-b453-8ca07a201182
-- Just the Way You Are (Billy Joel):     e1e8704e-7c02-4c40-9bf8-d2e1c9d4e819
-- Call Me (Blondie):                     4f0c6821-8494-4bd9-aa4f-24b7756b4d52
-- Rapture (Blondie):                     fb538d5c-8596-486f-bfb9-eefb30b8bd5a
-- Spinning Wheel (Blood Sweat Tears):    d1183472-57df-4e49-8dd0-35605a8b1d2e
-- California Dreamin:                    68209e6d-8349-4518-91e0-e977acbd19e3
-- Going Up The Country (Canned Heat):    94b91123-7913-4d5a-9f25-e146420d996c
-- Like a Rolling Stone (Bob Dylan):      4c78a1f4-34d7-4750-8f5d-b1f4b23141aa
-- Hurricane (Bob Dylan):                 b1df34e4-90be-42e5-94da-238ebbcf7772
-- Mr Tambourine Man (Bob Dylan):         23419d48-83f5-4dc5-abfc-632a612f881c
-- The Times They Are A-Changin:          ff710187-15d5-4579-bac3-b4e159fa91ed
-- Blowin in the Wind (Bob Dylan):        3b175288-7868-404a-b656-43088e16efe7
-- Knockin on Heavens Door (Bob Dylan):   dbb24e46-c80b-4f7e-9fc6-ed1fad9a816a
-- Cant Help Falling in Love:             4a7bccb4-f324-4f97-8e4c-053ad059b4bb
-- Girl of the North Country:             6fd150eb-6dce-4952-813c-c5f49ce21b17
-- Knockin On Heavens Door v2:            3baa45b6-2e10-4155-8448-61494ab82611

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 'canales' as tabla, count(*) as registros FROM canales WHERE activo = true
UNION ALL
SELECT 'playlists', count(*) FROM playlists WHERE activa = true
UNION ALL
SELECT 'canciones', count(*) FROM canciones WHERE activa = true
UNION ALL
SELECT 'playlist_canciones', count(*) FROM playlist_canciones;

-- ============================================================================
-- PARA RECREAR DESDE CERO (si es necesario)
-- ============================================================================

/*
-- Eliminar datos existentes
DELETE FROM playlist_canciones;
DELETE FROM canciones;
DELETE FROM playlists;
DELETE FROM canales WHERE nombre IN ('Pop Classics', 'Rock Legends', '70s Hits', '80s Vibes', 'Soul & Funk', 'Acoustic Chill');

-- Luego ejecutar los INSERTs con gen_random_uuid()
*/
