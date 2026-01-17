import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Search, 
  Filter,
  Music,
  Mic,
  MessageSquare,
  RefreshCw,
  Play,
  Pause,
  Calendar,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

/**
 * Página de Gestión de Contenidos
 * Administra y organiza todos los contenidos multimedia de la empresa
 */
const ContentManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contenidos, setContenidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'ia', 'ondeon'
  const [playingId, setPlayingId] = useState(null); // ID del contenido que se está reproduciendo
  const [audioPlayer] = useState(new Audio());
  const [etiquetaIndexes, setEtiquetaIndexes] = useState({}); // Para trackear el índice de etiqueta visible por contenido
  const [savingEtiqueta, setSavingEtiqueta] = useState(null); // ID del contenido cuya etiqueta se está guardando

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Lista de etiquetas disponibles
  const etiquetasDisponibles = ['novedad', 'evento', 'marca', 'oferta', 'promocion', 'informativo', 'urgente', 'destacado'];

  // Obtener empresas del admin
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user) return;
      
      try {
        const userId = user?.id || user?.usuario_id || user?.user_id;
        
        logger.dev('🔒 Obteniendo marcas y empresas asignadas al admin:', userId);
        
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

  // Cargar contenidos de la empresa
  useEffect(() => {
    const loadContenidos = async () => {
      if (adminEmpresaIds.length === 0) {
        setContenidos([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        logger.dev('📦 Cargando contenidos para empresas:', adminEmpresaIds);

        // Paso 1: Obtener grupos de las empresas del admin
        const { data: grupos, error: gruposError } = await supabase
          .from('grupos')
          .select('id')
          .in('empresa_id', adminEmpresaIds);

        if (gruposError) {
          logger.error('❌ Error obteniendo grupos:', gruposError);
        }

        const grupoIds = grupos ? grupos.map(g => g.id) : [];
        logger.dev(`✅ ${grupoIds.length} grupos encontrados en las empresas`);

        // Paso 2: Obtener asignaciones de contenidos con información de empresas, grupos y usuarios
        let todasLasAsignaciones = [];

        // 2a. Asignaciones directas a empresa
        const { data: asignacionesEmpresa, error: asignacionesEmpresaError } = await supabase
          .from('contenido_asignaciones')
          .select(`
            contenido_id,
            empresa_id,
            grupo_id,
            usuario_id,
            empresas (id, razon_social),
            grupos (id, nombre),
            usuarios (id, username),
            contenidos!inner (
              id,
              nombre,
              tipo_contenido,
              url_s3,
              duracion_segundos,
              formato_audio,
              metadata,
              activo,
              etiquetas,
              created_at
            )
          `)
          .in('empresa_id', adminEmpresaIds)
          .eq('activo', true)
          .eq('contenidos.activo', true);

        if (asignacionesEmpresaError) {
          logger.error('❌ Error obteniendo asignaciones de empresa:', asignacionesEmpresaError);
        } else if (asignacionesEmpresa) {
          todasLasAsignaciones.push(...asignacionesEmpresa);
          logger.dev(`✅ ${asignacionesEmpresa.length} asignaciones directas a empresa`);
        }

        // 2b. Asignaciones a grupos de la empresa
        if (grupoIds.length > 0) {
          const { data: asignacionesGrupo, error: asignacionesGrupoError } = await supabase
            .from('contenido_asignaciones')
            .select(`
              contenido_id,
              empresa_id,
              grupo_id,
              usuario_id,
              empresas (id, razon_social),
              grupos (id, nombre),
              usuarios (id, username),
              contenidos!inner (
                id,
                nombre,
                tipo_contenido,
                url_s3,
                duracion_segundos,
                formato_audio,
                metadata,
                activo,
                etiquetas,
                created_at
              )
            `)
            .in('grupo_id', grupoIds)
            .eq('activo', true)
            .eq('contenidos.activo', true);

          if (asignacionesGrupoError) {
            logger.error('❌ Error obteniendo asignaciones de grupos:', asignacionesGrupoError);
          } else if (asignacionesGrupo) {
            todasLasAsignaciones.push(...asignacionesGrupo);
            logger.dev(`✅ ${asignacionesGrupo.length} asignaciones a grupos de la empresa`);
          }
        }

        // 2c. Asignaciones a usuarios de las empresas
        const { data: usuariosEmpresa, error: usuariosEmpresaError } = await supabase
          .from('usuarios')
          .select('id')
          .in('empresa_id', adminEmpresaIds);

        const usuarioIds = usuariosEmpresa ? usuariosEmpresa.map(u => u.id) : [];
        
        if (usuarioIds.length > 0) {
          const { data: asignacionesUsuario, error: asignacionesUsuarioError } = await supabase
            .from('contenido_asignaciones')
            .select(`
              contenido_id,
              empresa_id,
              grupo_id,
              usuario_id,
              empresas (id, razon_social),
              grupos (id, nombre),
              usuarios (id, username),
              contenidos!inner (
                id,
                nombre,
                tipo_contenido,
                url_s3,
                duracion_segundos,
                formato_audio,
                metadata,
                activo,
                etiquetas,
                created_at
              )
            `)
            .in('usuario_id', usuarioIds)
            .eq('activo', true)
            .eq('contenidos.activo', true);

          if (asignacionesUsuarioError) {
            logger.error('❌ Error obteniendo asignaciones de usuarios:', asignacionesUsuarioError);
          } else if (asignacionesUsuario) {
            todasLasAsignaciones.push(...asignacionesUsuario);
            logger.dev(`✅ ${asignacionesUsuario.length} asignaciones a usuarios de la empresa`);
          }
        }

        if (todasLasAsignaciones.length === 0) {
          logger.dev('ℹ️ No hay contenidos asignados a estas empresas o sus grupos');
          setContenidos([]);
          return;
        }

        logger.dev(`✅ ${todasLasAsignaciones.length} asignaciones totales de contenidos encontradas`);

        // Paso 3: Agrupar asignaciones por contenido_id
        const contenidosMap = new Map();
        todasLasAsignaciones.forEach(asig => {
          if (!contenidosMap.has(asig.contenido_id)) {
            contenidosMap.set(asig.contenido_id, {
              ...asig.contenidos,
              asignaciones: []
            });
          }
          
          // Determinar el nombre de la asignación
          let asignadoA = '';
          if (asig.empresa_id && asig.empresas) {
            asignadoA = asig.empresas.razon_social;
          } else if (asig.grupo_id && asig.grupos) {
            asignadoA = asig.grupos.nombre;
          } else if (asig.usuario_id && asig.usuarios) {
            asignadoA = asig.usuarios.username;
          }
          
          if (asignadoA) {
            contenidosMap.get(asig.contenido_id).asignaciones.push(asignadoA);
          }
        });

        const contenidosUnicos = Array.from(contenidosMap.values());
        logger.dev(`✅ ${contenidosUnicos.length} contenidos únicos encontrados`);

        // Paso 3b: Verificar cuáles contenidos son de IA
        const { data: aiAds, error: aiAdsError } = await supabase
          .from('ai_generated_ads')
          .select('contenido_id')
          .in('contenido_id', contenidosUnicos.map(c => c.id));
        
        const aiContentIds = new Set((aiAds || []).map(a => a.contenido_id));
        
        // Añadir información de si es IA o no a cada contenido
        const contenidosConTag = contenidosUnicos.map(contenido => ({
          ...contenido,
          esIA: aiContentIds.has(contenido.id)
        }));

        // Ordenar por fecha de creación (más reciente primero)
        contenidosConTag.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        logger.dev(`✅ Contenidos marcados: ${contenidosConTag.filter(c => c.esIA).length} IA, ${contenidosConTag.filter(c => !c.esIA).length} Ondeón`);

        // Paso 4: Obtener programaciones activas de estos usuarios
        let programacionIds = [];
        
        if (usuarioIds.length > 0) {
          const { data: progData, error: progError } = await supabase
            .from('programacion_destinatarios')
            .select(`
              programacion_id,
              programaciones!inner (
                id,
                estado
              )
            `)
            .in('usuario_id', usuarioIds)
            .eq('programaciones.estado', 'activo');

          if (!progError && progData) {
            programacionIds = [...new Set(progData.map(p => p.programacion_id))];
            logger.dev(`✅ ${programacionIds.length} programaciones activas encontradas`);
          }
        }

        // Paso 6: Obtener contenidos que están en programaciones
        let contenidosEnProgramacion = new Set();
        
        if (programacionIds.length > 0) {
          const { data: progContenidos, error: pcError } = await supabase
            .from('programacion_contenidos')
            .select('contenido_id')
            .in('programacion_id', programacionIds)
            .eq('activo', true);

          if (!pcError && progContenidos) {
            contenidosEnProgramacion = new Set(progContenidos.map(pc => pc.contenido_id));
            logger.dev(`✅ ${contenidosEnProgramacion.size} contenidos están en programaciones`);
          }
        }

        // Paso 7: Enriquecer contenidos con estado de programación
        const contenidosEnriquecidos = contenidosConTag.map(contenido => {
          const estaProgramado = contenidosEnProgramacion.has(contenido.id);
          
          return {
            ...contenido,
            programacion_id: estaProgramado ? 'programado' : null,
          };
        });

        logger.dev(`✅ Mostrando ${contenidosEnriquecidos.length} contenidos de la empresa`);
        setContenidos(contenidosEnriquecidos);

      } catch (error) {
        logger.error('❌ Error cargando contenidos:', error);
        setContenidos([]);
      } finally {
        setLoading(false);
      }
    };

    loadContenidos();
  }, [adminEmpresaIds, refreshTrigger]);

  // Filtrar contenidos
  const filteredContenidos = contenidos.filter(c => {
    const matchesSearch = searchQuery === '' || 
      c.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.etiquetas?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filtrar por tipo: 'ia' o 'ondeon'
    let matchesType = true;
    if (filterType === 'ia') {
      matchesType = c.esIA === true;
    } else if (filterType === 'ondeon') {
      matchesType = c.esIA !== true;
    }
    // Si filterType === 'all', mostrar todos (matchesType = true)
    
    return matchesSearch && matchesType;
  });

  // Paginación
  const totalPages = Math.ceil(filteredContenidos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContenidos = filteredContenidos.slice(startIndex, endIndex);

  // Reiniciar página cuando cambia la búsqueda o filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  // Manejar reproducción de audio
  const handlePlayPause = (contenido) => {
    if (playingId === contenido.id) {
      // Pausar
      audioPlayer.pause();
      setPlayingId(null);
    } else {
      // Reproducir
      if (contenido.url_s3) {
        const cloudFrontUrl = convertToCloudFrontUrl(contenido.url_s3);
        audioPlayer.src = cloudFrontUrl;
        audioPlayer.play().catch(err => {
          logger.error('Error reproduciendo audio:', err);
        });
        setPlayingId(contenido.id);
      }
    }
  };

  // Limpiar audio player al desmontar
  useEffect(() => {
    return () => {
      audioPlayer.pause();
      audioPlayer.src = '';
    };
  }, [audioPlayer]);

  // Manejar cuando el audio termina
  useEffect(() => {
    const handleEnded = () => {
      setPlayingId(null);
    };
    
    audioPlayer.addEventListener('ended', handleEnded);
    
    return () => {
      audioPlayer.removeEventListener('ended', handleEnded);
    };
  }, [audioPlayer]);

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Obtener icono según tipo
  const getTypeIcon = (tipo) => {
    switch (tipo) {
      case 'audio':
        return <Music className="w-4 h-4 text-blue-500" />;
      case 'voz':
        return <Mic className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  // Determinar origen del contenido (IA o ONDEON)
  const getOrigen = (contenido) => {
    // Verificar si el contenido está en ai_generated_ads
    if (contenido.esIA === true) {
      return 'IA';
    }
    
    // Si no está en ai_generated_ads, es de ONDEON
      return 'ONDEON';
  };

  // Navegar entre etiquetas y guardar automáticamente
  const handleEtiquetaNavigation = async (contenido, direction) => {
    // Siempre usar la lista de etiquetas disponibles para navegar
    const totalEtiquetas = etiquetasDisponibles.length;
    
    // Obtener el índice actual o determinar el índice basado en la etiqueta actual
    let currentIndex = etiquetaIndexes[contenido.id];
    
    if (currentIndex === undefined && contenido.etiquetas && contenido.etiquetas.length > 0) {
      // Si tiene etiquetas guardadas, encontrar el índice en la lista disponible
      const etiquetaActual = contenido.etiquetas[0];
      currentIndex = etiquetasDisponibles.indexOf(etiquetaActual);
      if (currentIndex === -1) currentIndex = 0; // Si no se encuentra, empezar en 0
    } else if (currentIndex === undefined) {
      currentIndex = 0;
    }
    
    // Calcular nuevo índice
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % totalEtiquetas;
    } else {
      newIndex = currentIndex === 0 ? totalEtiquetas - 1 : currentIndex - 1;
    }
    
    const etiquetaSeleccionada = etiquetasDisponibles[newIndex];
    
    try {
      setSavingEtiqueta(contenido.id);
      
      // Actualizar índice local temporalmente
      setEtiquetaIndexes(prev => ({
        ...prev,
        [contenido.id]: newIndex
      }));
      
      // Guardar en la base de datos
      const { error } = await supabase
        .from('contenidos')
        .update({ etiquetas: [etiquetaSeleccionada] })
        .eq('id', contenido.id);
      
      if (error) {
        logger.error('Error actualizando etiqueta:', error);
        // Revertir el índice si hay error
        setEtiquetaIndexes(prev => ({
          ...prev,
          [contenido.id]: currentIndex
        }));
        return;
      }
      
      logger.dev('✅ Etiqueta guardada automáticamente:', etiquetaSeleccionada);
      
      // Actualizar estado local
      setContenidos(prevContenidos =>
        prevContenidos.map(c =>
          c.id === contenido.id ? { ...c, etiquetas: [etiquetaSeleccionada] } : c
        )
      );
      
      // Limpiar el índice temporal después de guardar
      setTimeout(() => {
        setEtiquetaIndexes(prev => {
          const newIndexes = { ...prev };
          delete newIndexes[contenido.id];
          return newIndexes;
        });
      }, 500);
      
    } catch (error) {
      logger.error('Error guardando etiqueta:', error);
    } finally {
      setSavingEtiqueta(null);
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
              size="icon"
              onClick={() => navigate('/admin/grupos')}
              className="mr-2"
              title="Volver a Gestión de Empresa"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gestión de Contenidos</h1>
              <p className="text-muted-foreground mt-1">
                Administra y organiza todos los contenidos multimedia de tu empresa
              </p>
            </div>
          </div>
          <Button className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Solicitar Contenido
          </Button>
        </div>

        {/* Filtros y búsqueda */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o etiquetas..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Filtros por tipo */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                Todos
              </Button>
              <Button
                variant={filterType === 'ia' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('ia')}
              >
                IA
              </Button>
              <Button
                variant={filterType === 'ondeon' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('ondeon')}
              >
                Ondeón
              </Button>
            </div>

            {/* Botón refrescar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logger.dev('🔄 Recargando contenidos...');
                setRefreshTrigger(prev => prev + 1);
              }}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </Card>

        {/* Tabla de contenidos */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Contenidos ({filteredContenidos.length})
            </h2>
            {totalPages > 1 && (
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando contenidos...</p>
            </div>
          ) : filteredContenidos.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery || filterType !== 'all' 
                  ? 'No se encontraron contenidos con los filtros aplicados' 
                  : 'No hay contenidos disponibles'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-16">Play</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nombre</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">IA/ONDEON</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Facturado a</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Etiquetas</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fecha Creación</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContenidos.map((contenido, index) => (
                    <motion.tr
                      key={contenido.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePlayPause(contenido)}
                          disabled={!contenido.url_s3}
                          className="h-8 w-8"
                        >
                          {playingId === contenido.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(contenido.tipo_contenido)}
                          <span className="text-xs capitalize">{contenido.tipo_contenido}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium truncate max-w-xs" title={contenido.nombre}>
                          {contenido.nombre || 'Sin nombre'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const origen = getOrigen(contenido);
                          return (
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              origen === 'IA' 
                                ? 'bg-purple-500/10 text-purple-500'
                                : origen === 'ONDEON'
                                ? 'bg-blue-500/10 text-blue-500'
                                : 'bg-gray-500/10 text-gray-500'
                            }`}>
                              {origen}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          {contenido.asignaciones && contenido.asignaciones.length > 0 ? (
                            contenido.asignaciones.slice(0, 3).map((asignacion, idx) => (
                              <span
                                key={idx}
                                className="text-xs text-muted-foreground truncate max-w-xs"
                                title={asignacion}
                              >
                                {asignacion}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin asignación</span>
                          )}
                          {contenido.asignaciones && contenido.asignaciones.length > 3 && (
                            <span className="text-xs text-muted-foreground italic">
                              +{contenido.asignaciones.length - 3} más
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const etiquetasActuales = contenido.etiquetas || [];
                          const tieneEtiquetas = etiquetasActuales.length > 0;
                          const isSaving = savingEtiqueta === contenido.id;
                          
                          // Determinar qué etiqueta mostrar
                          let etiquetaActual;
                          if (etiquetaIndexes[contenido.id] !== undefined) {
                            // Si hay un índice temporal, mostrar esa etiqueta
                            etiquetaActual = etiquetasDisponibles[etiquetaIndexes[contenido.id]];
                          } else if (tieneEtiquetas) {
                            // Si tiene etiquetas guardadas, mostrar la primera
                            etiquetaActual = etiquetasActuales[0];
                          } else {
                            // Si no tiene nada, mostrar la primera disponible
                            etiquetaActual = etiquetasDisponibles[0];
                          }
                          
                          return (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-50 hover:opacity-100"
                                onClick={() => handleEtiquetaNavigation(contenido, 'prev')}
                                disabled={isSaving}
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </Button>
                              
                              <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap flex items-center gap-1 ${
                                tieneEtiquetas 
                                  ? 'bg-primary/10 text-primary' 
                                  : 'bg-muted text-muted-foreground border border-dashed'
                              }`}>
                                {etiquetaActual}
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                              </span>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-50 hover:opacity-100"
                                onClick={() => handleEtiquetaNavigation(contenido, 'next')}
                                disabled={isSaving}
                              >
                                <ChevronRight className="w-3 h-3" />
                              </Button>
                        </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {formatDate(contenido.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {contenido.programacion_id ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500">
                            Programado
                        </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/programaciones?crearConContenido=${contenido.id}`)}
                            className="h-7 px-3 text-xs gap-1 hover:bg-primary/10"
                          >
                            <Calendar className="w-3 h-3" />
                            Programar
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, filteredContenidos.length)} de {filteredContenidos.length} contenidos
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft size={16} />
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="gap-1"
                    >
                      Siguiente
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ContentManagementPage;
