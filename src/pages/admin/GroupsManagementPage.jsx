import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users,
  ArrowLeft,
  Search,
  RefreshCw,
  UserCircle,
  Mail,
  Building2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * Página de Gestión de Grupos
 * Organiza usuarios en grupos y equipos
 */
const GroupsManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Obtener empresas del admin
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);

  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user?.id) return;

      try {
        // 1️⃣ Obtener marcas asignadas al admin
        const { data: asignacionesMarcas, error } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', user.id);

        if (error) throw error;

        const marcasIds = (asignacionesMarcas || []).map(a => a.marca_id).filter(Boolean);
        
        if (marcasIds.length === 0) {
          console.warn('⚠️ Admin sin marcas asignadas');
          setAdminEmpresaIds([]);
          return;
        }

        // 2️⃣ Obtener empresas de esas marcas
        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select('empresa_id')
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) throw errorMarcaEmpresas;

        const empresaIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        console.log(`✅ Admin tiene ${marcasIds.length} marca(s) con ${empresaIds.length} empresa(s)`);
        setAdminEmpresaIds(empresaIds);
      } catch (error) {
        console.error('Error al obtener marcas y empresas del admin:', error);
      }
    };

    fetchAdminEmpresas();
  }, [user]);

  // Cargar grupos de la empresa
  useEffect(() => {
    if (adminEmpresaIds.length === 0) {
      setLoading(false);
      return;
    }

    const loadGrupos = async () => {
      setLoading(true);
      try {
        // Obtener información de empresas del admin
        const { data: empresasData, error: empresasError } = await supabase
          .from('empresas')
          .select('id, razon_social')
          .in('id', adminEmpresaIds);

        if (empresasError) {
          console.error('Error al cargar empresas:', empresasError);
        }

        const empresasMap = new Map(
          empresasData?.map(e => [
            e.id, 
            {
              ...e,
              nombre: e.razon_social || 'Sin razón social'
            }
          ]) || []
        );

        // Obtener usuarios pertenecientes a las empresas del admin
        const { data: usuariosEmpresa, error: usuariosEmpresaError } = await supabase
                .from('usuarios')
                .select('id, username, email, nombre, apellidos, empresa_id')
          .in('empresa_id', adminEmpresaIds);

        if (usuariosEmpresaError) throw usuariosEmpresaError;

        const usuarioIds = usuariosEmpresa?.map(u => u.id) || [];
        const usuarioMap = new Map((usuariosEmpresa || []).map(u => [u.id, u]));
        const usuarioIdsSet = new Set(usuarioIds);

        // Obtener relaciones grupo-usuario para usuarios del admin
        let grupoUsuarios = [];
        if (usuarioIds.length > 0) {
          const { data: grupoUsuariosData, error: grupoUsuariosError } = await supabase
            .from('grupo_usuarios')
            .select('grupo_id, usuario_id')
            .in('usuario_id', usuarioIds);

          if (grupoUsuariosError) throw grupoUsuariosError;
          grupoUsuarios = grupoUsuariosData || [];
        }

        const gruposDesdeUsuarios = new Set(grupoUsuarios.map(gu => gu.grupo_id));

        // Obtener grupos asociados directamente a las empresas del admin
        let gruposDirectos = [];
        const { data: gruposEmpresas, error: gruposEmpresasError } = await supabase
          .from('grupos')
          .select('*')
          .in('empresa_id', adminEmpresaIds)
          .order('nombre');

        if (gruposEmpresasError && gruposEmpresasError.code !== 'PGRST116') {
          // PGRST116 = no hay coincidencias (se maneja abajo)
          throw gruposEmpresasError;
        }

        gruposDirectos = gruposEmpresas || [];

        // Unir IDs de grupos (directos + por usuarios)
        const allGroupIds = new Set([
          ...gruposDirectos.map(g => g.id),
          ...gruposDesdeUsuarios
        ]);

        let gruposData = gruposDirectos;
        if (allGroupIds.size > 0 && gruposDesdeUsuarios.size > 0) {
          const faltantes = [...gruposDesdeUsuarios].filter(id => !gruposDirectos.find(g => g.id === id));
          if (faltantes.length > 0) {
            const { data: gruposExtra, error: gruposExtraError } = await supabase
              .from('grupos')
              .select('*')
              .in('id', faltantes);

            if (gruposExtraError) throw gruposExtraError;
            gruposData = [...gruposDirectos, ...(gruposExtra || [])];
            }
        }

        // Mapear relaciones grupo -> usuarios (solo los del admin)
        const grupoUsuariosMap = new Map();
        grupoUsuarios.forEach(({ grupo_id, usuario_id }) => {
          if (!grupoUsuariosMap.has(grupo_id)) {
            grupoUsuariosMap.set(grupo_id, new Set());
          }
          if (usuarioIdsSet.has(usuario_id)) {
            grupoUsuariosMap.get(grupo_id).add(usuario_id);
          }
        });

        // Construir objetos finales de grupos
        const gruposConUsuarios = gruposData.map((grupo) => {
          const usuariosIdsGrupo = Array.from(grupoUsuariosMap.get(grupo.id) || []);
          const usuarios = usuariosIdsGrupo
            .map(usuarioId => usuarioMap.get(usuarioId))
            .filter(Boolean)
            .sort((a, b) => (a.username || '').localeCompare(b.username || ''));

          const empresaNombre = grupo.empresa_id
            ? (empresasMap.get(grupo.empresa_id)?.nombre || 'Empresa asociada')
            : 'Grupo multiempresa';

          const empresasUsuarios = new Set(
            usuarios
              .map(u => empresasMap.get(u.empresa_id)?.nombre)
              .filter(Boolean)
          );

            return {
              ...grupo,
              usuarios,
            empresaNombre,
            empresasUsuarios: Array.from(empresasUsuarios)
            };
          })
          // Filtrar grupos que no tienen relación con el admin
          .filter(grupo => 
            adminEmpresaIds.includes(grupo.empresa_id) || grupo.usuarios.length > 0
          )
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        setGrupos(gruposConUsuarios);
      } catch (error) {
        console.error('Error al cargar grupos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGrupos();
  }, [adminEmpresaIds, refreshTrigger]);

  // Filtrar grupos
  const filteredGrupos = grupos.filter(g => {
    const matchesSearch = searchQuery === '' || 
      g.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.descripcion?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.empresaNombre?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Toggle expandir grupo
  const toggleExpand = (grupoId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(grupoId)) {
      newExpanded.delete(grupoId);
    } else {
      newExpanded.add(grupoId);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold">Gestión de Grupos</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar grupos..."
                className="w-80 pl-10 pr-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Lista de grupos */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando grupos...</p>
            </div>
          ) : filteredGrupos.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No se encontraron grupos' : 'No hay grupos disponibles'}
              </p>
            </div>
          ) : (
            filteredGrupos.map((grupo, index) => (
              <motion.div
                key={grupo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="overflow-hidden">
                  {/* Header del grupo */}
                  <div 
                    className="p-6 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    onClick={() => toggleExpand(grupo.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                          <Users className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold mb-1">{grupo.nombre}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {grupo.empresaNombre}
                            </span>
                            <span className="flex items-center gap-1">
                              <UserCircle className="w-3 h-3" />
                              {grupo.usuarios.length} {grupo.usuarios.length === 1 ? 'usuario' : 'usuarios'}
                            </span>
                          </div>
                          {grupo.descripcion && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {grupo.descripcion}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        {expandedGroups.has(grupo.id) ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Lista de usuarios expandida */}
                  {expandedGroups.has(grupo.id) && (
                    <div className="border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-6">
                      {grupo.usuarios.length === 0 ? (
                        <div className="text-center py-8">
                          <UserCircle className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            No hay usuarios en este grupo
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h4 className="font-semibold mb-4">
                            Usuarios del grupo ({grupo.usuarios.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {grupo.usuarios.map((usuario) => (
                              <Card key={usuario.id} className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                                    {(usuario.username || usuario.nombre || 'U')[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">
                                      {usuario.username || 'Sin username'}
                                    </p>
                                    {usuario.nombre && usuario.apellidos && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {usuario.nombre} {usuario.apellidos}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                      <Mail className="w-3 h-3 flex-shrink-0" />
                                      {usuario.email || 'Sin email'}
                                    </p>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default GroupsManagementPage;

