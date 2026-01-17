# 🔒 Seguridad: Filtrado por Empresas Asignadas

## ⚠️ PRINCIPIO FUNDAMENTAL

**Un administrador SOLO puede ver usuarios de las empresas que gestiona**

Esto se controla mediante la tabla `admin_asignaciones`:
```sql
SELECT empresa_id FROM admin_asignaciones WHERE admin_id = 'admin-uuid'
```

---

## 🚨 Regla de Oro

### ✅ PERMITIDO
```javascript
// Solo usuarios de empresas asignadas
.in('empresa_id', adminEmpresaIds)
```

### ❌ PROHIBIDO
```javascript
// NUNCA incluir todos los administradores
.or(`empresa_id.in.(...),rol_id.eq.3`)

// NUNCA usar queries sin filtro
.select('*')  // Sin WHERE

// NUNCA filtrar solo por rol
.eq('rol_id', 3)  // Mostraría TODOS los admins
```

---

## 📋 Checklist de Seguridad

Antes de hacer cualquier query de usuarios, verificar:

- [ ] ✅ Filtrar por `empresa_id IN (adminEmpresaIds)`
- [ ] ❌ NO incluir `.or(... rol_id.eq.3)`
- [ ] ❌ NO hacer queries sin filtro de empresa
- [ ] ✅ Usar `!inner` join cuando sea necesario
- [ ] ✅ Validar que `adminEmpresaIds.length > 0`

---

## 🔍 Ejemplos Correctos

### Query de usuarios para lista
```javascript
const { data } = await supabase
  .from('user_current_state')
  .select(`
    usuario_id, is_online, last_seen_at,
    usuarios!inner(id, username, nombre, empresa_id)
  `)
  .in('usuarios.empresa_id', adminEmpresaIds)  // ✅ Correcto
  .order('last_seen_at', { ascending: false });
```

### Query de usuarios para mapa
```javascript
const { data } = await supabase
  .from('usuarios')
  .select('id, username, latitude, longitude, empresa_id')
  .in('empresa_id', adminEmpresaIds)  // ✅ Correcto
  .not('latitude', 'is', null);
```

### Query de grupos
```javascript
const { data } = await supabase
  .from('grupos')
  .select('*')
  .in('empresa_id', adminEmpresaIds);  // ✅ Correcto
```

### Query de programaciones
```javascript
// Primero obtener grupos de las empresas
const { data: grupos } = await supabase
  .from('grupos')
  .select('id')
  .in('empresa_id', adminEmpresaIds);  // ✅ Correcto

// Luego obtener usuarios de esos grupos
const grupoIds = grupos.map(g => g.id);
const { data: usuarios } = await supabase
  .from('grupo_usuarios')
  .select('usuario_id, usuarios!inner(*)')
  .in('grupo_id', grupoIds);
```

---

## ❌ Ejemplos INCORRECTOS (NO USAR)

### ❌ Incluir todos los administradores
```javascript
// PELIGRO: Mostraría admins de TODAS las empresas
const { data } = await supabase
  .from('usuarios')
  .select('*')
  .or(`empresa_id.in.(${adminEmpresaIds.join(',')}),rol_id.eq.3`);
```

### ❌ Query sin filtro
```javascript
// PELIGRO: Mostraría TODOS los usuarios del sistema
const { data } = await supabase
  .from('usuarios')
  .select('*');
```

### ❌ Filtrar solo por rol
```javascript
// PELIGRO: Mostraría todos los admins, no solo los de las empresas asignadas
const { data } = await supabase
  .from('usuarios')
  .select('*')
  .eq('rol_id', 3);
```

---

## 🧪 Cómo Verificar Seguridad

### Prueba 1: Crear admin con 2 empresas
```sql
-- Admin 1 gestiona empresas A y B
INSERT INTO admin_asignaciones (admin_id, empresa_id)
VALUES 
  ('admin-1-uuid', 'empresa-A-uuid'),
  ('admin-1-uuid', 'empresa-B-uuid');

-- Admin 2 gestiona solo empresa C
INSERT INTO admin_asignaciones (admin_id, empresa_id)
VALUES ('admin-2-uuid', 'empresa-C-uuid');
```

### Prueba 2: Verificar aislamiento
- Admin 1 debe ver: usuarios de empresas A y B
- Admin 1 **NO** debe ver: usuarios de empresa C
- Admin 1 **NO** debe ver: Admin 2

### Prueba 3: Ver logs en consola
```javascript
logger.dev('🏢 Empresas asignadas:', adminEmpresaIds);
logger.dev('👥 Usuarios cargados:', data.length);
logger.dev('🔍 Empresas en resultados:', [...new Set(data.map(u => u.empresa_id))]);
```

Verificar que:
- Solo aparecen empresa_id de adminEmpresaIds
- No aparecen usuarios de otras empresas

---

## 🛡️ Protección Adicional: RLS

Para doble capa de seguridad, añadir políticas RLS:

```sql
-- Política para usuarios
CREATE POLICY "Admin solo ve usuarios de sus empresas"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id 
    FROM public.admin_asignaciones
    WHERE admin_id = auth.uid()
  )
);

-- Política para user_current_state
CREATE POLICY "Admin solo ve estados de sus usuarios"
ON public.user_current_state
FOR SELECT
TO authenticated
USING (
  usuario_id IN (
    SELECT u.id
    FROM public.usuarios u
    WHERE u.empresa_id IN (
      SELECT empresa_id 
      FROM public.admin_asignaciones
      WHERE admin_id = auth.uid()
    )
  )
);

-- Política para grupos
CREATE POLICY "Admin solo ve grupos de sus empresas"
ON public.grupos
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id 
    FROM public.admin_asignaciones
    WHERE admin_id = auth.uid()
  )
);
```

**Nota**: Actualmente RLS no está habilitado para estas tablas.

---

## 📊 Impacto en Funcionalidades

### Dashboard
- ✅ Lista de usuarios: Solo de empresas asignadas
- ✅ Mapa de ubicaciones: Solo de empresas asignadas
- ✅ Estadísticas: Solo de empresas asignadas

### Programaciones
- ✅ Grupos disponibles: Solo de empresas asignadas
- ✅ Usuarios en grupos: Solo de empresas asignadas
- ✅ Destinatarios: Solo de empresas asignadas

### Gestión
- ✅ Grupos: Solo de empresas asignadas
- ✅ Usuarios: Solo de empresas asignadas
- ✅ Contenidos: Solo de empresas asignadas

---

## 🚨 Reporte de Vulnerabilidades

Si encuentras una query que NO filtra por `empresa_id`:

1. **Documentarlo inmediatamente**
2. **Crear un fix urgente**
3. **Verificar todas las queries similares**
4. **Actualizar esta documentación**

### Template de reporte:
```markdown
## Vulnerabilidad de Seguridad

**Ubicación**: `src/path/to/file.js` línea X
**Problema**: Query no filtra por empresa_id
**Riesgo**: Admin puede ver usuarios de otras empresas
**Fix**: Añadir `.in('empresa_id', adminEmpresaIds)`
**Estado**: [ ] Pendiente / [x] Corregido
```

---

## ✅ Archivos Verificados

- [x] `src/hooks/useLiveUsersPresenceAdmin.js` - ✅ Seguro
- [x] `src/hooks/useOptimizedUserMapAdmin.js` - ✅ Seguro
- [x] `src/pages/admin/ProgramacionesPage.jsx` - ✅ Seguro
- [x] `src/pages/admin/GroupsManagementPage.jsx` - ✅ Seguro
- [x] `src/pages/admin/ContentManagementPage.jsx` - ✅ Seguro
- [x] `src/contexts/AdminEmpresaContext.jsx` - ✅ Seguro

---

## 📝 Resumen

| Acción | Permitido | Prohibido |
|--------|-----------|-----------|
| Ver usuarios de empresas asignadas | ✅ | |
| Ver usuarios de otras empresas | | ❌ |
| Ver todos los administradores | | ❌ |
| Filtrar sin empresa_id | | ❌ |
| Usar .or() con rol_id | | ❌ |

**Recordar**: Cada admin opera en su **espacio aislado** de empresas.

---

**Fecha actualización**: 2025-11-04  
**Estado**: 🔒 Validado y seguro

