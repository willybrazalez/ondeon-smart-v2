/**
 * Utilidades para manejar la versión de la aplicación
 * Versión simplificada para web/mobile (sin Electron)
 */

// Versión actual de la aplicación web
const CURRENT_VERSION = '1.0.0';

/**
 * Obtiene la versión actual de la aplicación
 * @returns {Promise<string|null>} Versión de la app (null para web - siempre usa la última versión)
 */
export async function getAppVersion() {
  // En web, la versión siempre es la última desplegada
  return null;
}

/**
 * Obtiene la versión actual de forma síncrona
 * @returns {string|null} Versión de la app (null para web)
 */
export function getCurrentVersion() {
  // En web, retornar null ya que siempre se usa la última versión
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
