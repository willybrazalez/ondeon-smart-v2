import React from 'react'
import { useRole } from '@/hooks/useRole'

/**
 * Componente para mostrar el badge del rol del usuario
 */
export const RoleBadge = ({ className = '', showText = true }) => {
  const { roleName, uiConfig, userRole } = useRole()

  if (!userRole || !uiConfig.showBadge) {
    return null
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${uiConfig.badgeColor} ${className}`}>
      {showText && (
        <span>{uiConfig.badgeText}</span>
      )}
    </div>
  )
}

/**
 * Componente para mostrar información completa del rol
 */
export const RoleInfo = ({ className = '' }) => {
  const { roleName, userRole, permissions, uiConfig } = useRole()

  if (!userRole) {
    return null
  }

  return (
    <div className={`p-3 rounded-lg border ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <RoleBadge />
        <span className="font-medium">{roleName}</span>
      </div>
      
      <div className="text-sm text-gray-600">
        <p>Permisos activos:</p>
        <ul className="mt-1 space-y-1">
          {Object.entries(permissions)
            .filter(([_, value]) => value === true)
            .map(([permission, _]) => (
              <li key={permission} className="flex items-center gap-1">
                <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                <span className="text-xs">{getPermissionLabel(permission)}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

// Helper para obtener etiquetas legibles de permisos
const getPermissionLabel = (permission) => {
  const labels = {
    canManageUsers: 'Gestionar usuarios',
    canManageChannels: 'Gestionar canales',
    canManagePlaylists: 'Gestionar playlists',
    canViewAnalytics: 'Ver analíticas',
    canManageSystem: 'Gestionar sistema',
    canAccessAllChannels: 'Acceso a todos los canales',
    canModifySettings: 'Modificar configuración',
    canViewReports: 'Ver reportes',
    canManageContent: 'Gestionar contenido',
    canDeleteContent: 'Eliminar contenido',
    showAdminPanel: 'Panel de administración',
    showAdvancedControls: 'Controles avanzados',
    showSystemSettings: 'Configuración del sistema'
  }
  
  return labels[permission] || permission
}

export default RoleBadge
