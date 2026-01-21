# 🎯 Mejoras en Selector de Usuarios - Grupos

## ✅ Cambios Implementados

Se ha mejorado completamente el sistema de selección de destinatarios para permitir la selección individual de usuarios dentro de cada grupo.

---

## 🆕 Nuevas Funcionalidades

### 1. **Selección Individual de Usuarios**
- ✅ Cada usuario tiene su propio checkbox
- ✅ Puedes seleccionar usuarios específicos de diferentes grupos
- ✅ Ya no se selecciona el grupo completo, sino usuarios individuales

### 2. **Checkbox de Grupo Inteligente**
El checkbox del encabezado del grupo ahora funciona como "seleccionar/deseleccionar todos":
- ✅ **Marcado**: Todos los usuarios del grupo están seleccionados
- ✅ **Desmarcado**: Ningún usuario del grupo está seleccionado
- ✅ **Indeterminado** (guion): Algunos usuarios están seleccionados

### 3. **Formato de Visualización Mejorado**
- ✅ Muestra: `username - establecimiento`
- ✅ Fallback: Si no hay username, muestra email o nombre
- ✅ Obtiene el establecimiento desde `empresas.razon_social`

### 4. **Contador Dinámico**
En el encabezado de cada grupo se muestra:
- **Sin selección**: `13 usuarios`
- **Con selección**: `3/13 usuarios` (en color primario)

### 5. **Visual Mejorado**
- ✅ Usuarios seleccionados tienen fondo de color
- ✅ Borde destacado en usuarios activos
- ✅ Hover effects suaves
- ✅ Transiciones animadas

---

## 🔧 Detalles Técnicos

### Nuevos Estados

```javascript
// Nuevo: Array de IDs de usuarios seleccionados individualmente
const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);
```

### Nuevas Funciones

#### `toggleUsuarioSeleccionado(usuarioId)`
Agrega o quita un usuario individual de la selección.

```javascript
const toggleUsuarioSeleccionado = (usuarioId) => {
  setUsuariosSeleccionados(prev => 
    prev.includes(usuarioId)
      ? prev.filter(id => id !== usuarioId)
      : [...prev, usuarioId]
  );
};
```

#### `toggleTodosUsuariosGrupo(grupoId, usuarios)`
Selecciona o deselecciona todos los usuarios de un grupo.

```javascript
const toggleTodosUsuariosGrupo = (grupoId, usuarios) => {
  const usuarioIds = usuarios.map(u => u.id);
  const todosSeleccionados = usuarioIds.every(id => usuariosSeleccionados.includes(id));
  
  if (todosSeleccionados) {
    // Deseleccionar todos
    setUsuariosSeleccionados(prev => prev.filter(id => !usuarioIds.includes(id)));
  } else {
    // Seleccionar todos
    setUsuariosSeleccionados(prev => [...new Set([...prev, ...usuarioIds])]);
  }
};
```

#### `getUsuariosSeleccionadosDeGrupo(usuarios)`
Cuenta cuántos usuarios de un grupo están seleccionados.

```javascript
const getUsuariosSeleccionadosDeGrupo = (usuarios) => {
  if (!usuarios) return 0;
  return usuarios.filter(u => usuariosSeleccionados.includes(u.id)).length;
};
```

### Query Actualizado

Ahora se obtienen más datos de cada usuario:

```javascript
const { data: grupoUsuariosData, error } = await supabase
  .from('grupo_usuarios')
  .select(`
    grupo_id,
    usuario_id,
    usuarios:usuario_id (
      id,
      nombre,
      email,
      username,              // ✅ NUEVO
      empresa_id,
      empresas:empresa_id (  // ✅ NUEVO
        razon_social
      )
    )
  `)
  .in('grupo_id', grupoIds);
```

### Validación Actualizada

```javascript
// Antes: validaba grupos seleccionados
if (destinatariosTipo === 'grupos' && gruposSeleccionados.length === 0)

// Ahora: valida usuarios seleccionados
if (destinatariosTipo === 'grupos' && usuariosSeleccionados.length === 0)
```

### Envío a Backend

```javascript
// Antes
grupos: destinatariosTipo === 'grupos' ? gruposSeleccionados : []

// Ahora
usuarios: destinatariosTipo === 'grupos' ? usuariosSeleccionados : [],
grupos: [] // Ya no se envían grupos
```

---

## 🎨 Interfaz de Usuario

### Estructura Visual

```
┌─────────────────────────────────────────────────┐
│ ☑ Tiki Taka Castellón       3/3 usuarios ↓     │ ← Checkbox del grupo
├─────────────────────────────────────────────────┤
│   ☑ 👤 Ginés - Sángüi Supermercados            │ ← Usuario seleccionado
│   ☑ 👤 Adrián - Tiki Taka Castellón            │
│   ☑ 👤 Adrián - Tiki Taka Castellón            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ☐̶ Tiki Taka Alicante         0/13 usuarios ↓   │ ← Estado indeterminado
├─────────────────────────────────────────────────┤
│   ☐ 👤 Adrián - Tiki Taka Alicante             │ ← Usuario no seleccionado
│   ☐ 👤 Adrián - Tiki Taka Alicante             │
│   ...                                            │
└─────────────────────────────────────────────────┘
```

### Estados Visuales

#### Usuario No Seleccionado
- Fondo: Transparente
- Hover: Fondo sutil
- Checkbox: Desmarcado

#### Usuario Seleccionado
- Fondo: `bg-primary/10`
- Borde: `border-primary/30`
- Texto nombre: `font-medium` (negrita)
- Checkbox: Marcado

---

## 📊 Ejemplo de Uso

### Caso 1: Seleccionar usuarios específicos de diferentes grupos
```
Grupo 1: Tiki Taka Castellón
  ✓ Ginés - Sángüi Supermercados
  ✓ Adrián - Tiki Taka Castellón
  
Grupo 2: Tiki Taka Valencia
  ✓ Pedro - Tiki Taka Valencia

Total seleccionados: 3 usuarios
```

### Caso 2: Seleccionar grupo completo con un click
```
Click en checkbox del grupo "Tiki Taka Alicante"
→ Selecciona automáticamente sus 13 usuarios
```

### Caso 3: Deseleccionar algunos usuarios de un grupo
```
Grupo: Tiki Taka Región de Murcia (31 usuarios)
  Checkbox del grupo: Estado indeterminado (-)
  Seleccionados: 15/31 usuarios
```

---

## 🔍 Datos que se Envían

### Al Backend (`aiAdService.programarAnuncio`)

```javascript
{
  contenidoId: "uuid-del-contenido",
  titulo: "Nombre de la programación",
  usuarios: ["user-id-1", "user-id-2", "user-id-3"], // ✅ IDs individuales
  grupos: [], // ✅ Ya no se envían grupos
  todosUsuarios: false,
  empresaId: "empresa-uuid",
  // ... resto de configuración
}
```

### Inserción en Base de Datos

La tabla `programacion_destinatarios` ahora recibe:

```sql
INSERT INTO programacion_destinatarios (programacion_id, usuario_id, activo)
VALUES 
  ('prog-uuid', 'user-id-1', true),
  ('prog-uuid', 'user-id-2', true),
  ('prog-uuid', 'user-id-3', true);
```

---

## ✨ Ventajas del Nuevo Sistema

1. **Mayor Flexibilidad**: Selecciona exactamente a quién quieres enviar
2. **Visual Clara**: Ves inmediatamente quién está seleccionado
3. **Agrupación Inteligente**: El checkbox del grupo facilita selecciones masivas
4. **Información Completa**: Sabes a qué establecimiento pertenece cada usuario
5. **Estado Preciso**: El estado indeterminado muestra selecciones parciales

---

## 📝 Archivos Modificados

### `src/pages/admin/QuickAdsPage.jsx`
- ✅ Añadido estado `usuariosSeleccionados`
- ✅ Función `toggleUsuarioSeleccionado()`
- ✅ Función `toggleTodosUsuariosGrupo()`
- ✅ Función `getUsuariosSeleccionadosDeGrupo()`
- ✅ Query actualizado en `cargarUsuariosDeGrupos()`
- ✅ UI completamente rediseñada
- ✅ Validación actualizada
- ✅ `handleProgramar()` envía usuarios en lugar de grupos
- ✅ `resetearFormulario()` limpia usuarios seleccionados

---

## 🎯 Estado Final

✅ **100% Funcional**
- Selección individual implementada
- Formato "username - establecimiento"
- Checkbox de grupo con estado indeterminado
- Validaciones correctas
- Envío a backend actualizado

🎨 **UX/UI Mejorada**
- Visual clara y moderna
- Feedback inmediato
- Animaciones suaves
- Estados bien diferenciados

---

**Última actualización**: 4 de noviembre de 2025
**Versión**: 2.1 - Selección Individual de Usuarios

