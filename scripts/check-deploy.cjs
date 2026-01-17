#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración para despliegue en Amplify...\n');

const checks = [
  {
    name: 'Archivo amplify.yml',
    path: 'amplify.yml',
    required: true
  },
  {
    name: 'Archivo _redirects',
    path: 'public/_redirects',
    required: true
  },
  {
    name: 'Archivo _headers',
    path: 'public/_headers',
    required: false
  },
  {
    name: 'Archivo robots.txt',
    path: 'public/robots.txt',
    required: false
  },
  {
    name: 'Archivo 404.html',
    path: 'public/404.html',
    required: false
  },
  {
    name: 'package.json',
    path: 'package.json',
    required: true
  },
  {
    name: 'vite.config.js',
    path: 'vite.config.js',
    required: true
  }
];

let allPassed = true;

checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  const status = exists ? '✅' : (check.required ? '❌' : '⚠️');
  const message = check.required ? 'REQUERIDO' : 'OPCIONAL';
  
  console.log(`${status} ${check.name} - ${message}`);
  
  if (check.required && !exists) {
    allPassed = false;
  }
});

console.log('\n📋 Variables de entorno requeridas:');
console.log('   VITE_SUPABASE_URL');
console.log('   VITE_SUPABASE_ANON_KEY');

console.log('\n🚀 Pasos para el despliegue:');
console.log('   1. Subir código a GitHub/GitLab/Bitbucket');
console.log('   2. Conectar repositorio en AWS Amplify');
console.log('   3. Configurar variables de entorno');
console.log('   4. Desplegar automáticamente');

if (allPassed) {
  console.log('\n✅ ¡Todo listo para el despliegue!');
  process.exit(0);
} else {
  console.log('\n❌ Hay archivos requeridos faltantes. Revisa la configuración.');
  process.exit(1);
} 