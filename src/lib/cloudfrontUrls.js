/**
 * Utilidad para convertir URLs de S3 a URLs de CloudFront
 */

// Configuración de CloudFront (debe estar en variables de entorno)
const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN || 
                          'd2ozw1d1zbl64l.cloudfront.net'; // Fallback al dominio actual

const S3_BUCKET_DOMAIN = 'musicaondeon.s3.eu-north-1.amazonaws.com';

/**
 * Convertir URL de S3 a URL de CloudFront
 * @param {string} s3Url - URL completa de S3 o s3_key
 * @returns {string} URL de CloudFront
 */
export function convertToCloudFrontUrl(s3Url) {
  if (!s3Url) return null;
  
  // Si ya es una URL de CloudFront, retornarla tal cual
  if (s3Url.includes('cloudfront.net')) {
    return s3Url;
  }
  
  // Si es un s3_key (sin http/https), construir URL de CloudFront
  if (!s3Url.startsWith('http')) {
    return `https://${CLOUDFRONT_DOMAIN}/${s3Url}`;
  }
  
  try {
    const urlObj = new URL(s3Url);
    
    // Si es URL de S3, extraer el path y construir URL de CloudFront
    if (urlObj.hostname.includes('s3') && urlObj.hostname.includes('amazonaws.com')) {
      const s3Key = urlObj.pathname.substring(1); // Remover '/' inicial
      return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
    }
    
    // Si no es S3, retornar original (podría ser otro servicio)
    return s3Url;
  } catch (e) {
    // Si falla el parsing, asumir que es un s3_key y construir URL
    return `https://${CLOUDFRONT_DOMAIN}/${s3Url}`;
  }
}

/**
 * Extraer s3_key de una URL (S3 o CloudFront)
 * @param {string} url - URL completa
 * @returns {string} s3_key
 */
export function extractS3KeyFromUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remover el '/' inicial
  } catch (e) {
    // Si ya es un s3_key directo, retornarlo
    return url;
  }
}

/**
 * Verificar si una URL es de S3 (necesita conversión)
 * @param {string} url - URL a verificar
 * @returns {boolean}
 */
export function isS3Url(url) {
  if (!url) return false;
  return url.includes('s3') && url.includes('amazonaws.com');
}

