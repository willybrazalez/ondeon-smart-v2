import React from 'react'
import { useRole } from '@/hooks/useRole'
import { 
  Home, 
  Radio, 
  Settings, 
  Users, 
  BarChart3, 
  FileText, 
  Shield,
  Music,
  Heart,
  User
} from 'lucide-react'

/**
 * Componente que genera elementos de navegación basados en el rol del usuario
 */
export const RoleBasedNavigation = () => {
  const { userRole, hasPermission, uiConfig } = useRole()

  // Definir todos los elementos de navegación posibles
  const allNavItems = [
    {
      path: '/',
      label: 'Reproductor',
      icon: Radio,
      permission: null, // Disponible para todos
      roles: [1, 2, 3]
    },
    {
      path: '/channels',
      label: 'Canales',
      icon: Music,
      permission: 'canManageChannels',
      roles: [1, 2]
    },
    {
      path: '/users',
      label: 'Usuarios',
      icon: Users,
      permission: 'canManageUsers',
      roles: [1]
    },
    {
      path: '/analytics',
      label: 'Analíticas',
      icon: BarChart3,
      permission: 'canViewAnalytics',
      roles: [1, 2]
    },
    {
      path: '/reports',
      label: 'Reportes',
      icon: FileText,
      permission: 'canViewReports',
      roles: [1, 2]
    },
    {
      path: '/settings',
      label: 'Configuración',
      icon: Settings,
      permission: 'canModifySettings',
      roles: [1, 2]
    },
    {
      path: '/admin',
      label: 'Administración',
      icon: Shield,
      permission: 'showAdminPanel',
      roles: [1]
    },
    {
      path: '/favorites',
      label: 'Favoritos',
      icon: Heart,
      permission: null,
      roles: [3] // Solo para usuarios regulares
    },
    {
      path: '/profile',
      label: 'Perfil',
      icon: User,
      permission: null,
      roles: [1, 2, 3] // Disponible para todos
    }
  ]

  // Filtrar elementos de navegación según el rol y permisos
  const getFilteredNavItems = () => {
    if (!userRole) return []

    return allNavItems.filter(item => {
      // Verificar si el rol está permitido
      if (!item.roles.includes(userRole)) {
        return false
      }

      // Verificar permisos específicos si se requieren
      if (item.permission && !hasPermission(item.permission)) {
        return false
      }

      return true
    })
  }

  const navItems = getFilteredNavItems()

  return {
    navItems,
    uiConfig
  }
}

/**
 * Hook para obtener elementos de navegación filtrados por rol
 */
export const useRoleBasedNavigation = () => {
  return RoleBasedNavigation()
}

export default RoleBasedNavigation
