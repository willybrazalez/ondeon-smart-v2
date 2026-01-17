# 🔒 Seguridad del Dashboard de Administración

## Descripción General

El Dashboard de Administración ha sido implementado con **estrictas medidas de seguridad** para garantizar que cada administrador solo pueda ver los usuarios de las empresas que tiene asignadas.

---

## 🛡️ Capas de Seguridad

### 1. **Consulta de Asignaciones en el Frontend**

Al cargar el Dashboard, se ejecuta una consulta a la tabla `admin_asignaciones`:

```javascript
const { data, error } = await supabase
  .from('admin_asignaciones')
  .select('empresa_id')
  .eq('admin_id', userId);
```

**Comportamiento:**
- ✅ Si el admin tiene empresas asignadas → Se cargan solo los usuarios de esas empresas
- ❌ Si el admin NO tiene empresas asignadas → No se muestra ningún usuario (por seguridad)
- ⚠️ Si hay un error en la consulta → No se muestra ningún usuario (principio de seguridad por defecto)

### 2. **Filtrado Estricto en Queries de Usuarios**

Todas las consultas a `user_current_state` y `usuarios` incluyen el filtro de empresas:

#### Hook `useLiveUsersPresenceAdmin`:
```javascript
// Conteo total filtrado por empresas
const { count } = await supabase
  .from('user_current_state')
  .select('*, usuarios!inner(empresa_id)', { count: 'exact', head: true })
  .in('usuarios.empresa_id', adminEmpresaIds);

// Datos paginados filtrados por empresas
const { data } = await supabase
  .from('user_current_state')
  .select(`...`)
  .in('usuarios.empresa_id', adminEmpresaIds)
  .range(offset, offset + pageSize - 1);
```

#### Hook `useOptimizedUserMapAdmin`:
```javascript
const { data } = await supabase
  .from('usuarios')
  .select(`...`)
  .in('empresa_id', adminEmpresaIds)
  .not('latitude', 'is', null)
  .not('longitude', 'is', null);
```

### 3. **Validación en Tiempo de Ejecución**

Antes de ejecutar cualquier query, se valida que existan empresas asignadas:

```javascript
if (adminEmpresaIds.length === 0) {
  logger.warn('⚠️ No hay empresas asignadas - no se cargarán usuarios');
  setTotalUsers(0);
  setLiveUsers([]);
  return; // No se ejecuta la query
}
```

### 4. **Row Level Security (RLS) en Supabase** *(Opcional pero Recomendado)*

Como capa adicional de seguridad, las políticas RLS en Supabase garantizan que:

```sql
-- Política para usuarios
CREATE POLICY "admin solo ve usuarios de sus empresas"
ON public.usuarios FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.admin_asignaciones
    WHERE admin_id = auth.uid()
  )
);

-- Política para estados de usuario
CREATE POLICY "admin solo ve estados de sus usuarios"
ON public.user_current_state FOR SELECT
TO authenticated
USING (
  usuario_id IN (
    SELECT u.id
    FROM public.usuarios u
    WHERE u.empresa_id IN (
      SELECT empresa_id FROM public.admin_asignaciones
      WHERE admin_id = auth.uid()
    )
  )
);
```

---

## 🔍 Logging y Auditoría

El sistema registra todas las operaciones relacionadas con la seguridad:

```javascript
logger.dev('🔒 Obteniendo empresas asignadas al admin:', userId);
logger.dev(`✅ Admin tiene ${empresasIds.length} empresa(s) asignada(s)`);
logger.warn('⚠️ Admin sin empresas asignadas - no verá usuarios');
logger.error('❌ Error obteniendo empresas del admin:', error);
```

Estos logs permiten:
- Auditar accesos al Dashboard
- Detectar intentos de acceso no autorizado
- Depurar problemas de permisos

---

## 🧪 Casos de Prueba

### Caso 1: Admin con 1 Empresa Asignada
- ✅ Ve todos los usuarios de esa empresa
- ✅ El mapa muestra solo ubicaciones de usuarios de esa empresa
- ✅ La paginación funciona correctamente
- ❌ NO ve usuarios de otras empresas

### Caso 2: Admin con Múltiples Empresas
- ✅ Ve usuarios de TODAS sus empresas asignadas
- ✅ El contador muestra el total de usuarios de todas sus empresas
- ✅ Puede navegar entre páginas viendo usuarios de todas sus empresas

### Caso 3: Admin sin Empresas Asignadas
- ❌ NO ve ningún usuario
- ⚠️ Se muestra mensaje en logs: "Admin sin empresas asignadas"
- ⚠️ Total de usuarios = 0
- ⚠️ Mapa vacío

### Caso 4: Error en Consulta de Asignaciones
- ❌ Por seguridad, NO se muestra ningún usuario
- ⚠️ Se registra el error en logs
- ⚠️ Sistema se comporta como si no hubiera empresas asignadas

---

## 📊 Flujo de Datos Seguro

```
1. Usuario Admin inicia sesión
   ↓
2. Se obtiene user.id del AuthContext
   ↓
3. Consulta a admin_asignaciones (WHERE admin_user_id = user.id)
   ↓
4. Se obtiene array de empresa_id
   ↓
5. Se pasa a hooks como parámetro
   ↓
6. Hooks ejecutan queries con .in('empresa_id', adminEmpresaIds)
   ↓
7. Solo se obtienen usuarios de empresas permitidas
   ↓
8. RLS valida adicionalmente en Supabase (opcional)
```

---

## 🚨 Puntos Críticos de Seguridad

### ⚠️ IMPORTANTE: No Modificar
```javascript
// ❌ NUNCA hacer esto:
const adminEmpresaIds = useMemo(() => [], []); // Mostraría TODOS los usuarios

// ✅ SIEMPRE consultar desde admin_asignaciones:
const { data } = await supabase
  .from('admin_asignaciones')
  .select('empresa_id')
  .eq('admin_user_id', userId);
```

### ⚠️ IMPORTANTE: Validación Obligatoria
```javascript
// ✅ SIEMPRE validar antes de ejecutar queries:
if (adminEmpresaIds.length === 0) {
  return; // No mostrar nada
}
```

### ⚠️ IMPORTANTE: Manejo de Errores
```javascript
// ✅ SIEMPRE establecer array vacío en caso de error:
if (error) {
  setAdminEmpresaIds([]); // Por seguridad, no mostrar nada
  return;
}
```

---

## 🔐 Recomendaciones Adicionales

1. **Habilitar RLS en Supabase** para doble capa de seguridad
2. **Auditar logs regularmente** para detectar accesos sospechosos
3. **Revisar asignaciones periódicamente** en la tabla `admin_asignaciones`
4. **No exponer IDs de empresa** en URLs o parámetros públicos
5. **Validar rol_id = 3** antes de permitir acceso al Dashboard

---

## 📝 Estructura de Tabla `admin_asignaciones`

```sql
CREATE TABLE public.admin_asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.usuarios(id),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(admin_id, empresa_id)
);

-- Índices recomendados para performance
CREATE INDEX idx_admin_asignaciones_admin ON admin_asignaciones(admin_id);
CREATE INDEX idx_admin_asignaciones_empresa ON admin_asignaciones(empresa_id);
```

---

## ✅ Checklist de Seguridad

- [x] Consulta de asignaciones implementada
- [x] Filtrado por empresa_id en todas las queries
- [x] Validación de array vacío antes de queries
- [x] Manejo de errores con comportamiento seguro por defecto
- [x] Logging de operaciones de seguridad
- [ ] RLS habilitado en Supabase (recomendado)
- [ ] Auditoría periódica de logs
- [ ] Documentación de asignaciones

---

## 🔧 Depuración

Si un administrador no ve usuarios esperados, verificar:

1. **¿Tiene asignaciones en `admin_asignaciones`?**
   ```sql
   SELECT * FROM admin_asignaciones WHERE admin_id = '[user_id]';
   ```

2. **¿Los usuarios tienen `empresa_id` correcto?**
   ```sql
   SELECT id, username, empresa_id FROM usuarios WHERE empresa_id IN ('[empresa_id]');
   ```

3. **¿Hay logs de error en la consola?**
   - Buscar: `❌ Error obteniendo empresas del admin`
   - Buscar: `⚠️ Admin sin empresas asignadas`

4. **¿El RLS está bloqueando la consulta?**
   - Verificar políticas en Supabase Dashboard

---

## 📞 Soporte

Si encuentras problemas de seguridad o acceso, revisar:
- Logs en consola del navegador
- Tabla `admin_asignaciones` en Supabase
- Políticas RLS en Supabase Dashboard
- Documentación de este archivo

