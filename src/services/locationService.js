import logger from '../lib/logger.js';

/**
 * LocationService - Maneja la geolocalización del usuario
 */
class LocationService {
  constructor() {
    this.currentLocation = null;
    this.locationPermission = null;
  }

  /**
   * Obtener la ubicación actual del usuario
   */
  async getCurrentLocation() {
    if (!navigator.geolocation) {
      logger.warn('Geolocalización no soportada por este navegador');
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };

          // Intentar obtener información adicional de la ubicación
          try {
            const locationInfo = await this.getLocationInfo(location.latitude, location.longitude);
            this.currentLocation = { ...location, ...locationInfo };
          } catch (error) {
            logger.warn('No se pudo obtener información adicional de ubicación:', error);
            this.currentLocation = location;
          }

          resolve(this.currentLocation);
        },
        (error) => {
          logger.warn('Error obteniendo geolocalización:', error.message);
          this.locationPermission = 'denied';
          resolve(null);
        },
        { 
          timeout: 10000, 
          enableHighAccuracy: false,
          maximumAge: 300000 // 5 minutos
        }
      );
    });
  }

  /**
   * Obtener información adicional de la ubicación (ciudad, país)
   */
  async getLocationInfo(latitude, longitude) {
    try {
      // Usar un servicio de geocodificación inversa (opcional)
      // Por ahora retornamos null, pero se puede integrar con APIs como:
      // - Google Maps Geocoding API
      // - OpenStreetMap Nominatim
      // - Mapbox Geocoding API
      return null;
    } catch (error) {
      logger.warn('Error obteniendo información de ubicación:', error);
      return null;
    }
  }

  /**
   * Verificar si la geolocalización está disponible
   */
  isLocationAvailable() {
    return 'geolocation' in navigator;
  }

  /**
   * Obtener la ubicación actual (cached o nueva)
   */
  getLocation() {
    return this.currentLocation;
  }

  /**
   * Limpiar la ubicación actual
   */
  clearLocation() {
    this.currentLocation = null;
  }
}

export default new LocationService();
