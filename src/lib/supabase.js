import { createClient } from '@supabase/supabase-js'
import logger from './logger.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// #region agent log
fetch('http://127.0.0.1:7242/ingest/387fb109-3d75-4d24-b454-7d123dcb5eaa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.js:init',message:'Supabase client initialization',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseAnonKey,urlValue:supabaseUrl?.substring(0,50),isDev:import.meta.env.DEV},timestamp:Date.now(),sessionId:'debug-session',runId:'production-debug-v1',hypothesisId:'H2'})}).catch(()=>{});
// #endregion

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  // ✅ CRÍTICO: Configuración de fetch para Electron empaquetado
  global: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  },
  // ✅ Configuración de realtime para mejor estabilidad en Electron
  realtime: {
    params: {
      eventsPerSecond: 2 // Limitar eventos para evitar saturación
    }
  },
  db: {
    schema: 'public'
  }
})

// Helper para obtener el usuario actual
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper para obtener la sesión actual
export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// 🧹 Helper para limpiar COMPLETAMENTE la sesión persistente de Supabase
// Útil para casos donde la sesión se queda atascada
export const clearSupabaseSession = async () => {
  logger.dev('🧹 Limpiando sesión persistente de Supabase...');
  
  try {
    // 1. Cerrar sesión a través de la API
    await supabase.auth.signOut();
    logger.dev('✅ SignOut de Supabase completado');
  } catch (e) {
    logger.warn('⚠️ Error en signOut:', e);
  }
  
  // 2. Limpiar localStorage manualmente
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Limpiar todas las claves relacionadas con Supabase
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    logger.dev(`🗑️ Eliminado: ${key}`);
  });
  
  // 3. Limpiar sesiones legacy de Ondeon
  localStorage.removeItem('ondeon_legacy_user');
  localStorage.removeItem('ondeon_edge_token');
  logger.dev('🗑️ Sesiones legacy limpiadas');
  
  logger.dev('✅ Sesión limpiada completamente. Recarga la página para ver los cambios.');
  logger.dev('💡 Ejecuta: location.reload() para recargar');
}

// 🔧 Exponer función globalmente para debugging
if (typeof window !== 'undefined') {
  window.clearSupabaseSession = clearSupabaseSession;
  logger.dev('🔧 Función de limpieza disponible: window.clearSupabaseSession()');
} 