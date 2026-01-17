import React, { useState } from 'react';
import { Building2, Users, Radio, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useAdminEmpresas } from '@/contexts/AdminEmpresaContext';
import { Button } from '@/components/ui/button';

/**
 * Sidebar para gestionar empresas asignadas al administrador
 * Permite filtrar por empresa o ver todas
 */
export function AdminEmpresasSidebar({ isOpen, onClose }) {
  const {
    empresasAsignadas,
    loadingEmpresas,
    empresaSeleccionada,
    estadisticasPorEmpresa,
    seleccionarEmpresa,
    verTodasEmpresas,
    esModoTodasEmpresas
  } = useAdminEmpresas();

  const [expandedEmpresa, setExpandedEmpresa] = useState(null);

  const toggleExpanded = (empresaId) => {
    setExpandedEmpresa(expandedEmpresa === empresaId ? null : empresaId);
  };

  return (
    <>
      {/* Overlay para móvil (solo visible cuando está abierto en móvil) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar - Siempre visible en desktop */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen
        w-80 bg-background border-r border-border
        z-50 lg:z-0
        flex flex-col
        transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Mis Empresas</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="lg:hidden"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Loading */}
        {loadingEmpresas && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Cargando empresas...</p>
            </div>
          </div>
        )}

        {/* Sin empresas */}
        {!loadingEmpresas && empresasAsignadas.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No tienes empresas asignadas</p>
            </div>
          </div>
        )}

        {/* Lista de empresas */}
        {!loadingEmpresas && empresasAsignadas.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            {/* Opción: Ver todas */}
            <button
              onClick={verTodasEmpresas}
              className={`
                w-full p-4 text-left border-b border-border
                transition-colors
                ${esModoTodasEmpresas 
                  ? 'bg-primary/10 border-l-4 border-l-primary' 
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className={`w-5 h-5 ${esModoTodasEmpresas ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`font-medium ${esModoTodasEmpresas ? 'text-primary' : ''}`}>
                    Todas las Empresas
                  </span>
                </div>
                {esModoTodasEmpresas && (
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {empresasAsignadas.length} empresa{empresasAsignadas.length !== 1 ? 's' : ''} asignada{empresasAsignadas.length !== 1 ? 's' : ''}
              </div>
            </button>

            {/* Empresas individuales */}
            {empresasAsignadas.map((empresa) => {
              const stats = estadisticasPorEmpresa[empresa.id] || {};
              const isSelected = empresaSeleccionada === empresa.id;
              const isExpanded = expandedEmpresa === empresa.id;

              return (
                <div
                  key={empresa.id}
                  className={`
                    border-b border-border
                    ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''}
                  `}
                >
                  {/* Empresa header */}
                  <button
                    onClick={() => seleccionarEmpresa(empresa.id)}
                    className={`
                      w-full p-4 text-left
                      transition-colors
                      ${!isSelected && 'hover:bg-black/5 dark:hover:bg-white/5'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Building2 className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`font-medium truncate ${isSelected ? 'text-primary' : ''}`}>
                          {empresa.razon_social || empresa.nombre || 'Sin nombre'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(empresa.id);
                          }}
                          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Estadísticas rápidas */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{stats.usuarios || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{stats.grupos || 0} grupos</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Radio className="w-3 h-3 text-green-500" />
                        <span>{stats.online || 0}</span>
                      </div>
                    </div>
                  </button>

                  {/* Detalles expandidos */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 bg-black/2 dark:bg-white/2">
                      {/* Info de empresa */}
                      {empresa.cif && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">CIF: </span>
                          <span className="font-mono">{empresa.cif}</span>
                        </div>
                      )}
                      {empresa.direccion && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Dirección: </span>
                          <span>{empresa.direccion}</span>
                        </div>
                      )}
                      {(empresa.localidad || empresa.provincia) && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Ubicación: </span>
                          <span>{[empresa.localidad, empresa.provincia].filter(Boolean).join(', ')}</span>
                        </div>
                      )}

                      {/* Estadísticas detalladas */}
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Usuarios
                          </span>
                          <span className="font-semibold">{stats.usuarios || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Grupos
                          </span>
                          <span className="font-semibold">{stats.grupos || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-green-500 flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            Online
                          </span>
                          <span className="font-semibold text-green-500">{stats.online || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer con info */}
        {!loadingEmpresas && empresasAsignadas.length > 0 && (
          <div className="p-4 border-t border-border bg-black/2 dark:bg-white/2">
            <div className="text-xs text-muted-foreground text-center">
              {esModoTodasEmpresas ? (
                <span>Viendo recursos de <strong>todas las empresas</strong></span>
              ) : (
                <span>Filtrando por <strong>1 empresa</strong></span>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export default AdminEmpresasSidebar;

