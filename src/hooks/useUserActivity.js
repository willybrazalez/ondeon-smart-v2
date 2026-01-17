/**
 * useUserActivity - Hook React para historial de actividad del usuario
 * 
 * Facilita la consulta del historial de actividad desde componentes React
 * 
 * Uso:
 * const { activities, loading, loadMore, filter } = useUserActivity(userId);
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

export function useUserActivity(userId, options = {}) {
  const {
    limit = 50,
    eventType = null,
    autoLoad = true
  } = options;

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  /**
   * Cargar actividades del usuario
   */
  const loadActivities = useCallback(async (reset = false) => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;

      // Usar la función RPC si está disponible, sino query directo
      let query = supabase
        .from('user_activity_events')
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + limit - 1);

      // Filtrar por tipo de evento si se especifica
      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      if (reset) {
        setActivities(data);
        setOffset(data.length);
      } else {
        setActivities(prev => [...prev, ...data]);
        setOffset(prev => prev + data.length);
      }

      // Verificar si hay más datos
      setHasMore(data.length === limit);

      logger.dev(`✅ Cargadas ${data.length} actividades del usuario`);

    } catch (err) {
      logger.error('❌ Error cargando actividades:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, limit, eventType, offset]);

  /**
   * Cargar más actividades (paginación)
   */
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadActivities(false);
    }
  }, [loading, hasMore, loadActivities]);

  /**
   * Refrescar (recargar desde el inicio)
   */
  const refresh = useCallback(() => {
    setOffset(0);
    loadActivities(true);
  }, [loadActivities]);

  /**
   * Filtrar por tipo de evento
   */
  const filterByType = useCallback((type) => {
    setOffset(0);
    setActivities([]);
    loadActivities(true);
  }, [loadActivities]);

  // Cargar automáticamente al montar
  useEffect(() => {
    if (autoLoad && userId) {
      loadActivities(true);
    }
  }, [userId, eventType, autoLoad]); // Recargar si cambia userId o eventType

  return {
    activities,      // Lista de actividades
    loading,         // Cargando
    error,           // Error si ocurrió
    hasMore,         // Hay más datos para cargar
    loadMore,        // Cargar más (paginación)
    refresh,         // Refrescar desde el inicio
    filterByType     // Filtrar por tipo de evento
  };
}

/**
 * Hook para obtener estadísticas de actividad del usuario
 */
export function useUserStats(userId, hours = 24) {
  const [stats, setStats] = useState({
    songsPlayed: 0,
    channelChanges: 0,
    errorsCount: 0,
    scheduledContentCount: 0,
    uniqueChannelsUsed: 0,
    firstActivity: null,
    lastActivity: null
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const loadStats = async () => {
      try {
        setLoading(true);

        // Usar la vista v_user_stats_24h si existe, sino calcular manualmente
        const { data, error } = await supabase
          .from('v_user_stats_24h')
          .select('*')
          .eq('usuario_id', userId)
          .single();

        if (error) {
          // Si la vista no existe, calcular stats manualmente
          const { data: activities } = await supabase
            .from('user_activity_events')
            .select('event_type, created_at, canal_id')
            .eq('usuario_id', userId)
            .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());

          if (activities) {
            const uniqueChannels = new Set(activities.map(a => a.canal_id).filter(Boolean));
            
            setStats({
              songsPlayed: activities.filter(a => a.event_type === 'song_changed').length,
              channelChanges: activities.filter(a => a.event_type === 'channel_changed').length,
              errorsCount: activities.filter(a => a.event_type === 'playback_error').length,
              scheduledContentCount: activities.filter(a => a.event_type.includes('scheduled_content')).length,
              uniqueChannelsUsed: uniqueChannels.size,
              firstActivity: activities[activities.length - 1]?.created_at || null,
              lastActivity: activities[0]?.created_at || null
            });
          }
        } else {
          setStats({
            songsPlayed: data.songs_played || 0,
            channelChanges: data.channel_changes || 0,
            errorsCount: data.errors_count || 0,
            scheduledContentCount: data.scheduled_content_count || 0,
            uniqueChannelsUsed: data.unique_channels_used || 0,
            firstActivity: data.first_activity,
            lastActivity: data.last_activity
          });
        }

      } catch (err) {
        logger.error('Error cargando estadísticas:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [userId, hours]);

  return { stats, loading };
}

export default useUserActivity;

