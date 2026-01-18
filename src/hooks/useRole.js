import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Configuración de permisos del usuario
 * Sistema simplificado: todos los usuarios autenticados tienen los mismos permisos
 */
const USER_PERMISSIONS = {
  // Acceso a funcionalidades principales
  canAccessPlayer: true,
  canAccessChannels: true,
  canAccessContent: true,
  canAccessHistory: true,
  
  // Funcionalidades de gestión
  canCreateImmediateAds: true,
  canAccessSettingsWheel: true,
  canAccessDrafts: true,
  canAccessGestorDashboard: true,
  canManageSubscription: true,
  canManageOwnAds: true,
  canViewAnalytics: true,
  canViewReports: true,
  
  // UI
  showGestorDashboard: true,
  showAdvancedControls: true
}

/**
 * Configuración de UI del usuario
 */
const USER_UI_CONFIG = {
  theme: 'default',
  primaryColor: '#A2D9F7', // azul Ondeón
  showBadge: false,
  sidebarItems: ['player', 'channels', 'content', 'ads', 'history'],
  headerActions: ['notifications', 'settings', 'profile']
}

/**
 * Hook para gestionar permisos del usuario
 * Sistema simplificado sin múltiples roles
 */
export const useRole = () => {
  const { user } = useAuth()

  // Permisos del usuario (siempre los mismos si está autenticado)
  const permissions = useMemo(() => {
    if (!user) return {}
    return USER_PERMISSIONS
  }, [user])

  // Configuración de UI
  const uiConfig = useMemo(() => {
    return USER_UI_CONFIG
  }, [])

  // Verificar si tiene un permiso específico
  const hasPermission = (permission) => {
    return permissions[permission] === true
  }

  const hasAnyPermission = (permissionList) => {
    return permissionList.some(permission => hasPermission(permission))
  }

  const hasAllPermissions = (permissionList) => {
    return permissionList.every(permission => hasPermission(permission))
  }

  return {
    // Permisos
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Configuración de UI
    uiConfig,
    
    // Para compatibilidad (se puede eliminar después de limpiar App.jsx)
    userRole: user ? 2 : null,
    roleName: 'Usuario',
    isGestor: !!user,
    ROLES: { GESTOR: 2 }
  }
}

export default useRole
