import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRole } from '@/hooks/useRole'
import { RoleBadge } from '@/components/RoleBadge'
import { Button } from '@/components/ui/button'
import { 
  Bell, 
  Settings, 
  User, 
  LogOut,
  Shield,
  Activity
} from 'lucide-react'
import { PermissionGated } from '@/components/RoleProtectedRoute'
import logger from '@/lib/logger';

/**
 * Componente de header que se adapta según el rol del usuario
 */
export const RoleBasedHeader = ({ title = "Ondeon" }) => {
  const { user, signOut } = useAuth()
  const { roleName, uiConfig, hasPermission } = useRole()

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      logger.error('Error al cerrar sesión:', error)
    }
  }

  const getUserDisplayName = () => {
    if (!user) return 'Usuario'
    
    // Para usuarios legacy
    if (user.username) return user.username
    if (user.nombre_usuario) return user.nombre_usuario
    if (user.nombre) return user.nombre
    
    // Para usuarios de Supabase
    if (user.email) return user.email.split('@')[0]
    
    return 'Usuario'
  }

  return (
    <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Título y logo */}
        <div className="flex items-center space-x-4">
          <img 
            src="/assets/icono-ondeon.png" 
            alt="Ondeon" 
            className="h-8 w-8"
            onError={(e) => {
              console.error('Error al cargar el logo en RoleBasedHeader');
              e.target.style.display = 'none';
            }}
          />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h1>
        </div>

        {/* Información del usuario y acciones */}
        <div className="flex items-center space-x-4">
          {/* Notificaciones - Solo para managers y admins */}
          <PermissionGated permissions={['canViewAnalytics']}>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs"></span>
            </Button>
          </PermissionGated>

          {/* Estado del sistema - Solo para admins */}
          <PermissionGated permissions={['showSystemSettings']}>
            <Button variant="ghost" size="icon">
              <Activity className="h-5 w-5 text-green-500" />
            </Button>
          </PermissionGated>

          {/* Configuración - Solo para managers y admins */}
          <PermissionGated permissions={['canModifySettings']}>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </PermissionGated>

          {/* Panel de admin - Solo para admins */}
          <PermissionGated permissions={['showAdminPanel']}>
            <Button variant="ghost" size="icon">
              <Shield className="h-5 w-5" />
            </Button>
          </PermissionGated>

          {/* Información del usuario */}
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {getUserDisplayName()}
              </span>
            </div>
            
            {/* Badge del rol */}
            <RoleBadge />
          </div>

          {/* Botón de logout */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Información adicional para admins */}
      <PermissionGated permissions={['showAdminPanel']}>
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">
              Modo Administrador - Tienes acceso completo al sistema
            </span>
          </div>
        </div>
      </PermissionGated>

      {/* Información adicional para managers */}
      <PermissionGated permissions={['showAdvancedControls']}>
        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-700 dark:text-orange-300">
              Modo Manager - Puedes gestionar canales y contenido
            </span>
          </div>
        </div>
      </PermissionGated>
    </header>
  )
}

export default RoleBasedHeader
