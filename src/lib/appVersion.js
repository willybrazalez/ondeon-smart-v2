/**
 * Utilidades para manejar la versión de la aplicación
 * 
 * Obtiene la versión real del reproductor desde Electron o package.json
 * y proporciona funciones para comparar versiones y detectar versiones antiguas
 */

// Versión del package.json (fallback si no está disponible desde Electron)
const PACKAGE_VERSION = '0.0.33';

/**
 * Detecta si la aplicación está corriendo en Electron
 * @returns {boolean} true si está en Electron, false si es web
 */
export function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

/**
 * Obtiene la versión actual de la aplicación
 * @returns {Promise<string|null>} Versión de la app (ej: "0.0.33" para Electron, null para navegador)
 */
export async function getAppVersion() {
  // Si estamos en Electron, obtener la versión real instalada desde la API
  if (isElectron() && window.electronAPI?.getAppVersion) {
    try {
      const version = await window.electronAPI.getAppVersion();
      if (version) return version;
    } catch (error) {
      console.warn('No se pudo obtener versión desde Electron:', error);
      // Fallback: usar versión del package.json si falla Electron
      return PACKAGE_VERSION;
    }
  }
  
  // Si es web (navegador), retornar null porque no hay versión instalada
  // La versión web siempre es la última desplegada, no tiene sentido guardar una versión específica
  return null;
}

/**
 * Obtiene la versión actual de forma síncrona (usa cache o fallback)
 * Útil cuando no se puede usar async/await
 * @returns {string|null} Versión de la app ("0.0.33" para Electron, null para navegador)
 */
export function getCurrentVersion() {
  // Si estamos en Electron, usar versión del package.json (la versión real se obtiene con getAppVersion async)
  // Si es web, retornar null
  if (isElectron()) {
    return PACKAGE_VERSION;
  }
  return null;
}

/**
 * Compara dos versiones semánticas
 * @param {string} version1 - Primera versión (ej: "0.0.31")
 * @param {string} version2 - Segunda versión (ej: "0.0.33")
 * @returns {number} -1 si version1 < version2, 0 si son iguales, 1 si version1 > version2
 */
export function compareVersions(version1, version2) {
  if (!version1 || !version2) return 0;
  
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  // Normalizar a 3 partes (major.minor.patch)
  while (v1Parts.length < 3) v1Parts.push(0);
  while (v2Parts.length < 3) v2Parts.push(0);
  
  for (let i = 0; i < 3; i++) {
    if (v1Parts[i] < v2Parts[i]) return -1;
    if (v1Parts[i] > v2Parts[i]) return 1;
  }
  
  return 0;
}

/**
 * Determina si una versión de usuario es antigua comparada con la versión actual
 * @param {string} userVersion - Versión del usuario (ej: "0.0.31")
 * @param {string} currentVersion - Versión actual (ej: "0.0.33")
 * @returns {boolean} true si la versión del usuario es menor que la actual
 */
export function isVersionOutdated(userVersion, currentVersion = null) {
  if (!userVersion) return false;
  
  const current = currentVersion || getCurrentVersion();
  
  // Si no hay versión actual (web), no comparar
  if (!current) return false;
  
  return compareVersions(userVersion, current) < 0;
}

/**
 * Obtiene el nivel de desactualización de una versión
 * @param {string} userVersion - Versión del usuario (ej: "0.0.31")
 * @param {string} currentVersion - Versión actual (opcional)
 * @returns {string} 'none' | 'minor' | 'major' | 'critical'
 */
export function getOutdatedLevel(userVersion, currentVersion = null) {
  if (!userVersion) return 'none';
  
  const current = currentVersion || getCurrentVersion();
  
  // Si no hay versión actual (web), no comparar
  if (!current) return 'none';
  
  const comparison = compareVersions(userVersion, current);
  
  if (comparison >= 0) return 'none';
  
  const v1Parts = userVersion.split('.').map(Number);
  const v2Parts = current.split('.').map(Number);
  
  // Normalizar
  while (v1Parts.length < 3) v1Parts.push(0);
  while (v2Parts.length < 3) v2Parts.push(0);
  
  // Si cambió el major (0.x.x), es crítico
  if (v1Parts[0] < v2Parts[0]) return 'critical';
  
  // Si cambió el minor (x.0.x), es mayor
  if (v1Parts[1] < v2Parts[1]) return 'major';
  
  // Si solo cambió el patch (x.x.0), es menor
  return 'minor';
}

