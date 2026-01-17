-- ============================================================
-- VERIFICAR ADMINISTRADORES CON MÚLTIPLES EMPRESAS
-- ============================================================
-- Este script verifica que los administradores con múltiples
-- empresas asignadas puedan ver todos los recursos correctamente
-- ============================================================

-- 1. Verificar administradores con múltiples empresas
SELECT 
  u.id as admin_id,
  u.username,
  u.email,
  COUNT(DISTINCT aa.empresa_id) as num_empresas,
  STRING_AGG(DISTINCT e.razon_social, ', ') as empresas,
  ARRAY_AGG(DISTINCT aa.empresa_id) as empresa_ids
FROM usuarios u
INNER JOIN admin_asignaciones aa ON u.id = aa.admin_id
INNER JOIN empresas e ON aa.empresa_id = e.id
WHERE u.rol_id = 3  -- Administradores
GROUP BY u.id, u.username, u.email
HAVING COUNT(DISTINCT aa.empresa_id) > 1
ORDER BY num_empresas DESC;

-- 2. Para cada admin con múltiples empresas, contar recursos
-- (Reemplaza 'TU_ADMIN_ID' con el ID del admin que estás verificando)

-- Ejemplo: Para un admin específico
-- SET app.current_admin_id = 'c683a1e4-0781-421e-af57-4b03e5848a5c';

-- Usuarios que debería ver el admin
WITH admin_empresas AS (
  SELECT empresa_id 
  FROM admin_asignaciones 
  WHERE admin_id = 'TU_ADMIN_ID'  -- Reemplazar con ID real
)
SELECT 
  'Usuarios de empresas asignadas' as tipo,
  COUNT(*) as total
FROM usuarios u
WHERE u.empresa_id IN (SELECT empresa_id FROM admin_empresas)

UNION ALL

-- Administradores (siempre visibles)
SELECT 
  'Administradores (siempre visibles)' as tipo,
  COUNT(*) as total
FROM usuarios u
WHERE u.rol_id = 3

UNION ALL

-- Grupos disponibles
SELECT 
  'Grupos disponibles' as tipo,
  COUNT(*) as total
FROM grupos g
WHERE g.empresa_id IN (SELECT empresa_id FROM admin_empresas)

UNION ALL

-- Usuarios en los grupos
SELECT 
  'Usuarios en grupos' as tipo,
  COUNT(DISTINCT gu.usuario_id) as total
FROM grupos g
INNER JOIN grupo_usuarios gu ON g.id = gu.grupo_id
WHERE g.empresa_id IN (SELECT empresa_id FROM admin_empresas);

-- 3. Verificar usuarios con ubicación (para el mapa)
WITH admin_empresas AS (
  SELECT empresa_id 
  FROM admin_asignaciones 
  WHERE admin_id = 'TU_ADMIN_ID'  -- Reemplazar con ID real
)
SELECT 
  'Usuarios con ubicación (empresas)' as tipo,
  COUNT(*) as total
FROM usuarios u
WHERE u.empresa_id IN (SELECT empresa_id FROM admin_empresas)
  AND u.latitude IS NOT NULL
  AND u.longitude IS NOT NULL

UNION ALL

SELECT 
  'Administradores con ubicación' as tipo,
  COUNT(*) as total
FROM usuarios u
WHERE u.rol_id = 3
  AND u.latitude IS NOT NULL
  AND u.longitude IS NOT NULL;

-- 4. Verificar estados actuales de usuarios (para presencia en vivo)
WITH admin_empresas AS (
  SELECT empresa_id 
  FROM admin_asignaciones 
  WHERE admin_id = 'TU_ADMIN_ID'  -- Reemplazar con ID real
)
SELECT 
  'Estados de usuarios (empresas)' as tipo,
  COUNT(*) as total
FROM user_current_state ucs
INNER JOIN usuarios u ON ucs.usuario_id = u.id
WHERE u.empresa_id IN (SELECT empresa_id FROM admin_empresas)

UNION ALL

SELECT 
  'Estados de administradores' as tipo,
  COUNT(*) as total
FROM user_current_state ucs
INNER JOIN usuarios u ON ucs.usuario_id = u.id
WHERE u.rol_id = 3;

-- 5. Query completo para simular lo que hace el hook useLiveUsersPresenceAdmin
WITH admin_empresas AS (
  SELECT empresa_id 
  FROM admin_asignaciones 
  WHERE admin_id = 'TU_ADMIN_ID'  -- Reemplazar con ID real
)
SELECT 
  ucs.usuario_id,
  u.username,
  u.email,
  u.empresa_id,
  u.rol_id,
  e.razon_social as empresa_nombre,
  ucs.is_online,
  ucs.last_seen_at
FROM user_current_state ucs
INNER JOIN usuarios u ON ucs.usuario_id = u.id
LEFT JOIN empresas e ON u.empresa_id = e.id
WHERE 
  -- Usuarios de empresas asignadas O administradores
  (u.empresa_id IN (SELECT empresa_id FROM admin_empresas) OR u.rol_id = 3)
ORDER BY ucs.last_seen_at DESC;

-- 6. Query completo para simular lo que hace el hook useOptimizedUserMapAdmin (NUEVO)
WITH admin_empresas AS (
  SELECT empresa_id 
  FROM admin_asignaciones 
  WHERE admin_id = 'TU_ADMIN_ID'  -- Reemplazar con ID real
)
SELECT 
  u.id,
  u.username,
  u.email,
  u.empresa_id,
  u.rol_id,
  e.razon_social as empresa_nombre,
  u.latitude,
  u.longitude
FROM usuarios u
LEFT JOIN empresas e ON u.empresa_id = e.id
WHERE 
  u.latitude IS NOT NULL
  AND u.longitude IS NOT NULL
  AND
  -- Usuarios de empresas asignadas O administradores
  (u.empresa_id IN (SELECT empresa_id FROM admin_empresas) OR u.rol_id = 3)
ORDER BY u.username;

-- ============================================================
-- NOTAS:
-- ============================================================
-- 1. Reemplaza 'TU_ADMIN_ID' con el UUID real del administrador
-- 2. El total de usuarios en el mapa debe incluir:
--    - Usuarios con ubicación de todas las empresas asignadas
--    - Administradores con ubicación (independiente de empresa_id)
-- 3. Si el mapa muestra menos usuarios que el contador de presencia,
--    es probable que useOptimizedUserMapAdmin no esté incluyendo
--    a los administradores correctamente
-- ============================================================

