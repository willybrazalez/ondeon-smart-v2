import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

/**
 * 🔧 NUEVO: Función auxiliar para obtener la duración de una canción
 * Maneja compatibilidad con la nueva estructura de la tabla canciones
 */
export function getSongDuration(song) {
  if (!song) return null;
  
  const songData = song?.canciones || song;
  
  // Priorizar duration_ms (nuevo campo en milisegundos)
  if (songData?.duration_ms && typeof songData.duration_ms === 'number') {
    // Convertir de milisegundos a formato MM:SS
    const totalSeconds = Math.floor(songData.duration_ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Fallback al campo duracion (formato texto)
  if (songData?.duracion) {
    return songData.duracion;
  }
  
  return null;
}

/**
 * 🔧 NUEVO: Función auxiliar para obtener la fecha de subida de una canción
 * Maneja compatibilidad con la nueva estructura de la tabla canciones
 */
export function getSongUploadDate(song) {
  if (!song) return null;
  
  const songData = song?.canciones || song;
  
  // Usar upload_date (nuevo campo)
  if (songData?.upload_date) {
    return songData.upload_date;
  }
  
  // Fallback para compatibilidad (aunque ya no debería existir)
  if (songData?.fecha_subida) {
    return songData.fecha_subida;
  }
  
  return null;
}