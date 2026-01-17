#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script para automatizar el proceso de release
 * Uso: node scripts/release.cjs [patch|minor|major]
 */

const releaseType = process.argv[2] || 'patch';

console.log('🚀 Iniciando proceso de release...');

try {
  // 1. Verificar que no hay cambios sin commit
  try {
    execSync('git diff-index --quiet HEAD --', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Hay cambios sin commit. Haz commit primero.');
    process.exit(1);
  }

  // 2. Actualizar versión
  console.log(`📝 Actualizando versión (${releaseType})...`);
  const result = execSync(`npm version ${releaseType}`, { encoding: 'utf8' });
  const newVersion = result.trim();
  console.log(`✅ Nueva versión: ${newVersion}`);

  // 3. Leer package.json para obtener la versión
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;

  // 4. Build de la aplicación para Electron
  console.log('🏗️ Building aplicación para Electron...');
  execSync('npx cross-env IS_ELECTRON=true npm run build', { stdio: 'inherit' });

  // 5. Build de Electron para Windows
  console.log('📦 Building ejecutables para Windows...');
  execSync('npm run electron:build:win', { stdio: 'inherit' });

  // 6. Push con tags
  console.log('📤 Subiendo cambios a GitHub...');
  execSync('git push origin main --tags', { stdio: 'inherit' });

  console.log('🎉 Release completado exitosamente!');
  console.log(`📋 Versión: ${version}`);
  console.log(`🔗 GitHub: https://github.com/ondeon/frontend-reproductor-web-dekstop/releases/tag/v${version}`);
  console.log('');
  console.log('📝 Próximos pasos:');
  console.log('1. Verificar que el workflow de GitHub Actions se ejecute correctamente');
  console.log('2. Comprobar que los archivos se suban a GitHub Releases');
  console.log('3. Probar la descarga e instalación en diferentes sistemas');
  console.log('4. Verificar que el autoupdater funcione correctamente');

} catch (error) {
  console.error('❌ Error durante el release:', error.message);
  process.exit(1);
}
