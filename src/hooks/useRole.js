import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Definición de roles y sus permisos
export const ROLES = {
  BASICO: 1,
  GESTOR: 2,
  ADMINISTRADOR: 3
}

// Configuración de permisos por rol
const ROLE_PERMISSIONS = {
  [ROLES.BASICO]: {
    // Básico (rol_id = 1) - Acceso limitado
    canAccessPlayer: true,
    canAccessChannels: true,
    canAccessContent: true,
    canAccessHistory: true,
    canAccessSupport: true,
    // Restricciones específicas
    canCreateImmediateAds: false,
    canAccessSettingsWheel: false,
    canAccessDrafts: false,
    // Permisos generales
    canManageUsers: false,
    canManageSystem: false,
    canViewAnalytics: false,
    canDeleteContent: false,
    // Admin panel
    canManageAIAds: false,
    // UI específica
    showAdminPanel: false,
    showAdvancedControls: false,
    showSystemSettings: false
  },
  [ROLES.GESTOR]: {
    // Gestor (rol_id = 2) - Dashboard propio para gestores
    canAccessPlayer: true,
    canAccessChannels: true,
    canAccessContent: true,
    canAccessHistory: true,
    canAccessSupport: true,
    canCreateImmediateAds: true, // ✅ Botón "Crear Anuncio" en el reproductor
    canAccessSettingsWheel: true,
    canAccessDrafts: true,
    // Permisos de Gestor
    canAccessGestorDashboard: true, // ✅ Acceso al dashboard de gestores
    canManageSubscription: true, // ✅ Ver/gestionar su suscripción
    canManageOwnAds: true, // ✅ Gestionar sus propios anuncios
    // Permisos generales
    canManageUsers: false, // ❌ No puede gestionar otros usuarios
    canManageChannels: false, // ❌ No puede gestionar canales
    canManageContent: false, // ❌ No puede gestionar contenido global
    canManageSystem: false, // ❌ No puede gestionar sistema
    canViewAnalytics: true, // ✅ Ver sus propias analíticas
    canViewReports: true, // ✅ Ver sus propios reportes
    canDeleteContent: false, // ❌ No puede eliminar contenido global
    // Admin panel
    canManageAIAds: false, // ❌ Sin acceso al panel de anuncios IA del admin
    // UI específica
    showAdminPanel: false, // Sin acceso al Dashboard admin
    showAdminPanelInMenu: false, // No mostrar en menú de navegación
    showGestorDashboard: true, // ✅ Mostrar dashboard de gestor
    showAdvancedControls: true,
    showSystemSettings: false
  },
  [ROLES.ADMINISTRADOR]: {
    // Administrador (rol_id = 3) - Dashboard solo en menú de configuración
    canAccessPlayer: true,
    canAccessChannels: true,
    canAccessContent: true,
    canAccessHistory: true,
    canAccessSupport: true,
    canCreateImmediateAds: false, // ❌ No tiene acceso al botón del reproductor
    canAccessSettingsWheel: true,
    canAccessDrafts: true,
    // Permisos generales
    canManageUsers: true,
    canManageChannels: true,
    canManageContent: true,
    canManageSystem: true,
    canViewAnalytics: true,
    canViewReports: true,
    canDeleteContent: true,
    // Admin panel
    canManageAIAds: true, // ✅ Acceso al panel de anuncios IA en admin
    // UI específica
    showAdminPanel: true, // Necesario para acceder a la ruta
    showAdminPanelInMenu: false, // Oculto del menú de navegación principal
    showAdminPanelInSettings: true, // Mostrar en engranaje
    showAdvancedControls: true,
    showSystemSettings: true
  }
}

// Configuración de UI por rol
const ROLE_UI_CONFIG = {
  [ROLES.BASICO]: {
    theme: 'basico',
    primaryColor: '#2563eb', // azul
    showBadge: false,
    badgeText: 'Básico',
    badgeColor: 'bg-blue-500',
    sidebarItems: ['player', 'channels', 'content', 'history', 'support'],
    headerActions: ['profile']
  },
  [ROLES.GESTOR]: {
    theme: 'gestor',
    primaryColor: '#ea580c', // naranja
    showBadge: false,
    badgeText: 'Gestor',
    badgeColor: 'bg-orange-500',
    sidebarItems: ['player', 'channels', 'content', 'ads', 'history', 'support', 'admin'],
    headerActions: ['notifications', 'settings', 'profile']
  },
  [ROLES.ADMINISTRADOR]: {
    theme: 'administrador',
    primaryColor: '#dc2626', // rojo
    showBadge: false,
    badgeText: 'Admin',
    badgeColor: 'bg-red-500',
    sidebarItems: ['player', 'channels', 'content', 'ads', 'history', 'support', 'admin'],
    headerActions: ['notifications', 'settings', 'profile', 'system-status']
  }
}

/**
 * Hook personalizado para gestionar roles y permisos
 */
export const useRole = () => {
  const { user, isLegacyUser, userRole: contextUserRole } = useAuth()

  // Obtener el rol del usuario (preferir el del contexto)
  const userRole = useMemo(() => {
    if (!user) return null
    
    // Si el contexto ya tiene el rol, usarlo
    if (contextUserRole !== null) {
      return contextUserRole
    }
    
    // Para usuarios legacy, usar rol del objeto user
    if (isLegacyUser) {
      return user.rol_id || ROLES.BASICO // Legacy sin rol = Básico
    }
    
    // 🔑 CRÍTICO: Para usuarios de Supabase Auth, NO asumir BASICO
    // Devolver null mientras el rol se está cargando desde la BD
    // Esto evita el "flash" de /solo-desktop para usuarios Gestor
    return null
  }, [user, isLegacyUser, contextUserRole])

  // Obtener permisos del rol actual
  const permissions = useMemo(() => {
    if (!userRole) return ROLE_PERMISSIONS[ROLES.BASICO]
    return ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS[ROLES.BASICO]
  }, [userRole])

  // Obtener configuración de UI del rol actual
  const uiConfig = useMemo(() => {
    if (!userRole) return ROLE_UI_CONFIG[ROLES.BASICO]
    return ROLE_UI_CONFIG[userRole] || ROLE_UI_CONFIG[ROLES.BASICO]
  }, [userRole])

  // Funciones de utilidad para verificar permisos
  const hasPermission = (permission) => {
    return permissions[permission] === true
  }

  const hasAnyPermission = (permissionList) => {
    return permissionList.some(permission => hasPermission(permission))
  }

  const hasAllPermissions = (permissionList) => {
    return permissionList.every(permission => hasPermission(permission))
  }

  // Verificar si es un rol específico
  const isBasico = userRole === ROLES.BASICO
  const isGestor = userRole === ROLES.GESTOR
  const isAdministrador = userRole === ROLES.ADMINISTRADOR

  // Obtener nombre del rol
  const getRoleName = () => {
    switch (userRole) {
      case ROLES.BASICO:
        return 'Básico'
      case ROLES.GESTOR:
        return 'Gestor'
      case ROLES.ADMINISTRADOR:
        return 'Administrador'
      default:
        return 'Básico'
    }
  }

  return {
    // Información del rol
    userRole,
    roleName: getRoleName(),
    
    // Verificaciones de rol
    isBasico,
    isGestor,
    isAdministrador,
    
    // Permisos
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Configuración de UI
    uiConfig,
    
    // Constantes
    ROLES
  }
}

export default useRole
