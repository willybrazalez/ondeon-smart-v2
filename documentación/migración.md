# 🔄 Migración: `canciones.canal_id` → `canciones.canal_origen`

## 📋 Resumen Ejecutivo

**Fecha de migración:** TBD  
**Proyecto afectado:** Reproductor Ondeón  
**Nivel de impacto:** MEDIO - Requiere actualización de queries  
**Breaking change:** ⚠️ SÍ - La columna `canal_id` será renombrada  

---

## 🎯 ¿Qué cambió?

### Antes (Estado actual)

```sql
create table public.canciones (
  id uuid primary key,
  canal_id uuid null,  -- ← Relación fuerte con canales
  nombre varchar(255),
  artista varchar(255),
  url_s3 text,
  -- ...
  constraint canciones_canal_id_fkey 
    foreign key (canal_id) 
    references canales(id) 
    ON DELETE CASCADE  -- ← Si borras canal, se borran canciones
)
```

**Significado anterior:** Una canción "pertenece" a un canal específico y está limitada a él.

### Después (Nuevo modelo)

```sql
create table public.canciones (
  id uuid primary key,
  canal_origen uuid null,  -- ← Solo indica dónde se subió originalmente
  nombre varchar(255),
  artista varchar(255),
  url_s3 text,
  -- ...
  constraint canciones_canal_origen_fkey 
    foreign key (canal_origen) 
    references canales(id) 
    ON DELETE SET NULL  -- ← Si borras canal, la canción sigue existiendo
)
```

**Nuevo significado:** Una canción puede usarse en playlists de CUALQUIER canal. `canal_origen` solo registra dónde se subió inicialmente (información histórica/auditoría).

---

## 🤔 ¿Por qué este cambio?

### Problema anterior
- Una canción subida al "Canal Gimnasio" NO podía usarse en el "Canal Restaurante"
- Para reutilizar había que duplicar el archivo (subir de nuevo)
- Desperdicio de espacio en S3
- Complicaba la gestión de contenido

### Solución nueva
- **Librería Central:** Todas las canciones están en un catálogo global
- **Reutilización:** Una canción puede estar en playlists de múltiples canales
- **Eficiencia:** Un archivo en S3, múltiples usos
- **Flexibilidad:** Los administradores pueden compartir contenido entre canales

---

## 🔍 ¿Cómo afecta al reproductor?

### 1. **Queries que usan `canal_id` directamente**

#### ❌ ANTES (Ya NO funciona)
```javascript
// audioPlayerService.js - Línea 536
const song = await supabase
  .from('canciones')
  .select('*')
  .eq('canal_id', currentChannelId)  // ← Esta columna ya no existe
  .eq('id', songId)
  .single();
```

#### ✅ DESPUÉS (Nuevo)
```javascript
// Opción 1: Verificar a través de las playlists (RECOMENDADO)
const song = await supabase
  .from('canciones')
  .select(`
    *,
    playlist_canciones!inner(
      playlist:playlists!inner(
        canal_id
      )
    )
  `)
  .eq('id', songId)
  .eq('playlist_canciones.playlists.canal_id', currentChannelId)
  .single();

// Opción 2: Si solo necesitas verificar el origen (menos estricto)
const song = await supabase
  .from('canciones')
  .select('*')
  .eq('canal_origen', currentChannelId)  // ← Nueva columna
  .eq('id', songId)
  .single();

// Opción 3: Si solo necesitas la canción (sin verificar canal)
const song = await supabase
  .from('canciones')
  .select('*')
  .eq('id', songId)
  .single();
```

### 2. **Verificaciones de canal en reproducción**

#### ❌ ANTES
```javascript
// autoDjService.js - Línea 2139
if (song.canal_id !== currentChannelId) {
  console.error('❌ Canción de canal incorrecto');
  // Limpiar y recargar
}
```

#### ✅ DESPUÉS
```javascript
// La verificación debe hacerse contra la playlist, no contra la canción
const playlistQuery = await supabase
  .from('playlist_canciones')
  .select('playlist:playlists(canal_id)')
  .eq('cancion_id', song.id)
  .eq('playlist_id', currentPlaylistId)
  .single();

if (playlistQuery.data.playlist.canal_id !== currentChannelId) {
  console.error('❌ Canción en playlist de canal incorrecto');
  // Limpiar y recargar
}

// O MEJOR: Confiar en que si viene de tu playlist actual, es correcta
// Ya no necesitas verificar el canal de la canción, porque puede estar en múltiples
```

### 3. **Filtrado de canciones por canal**

#### ❌ ANTES
```javascript
// autoDjService.js - Línea 2550
const channelSongs = await supabase
  .from('canciones')
  .select('*')
  .eq('canal_id', currentChannelId);  // ← Ya no existe
```

#### ✅ DESPUÉS
```javascript
// Obtener canciones a través de las playlists del canal
const channelSongs = await supabase
  .from('canciones')
  .select(`
    *,
    playlist_canciones!inner(
      playlist:playlists!inner(
        canal_id
      )
    )
  `)
  .eq('playlist_canciones.playlists.canal_id', currentChannelId);
```

---

## 📊 Tabla de Equivalencias

| Caso de uso | Query ANTES | Query DESPUÉS |
|------------|-------------|---------------|
| **Obtener canción por ID** | `select('*').eq('canal_id', channelId).eq('id', songId)` | `select('*').eq('id', songId)` |
| **Verificar canal de canción** | `if (song.canal_id === channelId)` | Verificar contra `playlist.canal_id` |
| **Listar canciones del canal** | `select('*').eq('canal_id', channelId)` | JOIN con `playlist_canciones` → `playlists` |
| **Log de canal de canción** | `console.log(song.canal_id)` | `console.log(song.canal_origen)` (solo informativo) |
| **Filtrar canciones incorrectas** | `songs.filter(s => s.canal_id === channelId)` | Filtrar por `playlistId` y confiar en la playlist |

---

## 🔧 Script de Migración de Base de Datos

```sql
-- ========================================
-- MIGRACIÓN: canal_id → canal_origen
-- ========================================

BEGIN;

-- 1. Eliminar constraint actual
ALTER TABLE canciones 
DROP CONSTRAINT IF EXISTS canciones_canal_id_fkey;

-- 2. Renombrar columna
ALTER TABLE canciones 
RENAME COLUMN canal_id TO canal_origen;

-- 3. Hacer nullable (para canciones subidas desde Librerías)
ALTER TABLE canciones 
ALTER COLUMN canal_origen DROP NOT NULL;

-- 4. Nueva constraint sin CASCADE
ALTER TABLE canciones
ADD CONSTRAINT canciones_canal_origen_fkey 
FOREIGN KEY (canal_origen) 
REFERENCES canales(id) 
ON DELETE SET NULL;

-- 5. Actualizar índices
DROP INDEX IF EXISTS idx_canciones_canal_id;
DROP INDEX IF EXISTS idx_canciones_canal;
CREATE INDEX idx_canciones_canal_origen ON canciones(canal_origen);

-- 6. Índice para queries del reproductor (optimización)
CREATE INDEX idx_playlist_canciones_lookup 
ON playlist_canciones(cancion_id, playlist_id);

COMMIT;

-- Verificar migración
SELECT 
  COUNT(*) as total_canciones,
  COUNT(canal_origen) as con_origen,
  COUNT(*) - COUNT(canal_origen) as sin_origen
FROM canciones;
```

---

## 📝 Checklist de Actualización del Reproductor

### Archivos a revisar:

#### **`src/services/audioPlayerService.js`** (2 referencias)

- [ ] **Línea 536:** Verificación de canal en `nextSong()`
  ```javascript
  // Cambiar: song.canal_id === currentChannelId
  // Por: Verificar contra playlist o eliminar verificación
  ```

- [ ] **Línea 1600:** Verificación en `forceCleanIncorrectPreloadedSong()`
  ```javascript
  // Cambiar: song.canal_id
  // Por: song.canal_origen (solo para logs) o eliminar verificación
  ```

#### **`src/services/autoDjService.js`** (11 referencias)

- [ ] **Línea 1790:** Mapeo de canales de canciones
  ```javascript
  // Cambiar: songChannelId = song.canal_id
  // Por: songChannelId = song.canal_origen (o obtener de playlist)
  ```

- [ ] **Línea 1841, 2143, 2155, 2210, 2220:** Logs de `songChannelId`
  ```javascript
  // Actualizar a: song.canal_origen
  // Considerar agregar: playlist.canal_id para contexto
  ```

- [ ] **Línea 2139:** Verificación de coincidencia de canal
  ```javascript
  // CRÍTICO: Replantear lógica de verificación
  // Ya NO verificar song.canal_id, sino playlist.canal_id
  ```

- [ ] **Línea 2550:** Filtrado por `songChannelId`
  ```javascript
  // Cambiar query para filtrar por playlist, no por canción
  ```

- [ ] **Línea 1849, 2163, 2228:** Mensajes de limpieza de emergencia
  ```javascript
  // Actualizar mensajes de error para reflejar nuevo modelo
  ```

---

## 🎯 Estrategia de Migración

### Fase 1: Preparación (ANTES de migrar BD)
1. ✅ Revisar y documentar todas las queries que usan `canal_id`
2. ✅ Preparar nuevas queries con el modelo actualizado
3. ✅ Crear tests para verificar comportamiento

### Fase 2: Migración de Base de Datos
1. ⏳ Backup completo de la tabla `canciones`
2. ⏳ Ejecutar script de migración en ambiente de pruebas
3. ⏳ Verificar integridad de datos
4. ⏳ Ejecutar en producción (ventana de mantenimiento)

### Fase 3: Actualización del Reproductor
1. ⏳ Actualizar código según checklist
2. ⏳ Probar en desarrollo con BD migrada
3. ⏳ Deploy del reproductor actualizado
4. ⏳ Monitoreo intensivo post-deploy

---

## 🚨 Cambios de Comportamiento Importantes

### 1. **Canción puede estar en múltiples canales**

**ANTES:**
- Una canción → Un canal
- Si la canción está en el reproductor, es porque pertenece a ese canal

**AHORA:**
- Una canción → Múltiples canales (a través de playlists)
- Si la canción está en el reproductor, es porque está en UNA PLAYLIST de ese canal

### 2. **Verificación de "canción correcta"**

**ANTES:**
```javascript
// Verificar que la canción pertenezca al canal
if (song.canal_id !== currentChannelId) {
  // Eliminar, es una contaminación
}
```

**AHORA:**
```javascript
// Verificar que la canción esté en la playlist correcta
const isInCurrentPlaylist = await checkSongInPlaylist(
  song.id, 
  currentPlaylistId
);

if (!isInCurrentPlaylist) {
  // Eliminar, no debería estar aquí
}

// O MEJOR: Confiar en tu sistema de selección de canciones
// Si seleccionaste de una playlist del canal, siempre será correcta
```

### 3. **Logs y debugging**

**ANTES:**
```javascript
console.log('Canal de canción:', song.canal_id);
console.log('Canal actual:', currentChannelId);
```

**AHORA:**
```javascript
console.log('Canal origen:', song.canal_origen);  // Solo histórico
console.log('Playlist actual:', currentPlaylist.nombre);
console.log('Canal actual:', currentPlaylist.canal_id);  // Lo importante
```

---

## 💡 Recomendaciones Arquitectónicas

### 1. **Simplificar verificaciones**

En lugar de verificar constantemente si una canción pertenece a un canal:

```javascript
// ❌ Verificación constante (viejo modelo)
function verifySongBelongsToChannel(song, channelId) {
  return song.canal_id === channelId;
}

// ✅ Confiar en el sistema de playlists (nuevo modelo)
function selectNextSong(playlistId) {
  // Si seleccionas de esta playlist, ya es correcta por definición
  return getRandomSongFromPlaylist(playlistId);
}
```

### 2. **Queries optimizadas**

Aprovechar las relaciones existentes:

```javascript
// Query optimizada para obtener canciones del canal actual
const { data: songs } = await supabase
  .from('playlists')
  .select(`
    id,
    nombre,
    playlist_canciones (
      posicion,
      peso,
      cancion:canciones (
        id,
        nombre,
        artista,
        url_s3,
        duracion,
        bpm,
        canal_origen
      )
    )
  `)
  .eq('canal_id', currentChannelId)
  .eq('activa', true);

// Aplanar las canciones
const allSongs = songs.flatMap(playlist => 
  playlist.playlist_canciones.map(pc => pc.cancion)
);
```

### 3. **Caché y estado local**

```javascript
// Mantener contexto de playlist en el estado
const playerState = {
  currentSong: song,
  currentPlaylist: {
    id: 'playlist-id',
    nombre: 'Playlist Mañana',
    canal_id: 'canal-id',  // ← Verificar contra esto
    canal_nombre: 'Canal Gimnasio'
  }
};

// Verificar usando el contexto
if (playerState.currentPlaylist.canal_id !== currentChannelId) {
  // Cambio de canal detectado
  reloadPlaylist();
}
```

---

## 🧪 Tests de Validación

```javascript
// Tests para verificar que la migración funcionó

describe('Migración canal_id → canal_origen', () => {
  
  test('Canción puede estar en múltiples playlists de diferentes canales', async () => {
    const cancion = await getCancion('song-001');
    const playlists = await getPlaylistsUsingSong('song-001');
    
    const uniqueChannels = new Set(playlists.map(p => p.canal_id));
    expect(uniqueChannels.size).toBeGreaterThan(1);
  });
  
  test('Reproductor obtiene canciones del canal correcto', async () => {
    const songs = await getSongsForChannel('canal-123');
    
    for (const song of songs) {
      const playlists = await getPlaylistsForSong(song.id);
      const belongsToChannel = playlists.some(p => p.canal_id === 'canal-123');
      expect(belongsToChannel).toBe(true);
    }
  });
  
  test('Eliminar canal no borra canciones', async () => {
    const songId = 'song-test';
    const canalId = 'canal-test';
    
    await createCancion({ id: songId, canal_origen: canalId });
    const before = await getCancion(songId);
    expect(before).toBeTruthy();
    
    await deleteCanal(canalId);
    const after = await getCancion(songId);
    expect(after).toBeTruthy();
    expect(after.canal_origen).toBeNull();
  });
  
});
```

---

## 📞 Soporte y Contacto

**Preguntas sobre la migración:**
- Documento de referencia: `/frontend-admin/MIGRACION-CANAL-ORIGEN.md`
- Esquema de tablas: `/frontend-admin/tablas.md`

**Problemas durante la migración:**
1. Revisar logs del reproductor
2. Verificar queries en la consola de Supabase
3. Consultar sección "Troubleshooting" abajo

---

## 🔧 Troubleshooting

### Error: "column canciones.canal_id does not exist"

**Causa:** El código del reproductor aún usa `canal_id` pero la BD ya fue migrada.

**Solución:**
```javascript
// Buscar en el código:
grep -r "canal_id" src/services/

// Reemplazar según las guías de este documento
```

### Error: "Canción no pertenece al canal"

**Causa:** Lógica de verificación obsoleta.

**Solución:**
```javascript
// Eliminar verificaciones de song.canal_id
// Verificar contra playlist.canal_id en su lugar
```

### Rendimiento: Queries lentas después de migración

**Causa:** Falta índice en `playlist_canciones`.

**Solución:**
```sql
CREATE INDEX IF NOT EXISTS idx_playlist_canciones_lookup 
ON playlist_canciones(cancion_id, playlist_id);

CREATE INDEX IF NOT EXISTS idx_playlist_canal_activa
ON playlists(canal_id, activa)
WHERE activa = true;
```

---

## 📈 Monitoreo Post-Migración

### Métricas a vigilar:

1. **Errores de reproducción:**
   - ❌ "Canción no encontrada"
   - ❌ "Canal incorrecto"
   - ❌ "Playlist vacía"

2. **Performance:**
   - Tiempo de carga de playlist
   - Tiempo de selección de siguiente canción
   - Queries lentas (> 1s)

3. **Logs a buscar:**
   ```bash
   # Errores relacionados con canal_id
   grep -i "canal_id" /var/log/reproductor/*.log
   
   # Canciones incorrectas
   grep -i "canción de canal incorrecto" /var/log/reproductor/*.log
   
   # Queries fallidas
   grep -i "column.*does not exist" /var/log/reproductor/*.log
   ```

---

## ✅ Checklist Final Pre-Deploy

- [ ] Backup de BD completado
- [ ] Script de migración testeado en desarrollo
- [ ] Código del reproductor actualizado según checklist
- [ ] Tests pasando (mínimo 95% cobertura en autoDjService)
- [ ] Índices creados en BD de producción
- [ ] Ventana de mantenimiento programada
- [ ] Rollback plan documentado
- [ ] Equipo de soporte notificado
- [ ] Monitoreo configurado

---

## 🔄 Rollback Plan

Si algo sale mal:

```sql
-- Revertir migración (solo si NO hubo cambios en datos)
BEGIN;

ALTER TABLE canciones 
DROP CONSTRAINT IF EXISTS canciones_canal_origen_fkey;

ALTER TABLE canciones 
RENAME COLUMN canal_origen TO canal_id;

ALTER TABLE canciones
ADD CONSTRAINT canciones_canal_id_fkey 
FOREIGN KEY (canal_id) 
REFERENCES canales(id) 
ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_canciones_canal_origen;
CREATE INDEX idx_canciones_canal_id ON canciones(canal_id);

COMMIT;
```

**Revertir código:** Checkout al commit anterior al cambio.

---

**Última actualización:** 2025-10-29  
**Versión:** 1.0  
**Estado:** ⚠️ PENDIENTE DE APLICAR

