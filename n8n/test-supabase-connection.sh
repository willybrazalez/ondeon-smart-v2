#!/bin/bash

# Script de prueba de conexión a Supabase
# Uso: ./test-supabase-connection.sh

echo "🔍 Probando conexión a Supabase..."
echo ""

PROJECT_REF="vqhaoerphnyahnbemmdd"
PASSWORD="gNcilTolun2tk9wV"
HOST="db.${PROJECT_REF}.supabase.co"
PORT="5432"
DATABASE="postgres"

echo "📋 Configuración:"
echo "   Host: $HOST"
echo "   Database: $DATABASE"
echo "   Port: $PORT"
echo ""

# Verificar si psql está instalado
if ! command -v psql &> /dev/null; then
    echo "❌ psql no está instalado."
    echo "   Instala con: brew install postgresql (macOS) o sudo apt-get install postgresql-client (Linux)"
    exit 1
fi

echo "✅ psql encontrado"
echo ""

# Prueba 1: Conexión con Pooler
echo "🧪 Prueba 1: Conexión con Pooler (postgres.${PROJECT_REF})"
echo "   Connection string: postgresql://postgres.${PROJECT_REF}:***@${HOST}:${PORT}/${DATABASE}?sslmode=require"
if psql "postgresql://postgres.${PROJECT_REF}:${PASSWORD}@${HOST}:${PORT}/${DATABASE}?sslmode=require" -c "SELECT 1 as test;" 2>&1 | grep -q "test"; then
    echo "   ✅ Conexión exitosa con Pooler"
    POOLER_OK=true
else
    echo "   ❌ Error con Pooler"
    psql "postgresql://postgres.${PROJECT_REF}:${PASSWORD}@${HOST}:${PORT}/${DATABASE}?sslmode=require" -c "SELECT 1;" 2>&1 | head -3
    POOLER_OK=false
fi
echo ""

# Prueba 2: Conexión Directa
echo "🧪 Prueba 2: Conexión Directa (postgres)"
echo "   Connection string: postgresql://postgres:***@${HOST}:${PORT}/${DATABASE}?sslmode=require"
if psql "postgresql://postgres:${PASSWORD}@${HOST}:${PORT}/${DATABASE}?sslmode=require" -c "SELECT 1 as test;" 2>&1 | grep -q "test"; then
    echo "   ✅ Conexión exitosa con Conexión Directa"
    DIRECT_OK=true
else
    echo "   ❌ Error con Conexión Directa"
    psql "postgresql://postgres:${PASSWORD}@${HOST}:${PORT}/${DATABASE}?sslmode=require" -c "SELECT 1;" 2>&1 | head -3
    DIRECT_OK=false
fi
echo ""

# Resumen
echo "📊 Resumen:"
if [ "$POOLER_OK" = true ]; then
    echo "   ✅ Pooler funciona - Usa: postgres.${PROJECT_REF}"
elif [ "$DIRECT_OK" = true ]; then
    echo "   ✅ Conexión Directa funciona - Usa: postgres"
else
    echo "   ❌ Ninguna conexión funciona"
    echo ""
    echo "   Posibles causas:"
    echo "   1. Contraseña incorrecta"
    echo "   2. IP bloqueada en Supabase"
    echo "   3. Proyecto pausado o inactivo"
    echo "   4. Problemas de red/firewall"
    echo ""
    echo "   Verifica en Supabase Dashboard:"
    echo "   - Settings → Database → Ver contraseña"
    echo "   - Settings → Database → Network Restrictions"
fi
