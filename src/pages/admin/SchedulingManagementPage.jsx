import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar,
  ArrowLeft,
  Search,
  RefreshCw,
  Clock,
  Users,
  FileText,
  Play,
  Pause,
  Music
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

/**
 * Página de Gestión de Programaciones
 * Administra todas las programaciones de la empresa
 */
const SchedulingManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [programaciones, setProgramaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Obtener empresas del admin
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);

  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user) return;
      
      try {
        const userId = user?.id || user?.usuario_id || user?.user_id;
        
        // 1️⃣ Obtener marcas asignadas al admin
        const { data: asignacionesMarcas, error } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', userId);

        if (error) {
          logger.error('❌ Error obteniendo marcas del admin:', error);
          setAdminEmpresaIds([]);
          return;
        }

        const marcasIds = (asignacionesMarcas || []).map(a => a.marca_id).filter(Boolean);
        
        if (marcasIds.length === 0) {
          logger.warn('⚠️ Admin sin marcas asignadas');
          setAdminEmpresaIds([]);
          return;
        }

        // 2️⃣ Obtener empresas de esas marcas
        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select('empresa_id')
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) {
          logger.error('❌ Error obteniendo empresas de las marcas:', errorMarcaEmpresas);
          setAdminEmpresaIds([]);
          return;
        }

        const empresasIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        logger.dev(`✅ Admin tiene ${marcasIds.length} marca(s) con ${empresasIds.length} empresa(s)`);
        setAdminEmpresaIds(empresasIds);
      } catch (e) {
        logger.error('❌ Excepción obteniendo marcas y empresas:', e);
        setAdminEmpresaIds([]);
      }
    };

    fetchAdminEmpresas();
  }, [user]);

  // Cargar programaciones
  useEffect(() => {
    const loadProgramaciones = async () => {
      if (adminEmpresaIds.length === 0) {
        setProgramaciones([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        logger.dev('📅 Cargando programaciones para empresas:', adminEmpresaIds);

        // Paso 1: Obtener grupos de las empresas
        const { data: grupos } = await supabase
          .from('grupos')
          .select('id')
          .in('empresa_id', adminEmpresaIds);

        const grupoIds = grupos ? grupos.map(g => g.id) : [];

        // Paso 2: Obtener usuarios de las empresas
        const { data: usuarios } = await supabase
          .from('usuarios')
          .select('id')
          .in('empresa_id', adminEmpresaIds);

        const usuarioIds = usuarios ? usuarios.map(u => u.id) : [];
        logger.dev(`✅ ${usuarioIds.length} usuarios, ${grupoIds.length} grupos`);

        // Paso 3: Obtener programacion_destinatarios relacionados
        let programacionIds = new Set();

        // 3a. Por empresa
        const { data: destEmpresa } = await supabase
          .from('programacion_destinatarios')
          .select('programacion_id')
          .in('empresa_id', adminEmpresaIds)
          .eq('activo', true);

        if (destEmpresa) {
          destEmpresa.forEach(d => programacionIds.add(d.programacion_id));
        }

        // 3b. Por grupos
        if (grupoIds.length > 0) {
          const { data: destGrupo } = await supabase
            .from('programacion_destinatarios')
            .select('programacion_id')
            .in('grupo_id', grupoIds)
            .eq('activo', true);

          if (destGrupo) {
            destGrupo.forEach(d => programacionIds.add(d.programacion_id));
          }
        }

        // 3c. Por usuarios
        if (usuarioIds.length > 0) {
          const { data: destUsuario } = await supabase
            .from('programacion_destinatarios')
            .select('programacion_id')
            .in('usuario_id', usuarioIds)
            .eq('activo', true);

          if (destUsuario) {
            destUsuario.forEach(d => programacionIds.add(d.programacion_id));
          }
        }

        const progIds = Array.from(programacionIds);
        logger.dev(`✅ ${progIds.length} programaciones encontradas`);

        if (progIds.length === 0) {
          setProgramaciones([]);
          return;
        }

        // Paso 4: Obtener programaciones completas
        const { data: progs, error: progsError } = await supabase
          .from('programaciones')
          .select('*')
          .in('id', progIds)
          .order('created_at', { ascending: false });

        if (progsError) {
          logger.error('❌ Error obteniendo programaciones:', progsError);
          setProgramaciones([]);
          return;
        }

        // Paso 5: Obtener información de creadores y modificadores (usuarios y superadmins)
        const createdByIds = [...new Set(progs.map(prog => prog.created_by).filter(Boolean))];
        const modifiedByIds = [...new Set(progs.map(prog => prog.modified_by || prog.updated_by).filter(Boolean))];
        const allUserIds = [...new Set([...createdByIds, ...modifiedByIds])];
        
        // Consultar usuarios creadores y modificadores
        let usuariosMap = new Map();
        if (allUserIds.length > 0) {
          const { data: usuarios, error: errorUsuarios } = await supabase
            .from('usuarios')
            .select('id, username')
            .in('id', allUserIds);
          
          if (!errorUsuarios && usuarios) {
            usuarios.forEach(u => {
              usuariosMap.set(u.id, u.username);
            });
          }
        }
        
        // Consultar superadmins
        let superadminsMap = new Map();
        if (allUserIds.length > 0) {
          const { data: superadmins, error: errorSuperadmins } = await supabase
            .from('superadmins')
            .select('id')
            .in('id', allUserIds);
          
          if (!errorSuperadmins && superadmins) {
            superadmins.forEach(sa => {
              superadminsMap.set(sa.id, true);
            });
          }
        }

        // Paso 6: Para cada programación, obtener contenidos y destinatarios
        const programacionesEnriquecidas = await Promise.all(
          progs.map(async (prog) => {
            // Obtener contenidos
            const { data: contenidos } = await supabase
              .from('programacion_contenidos')
              .select(`
                contenido_id,
                orden,
                contenidos (
                  id,
                  nombre,
                  tipo_contenido
                )
              `)
              .eq('programacion_id', prog.id)
              .eq('activo', true)
              .order('orden', { ascending: true });

            // Obtener destinatarios
            const { data: destinatarios } = await supabase
              .from('programacion_destinatarios')
              .select('*')
              .eq('programacion_id', prog.id)
              .eq('activo', true);

            // Contar destinatarios por tipo
            const countDestinatarios = {
              usuarios: destinatarios?.filter(d => d.tipo === 'usuario').length || 0,
              grupos: destinatarios?.filter(d => d.tipo === 'grupo').length || 0,
              empresas: destinatarios?.filter(d => d.tipo === 'empresa').length || 0
            };

            // Determinar el nombre del creador
            let creadorNombre = 'Sistema';
            if (prog.created_by) {
              if (superadminsMap.has(prog.created_by)) {
                creadorNombre = 'superadmin';
              } else if (usuariosMap.has(prog.created_by)) {
                creadorNombre = usuariosMap.get(prog.created_by);
              }
            }

            // Determinar el nombre del último modificador (priorizar modified_by sobre updated_by)
            const modificadorId = prog.modified_by || prog.updated_by;
            let modificadorNombre = null;
            if (modificadorId) {
              if (superadminsMap.has(modificadorId)) {
                modificadorNombre = 'superadmin';
              } else if (usuariosMap.has(modificadorId)) {
                modificadorNombre = usuariosMap.get(modificadorId);
              }
            }

            return {
              ...prog,
              contenidos: contenidos || [],
              destinatarios: destinatarios || [],
              countDestinatarios,
              creadorNombre,
              modificadorNombre
            };
          })
        );

        logger.dev(`✅ ${programacionesEnriquecidas.length} programaciones cargadas con detalles`);
        setProgramaciones(programacionesEnriquecidas);

      } catch (error) {
        logger.error('❌ Error cargando programaciones:', error);
        setProgramaciones([]);
      } finally {
        setLoading(false);
      }
    };

    loadProgramaciones();
  }, [adminEmpresaIds, refreshTrigger]);

  // Filtrar programaciones
  const filteredProgramaciones = programaciones.filter(p => {
    const matchesSearch = searchQuery === '' || 
      p.descripcion?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesEstado = filterEstado === 'all' || p.estado === filterEstado;
    
    return matchesSearch && matchesEstado;
  });

  // Contar por estado
  const estadoCounts = {
    all: programaciones.length,
    activo: programaciones.filter(p => p.estado === 'activo').length,
    completado: programaciones.filter(p => p.estado === 'completado').length,
    pausado: programaciones.filter(p => p.estado === 'pausado').length
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Formatear horario según tipo
  const formatHorario = (prog) => {
    switch (prog.tipo) {
      case 'diaria':
        if (prog.daily_mode === 'una_vez_dia') {
          return `Diario a las ${prog.hora_una_vez_dia || ''}`;
        } else if (prog.daily_mode === 'cada') {
          return `Cada ${prog.cada_dias || 1} días, ${prog.rango_desde || ''}-${prog.rango_hasta || ''}`;
        } else {
          return `Diario ${prog.rango_desde || ''}-${prog.rango_hasta || ''}`;
        }
      case 'semanal':
        const days = prog.weekly_days ? prog.weekly_days.join(', ') : '';
        if (prog.weekly_mode === 'una_vez_dia') {
          return `Semanal (${days}), ${prog.weekly_hora_una_vez || ''}`;
        } else {
          return `Semanal (${days}), ${prog.weekly_rango_desde || ''}-${prog.weekly_rango_hasta || ''}`;
        }
      case 'anual':
        return `Anual ${prog.annual_date || ''} a las ${prog.annual_time || ''}`;
      case 'una_vez':
        return `Una vez el ${formatDate(prog.fecha_inicio)}`;
      default:
        return prog.tipo || '-';
    }
  };

  // Formatear modo de audio
  const formatModoAudio = (modo) => {
    switch (modo) {
      case 'fade_out':
        return 'Fade Out/In';
      case 'background':
        return 'Música de fondo';
      default:
        return modo || '-';
    }
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
              onClick={() => navigate('/admin/grupos')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold">Listado de programaciones</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en la plataforma..."
                className="w-80 pl-10 pr-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Filtros por estado */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Filtrar por estado:</span>
          <Button
            variant={filterEstado === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEstado('all')}
            className="gap-2"
          >
            Todas
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
              {estadoCounts.all}
            </span>
          </Button>
          <Button
            variant={filterEstado === 'activo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEstado('activo')}
            className={`gap-2 ${filterEstado === 'activo' ? 'bg-green-500 hover:bg-green-600 border-green-500' : 'border-green-500/20 text-green-500 hover:bg-green-500/10'}`}
          >
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Activas
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${filterEstado === 'activo' ? 'bg-white/20' : 'bg-green-500/20'}`}>
              {estadoCounts.activo}
            </span>
          </Button>
          <Button
            variant={filterEstado === 'completado' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEstado('completado')}
            className={`gap-2 ${filterEstado === 'completado' ? 'bg-gray-500 hover:bg-gray-600 border-gray-500' : 'border-gray-500/20 text-gray-500 hover:bg-gray-500/10'}`}
          >
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            Completadas
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${filterEstado === 'completado' ? 'bg-white/20' : 'bg-gray-500/20'}`}>
              {estadoCounts.completado}
            </span>
          </Button>
          <Button
            variant={filterEstado === 'pausado' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEstado('pausado')}
            className={`gap-2 ${filterEstado === 'pausado' ? 'bg-yellow-500 hover:bg-yellow-600 border-yellow-500' : 'border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10'}`}
          >
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            Pausadas
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${filterEstado === 'pausado' ? 'bg-white/20' : 'bg-yellow-500/20'}`}>
              {estadoCounts.pausado}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            disabled={loading}
            className="gap-2 ml-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Lista de programaciones */}
        <div className="space-y-4">

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando programaciones...</p>
            </div>
          ) : filteredProgramaciones.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No se encontraron programaciones' : 'No hay programaciones disponibles'}
              </p>
            </div>
          ) : (
            filteredProgramaciones.map((prog, index) => (
              <motion.div
                key={prog.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <Card className={`p-6 ${prog.estado === 'completado' ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    {/* Contenido principal */}
                    <div className="flex-1 space-y-3">
                      {/* Título y badges */}
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold uppercase">{prog.descripcion}</h2>
                        <div className="flex items-center gap-2 text-sm">
                          {prog.estado === 'activo' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-green-500/10 text-green-500 border-green-500/20">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              activo
                            </span>
                          )}
                          {prog.estado === 'pausado' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              pausado
                            </span>
                          )}
                          {prog.estado === 'completado' && (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-gray-500/10 text-gray-500 border-gray-500/20">
                                <div className="w-2 h-2 rounded-full bg-gray-500" />
                                completado
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-red-500/10 text-red-500 border-red-500/20">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                Finalizado
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Creado por y Modificado por */}
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Creado por: {prog.creadorNombre || 'Sistema'}
                        </p>
                        {prog.modificadorNombre && (
                          <p className="text-sm text-muted-foreground">
                            Modificado por: {prog.modificadorNombre}
                          </p>
                        )}
                      </div>

                      {/* Mensaje de finalización o fecha fin */}
                      {prog.estado === 'completado' && prog.fecha_fin && (
                        <p className="text-sm text-red-400">
                          Finalizó el {formatDate(prog.fecha_fin)} a las {new Date(prog.fecha_fin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {prog.estado !== 'completado' && !prog.fecha_fin && (
                        <p className="text-sm text-purple-400">
                          Esta programación no tiene fecha de finalización
                        </p>
                      )}

                      {/* Detalles en lista */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-400" />
                          <span>{formatHorario(prog)}</span>
                          {prog.frecuencia_minutos && (
                            <span className="text-muted-foreground">(cada {prog.frecuencia_minutos} min)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-green-400" />
                          <span>Desde: {formatDate(prog.fecha_inicio)}</span>
                          {prog.fecha_fin && (
                            <span className="text-muted-foreground">hasta {formatDate(prog.fecha_fin)}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-purple-400" />
                          <span>{formatModoAudio(prog.modo_audio)}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-orange-400" />
                            <span>{prog.contenidos.length} {prog.contenidos.length === 1 ? 'contenido' : 'contenidos'}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-pink-400" />
                            <span>{prog.countDestinatarios.usuarios} {prog.countDestinatarios.usuarios === 1 ? 'usuario' : 'usuarios'}</span>
                          </div>
                        </div>
                      </div>

                      {/* ID y tipo */}
                      <p className="text-xs text-muted-foreground">
                        ID: {prog.id} • Tipo: {prog.tipo}
                      </p>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2 ml-4">
                      {prog.estado !== 'completado' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={prog.estado === 'activo' ? 'text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/10' : 'text-green-500 border-green-500/20 hover:bg-green-500/10'}
                        >
                          {prog.estado === 'activo' ? (
                            <>
                              <Pause className="w-4 h-4 mr-1" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Activar
                            </>
                          )}
                        </Button>
                      )}
                      {prog.estado === 'completado' ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-green-500 border-green-500/20 hover:bg-green-500/10"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Activar
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm">
                          ✏️ Editar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-red-500 border-red-500/20 hover:bg-red-500/10">
                        🗑️ Eliminar
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default SchedulingManagementPage;
