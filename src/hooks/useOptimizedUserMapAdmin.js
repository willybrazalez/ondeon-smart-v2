import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

// 🎯 Cache key para sessionStorage
const CACHE_KEY = 'admin_user_locations_cache';
const CACHE_TIMESTAMP_KEY = 'admin_user_locations_cache_ts';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

/**
 * Hook optimizado para el mapa de usuarios
 * Carga ubicaciones UNA SOLA VEZ y usa cache entre navegaciones
 */
export function useOptimizedUserMapAdmin(liveUsers = [], adminEmpresaIds = []) {
  const [usersWithLocation, setUsersWithLocation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);
  const lastSyncRef = useRef(0); // Para evitar sincronizaciones muy frecuentes

  // Cargar ubicaciones (se re-ejecuta cuando cambian las empresas)
  const loadLocations = useCallback(async () => {
    // Si ya cargamos Y las empresas no han cambiado, no hacer nada
    if (loadedRef.current && adminEmpresaIds.length > 0) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // 🔒 CRÍTICO: Solo cargar si hay empresas asignadas
      if (adminEmpresaIds.length === 0) {
        setUsersWithLocation([]);
        setLoading(false);
        return;
      }
      
      // 🎯 OPTIMIZACIÓN: Intentar cargar desde cache primero
      const cacheKey = `${CACHE_KEY}_${adminEmpresaIds.sort().join(',')}`;
      const cachedTimestamp = sessionStorage.getItem(`${CACHE_TIMESTAMP_KEY}_${adminEmpresaIds.sort().join(',')}`);
      const cachedData = sessionStorage.getItem(cacheKey);
      
      if (cachedData && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp, 10);
        if (age < CACHE_DURATION) {
          const mapped = JSON.parse(cachedData);
          setUsersWithLocation(mapped);
          loadedRef.current = true;
          setLoading(false);
          logger.dev(`💾 ${mapped.length} ubicaciones cargadas desde CACHE (edad: ${Math.round(age / 60000)}min)`);
          return;
        } else {
          logger.dev('🗑️ Cache expirado, recargando desde BD...');
        }
      }
      
      logger.dev(`🗺️ Cargando ubicaciones desde BD (${adminEmpresaIds.length} empresa(s))...`);
      
      // 🔒 FILTRO SEGURO: Solo usuarios de empresas asignadas
      const { data, error: err } = await supabase
        .from('usuarios')
        .select(`
          id, username, nombre, apellidos, email, rol_id,
          establecimiento, direccion, codigo_postal, localidad, provincia, pais,
          latitude, longitude, empresa_id
        `)
        .in('empresa_id', adminEmpresaIds)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (err) throw err;

      const mapped = (data || []).map((u) => ({
        usuario_id: u.id,
        username: u.username || u.email?.split('@')[0] || 'Usuario',
        nombre: u.apellidos ? `${u.nombre} ${u.apellidos}`.trim() : (u.nombre || 'Usuario'),
        email: u.email || '',
        latitude: Number(u.latitude),
        longitude: Number(u.longitude),
        connection_status: 'offline',
        playback_state: 'stopped',
        establecimiento: u.establecimiento,
        direccion: u.direccion,
        codigo_postal: u.codigo_postal,
        localidad: u.localidad,
        provincia: u.provincia,
        pais: u.pais,
      }));

      // 💾 Guardar en cache
      sessionStorage.setItem(cacheKey, JSON.stringify(mapped));
      sessionStorage.setItem(`${CACHE_TIMESTAMP_KEY}_${adminEmpresaIds.sort().join(',')}`, Date.now().toString());
      
      setUsersWithLocation(mapped);
      loadedRef.current = true;
      logger.dev(`✅ ${mapped.length} ubicaciones cargadas desde BD y cacheadas`);
    } catch (e) {
      logger.error('❌ Error cargando ubicaciones:', e);
      setError(e?.message || 'Error cargando ubicaciones');
    } finally {
      setLoading(false);
    }
  }, [adminEmpresaIds]);

  // Sincronizar estados de liveUsers con las ubicaciones (THROTTLED)
  const syncStates = useCallback(() => {
    if (usersWithLocation.length === 0 || !liveUsers || liveUsers.length === 0) {
      return;
    }

    // 🎯 THROTTLE: Solo sincronizar cada 5 segundos como máximo
    const now = Date.now();
    if (now - lastSyncRef.current < 5000) {
      return;
    }
    lastSyncRef.current = now;

    const statesMap = new Map(liveUsers.map((u) => [u.usuario_id, u]));

    setUsersWithLocation((prev) =>
      prev.map((u) => {
        const state = statesMap.get(u.usuario_id);
        if (!state) {
          return { ...u, connection_status: 'offline', playback_state: 'stopped' };
        }
        return {
          ...u,
          connection_status: state.connection_status,
          playback_state: state.playback_state,
          current_canal_name: state.current_canal_name,
          current_song_title: state.current_song_title,
          current_song_artist: state.current_song_artist,
          duracion: state.duracion,
          app_version: state.app_version,
        };
      })
    );
  }, [liveUsers, usersWithLocation.length]);

  // Cargar ubicaciones al montar
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Sincronizar estados cuando cambien liveUsers
  useEffect(() => {
    if (!loading && usersWithLocation.length > 0) {
      syncStates();
    }
  }, [loading, usersWithLocation.length, syncStates, liveUsers]);

  return {
    usersWithLocation,
    loading,
    error,
    reloadLocations: () => {
      loadedRef.current = false;
      loadLocations();
    },
  };
}

export default useOptimizedUserMapAdmin;

