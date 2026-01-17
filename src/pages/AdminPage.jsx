import React from 'react'
import { useRole } from '@/hooks/useRole'
import { RoleInfo } from '@/components/RoleBadge'
import { GestorAndAbove, PermissionGated } from '@/components/RoleProtectedRoute'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Settings, 
  BarChart3, 
  Shield, 
  Database,
  Activity,
  AlertTriangle
} from 'lucide-react'

/**
 * Página de administración - Solo accesible para administradores
 */
export default function AdminPage() {
  const { roleName, permissions, isAdministrador, isGestor } = useRole()

  return (
    <GestorAndAbove fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">
            Esta página está restringida solo para gestores y administradores.
          </p>
          <p className="text-sm text-gray-500">
            Tu rol actual: <span className="font-medium">{roleName}</span>
          </p>
        </Card>
      </div>
    }>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Panel de Administración
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gestión completa del sistema Ondeon
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <span className="text-sm font-medium text-red-600">
              Panel de Gestión - {roleName}
            </span>
          </div>
        </div>

        {/* Información del rol */}
        <RoleInfo className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" />

        {/* Grid de funcionalidades */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Gestión de usuarios */}
          <PermissionGated permissions={['canManageUsers']}>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-8 w-8 text-blue-500" />
                <h3 className="text-lg font-semibold">Usuarios</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Gestionar usuarios, roles y permisos del sistema
              </p>
              <Button className="w-full">
                Gestionar Usuarios
              </Button>
            </Card>
          </PermissionGated>

          {/* Configuración del sistema */}
          <PermissionGated permissions={['canManageSystem']}>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="h-8 w-8 text-green-500" />
                <h3 className="text-lg font-semibold">Sistema</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Configuración avanzada del sistema y parámetros globales
              </p>
              <Button className="w-full">
                Configurar Sistema
              </Button>
            </Card>
          </PermissionGated>

          {/* Analíticas avanzadas */}
          <PermissionGated permissions={['canViewAnalytics']}>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <h3 className="text-lg font-semibold">Analíticas</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Reportes detallados y métricas del sistema
              </p>
              <Button className="w-full">
                Ver Analíticas
              </Button>
            </Card>
          </PermissionGated>

          {/* Base de datos */}
          <PermissionGated permissions={['canManageSystem']}>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Database className="h-8 w-8 text-orange-500" />
                <h3 className="text-lg font-semibold">Base de Datos</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Gestión y mantenimiento de la base de datos
              </p>
              <Button className="w-full">
                Gestionar BD
              </Button>
            </Card>
          </PermissionGated>

          {/* Monitoreo del sistema */}
          <PermissionGated permissions={['canManageSystem']}>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="h-8 w-8 text-red-500" />
                <h3 className="text-lg font-semibold">Monitoreo</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Estado del sistema y logs en tiempo real
              </p>
              <Button className="w-full">
                Ver Estado
              </Button>
            </Card>
          </PermissionGated>

          {/* Seguridad */}
          <PermissionGated permissions={['canManageSystem']}>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-8 w-8 text-indigo-500" />
                <h3 className="text-lg font-semibold">Seguridad</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Configuración de seguridad y auditoría
              </p>
              <Button className="w-full">
                Configurar Seguridad
              </Button>
            </Card>
          </PermissionGated>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">150</div>
            <div className="text-sm text-gray-600">Usuarios Activos</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">25</div>
            <div className="text-sm text-gray-600">Canales</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">1,250</div>
            <div className="text-sm text-gray-600">Canciones</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">99.9%</div>
            <div className="text-sm text-gray-600">Uptime</div>
          </Card>
        </div>

        {/* Información de permisos */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Permisos Activos</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(permissions)
              .filter(([_, value]) => value === true)
              .map(([permission, _]) => (
                <div 
                  key={permission} 
                  className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">
                    {permission.replace('can', '').replace('show', '')}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </GestorAndAbove>
  )
}
