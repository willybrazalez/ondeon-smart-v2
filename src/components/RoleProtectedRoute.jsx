import React from 'react'
import { useRole } from '@/hooks/useRole'

/**
 * Componente para proteger rutas basado en permisos
 * Sistema simplificado con un solo tipo de usuario
 */
export const RoleProtectedRoute = ({ 
  children, 
  requiredPermissions = [], 
  requireAll = false,
  fallback = null 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, userRole } = useRole()

  // Si no hay usuario autenticado, no mostrar nada
  if (!userRole) {
    return fallback || null
  }

  // Verificar permisos si se especifican
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requireAll 
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions)
    
    if (!hasRequiredPermissions) {
      return fallback || null
    }
  }

  // Si pasa todas las verificaciones, mostrar el contenido
  return children
}

/**
 * Componente para mostrar contenido basado en permisos específicos
 */
export const PermissionGated = ({ 
  children, 
  permissions = [], 
  requireAll = false, 
  fallback = null 
}) => {
  return (
    <RoleProtectedRoute 
      requiredPermissions={permissions} 
      requireAll={requireAll} 
      fallback={fallback}
    >
      {children}
    </RoleProtectedRoute>
  )
}

export default RoleProtectedRoute
