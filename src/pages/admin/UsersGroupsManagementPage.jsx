import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  X,
  Check,
  Loader2,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowLeft
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

/**
 * Página de Gestión de Usuarios y Grupos
 * Diseño dividido: Lista de grupos (izquierda) + Editor de grupo (derecha)
 */
const UsersGroupsManagementPage = () => {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchGrupos, setSearchGrupos] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Estado del editor
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Formulario del grupo
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: ''
  });
  
  // Usuarios disponibles y seleccionados
  const [empresas, setEmpresas] = useState([]);
  const [searchUsuarios, setSearchUsuarios] = useState('');
  const [expandedEmpresas, setExpandedEmpresas] = useState(new Set());
  const [selectedUsuarios, setSelectedUsuarios] = useState(new Set());
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);

  // Obtener empresas asignadas al admin
  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user) return;

      const userId = user?.id || user?.usuario_id || user?.user_id;

      try {
        const { data: adminMarcas, error: errorMarcas } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', userId);

        if (errorMarcas) {
          logger.error('Error obteniendo marcas del admin:', errorMarcas);
          setAdminEmpresaIds([]);
          return;
        }

        if (!adminMarcas || adminMarcas.length === 0) {
          setAdminEmpresaIds([]);
          return;
        }

        const marcasIds = adminMarcas.map(m => m.marca_id).filter(Boolean);

        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select('empresa_id')
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) {
          logger.error('Error obteniendo empresas de las marcas:', errorMarcaEmpresas);
          setAdminEmpresaIds([]);
          return;
        }

        const empresasIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        setAdminEmpresaIds(empresasIds);
      } catch (e) {
        logger.error('Excepción obteniendo empresas del admin:', e);
        setAdminEmpresaIds([]);
      }
    };

    fetchAdminEmpresas();
  }, [user]);

  // Cargar grupos
  const loadGrupos = async () => {
    try {
      setLoading(true);

      if (adminEmpresaIds.length === 0) {
        setGrupos([]);
        setLoading(false);
        return;
      }

      // Obtener usuarios de las empresas del admin
      const { data: usuariosEmpresa } = await supabase
        .from('usuarios')
        .select('id')
        .in('empresa_id', adminEmpresaIds);

      if (!usuariosEmpresa || usuariosEmpresa.length === 0) {
        setGrupos([]);
        setLoading(false);
        return;
      }

      const usuarioIds = usuariosEmpresa.map(u => u.id);

      // Obtener relaciones grupo-usuario
      const { data: grupoUsuarios } = await supabase
        .from('grupo_usuarios')
        .select('grupo_id')
        .in('usuario_id', usuarioIds);

      const gruposIds = [...new Set((grupoUsuarios || []).map(gu => gu.grupo_id))];

      // Obtener grupos directos de las empresas
      const { data: gruposEmpresas } = await supabase
        .from('grupos')
        .select('*')
        .in('empresa_id', adminEmpresaIds)
        .order('nombre');

      // Combinar grupos
      const allGruposIds = new Set([
        ...(gruposEmpresas || []).map(g => g.id),
        ...gruposIds
      ]);

      // Obtener grupos faltantes
      const faltantes = [...allGruposIds].filter(id => 
        !gruposEmpresas?.find(g => g.id === id)
      );

      let gruposData = gruposEmpresas || [];
      
      if (faltantes.length > 0) {
        const { data: gruposExtra } = await supabase
          .from('grupos')
          .select('*')
          .in('id', faltantes);
        
        gruposData = [...gruposData, ...(gruposExtra || [])];
      }

      // Obtener conteo de usuarios por grupo
      const { data: grupoUsuariosCount } = await supabase
        .from('grupo_usuarios')
        .select('grupo_id');

      const countMap = new Map();
      (grupoUsuariosCount || []).forEach(gu => {
        countMap.set(gu.grupo_id, (countMap.get(gu.grupo_id) || 0) + 1);
      });

      const gruposConConteo = gruposData.map(g => ({
        ...g,
        usuarios_count: countMap.get(g.id) || 0
      }));

      setGrupos(gruposConConteo);
      logger.dev('📊 Grupos cargados:', gruposConConteo.length);
    } catch (error) {
      logger.error('Error cargando grupos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminEmpresaIds.length > 0) {
      loadGrupos();
    }
  }, [adminEmpresaIds]);

  // Cargar empresas y usuarios disponibles
  const loadEmpresas = async () => {
    try {
      if (adminEmpresaIds.length === 0) return;

      // Obtener empresas
      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, razon_social')
        .in('id', adminEmpresaIds)
        .order('razon_social');

      // Obtener usuarios de esas empresas
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, username, email, nombre, apellidos, empresa_id')
        .in('empresa_id', adminEmpresaIds)
        .order('username');

      // Agrupar usuarios por empresa
      const empresasConUsuarios = (empresasData || []).map(empresa => ({
        ...empresa,
        usuarios: (usuariosData || []).filter(u => u.empresa_id === empresa.id)
      }));

      setEmpresas(empresasConUsuarios);
    } catch (error) {
      logger.error('Error cargando empresas:', error);
    }
  };

  useEffect(() => {
    if (adminEmpresaIds.length > 0) {
      loadEmpresas();
    }
  }, [adminEmpresaIds]);

  // Cargar usuarios del grupo seleccionado
  const loadGrupoUsuarios = async (grupoId) => {
    try {
      const { data: grupoUsuarios } = await supabase
        .from('grupo_usuarios')
        .select('usuario_id')
        .eq('grupo_id', grupoId);

      const usuariosIds = new Set((grupoUsuarios || []).map(gu => gu.usuario_id));
      setSelectedUsuarios(usuariosIds);
    } catch (error) {
      logger.error('Error cargando usuarios del grupo:', error);
    }
  };

  // Abrir editor para crear nuevo grupo
  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedGrupo(null);
    setFormData({ nombre: '', descripcion: '' });
    setSelectedUsuarios(new Set());
  };

  // Abrir editor para editar grupo
  const handleEditGrupo = async (grupo) => {
    setIsCreating(false);
    setSelectedGrupo(grupo);
    setFormData({
      nombre: grupo.nombre || '',
      descripcion: grupo.descripcion || ''
    });
    await loadGrupoUsuarios(grupo.id);
  };

  // Cerrar editor
  const handleCloseEditor = () => {
    setIsCreating(false);
    setSelectedGrupo(null);
    setFormData({ nombre: '', descripcion: '' });
    setSelectedUsuarios(new Set());
  };

  // Guardar grupo
  const handleSave = async () => {
    try {
      if (!formData.nombre.trim()) {
        alert('El nombre del grupo es obligatorio');
        return;
      }

      setSaving(true);

      let grupoId;

      if (selectedGrupo) {
        // Actualizar grupo existente
        const { error } = await supabase
          .from('grupos')
          .update({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null
          })
          .eq('id', selectedGrupo.id);

        if (error) throw error;
        grupoId = selectedGrupo.id;
        logger.dev('✅ Grupo actualizado:', formData.nombre);
      } else {
        // Crear nuevo grupo
        const { data: newGrupo, error } = await supabase
          .from('grupos')
          .insert({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null
          })
          .select()
          .single();

        if (error) throw error;
        grupoId = newGrupo.id;
        logger.dev('✅ Grupo creado:', formData.nombre);

        // Asignar el grupo a la marca del admin
        if (user) {
          const userId = user?.id || user?.usuario_id || user?.user_id;
          logger.dev('🔍 Intentando asignar grupo a marca. User ID:', userId);
          
          try {
            // Obtener marca del admin
            const { data: adminMarca, error: marcaError } = await supabase
              .from('admin_asignaciones')
              .select('marca_id')
              .eq('admin_id', userId)
              .limit(1)
              .single();

            if (marcaError) {
              logger.error('❌ Error obteniendo marca del admin:', marcaError);
            } else if (!adminMarca?.marca_id) {
              logger.warn('⚠️ Admin no tiene marca asignada en admin_asignaciones');
            } else {
              logger.dev('✅ Marca encontrada:', adminMarca.marca_id);
              
              // Insertar en marca_grupos
              const { error: insertError } = await supabase
                .from('marca_grupos')
                .insert({
                  marca_id: adminMarca.marca_id,
                  grupo_id: grupoId,
                  created_by: userId
                });
              
              if (insertError) {
                logger.error('❌ Error insertando en marca_grupos:', insertError);
              } else {
                logger.dev('✅ Grupo asignado a marca exitosamente:', adminMarca.marca_id);
              }
            }
          } catch (error) {
            logger.error('❌ Excepción asignando grupo a marca:', error);
          }
        } else {
          logger.warn('⚠️ No hay usuario autenticado para asignar grupo a marca');
        }
      }

      // Actualizar relaciones con usuarios
      // Primero eliminar todas las relaciones existentes
      await supabase
        .from('grupo_usuarios')
        .delete()
        .eq('grupo_id', grupoId);

      // Luego insertar las nuevas
      if (selectedUsuarios.size > 0) {
        const relaciones = Array.from(selectedUsuarios).map(usuario_id => ({
          grupo_id: grupoId,
          usuario_id
        }));

        const { error: errorRelaciones } = await supabase
          .from('grupo_usuarios')
          .insert(relaciones);

        if (errorRelaciones) throw errorRelaciones;
      }

      // Recargar lista y cerrar editor
      await loadGrupos();
      handleCloseEditor();
    } catch (error) {
      logger.error('Error guardando grupo:', error);
      alert('Error al guardar el grupo: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar grupo
  const handleDelete = async (grupo) => {
    if (!confirm(`¿Estás seguro de eliminar el grupo "${grupo.nombre}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('grupos')
        .delete()
        .eq('id', grupo.id);

      if (error) throw error;

      logger.dev('🗑️ Grupo eliminado:', grupo.nombre);
      
      if (selectedGrupo?.id === grupo.id) {
        handleCloseEditor();
      }
      
      await loadGrupos();
    } catch (error) {
      logger.error('Error eliminando grupo:', error);
      alert('Error al eliminar el grupo: ' + error.message);
    }
  };

  // Toggle usuario en selección
  const toggleUsuario = (usuarioId) => {
    const newSet = new Set(selectedUsuarios);
    if (newSet.has(usuarioId)) {
      newSet.delete(usuarioId);
    } else {
      newSet.add(usuarioId);
    }
    setSelectedUsuarios(newSet);
  };

  // Seleccionar todos los usuarios de una empresa
  const selectAllFromEmpresa = (empresa) => {
    const newSet = new Set(selectedUsuarios);
    empresa.usuarios.forEach(u => newSet.add(u.id));
    setSelectedUsuarios(newSet);
  };

  // Toggle expandir empresa
  const toggleEmpresa = (empresaId) => {
    const newSet = new Set(expandedEmpresas);
    if (newSet.has(empresaId)) {
      newSet.delete(empresaId);
    } else {
      newSet.add(empresaId);
    }
    setExpandedEmpresas(newSet);
  };

  // Filtrar grupos
  const filteredGrupos = grupos.filter(g =>
    g.nombre.toLowerCase().includes(searchGrupos.toLowerCase()) ||
    g.descripcion?.toLowerCase().includes(searchGrupos.toLowerCase())
  );

  // Paginación
  const totalPages = Math.ceil(filteredGrupos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGrupos = filteredGrupos.slice(startIndex, endIndex);

  // Reset página al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchGrupos]);

  // Filtrar empresas y usuarios
  const filteredEmpresas = empresas.map(empresa => ({
    ...empresa,
    usuarios: empresa.usuarios.filter(u =>
      u.username?.toLowerCase().includes(searchUsuarios.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchUsuarios.toLowerCase()) ||
      u.nombre?.toLowerCase().includes(searchUsuarios.toLowerCase()) ||
      u.apellidos?.toLowerCase().includes(searchUsuarios.toLowerCase())
    )
  })).filter(e => e.usuarios.length > 0);

  // Obtener usuarios seleccionados para mostrar en el panel derecho
  const usuariosSeleccionadosData = empresas.flatMap(e => e.usuarios)
    .filter(u => selectedUsuarios.has(u.id));

  const showEditor = isCreating || selectedGrupo;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios y Grupos</h1>
              <p className="text-muted-foreground mt-1">
                Crea y administra grupos de usuarios
              </p>
            </div>
          </div>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus size={18} />
            Nuevo Grupo
          </Button>
        </div>

        {/* Layout dividido */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel izquierdo: Lista de grupos */}
          <div className={`${showEditor ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Grupos</h2>
                <Badge>{filteredGrupos.length}</Badge>
              </div>

              {/* Buscador */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Buscar grupos..."
                  value={searchGrupos}
                  onChange={(e) => setSearchGrupos(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Lista de grupos */}
              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredGrupos.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchGrupos ? 'No se encontraron grupos' : 'No hay grupos creados'}
                    </p>
                  </div>
                ) : (
                  paginatedGrupos.map((grupo) => (
                    <motion.div
                      key={grupo.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedGrupo?.id === grupo.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleEditGrupo(grupo)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{grupo.nombre}</p>
                          {grupo.descripcion && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                              {grupo.descripcion}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {grupo.usuarios_count} usuarios
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(grupo);
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}

                {/* Paginación */}
                {!loading && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      {startIndex + 1}-{Math.min(endIndex, filteredGrupos.length)} de {filteredGrupos.length}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft size={14} />
                      </Button>
                      
                      <div className="text-xs text-muted-foreground px-2">
                        {currentPage}/{totalPages}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Panel derecho: Editor de grupo */}
          <AnimatePresence>
            {showEditor && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="lg:col-span-8"
              >
                <Card className="p-6">
                  {/* Header del editor */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCloseEditor}
                      >
                        <ArrowLeft size={18} />
                      </Button>
                      <div>
                        <h2 className="text-xl font-bold">
                          {isCreating ? 'Nuevo Grupo' : 'Editar Grupo'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Configura el nombre y los usuarios del grupo
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Columna izquierda: Datos del grupo */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-4">Datos del Grupo</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="nombre">Nombre *</Label>
                            <Input
                              id="nombre"
                              value={formData.nombre}
                              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                              placeholder="Nombre del grupo"
                              disabled={saving}
                            />
                          </div>

                          <div>
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Textarea
                              id="descripcion"
                              value={formData.descripcion}
                              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                              placeholder="Descripción del grupo..."
                              rows={3}
                              disabled={saving}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Buscar usuarios por empresa */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 mb-3">
                          <Building2 size={16} />
                          <h3 className="font-semibold">Buscar Usuarios por Empresa</h3>
                        </div>
                        
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                          <Input
                            placeholder="Buscar empresa..."
                            value={searchUsuarios}
                            onChange={(e) => setSearchUsuarios(e.target.value)}
                            className="pl-9"
                          />
                        </div>

                        {/* Lista de empresas con usuarios */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {filteredEmpresas.map((empresa) => (
                            <div key={empresa.id} className="border rounded-lg">
                              {/* Header de empresa */}
                              <div className="flex items-center justify-between p-2 bg-muted/50 cursor-pointer"
                                onClick={() => toggleEmpresa(empresa.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {expandedEmpresas.has(empresa.id) ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                  <Building2 size={14} />
                                  <span className="text-sm font-medium">
                                    {empresa.razon_social || 'Sin nombre'}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {empresa.usuarios.filter(u => 
                                      !searchUsuarios || 
                                      u.username?.toLowerCase().includes(searchUsuarios.toLowerCase()) ||
                                      u.email?.toLowerCase().includes(searchUsuarios.toLowerCase())
                                    ).length}/{empresa.usuarios.length}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectAllFromEmpresa(empresa);
                                  }}
                                >
                                  Selec. todos
                                </Button>
                              </div>

                              {/* Lista de usuarios */}
                              {expandedEmpresas.has(empresa.id) && (
                                <div className="p-2 space-y-1">
                                  {empresa.usuarios.map((usuario) => (
                                    <div
                                      key={usuario.id}
                                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                                      onClick={() => toggleUsuario(usuario.id)}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedUsuarios.has(usuario.id)}
                                        onChange={() => toggleUsuario(usuario.id)}
                                        className="w-4 h-4"
                                      />
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">
                                          {usuario.username}
                                        </p>
                                        {usuario.email && (
                                          <p className="text-xs text-muted-foreground">
                                            {usuario.email}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Columna derecha: Usuarios seleccionados */}
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b">
                        <h3 className="font-semibold">Usuarios en el Grupo</h3>
                        <Badge variant="default">{selectedUsuarios.size}</Badge>
                      </div>

                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                        {usuariosSeleccionadosData.length === 0 ? (
                          <div className="text-center py-12">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                            <p className="text-sm text-muted-foreground">
                              No hay usuarios asignados
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Selecciona usuarios de la lista de empresas
                            </p>
                          </div>
                        ) : (
                          usuariosSeleccionadosData.map((usuario) => {
                            const empresa = empresas.find(e => e.id === usuario.empresa_id);
                            return (
                              <div
                                key={usuario.id}
                                className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {usuario.username}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {empresa?.razon_social || 'Sin empresa'}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="flex-shrink-0 h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                  onClick={() => toggleUsuario(usuario.id)}
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={handleCloseEditor}
                      disabled={saving}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving || !formData.nombre.trim()}
                      className="flex-1 gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          {isCreating ? 'Crear' : 'Actualizar'} Grupo
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AdminLayout>
  );
};

export default UsersGroupsManagementPage;

