# Script PowerShell para obtener las IPs de los servicios de Ondeon Smart
# Autor: Ondeon Development Team
# Fecha: 29 de Octubre de 2025

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🌐 ONDEON SMART - OBTENCIÓN DE IPS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ==========================================
# 1. OBTENER IP DE SUPABASE
# ==========================================
Write-Host "📍 1. SUPABASE" -ForegroundColor Blue
Write-Host "----------------------------------------"

# Buscar VITE_SUPABASE_URL en .env
$envFile = ".env"
if (Test-Path $envFile) {
    $supabaseUrl = Select-String -Path $envFile -Pattern "VITE_SUPABASE_URL" | ForEach-Object {
        $_.Line -replace 'VITE_SUPABASE_URL=', '' -replace '"', '' -replace "'", ''
    }
    
    if ($supabaseUrl) {
        # Extraer PROJECT_REF de la URL
        $projectRef = ($supabaseUrl -replace 'https://', '' -replace 'http://', '') -split '\.' | Select-Object -First 1
        Write-Host "✅ Proyecto encontrado: $projectRef" -ForegroundColor Green
        Write-Host ""
        Write-Host "Resolviendo IP..."
        
        $dbHost = "db.$projectRef.supabase.co"
        
        try {
            $ipSupabase = (Resolve-DnsName -Name $dbHost -Type A -ErrorAction Stop).IPAddress
            Write-Host "✅ IP de Supabase: $ipSupabase" -ForegroundColor Green
            Write-Host "⚠️  Nota: Esta IP puede cambiar si el proyecto se pausa/reanuda" -ForegroundColor Yellow
        }
        catch {
            Write-Host "❌ No se pudo resolver la IP" -ForegroundColor Red
            Write-Host "Intenta manualmente: nslookup $dbHost"
        }
    }
    else {
        Write-Host "❌ VITE_SUPABASE_URL no encontrada en .env" -ForegroundColor Red
    }
}
else {
    Write-Host "⚠️  Archivo .env no encontrado" -ForegroundColor Yellow
    Write-Host "Por favor, ejecuta este script desde la raíz del proyecto"
}

Write-Host ""
Write-Host ""

# ==========================================
# 2. OBTENER RANGOS DE IP DE AMAZON S3
# ==========================================
Write-Host "📍 2. AMAZON S3 (eu-north-1)" -ForegroundColor Blue
Write-Host "----------------------------------------"

Write-Host "Descargando rangos de IP de AWS..."

try {
    # Descargar el archivo JSON de AWS
    $awsIpRanges = Invoke-RestMethod -Uri "https://ip-ranges.amazonaws.com/ip-ranges.json"
    
    # Filtrar rangos de S3 en eu-north-1
    $s3IpRanges = $awsIpRanges.prefixes | Where-Object { 
        $_.service -eq "S3" -and $_.region -eq "eu-north-1" 
    } | Select-Object -ExpandProperty ip_prefix
    
    if ($s3IpRanges) {
        Write-Host "✅ Rangos de IP de S3 en eu-north-1:" -ForegroundColor Green
        Write-Host ""
        
        foreach ($ipRange in $s3IpRanges) {
            Write-Host "  $ipRange"
        }
        
        $count = $s3IpRanges.Count
        Write-Host ""
        Write-Host "✅ Total: $count rangos de IP encontrados" -ForegroundColor Green
    }
    else {
        Write-Host "❌ No se encontraron rangos de IP" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error al descargar rangos de IP: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# ==========================================
# 3. INFORMACIÓN ADICIONAL
# ==========================================
Write-Host "📋 3. INFORMACIÓN ADICIONAL" -ForegroundColor Blue
Write-Host "----------------------------------------"
Write-Host "Servicios utilizados:"
Write-Host "  • Supabase: Base de datos y autenticación"
Write-Host "  • Amazon S3: Almacenamiento de audio"
Write-Host ""
Write-Host "Puertos requeridos:"
Write-Host "  • 443 (HTTPS) - Para ambos servicios"
Write-Host "  • 5432 (PostgreSQL) - Solo si conectas directamente a Supabase DB"
Write-Host ""

# ==========================================
# 4. GENERAR ARCHIVO DE SALIDA
# ==========================================
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputFile = "ips-servicios-$timestamp.txt"

Write-Host "📝 Generando archivo de salida..." -ForegroundColor Blue

$outputContent = @"
==========================================
ONDEON SMART - LISTADO DE IPS
Generado: $(Get-Date)
==========================================

1. SUPABASE
----------------------------------------
"@

if ($ipSupabase) {
    $outputContent += @"
IP: $ipSupabase
Host: db.$projectRef.supabase.co

"@
}
else {
    $outputContent += @"
No disponible - consulta manualmente

"@
}

$outputContent += @"
2. AMAZON S3 (eu-north-1)
----------------------------------------
"@

if ($s3IpRanges) {
    foreach ($ipRange in $s3IpRanges) {
        $outputContent += "$ipRange`n"
    }
}

$outputContent += @"

==========================================
"@

$outputContent | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "✅ Archivo generado: $outputFile" -ForegroundColor Green
Write-Host ""

# ==========================================
# 5. EJEMPLO DE REGLAS DE FIREWALL WINDOWS
# ==========================================
Write-Host "🔥 EJEMPLO - REGLAS DE FIREWALL DE WINDOWS" -ForegroundColor Yellow
Write-Host "----------------------------------------"
Write-Host "Para agregar reglas al firewall de Windows (ejecutar como Administrador):"
Write-Host ""

if ($ipSupabase) {
    Write-Host "# Permitir Supabase:" -ForegroundColor Cyan
    Write-Host "New-NetFirewallRule -DisplayName 'Ondeon - Supabase' -Direction Outbound -RemoteAddress $ipSupabase -Action Allow -Protocol TCP -RemotePort 443,5432"
    Write-Host ""
}

Write-Host "# Permitir rangos de S3 (ejemplo para los primeros 3 rangos):" -ForegroundColor Cyan
if ($s3IpRanges) {
    $firstThree = $s3IpRanges | Select-Object -First 3
    foreach ($ipRange in $firstThree) {
        Write-Host "New-NetFirewallRule -DisplayName 'Ondeon - S3 $ipRange' -Direction Outbound -RemoteAddress $ipRange -Action Allow -Protocol TCP -RemotePort 443"
    }
    Write-Host "# ... (repetir para todos los rangos)"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ PROCESO COMPLETADO" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Recomendaciones:" -ForegroundColor Yellow
Write-Host "  1. Actualiza estas IPs mensualmente"
Write-Host "  2. Las IPs de AWS cambian frecuentemente"
Write-Host "  3. Considera usar dominios en lugar de IPs cuando sea posible"
Write-Host ""
Write-Host "📞 Soporte: development@ondeon.es"
Write-Host "==========================================" -ForegroundColor Cyan












