/**
 * Utilidades para detectar el tipo de cliente (App Electron vs Web)
 * 
 * Detecta si el usuario está conectado desde la app instalada (Electron)
 * o desde el navegador web basándose en device_info.userAgent
 */

/**
 * Detecta el tipo de cliente desde device_info
 * @param {object} deviceInfo - Objeto device_info de la BD (puede ser JSON o string)
 * @returns {string} 'app' | 'web' | null
 */
export function detectClientType(deviceInfo) {
  if (!deviceInfo) return null;
  
  try {
    // Si es string, parsearlo
    const info = typeof deviceInfo === 'string' ? JSON.parse(deviceInfo) : deviceInfo;
    
    // Buscar userAgent en el objeto
    const userAgent = info?.userAgent || info?.user_agent || '';
    
    // Si contiene "Electron" en el userAgent, es la app instalada
    if (userAgent && userAgent.includes('Electron')) {
      return 'app';
    }
    
    // Si no contiene Electron, es web
    if (userAgent) {
      return 'web';
    }
    
    return null;
  } catch (error) {
    console.warn('Error detectando tipo de cliente:', error);
    return null;
  }
}

/**
 * Detecta el tipo de cliente desde metadata (alternativa)
 * @param {object} metadata - Objeto metadata de user_current_state
 * @returns {string} 'app' | 'web' | null
 */
export function detectClientTypeFromMetadata(metadata) {
  if (!metadata) return null;
  
  try {
    const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    const userAgent = meta?.userAgent || meta?.device_info?.userAgent || '';
    
    if (userAgent && userAgent.includes('Electron')) {
      return 'app';
    }
    
    if (userAgent) {
      return 'web';
    }
    
    return null;
  } catch (error) {
    console.warn('Error detectando tipo de cliente desde metadata:', error);
    return null;
  }
}

/**
 * Obtiene el tipo de cliente desde user_current_state o user_presence_sessions
 * @param {object} userState - Objeto con device_info o metadata
 * @returns {string} 'app' | 'web' | null
 */
export function getClientType(userState) {
  if (!userState) return null;
  
  // Intentar desde device_info (si viene de user_presence_sessions)
  if (userState.device_info) {
    const type = detectClientType(userState.device_info);
    if (type) return type;
  }
  
  // Intentar desde metadata (si viene de user_current_state)
  if (userState.metadata) {
    const type = detectClientTypeFromMetadata(userState.metadata);
    if (type) return type;
  }
  
  // Fallback: si tiene app_version, es app (Electron)
  if (userState.app_version) {
    return 'app';
  }
  
  // Si no tiene app_version y no hay device_info, asumir web
  return 'web';
}

