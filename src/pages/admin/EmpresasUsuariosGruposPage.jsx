import React, { useState, useEffect } from 'react';
import { Building2, Users, UserCheck, ChevronDown, ChevronRight, Search } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

/**
 * Página de Gestión de Usuarios, Grupos y Empresas
 * Vista informativa de todas las empresas asignadas al admin
 */
const EmpresasUsuariosGruposPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState([]);
  const [expandedEmpresa, setExpandedEmpresa] = useState(null);
  const [expandedGrupos, setExpandedGrupos] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userId = user?.id || user?.usuario_id || user?.user_id;

      // 1. Obtener marcas asignadas al admin
      const { data: asignacionesMarcas, error: errorAsig } = await supabase
        .from('admin_asignaciones')
        .select('marca_id')
        .eq('admin_id', userId);

      if (errorAsig) throw errorAsig;

      const marcasIds = (asignacionesMarcas || []).map(a => a.marca_id).filter(Boolean);

      if (marcasIds.length === 0) {
        logger.warn('⚠️ Admin sin marcas asignadas');
        setEmpresas([]);
        setLoading(false);
        return;
      }

      // 2. Obtener empresas de esas marcas
      const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
        .from('marca_empresas')
        .select('empresa_id')
        .in('marca_id', marcasIds);

      if (errorMarcaEmpresas) throw errorMarcaEmpresas;

      const empresaIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);

      if (empresaIds.length === 0) {
        logger.warn('⚠️ Las marcas del admin no tienen empresas asignadas');
        setEmpresas([]);
        setLoading(false);
        return;
      }

      logger.dev(`✅ Admin tiene ${marcasIds.length} marca(s) con ${empresaIds.length} empresa(s)`);

      // 2. Obtener datos completos de las empresas
      const { data: empresasData, error: errorEmpresas } = await supabase
        .from('empresas')
        .select('*')
        .in('id', empresaIds)
        .order('razon_social');

      if (errorEmpresas) throw errorEmpresas;

      // 3. Para cada empresa, obtener usuarios y grupos
      const empresasCompletas = await Promise.all(
        (empresasData || []).map(async (empresa) => {
          // Obtener usuarios de la empresa
          const { data: usuarios } = await supabase
            .from('usuarios')
            .select('id, username, nombre, apellidos, email, rol_id')
            .eq('empresa_id', empresa.id)
            .order('username');

          // Obtener grupos de la empresa
          const { data: grupos } = await supabase
            .from('grupos')
            .select('id, nombre, descripcion')
            .eq('empresa_id', empresa.id)
            .order('nombre');

          // Para cada grupo, obtener sus usuarios
          const gruposConUsuarios = await Promise.all(
            (grupos || []).map(async (grupo) => {
              const { data: grupoUsuarios } = await supabase
                .from('grupo_usuarios')
                .select(`
                  usuario_id,
                  usuarios:usuario_id (
                    id, username, nombre, apellidos, email
                  )
                `)
                .eq('grupo_id', grupo.id);

              return {
                ...grupo,
                usuarios: (grupoUsuarios || []).map(gu => gu.usuarios).filter(Boolean)
              };
            })
          );

          return {
            ...empresa,
            usuarios: usuarios || [],
            grupos: gruposConUsuarios || []
          };
        })
      );

      logger.dev(`✅ ${empresasCompletas.length} empresas cargadas con usuarios y grupos`);
      setEmpresas(empresasCompletas);
    } catch (error) {
      logger.error('❌ Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmpresa = (empresaId) => {
    setExpandedEmpresa(expandedEmpresa === empresaId ? null : empresaId);
  };

  const toggleGrupo = (grupoId) => {
    const newExpanded = new Set(expandedGrupos);
    if (newExpanded.has(grupoId)) {
      newExpanded.delete(grupoId);
    } else {
      newExpanded.add(grupoId);
    }
    setExpandedGrupos(newExpanded);
  };

  const filteredEmpresas = empresas.filter(e => 
    !searchQuery || 
    e.razon_social?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.usuarios?.some(u => 
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Calcular totales
  const totalUsuarios = empresas.reduce((sum, e) => sum + (e.usuarios?.length || 0), 0);
  const totalGrupos = empresas.reduce((sum, e) => sum + (e.grupos?.length || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gestión Usuarios, Grupos y Empresas
          </h1>
          <p className="text-muted-foreground mt-1">
            Vista consolidada de todas las empresas que gestionas
          </p>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{empresas.length}</p>
                <p className="text-sm text-muted-foreground">Empresas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{totalUsuarios}</p>
                <p className="text-sm text-muted-foreground">Usuarios Totales</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{totalGrupos}</p>
                <p className="text-sm text-muted-foreground">Grupos Totales</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar empresas o usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background"
          />
        </div>

        {/* Lista de empresas */}
        {loading ? (
          <Card className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando información...</p>
          </Card>
        ) : filteredEmpresas.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No hay empresas asignadas</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEmpresas.map((empresa) => {
              const isExpanded = expandedEmpresa === empresa.id;
              
              return (
                <Card key={empresa.id} className="overflow-hidden">
                  {/* Header de empresa */}
                  <button
                    onClick={() => toggleEmpresa(empresa.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="text-left">
                        <h3 className="font-semibold text-lg">{empresa.razon_social || empresa.nombre || 'Sin nombre'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {empresa.usuarios?.length || 0} usuarios · {empresa.grupos?.length || 0} grupos
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {/* Contenido expandido */}
                  {isExpanded && (
                    <div className="border-t border-border bg-black/2 dark:bg-white/2">
                      {/* Info de la empresa */}
                      <div className="p-4 space-y-2 text-sm border-b border-border">
                        {empresa.cif && (
                          <p><span className="text-muted-foreground">CIF:</span> {empresa.cif}</p>
                        )}
                        {empresa.direccion && (
                          <p><span className="text-muted-foreground">Dirección:</span> {empresa.direccion}</p>
                        )}
                        {(empresa.localidad || empresa.provincia) && (
                          <p><span className="text-muted-foreground">Ubicación:</span> {[empresa.localidad, empresa.provincia].filter(Boolean).join(', ')}</p>
                        )}
                      </div>

                      {/* Grupos */}
                      <div className="p-4 space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          Grupos ({empresa.grupos?.length || 0})
                        </h4>
                        {empresa.grupos?.length > 0 ? (
                          <div className="space-y-2">
                            {empresa.grupos.map((grupo) => {
                              const isGrupoExpanded = expandedGrupos.has(grupo.id);
                              
                              return (
                                <div key={grupo.id} className="border border-border rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => toggleGrupo(grupo.id)}
                                    className="w-full p-3 flex items-center justify-between bg-black/2 dark:bg-white/2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{grupo.nombre}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ({grupo.usuarios?.length || 0} usuarios)
                                      </span>
                                    </div>
                                    {isGrupoExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                  
                                  {isGrupoExpanded && grupo.usuarios && grupo.usuarios.length > 0 && (
                                    <div className="p-3 space-y-2">
                                      {grupo.usuarios.map((usuario) => (
                                        <div 
                                          key={usuario.id}
                                          className="flex items-center gap-2 p-2 rounded bg-background text-sm"
                                        >
                                          <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                          <span className="font-medium">{usuario.username}</span>
                                          {usuario.email && (
                                            <span className="text-muted-foreground text-xs">
                                              ({usuario.email})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No hay grupos creados</p>
                        )}
                      </div>

                      {/* Usuarios sin grupo */}
                      <div className="p-4 border-t border-border space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Todos los Usuarios ({empresa.usuarios?.length || 0})
                        </h4>
                        {empresa.usuarios && empresa.usuarios.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {empresa.usuarios.map((usuario) => (
                              <div 
                                key={usuario.id}
                                className="p-3 rounded-lg border border-border bg-background"
                              >
                                <p className="font-medium text-sm">{usuario.username}</p>
                                {usuario.nombre && (
                                  <p className="text-xs text-muted-foreground">
                                    {[usuario.nombre, usuario.apellidos].filter(Boolean).join(' ')}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground truncate">{usuario.email}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No hay usuarios</p>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default EmpresasUsuariosGruposPage;

