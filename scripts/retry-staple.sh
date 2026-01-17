#!/bin/bash
# Script para reintentar staple hasta que funcione

DMG="./release/v0.0.40/Mac/Ondeon-Smart-0.0.40-arm64.dmg"
MAX_ATTEMPTS=30
WAIT_SECONDS=60

echo "🔄 Iniciando retry de staple para: $DMG"
echo "   Max intentos: $MAX_ATTEMPTS"
echo "   Intervalo: ${WAIT_SECONDS}s"
echo ""

for i in $(seq 1 $MAX_ATTEMPTS); do
  echo "[$(date '+%H:%M:%S')] Intento $i de $MAX_ATTEMPTS..."
  
  if xcrun stapler staple "$DMG" 2>&1 | grep -q "action worked"; then
    echo ""
    echo "✅ ¡STAPLE EXITOSO! El ticket se ha propagado."
    echo "   DMG stapleado: $DMG"
    exit 0
  fi
  
  if [ $i -lt $MAX_ATTEMPTS ]; then
    echo "   ⏳ Esperando ${WAIT_SECONDS}s antes del siguiente intento..."
    sleep $WAIT_SECONDS
  fi
done

echo ""
echo "⚠️ No se pudo hacer staple después de $MAX_ATTEMPTS intentos."
echo "   La app sigue siendo válida - Gatekeeper verificará online."
exit 1
