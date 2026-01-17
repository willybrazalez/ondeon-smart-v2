/**
 * usePresence - Hook React para sistema de presencia
 * 
 * Facilita el uso del OptimizedPresenceService en componentes React
 * 
 * Uso:
 * const { onlineUsers, stats, isOnline, sendEvent } = usePresence();
 */

import { useState, useEffect } from 'react';
import optimizedPresenceService from '@/services/optimizedPresenceService';

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    eventsTransmitted: 0,
    eventsSaved: 0,
    connectionStatus: 'disconnected'
  });

  useEffect(() => {
    // Verificar si el servicio está activo
    setIsOnline(optimizedPresenceService.isPresenceActive());

    // Suscribirse a cambios de presencia
    const unsubSync = optimizedPresenceService.onPresenceSync((users) => {
      setOnlineUsers(users);
      setStats(prev => ({
        ...prev,
        total: users.length
      }));
    });

    const unsubJoin = optimizedPresenceService.onUserJoined((newUsers) => {
      console.log('👋 Usuario(s) conectado(s):', newUsers);
      // Actualizar lista
      setOnlineUsers(optimizedPresenceService.getOnlineUsers());
    });

    const unsubLeave = optimizedPresenceService.onUserLeft((leftUsers) => {
      console.log('👋 Usuario(s) desconectado(s):', leftUsers);
      // Actualizar lista
      setOnlineUsers(optimizedPresenceService.getOnlineUsers());
    });

    // Obtener usuarios online iniciales
    setOnlineUsers(optimizedPresenceService.getOnlineUsers());

    // Actualizar stats periódicamente
    const statsInterval = setInterval(() => {
      if (optimizedPresenceService.isPresenceActive()) {
        const serviceStats = optimizedPresenceService.getStats();
        setStats({
          total: serviceStats.onlineUsersCount || 0,
          eventsTransmitted: serviceStats.eventsTransmitted || 0,
          eventsSaved: serviceStats.eventsSaved || 0,
          connectionStatus: serviceStats.connectionStatus || 'disconnected'
        });
      }
    }, 5000); // Cada 5 segundos

    return () => {
      unsubSync();
      unsubJoin();
      unsubLeave();
      clearInterval(statsInterval);
    };
  }, []);

  return {
    onlineUsers,        // Lista de usuarios online
    isOnline,           // Si el usuario actual está online
    stats,              // Estadísticas del servicio
    
    // Métodos del servicio
    sendEvent: optimizedPresenceService.sendEvent.bind(optimizedPresenceService),
    getUser: optimizedPresenceService.getUserPresence.bind(optimizedPresenceService),
    isUserOnline: optimizedPresenceService.isUserOnline.bind(optimizedPresenceService),
    getCurrentState: optimizedPresenceService.getCurrentState.bind(optimizedPresenceService)
  };
}

export default usePresence;

