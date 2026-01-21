# Script para forzar la desinstalación completa de Ondeon Smart
# Ejecutar como ADMINISTRADOR

Write-Host "🗑️ DESINSTALADOR FORZADO - Ondeon Smart" -ForegroundColor Cyan
Write-Host ""

# 1. Matar TODOS los procesos relacionados
Write-Host "1️⃣ Cerrando procesos..." -ForegroundColor Yellow
$processNames = @("Ondeon Smart", "ondeon-smart", "electron")

foreach ($name in $processNames) {
    $processes = Get-Process | Where-Object {$_.ProcessName -like "*$name*"}
    if ($processes) {
        $processes | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  ✅ Cerrado: $name" -ForegroundColor Green
    }
}

Start-Sleep -Seconds 3

# 2. Buscar y ejecutar desinstalador oficial
Write-Host ""
Write-Host "2️⃣ Buscando desinstalador oficial..." -ForegroundColor Yellow

$uninstallerPaths = @(
    "$env:LOCALAPPDATA\Programs\ondeon-smart\Uninstall Ondeon Smart.exe",
    "$env:ProgramFiles\Ondeon Smart\Uninstall Ondeon Smart.exe"
)

foreach ($uninstaller in $uninstallerPaths) {
    if (Test-Path $uninstaller) {
        Write-Host "  ✅ Ejecutando desinstalador: $uninstaller" -ForegroundColor Green
        Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -NoNewWindow
        Start-Sleep -Seconds 2
    }
}

# 3. Eliminar carpetas manualmente
Write-Host ""
Write-Host "3️⃣ Eliminando carpetas..." -ForegroundColor Yellow

$foldersToDelete = @(
    "$env:LOCALAPPDATA\Programs\ondeon-smart",
    "$env:LOCALAPPDATA\ondeon-smart",
    "$env:APPDATA\ondeon-smart",
    "$env:TEMP\ondeon-smart"
)

foreach ($folder in $foldersToDelete) {
    if (Test-Path $folder) {
        try {
            Remove-Item -Path $folder -Recurse -Force -ErrorAction Stop
            Write-Host "  ✅ Eliminado: $folder" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  No se pudo eliminar: $folder" -ForegroundColor Yellow
            Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# 4. Limpiar registro
Write-Host ""
Write-Host "4️⃣ Limpiando registro de Windows..." -ForegroundColor Yellow

$regPaths = @(
    "HKCU:\Software\Ondeon Smart",
    "HKCU:\Software\ondeon-smart",
    "HKLM:\SOFTWARE\Ondeon Smart",
    "HKLM:\SOFTWARE\ondeon-smart"
)

foreach ($regPath in $regPaths) {
    if (Test-Path $regPath) {
        try {
            Remove-Item -Path $regPath -Recurse -Force -ErrorAction Stop
            Write-Host "  ✅ Limpiado: $regPath" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  No se pudo limpiar: $regPath" -ForegroundColor Yellow
        }
    }
}

# 5. Limpiar auto-inicio
Write-Host ""
Write-Host "5️⃣ Limpiando auto-inicio..." -ForegroundColor Yellow

$startupPaths = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Ondeon Smart.lnk",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
)

# Limpiar accesos directos de startup
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Reproductor*.lnk" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Ondeon*.lnk" -Force -ErrorAction SilentlyContinue

# Limpiar registro de auto-inicio
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runValues = @("Ondeon Smart", "ondeon-smart")
foreach ($value in $runValues) {
    if (Get-ItemProperty -Path $runKey -Name $value -ErrorAction SilentlyContinue) {
        Remove-ItemProperty -Path $runKey -Name $value -Force
        Write-Host "  ✅ Eliminado auto-inicio: $value" -ForegroundColor Green
    }
}

# 6. Resumen final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ LIMPIEZA COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Instalar la nueva versión (v0.0.7)" -ForegroundColor White
Write-Host "2. La app se configurará automáticamente" -ForegroundColor White
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
