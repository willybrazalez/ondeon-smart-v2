import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Radio, 
  Activity, 
  TrendingUp,
  MapPin,
  Music,
  Podcast,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Calendar,
  UserCog,
  Tag
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLiveUsersPresenceAdmin } from '@/hooks/useLiveUsersPresenceAdmin';
import { useOptimizedUserMapAdmin } from '@/hooks/useOptimizedUserMapAdmin';
import InteractiveUserMap from '@/components/admin/InteractiveUserMap';
import logger from '@/lib/logger';
import { getCurrentVersion, isVersionOutdated, getOutdatedLevel } from '@/lib/appVersion';
import { AlertTriangle } from 'lucide-react';

/**
 * Dashboard principal de administración
 * Muestra estadísticas generales y mapa de ubicaciones
 */
const AdminDashboard = () => {
  const { user } = useAuth();
  
  // 🔒 Obtener empresas asignadas al administrador
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [currentVersion, setCurrentVersion] = useState(null);

  // 🔧 Actualizar presencia del admin al entrar al dashboard
  // NOTA: NO sobrescribir playback_state - el OptimizedPresenceService lo maneja
  useEffect(() => {
    const updateAdminPresence = async () => {
      if (!user) return;
      
      const userId = user?.id || user?.usuario_id || user?.user_id;
      if (!userId) return;
      
      try {
        const now = new Date().toISOString();
        
        // Verificar si ya existe el registro
        const { data: existing } = await supabase
          .from('user_current_state')
          .select('usuario_id')
          .eq('usuario_id', userId)
          .single();
        
        if (existing) {
          // Si existe, solo actualizar timestamps SIN tocar estado de reproducción
          const { error } = await supabase
            .from('user_current_state')
            .update({
              is_online: true,
              last_seen_at: now,
              updated_at: now
            })
            .eq('usuario_id', userId);
          
          if (error) throw error;
          logger.dev('✅ Presencia del admin actualizada (sin sobrescribir estado de reproducción)');
        } else {
          // Si no existe, crear registro inicial (solo la primera vez)
          const { error } = await supabase
            .from('user_current_state')
            .insert({
              usuario_id: userId,
              is_online: true,
              last_seen_at: now,
              session_started_at: now,
              updated_at: now
            });
          
          if (error) throw error;
          logger.dev('✅ Presencia del admin creada inicialmente');
        }
      } catch (e) {
        logger.error('❌ Error actualizando presencia del admin:', e);
      }
    };
    
    updateAdminPresence();

    // Cleanup: Marcar como offline al salir del dashboard
    return () => {
      if (!user) return;
      
      const userId = user?.id || user?.usuario_id || user?.user_id;
      if (!userId) return;
      
      // No hacer logout automático, solo dejar de actualizar
      // El heartbeat ligero seguirá funcionando si está activo
      logger.dev('🧹 Admin saliendo del dashboard - heartbeat mantendrá presencia');
    };
  }, [user]);

  // Cargar empresas del admin (a través de sus marcas)
  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user) return;
      
      try {
        setLoadingEmpresas(true);
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
      } finally {
        setLoadingEmpresas(false);
      }
    };

    fetchAdminEmpresas();
  }, [user]);
  
  // Hooks para datos en vivo
  // Usar useMemo para evitar crear nuevos arrays en cada render (causa loop infinito)
  const empresasParaHooks = useMemo(() => {
    return loadingEmpresas ? [] : adminEmpresaIds;
  }, [loadingEmpresas, adminEmpresaIds]);
  
  const presence = useLiveUsersPresenceAdmin(empresasParaHooks);
  const mapData = useOptimizedUserMapAdmin(presence.liveUsers, empresasParaHooks);

  // Cargar versión actual de la aplicación
  useEffect(() => {
    setCurrentVersion(getCurrentVersion());
  }, []);

  // DEBUG: Ver qué datos tenemos para el mapa
  useEffect(() => {
    if (!loadingEmpresas) {
      logger.dev('🗺️ AdminDashboard - Datos del mapa:', {
        loading: mapData.loading,
        error: mapData.error,
        usersCount: mapData.usersWithLocation?.length || 0,
        liveUsersCount: presence.liveUsers?.length || 0,
        empresasIds: adminEmpresaIds
      });
    }
  }, [mapData.usersWithLocation, mapData.loading, mapData.error, presence.liveUsers, adminEmpresaIds, loadingEmpresas]);

  const [stats, setStats] = useState({
    totalUsers: 0,
    connectedUsers: 0,
    disconnectedUsers: 0,
    totalChannels: 0,
    activeProgramaciones: 0,
    totalBrands: 0
  });

  const [loading, setLoading] = useState(true);
  
  // Estado para filtros del mapa
  const [mapFilter, setMapFilter] = useState('all'); // 'all', 'online', 'offline'

  // Calcular estadísticas en tiempo real
  useEffect(() => {
    const calculateStats = async () => {
      const totalUsers = presence.totalUsers;
      const connectedUsers = presence.liveUsers.filter(u => u.connection_status === 'online').length;
      const disconnectedUsers = totalUsers - connectedUsers;
      
      // Obtener canales a través de la tabla de relación empresa_canales
      let totalChannels = 0;
      if (adminEmpresaIds.length > 0) {
        const { count: channelsCount } = await supabase
          .from('empresa_canales')
          .select('canal_id', { count: 'exact', head: true })
          .in('empresa_id', adminEmpresaIds);
        totalChannels = channelsCount || 0;
      }
      
      // Obtener marcas activas
      const { count: brandsCount } = await supabase
        .from('marcas')
        .select('*', { count: 'exact', head: true })
        .eq('activa', true);
      const totalBrands = brandsCount || 0;
      
      // Obtener programaciones activas a través de usuarios de las empresas
      let activeProgramaciones = 0;
      if (adminEmpresaIds.length > 0) {
        // Primero obtener usuarios de las empresas
        const { data: usuarios } = await supabase
          .from('usuarios')
          .select('id')
          .in('empresa_id', adminEmpresaIds);
        
        if (usuarios && usuarios.length > 0) {
          const userIds = usuarios.map(u => u.id);
          
          // Obtener programaciones activas asignadas a estos usuarios
          const { data: progData } = await supabase
            .from('programacion_destinatarios')
            .select('programacion_id')
            .in('usuario_id', userIds);
          
          if (progData && progData.length > 0) {
            const progIds = [...new Set(progData.map(p => p.programacion_id))];
            
            const { count: progCount } = await supabase
              .from('programaciones')
              .select('*', { count: 'exact', head: true })
              .in('id', progIds)
              .eq('estado', 'activo');
            
            activeProgramaciones = progCount || 0;
          }
        }
      }
      
      setStats({
        totalUsers,
        connectedUsers,
        disconnectedUsers,
        totalChannels,
        activeProgramaciones,
        totalBrands
      });
      setLoading(false);
    };
    
    if (!loadingEmpresas) {
      calculateStats();
    }
  }, [presence.liveUsers, presence.totalUsers, adminEmpresaIds, loadingEmpresas]);

  const statCards = [
    {
      title: 'Usuarios Totales',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Usuarios Conectados',
      value: stats.connectedUsers,
      icon: Activity,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Usuarios Desconectados',
      value: stats.disconnectedUsers,
      icon: Users,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Canales',
      value: stats.totalChannels,
      icon: Radio,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Programaciones Activas',
      value: stats.activeProgramaciones,
      icon: Music,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Marcas Activas',
      value: stats.totalBrands,
      icon: Tag,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    }
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visión general del sistema Ondeon Smart
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>Actualizado hace 2 minutos</span>
          </div>
        </div>

        {/* Cards de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold mt-2">
                      {loading ? '...' : stat.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Mapa de ubicaciones en vivo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Mapa en Directo</h2>
                <span className="ml-2 text-sm text-muted-foreground">
                  {stats.activeUsers} online de {stats.totalUsers}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={presence.refreshData}
                  disabled={presence.loading}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${presence.loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </div>
            
            {/* Filtros del mapa */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-muted-foreground mr-2">Filtrar:</span>
              <Button
                variant={mapFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMapFilter('all')}
                className="gap-2 h-8"
              >
                <Users className="w-3 h-3" />
                Todos ({mapData.usersWithLocation.length})
              </Button>
              <Button
                variant={mapFilter === 'online' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMapFilter('online')}
                className="gap-2 h-8"
              >
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Online ({mapData.usersWithLocation.filter(u => u.connection_status === 'online').length})
              </Button>
              <Button
                variant={mapFilter === 'offline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMapFilter('offline')}
                className="gap-2 h-8"
              >
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                Offline ({mapData.usersWithLocation.filter(u => u.connection_status === 'offline').length})
              </Button>
            </div>

            {/* Mapa */}
            <div className="w-full h-[500px] rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
              {mapData.loading ? (
                <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2 animate-pulse" />
                    <p className="text-sm text-muted-foreground">Cargando ubicaciones...</p>
                  </div>
                </div>
              ) : mapData.error ? (
                <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    <p className="text-sm text-red-500">Error cargando ubicaciones</p>
                    <p className="text-xs text-muted-foreground mt-1">{mapData.error}</p>
                  </div>
                </div>
              ) : (
                <InteractiveUserMap 
                  usersWithLocation={mapData.usersWithLocation} 
                  filterMode={mapFilter}
                />
              )}
            </div>
          </Card>
        </motion.div>

        {/* Lista de usuarios en tiempo real */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Lista Completa de Usuarios</h2>
                <span className="ml-2 px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium">
                  {presence.totalUsers} usuarios
                </span>
              </div>
            </div>
            
            {presence.loading ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
              </div>
            ) : presence.liveUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay usuarios para mostrar</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {presence.liveUsers.map((usuario) => {
                    const isOnline = usuario.connection_status === 'online';
                    const nombreCompleto = [usuario.nombre, usuario.apellidos].filter(Boolean).join(' ');
                    
                    return (
                      <div 
                        key={usuario.usuario_id} 
                        className="flex items-center gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      >
                        {/* Indicador de conexión + Usuario */}
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Activity 
                            className={`w-5 h-5 ${isOnline ? 'text-green-500' : 'text-red-500/50'}`}
                          />
                          <div>
                            <p className="font-semibold text-base">@{usuario.username}</p>
                            {nombreCompleto && (
                              <p className="text-xs text-muted-foreground">{nombreCompleto}</p>
                            )}
                          </div>
                        </div>

                        {/* Estado */}
                        <div className="min-w-[120px]">
                          {isOnline ? (
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                              usuario.playback_state === 'playing' 
                                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                : usuario.playback_state === 'paused'
                                ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                            }`}>
                              {usuario.playback_state === 'playing' ? 'Playing' :
                               usuario.playback_state === 'paused' ? 'Paused' : 'Stopped'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Desconectado</span>
                          )}
                        </div>

                        {/* Duración */}
                        <div className="min-w-[100px]">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className={isOnline ? 'text-foreground' : 'text-muted-foreground'}>
                              {usuario.duracion || '00h 00m 00s'}
                            </span>
                          </div>
                        </div>

                        {/* Canal */}
                        <div className="flex-1 min-w-[150px]">
                          {isOnline && usuario.current_canal_name ? (
                            <div className="flex items-center gap-2">
                              <Radio className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm truncate">{usuario.current_canal_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>

                        {/* Reproduciendo */}
                        <div className="flex-1 min-w-[200px]">
                          {isOnline && (usuario.current_song_title || usuario.current_song_artist) ? (
                            <div className="flex items-center gap-2">
                              <Music className="w-3 h-3 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {usuario.current_song_title || 'Sin título'}
                                </p>
                                {usuario.current_song_artist && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {usuario.current_song_artist}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>

                        {/* Versión / Cliente */}
                        <div className="min-w-[100px] text-right">
                          {usuario.app_version ? (
                            <div className="text-xs flex flex-col items-end gap-0.5">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-muted-foreground">v</span>
                                <span>{usuario.app_version}</span>
                                {currentVersion && isVersionOutdated(usuario.app_version, currentVersion) && (
                                  <span 
                                    className="inline-flex items-center"
                                    title={`Versión antigua. Versión actual: v${currentVersion}`}
                                  >
                                    <AlertTriangle 
                                      className={`w-3 h-3 ${
                                        getOutdatedLevel(usuario.app_version, currentVersion) === 'critical' 
                                          ? 'text-red-500' 
                                          : getOutdatedLevel(usuario.app_version, currentVersion) === 'major'
                                          ? 'text-orange-500'
                                          : 'text-yellow-500'
                                      }`} 
                                    />
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground/70">
                                {usuario.client_type === 'app' ? '📱 App' : usuario.client_type === 'web' ? '🌐 Web' : ''}
                              </span>
                            </div>
                          ) : (
                            <div className="text-xs flex flex-col items-end gap-0.5">
                              <span className="text-muted-foreground">
                                {usuario.client_type === 'app' ? '📱 App' : '🌐 Web'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((presence.currentPage - 1) * presence.pageSize) + 1} - {Math.min(presence.currentPage * presence.pageSize, presence.totalUsers)} de {presence.totalUsers} usuarios
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={presence.previousPage}
                      disabled={presence.currentPage === 1 || presence.loading}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm px-3">
                      Página {presence.currentPage} de {presence.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={presence.nextPage}
                      disabled={presence.currentPage === presence.totalPages || presence.loading}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;

