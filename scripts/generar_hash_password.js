#!/usr/bin/env node

/**
 * Script para generar hash bcrypt de contraseñas o verificar contraseñas
 * 
 * Uso:
 *   node scripts/generar_hash_password.js generar "miPassword123"
 *   node scripts/generar_hash_password.js verificar "miPassword123" "$2a$10$..."
 */

import bcryptjs from 'bcryptjs';

const comando = process.argv[2];
const password = process.argv[3];
const hash = process.argv[4];

if (!comando || !password) {
  console.log(`
🔐 Script de Gestión de Contraseñas

Uso:
  Generar nuevo hash:
    node scripts/generar_hash_password.js generar "miPassword123"
  
  Verificar contraseña contra hash:
    node scripts/generar_hash_password.js verificar "miPassword123" "$2a$10$..."
  
  Verificar contraseña del CSV:
    node scripts/generar_hash_password.js verificar "password" "$2a$10$LJi4/Lk.m8ozLZurrKdbkuMoGS9CPVnH89cmBic6qOrqwkJOAXlWO"
  `);
  process.exit(1);
}

if (comando === 'generar') {
  // Generar nuevo hash
  const saltRounds = 10;
  const hashGenerado = bcryptjs.hashSync(password, saltRounds);
  
  console.log('\n✅ Hash generado:');
  console.log(hashGenerado);
  console.log('\n📋 Para actualizar en la base de datos:');
  console.log(`UPDATE usuarios SET password = '${hashGenerado}' WHERE username = 'AdmiralAdministrador';`);
  
} else if (comando === 'verificar') {
  // Verificar contraseña contra hash
  if (!hash) {
    console.error('❌ Error: Debes proporcionar el hash para verificar');
    console.log('Uso: node scripts/generar_hash_password.js verificar "password" "$2a$10$..."');
    process.exit(1);
  }
  
  const esValida = bcryptjs.compareSync(password, hash);
  
  if (esValida) {
    console.log('\n✅ La contraseña es CORRECTA');
    console.log(`Hash verificado: ${hash.substring(0, 30)}...`);
  } else {
    console.log('\n❌ La contraseña es INCORRECTA');
    console.log(`Hash proporcionado: ${hash.substring(0, 30)}...`);
  }
  
} else {
  console.error(`❌ Comando desconocido: ${comando}`);
  console.log('Comandos disponibles: generar, verificar');
  process.exit(1);
}

