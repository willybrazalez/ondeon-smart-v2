/**
 * Script de diagnóstico para programación específica
 * Verifica por qué una programación no se está reproduciendo
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// IDs de la programación y usuario
const PROGRAMACION_ID = 'b8e7c54c-f17e-41c3-a05c-fefbd7b579e9';
const USUARIO_ID = '9fba1a0c-60a4-45df-a16d-bea9923219df';

async function diagnosticarProgramacion() {
  console.log('🔍 DIAGNÓSTICO DE PROGRAMACIÓN\n');
  console.log(`Programación ID: ${PROGRAMACION_ID}`);
  console.log(`Usuario ID: ${USUARIO_ID}\n`);
  console.log('='.repeat(80));

  // 1. Verificar que la programación existe y está activa
  console.log('\n1️⃣ VERIFICANDO PROGRAMACIÓN...');
  const { data: programacion, error: errorProg } = await supabase
    .from('programaciones')
    .select('*')
    .eq('id', PROGRAMACION_ID)
    .single();

  if (errorProg) {
    console.error('❌ Error obteniendo programación:', errorProg);
    return;
  }

  if (!programacion) {
    console.error('❌ Programación no encontrada');
    return;
  }

  console.log('✅ Programación encontrada:');
  console.log(`   - Descripción: ${programacion.descripcion}`);
  console.log(`   - Estado: ${programacion.estado}`);
  console.log(`   - Tipo: ${programacion.tipo}`);
  console.log(`   - Fecha inicio: ${programacion.fecha_inicio}`);
  console.log(`   - Fecha fin: ${programacion.fecha_fin || 'null'}`);
  console.log(`   - Weekly mode: ${programacion.weekly_mode}`);
  console.log(`   - Weekly hora una vez: ${programacion.weekly_hora_una_vez}`);
  console.log(`   - Weekly days: ${JSON.stringify(programacion.weekly_days)}`);
  console.log(`   - Weekly rango desde: ${programacion.weekly_rango_desde}`);
  console.log(`   - Weekly rango hasta: ${programacion.weekly_rango_hasta}`);
  console.log(`   - Frecuencia minutos: ${programacion.frecuencia_minutos}`);

  // Verificar si está activa
  if (programacion.estado !== 'activo') {
    console.error(`\n❌ PROBLEMA: La programación NO está activa (estado: ${programacion.estado})`);
  }

  // 2. Verificar asignación al usuario
  console.log('\n2️⃣ VERIFICANDO ASIGNACIÓN AL USUARIO...');
  const { data: destinatarios, error: errorDest } = await supabase
    .from('programacion_destinatarios')
    .select('*')
    .eq('programacion_id', PROGRAMACION_ID)
    .eq('usuario_id', USUARIO_ID);

  if (errorDest) {
    console.error('❌ Error obteniendo destinatarios:', errorDest);
    return;
  }

  if (!destinatarios || destinatarios.length === 0) {
    console.error('❌ PROBLEMA: La programación NO está asignada al usuario');
    console.log('\n💡 Verificando si está asignada a otros usuarios...');
    const { data: otrosDestinatarios } = await supabase
      .from('programacion_destinatarios')
      .select('*')
      .eq('programacion_id', PROGRAMACION_ID);
    
    if (otrosDestinatarios && otrosDestinatarios.length > 0) {
      console.log(`   ⚠️ La programación está asignada a ${otrosDestinatarios.length} otro(s) usuario(s):`);
      otrosDestinatarios.forEach(d => {
        console.log(`      - Usuario: ${d.usuario_id}, Activo: ${d.activo}`);
      });
    } else {
      console.log('   ⚠️ La programación NO está asignada a ningún usuario');
    }
  } else {
    const activo = destinatarios[0].activo;
    console.log(`✅ Programación asignada al usuario`);
    console.log(`   - Activo: ${activo}`);
    if (!activo) {
      console.error(`\n❌ PROBLEMA: La asignación NO está activa`);
    }
  }

  // 3. Verificar contenidos asignados
  console.log('\n3️⃣ VERIFICANDO CONTENIDOS ASIGNADOS...');
  const { data: contenidos, error: errorCont } = await supabase
    .from('programacion_contenidos')
    .select('*, contenidos(*)')
    .eq('programacion_id', PROGRAMACION_ID)
    .eq('activo', true);

  if (errorCont) {
    console.error('❌ Error obteniendo contenidos:', errorCont);
    return;
  }

  if (!contenidos || contenidos.length === 0) {
    console.error('❌ PROBLEMA: La programación NO tiene contenidos asignados');
  } else {
    console.log(`✅ ${contenidos.length} contenido(s) asignado(s):`);
    contenidos.forEach((pc, idx) => {
      const contenido = pc.contenidos;
      console.log(`   ${idx + 1}. Orden: ${pc.orden}`);
      console.log(`      - ID: ${pc.contenido_id}`);
      console.log(`      - Nombre: ${contenido?.nombre || contenido?.titulo || 'Sin nombre'}`);
      console.log(`      - URL S3: ${contenido?.url_s3 ? 'SÍ' : 'NO'}`);
      console.log(`      - Duración: ${contenido?.duracion_segundos || 'N/A'}s`);
    });
  }

  // 4. Verificar formato de weekly_days
  console.log('\n4️⃣ VERIFICANDO FORMATO DE WEEKLY_DAYS...');
  if (programacion.weekly_days) {
    const tipo = typeof programacion.weekly_days;
    console.log(`   - Tipo de dato: ${tipo}`);
    
    if (tipo === 'string') {
      console.error('   ❌ PROBLEMA: weekly_days es un STRING, debería ser un ARRAY');
      console.log(`   - Valor actual: ${programacion.weekly_days}`);
      try {
        const parsed = JSON.parse(programacion.weekly_days);
        console.log(`   - Parseado como JSON: ${JSON.stringify(parsed)}`);
        console.log(`   - Tipo parseado: ${Array.isArray(parsed) ? 'Array ✅' : 'No es array ❌'}`);
      } catch (e) {
        console.error('   - Error parseando JSON:', e.message);
      }
    } else if (Array.isArray(programacion.weekly_days)) {
      console.log('   ✅ weekly_days es un array');
      console.log(`   - Valores: ${JSON.stringify(programacion.weekly_days)}`);
      console.log(`   - Cantidad: ${programacion.weekly_days.length}`);
      
      // Verificar valores duplicados
      const unicos = [...new Set(programacion.weekly_days)];
      if (unicos.length !== programacion.weekly_days.length) {
        console.warn('   ⚠️ ADVERTENCIA: Hay valores duplicados en weekly_days');
      }
      
      // Verificar formato de días
      const formatosValidos = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 
                               'dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab',
                               'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const invalidos = programacion.weekly_days.filter(d => !formatosValidos.includes(d?.toLowerCase()));
      if (invalidos.length > 0) {
        console.warn(`   ⚠️ ADVERTENCIA: Valores con formato no reconocido: ${JSON.stringify(invalidos)}`);
      }
    } else {
      console.error(`   ❌ PROBLEMA: weekly_days tiene un tipo inesperado: ${tipo}`);
    }
  } else {
    console.error('   ❌ PROBLEMA: weekly_days es null o undefined');
  }

  // 5. Verificar si debería ejecutarse ahora
  console.log('\n5️⃣ VERIFICANDO SI DEBERÍA EJECUTARSE AHORA...');
  const ahora = new Date();
  const horaActual = ahora.toTimeString().slice(0, 5); // "HH:mm"
  const diaSemana = ['sun','mon','tue','wed','thu','fri','sat'][ahora.getDay()];
  const fechaActual = ahora.toISOString().slice(0, 10); // "YYYY-MM-DD"

  console.log(`   - Fecha actual: ${fechaActual}`);
  console.log(`   - Hora actual: ${horaActual}`);
  console.log(`   - Día de la semana: ${diaSemana}`);

  // Verificar rango de fechas
  if (programacion.fecha_inicio && fechaActual < programacion.fecha_inicio) {
    console.error(`   ❌ Fuera de rango: fecha actual (${fechaActual}) < fecha_inicio (${programacion.fecha_inicio})`);
  } else if (programacion.fecha_fin && fechaActual > programacion.fecha_fin) {
    console.error(`   ❌ Fuera de rango: fecha actual (${fechaActual}) > fecha_fin (${programacion.fecha_fin})`);
  } else {
    console.log('   ✅ Dentro del rango de fechas');
  }

  // Verificar día de la semana
  if (programacion.tipo === 'semanal' && programacion.weekly_days) {
    const weeklyDaysArray = Array.isArray(programacion.weekly_days) 
      ? programacion.weekly_days 
      : (typeof programacion.weekly_days === 'string' ? JSON.parse(programacion.weekly_days) : []);
    
    const diaHoyFormatos = {
      'sun': ['sun', 'dom', 'domingo'],
      'mon': ['mon', 'lun', 'lunes'],
      'tue': ['tue', 'mar', 'martes'],
      'wed': ['wed', 'mie', 'miercoles', 'miércoles'],
      'thu': ['thu', 'jue', 'jueves'],
      'fri': ['fri', 'vie', 'viernes'],
      'sat': ['sat', 'sab', 'sabado', 'sábado']
    };
    
    const formatosDiaHoy = diaHoyFormatos[diaSemana] || [diaSemana];
    const estaDiaEnPrograma = weeklyDaysArray.some(dia => 
      formatosDiaHoy.includes(dia?.toLowerCase())
    );
    
    if (!estaDiaEnPrograma) {
      console.error(`   ❌ PROBLEMA: Hoy (${diaSemana}) NO está en días programados`);
      console.log(`   - Días programados: ${JSON.stringify(weeklyDaysArray)}`);
    } else {
      console.log(`   ✅ Hoy (${diaSemana}) SÍ está en días programados`);
    }

    // Verificar hora si es modo una_vez_dia
    if (programacion.weekly_mode === 'una_vez_dia') {
      const tiempoAMinutos = (tiempo) => {
        if (!tiempo) return 0;
        const [h, m] = tiempo.split(':').map(Number);
        return h * 60 + m;
      };
      
      const horaProgMinutos = tiempoAMinutos(programacion.weekly_hora_una_vez);
      const horaActualMinutos = tiempoAMinutos(horaActual);
      const esHoraExacta = horaActualMinutos === horaProgMinutos;
      
      console.log(`   - Modo: una_vez_dia`);
      console.log(`   - Hora programada: ${programacion.weekly_hora_una_vez} (${horaProgMinutos} minutos)`);
      console.log(`   - Hora actual: ${horaActual} (${horaActualMinutos} minutos)`);
      
      if (!esHoraExacta) {
        const diferencia = Math.abs(horaActualMinutos - horaProgMinutos);
        console.warn(`   ⚠️ No es la hora exacta (diferencia: ${diferencia} minutos)`);
        console.log(`   💡 La programación solo se ejecuta EXACTAMENTE a las ${programacion.weekly_hora_una_vez}`);
      } else {
        console.log(`   ✅ Es la hora exacta - debería ejecutarse`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📋 RESUMEN DE PROBLEMAS ENCONTRADOS:\n');
  
  const problemas = [];
  if (programacion.estado !== 'activo') problemas.push('Programación no está activa');
  if (!destinatarios || destinatarios.length === 0 || !destinatarios[0].activo) problemas.push('No está asignada al usuario o asignación inactiva');
  if (!contenidos || contenidos.length === 0) problemas.push('No tiene contenidos asignados');
  if (typeof programacion.weekly_days === 'string') problemas.push('weekly_days es un string en lugar de array');
  
  if (problemas.length === 0) {
    console.log('✅ No se encontraron problemas obvios');
    console.log('💡 Verifica los logs del navegador para más detalles');
  } else {
    problemas.forEach((p, idx) => {
      console.log(`${idx + 1}. ❌ ${p}`);
    });
  }
}

// Ejecutar diagnóstico
diagnosticarProgramacion().catch(console.error);

