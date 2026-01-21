#!/bin/bash
# Script para obtener las IPs de los servicios de Ondeon Smart
# Autor: Ondeon Development Team
# Fecha: 29 de Octubre de 2025

echo "=========================================="
echo "🌐 ONDEON SMART - OBTENCIÓN DE IPS"
echo "=========================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==========================================
# 1. OBTENER IP DE SUPABASE
# ==========================================
echo -e "${BLUE}📍 1. SUPABASE${NC}"
echo "----------------------------------------"

# Buscar VITE_SUPABASE_URL en el proyecto
if [ -f ".env" ]; then
    SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ ! -z "$SUPABASE_URL" ]; then
        # Extraer PROJECT_REF de la URL
        PROJECT_REF=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|http://||' | cut -d '.' -f1)
        echo -e "${GREEN}✅ Proyecto encontrado:${NC} $PROJECT_REF"
        echo ""
        echo "Resolviendo IP..."
        
        DB_HOST="db.${PROJECT_REF}.supabase.co"
        IP_SUPABASE=$(nslookup $DB_HOST 2>/dev/null | grep -A1 "Name:" | grep "Address:" | tail -1 | awk '{print $2}')
        
        if [ ! -z "$IP_SUPABASE" ]; then
            echo -e "${GREEN}✅ IP de Supabase:${NC} $IP_SUPABASE"
            echo -e "${YELLOW}⚠️  Nota:${NC} Esta IP puede cambiar si el proyecto se pausa/reanuda"
        else
            echo -e "${RED}❌ No se pudo resolver la IP${NC}"
            echo "Intenta manualmente: nslookup $DB_HOST"
        fi
    else
        echo -e "${RED}❌ VITE_SUPABASE_URL no encontrada en .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Archivo .env no encontrado${NC}"
    echo "Por favor, ejecuta este script desde la raíz del proyecto"
fi

echo ""
echo ""

# ==========================================
# 2. OBTENER RANGOS DE IP DE AMAZON S3
# ==========================================
echo -e "${BLUE}📍 2. AMAZON S3 (eu-north-1)${NC}"
echo "----------------------------------------"

# Verificar si jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq no está instalado${NC}"
    echo "Instalando método alternativo..."
    echo ""
    
    # Método sin jq usando Python
    if command -v python3 &> /dev/null; then
        echo "Descargando rangos de IP de AWS..."
        curl -s https://ip-ranges.amazonaws.com/ip-ranges.json -o /tmp/aws-ip-ranges.json
        
        echo -e "${GREEN}✅ Rangos de IP de S3 en eu-north-1:${NC}"
        echo ""
        
        python3 << 'EOF'
import json
try:
    with open('/tmp/aws-ip-ranges.json') as f:
        data = json.load(f)
        count = 0
        for prefix in data['prefixes']:
            if prefix.get('service') == 'S3' and prefix.get('region') == 'eu-north-1':
                print(f"  {prefix['ip_prefix']}")
                count += 1
        print(f"\n✅ Total: {count} rangos de IP encontrados")
except Exception as e:
    print(f"❌ Error: {e}")
EOF
        
        # Limpiar archivo temporal
        rm -f /tmp/aws-ip-ranges.json
    else
        echo -e "${RED}❌ Python3 no está instalado${NC}"
        echo ""
        echo "Por favor, instala jq o python3:"
        echo "  macOS: brew install jq"
        echo "  Linux: sudo apt-get install jq"
    fi
else
    # Método con jq
    echo "Descargando rangos de IP de AWS con jq..."
    echo -e "${GREEN}✅ Rangos de IP de S3 en eu-north-1:${NC}"
    echo ""
    
    S3_IPS=$(curl -s https://ip-ranges.amazonaws.com/ip-ranges.json | \
             jq -r '.prefixes[] | select(.region=="eu-north-1") | select(.service=="S3") | .ip_prefix')
    
    if [ ! -z "$S3_IPS" ]; then
        echo "$S3_IPS" | while read -r ip; do
            echo "  $ip"
        done
        
        COUNT=$(echo "$S3_IPS" | wc -l | tr -d ' ')
        echo ""
        echo -e "${GREEN}✅ Total: $COUNT rangos de IP encontrados${NC}"
    else
        echo -e "${RED}❌ No se pudieron obtener los rangos de IP${NC}"
    fi
fi

echo ""
echo ""

# ==========================================
# 3. INFORMACIÓN ADICIONAL
# ==========================================
echo -e "${BLUE}📋 3. INFORMACIÓN ADICIONAL${NC}"
echo "----------------------------------------"
echo "Servicios utilizados:"
echo "  • Supabase: Base de datos y autenticación"
echo "  • Amazon S3: Almacenamiento de audio"
echo ""
echo "Puertos requeridos:"
echo "  • 443 (HTTPS) - Para ambos servicios"
echo "  • 5432 (PostgreSQL) - Solo si conectas directamente a Supabase DB"
echo ""

# ==========================================
# 4. GENERAR ARCHIVO DE SALIDA
# ==========================================
OUTPUT_FILE="ips-servicios-$(date +%Y%m%d-%H%M%S).txt"
echo -e "${BLUE}📝 Generando archivo de salida...${NC}"

{
    echo "=========================================="
    echo "ONDEON SMART - LISTADO DE IPS"
    echo "Generado: $(date)"
    echo "=========================================="
    echo ""
    echo "1. SUPABASE"
    echo "----------------------------------------"
    if [ ! -z "$IP_SUPABASE" ]; then
        echo "IP: $IP_SUPABASE"
        echo "Host: db.$PROJECT_REF.supabase.co"
    else
        echo "No disponible - consulta manualmente"
    fi
    echo ""
    echo "2. AMAZON S3 (eu-north-1)"
    echo "----------------------------------------"
    if command -v jq &> /dev/null; then
        curl -s https://ip-ranges.amazonaws.com/ip-ranges.json | \
        jq -r '.prefixes[] | select(.region=="eu-north-1") | select(.service=="S3") | .ip_prefix'
    elif command -v python3 &> /dev/null; then
        curl -s https://ip-ranges.amazonaws.com/ip-ranges.json | \
        python3 -c "import sys, json; data=json.load(sys.stdin); [print(p['ip_prefix']) for p in data['prefixes'] if p.get('service')=='S3' and p.get('region')=='eu-north-1']"
    fi
    echo ""
    echo "=========================================="
} > "$OUTPUT_FILE"

echo -e "${GREEN}✅ Archivo generado:${NC} $OUTPUT_FILE"
echo ""

echo "=========================================="
echo -e "${GREEN}✅ PROCESO COMPLETADO${NC}"
echo "=========================================="
echo ""
echo "💡 Recomendaciones:"
echo "  1. Actualiza estas IPs mensualmente"
echo "  2. Las IPs de AWS cambian frecuentemente"
echo "  3. Considera usar dominios en lugar de IPs cuando sea posible"
echo ""
echo "📞 Soporte: development@ondeon.es"
echo "=========================================="












