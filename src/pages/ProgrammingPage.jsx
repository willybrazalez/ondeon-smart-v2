import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, ListChecks, CalendarDays, Search, Filter, Clock, Tag, PlayCircle, Edit3, Trash2, Copy, Eye, Archive, Brain, Settings, ArrowLeft, ExternalLink, Zap, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { PermissionGated } from '@/components/RoleProtectedRoute';
import { contentAssignmentsApi } from '@/lib/api';
import audioPlayer from '@/services/audioPlayerService';
import optimizedPresenceService from '@/services/optimizedPresenceService';
import { useToast } from '@/components/ui/use-toast';
import logger from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';
import ContentCard from '@/components/ContentCard';
import { stripeApi } from '@/lib/stripeApi';

const recentAdsData = [
  { id: 'adR001', name: 'Bienestar Digestivo Semanal', type: 'Consejo de Salud', duration: '45s', status: 'Activo', lastModified: '2025-05-26', voice: 'Narrador Sereno', keywords: ['digestión', 'salud intestinal', 'probióticos', 'bienestar'], color: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/30' },
  { id: 'adR002', name: 'Oferta Exclusiva Primavera', type: 'Promoción', duration: '30s', status: 'Programado', lastModified: '2025-05-25', voice: 'Profesional Clara', keywords: ['oferta', 'descuento', 'primavera', 'ahorro'], color: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30' },
  { id: 'adR003', name: 'Charla Nutricional Online', type: 'Evento', duration: '60s', status: 'Borrador', lastModified: '2025-05-24', voice: 'Voz Amable', keywords: ['nutrición', 'charla', 'online', 'saludable', 'vitaminas'], color: 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 border-violet-500/30' },
  { id: 'adR004', name: 'Recordatorio Vacunación Gripe', type: 'Aviso Importante', duration: '25s', status: 'Activo', lastModified: '2025-05-23', voice: 'Directa Nítida', keywords: ['vacuna', 'gripe', 'prevención', 'recordatorio'], color: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-500/30' },
  { id: 'adR005', name: 'Nuevos Productos Solares', type: 'Novedad', duration: '35s', status: 'Activo', lastModified: '2025-05-22', voice: 'Profesional Clara', keywords: ['solar', 'protección', 'verano', 'nuevo'], color: 'bg-teal-500/15 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 border-teal-500/30' },
  { id: 'adR006', name: 'Consejos para un Sueño Reparador', type: 'Consejo de Salud', duration: '50s', status: 'Activo', lastModified: '2025-05-27', voice: 'Narrador Sereno', keywords: ['sueño', 'descanso', 'insomnio', 'relajación', 'bienestar'], color: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/30' },
];

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
    default: return <ListChecks size={18} className="text-gray-500" />;
  }
};

// 🎨 Colores y funciones de contenido movidos a ContentCard.jsx

const ProgrammingPage = () => {
  const { user, userRole, userPlan, isManualPlaybackActive, startManualPlayback, loading } = useAuth();
  const { hasPermission } = useRole();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isAISearchActive, setIsAISearchActive] = useState(false);
  const [userAssignedContent, setUserAssignedContent] = useState([]);
  const [loadingAssignedContent, setLoadingAssignedContent] = useState(false);
  const [playingContentId, setPlayingContentId] = useState(null); // Estado local para UI de este botón específico
  const [upgradeLoading, setUpgradeLoading] = useState(false); // Loading para el botón de upgrade
  
  // 🔧 CORREGIDO: userRole es un número, no un objeto
  const isBasicUser = userRole === 1;
  const isGestor = userRole === 2;
  const isAdmin = userRole === 3;
  
  // 💰 Verificar si el usuario tiene plan Pro
  const isPlanPro = userPlan === 'Ondeón Pro';
  const isPlanBasico = userPlan === 'Ondeón Básico' || (!userPlan && isGestor);
  
  // 🔧 Usuarios básicos (rol_id=1), gestores (rol_id=2) y administradores (rol_id=3) solo ven "Programados"
  // Los gestores en desktop ven la misma UI simplificada que los básicos
  const shouldShowOnlyScheduled = isBasicUser || isGestor || isAdmin;
  
  // 🔄 Función de recarga para actualizar contenidos después de ediciones
  // ⚠️ IMPORTANTE: Todos los hooks deben estar ANTES de cualquier return condicional
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
        // 🔧 Obtener contenidos de programaciones activas/pausadas
        const content = await contentAssignmentsApi.getUserProgrammingContent(userId);
        setUserAssignedContent(content);
        
        // 🎯 Extraer IDs de programaciones para suscripciones específicas
        const programacionIds = [...new Set(content.map(item => item.programacion_id))];
        
        // 🔄 Configurar suscripción a contenidos si hay programaciones
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
        
        // 🔄 Configurar suscripción a estados de programaciones
        if (programacionIds.length > 0 && !subscription3) {
          logger.dev(`📡 Configurando suscripción a estados de ${programacionIds.length} programación(es)...`);
          
          subscription3 = supabase
            .channel(`user-prog-estados-${userId}-${Date.now()}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE', // Solo cambios
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

    // 🔄 SUSCRIPCIÓN 1: Asignaciones de programaciones del usuario
    logger.dev('📡 Configurando suscripción optimizada para TUS programaciones...');

    subscription1 = supabase
      .channel(`user-programaciones-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'programacion_destinatarios',
          filter: `usuario_id=eq.${userId}` // 🎯 Solo TUS asignaciones
        },
        (payload) => {
          logger.dev('🔄 Cambio en TUS asignaciones de programaciones:', payload);
          
          // 🧹 Limpiar suscripciones de contenidos/estados y recrear
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
  }, [user?.id]); // ✅ Dependencia específica en lugar de todo el objeto user

  const handlePlayContent = async (assignment) => {
    if (!assignment?.contenidos?.url_s3) {
      toast({ title: 'Error', description: 'Contenido sin URL', variant: 'destructive' });
      return;
    }
    
    // Convertir URL a CloudFront
    const cloudFrontUrl = convertToCloudFrontUrl(assignment.contenidos.url_s3);
    
    // 🎵 Activar bloqueo global antes de reproducir
    const contentName = assignment.contenidos?.nombre || 'Contenido';
    const duration = assignment.contenidos?.duracion_segundos || 30;
    
    // 🔧 NUEVO: Detectar modo_audio de la programación
    const modoAudio = assignment.programacion_info?.modo_audio || 'fade_out';
    const esModoBackground = modoAudio === 'background';
    
    logger.dev('🎵 Reproduciendo contenido manualmente:', {
      nombre: contentName,
      duracion: duration,
      modoAudio: modoAudio,
      programacion: assignment.programacion_info?.descripcion
    });
    
    try {
      setPlayingContentId(assignment.id);
      
      // 🔒 Bloquear TODOS los controles de reproducción en toda la app
      startManualPlayback(assignment.id, contentName, duration);
      
      // 📊 Registrar inicio de contenido manual
      const currentState = audioPlayer.getState();
      await optimizedPresenceService.sendManualContentStarted({
        title: contentName,
        type: assignment.contenidos?.tipo || 'manual',
        channelId: currentState.currentChannelId,
        channelName: currentState.currentChannelName || 'Sin canal',
        duration: duration,
        fileUrl: assignment.contenidos.url_s3
      });
      
      toast({ 
        title: 'Reproduciendo manualmente', 
        description: `${contentName} - ${esModoBackground ? 'Con música de fondo' : 'Modo fade'} - Controles bloqueados durante ${duration}s`,
        className: "bg-blue-500 text-white dark:bg-blue-600 dark:text-white border-none shadow-lg",
      });
      
      // 🔧 NUEVO: Elegir función según modo_audio
      if (esModoBackground) {
        // Modo background: música de fondo continua
        await audioPlayer.playContentWithBackground(cloudFrontUrl);
      } else {
        // Modo fade_out: fade out/in tradicional
        await audioPlayer.playContentWithFade(cloudFrontUrl, duration);
      }
      
      // 📊 Registrar fin de contenido manual
      await optimizedPresenceService.sendManualContentEnded({
        title: contentName,
        actualDuration: duration
      });
      
      toast({ 
        title: 'Reproducción finalizada', 
        description: `${contentName} ha terminado - Controles desbloqueados`,
        className: "bg-green-500 text-white dark:bg-green-600 dark:text-white border-none shadow-lg",
      });
    } catch (err) {
      toast({ title: 'Error de reproducción', description: 'No se pudo reproducir el contenido', variant: 'destructive' });
      
      // 📊 Registrar fin incluso en error
      try {
        await optimizedPresenceService.sendManualContentEnded({
          title: contentName,
          actualDuration: 0
        });
      } catch (e) {
        // Ignorar error de logging
      }
    } finally {
      setPlayingContentId(null);
      // Nota: El estado global se limpiará automáticamente después de la duración
    }
  };

  const filteredRecentAds = useMemo(() => {
    let isAISimulated = false;
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (!lowerSearchTerm && filterType === 'all') {
      setIsAISearchActive(false);
      return recentAdsData;
    }

    const results = recentAdsData.filter(ad => {
      const matchesType = filterType === 'all' || ad.type === filterType;
      if (!matchesType) return false;

      const directMatch = ad.name.toLowerCase().includes(lowerSearchTerm) ||
                          ad.type.toLowerCase().includes(lowerSearchTerm);
      if (directMatch) return true;

      if (lowerSearchTerm.length > 3) { 
        const searchKeywords = lowerSearchTerm.split(" ").filter(k => k.length > 2);
        const adKeywordsMatch = ad.keywords.some(kw => 
          searchKeywords.some(skw => kw.includes(skw) || skw.includes(kw))
        );
        if (adKeywordsMatch) {
          isAISimulated = true;
          return true;
        }
      }
      return false;
    });
    setIsAISearchActive(isAISimulated && results.length > 0);
    return results;
  }, [searchTerm, filterType]);


  const adCardVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95, filter: 'blur(3px)' },
    animate: (i) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
    }),
    hover: {
      scale: 1.03,
      boxShadow: "0px 8px 25px -5px hsla(var(--primary-rgb), 0.15), 0px 5px 10px -6px hsla(var(--primary-rgb), 0.1)",
      transition: { duration: 0.2, ease: "circOut" }
    }
  };

  // 🔒 Guard: Mostrar loading mientras se determina el rol del usuario
  // ⚠️ IMPORTANTE: Este guard DEBE estar DESPUÉS de todos los hooks
  logger.dev('🔍 ProgrammingPage - userRole:', userRole, 'isBasicUser:', isBasicUser, 'isAdmin:', isAdmin, 'shouldShowOnlyScheduled:', shouldShowOnlyScheduled);
  
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: "circOut" }}
      className="p-4 sm:p-6 md:p-8"
    >
      <div className="text-center mb-8 sm:mb-10">
        <motion.h1 
          className="text-4xl sm:text-5xl font-sans font-bold text-black dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-primary/90 dark:via-[#A2D9F7]/80 dark:to-accent/90"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Gestor de Contenidos
        </motion.h1>
      </div>
      
      {!shouldShowOnlyScheduled && (
        <div className="flex justify-center mb-6">
          <PermissionGated permissions={['canCreateImmediateAds']}>
            <Button asChild className="clean-button-primary group">
              <Link to="/anuncio-nuevo">
                <PlusCircle size={20} className="mr-2 group-hover:animate-spin" /> Crear Nuevo Anuncio
              </Link>
            </Button>
          </PermissionGated>
        </div>
      )}

      <Tabs defaultValue={shouldShowOnlyScheduled ? "scheduled" : "recents"} className="w-full">
        {/* 🔧 CONDICIONAL: Usuarios básicos (rol_id=1) y administradores (rol_id=3) solo ven "Programados" */}
        {shouldShowOnlyScheduled ? (
          <div className="flex items-center gap-3 mb-6">
            <TabsList className="flex-1 grid grid-cols-1 gap-2 bg-card/80 p-1.5 rounded-lg border border-border/70">
            <TabsTrigger value="scheduled" className="clean-button-tab data-[state=active]:shadow-md">Programados</TabsTrigger>
          </TabsList>
            {/* Botón crear contenidos - Solo para gestores */}
            {isGestor && (
              isPlanPro ? (
                // Plan Pro: Abrir dashboard de gestión
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const dashboardUrl = 'https://main.dnpo8nagdov1i.amplifyapp.com/gestor';
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(dashboardUrl);
                    } else {
                      window.open(dashboardUrl, '_blank');
                    }
                  }}
                  className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 text-sm font-medium"
                >
                  <PlusCircle size={16} className="mr-1.5" />
                  Crear Nuevos Contenidos
                  <ExternalLink size={12} className="ml-1 opacity-60" />
                </Button>
              ) : (
                // Plan Básico: Mostrar opción de upgrade
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={upgradeLoading}
                  onClick={async () => {
                    toast({
                      title: '⚡ Función exclusiva del Plan Pro',
                      description: 'Actualiza a Ondeón Pro para crear contenidos personalizados, anuncios con IA y más.',
                      className: 'bg-amber-500/90 text-white border-none',
                    });
                    
                    // Abrir portal de Stripe para upgrade
                    try {
                      setUpgradeLoading(true);
                      const authUserId = user?.auth_user_id || user?.id;
                      if (authUserId) {
                        await stripeApi.openUpdateSubscription(authUserId);
                      } else {
                        // Fallback: abrir web dashboard
                        const url = 'https://main.dnpo8nagdov1i.amplifyapp.com/gestor?upgrade=true';
                        if (window.electronAPI?.openExternal) {
                          window.electronAPI.openExternal(url);
                        } else {
                          window.open(url, '_blank');
                        }
                      }
                    } catch (err) {
                      logger.error('Error abriendo portal de upgrade:', err);
                      toast({
                        title: 'Error',
                        description: 'No se pudo abrir el portal de suscripción. Intenta de nuevo.',
                        variant: 'destructive',
                      });
                    } finally {
                      setUpgradeLoading(false);
                    }
                  }}
                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-sm font-medium"
                >
                  {upgradeLoading ? (
                    <Loader2 size={16} className="mr-1.5 animate-spin" />
                  ) : (
                    <Zap size={16} className="mr-1.5" />
                  )}
                  Crear Nuevos Contenidos
                </Button>
              )
            )}
          </div>
        ) : (
          <TabsList className={`grid w-full ${hasPermission('canAccessDrafts') ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2 mb-6 bg-card/80 p-1.5 rounded-lg border border-border/70`}>
            <TabsTrigger value="recents" className="clean-button-tab data-[state=active]:shadow-md">Recientes</TabsTrigger>
            <TabsTrigger value="scheduled" className="clean-button-tab data-[state=active]:shadow-md">Programados</TabsTrigger>
            <PermissionGated permissions={['canAccessDrafts']}>
              <TabsTrigger value="drafts" className="clean-button-tab data-[state=active]:shadow-md">Borradores</TabsTrigger>
            </PermissionGated>
            <TabsTrigger value="library" className="clean-button-tab data-[state=active]:shadow-md">Biblioteca</TabsTrigger>
          </TabsList>
        )}

        {/* 🔧 Ocultar pestañas "Recientes" y "Borradores" para usuarios básicos y administradores */}
        {!shouldShowOnlyScheduled && (
          <>
            <TabsContent value="recents">
              <Card useCleanStyle={true} className="mb-8 animate-clean-pulse" style={{ animationDuration: '8s' }}>
                <CardHeader>
                  <CardTitle useCleanStyle={true} className="text-xl sm:text-2xl text-black dark:text-white font-sans">
                    Anuncios Editados Recientemente
                  </CardTitle>
              <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center">
                <div className="relative flex-grow w-full sm:w-auto">
                  <Input
                    type="search"
                    useCleanStyle={true}
                    placeholder="Busca en tus contenidos con IA..."
                    className="pl-9 pr-3 py-2.5" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/70" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger useCleanStyle={true} className="w-full sm:w-auto sm:min-w-[180px] text-sm py-2.5">
                    <Filter size={14} className="mr-2 text-primary/70" />
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent useCleanStyle={true}>
                    <SelectItem value="all">Todos los Tipos</SelectItem>
                    <SelectItem value="Consejo de Salud">Consejo de Salud</SelectItem>
                    <SelectItem value="Promoción">Promoción</SelectItem>
                    <SelectItem value="Evento">Evento</SelectItem>
                    <SelectItem value="Aviso Importante">Aviso Importante</SelectItem>
                    <SelectItem value="Novedad">Novedad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAISearchActive && searchTerm && (
                <motion.div 
                  initial={{opacity: 0, y: -10}}
                  animate={{opacity: 1, y: 0}}
                  className="mt-2.5 text-xs text-primary/90 flex items-center bg-primary/5 px-2 py-1 rounded-md border border-primary/20">
                  <Brain size={14} className="mr-1.5 text-accent animate-pulse" style={{animationDuration: '1.5s'}} />
                  Mostrando resultados inteligentes basados en tu búsqueda... (Simulación IA)
                </motion.div>
              )}
            </CardHeader>
            <CardContent>
              {filteredRecentAds.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {filteredRecentAds.map((ad, i) => (
                    <motion.div
                      key={ad.id}
                      custom={i}
                      variants={adCardVariants}
                      initial="initial"
                      animate="animate"
                      whileHover="hover"
                    >
                      <Card useCleanStyle={true} className={`overflow-hidden h-full flex flex-col border-l-4 ${ad.color.split(' ')[2]}`}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <CardTitle useCleanStyle={true} className="text-lg font-semibold text-foreground/90 font-sans leading-tight">{ad.name}</CardTitle>
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
                           {ad.keywords && ad.keywords.length > 0 && (
                            <p className="text-[11px] text-muted-foreground/70 font-sans mt-1.5 italic">
                              Palabras clave: {ad.keywords.slice(0,3).join(', ')}{ad.keywords.length > 3 ? '...' : ''}
                            </p>
                          )}
                        </CardContent>
                        <CardFooter className="py-2.5 px-4 bg-muted/20 dark:bg-muted/10 border-t border-border/60 flex justify-end space-x-1.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/80 hover:text-accent hover:bg-accent/10"> <PlayCircle size={16} /> </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/80 hover:text-accent hover:bg-accent/10"> <Copy size={14} /> </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/80 hover:text-accent hover:bg-accent/10"> <Edit3 size={15} /> </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500/80 hover:text-rose-600 hover:bg-rose-500/10"> <Trash2 size={15} /> </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Archive size={48} className="mx-auto text-primary/50 mb-4 animate-pulse" style={{ animationDuration: '4s' }} />
                  <p className="text-xl sm:text-2xl text-muted-foreground font-sans">No hay anuncios recientes que coincidan...</p>
                  <p className="text-muted-foreground/70 text-xs sm:text-sm mt-1 font-sans">Intenta con otros filtros o crea nuevos contenidos.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <PermissionGated permissions={['canAccessDrafts']}>
          <TabsContent value="drafts">
            <div className="text-center py-16">
              <Edit3 size={56} className="mx-auto text-primary/40 mb-5 animate-pulse" style={{ animationDuration: '3s' }} />
              <h3 className="text-2xl text-muted-foreground font-sans">Borradores en Progreso</h3>
              <p className="text-muted-foreground/80 text-sm mt-1.5 font-sans">Continúa editando tus ideas antes de publicarlas.</p>
            </div>
          </TabsContent>
        </PermissionGated>
          </>
        )}
        
        {/* 🔧 Pestaña "Programados" - visible para TODOS los usuarios */}
        <TabsContent value="scheduled">
          <Card useCleanStyle={true} className="mb-8">
            <CardHeader>
              <CardTitle useCleanStyle={true} className="text-xl sm:text-2xl text-black dark:text-white font-sans">
                Tus Contenidos Programados
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 font-sans">
                Contenidos de tus programaciones activas que puedes reproducir manualmente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAssignedContent ? (
                <div className="text-center py-10 text-gray-600 dark:text-gray-400">Cargando contenidos...</div>
              ) : userAssignedContent.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
                  {userAssignedContent.map((item) => {
                          const isPaused = item.programacion_info?.estado === 'pausado';
                          const isCompleted = item.programacion_info?.estado === 'completado';
                          const isDisabled = isManualPlaybackActive || isPaused || isCompleted;
                    const disabledReason = isCompleted
                            ? 'Programación completada - No disponible'
                            : isPaused 
                              ? 'Programación pausada - No disponible' 
                              : isManualPlaybackActive 
                                ? 'Reproducción en curso - Controles bloqueados' 
                          : '';
                          
                          return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ContentCard
                          item={item}
                          onPlay={handlePlayContent}
                          isPlaying={playingContentId === item.id}
                          isDisabled={isDisabled}
                          disabledReason={disabledReason}
                          onUpdate={reloadContent}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Archive size={56} className="mx-auto text-muted-foreground/40 mb-5" />
                  <h3 className="text-2xl text-black dark:text-white font-sans">No tienes contenidos programados</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 font-sans">Cuando tengas programaciones activas, sus contenidos aparecerán aquí.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 🔧 Pestaña "Biblioteca" - oculta para usuarios básicos y administradores */}
        {!shouldShowOnlyScheduled && (
          <TabsContent value="library">
            <div className="text-center py-16">
              <Archive size={56} className="mx-auto text-muted-foreground/40 mb-5 animate-pulse" style={{ animationDuration: '4s' }} />
              <h3 className="text-2xl text-black dark:text-white font-sans">Biblioteca de Contenidos</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 font-sans">Esta sección estará disponible próximamente para gestionar tu biblioteca de contenidos.</p>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </motion.div>
  );
};

export default ProgrammingPage;