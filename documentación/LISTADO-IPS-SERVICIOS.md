# 🌐 Listado de IPs - Servicios de Ondeon Smart

Este documento contiene información sobre cómo obtener las direcciones IP necesarias para configurar firewalls o reglas de red.

---

## 📊 Servicios Utilizados

La aplicación se conecta a dos servicios principales:

1. **Supabase** - Base de datos y autenticación
2. **Amazon S3** - Almacenamiento de archivos de audio

---

## 🔵 1. SUPABASE

### Características
- **Tipo**: Servicio cloud de base de datos PostgreSQL
- **Función**: Autenticación, consultas de BD, tiempo real
- **IPs**: Dinámicas (cambian según proyecto y región)

### 🔍 Cómo Obtener la IP de tu Proyecto

#### Método 1: Via Terminal (Recomendado)
```bash
# Reemplaza <PROJECT_REF> con tu ID de proyecto
nslookup db.<PROJECT_REF>.supabase.co
```

**Ejemplo:**
```bash
# Si tu URL es: https://abcdefghijklmnop.supabase.co
# Entonces ejecuta:
nslookup db.abcdefghijklmnop.supabase.co
```

Esto te devolverá algo como:
```
Server:		8.8.8.8
Address:	8.8.8.8#53

Non-authoritative answer:
Name:	db.abcdefghijklmnop.supabase.co
Address: 123.45.67.89
```

#### Método 2: Via Navegador
1. Ve a tu panel de Supabase: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a Settings → Database
4. Busca la sección "Connection Info"
5. Anota el host y resuelve su IP con `nslookup`

### ⚠️ IMPORTANTE - Supabase

- **IPv6**: Por defecto, cada proyecto tiene una IPv6 estática
- **IPv4**: Requiere complemento de pago "IPv4 add-on"
- Las IPs pueden cambiar si:
  - El proyecto se pausa y se reanuda
  - Se realiza una actualización de la base de datos
  - Hay cambios en la infraestructura

### 🔧 Complemento IPv4 (Opcional)

Si necesitas una IP estática IPv4:
1. Ve a tu proyecto en Supabase
2. Settings → Add-ons
3. Activa "Static IPv4 Address"
4. Se asignará una IP dedicada a tu base de datos

---

## 🟠 2. AMAZON S3 (Región EU-NORTH-1)

### Características
- **Región**: eu-north-1 (Estocolmo, Suecia)
- **Bucket**: musicaondeon.s3.eu-north-1.amazonaws.com
- **Función**: Almacenamiento y streaming de archivos de audio
- **IPs**: Rangos amplios que cambian periódicamente

### 🔍 Cómo Obtener los Rangos de IP

#### Método 1: Obtener TODOS los rangos de S3
```bash
curl https://ip-ranges.amazonaws.com/ip-ranges.json | jq -r '.prefixes[] | select(.service=="S3") | .ip_prefix'
```

#### Método 2: Filtrar SOLO región eu-north-1 (RECOMENDADO)
```bash
curl https://ip-ranges.amazonaws.com/ip-ranges.json | jq -r '.prefixes[] | select(.region=="eu-north-1") | select(.service=="S3") | .ip_prefix'
```

#### Método 3: Sin jq (usando Python)
Si no tienes `jq` instalado:

```bash
curl https://ip-ranges.amazonaws.com/ip-ranges.json -o aws-ip-ranges.json
python3 -c "
import json
with open('aws-ip-ranges.json') as f:
    data = json.load(f)
    for prefix in data['prefixes']:
        if prefix.get('service') == 'S3' and prefix.get('region') == 'eu-north-1':
            print(prefix['ip_prefix'])
"
```

#### Método 4: Descargar y revisar manualmente
```bash
# Descargar el archivo
curl https://ip-ranges.amazonaws.com/ip-ranges.json -o aws-ip-ranges.json

# Abrirlo y buscar manualmente
# Busca: "service": "S3" y "region": "eu-north-1"
```

### 📋 Ejemplo de Rangos de S3 eu-north-1

Los rangos típicos incluyen (actualizado periódicamente):
```
13.48.4.0/24
13.48.32.0/19
13.49.42.0/24
13.51.0.0/16
16.12.16.0/21
16.16.0.0/15
...
(y muchos más)
```

⚠️ **IMPORTANTE**: Estos rangos cambian frecuentemente. Usa el comando anterior para obtener la lista actualizada.

---

## 🛠️ Instalación de Herramientas

### Instalar jq (para filtrar JSON)

**macOS:**
```bash
brew install jq
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install jq
```

**Windows:**
- Descarga desde: https://stedolan.github.io/jq/download/
- O usa WSL (Windows Subsystem for Linux)

---

## 🔥 Configuración de Firewall

### Ejemplo: Permitir Supabase
```bash
# Reemplaza <SUPABASE_IP> con la IP obtenida
sudo ufw allow from <SUPABASE_IP>/32 to any port 443
sudo ufw allow from <SUPABASE_IP>/32 to any port 5432
```

### Ejemplo: Permitir Rangos de S3
```bash
# Para cada rango obtenido del comando anterior
sudo ufw allow from 13.48.4.0/24 to any port 443
sudo ufw allow from 13.48.32.0/19 to any port 443
# ... etc
```

### Ejemplo: Script Automático para S3
```bash
#!/bin/bash
# Script para agregar automáticamente rangos de S3 al firewall

# Obtener rangos de IP de S3 en eu-north-1
curl -s https://ip-ranges.amazonaws.com/ip-ranges.json | \
jq -r '.prefixes[] | select(.region=="eu-north-1") | select(.service=="S3") | .ip_prefix' | \
while read -r ip_range; do
    echo "Permitiendo: $ip_range"
    sudo ufw allow from $ip_range to any port 443
done

echo "✅ Reglas de firewall actualizadas"
```

---

## 📝 Información del Proyecto Actual

### Supabase
- **URL Variable de Entorno**: `VITE_SUPABASE_URL`
- **Ubicación**: Definida en `.env` o variables de entorno
- **Formato**: `https://<PROJECT_REF>.supabase.co`

Para ver tu PROJECT_REF:
```bash
# Busca en tu archivo .env
grep VITE_SUPABASE_URL .env
```

### Amazon S3
- **Bucket**: musicaondeon
- **Región**: eu-north-1 (Estocolmo)
- **URL Base**: https://musicaondeon.s3.eu-north-1.amazonaws.com/

---

## ⚠️ Consideraciones Importantes

### 1. **IPs Dinámicas**
- Tanto Supabase como AWS usan IPs dinámicas
- Debes actualizar las reglas periódicamente (recomendado: mensualmente)

### 2. **Rangos Amplios de AWS**
- AWS S3 usa cientos de rangos de IP
- Considera usar nombres de dominio en lugar de IPs si es posible

### 3. **Alternativa Recomendada: DNS/Dominio**
En lugar de IPs, considera permitir por dominio:
- `*.supabase.co`
- `*.amazonaws.com`
- `*.s3.eu-north-1.amazonaws.com`

### 4. **CloudFront (Opcional)**
Si AWS usa CloudFront para CDN, también necesitarás:
```bash
curl https://ip-ranges.amazonaws.com/ip-ranges.json | jq -r '.prefixes[] | select(.service=="CLOUDFRONT") | .ip_prefix'
```

---

## 🔄 Actualización Automática

### Script de Actualización Periódica (Cron)

Crea un script para actualizar las IPs automáticamente:

```bash
#!/bin/bash
# update-aws-ips.sh

# Limpiar reglas antiguas de S3 (ajusta según tu firewall)
# ... código para limpiar reglas antiguas ...

# Obtener y aplicar nuevas reglas
curl -s https://ip-ranges.amazonaws.com/ip-ranges.json | \
jq -r '.prefixes[] | select(.region=="eu-north-1") | select(.service=="S3") | .ip_prefix' | \
while read -r ip_range; do
    sudo ufw allow from $ip_range to any port 443
done

echo "$(date): IPs actualizadas" >> /var/log/firewall-update.log
```

Configura cron para ejecutar mensualmente:
```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar el primer día de cada mes a las 3am)
0 3 1 * * /path/to/update-aws-ips.sh
```

---

## 📞 Soporte

Si necesitas ayuda adicional:
- **Email**: development@ondeon.es
- **Teléfono**: +34 692 59 45 25

---

## 📚 Referencias

- AWS IP Ranges: https://ip-ranges.amazonaws.com/ip-ranges.json
- Documentación AWS S3 IPs: https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html
- Documentación Supabase: https://supabase.com/docs/guides/platform/ipv4-address
- jq Manual: https://stedolan.github.io/jq/manual/

---

**Última actualización**: 29 de Octubre de 2025



