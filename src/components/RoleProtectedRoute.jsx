import React from 'react'
import { useRole } from '@/hooks/useRole'

/**
 * Componente para proteger rutas basado en roles
 */
export const RoleProtectedRoute = ({ 
  children, 
  requiredRole = null, 
  requiredPermissions = [], 
  requireAll = false,
  fallback = null 
}) => {
  const { userRole, hasPermission, hasAnyPermission, hasAllPermissions, ROLES } = useRole()

  // Si no hay usuario autenticado, no mostrar nada
  if (!userRole) {
    return fallback || null
  }

  // Verificar rol específico si se requiere
  if (requiredRole !== null && userRole !== requiredRole) {
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
 * Componente para mostrar contenido solo a administradores
 */
export const AdminOnly = ({ children, fallback = null }) => {
  return (
    <RoleProtectedRoute requiredRole={3} fallback={fallback}>
      {children}
    </RoleProtectedRoute>
  )
}

/**
 * Componente para mostrar contenido solo a gestores y administradores
 */
export const GestorAndAbove = ({ children, fallback = null }) => {
  const { isGestor, isAdministrador } = useRole()
  
  if (!isGestor && !isAdministrador) {
    return fallback || null
  }
  
  return children
}

/**
 * Componente para mostrar contenido solo a usuarios básicos
 */
export const BasicoOnly = ({ children, fallback = null }) => {
  return (
    <RoleProtectedRoute requiredRole={1} fallback={fallback}>
      {children}
    </RoleProtectedRoute>
  )
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
