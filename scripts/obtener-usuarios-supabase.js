/**
 * Script para obtener usuarios de la tabla usuarios y generar CSV para JMeter
 * 
 * Uso:
 * SUPABASE_ANON_KEY=tu_key node scripts/obtener-usuarios-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nazlyvhndymalevkfpnl.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.argv[2];

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_ANON_KEY requerida');
  console.log('Uso: SUPABASE_ANON_KEY=tu_key node scripts/obtener-usuarios-supabase.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function obtenerUsuarios() {
  console.log('🔍 Obteniendo usuarios de la tabla "usuarios"...\n');
  
  try {
    // Obtener todos los usuarios de la tabla usuarios
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('username, password, email, id')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('❌ Error obteniendo usuarios:', error.message);
      console.error('   Detalles:', error);
      process.exit(1);
    }
    
    if (!usuarios || usuarios.length === 0) {
      console.log('⚠️  No se encontraron usuarios en la tabla "usuarios"');
      process.exit(1);
    }
    
    console.log(`✅ Encontrados ${usuarios.length} usuarios\n`);
    
    // Generar CSV con username y password (para login legacy)
    const csvLines = ['username,password'];
    
    usuarios.forEach((usuario, index) => {
      const username = usuario.username;
      const password = usuario.password;
      
      if (!username || !password) {
        console.warn(`⚠️  Usuario ${index + 1} (ID: ${usuario.id}) sin username o password, omitiendo`);
        return;
      }
      
      csvLines.push(`${username},${password}`);
      const email = usuario.email || `${username}@ondeon-test.com`;
      console.log(`  ${index + 1}. ${username} (${email})`);
    });
    
    // Escribir CSV
    const csvContent = csvLines.join('\n');
    const csvPath = 'jmeter/users.csv';
    
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    
    console.log(`\n✅ Archivo CSV generado: ${csvPath}`);
    console.log(`   ${csvLines.length - 1} usuarios listos para pruebas JMeter\n`);
    
    return usuarios.length;
    
  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
    process.exit(1);
  }
}

obtenerUsuarios().catch(console.error);
