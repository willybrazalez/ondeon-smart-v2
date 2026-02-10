import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListChecks, CalendarDays, Search, Filter, Clock, Tag, PlayCircle, Edit3, Trash2, Copy, Archive, Zap, Loader2, PlusCircle, Pause, Play, Power } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { contentAssignmentsApi, contenidosApi } from '@/lib/api';
import audioPlayer from '@/services/audioPlayerService';
import { useToast } from '@/components/ui/use-toast';
import logger from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';
import ContentCard from '@/components/ContentCard';
import SubscriptionGate from '@/components/SubscriptionGate';
import NewProgramacionModal from '@/components/modals/NewProgramacionModal';
import EditProgramacionModal from '@/components/modals/EditProgramacionModal';

// Estilos de estado para las tarjetas de contenido

const statusStyles = {
  'Activo': 'text-green-600 dark:text-green-400 border-green-500/70 bg-green-500/10',
  'Programado': 'text-blue-600 dark:text-blue-400 border-blue-500/70 bg-blue-500/10',
  'Borrador': 'text-gray-600 dark:text-gray-400 border-gray-500/70 bg-gray-500/10',
  'Archivado': 'text-slate-500 dark:text-slate-400 border-slate-500/60 bg-slate-500/10',
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'Consejo de Salud': return <ListChecks size={18} className="text-sky-500" />;
    case 'Promoción': return <Tag size={18} className="text-amber-500" />;
    case 'Evento': return <CalendarDays size={18} className="text-violet-500" />;
    case 'Aviso Importante': return <Clock size={18} className="text-rose-500" />;
    case 'Novedad': return <PlusCircle size={18} className="text-teal-500" />;
    case 'Indicativo': return <Zap size={18} className="text-emerald-500" />;
    case 'Anuncio': return <Tag size={18} className="text-amber-500" />;
    case 'Mensaje': return <Clock size={18} className="text-blue-500" />;
    default: return <ListChecks size={18} className="text-gray-500" />;
  }
};

// Mapear tipo de BD a display
const mapTipoToDisplay = (tipo) => {
  const tipoMap = {
    'indicativo': 'Indicativo',
    'anuncio': 'Anuncio',
    'mensaje': 'Mensaje',
    'otro': 'Otro'
  };
  return tipoMap[tipo] || tipo;
};

// Obtener color según tipo de contenido
const getColorByType = (tipo) => {
  const colorMap = {
    'indicativo': 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30',
    'anuncio': 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30',
    'mensaje': 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/30',
    'otro': 'bg-gray-500/15 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300 border-gray-500/30'
  };
  return colorMap[tipo] || colorMap['otro'];
};

// Formatear fecha para mostrar
const formatDate = (dateString) => {
  if (!dateString) return 'Sin fecha';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Sin fecha';
    return date.toISOString().split('T')[0];
  } catch {
    return 'Sin fecha';
  }
};

const ContentsPage = () => {
  const { user, userRole, isManualPlaybackActive, startManualPlayback, clearManualPlayback, loading, canAccessContents, planTipo, canCreateContent } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [userAssignedContent, setUserAssignedContent] = useState([]);
  const [loadingAssignedContent, setLoadingAssignedContent] = useState(false);
  const [playingContentId, setPlayingContentId] = useState(null);
  const [userOwnContent, setUserOwnContent] = useState([]);
  const [loadingOwnContent, setLoadingOwnContent] = useState(false);
  const [showNewProgramacionModal, setShowNewProgramacionModal] = useState(false);
  const [editingProgramacion, setEditingProgramacion] = useState(null);
  
  // Función de recarga para actualizar contenidos después de ediciones
  const reloadContent = useCallback(async () => {
    const userId = user?.id || user?.usuario_id || user?.user_id;
    if (!userId) return;
    
    try {
      const content = await contentAssignmentsApi.getUserProgrammingContent(userId);
      setUserAssignedContent(content);
      logger.dev('🔄 Contenidos recargados después de actualización');
    } catch (e) {
      logger.warn('Error recargando contenidos:', e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const userId = user?.id || user?.usuario_id || user?.user_id;
    let subscription1 = null;
    let subscription2 = null;
    let subscription3 = null;
    
    const load = async () => {
      try {
        setLoadingAssignedContent(true);
        setLoadingOwnContent(true);
        
        // Cargar contenidos programados
        const content = await contentAssignmentsApi.getUserProgrammingContent(userId);
        setUserAssignedContent(content);
        
        // Cargar contenidos propios del usuario
        try {
          const ownContent = await contenidosApi.getMyContents(userId);
          setUserOwnContent(ownContent || []);
          logger.dev(`✅ ${ownContent?.length || 0} contenidos propios cargados`);
        } catch (ownErr) {
          logger.warn('Error cargando contenidos propios:', ownErr);
          setUserOwnContent([]);
        } finally {
          setLoadingOwnContent(false);
        }
        
        // Extraer IDs de programaciones para suscripciones específicas
        const programacionIds = [...new Set(content.map(item => item.programacion_id))];
        
        // Configurar suscripción a contenidos si hay programaciones
        if (programacionIds.length > 0 && !subscription2) {
          logger.dev(`📡 Configurando suscripción a contenidos de ${programacionIds.length} programación(es)...`);
          
          subscription2 = supabase
            .channel(`user-contenidos-${userId}-${Date.now()}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'programacion_contenidos',
                filter: `programacion_id=in.(${programacionIds.join(',')})`
              },
              (payload) => {
                logger.dev('🔄 Cambio en contenidos de TUS programaciones:', payload);
                load();
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                logger.dev('✅ Suscripción a contenidos activada');
              } else if (status === 'CHANNEL_ERROR') {
                logger.error('❌ Error en suscripción de contenidos');
              }
            });
        }
        
        // Configurar suscripción a estados de programaciones
        if (programacionIds.length > 0 && !subscription3) {
          logger.dev(`📡 Configurando suscripción a estados de ${programacionIds.length} programación(es)...`);
          
          subscription3 = supabase
            .channel(`user-prog-estados-${userId}-${Date.now()}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'programaciones',
                filter: `id=in.(${programacionIds.join(',')})`
              },
              (payload) => {
                logger.dev('🔄 Cambio de estado en TUS programaciones:', payload);
                load();
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                logger.dev('✅ Suscripción a estados de programaciones activada');
              } else if (status === 'CHANNEL_ERROR') {
                logger.error('❌ Error en suscripción de estados');
              }
            });
        }
        
      } catch (e) {
        setUserAssignedContent([]);
        logger.warn('Error cargando contenidos de programaciones', e);
      } finally {
        setLoadingAssignedContent(false);
      }
    };
    
    // Carga inicial
    load();

    // Suscripción a asignaciones de programaciones del usuario
    logger.dev('📡 Configurando suscripción optimizada para TUS programaciones...');

    subscription1 = supabase
      .channel(`user-programaciones-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'programacion_destinatarios',
          filter: `usuario_id=eq.${userId}`
        },
        (payload) => {
          logger.dev('🔄 Cambio en TUS asignaciones de programaciones:', payload);
          
          // Limpiar suscripciones de contenidos/estados y recrear
          if (subscription2) {
            logger.dev('🔄 Recreando suscripción de contenidos...');
            subscription2.unsubscribe();
            subscription2 = null;
          }
          if (subscription3) {
            logger.dev('🔄 Recreando suscripción de estados...');
            subscription3.unsubscribe();
            subscription3 = null;
          }
          
          // Recargar (recreará las suscripciones con nuevos IDs)
          load();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.dev('✅ Suscripción optimizada activada (solo tus programaciones)');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('❌ Error en suscripción de programaciones del usuario');
        }
      });

    // Cleanup: desuscribirse al desmontar
    return () => {
      logger.dev('🧹 Limpiando suscripciones optimizadas de programaciones...');
      if (subscription1) subscription1.unsubscribe();
      if (subscription2) subscription2.unsubscribe();
      if (subscription3) subscription3.unsubscribe();
    };
  }, [user?.id]);

  const handlePlayRecentContent = async (content) => {
    if (!content?.url_s3) {
      toast({ title: 'Error', description: 'Este contenido no se puede reproducir', variant: 'destructive' });
      return;
    }
    
    // Convertir URL a CloudFront
    const cloudFrontUrl = convertToCloudFrontUrl(content.url_s3);
    const contentName = content.name || 'Contenido';
    const duration = parseInt(content.duration) || 30;
    
    logger.dev('🎵 Reproduciendo contenido desde Recientes:', {
      nombre: contentName,
      duracion: duration,
      url: cloudFrontUrl
    });
    
    try {
      setPlayingContentId(content.id);
      
      // Bloquear controles durante reproducción
      startManualPlayback(content.id, contentName, duration);
      
      toast({ 
        title: 'Reproduciendo', 
        description: `${contentName} - ${duration}s`,
        className: "bg-blue-500 text-white dark:bg-blue-600 dark:text-white border-none shadow-lg",
      });
      
      // Reproducir con fade
      await audioPlayer.playContentWithFade(cloudFrontUrl, duration);
      
      toast({ 
        title: 'Reproducción finalizada', 
        description: `${contentName} ha terminado`,
        className: "bg-green-500 text-white dark:bg-green-600 dark:text-white border-none shadow-lg",
      });
      
    } catch (error) {
      logger.error('❌ Error reproduciendo contenido:', error);
      toast({ 
        title: 'Error', 
        description: 'No se pudo reproducir el contenido', 
        variant: 'destructive' 
      });
    } finally {
      setPlayingContentId(null);
      clearManualPlayback(); // Liberar el bloqueo de controles
    }
  };

  const handlePlayContent = async (assignment) => {
    if (!assignment?.contenidos?.url_s3) {
      toast({ title: 'Error', description: 'Contenido sin URL', variant: 'destructive' });
      return;
    }
    
    // Convertir URL a CloudFront
    const cloudFrontUrl = convertToCloudFrontUrl(assignment.contenidos.url_s3);
    
    // Activar bloqueo global antes de reproducir
    const contentName = assignment.contenidos?.nombre || 'Contenido';
    const duration = assignment.contenidos?.duracion_segundos || 30;
    
    // Detectar modo_audio de la programación
    const modoAudio = assignment.programacion_info?.modo_audio || 'fade_out';
    
    logger.dev('🎵 Reproduciendo contenido manualmente:', {
      nombre: contentName,
      duracion: duration,
      modoAudio: modoAudio,
      url: cloudFrontUrl,
      programacion: assignment.programacion_info?.descripcion
    });
    
    try {
      setPlayingContentId(assignment.id);
      
      // Bloquear TODOS los controles de reproducción en toda la app
      startManualPlayback(assignment.id, contentName, duration);
      
      const modoDescripcion = modoAudio === 'background' ? 'Con música de fondo' : 
                              modoAudio === 'interrumpir' ? 'Interrumpiendo música' : 'Modo fade';
      
      toast({ 
        title: 'Reproduciendo manualmente', 
        description: `${contentName} - ${modoDescripcion} - ${duration}s`,
        className: "bg-blue-500 text-white dark:bg-blue-600 dark:text-white border-none shadow-lg",
      });
      
      // Elegir función según modo_audio
      if (modoAudio === 'background') {
        // Modo background: música de fondo continua (volumen bajo)
        await audioPlayer.playContentWithBackground(cloudFrontUrl);
      } else {
        // Modo fade_out o interrumpir: fade out/in tradicional
        await audioPlayer.playContentWithFade(cloudFrontUrl, duration);
      }
      
      toast({ 
        title: 'Reproducción finalizada', 
        description: `${contentName} ha terminado - Controles desbloqueados`,
        className: "bg-green-500 text-white dark:bg-green-600 dark:text-white border-none shadow-lg",
      });
    } catch (err) {
      toast({ title: 'Error de reproducción', description: 'No se pudo reproducir el contenido', variant: 'destructive' });
    } finally {
      setPlayingContentId(null);
      clearManualPlayback(); // Liberar el bloqueo de controles
    }
  };

  // Función para pausar/activar una programación
  const handleToggleProgramacion = async (programacionId, currentState) => {
    const newState = currentState === 'activo' ? 'pausado' : 'activo';
    try {
      const { error } = await supabase
        .from('programaciones')
        .update({ estado: newState })
        .eq('id', programacionId);
      
      if (error) throw error;
      
      toast({
        title: newState === 'activo' ? 'Programación activada' : 'Programación pausada',
        description: `La programación se ha ${newState === 'activo' ? 'activado' : 'pausado'} correctamente`,
        className: newState === 'activo' 
          ? "bg-green-500 text-white border-none" 
          : "bg-amber-500 text-white border-none",
      });
      
      reloadContent();
    } catch (err) {
      logger.error('Error al cambiar estado de programación:', err);
      toast({ title: 'Error', description: 'No se pudo cambiar el estado', variant: 'destructive' });
    }
  };

  // Función para editar programación
  const handleEditProgramacion = (group) => {
    setEditingProgramacion(group);
  };

  // Contenidos programados AGRUPADOS por programación
  const groupedByProgramacion = useMemo(() => {
    // Primero formateamos los contenidos
    const formattedContent = userAssignedContent.map(item => ({
      id: item.id,
      name: item.contenidos?.nombre || 'Sin nombre',
      type: mapTipoToDisplay(item.contenidos?.tipo),
      duration: `${item.contenidos?.duracion_segundos || 0}s`,
      durationSeconds: item.contenidos?.duracion_segundos || 0,
      lastModified: formatDate(item.contenidos?.created_at || item.created_at),
      voice: item.contenidos?.generado_ia ? 'Generado IA' : 'Manual',
      color: getColorByType(item.contenidos?.tipo),
      url_s3: item.contenidos?.url_s3,
      isReal: true,
      programacionId: item.programacion_id,
      programacionEstado: item.programacion_info?.estado,
      programacionNombre: item.programacion_info?.descripcion,
      modoAudio: item.programacion_info?.modo_audio,
      originalItem: item
    }));

    // Agrupamos por programacionId
    const groups = {};
    formattedContent.forEach(item => {
      const progId = item.programacionId;
      if (!groups[progId]) {
        groups[progId] = {
          programacionId: progId,
          programacionNombre: item.programacionNombre,
          programacionEstado: item.programacionEstado,
          modoAudio: item.modoAudio,
          contenidos: []
        };
      }
      groups[progId].contenidos.push(item);
    });

    return Object.values(groups);
  }, [userAssignedContent]);
  
  // Para mantener compatibilidad con el código existente
  const formattedScheduledContent = useMemo(() => {
    return groupedByProgramacion.flatMap(group => group.contenidos);
  }, [groupedByProgramacion]);

  // Contenidos formateados para la Biblioteca (solo contenidos reales del usuario)
  const filteredLibraryContent = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();

    // Formatear contenidos reales del usuario
    const realContentsFormatted = userOwnContent.map(c => ({
      id: c.id,
      name: c.nombre,
      type: mapTipoToDisplay(c.tipo),
      duration: `${c.duracion_segundos || 0}s`,
      status: 'Activo',
      lastModified: formatDate(c.created_at),
      voice: c.generado_ia ? 'Generado IA' : 'Manual',
      color: getColorByType(c.tipo),
      url_s3: c.url_s3,
      isReal: true
    }));

    if (!lowerSearchTerm && filterType === 'all') {
      return realContentsFormatted;
    }

    return realContentsFormatted.filter(ad => {
      const matchesType = filterType === 'all' || ad.type === filterType;
      if (!matchesType) return false;

      const directMatch = ad.name.toLowerCase().includes(lowerSearchTerm) ||
                          ad.type.toLowerCase().includes(lowerSearchTerm);
      return directMatch;
    });
  }, [searchTerm, filterType, userOwnContent]);


  // Variantes de animación sin scale en hover (evita problemas de scroll)
  const adCardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
    }),
  };

  // Reenviar scroll de rueda al contenedor principal cuando el cursor está sobre las cards
  // (evita que motion/Radix intercepten y bloqueen el scroll; requiere passive: false)
  const pageContentRef = useRef(null);
  useEffect(() => {
    const el = pageContentRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      const scrollContainer = document.querySelector('[data-scroll-container]');
      if (scrollContainer && e.deltaY !== 0) {
        scrollContainer.scrollTop += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Guard: Mostrar loading mientras se determina el rol del usuario
  logger.dev('🔍 ContentsPage - userRole:', userRole);
  
  if (loading || userRole === null || userRole === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // 🔒 Guard: Verificar acceso a contenidos (cualquier suscripción activa: Básico o Pro)
  // La página de contenidos está disponible para ambos planes
  // La diferencia es que solo Pro puede "Solicitar nuevos contenidos"
  const hasSubscriptionAccess = planTipo === 'basico' || planTipo === 'pro' || canAccessContents;
  
  if (!hasSubscriptionAccess) {
    logger.dev('🔒 Usuario sin suscripción activa - mostrando SubscriptionGate');
    return <SubscriptionGate />;
  }

  return (
    <div ref={pageContentRef} className="p-4 sm:p-6 md:p-8 pb-24">
      <div className="text-center mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-sans font-bold text-black dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-primary/90 dark:via-[#A2D9F7]/80 dark:to-accent/90">
          Gestor de Contenidos
        </h1>
      </div>

      <Tabs defaultValue="scheduled" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-2 mb-6 bg-card/80 p-1.5 rounded-lg border border-border/70">
          <TabsTrigger value="scheduled" className="data-[state=active]:bg-[#A2D9F7]/20 data-[state=active]:text-[#A2D9F7]">Programados</TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-[#A2D9F7]/20 data-[state=active]:text-[#A2D9F7]">Biblioteca</TabsTrigger>
        </TabsList>
        
        {/* Pestaña "Programados" - Contenidos programados del usuario */}
        <TabsContent value="scheduled">
          <Card className="mb-8 bg-card/50 border-border/50">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-xl sm:text-2xl text-foreground font-sans">
                    Tus Contenidos Programados
                  </CardTitle>
                  <CardDescription className="text-muted-foreground font-sans">
                    Contenidos de tus programaciones activas que puedes reproducir manualmente
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setShowNewProgramacionModal(true)}
                  className="bg-[#A2D9F7] hover:bg-[#8BCBE8] text-black font-medium gap-2 shrink-0"
                  disabled={userOwnContent.length === 0}
                  title={userOwnContent.length === 0 ? 'Necesitas contenidos en tu biblioteca' : 'Crear nueva programación'}
                >
                  <PlusCircle size={16} />
                  <span className="hidden sm:inline">Nueva programación</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAssignedContent ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#A2D9F7] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">Cargando contenidos...</p>
                </div>
              ) : groupedByProgramacion.length > 0 ? (
                <div className="space-y-6">
                  {groupedByProgramacion.map((group, groupIndex) => {
                    const isPaused = group.programacionEstado === 'pausado';
                    const isActive = group.programacionEstado === 'activo';
                    const totalDuration = group.contenidos.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
                    
                    return (
                      <motion.div
                        key={group.programacionId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: groupIndex * 0.1, duration: 0.4 }}
                        className={`rounded-xl border ${isActive ? 'border-emerald-500/30 bg-emerald-500/5' : isPaused ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/50 bg-card/30'} overflow-hidden`}
                      >
                        {/* Header de la Programación */}
                        <div className={`px-4 py-3 flex items-center justify-between ${isActive ? 'bg-emerald-500/10' : isPaused ? 'bg-amber-500/10' : 'bg-muted/20'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : isPaused ? 'bg-amber-500' : 'bg-gray-500'}`} />
                            <div>
                              <h3 className="font-semibold text-foreground/90 text-sm">
                                {group.programacionNombre || 'Programación sin nombre'}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {group.contenidos.length} contenido{group.contenidos.length !== 1 ? 's' : ''} · {totalDuration}s total
                              </p>
                            </div>
                          </div>
                          
                          {/* Botones de la programación */}
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 text-[10px] rounded-md border font-sans whitespace-nowrap mr-2 ${
                              isActive ? statusStyles['Activo'] : 
                              isPaused ? 'text-amber-600 dark:text-amber-400 border-amber-500/70 bg-amber-500/10' : 
                              statusStyles['Borrador']
                            }`}>
                              {isActive ? 'Activo' : isPaused ? 'Pausado' : 'Inactivo'}
                            </span>
                            
                            {/* Botón Activar/Pausar */}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-8 w-8 ${isActive 
                                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10' 
                                : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10'}`}
                              onClick={() => handleToggleProgramacion(group.programacionId, group.programacionEstado)}
                              title={isActive ? 'Pausar programación' : 'Activar programación'}
                            >
                              {isActive ? <Pause size={16} /> : <Play size={16} />}
                            </Button>
                            
                            {/* Botón Editar */}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-[#A2D9F7] hover:bg-[#A2D9F7]/10"
                              onClick={() => handleEditProgramacion(group)}
                              title="Editar programación"
                            > 
                              <Edit3 size={16} /> 
                            </Button>
                          </div>
                        </div>
                        
                        {/* Contenidos de la programación */}
                        <div className={`p-3 ${isPaused ? 'opacity-60' : ''}`}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {group.contenidos.map((item) => {
                              const isPlayDisabled = isManualPlaybackActive || playingContentId === item.id;
                              
                              return (
                                <div
                                  key={item.id}
                                  className={`rounded-lg border ${item.color?.split(' ')[2] || 'border-gray-500/30'} border-l-4 bg-card/60 hover:bg-card/80 transition-colors`}
                                >
                                  <div className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-medium text-foreground/90 text-sm leading-tight line-clamp-2">{item.name}</h4>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 text-muted-foreground hover:text-[#A2D9F7] hover:bg-[#A2D9F7]/10 flex-shrink-0 ml-2"
                                        onClick={() => item.url_s3 && handlePlayContent(item.originalItem)}
                                        disabled={!item.url_s3 || isPlayDisabled}
                                        title="Reproducir"
                                      > 
                                        {playingContentId === item.id ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                                      </Button>
                                    </div>
                                    <div className="flex items-center text-xs text-muted-foreground gap-2">
                                      {getTypeIcon(item.type)}
                                      <span>{item.type}</span>
                                      <span>·</span>
                                      <span>{item.duration}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{item.voice}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Archive size={56} className="mx-auto text-muted-foreground/40 mb-5" />
                  <h3 className="text-2xl text-foreground font-sans">No tienes contenidos programados</h3>
                  <p className="text-muted-foreground text-sm mt-1 font-sans">Cuando tengas programaciones activas, sus contenidos aparecerán aquí.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Pestaña "Biblioteca" - Todos los contenidos del usuario */}
        <TabsContent value="library">
          <Card className="mb-8 bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl text-foreground font-sans">
                Tu Biblioteca de Contenidos
              </CardTitle>
              <CardDescription className="text-muted-foreground font-sans">
                Todos tus contenidos creados (indicativos, anuncios, mensajes)
              </CardDescription>
              <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center">
                <div className="relative flex-grow w-full sm:w-auto">
                  <Input
                    type="search"
                    placeholder="Busca en tus contenidos..."
                    className="pl-9 pr-3 py-2.5 bg-background/50" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] text-sm py-2.5 bg-background/50">
                    <Filter size={14} className="mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Tipos</SelectItem>
                    <SelectItem value="Indicativo">Indicativo</SelectItem>
                    <SelectItem value="Anuncio">Anuncio</SelectItem>
                    <SelectItem value="Mensaje">Mensaje</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingOwnContent ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#A2D9F7] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">Cargando contenidos...</p>
                </div>
              ) : filteredLibraryContent.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {filteredLibraryContent.map((ad, i) => (
                    <motion.div
                      key={ad.id}
                      custom={i}
                      variants={adCardVariants}
                      initial="initial"
                      animate="animate"
                    >
                      <Card className={`overflow-hidden h-full flex flex-col border-l-4 ${ad.color?.split(' ')[2] || 'border-gray-500/30'} bg-card/80 hover:bg-card/95 transition-colors`}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg font-semibold text-foreground/90 font-sans leading-tight">{ad.name}</CardTitle>
                            <span className={`px-2 py-0.5 text-[10px] rounded-md border font-sans whitespace-nowrap ${statusStyles[ad.status] || statusStyles['Borrador']}`}>
                              {ad.status}
                            </span>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            {getTypeIcon(ad.type)}
                            <span className="ml-1.5">{ad.type}</span>
                            <span className="mx-1.5">·</span>
                            <span>{ad.duration}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-grow pt-0 pb-3">
                          <p className="text-xs text-muted-foreground font-sans">Voz: {ad.voice}</p>
                          <p className="text-xs text-muted-foreground font-sans">Última mod.: {ad.lastModified}</p>
                        </CardContent>
                        <CardFooter className="py-2.5 px-4 bg-muted/20 dark:bg-muted/10 border-t border-border/60 flex justify-end space-x-1.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-[#A2D9F7] hover:bg-[#A2D9F7]/10"
                            onClick={() => ad.isReal && ad.url_s3 && handlePlayRecentContent(ad)}
                            disabled={!ad.isReal || !ad.url_s3 || isManualPlaybackActive || playingContentId === ad.id}
                          > 
                            {playingContentId === ad.id ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-[#A2D9F7] hover:bg-[#A2D9F7]/10"> <Copy size={14} /> </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-[#A2D9F7] hover:bg-[#A2D9F7]/10"> <Edit3 size={15} /> </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500/80 hover:text-rose-600 hover:bg-rose-500/10"> <Trash2 size={15} /> </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Archive size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-xl sm:text-2xl text-muted-foreground font-sans">No tienes contenidos en tu biblioteca</p>
                  <p className="text-muted-foreground/70 text-xs sm:text-sm mt-1 font-sans">Los contenidos que crees aparecerán aquí.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de nueva programación */}
      <NewProgramacionModal
        open={showNewProgramacionModal}
        onClose={setShowNewProgramacionModal}
        userContents={userOwnContent}
        onSave={reloadContent}
      />

      {/* Modal de edición de programación */}
      <EditProgramacionModal
        open={!!editingProgramacion}
        onClose={() => setEditingProgramacion(null)}
        programacion={editingProgramacion}
        onSave={reloadContent}
        onDelete={reloadContent}
      />
    </div>
  );
};

export default ContentsPage;
