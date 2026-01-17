/**
 * Script para preparar usuarios de prueba para JMeter
 * 
 * Este script puede:
 * 1. Listar usuarios existentes en Supabase
 * 2. Crear usuarios de prueba si no existen
 * 
 * Uso:
 * node scripts/preparar-usuarios-prueba.js [--list|--create] [--count=10]
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nazlyvhndymalevkfpnl.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.argv[2];

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_ANON_KEY requerida');
  console.log('Uso: SUPABASE_ANON_KEY=tu_key node scripts/preparar-usuarios-prueba.js [--list|--create]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listExistingUsers() {
  console.log('🔍 Buscando usuarios existentes...\n');
  
  try {
    // Intentar obtener usuarios de la tabla usuarios (legacy)
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from('usuarios')
      .select('id, username, email, rol_id')
      .limit(20);
    
    if (!errorUsuarios && usuarios && usuarios.length > 0) {
      console.log(`✅ Encontrados ${usuarios.length} usuarios en tabla 'usuarios':\n`);
      usuarios.forEach((u, i) => {
        console.log(`  ${i + 1}. Username: ${u.username || 'N/A'}, Email: ${u.email || 'N/A'}, ID: ${u.id}, Rol: ${u.rol_id}`);
      });
      return usuarios;
    }
    
    // Intentar obtener usuarios de Supabase Auth
    const { data: { users }, error: errorAuth } = await supabase.auth.admin.listUsers();
    
    if (!errorAuth && users && users.length > 0) {
      console.log(`✅ Encontrados ${users.length} usuarios en Supabase Auth:\n`);
      users.slice(0, 20).forEach((u, i) => {
        console.log(`  ${i + 1}. Email: ${u.email}, ID: ${u.id}`);
      });
      return users;
    }
    
    console.log('⚠️  No se encontraron usuarios');
    return [];
    
  } catch (error) {
    console.error('❌ Error listando usuarios:', error.message);
    return [];
  }
}

async function createTestUsers(count = 10) {
  console.log(`\n🔨 Creando ${count} usuarios de prueba...\n`);
  
  const createdUsers = [];
  
  for (let i = 1; i <= count; i++) {
    const email = `test${i}@ondeon-test.com`;
    const password = `TestPassword${i}!`;
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: `test_user_${i}`,
            test_user: true
          }
        }
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`  ⚠️  Usuario ${i} ya existe: ${email}`);
          createdUsers.push({ email, password, exists: true });
        } else {
          console.error(`  ❌ Error creando usuario ${i}: ${error.message}`);
        }
      } else {
        console.log(`  ✅ Usuario ${i} creado: ${email}`);
        createdUsers.push({ email, password, exists: false });
      }
      
      // Pequeña pausa para no saturar
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  ❌ Error inesperado creando usuario ${i}:`, error.message);
    }
  }
  
  return createdUsers;
}

async function generateJMeterCSV(users) {
  console.log('\n📝 Generando archivo CSV para JMeter...\n');
  
  const csvContent = ['email,password'].concat(
    users.map(u => `${u.email},${u.password}`)
  ).join('\n');
  
  const fs = await import('fs');
  fs.writeFileSync('jmeter/users.csv', csvContent);
  
  console.log('✅ Archivo creado: jmeter/users.csv');
  console.log(`   ${users.length} usuarios listos para usar en JMeter\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.find(a => a.startsWith('--'))?.replace('--', '') || 'interactive';
  const countArg = args.find(a => a.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1]) : 10;
  
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🔧 Preparación de Usuarios para Pruebas JMeter      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  if (command === 'list') {
    await listExistingUsers();
    rl.close();
    return;
  }
  
  if (command === 'create') {
    const users = await createTestUsers(count);
    if (users.length > 0) {
      await generateJMeterCSV(users);
    }
    rl.close();
    return;
  }
  
  // Modo interactivo
  console.log('¿Qué deseas hacer?');
  console.log('1. Listar usuarios existentes');
  console.log('2. Crear usuarios de prueba');
  console.log('3. Usar usuarios existentes (manual)');
  console.log('');
  
  const answer = await question('Selecciona una opción (1-3): ');
  
  if (answer === '1') {
    const users = await listExistingUsers();
    if (users.length > 0) {
      const use = await question('\n¿Deseas usar estos usuarios para las pruebas? (s/n): ');
      if (use.toLowerCase() === 's') {
        // Convertir a formato para JMeter
        const jmeterUsers = users.map((u, i) => ({
          email: u.email || `test${i + 1}@ondeon-test.com`,
          password: 'CONTRASEÑA_DESCONOCIDA' // Necesitarás proporcionarla
        }));
        await generateJMeterCSV(jmeterUsers);
        console.log('\n⚠️  Nota: Necesitarás actualizar las contraseñas en jmeter/users.csv');
      }
    }
  } else if (answer === '2') {
    const countStr = await question('¿Cuántos usuarios crear? (default: 10): ');
    const userCount = parseInt(countStr) || 10;
    const users = await createTestUsers(userCount);
    if (users.length > 0) {
      await generateJMeterCSV(users);
    }
  } else if (answer === '3') {
    console.log('\n📝 Para usar usuarios existentes manualmente:');
    console.log('1. Crea un archivo jmeter/users.csv con formato:');
    console.log('   email,password');
    console.log('   usuario1@ejemplo.com,password1');
    console.log('   usuario2@ejemplo.com,password2');
    console.log('2. Actualiza el test plan JMeter para usar CSV Data Set Config');
  }
  
  rl.close();
}

main().catch(console.error);






