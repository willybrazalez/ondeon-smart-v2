import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2,
  FileText,
  Calendar,
  Radio,
  Users,
  UserCog,
  Tag
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Página de Gestión de Empresa
 * Centro de control para administrar todos los aspectos de la empresa
 */
const GroupManagementPage = () => {
  const navigate = useNavigate();

  // Datos de los módulos de gestión
  const managementModules = [
    {
      id: 'contenidos',
      title: 'Gestión de Contenidos',
      description: 'Administra y organiza todos los contenidos multimedia',
      icon: FileText,
      color: 'blue',
      onClick: () => navigate('/admin/contenidos')
    },
    {
      id: 'programaciones',
      title: 'Gestión de Programaciones',
      description: 'Configura y programa la emisión de contenidos',
      icon: Calendar,
      color: 'green',
      onClick: () => navigate('/admin/programaciones')
    },
    {
      id: 'canales',
      title: 'Gestión de Canales',
      description: 'Administra canales de emisión y distribución',
      icon: Radio,
      color: 'purple',
      onClick: () => navigate('/admin/canales')
    },
    {
      id: 'usuarios-grupos',
      title: 'Gestión de Usuarios y Grupos',
      description: 'Crea y administra grupos de usuarios',
      icon: Users,
      color: 'orange',
      onClick: () => navigate('/admin/usuarios-grupos')
    },
    {
      id: 'empresas',
      title: 'Gestión de Empresas',
      description: 'Administra empresas y visualiza sus relaciones',
      icon: Building2,
      color: 'red',
      onClick: () => navigate('/admin/empresas')
    },
    {
      id: 'marcas',
      title: 'Gestión de Marcas',
      description: 'Administra marcas y sus relaciones con grupos, empresas, contenidos y canales',
      icon: Tag,
      color: 'pink',
      onClick: () => navigate('/admin/marcas')
    }
  ];

  // Colores según el tipo
  const colorClasses = {
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      hover: 'hover:bg-blue-500/20',
      border: 'border-blue-500/20'
    },
    green: {
      bg: 'bg-green-500/10',
      text: 'text-green-500',
      hover: 'hover:bg-green-500/20',
      border: 'border-green-500/20'
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      hover: 'hover:bg-purple-500/20',
      border: 'border-purple-500/20'
    },
    orange: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-500',
      hover: 'hover:bg-orange-500/20',
      border: 'border-orange-500/20'
    },
    red: {
      bg: 'bg-red-500/10',
      text: 'text-red-500',
      hover: 'hover:bg-red-500/20',
      border: 'border-red-500/20'
    },
    pink: {
      bg: 'bg-pink-500/10',
      text: 'text-pink-500',
      hover: 'hover:bg-pink-500/20',
      border: 'border-pink-500/20'
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gestión de Empresa</h1>
              <p className="text-muted-foreground mt-1">
                Centro de control y administración completa
              </p>
            </div>
          </div>
        </div>

        {/* Grid de módulos de gestión */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {managementModules.map((module, index) => {
            const Icon = module.icon;
            const colors = colorClasses[module.color];

            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`p-6 hover:shadow-lg transition-all duration-200`}>
                  {/* Header del módulo */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center`}>
                      <Icon className={`w-7 h-7 ${colors.text}`} />
                    </div>
                  </div>

                  {/* Título y descripción */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-1">{module.title}</h3>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>

                  {/* Botón principal */}
                  <Button 
                    className={`w-full ${colors.bg} ${colors.text} hover:${colors.bg}`}
                    variant="secondary"
                    onClick={module.onClick}
                  >
                    Abrir {module.title}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
};

export default GroupManagementPage;
