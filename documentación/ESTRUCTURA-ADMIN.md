# 📋 Estructura de Panel de Administración

## 🎯 Descripción

Se ha implementado un panel de administración completo dentro del mismo proyecto, manteniendo la arquitectura de roles y permisos existente. Esta decisión permite:

- **Código compartido**: Servicios, componentes UI, temas y lógica de negocio unificada
- **Autenticación única**: Un solo login para todos los roles
- **Actualizaciones sincronizadas**: Un solo deploy y versionado
- **Bundle optimizado**: Tree-shaking automático elimina código no usado según rol

## 📁 Estructura de Archivos

```
src/
├── components/
│   ├── layout/
│   │   ├── AdminLayout.jsx          # Layout con sidebar para admin
│   │   ├── DynamicBackground.jsx
│   │   └── Sidebar.jsx
│   └── ...
├── pages/
│   ├── admin/                        # 🆕 Páginas de administración
│   │   ├── AdminDashboard.jsx       # Dashboard principal con estadísticas
│   │   ├── MapPage.jsx              # Mapa de ubicaciones en tiempo real
│   │   ├── QuickAdsPage.jsx         # Creación rápida de anuncios
│   │   └── GroupManagementPage.jsx  # Gestión de grupos de usuarios
│   ├── PlayerPage.jsx               # Interfaz de reproductor
│   ├── ChannelsPage.jsx
│   └── ...
└── hooks/
    └── useRole.js                    # Sistema de roles y permisos
```

## 🚪 Rutas Implementadas

### Rutas de Usuario Básico/Gestor
- `/` - Reproductor principal
- `/canales` - Gestión de canales
- `/programacion` - Gestión de contenidos
- `/historial-anuncios` - Historial de reproducciones
- `/soporte` - Página de soporte

### Rutas de Administrador (Protegidas)
- `/admin/dashboard` - Dashboard con estadísticas generales
- `/admin/mapa` - Mapa interactivo de ubicaciones
- `/admin/anuncios-rapidos` - Creación rápida de anuncios
- `/admin/grupos` - Gestión de grupos de usuarios

## 🔐 Sistema de Permisos

Las rutas de admin están protegidas con el componente `PermissionGated`:

```jsx
<Route path="/admin/dashboard" element={
  <PermissionGated permissions={['showAdminPanel']}>
    <AdminDashboard />
  </PermissionGated>
} />
```

### Permisos por Rol

#### Rol 1: Básico
- ✅ Acceso al reproductor
- ✅ Ver canales y contenidos
- ✅ Ver historial
- ❌ Crear anuncios
- ❌ Panel de administración

#### Rol 2: Gestor
- ✅ Todos los permisos de Básico
- ✅ Crear anuncios inmediatos
- ✅ Panel de administración completo
- ✅ Gestión de usuarios y grupos

#### Rol 3: Administrador
- ✅ Acceso total al sistema
- ✅ Panel de administración completo
- ✅ Gestión de usuarios, grupos y configuración
- ✅ Visualización de estadísticas y analíticas

## 🎨 AdminLayout

El `AdminLayout` proporciona:

1. **Sidebar responsivo** con navegación contextual
2. **Colapso automático** para maximizar espacio
3. **Menú móvil** con overlay
4. **Navegación filtrada** según permisos del usuario

### Características
- ✨ Animaciones fluidas con Framer Motion
- 🎨 Soporte completo para temas claro/oscuro
- 📱 Diseño 100% responsivo
- 🔒 Elementos condicionados por permisos

## 📊 Páginas Implementadas

### 1. AdminDashboard
- Tarjetas de estadísticas en tiempo real
- Vista previa de mapa de ubicaciones
- Canales y contenidos más reproducidos
- Gráficas y métricas del sistema

### 2. MapPage
- Mapa interactivo de España (preparado para Google Maps API)
- Filtros por estado (activo, pausado, inactivo)
- Lista lateral con todas las ubicaciones
- Estadísticas de distribución geográfica

### 3. QuickAdsPage
- Sistema de tabs (Texto, Voz, Acción)
- Generación de texto con IA (placeholder)
- Selector de tipo de voz
- Selector de grupo de destinatarios
- Historial de anuncios recientes

### 4. GroupManagementPage
- Tabla completa de grupos organizados
- Indicadores de piezas programadas por grupo
- Estadísticas rápidas
- Acciones inline (editar, eliminar)

## 🔄 Flujo de Navegación

```
Login (todos los roles)
  │
  ├─► Rol Básico
  │    └─► Interfaz de Reproductor
  │
  ├─► Rol Gestor
  │    ├─► Interfaz de Reproductor
  │    └─► Panel de Admin (botón en navegación)
  │         └─► /admin/dashboard
  │
  └─► Rol Administrador
       ├─► Interfaz de Reproductor
       └─► Panel de Admin (botón en navegación)
            ├─► /admin/dashboard
            ├─► /admin/mapa
            ├─► /admin/anuncios-rapidos
            └─► /admin/grupos
```

## 🎯 Detección de Rutas Admin en App.jsx

Se implementó detección automática para ocultar elementos del reproductor:

```javascript
// Detectar si estamos en una ruta de admin
const isAdminRoute = location.pathname.startsWith('/admin/');

// Ocultar header, footer y navegación inferior en rutas de admin
{user && !isAuthRoute && !isAdminRoute && (
  // ... elementos del reproductor
)}
```

Esto asegura que:
- ❌ No se muestre el header del reproductor en admin
- ❌ No se muestren los controles de volumen
- ❌ No se muestre la navegación flotante inferior
- ✅ AdminLayout toma control completo del diseño

## 🚀 Próximos Pasos (Implementaciones Futuras)

### Integración de Mapa
- [ ] Conectar con Google Maps API
- [ ] Implementar clusters automáticos
- [ ] Añadir tooltips informativos en marcadores
- [ ] Filtros avanzados (por grupo, canal, etc.)

### Anuncios Rápidos
- [ ] Integración con API de síntesis de voz
- [ ] Generación de texto con IA (OpenAI/Claude)
- [ ] Preview de audio antes de enviar
- [ ] Programación temporal de anuncios

### Gestión de Grupos
- [ ] CRUD completo de grupos
- [ ] Asignación masiva de contenidos
- [ ] Estadísticas por grupo
- [ ] Gestión de permisos granulares

### Dashboard
- [ ] Gráficas en tiempo real (Chart.js/Recharts)
- [ ] Exportación de reportes
- [ ] Alertas y notificaciones
- [ ] Configuración de KPIs

## 🧪 Testing

Para probar el panel de admin:

1. **Login con usuario Gestor o Administrador** (rol_id = 2 o 3)
2. **Navegar** a cualquiera de las rutas `/admin/*`
3. **Verificar** que el sidebar aparece correctamente
4. **Probar navegación** entre diferentes páginas de admin
5. **Verificar protección** intentando acceder con usuario Básico

## 📝 Notas de Desarrollo

- **Todos los componentes** están optimizados para carga lazy (Code Splitting automático)
- **Las rutas están protegidas** a nivel de componente con `PermissionGated`
- **El layout de admin** solo se renderiza en rutas `/admin/*`
- **Los datos actuales son mock** - conectar con API real según necesidad
- **El diseño es escalable** - fácil agregar nuevas páginas de admin

## 🎨 Personalización

Para agregar una nueva página de admin:

1. **Crear componente** en `src/pages/admin/NuevaPagina.jsx`
2. **Usar AdminLayout**:
   ```jsx
   import AdminLayout from '@/components/layout/AdminLayout';
   
   const NuevaPagina = () => {
     return (
       <AdminLayout>
         {/* Tu contenido aquí */}
       </AdminLayout>
     );
   };
   ```
3. **Agregar ruta** en `App.jsx`:
   ```jsx
   <Route path="/admin/nueva-pagina" element={
     <PermissionGated permissions={['tuPermiso']}>
       <NuevaPagina />
     </PermissionGated>
   } />
   ```
4. **Actualizar sidebar** en `AdminLayout.jsx` (opcional)

---

**Implementado por**: Cursor AI Assistant
**Fecha**: Octubre 2025
**Versión**: 1.0.0





