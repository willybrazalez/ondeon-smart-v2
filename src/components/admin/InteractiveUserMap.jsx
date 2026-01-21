import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, InfoWindow, Marker } from '@react-google-maps/api';
import { MapPin, Radio, Clock, Smartphone, AlertTriangle } from 'lucide-react';
import logger from '@/lib/logger';
import { getCurrentVersion, isVersionOutdated, getOutdatedLevel } from '@/lib/appVersion';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 40.4168, // Madrid
  lng: -3.7038,
};

const mapOptions = {
  // mapId removido - usando estilo por defecto de Google Maps
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
};

// CRÍTICO: Array de librerías debe ser constante (fuera del componente)
const GOOGLE_MAPS_LIBRARIES = [];

/**
 * Componente de mapa interactivo con Google Maps
 * @param {Array} usersWithLocation - Todos los usuarios con ubicación
 * @param {String} filterMode - Filtro activo: 'all', 'online', 'offline'
 */
export const InteractiveUserMap = ({ usersWithLocation = [], filterMode = 'all' }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [map, setMap] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null); // Track por ID
  const [currentVersion, setCurrentVersion] = useState(null);
  const markersRef = useRef(new Map());

  const onLoad = useCallback((map) => {
    setMap(map);
    
    // Ajustar bounds para mostrar todos los usuarios
    if (usersWithLocation.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      usersWithLocation.forEach((user) => {
        bounds.extend({ lat: user.latitude, lng: user.longitude });
      });
      map.fitBounds(bounds);
    }
  }, [usersWithLocation]);

  const onUnmount = useCallback(() => {
    setMap(null);
    // Limpiar todos los marcadores
    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current.clear();
  }, []);

  // Cargar versión actual de la aplicación
  useEffect(() => {
    setCurrentVersion(getCurrentVersion());
  }, []);

  // 🔄 Sincronizar selectedUser con datos actualizados
  useEffect(() => {
    if (selectedUserId) {
      const updatedUser = usersWithLocation.find(u => u.usuario_id === selectedUserId);
      if (updatedUser) {
        setSelectedUser(updatedUser);
      }
    }
  }, [usersWithLocation, selectedUserId]);

  // Filtrar usuarios según el modo de filtro
  const filteredUsers = usersWithLocation.filter(u => {
    if (!u.latitude || !u.longitude || isNaN(u.latitude) || isNaN(u.longitude)) {
      return false;
    }
    
    if (filterMode === 'online') {
      return u.connection_status === 'online';
    } else if (filterMode === 'offline') {
      return u.connection_status === 'offline';
    }
    return true; // 'all'
  });

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-500">Error cargando Google Maps</p>
          <p className="text-xs text-muted-foreground mt-1">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={defaultCenter}
      zoom={6}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={mapOptions}
    >
      {/* Marcadores de usuarios */}
      {filteredUsers.map((user) => {
        const isOnline = user.connection_status === 'online';
        return (
          <Marker
            key={user.usuario_id}
            position={{ lat: user.latitude, lng: user.longitude }}
            title={`${user.username} - ${isOnline ? 'Online' : 'Offline'}`}
            icon={{
              path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 8,
              fillColor: isOnline ? '#22c55e' : '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            onClick={() => {
              setSelectedUser(user);
              setSelectedUserId(user.usuario_id);
            }}
          />
        );
      })}

      {selectedUser && (
        <InfoWindow
          position={{ lat: selectedUser.latitude, lng: selectedUser.longitude }}
          onCloseClick={() => {
            setSelectedUser(null);
            setSelectedUserId(null);
          }}
        >
          <div className="p-3 min-w-[280px]">
            {/* Header con estado */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-4 h-4 rounded-full mt-1 ${
                selectedUser.connection_status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-base">@{selectedUser.username}</h3>
                <p className="text-xs text-gray-600">{selectedUser.nombre}</p>
                <p className="text-xs font-medium mt-0.5 text-gray-700">
                  {selectedUser.connection_status === 'online' ? '🟢 En línea' : '🔴 Desconectado'}
                </p>
              </div>
            </div>

            {/* Ubicación */}
            {selectedUser.establecimiento && (
              <div className="flex items-start gap-2 text-xs text-gray-700 mb-2 bg-gray-50 p-2 rounded">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">{selectedUser.establecimiento}</p>
                  {selectedUser.direccion && (
                    <p className="text-gray-500 mt-0.5">
                      {selectedUser.direccion}
                      {selectedUser.localidad && `, ${selectedUser.localidad}`}
                      {selectedUser.provincia && ` (${selectedUser.provincia})`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Información de reproducción */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              {/* Estado de reproducción */}
              <div className="flex items-center gap-2 text-xs text-gray-700 mb-3">
                <Radio className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">
                  {selectedUser.connection_status === 'online' ? (
                    selectedUser.playback_state === 'playing' ? '▶️ Reproduciendo' :
                    selectedUser.playback_state === 'paused' ? '⏸️ Pausado' : 
                    selectedUser.playback_state === 'stopped' ? '⏹️ Detenido' : 
                    '🔵 Conectado'
                  ) : (
                    '⚫ Sin actividad'
                  )}
                </span>
              </div>

              {/* Duración de sesión */}
              {selectedUser.connection_status === 'online' && (
                <div className="flex items-center gap-2 text-xs bg-green-50 p-2 rounded mb-2">
                  <Clock className="w-3 h-3 text-green-700" />
                  <span className="text-gray-700">
                    Sesión: <span className="font-medium text-green-700">{selectedUser.duracion || '00h 00m 00s'}</span>
                  </span>
                </div>
              )}

              {/* Canal actual */}
              {selectedUser.connection_status === 'online' && selectedUser.current_canal_name && (
                <div className="bg-blue-50 p-2 rounded mb-2">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium text-gray-700">📻 Canal:</span> {selectedUser.current_canal_name}
                  </p>
                </div>
              )}

              {/* Canción actual */}
              {selectedUser.connection_status === 'online' && selectedUser.current_song_title && (
                <div className="bg-purple-50 p-2 rounded mb-2">
                  <p className="text-xs text-gray-700 font-medium">
                    🎵 {selectedUser.current_song_title}
                  </p>
                  {selectedUser.current_song_artist && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      🎤 {selectedUser.current_song_artist}
                    </p>
                  )}
                </div>
              )}

              {selectedUser.app_version ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Smartphone className="w-3 h-3" />
                  <span>App versión {selectedUser.app_version}</span>
                  {currentVersion && isVersionOutdated(selectedUser.app_version, currentVersion) && (
                    <span 
                      className="inline-flex items-center"
                      title={`Versión antigua. Versión actual: v${currentVersion}`}
                    >
                      <AlertTriangle 
                        className={`w-3 h-3 ml-1 ${
                          getOutdatedLevel(selectedUser.app_version, currentVersion) === 'critical' 
                            ? 'text-red-500' 
                            : getOutdatedLevel(selectedUser.app_version, currentVersion) === 'major'
                            ? 'text-orange-500'
                            : 'text-yellow-500'
                        }`} 
                      />
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Smartphone className="w-3 h-3" />
                  <span>Versión Web</span>
                </div>
              )}
            </div>

            {/* Footer con coordenadas */}
            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200 font-mono">
              📍 {selectedUser.latitude.toFixed(6)}, {selectedUser.longitude.toFixed(6)}
            </p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default InteractiveUserMap;

