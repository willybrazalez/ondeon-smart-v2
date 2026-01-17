import React from 'react';
import { motion } from 'framer-motion';
import { UserCog } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';

/**
 * Página de Gestión de Usuarios
 * Administra usuarios, permisos y roles
 */
const UsersManagementPage = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
            <UserCog className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
            <p className="text-muted-foreground mt-1">
              Administra usuarios, permisos y roles
            </p>
          </div>
        </div>

        {/* Contenido placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-12">
            <div className="text-center">
              <UserCog className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">En Desarrollo</h2>
              <p className="text-muted-foreground">
                Esta sección estará disponible próximamente
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
};

export default UsersManagementPage;

