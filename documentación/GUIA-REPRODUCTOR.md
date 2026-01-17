# 📻 Guía de Programaciones para el Reproductor

## 🎯 Objetivo

El reproductor debe revisar si el usuario logueado tiene programaciones activas y ejecutarlas según su periodicidad, **interrumpiendo la reproducción musical ** cuando corresponda.

---

## 📊 Estructura de Base de Datos

### Tablas principales

#### 1. `programaciones`
Almacena la configuración de cada programación.

```sql
SELECT * FROM programaciones 
WHERE estado = 'activo';
```

**Campos clave:**
- `id`: UUID de la programación
- `descripcion`: Nombre descriptivo
- `estado`: 'activo' | 'pausado' | 'completado' | 'cancelado'
- `tipo`: 'una_vez' | 'diaria' | 'semanal' | 'anual'
- `fecha_inicio`: DATE (YYYY-MM-DD) - Inicio de validez
- `fecha_fin`: DATE | null - Fin de validez (null = sin límite)
- `frecuencia_minutos`: INT - Cada cuántos minutos se repite (dentro del rango)

**Campos de periodicidad diaria:**
- `daily_mode`: 'cada' | 'laborales' | 'una_vez_dia'
- `cada_dias`: INT - Cada N días (si daily_mode='cada')
- `rango_desde`: TIME - Hora inicio del rango (ej: '08:00')
- `rango_hasta`: TIME - Hora fin del rango (ej: '20:00')
- `hora_una_vez_dia`: TIME - Hora exacta (si daily_mode='una_vez_dia')

**Campos de periodicidad semanal:**
- `weekly_mode`: 'rango' | 'una_vez_dia'
- `weekly_days`: TEXT[] - Días de la semana ['mon','tue','wed','thu','fri','sat','sun']
- `weekly_rango_desde`: TIME
- `weekly_rango_hasta`: TIME
- `weekly_hora_una_vez`: TIME

**Campos de periodicidad anual:**
- `annual_date`: VARCHAR(5) - Día del año 'MM-DD' (ej: '12-25')
- `annual_time`: TIME - Hora exacta

**🔊 Campos de modo de audio (CRÍTICO):**
- `modo_audio`: 'fade_out' | 'background'
  - **'fade_out'**: Hacer fade out de música → reproducir contenido en silencio → fade in de música
  - **'background'**: Bajar volumen de música a un % predefinido en el reproductor y reproducir contenido encima

**NOTA IMPORTANTE:** No existe modo "normal" porque la música **nunca** se corta de golpe. El volumen en modo "background" está predefinido en el reproductor (recomendado: 20-25%).

---

#### 2. `programacion_destinatarios`
Define qué usuarios tienen asignada cada programación.

```sql
SELECT programacion_id 
FROM programacion_destinatarios
WHERE usuario_id = 'UUID_USUARIO_LOGUEADO'
  AND activo = true;
```

**Campos clave:**
- `programacion_id`: UUID de la programación
- `tipo`: Siempre 'usuario' (ya expandido desde empresas/grupos/sectores)
- `usuario_id`: UUID del usuario destinatario
- `activo`: BOOLEAN - Permite desactivar sin eliminar

---

#### 3. `programacion_contenidos`
Define qué contenidos reproducir en cada programación.

```sql
SELECT c.* 
FROM programacion_contenidos pc
JOIN contenidos c ON c.id = pc.contenido_id
WHERE pc.programacion_id = 'UUID_PROGRAMACION'
  AND pc.activo = true
ORDER BY pc.orden ASC;
```

**Campos clave:**
- `contenido_id`: UUID del contenido a reproducir
- `orden`: INT - Orden de reproducción
- `activo`: BOOLEAN

---

#### 4. `programacion_logs` (Opcional)
Para que el reproductor registre cada reproducción.

```sql
INSERT INTO programacion_logs (
  programacion_id,
  usuario_id,
  contenido_id,
  reproducido_en,
  completado,
  metadata
) VALUES (
  'uuid-prog',
  'uuid-usuario',
  'uuid-contenido',
  NOW(),
  true,
  '{"duracion_segundos": 180}'::jsonb
);
```

---

## 🔄 Lógica de Ejecución en el Reproductor

### Paso 1: Al iniciar sesión
```typescript
// Cargar todas las programaciones activas del usuario
const cargarProgramacionesUsuario = async (usuarioId: string) => {
  const { data: programacionesIds } = await supabase
    .from('programacion_destinatarios')
    .select('programacion_id')
    .eq('usuario_id', usuarioId)
    .eq('activo', true);

  if (!programacionesIds?.length) return [];

  const ids = programacionesIds.map(p => p.programacion_id);

  const { data: programaciones } = await supabase
    .from('programaciones')
    .select('*')
    .in('id', ids)
    .eq('estado', 'activo')
    .lte('fecha_inicio', new Date().toISOString().split('T')[0]) // Ya empezó
    .or(`fecha_fin.is.null,fecha_fin.gte.${new Date().toISOString().split('T')[0]}`); // No terminó

  return programaciones || [];
};
```

---

### Paso 2: Evaluar si debe ejecutarse AHORA

```typescript
const debeEjecutarse = (prog: Programacion): boolean => {
  const ahora = new Date();
  const horaActual = ahora.toTimeString().slice(0, 5); // "HH:mm"
  const diaSemana = ['sun','mon','tue','wed','thu','fri','sat'][ahora.getDay()];
  const fechaActual = ahora.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const mesdia = fechaActual.slice(5); // "MM-DD"

  // Verificar rango de fechas
  if (prog.fecha_inicio && fechaActual < prog.fecha_inicio) return false;
  if (prog.fecha_fin && fechaActual > prog.fecha_fin) return false;

  switch (prog.tipo) {
    case 'una_vez':
      // Solo si es exactamente hoy
      return fechaActual === prog.fecha_inicio;

    case 'diaria':
      if (prog.daily_mode === 'una_vez_dia') {
        // Ejecutar solo a esa hora exacta (con margen de ±5 min)
        return Math.abs(tiempoMinutos(horaActual) - tiempoMinutos(prog.hora_una_vez_dia!)) <= 5;
      }
      if (prog.daily_mode === 'cada') {
        // Cada N días
        const diasDesdeInicio = Math.floor(
          (ahora.getTime() - new Date(prog.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diasDesdeInicio % prog.cada_dias! !== 0) return false;
      }
      if (prog.daily_mode === 'laborales') {
        // Solo lunes a viernes
        if (['sat','sun'].includes(diaSemana)) return false;
      }
      // Verificar rango horario
      return horaActual >= prog.rango_desde! && horaActual <= prog.rango_hasta!;

    case 'semanal':
      // Verificar si hoy es uno de los días seleccionados
      if (!prog.weekly_days?.includes(diaSemana)) return false;
      
      if (prog.weekly_mode === 'una_vez_dia') {
        return Math.abs(tiempoMinutos(horaActual) - tiempoMinutos(prog.weekly_hora_una_vez!)) <= 5;
      }
      return horaActual >= prog.weekly_rango_desde! && horaActual <= prog.weekly_rango_hasta!;

    case 'anual':
      // Solo si es ese día del año
      if (mesdia !== prog.annual_date) return false;
      return Math.abs(tiempoMinutos(horaActual) - tiempoMinutos(prog.annual_time!)) <= 5;

    default:
      return false;
  }
};

// Helper
const tiempoMinutos = (tiempo: string): number => {
  const [h, m] = tiempo.split(':').map(Number);
  return h * 60 + m;
};
```

---

### Paso 3: Determinar cuándo debe sonar (frecuencia)

```typescript
const debeSonarAhora = (prog: Programacion, ultimaReproduccion: Date | null): boolean => {
  if (!debeEjecutarse(prog)) return false;

  // Si nunca se reprodujo, ejecutar ahora
  if (!ultimaReproduccion) return true;

  // Calcular minutos desde última reproducción
  const minutosDesdeUltima = Math.floor(
    (Date.now() - ultimaReproduccion.getTime()) / (1000 * 60)
  );

  // Ejecutar si ya pasaron los minutos de frecuencia
  return minutosDesdeUltima >= prog.frecuencia_minutos;
};
```

---

### Paso 4: Obtener contenidos y reproducir (CON MANEJO DE AUDIO)

**⚠️ CRÍTICO:** Esta es la parte más importante. El reproductor debe manejar 3 modos diferentes de audio.

```typescript
const reproducirProgramacion = async (programacionId: string, programacion: Programacion) => {
  const { data: contenidos } = await supabase
    .from('programacion_contenidos')
    .select('contenido_id, orden')
    .eq('programacion_id', programacionId)
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (!contenidos?.length) return;

  // Cargar datos completos de los contenidos
  const ids = contenidos.map(c => c.contenido_id);
  const { data: piezas } = await supabase
    .from('contenidos')
    .select('*')
    .in('id', ids);

  if (!piezas?.length) return;

  // 🔊 PASO 1: Preparar audio según el modo
  await prepararAudioSegunModo(programacion);

  // 🎵 PASO 2: Reproducir cada contenido en orden
  for (const pieza of piezas) {
    await reproducirContenido(pieza);
    
    // (Opcional) Registrar en logs
    await supabase.from('programacion_logs').insert({
      programacion_id: programacionId,
      usuario_id: getCurrentUserId(),
      contenido_id: pieza.id,
      reproducido_en: new Date().toISOString(),
      completado: true
    });
  }

  // 🔊 PASO 3: Restaurar audio según el modo
  await restaurarAudioSegunModo(programacion);
};

// ============================================================================
// 🔊 FUNCIONES DE MANEJO DE AUDIO (IMPLEMENTAR ESTAS)
// ============================================================================

/**
 * Prepara el audio del reproductor según el modo de la programación
 */
const prepararAudioSegunModo = async (programacion: Programacion) => {
  const musicPlayer = getMusicPlayer(); // Tu instancia del reproductor de música
  
  switch (programacion.modo_audio) {
    case 'fade_out':
      // Modo 1: Fade out suave de la música
      console.log('🎵 Haciendo fade out de música...');
      await fadeOutMusic(musicPlayer, 2000); // 2 segundos de fade out
      break;

    case 'background':
      // Modo 2: Bajar volumen al porcentaje predefinido
      const VOLUMEN_PREDEFINIDO = 20; // 👈 Configura aquí el volumen deseado (15-25% recomendado)
      console.log(`🎶 Bajando música al ${VOLUMEN_PREDEFINIDO}%...`);
      await transicionarVolumen(musicPlayer, VOLUMEN_PREDEFINIDO, 1000); // 1 segundo de transición
      break;
  }
};

/**
 * Restaura el audio del reproductor después de la programación
 */
const restaurarAudioSegunModo = async (programacion: Programacion) => {
  const musicPlayer = getMusicPlayer();
  
  switch (programacion.modo_audio) {
    case 'fade_out':
      // Modo 1: Fade in de la música
      console.log('🎵 Haciendo fade in de música...');
      await fadeInMusic(musicPlayer, 2000); // 2 segundos de fade in
      break;

    case 'background':
      // Modo 2: Restaurar volumen original
      console.log('🎶 Restaurando volumen original...');
      await transicionarVolumen(musicPlayer, 100, 1000); // Volver al 100%
      break;
  }
};

// ============================================================================
// 🎚️ UTILIDADES DE AUDIO (IMPLEMENTAR SEGÚN TU REPRODUCTOR)
// ============================================================================

/**
 * Hace fade out del volumen de música
 */
const fadeOutMusic = async (player: any, duracionMs: number): Promise<void> => {
  const volumenInicial = player.volume; // Volumen actual (0-100)
  const pasos = 20; // Número de pasos de la transición
  const intervalo = duracionMs / pasos;
  const decrementoPorPaso = volumenInicial / pasos;

  return new Promise((resolve) => {
    let pasoActual = 0;
    const intervaloId = setInterval(() => {
      pasoActual++;
      const nuevoVolumen = volumenInicial - (decrementoPorPaso * pasoActual);
      player.volume = Math.max(0, nuevoVolumen);

      if (pasoActual >= pasos) {
        clearInterval(intervaloId);
        player.pause(); // Pausar cuando llegue a 0
        resolve();
      }
    }, intervalo);
  });
};

/**
 * Hace fade in del volumen de música
 */
const fadeInMusic = async (player: any, duracionMs: number): Promise<void> => {
  const volumenObjetivo = 100; // Volumen objetivo
  const pasos = 20;
  const intervalo = duracionMs / pasos;
  const incrementoPorPaso = volumenObjetivo / pasos;

  player.volume = 0;
  await player.play(); // Reanudar desde 0

  return new Promise((resolve) => {
    let pasoActual = 0;
    const intervaloId = setInterval(() => {
      pasoActual++;
      const nuevoVolumen = incrementoPorPaso * pasoActual;
      player.volume = Math.min(volumenObjetivo, nuevoVolumen);

      if (pasoActual >= pasos) {
        clearInterval(intervaloId);
        resolve();
      }
    }, intervalo);
  });
};

/**
 * Transiciona el volumen suavemente a un objetivo
 */
const transicionarVolumen = async (
  player: any, 
  volumenObjetivo: number, 
  duracionMs: number
): Promise<void> => {
  const volumenInicial = player.volume;
  const diferencia = volumenObjetivo - volumenInicial;
  const pasos = 20;
  const intervalo = duracionMs / pasos;
  const incrementoPorPaso = diferencia / pasos;

  return new Promise((resolve) => {
    let pasoActual = 0;
    const intervaloId = setInterval(() => {
      pasoActual++;
      const nuevoVolumen = volumenInicial + (incrementoPorPaso * pasoActual);
      player.volume = nuevoVolumen;

      if (pasoActual >= pasos) {
        clearInterval(intervaloId);
        resolve();
      }
    }, intervalo);
  });
};

/**
 * Reproduce un contenido programado
 */
const reproducirContenido = async (contenido: any): Promise<void> => {
  const audioPlayer = getContentPlayer(); // Reproductor para contenido programado (separado de la música)
  
  return new Promise((resolve) => {
    audioPlayer.src = contenido.url_archivo;
    audioPlayer.onended = () => resolve();
    audioPlayer.onerror = () => resolve(); // Continuar aunque haya error
    audioPlayer.play();
  });
};
```

---

## 🎛️ Ejemplo de Uso Completo

```typescript
// En el loop principal del reproductor
const ejecutarProgramacionesActivas = async () => {
  const programaciones = await cargarProgramacionesUsuario(usuarioId);
  
  for (const prog of programaciones) {
    if (debeSonarAhora(prog, ultimaEjecucion[prog.id])) {
      // Ejecutar programación con manejo de audio
      await reproducirProgramacion(prog.id, prog);
      
      // Guardar timestamp de última ejecución
      ultimaEjecucion[prog.id] = new Date();
      
      // Solo ejecutar una programación a la vez
      break;
    }
  }
};

// Ejecutar cada minuto
setInterval(ejecutarProgramacionesActivas, 60000);
```

---

## ⚠️ Problema: Solapación de Programaciones

### Escenario problemático

**Usuario tiene 2 programaciones activas:**
1. **Programación A**: Diaria 08:00-20:00, cada 15 min
2. **Programación B**: Diaria 10:00-12:00, cada 30 min

**A las 10:15:** Ambas deberían ejecutarse. ¿Cuál tiene prioridad?

---

### Soluciones propuestas

#### **Opción 1: Prioridad explícita** (RECOMENDADA)

Añadir campo `prioridad` en `programaciones`:

```sql
ALTER TABLE programaciones 
ADD COLUMN prioridad INT DEFAULT 0;

-- Mayor número = mayor prioridad
-- Si hay solapación, ejecutar la de mayor prioridad primero
```

**Lógica en reproductor:**
```typescript
const programacionesActivas = programaciones
  .filter(p => debeSonarAhora(p))
  .sort((a, b) => b.prioridad - a.prioridad); // Mayor primero

// Ejecutar solo la primera (mayor prioridad)
if (programacionesActivas.length > 0) {
  await reproducirProgramacion(programacionesActivas[0].id);
}
```

---

#### **Opción 2: Primera en crearse gana**

```typescript
const programacionesActivas = programaciones
  .filter(p => debeSonarAhora(p))
  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

// Ejecutar solo la primera
if (programacionesActivas.length > 0) {
  await reproducirProgramacion(programacionesActivas[0].id);
}
```

---

#### **Opción 3: Cola de reproducción**

Reproducir todas en secuencia:

```typescript
for (const prog of programacionesActivas) {
  await reproducirProgramacion(prog.id);
}
```

**⚠️ Problema:** Si hay muchas programaciones solapadas, el usuario podría estar escuchando programaciones durante mucho tiempo sin volver al canal normal.

---

#### **Opción 4: Bloqueo temporal**

Después de ejecutar una programación, bloquear otras por N minutos:

```typescript
let ultimaProgramacionEjecutada: Date | null = null;
const BLOQUEO_MINUTOS = 15;

if (ultimaProgramacionEjecutada && 
    (Date.now() - ultimaProgramacionEjecutada.getTime()) < BLOQUEO_MINUTOS * 60 * 1000) {
  // No ejecutar ninguna programación
  return;
}

// Ejecutar la de mayor prioridad
if (programacionesActivas.length > 0) {
  await reproducirProgramacion(programacionesActivas[0].id);
  ultimaProgramacionEjecutada = new Date();
}
```

---

## 🎯 Recomendación Final

**Implementar Opción 1 + Opción 4:**

1. **Añadir campo `prioridad`** a la tabla `programaciones`
2. **En caso de solapación:** Ejecutar solo la de mayor prioridad
3. **Bloqueo temporal:** Después de ejecutar una programación, esperar al menos `frecuencia_minutos` antes de ejecutar otra

**Ventajas:**
- Control total sobre qué se ejecuta primero
- Evita spam de programaciones
- Respeta la frecuencia configurada
- Permite a los admins definir qué es más importante

---

## 📝 Vista Simplificada para el Reproductor

```sql
-- Vista que el reproductor puede usar directamente
CREATE OR REPLACE VIEW vista_programaciones_usuario AS
SELECT 
  p.*,
  pd.usuario_id,
  ARRAY_AGG(pc.contenido_id ORDER BY pc.orden) AS contenidos_ordenados
FROM programaciones p
JOIN programacion_destinatarios pd ON pd.programacion_id = p.id AND pd.activo = true
JOIN programacion_contenidos pc ON pc.programacion_id = p.id AND pc.activo = true
WHERE p.estado = 'activo'
GROUP BY p.id, pd.usuario_id;

-- Uso en el reproductor:
-- SELECT * FROM vista_programaciones_usuario WHERE usuario_id = 'uuid-del-usuario';
```

---

## 🔔 Suscripción Realtime (RECOMENDADO)

Para que el reproductor se entere **en tiempo real** de cambios en las programaciones sin necesidad de refrescar.

### ¿Qué tablas escuchar?

El script `install-programaciones-complete.sql` ya activó Realtime en estas 3 tablas:
- ✅ `programaciones` - Cambios en la configuración
- ✅ `programacion_contenidos` - Cambios en los contenidos asignados
- ✅ `programacion_destinatarios` - Cambios en los destinatarios

### Implementación completa

```typescript
// Estado global para almacenar programaciones
let programacionesActivas: Programacion[] = [];

/**
 * Suscribirse a cambios en programaciones del usuario
 */
const suscribirseAProgramaciones = (usuarioId: string) => {
  // Canal único por usuario
  const channel = supabase.channel(`programaciones-${usuarioId}`);

  // 1. Escuchar cambios en programacion_destinatarios
  //    (cuando se asigna/desasigna una programación al usuario)
  channel.on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'programacion_destinatarios',
      filter: `usuario_id=eq.${usuarioId}`
    },
    (payload) => {
      console.log('🔔 Cambio en destinatarios:', payload);
      // Recargar programaciones completas
      recargarProgramaciones(usuarioId);
    }
  );

  // 2. Escuchar cambios en programaciones
  //    (cuando se modifica la config de una programación que ya tiene)
  channel.on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'programaciones'
    },
    (payload) => {
      console.log('🔔 Cambio en programación:', payload);
      // Verificar si este cambio afecta al usuario
      const programacionId = payload.new?.id || payload.old?.id;
      if (tieneProgramacion(programacionId)) {
        recargarProgramaciones(usuarioId);
      }
    }
  );

  // 3. Escuchar cambios en programacion_contenidos
  //    (cuando se añaden/quitan contenidos a una programación)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'programacion_contenidos'
    },
    (payload) => {
      console.log('🔔 Cambio en contenidos:', payload);
      const programacionId = payload.new?.programacion_id || payload.old?.programacion_id;
      if (tieneProgramacion(programacionId)) {
        recargarProgramaciones(usuarioId);
      }
    }
  );

  // Suscribirse al canal
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Suscrito a cambios de programaciones en tiempo real');
    }
  });

  return channel;
};

/**
 * Recargar programaciones del usuario
 */
const recargarProgramaciones = async (usuarioId: string) => {
  console.log('🔄 Recargando programaciones...');
  programacionesActivas = await cargarProgramacionesUsuario(usuarioId);
  console.log(`✅ ${programacionesActivas.length} programaciones cargadas`);
};

/**
 * Verificar si el usuario tiene esta programación
 */
const tieneProgramacion = (programacionId: string): boolean => {
  return programacionesActivas.some(p => p.id === programacionId);
};

// Uso al iniciar sesión:
const usuarioId = getCurrentUserId();
await recargarProgramaciones(usuarioId);
const channel = suscribirseAProgramaciones(usuarioId);

// Al cerrar sesión:
// channel.unsubscribe();
```

### Casos de uso cubiertos

| Acción en Admin | Tabla afectada | ¿Se detecta? |
|----------------|----------------|--------------|
| Admin crea nueva programación y la asigna al usuario | `programacion_destinatarios` | ✅ Sí |
| Admin cambia la descripción de una programación | `programaciones` | ✅ Sí |
| Admin cambia la hora de una programación | `programaciones` | ✅ Sí |
| Admin pausa/activa una programación | `programaciones` | ✅ Sí |
| Admin añade más contenidos a una programación | `programacion_contenidos` | ✅ Sí |
| Admin elimina contenidos de una programación | `programacion_contenidos` | ✅ Sí |
| Admin desasigna la programación al usuario | `programacion_destinatarios` | ✅ Sí |
| Admin elimina la programación | `programaciones` | ✅ Sí (DELETE event) |

### Optimización: Evitar recargas innecesarias

```typescript
// Usar debounce para evitar recargar múltiples veces en poco tiempo
let recargarTimeout: NodeJS.Timeout | null = null;

const recargarProgramacionesDebounced = (usuarioId: string) => {
  if (recargarTimeout) clearTimeout(recargarTimeout);
  
  recargarTimeout = setTimeout(() => {
    recargarProgramaciones(usuarioId);
  }, 1000); // Esperar 1 segundo antes de recargar
};
```

### ⚠️ Consideraciones importantes

1. **Performance:** El Realtime consume recursos. Solo suscríbete cuando el usuario esté activo.
2. **Desuscribirse:** Al cerrar sesión o cambiar de usuario, desuscríbete del canal anterior.
3. **Reconexión:** Supabase maneja automáticamente las reconexiones si se pierde la conexión.
4. **RLS:** Los eventos de Realtime respetan las políticas RLS, por lo que solo recibirás cambios permitidos.

### Alternativa: Polling (sin Realtime)

Si no quieres usar Realtime, puedes hacer polling cada N minutos:

```typescript
// Recargar programaciones cada 5 minutos
setInterval(() => {
  recargarProgramaciones(usuarioId);
}, 5 * 60 * 1000);
```

**Desventaja:** Los cambios tardan hasta 5 minutos en reflejarse.  
**Ventaja:** Más simple, menos recursos.

---

## 🧪 Testing

```typescript
// Test 1: Usuario sin programaciones
const progs = await cargarProgramacionesUsuario('uuid-usuario');
console.assert(progs.length === 0, 'No debería tener programaciones');

// Test 2: Programación diaria a las 10:00 (simular hora)
const mockProgDiaria = {
  tipo: 'diaria',
  daily_mode: 'una_vez_dia',
  hora_una_vez_dia: '10:00',
  fecha_inicio: '2025-01-01',
  fecha_fin: null
};
// Si son las 10:03, debeSonarAhora debería ser true

// Test 3: Solapación con prioridad
const progA = { prioridad: 5, ... };
const progB = { prioridad: 10, ... };
// progB debe ejecutarse primero
```

---

## ❓ FAQ

### ¿Qué pasa si el usuario cierra sesión durante una programación?
Se detiene la reproducción. Al volver a iniciar sesión, se evalúa de nuevo.

### ¿Las programaciones respetan la zona horaria del usuario?
**SÍ.** Los campos `TIME` (como `rango_desde`, `hora_una_vez_dia`) se interpretan como hora local del dispositivo del usuario. Un usuario en Madrid y otro en Perú, ambos con programación a las "08:00", escucharán a las 08:00 de su hora local respectiva.

### ¿Qué pasa si hay un contenido eliminado?
La foreign key tiene `ON DELETE CASCADE`, por lo que se eliminará automáticamente de `programacion_contenidos`. Si una programación se queda sin contenidos, el reproductor simplemente no reproducirá nada (o puedes detectarlo y pausar la programación).

### ¿Cómo actualizar el estado de una programación desde el reproductor?
```typescript
// Marcar como completada (si tiene fecha_fin y ya pasó)
await supabase
  .from('programaciones')
  .update({ estado: 'completado' })
  .eq('id', programacionId);
```

### ¿Cuál es la diferencia entre los 2 modos de audio?
- **Fade Out/In:** Hace un fade out suave de la música (2 segundos), reproduce el contenido en silencio, y luego hace fade in de la música. Profesional y suave. Ideal para mensajes importantes, podcasts, noticias.
- **Background (música de fondo):** Baja el volumen de la música a un % predefinido (recomendado: 20%) y reproduce el contenido encima. Ideal para anuncios cortos donde la música ambienta.

### ¿Puedo tener 2 reproductores de audio simultáneos?
**Sí, es recomendable.** Deberías tener:
1. **Reproductor de música:** Para la música del canal (continua)
2. **Reproductor de contenido:** Para contenido programado (temporal)

Esto permite que en modo `background`, ambos reproduzcan simultáneamente.

### ¿Qué pasa si el contenido es muy largo y dura más que la frecuencia?
El reproductor debe esperar a que termine el contenido antes de volver a evaluar programaciones. No interrumpas un contenido programado a mitad.

### ¿Cómo sé si debo hacer fade out de 1, 2 o 3 segundos?
Recomendación:
- **Fade out:** 2 segundos (suave y profesional)
- **Fade in:** 2 segundos (simétrico)
- **Transición de volumen (background):** 1 segundo (rápido pero perceptible)

Puedes ajustar según tu preferencia.

---

## 📋 Checklist de Implementación

### ✅ Core del sistema (COMPLETADO)
- [x] Implementar función `cargarProgramacionesUsuario()` ← scheduledContentService.js
- [x] Implementar función `debeEjecutarse()` ← scheduledContentService.js
- [x] Implementar función `debeSonarAhora()` ← scheduledContentService.js
- [x] Implementar función `reproducirProgramacion()` ← audioPlayerService.js

### ✅ 🔊 Manejo de audio (COMPLETADO)
- [x] Implementar función `prepararAudioSegunModo()` ← integrado en reproducirProgramacion()
- [x] Implementar función `restaurarAudioSegunModo()` ← integrado en reproducirProgramacion()
- [x] Implementar función `fadeOutMusic()` ← playContentWithFade() (ya existía)
- [x] Implementar función `fadeInMusic()` ← playContentWithFade() (ya existía)
- [x] Implementar función `transicionarVolumen()` ← audioPlayerService.js NUEVO
- [x] Implementar función `reproducirContenido()` ← integrado en reproducirProgramacion()
- [x] Configurar 2 reproductores (música + contenido) ← ya existía activeContentPlayer

### 🔧 Base de datos (PENDIENTE)
- [ ] Ejecutar script `add-modo-audio-programaciones.sql` en Supabase
- [ ] Verificar campo `modo_audio` ('fade_out' | 'background')
- [ ] Activar Realtime en tablas: programaciones, programacion_destinatarios, programacion_contenidos

### ✅ Avanzado (COMPLETADO)
- [x] Implementar lógica de solapación (FIFO por defecto, prioridad para futuro)
- [x] Registrar reproducciones en `programacion_logs` ← scheduledContentService.js
- [x] Suscribirse a Realtime para cambios ← scheduledContentService.js
- [x] Integración con useAutodjHook ← useAutodjHook.js

### 🧪 Testing (PENDIENTE)
- [ ] Test modo audio 'fade_out' (fade out/in)
- [ ] Test modo audio 'background' (música de fondo predefinida)
- [ ] Verificar que música NUNCA se corta de golpe
- [ ] Testing con diferentes tipos de programaciones
- [ ] Testing con solapaciones

---

## 🎉 ESTADO ACTUAL: ✅ CÓDIGO COMPLETADO

**Ver documentación completa:**
- `SISTEMA-PROGRAMACIONES-IMPLEMENTADO.md` - Documentación técnica completa
- `RESUMEN-RAPIDO-PROGRAMACIONES.md` - Guía rápida de testing

**Archivos implementados:**
1. ✅ `src/services/scheduledContentService.js` - NUEVO (670 líneas)
2. ✅ `src/services/audioPlayerService.js` - AMPLIADO (+180 líneas)
3. ✅ `src/hooks/useAutodjHook.js` - INTEGRADO (+30 líneas)

**Próximo paso:** Ejecutar scripts SQL del backend y crear programación de prueba.

---

**¿Dudas?** Consulta con el equipo del Admin de Ondeón.

