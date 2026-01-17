import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';
import { getClientType } from '@/lib/clientType';

/**
 * Hook para gestionar la presencia de usuarios en vivo para administradores
 * Incluye paginación, filtros y optimización de egress
 * EXCLUYE al propio administrador del listado (pero lo incluye en el contador del mapa)
 */
export function useLiveUsersPresenceAdmin(adminEmpresaIds = []) {
  const { user } = useAuth();
  const [liveUsers, setLiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const pageSize = 20;

  const isLoadingRef = useRef(false);
  const channelRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      setLoading(true);
      setError(null);

      // 🔒 CRÍTICO: Filtrar por empresas asignadas
      // Si no hay empresas asignadas, esperar
      if (adminEmpresaIds.length === 0) {
        // No mostrar warning, simplemente esperar a que se carguen las empresas
        setTotalUsers(0);
        setLiveUsers([]);
        return;
      }

      // 🔒 FILTRO SEGURO: Solo usuarios de empresas asignadas
      const { count } = await supabase
        .from('user_current_state')
        .select('*, usuarios!inner(empresa_id)', { count: 'exact', head: true })
        .in('usuarios.empresa_id', adminEmpresaIds);
      
      setTotalUsers(count || 0);

      const offset = (currentPage - 1) * pageSize;

      // 🔒 FILTRO SEGURO: Solo usuarios de empresas asignadas, EXCLUYENDO al admin actual
      const userId = user?.id || user?.usuario_id || user?.user_id;
      
      const { data, error: err } = await supabase
        .from('user_current_state')
        .select(`
          usuario_id, is_online, last_seen_at, session_started_at,
          playback_state, current_canal_name,
          current_song_title, current_song_artist,
          app_version, device_id, metadata, current_session_id,
          usuarios!inner(id, username, nombre, apellidos, email, empresa_id, rol_id,
                        establecimiento, direccion, localidad, provincia, app_version),
          user_presence_sessions!current_session_id(device_info)
        `)
        .in('usuarios.empresa_id', adminEmpresaIds)
        .neq('usuario_id', userId)  // ❌ Excluir al propio admin del listado
        .order('last_seen_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (err) throw err;

      // Mapear datos
      const mapped = (data || []).map((u) => {
        const secondsSinceLastSeen = u.last_seen_at 
          ? Math.floor((Date.now() - new Date(u.last_seen_at).getTime()) / 1000) 
          : 9999;
        
        // 🔧 TOLERANCIA AMPLIADA: 3 minutos (180s) en lugar de 2 min
        // Esto evita falsos negativos cuando el heartbeat se retrasa ligeramente
        const isOnline = !!u.is_online && secondsSinceLastSeen < 180;
        
        // 🔍 DEBUG: Log para usuarios que aparecen como desconectados incorrectamente
        if (u.is_online && !isOnline) {
          logger.warn(`⚠️ Usuario ${u.usuarios?.username} marcado como OFFLINE:`, {
            is_online_db: u.is_online,
            secondsSinceLastSeen,
            last_seen_at: u.last_seen_at,
            computed_isOnline: isOnline
          });
        }
        
        // 📊 Calcular duración de sesión (formato: 00h 00m 00s)
        let duracion = '00h 00m 00s';
        if (u.session_started_at && isOnline) {
          const sessionStart = new Date(u.session_started_at);
          const now = new Date();
          const diffMs = now - sessionStart;
          
          if (diffMs > 0) {
            const hours = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            const seconds = Math.floor((diffMs % 60000) / 1000);
            duracion = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
          }
        }

        return {
          usuario_id: u.usuario_id,
          username: u.usuarios?.username || u.usuarios?.email?.split('@')[0] || 'Usuario',
          nombre: u.usuarios?.apellidos 
            ? `${u.usuarios?.nombre} ${u.usuarios?.apellidos}`.trim() 
            : (u.usuarios?.nombre || 'Usuario'),
          email: u.usuarios?.email || '',
          connection_status: isOnline ? 'online' : 'offline',
          playback_state: (u.playback_state || 'stopped'),
          current_canal_name: u.current_canal_name || undefined,
          current_song_title: u.current_song_title || undefined,
          current_song_artist: u.current_song_artist || undefined,
          // Usar app_version de user_current_state si existe, sino usar el de usuarios
          app_version: u.app_version || u.usuarios?.app_version || undefined,
          device_id: u.device_id || undefined,
          // Detectar tipo de cliente (app/web) desde device_info o metadata
          client_type: getClientType({
            device_info: u.user_presence_sessions?.device_info,
            metadata: u.metadata,
            app_version: u.app_version || u.usuarios?.app_version
          }),
          duracion: duracion,
          last_seen_at: u.last_seen_at,
          session_started_at: u.session_started_at,
          establecimiento: u.usuarios?.establecimiento,
          direccion: u.usuarios?.direccion,
          localidad: u.usuarios?.localidad,
          provincia: u.usuarios?.provincia,
        };
      });
      
      setLiveUsers(mapped);
      logger.dev(`✅ Cargados ${mapped.length} usuarios (página ${currentPage})`);
    } catch (e) {
      logger.error('❌ Error cargando usuarios:', e);
      setError(e?.message || 'Error cargando usuarios');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [currentPage, pageSize, adminEmpresaIds]);

  // Suscripción a cambios en tiempo real
  useEffect(() => {
    const setupRealtime = () => {
      if (channelRef.current) return;

      const channel = supabase
        .channel('admin-live-users-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_current_state'
          },
          (payload) => {
            logger.dev('📡 Cambio en user_current_state:', payload.eventType);
            // Recargar datos cuando hay cambios
            fetchUsers();
          }
        )
        .subscribe();

      channelRef.current = channel;
      logger.dev('✅ Realtime activado para admin live users');
    };

    setupRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        logger.dev('🧹 Realtime limpiado para admin live users');
      }
    };
  }, [fetchUsers]);

  // Cargar datos iniciales y al cambiar de página
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Pausar/reanudar con visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.dev('⏸️ Página oculta - pausando actualizaciones');
      } else {
        logger.dev('▶️ Página visible - reanudando actualizaciones');
        fetchUsers();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUsers]);

  return {
    liveUsers,
    loading,
    error,
    currentPage,
    pageSize,
    totalUsers,
    totalPages: Math.max(1, Math.ceil(totalUsers / pageSize)),
    goToPage: (p) => setCurrentPage(p),
    nextPage: () => setCurrentPage(p => Math.min(Math.ceil(totalUsers / pageSize), p + 1)),
    previousPage: () => setCurrentPage(p => Math.max(1, p - 1)),
    refreshData: fetchUsers,
  };
}

export default useLiveUsersPresenceAdmin;

