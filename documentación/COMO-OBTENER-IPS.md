# 🚀 Guía Rápida - Cómo Obtener las IPs

Esta guía te explica cómo obtener las direcciones IP necesarias para configurar tu firewall o reglas de red.

---

## 📋 Método Rápido (Recomendado)

### En macOS/Linux:

```bash
# Desde la raíz del proyecto, ejecuta:
./scripts/obtener-ips.sh
```

### En Windows (PowerShell):

```powershell
# Desde la raíz del proyecto, ejecuta:
.\scripts\obtener-ips.ps1
```

Estos scripts te mostrarán:
- ✅ La IP actual de tu proyecto Supabase
- ✅ Todos los rangos de IP de Amazon S3 en eu-north-1
- ✅ Generarán un archivo con toda la información

---

## 📖 Documentación Completa

Para información detallada, consulta:

```
LISTADO-IPS-SERVICIOS.md
```

Este documento incluye:
- 📍 Cómo funcionan los servicios
- 🔍 Métodos manuales para obtener IPs
- 🔥 Ejemplos de configuración de firewall
- 🔄 Scripts de actualización automática
- ⚠️ Consideraciones importantes

---

## ⚡ Resumen Ejecutivo

### Supabase
- **IP**: Dinámica (obtén con el script)
- **Puerto**: 443 (HTTPS), 5432 (PostgreSQL opcional)
- **Nota**: La IP puede cambiar si se pausa/reanuda el proyecto

### Amazon S3
- **Región**: eu-north-1 (Estocolmo)
- **IPs**: ~50-100 rangos (obtén con el script)
- **Puerto**: 443 (HTTPS)
- **Nota**: Los rangos cambian frecuentemente (actualizar mensualmente)

---

## 🛠️ Requisitos

### Para el script de Linux/macOS:
- `curl` (preinstalado)
- `jq` (opcional pero recomendado)
  ```bash
  # Instalar jq:
  brew install jq  # macOS
  sudo apt-get install jq  # Linux
  ```

### Para el script de Windows:
- PowerShell 5.0 o superior (preinstalado en Windows 10+)
- Permisos de ejecución de scripts
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

## 🔥 Configuración Rápida de Firewall

### Después de obtener las IPs:

**macOS/Linux (ufw):**
```bash
# Supabase
sudo ufw allow from <IP_SUPABASE> to any port 443

# S3 (para cada rango obtenido)
sudo ufw allow from <RANGO_IP_S3> to any port 443
```

**Windows (Firewall):**
```powershell
# Ejecutar como Administrador
New-NetFirewallRule -DisplayName "Ondeon - Supabase" -Direction Outbound -RemoteAddress <IP_SUPABASE> -Action Allow -Protocol TCP -RemotePort 443

New-NetFirewallRule -DisplayName "Ondeon - S3" -Direction Outbound -RemoteAddress <RANGO_IP_S3> -Action Allow -Protocol TCP -RemotePort 443
```

---

## ⚠️ Importante

1. **Actualización**: Las IPs cambian frecuentemente. Actualiza mensualmente.
2. **Alternativa**: Si es posible, usa reglas basadas en dominio en lugar de IP:
   - `*.supabase.co`
   - `*.amazonaws.com`
3. **Soporte**: Si tienes dudas, contacta a development@ondeon.es

---

## 🎯 Siguientes Pasos

1. ✅ Ejecuta el script apropiado para tu sistema operativo
2. ✅ Revisa el archivo generado (`ips-servicios-XXXXXX.txt`)
3. ✅ Configura tu firewall con las IPs obtenidas
4. ✅ Programa recordatorio mensual para actualizar las IPs
5. ✅ Prueba que la aplicación funcione correctamente

---

**¿Necesitas ayuda?**
- 📧 Email: development@ondeon.es
- 📞 Teléfono: +34 692 59 45 25



