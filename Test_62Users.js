/**
 * SCRIPT DE PRUEBA DE CARGA - 62 USUARIOS CONCURRENTES
 * 
 * Herramienta: k6 (https://k6.io)
 * Instalación: brew install k6  (macOS)
 * 
 * Ejecución:
 * k6 run --vus 62 --duration 5m load-test-k6.js
 * 
 * Escenarios de prueba:
 * 1. Login simultáneo de 62 usuarios
 * 2. Carga de canales (cold start)
 * 3. Reproducción de música (heartbeats, cambios de canción)
 * 4. Cambios de canal simultáneos
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ===================================================================
// CONFIGURACIÓN
// ===================================================================

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://nazlyvhndymalevkfpnl.supabase.co';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'tu-anon-key-aqui'; // CAMBIAR

// Métricas personalizadas
const loginErrors = new Rate('login_errors');
const channelLoadErrors = new Rate('channel_load_errors');
const playlistLoadErrors = new Rate('playlist_load_errors');
const heartbeatErrors = new Rate('heartbeat_errors');

const loginDuration = new Trend('login_duration');
const channelLoadDuration = new Trend('channel_load_duration');
const playlistLoadDuration = new Trend('playlist_load_duration');

const totalApiCalls = new Counter('total_api_calls');

// ===================================================================
// OPCIONES DE PRUEBA
// ===================================================================

export const options = {
  // Escenarios de carga
  scenarios: {
    // Escenario 1: Login simultáneo de 62 usuarios
    cold_start: {
      executor: 'shared-iterations',
      vus: 62,
      iterations: 62,
      maxDuration: '2m',
      exec: 'coldStartScenario'
    },
    
    // Escenario 2: Uso continuo durante 5 minutos
    steady_state: {
      executor: 'constant-vus',
      vus: 62,
      duration: '5m',
      startTime: '2m', // Empezar después del cold start
      exec: 'steadyStateScenario'
    },
    
    // Escenario 3: Picos de carga (stress test)
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 62,
      stages: [
        { duration: '30s', target: 62 },   // Normal
        { duration: '10s', target: 100 },  // Pico súbito
        { duration: '30s', target: 100 },  // Mantener pico
        { duration: '10s', target: 62 },   // Volver a normal
      ],
      startTime: '7m',
      exec: 'spikeScenario'
    }
  },
  
  // Umbrales de rendimiento (la prueba falla si no se cumplen)
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<3000'], // 95% < 2s, 99% < 3s
    'http_req_failed': ['rate<0.05'], // Menos de 5% de errores
    'login_errors': ['rate<0.02'], // Menos de 2% errores en login
    'channel_load_errors': ['rate<0.05'],
    'playlist_load_errors': ['rate<0.05'],
    'heartbeat_errors': ['rate<0.10'], // Heartbeats pueden fallar más
  }
};

// ===================================================================
// DATOS DE PRUEBA
// ===================================================================

// Generar 62 usuarios de prueba
function generateTestUsers() {
  const users = [];
  for (let i = 1; i <= 62; i++) {
    users.push({
      username: `test_user_${i}`,
      password: `test_password_${i}`,
      userId: null, // Se llenará después del login
      sessionToken: null
    });
  }
  return users;
}

const testUsers = generateTestUsers();

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

function makeRequest(method, endpoint, body = null, headers = {}) {
  totalApiCalls.add(1);
  
  const url = `${SUPABASE_URL}${endpoint}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      ...headers
    }
  };
  
  if (method === 'GET') {
    return http.get(url, params);
  } else if (method === 'POST') {
    return http.post(url, JSON.stringify(body), params);
  }
}

function getUserForVU() {
  const userId = __VU - 1; // __VU va de 1 a 62
  return testUsers[userId % testUsers.length];
}

// ===================================================================
// ESCENARIO 1: COLD START (Login + Carga inicial)
// ===================================================================

export function coldStartScenario() {
  const user = getUserForVU();
  
  group('Cold Start - Login y Carga Inicial', () => {
    
    // 1. Login
    const loginStart = Date.now();
    const loginResponse = makeRequest('POST', '/auth/v1/token?grant_type=password', {
      email: user.username + '@test.com',
      password: user.password
    });
    
    const loginTime = Date.now() - loginStart;
    loginDuration.add(loginTime);
    
    const loginSuccess = check(loginResponse, {
      'Login exitoso': (r) => r.status === 200 || r.status === 201,
      'Token recibido': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.access_token !== undefined;
        } catch (e) {
          return false;
        }
      }
    });
    
    loginErrors.add(!loginSuccess);
    
    if (!loginSuccess) {
      console.error(`❌ Login falló para ${user.username}: ${loginResponse.status}`);
      return;
    }
    
    // Guardar token para futuras peticiones
    try {
      const loginBody = JSON.parse(loginResponse.body);
      user.sessionToken = loginBody.access_token;
      user.userId = loginBody.user?.id;
    } catch (e) {
      console.error('Error parseando respuesta de login:', e);
      return;
    }
    
    sleep(0.5); // Pequeña pausa entre requests
    
    // 2. Cargar canales del usuario
    const channelLoadStart = Date.now();
    const channelsResponse = makeRequest('GET', 
      `/rest/v1/reproductor_usuario_canales?usuario_id=eq.${user.userId}&activo=eq.true&select=*,canales(*)`,
      null,
      { 'Authorization': `Bearer ${user.sessionToken}` }
    );
    
    const channelLoadTime = Date.now() - channelLoadStart;
    channelLoadDuration.add(channelLoadTime);
    
    const channelsSuccess = check(channelsResponse, {
      'Canales cargados': (r) => r.status === 200,
      'Canales válidos': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch (e) {
          return false;
        }
      }
    });
    
    channelLoadErrors.add(!channelsSuccess);
    
    if (!channelsSuccess) {
      console.error(`❌ Carga de canales falló para ${user.username}: ${channelsResponse.status}`);
      return;
    }
    
    sleep(0.5);
    
    // 3. Cargar playlists del primer canal
    let channelId = null;
    try {
      const channelsBody = JSON.parse(channelsResponse.body);
      if (channelsBody.length > 0 && channelsBody[0].canales) {
        channelId = channelsBody[0].canales.id;
      }
    } catch (e) {
      console.error('Error parseando canales:', e);
    }
    
    if (channelId) {
      const playlistLoadStart = Date.now();
      const playlistsResponse = makeRequest('GET',
        `/rest/v1/playlists?canal_id=eq.${channelId}&activa=eq.true`,
        null,
        { 'Authorization': `Bearer ${user.sessionToken}` }
      );
      
      const playlistLoadTime = Date.now() - playlistLoadStart;
      playlistLoadDuration.add(playlistLoadTime);
      
      const playlistsSuccess = check(playlistsResponse, {
        'Playlists cargadas': (r) => r.status === 200
      });
      
      playlistLoadErrors.add(!playlistsSuccess);
    }
  });
  
  sleep(1);
}

// ===================================================================
// ESCENARIO 2: STEADY STATE (Uso continuo)
// ===================================================================

export function steadyStateScenario() {
  const user = getUserForVU();
  
  if (!user.sessionToken) {
    console.warn(`⚠️ Usuario ${user.username} sin token, saltando...`);
    return;
  }
  
  group('Steady State - Uso Continuo', () => {
    
    // Simular heartbeat cada 30 segundos
    const heartbeatResponse = makeRequest('POST',
      '/rest/v1/rpc/fn_reproductor_heartbeat',
      {
        p_usuario_id: user.userId,
        p_device_id: `device_${__VU}`,
        p_status: 'playing',
        p_app_version: 'k6-load-test',
        p_ip: null
      },
      { 'Authorization': `Bearer ${user.sessionToken}` }
    );
    
    const heartbeatSuccess = check(heartbeatResponse, {
      'Heartbeat enviado': (r) => r.status === 200 || r.status === 204
    });
    
    heartbeatErrors.add(!heartbeatSuccess);
    
    sleep(5); // Simular 5 segundos de reproducción
    
    // Simular cambio de canción ocasional
    if (Math.random() < 0.1) { // 10% de probabilidad
      const channelsResponse = makeRequest('GET',
        `/rest/v1/reproductor_usuario_canales?usuario_id=eq.${user.userId}&activo=eq.true&select=canal_id`,
        null,
        { 'Authorization': `Bearer ${user.sessionToken}` }
      );
      
      check(channelsResponse, {
        'Recarga de canales OK': (r) => r.status === 200
      });
    }
  });
  
  sleep(5); // Esperar 5 segundos antes del próximo ciclo
}

// ===================================================================
// ESCENARIO 3: SPIKE TEST (Pico de carga)
// ===================================================================

export function spikeScenario() {
  const user = getUserForVU();
  
  if (!user.sessionToken) {
    return;
  }
  
  group('Spike Test - Carga Máxima', () => {
    // Simular acciones más agresivas
    
    // Múltiples heartbeats seguidos
    for (let i = 0; i < 3; i++) {
      makeRequest('POST',
        '/rest/v1/rpc/fn_reproductor_heartbeat',
        {
          p_usuario_id: user.userId,
          p_device_id: `device_${__VU}`,
          p_status: 'playing',
          p_app_version: 'k6-spike-test',
          p_ip: null
        },
        { 'Authorization': `Bearer ${user.sessionToken}` }
      );
      
      sleep(0.5);
    }
    
    // Carga de canales múltiples veces
    makeRequest('GET',
      `/rest/v1/reproductor_usuario_canales?usuario_id=eq.${user.userId}&activo=eq.true&select=*,canales(*)`,
      null,
      { 'Authorization': `Bearer ${user.sessionToken}` }
    );
  });
  
  sleep(2);
}

// ===================================================================
// LIFECYCLE HOOKS
// ===================================================================

export function setup() {
  console.log('🚀 Iniciando prueba de carga con 62 usuarios...');
  console.log(`📊 URL de Supabase: ${SUPABASE_URL}`);
  console.log('⏱️ Duración total: ~10 minutos');
  console.log('');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('');
  console.log('✅ Prueba de carga completada');
  console.log(`⏱️ Duración: ${duration.toFixed(1)} segundos`);
  console.log('');
  console.log('📊 Revisar métricas detalladas arriba');
  console.log('💡 Métricas clave a verificar:');
  console.log('   - http_req_duration (p95 < 2000ms)');
  console.log('   - http_req_failed (< 5%)');
  console.log('   - login_errors (< 2%)');
}

// ===================================================================
// INSTRUCCIONES DE USO
// ===================================================================

/**
 * CÓMO EJECUTAR ESTA PRUEBA:
 * 
 * 1. Instalar k6:
 *    macOS: brew install k6
 *    Linux: sudo apt install k6
 *    Windows: choco install k6
 * 
 * 2. Configurar variables de entorno:
 *    export SUPABASE_URL="https://tu-proyecto.supabase.co"
 *    export SUPABASE_ANON_KEY="tu-anon-key-aqui"
 * 
 * 3. Ejecutar prueba completa (10 minutos):
 *    k6 run load-test-k6.js
 * 
 * 4. Ejecutar solo cold start (2 minutos):
 *    k6 run --scenarios cold_start load-test-k6.js
 * 
 * 5. Ejecutar solo steady state (5 minutos):
 *    k6 run --scenarios steady_state load-test-k6.js
 * 
 * 6. Ejecutar con menos usuarios (testing):
 *    k6 run --vus 10 --duration 1m load-test-k6.js
 * 
 * 7. Generar reporte HTML:
 *    k6 run --out json=results.json load-test-k6.js
 *    k6 cloud results.json (requiere cuenta k6 cloud)
 * 
 * INTERPRETACIÓN DE RESULTADOS:
 * 
 * ✅ BUENO:
 * - http_req_duration p95 < 1000ms
 * - http_req_failed < 1%
 * - Todos los checks pasan
 * 
 * ⚠️ ACEPTABLE:
 * - http_req_duration p95 < 2000ms
 * - http_req_failed < 5%
 * - Algunos checks fallan ocasionalmente
 * 
 * ❌ MALO:
 * - http_req_duration p95 > 3000ms
 * - http_req_failed > 10%
 * - Muchos checks fallan
 * 
 * NOTA: Antes de ejecutar, asegúrate de:
 * 1. Tener usuarios de prueba creados en Supabase
 * 2. Haber aplicado los índices de optimización (OPTIMIZACION-INDICES-SUPABASE.sql)
 * 3. Avisar a tu equipo que se hará prueba de carga
 * 4. Ejecutar en horario de bajo tráfico
 */

