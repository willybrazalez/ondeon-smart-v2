#!/bin/bash

# Script para ejecutar pruebas de carga con JMeter
# Uso: ./scripts/ejecutar-pruebas-carga.sh [SUPABASE_ANON_KEY]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
JMETER_HOME="${JMETER_HOME:-jmeter}"
TEST_PLAN="jmeter/ondeon-smart-load-test.jmx"
RESULTS_DIR="results"
REPORTS_DIR="reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Crear directorios
mkdir -p "$RESULTS_DIR" "$REPORTS_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Pruebas de Carga - Ondeon Smart con JMeter      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📅 Timestamp:${NC} $TIMESTAMP"
echo ""

# Verificar que JMeter está instalado
if ! command -v jmeter &> /dev/null; then
    echo -e "${RED}❌ JMeter no está instalado${NC}"
    echo "Instala con: brew install jmeter (macOS)"
    exit 1
fi

# Verificar que el test plan existe
if [ ! -f "$TEST_PLAN" ]; then
    echo -e "${RED}❌ Test plan no encontrado: $TEST_PLAN${NC}"
    exit 1
fi

# Obtener SUPABASE_ANON_KEY
if [ -n "$1" ]; then
    SUPABASE_ANON_KEY="$1"
elif [ -n "$SUPABASE_ANON_KEY" ]; then
    echo -e "${GREEN}✅ Usando SUPABASE_ANON_KEY de variable de entorno${NC}"
else
    echo -e "${YELLOW}⚠️  SUPABASE_ANON_KEY no proporcionada${NC}"
    echo ""
    echo "Uso: $0 [SUPABASE_ANON_KEY]"
    echo "O configura la variable de entorno: export SUPABASE_ANON_KEY=tu_key"
    echo ""
    read -p "¿Deseas continuar sin autenticación? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    SUPABASE_ANON_KEY="REPLACE_WITH_YOUR_KEY"
fi

# URL de Supabase (hardcoded basado en el código)
SUPABASE_URL="https://nazlyvhndymalevkfpnl.supabase.co"

# Nombre del archivo de resultados
RESULTS_FILE="$RESULTS_DIR/test-$TIMESTAMP.jtl"
REPORT_DIR="$REPORTS_DIR/test-$TIMESTAMP"

echo -e "${GREEN}📊 Configuración:${NC}"
echo "  Test Plan: $TEST_PLAN"
echo "  Supabase URL: $SUPABASE_URL"
echo "  Results: $RESULTS_FILE"
echo "  Report: $REPORT_DIR"
echo ""

# Validar test plan
echo -e "${BLUE}🔍 Validando test plan...${NC}"
if jmeter -n -t "$TEST_PLAN" -JSUPABASE_URL="$SUPABASE_URL" -JSUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" -l /dev/null 2>&1 | grep -q "Error"; then
    echo -e "${RED}❌ Error en test plan${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Test plan válido${NC}"
echo ""

# Ejecutar JMeter
echo -e "${BLUE}🚀 Ejecutando pruebas de carga...${NC}"
echo ""

jmeter -n \
    -t "$TEST_PLAN" \
    -l "$RESULTS_FILE" \
    -e \
    -o "$REPORT_DIR" \
    -JSUPABASE_URL="$SUPABASE_URL" \
    -JSUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=false \
    -Jjmeter.save.saveservice.samplerData=false

EXIT_CODE=$?

# Verificar éxito
if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Pruebas completadas exitosamente                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}📊 Resultados:${NC}"
    echo "  - JTL: $RESULTS_FILE"
    echo "  - Reporte HTML: $REPORT_DIR/index.html"
    echo ""
    echo -e "${BLUE}📈 Métricas rápidas:${NC}"
    if [ -f "$RESULTS_FILE" ]; then
        TOTAL_REQUESTS=$(grep -c "<httpSample" "$RESULTS_FILE" 2>/dev/null || echo "0")
        SUCCESS_REQUESTS=$(grep -c 's="true"' "$RESULTS_FILE" 2>/dev/null || echo "0")
        ERROR_REQUESTS=$(grep -c 's="false"' "$RESULTS_FILE" 2>/dev/null || echo "0")
        echo "  - Total requests: $TOTAL_REQUESTS"
        echo "  - Exitosos: $SUCCESS_REQUESTS"
        echo "  - Errores: $ERROR_REQUESTS"
    fi
    echo ""
    echo -e "${BLUE}💡 Abre el reporte con:${NC}"
    echo "  open $REPORT_DIR/index.html"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Error ejecutando pruebas (código: $EXIT_CODE)${NC}"
    exit $EXIT_CODE
fi






