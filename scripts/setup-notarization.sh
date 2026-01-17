#!/bin/bash

# Script para configurar la notarización de macOS
# Solo necesitas ejecutarlo UNA VEZ

echo "🔐 Configuración de Notarización para Ondeon Smart"
echo "=================================================="
echo ""
echo "Este script guardará tu contraseña de aplicación de forma segura en el Keychain de macOS."
echo ""

# Datos de Apple Developer
APPLE_ID="wibrazalez@gmail.com"
TEAM_ID="K4TADJ2262"
KEYCHAIN_PROFILE="ondeon-notarization"

echo "📧 Apple ID: $APPLE_ID"
echo "🏢 Team ID: $TEAM_ID"
echo ""

# Solicitar la contraseña de aplicación
echo "🔑 Por favor, ingresa la contraseña de aplicación que generaste en appleid.apple.com:"
echo "(Formato: xxxx-xxxx-xxxx-xxxx)"
echo ""
read -s APP_PASSWORD

if [ -z "$APP_PASSWORD" ]; then
  echo "❌ Error: No se proporcionó ninguna contraseña"
  exit 1
fi

echo ""
echo "💾 Guardando credenciales en el Keychain..."

# Guardar en el Keychain usando notarytool
xcrun notarytool store-credentials "$KEYCHAIN_PROFILE" \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "$APP_PASSWORD"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ ¡Configuración completada exitosamente!"
  echo ""
  echo "📝 Perfil creado: $KEYCHAIN_PROFILE"
  echo ""
  echo "🚀 Ahora puedes notarizar tus builds con:"
  echo "   npm run notarize"
  echo ""
  echo "⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro por si la necesitas en el futuro."
else
  echo ""
  echo "❌ Error al guardar las credenciales. Por favor, verifica:"
  echo "   - Que la contraseña sea correcta"
  echo "   - Que tengas conexión a internet"
  echo "   - Que tu Apple ID esté registrado en el Apple Developer Program"
fi

