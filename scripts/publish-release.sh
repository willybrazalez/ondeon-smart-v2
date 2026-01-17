#!/bin/bash
# Script para publicar un nuevo release en GitHub
# Uso: ./scripts/publish-release.sh [versión]
# Ejemplo: ./scripts/publish-release.sh 0.0.20

set -e  # Salir si hay error

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Error: Debes especificar una versión"
  echo "Uso: ./scripts/publish-release.sh [versión]"
  echo "Ejemplo: ./scripts/publish-release.sh 0.0.20"
  exit 1
fi

echo "🚀 Publicando Ondeon Smart v$VERSION"
echo ""

# Verificar que los archivos existen
echo "📋 Verificando archivos..."

REQUIRED_FILES=(
  "release/Ondeon-Smart-${VERSION}.exe"
  "release/Ondeon-Smart-${VERSION}-x64.exe"
  "release/Ondeon-Smart-${VERSION}-ia32.exe"
  "release/Ondeon-Smart-${VERSION}-x64.dmg"
  "release/Ondeon-Smart-${VERSION}-arm64.dmg"
  "release/Ondeon-Smart-${VERSION}-x64.zip"
  "release/Ondeon-Smart-${VERSION}-arm64.zip"
  "release/latest.yml"
  "release/latest-mac.yml"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
  else
    echo "  ✅ $file"
  fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
  echo ""
  echo "❌ Faltan los siguientes archivos:"
  for file in "${MISSING_FILES[@]}"; do
    echo "  - $file"
  done
  echo ""
  echo "Compila la aplicación primero:"
  echo "  npm run electron:build:all"
  exit 1
fi

echo ""
echo "✅ Todos los archivos están listos"
echo ""

# Preguntar si desea continuar
read -p "¿Crear release v$VERSION en GitHub? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "❌ Cancelado"
  exit 1
fi

# Pedir notas del release
echo ""
echo "Escribe las notas del release (termina con Ctrl+D):"
RELEASE_NOTES=$(cat)

echo ""
echo "📤 Creando release en GitHub..."

# Crear el release con gh CLI
gh release create "v$VERSION" \
  "release/Ondeon-Smart-${VERSION}.exe" \
  "release/Ondeon-Smart-${VERSION}-x64.exe" \
  "release/Ondeon-Smart-${VERSION}-ia32.exe" \
  "release/Ondeon-Smart-${VERSION}-x64.dmg" \
  "release/Ondeon-Smart-${VERSION}-arm64.dmg" \
  "release/Ondeon-Smart-${VERSION}-x64.zip" \
  "release/Ondeon-Smart-${VERSION}-arm64.zip" \
  "release/latest.yml" \
  "release/latest-mac.yml" \
  --title "Ondeon Smart v$VERSION" \
  --notes "$RELEASE_NOTES" \
  --repo ondeon/ondeon-smart-releases

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Release v$VERSION publicado exitosamente"
  echo "🔗 https://github.com/ondeon/ondeon-smart-releases/releases/tag/v$VERSION"
  echo ""
  echo "📱 Los usuarios recibirán la actualización automáticamente al abrir la app."
else
  echo ""
  echo "❌ Error al publicar el release"
  exit 1
fi

