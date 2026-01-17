# 🎯 Sistema de Programación Completo de Anuncios IA

## ✅ Implementación Completada

Se ha implementado un sistema completo de programación de anuncios con IA que incluye todas las opciones avanzadas solicitadas.

---

## 📋 Características Implementadas

### 1. **Nombre de Programación**
- ✅ Campo obligatorio para identificar cada programación
- ✅ Placeholder con ejemplo: "Promoción Black Friday"
- ✅ Validación antes de guardar

### 2. **Gestión de Destinatarios**
- ✅ Opción: "Todos los usuarios de la empresa"
- ✅ Opción: "Grupos específicos"
- ✅ **Grupos expandibles** con lista de usuarios
  - Click para expandir/contraer
  - Muestra nombre o email de cada usuario
  - Contador de usuarios por grupo
- ✅ Checkbox para seleccionar múltiples grupos

### 3. **Periodo de Programación**
- ✅ **Fecha de inicio** (obligatorio)
- ✅ **Hora de inicio** (obligatorio)
- ✅ **Fecha de fin** (opcional)
- ✅ **Hora de fin** (default: 23:59)

### 4. **Frecuencia de Reproducción**
- ✅ Selector numérico de 1 a 1440 minutos
- ✅ Default: 15 minutos
- ✅ Texto explicativo: "El anuncio se reproducirá automáticamente cada X minutos con música de fondo"
- ✅ **Modo audio siempre configurado como 'background'** (música de fondo)

### 5. **Periodicidad: DIARIA**
Tres opciones mediante radio buttons:

#### Opción 1: Cada X días
- ✅ Selector de número de días (1-365)
- ✅ Rango de horas personalizable (desde - hasta)
- ✅ Reproducción automática en el intervalo configurado

#### Opción 2: Días laborales
- ✅ Automático lunes a viernes
- ✅ Utiliza el mismo rango de horas configurado
- ✅ Pre-configurado para horario comercial (8:00 - 23:59)

#### Opción 3: Una vez al día
- ✅ Selector de hora específica
- ✅ Se reproduce solo una vez a la hora indicada

### 6. **Periodicidad: SEMANAL**
- ✅ **Selector de días de la semana** con checkboxes:
  - Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo
  - Múltiple selección
  - Visual con bordes y hover effects
- ✅ **Dos modos de reproducción:**
  
#### Modo 1: Entre horas
- Selector de rango (desde - hasta)
- Reproducción automática en intervalo

#### Modo 2: Una vez al día
- Selector de hora específica
- Una reproducción por día seleccionado

### 7. **Periodicidad: ANUALMENTE**
- ✅ Campo de fecha en formato dd/mm (ej: 25/12)
- ✅ Selector de hora específica
- ✅ Perfecto para eventos especiales (Navidad, aniversarios, etc.)

---

## 🔧 Detalles Técnicos

### Base de Datos

#### Tabla: `programaciones`
Los siguientes campos se insertan correctamente según la configuración:

```sql
- nombre (de configuracionProgramacion.nombre)
- descripcion
- tipo: 'diaria' | 'semanal' | 'anual'
- estado: 'activo'
- modo_audio: 'background' (siempre música de fondo)
- fecha_inicio
- fecha_fin (opcional)
- frecuencia_minutos
- hora_inicio
- hora_fin
- prioridad: 0
- esperar_fin_cancion: false

-- Si tipo = 'diaria':
- daily_mode: 'cada' | 'laborales' | 'una_vez_dia'
- cada_dias: número
- rango_desde
- rango_hasta
- hora_una_vez_dia

-- Si tipo = 'semanal':
- weekly_mode: 'rango' | 'una_vez_dia'
- weekly_days: array ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
- weekly_rango_desde
- weekly_rango_hasta
- weekly_hora_una_vez

-- Si tipo = 'anual':
- annual_date: 'dd/mm'
- annual_time: 'HH:mm'
```

### Conversión de Días
El sistema convierte automáticamente los días del español al formato esperado:
```javascript
'lunes' → 'lun'
'martes' → 'mar'
'miercoles' → 'mie'
'jueves' → 'jue'
'viernes' → 'vie'
'sabado' → 'sab'
'domingo' → 'dom'
```

### Archivos Modificados

1. **`src/pages/admin/QuickAdsPage.jsx`**
   - ✅ Nuevos estados para configuración completa
   - ✅ Función `cargarUsuariosDeGrupos()` - Carga usuarios por grupo
   - ✅ Función `toggleGrupoExpandido()` - Maneja expansión/contracción
   - ✅ UI completa del Paso 5 con tabs y configuraciones
   - ✅ `handleProgramar()` actualizado con nuevos parámetros
   - ✅ `resetearFormulario()` actualizado

2. **`src/services/aiAdService.js`**
   - ✅ Función `programarAnuncio()` completamente reescrita
   - ✅ Maneja todos los tipos de periodicidad
   - ✅ Convierte formato de días
   - ✅ Inserta correctamente en `programaciones`

---

## 🎨 Interfaz de Usuario

### Paso 5: Programar - Secciones

1. **Nombre de Programación** ⭐ (obligatorio)
   - Input de texto limpio
   - Placeholder descriptivo

2. **Destinatarios**
   - Botones grandes con iconos
   - Visual clara de selección
   - **Grupos expandibles con usuarios internos**

3. **Periodo de Programación**
   - Grid 2x2 con labels claros
   - Inputs de fecha y hora nativos

4. **Frecuencia**
   - Input numérico con contexto visual
   - Texto explicativo dinámico

5. **Periodicidad**
   - **Tabs horizontales** para cambiar tipo
   - Fondos diferenciados para cada configuración
   - Controles deshabilitados cuando no aplican
   - Visual moderna y limpia

### Estilo Visual
- ✅ Inputs con fondo semitransparente
- ✅ Bordes sutiles
- ✅ Hover effects en elementos interactivos
- ✅ Transiciones suaves
- ✅ Iconos consistentes
- ✅ Responsive design

---

## 🚀 Flujo de Uso

1. Usuario crea anuncio con IA (Pasos 1-4)
2. Click en "Guardar y Programar"
3. Sistema guarda en BD y muestra Paso 5
4. Usuario configura:
   - ✅ Nombre descriptivo
   - ✅ Destinatarios (todos o grupos específicos con usuarios visibles)
   - ✅ Fechas y horas
   - ✅ Frecuencia en minutos
   - ✅ Periodicidad (diaria/semanal/anual) con todas sus opciones
5. Click en "Programar Anuncio"
6. Sistema crea entrada en `programaciones`, `programacion_contenidos` y `programacion_destinatarios`
7. Mensaje de confirmación con cantidad de usuarios
8. Formulario se resetea y vuelve al home

---

## ✨ Ejemplos de Configuración

### Ejemplo 1: Promoción Diaria (Laborales)
```
Nombre: "Menú del día"
Destinatarios: Todos los usuarios
Periodo: 01/11/2025 - indefinido
Frecuencia: 30 minutos
Periodicidad: Diaria → Días laborales entre 08:00 y 23:59
```

### Ejemplo 2: Evento Semanal
```
Nombre: "Happy Hour"
Destinatarios: Grupo "Tiki Taka Valencia"
Periodo: 04/11/2025 - 31/12/2025
Frecuencia: 15 minutos
Periodicidad: Semanal → Viernes y Sábado, una vez a las 18:00
```

### Ejemplo 3: Evento Anual
```
Nombre: "Feliz Navidad"
Destinatarios: Todos los usuarios
Periodo: 25/12/2025 - 25/12/2025
Frecuencia: 60 minutos
Periodicidad: Anualmente → 25/12 a las 00:00
```

---

## 🔍 Verificación

### Para verificar en la base de datos:

```sql
-- Ver última programación creada
SELECT * FROM programaciones 
ORDER BY created_at DESC 
LIMIT 1;

-- Ver contenido asociado
SELECT pc.*, c.nombre 
FROM programacion_contenidos pc
JOIN contenidos c ON c.id = pc.contenido_id
WHERE pc.programacion_id = '[id de programacion]';

-- Ver destinatarios
SELECT pd.*, u.nombre, u.email
FROM programacion_destinatarios pd
JOIN usuarios u ON u.id = pd.usuario_id
WHERE pd.programacion_id = '[id de programacion]';
```

---

## 📝 Notas Importantes

1. **Modo Audio**: Siempre configurado como "background" (música de fondo automáticamente)
2. **Validaciones**: 
   - Nombre de programación obligatorio
   - Al menos un destinatario (todos o grupos)
   - Fechas coherentes
3. **Usuarios en Grupos**: Se muestran en la UI pero la selección es a nivel de grupo completo
4. **Días Semanales**: Conversión automática español → abreviado inglés
5. **Reseteo**: Después de programar, vuelve al home automáticamente

---

## 🎯 Estado del Sistema

✅ **100% Funcional y Probado**
- Frontend: Interfaz completa implementada
- Backend: Servicio actualizado con toda la lógica
- Base de Datos: Todas las políticas RLS correctas
- Validaciones: Implementadas en frontend y backend

🎨 **UX/UI Moderna**
- Diseño limpio y profesional
- Responsive
- Iconografía consistente
- Feedback visual en cada acción

---

**Última actualización**: 4 de noviembre de 2025
**Versión**: 2.0 - Sistema Completo de Programación

