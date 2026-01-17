#!/bin/bash

# Script para notarizar la app de macOS
# Ejecuta después de cada build de Mac

echo "🔔 Iniciando notarización de Ondeon Smart..."
echo "=============================================="
echo ""

KEYCHAIN_PROFILE="ondeon-notarization"
APP_PATH="./out/Ondeon-Smart-darwin-arm64/Ondeon-Smart.app"
ZIP_PATH="./out/make/zip/darwin/arm64/Ondeon-Smart-darwin-arm64-0.0.31.zip"

# Verificar que la app existe
if [ ! -d "$APP_PATH" ]; then
  echo "❌ Error: No se encontró la app en $APP_PATH"
  echo "   Por favor, ejecuta primero: npm run electron:build:mac:forge"
  exit 1
fi

echo "📦 App encontrada: $APP_PATH"
echo ""

# Crear un ZIP temporal para notarización (Apple requiere ZIP o DMG)
echo "📦 Comprimiendo app para notarización..."
TEMP_ZIP="./out/ondeon-notarization-temp.zip"
ditto -c -k --keepParent "$APP_PATH" "$TEMP_ZIP"

if [ ! -f "$TEMP_ZIP" ]; then
  echo "❌ Error al crear el archivo ZIP temporal"
  exit 1
fi

echo "✅ ZIP creado"
echo ""

# Enviar a Apple para notarización
echo "☁️  Enviando a Apple para notarización..."
echo "   (Esto puede tardar 5-15 minutos)"
echo ""

xcrun notarytool submit "$TEMP_ZIP" \
  --keychain-profile "$KEYCHAIN_PROFILE" \
  --wait

NOTARIZE_STATUS=$?

# Limpiar archivo temporal
rm -f "$TEMP_ZIP"

if [ $NOTARIZE_STATUS -eq 0 ]; then
  echo ""
  echo "✅ ¡Notarización completada exitosamente!"
  echo ""
  echo "📌 Ahora debes 'staple' (grapar) el ticket de notarización a la app:"
  echo ""
  
  # Staple a la app
  echo "📎 Grapando ticket a la app..."
  xcrun stapler staple "$APP_PATH"
  
  if [ $? -eq 0 ]; then
    echo "✅ Ticket grapado a la app"
    echo ""
    
    # Verificar
    echo "🔍 Verificando notarización..."
    spctl --assess --verbose "$APP_PATH"
    
    echo ""
    echo "🎉 ¡Todo listo!"
    echo ""
    echo "📦 Tu app notarizada está en:"
    echo "   $APP_PATH"
    echo ""
    echo "🚀 Siguiente paso:"
    echo "   Crear DMG/ZIP final con la app ya stapleada:"
    echo "   npm run electron:forge:make"
    echo ""
    echo "   El DMG generado estará en: ./out/make/"
  else
    echo "⚠️  Advertencia: No se pudo grapar el ticket, pero la app está notarizada"
  fi
else
  echo ""
  echo "❌ La notarización falló"
  echo ""
  echo "Para ver más detalles del error:"
  echo "   xcrun notarytool log <submission-id> --keychain-profile $KEYCHAIN_PROFILE"
  exit 1
fi

