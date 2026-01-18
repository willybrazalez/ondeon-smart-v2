#!/bin/bash
# ==========================================
# Script de Limpieza de Variables de Entorno
# ==========================================
# 
# Este script elimina las claves innecesarias del archivo .env
# Ejecutar desde la raíz del proyecto: ./scripts/cleanup-env.sh
#

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: No se encontró el archivo .env"
    echo "   Asegúrate de ejecutar este script desde la raíz del proyecto"
    exit 1
fi

echo "🔐 Limpiando claves innecesarias del .env..."
echo ""

# Backup del archivo original
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup creado: ${ENV_FILE}.backup.*"

# Claves a eliminar (no se usan en el código)
KEYS_TO_REMOVE=(
    "VITE_OPENAI_API_KEY"
    "VITE_ELEVENLABS_API_KEY"
    "VITE_SUNO_API_KEY"
    "VITE_MUSICGPT_API_KEY"
    "VITE_MUSICGPT_WEBHOOK_URL"
    "APPLE_ID"
    "APPLE_APP_PASSWORD"
    "APPLE_TEAM_ID"
    "APPLE_API_KEY_ID"
    "APPLE_API_ISSUER"
    "APPLE_API_KEY_PATH"
    "CSC_IDENTITY_AUTO_DISCOVERY"
    "CSC_NAME"
    "ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES"
)

for key in "${KEYS_TO_REMOVE[@]}"; do
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        # Usar sed compatible con macOS
        sed -i '' "/^${key}=/d" "$ENV_FILE"
        echo "🗑️  Eliminada: $key"
    fi
done

echo ""
echo "✅ Limpieza completada"
echo ""
echo "📋 Claves que DEBEN permanecer en .env:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo "   - VITE_CLOUDFRONT_DOMAIN"
echo "   - VITE_GOOGLE_MAPS_API_KEY (opcional, con restricciones)"
echo "   - VITE_ENABLE_PRESENCE"
echo "   - VITE_APP_VERSION"
echo ""
echo "⚠️  Claves que van en Supabase Secrets (NO en .env):"
echo "   - OPENAI_API_KEY"
echo "   - ELEVENLABS_API_KEY"
echo "   - ONDEON_LAMBDA_S3_URL"
echo ""
