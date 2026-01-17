import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Users, 
  Activity,
  RefreshCw,
  Clock,
  Radio,
  Music,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveUsersPresenceAdmin } from '@/hooks/useLiveUsersPresenceAdmin';
import { useOptimizedUserMapAdmin } from '@/hooks/useOptimizedUserMapAdmin';
import InteractiveUserMap from '@/components/admin/InteractiveUserMap';
import logger from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { getCurrentVersion, isVersionOutdated, getOutdatedLevel } from '@/lib/appVersion';
import { AlertTriangle } from 'lucide-react';

/**
 * Página dedicada al Mapa de Ubicaciones
 * Muestra geográficamente todos los usuarios conectados en tiempo real
 */
const MapPage = () => {
  const { user } = useAuth();
  const [mapFilter, setMapFilter] = useState('all'); // all, online, offline
  
  // 🔒 Obtener empresas asignadas al administrador
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [currentVersion, setCurrentVersion] = useState(null);

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
      logger.dev('🗺️ MapPage - Datos del mapa:', {
        loading: mapData.loading,
        error: mapData.error,
        usersCount: mapData.usersWithLocation?.length || 0,
        liveUsersCount: presence.liveUsers?.length || 0,
        empresasIds: adminEmpresaIds
      });
    }
  }, [mapData.usersWithLocation, mapData.loading, mapData.error, presence.liveUsers, adminEmpresaIds, loadingEmpresas]);

  const statusCounts = {
    total: mapData.usersWithLocation?.length || 0,
    online: mapData.usersWithLocation?.filter(u => u.connection_status === 'online').length || 0,
    offline: mapData.usersWithLocation?.filter(u => u.connection_status === 'offline').length || 0
  };

  const filterButtons = [
    { id: 'all', label: 'Todos', count: statusCounts.total, color: 'text-blue-500' },
    { id: 'online', label: 'Online', count: statusCounts.online, color: 'text-green-500' },
    { id: 'offline', label: 'Offline', count: statusCounts.offline, color: 'text-red-500' }
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mapa en Directo</h1>
            <p className="text-muted-foreground mt-1">
              Visualización geográfica en tiempo real de todos los usuarios
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
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

        {/* Filtros */}
        <div className="flex items-center gap-4 flex-wrap">
          {filterButtons.map((btn) => (
            <Button
              key={btn.id}
              variant={mapFilter === btn.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMapFilter(btn.id)}
              className="gap-2 h-10"
            >
              {btn.id === 'all' ? (
                <Users className="w-4 h-4" />
              ) : btn.id === 'online' ? (
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              ) : (
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
              )}
              <span className="font-medium">{btn.label}</span>
              <span className="text-sm">({btn.count})</span>
            </Button>
          ))}
        </div>

        {/* Mapa Interactivo */}
        <Card className="p-6">
          <div className="w-full h-[600px] rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
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

        {/* Lista de usuarios en tiempo real */}
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

                      {/* Versión */}
                      <div className="min-w-[80px] text-right">
                        {usuario.app_version ? (
                          <div className="text-xs flex items-center justify-end gap-1">
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
                        ) : (
                          <span className="text-xs text-muted-foreground">Web</span>
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
      </div>
    </AdminLayout>
  );
};

export default MapPage;

