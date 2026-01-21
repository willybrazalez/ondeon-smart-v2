# Guía de Integración: Sistema de Subida de Archivos a S3

## 📋 Resumen

Este documento explica cómo integrar el sistema de subida de archivos a S3 mediante AWS Lambda en tu proyecto.

---

## 🎯 Prerequisitos

Antes de comenzar, necesitas:

1. **URL de la función Lambda** (ej: `https://xxxxxx.lambda-url.eu-north-1.on.aws/`)
2. **Nombre del bucket S3** (ej: `musicaondeon`)
3. **Región de AWS** (ej: `eu-north-1`)
4. **Dominio agregado a CORS** en Lambda y S3

---

## 🔄 Flujo de Subida (2 Pasos)



### Paso 1: Obtener URL Prefirmada

```typescript
const response = await fetch('https://tu-lambda-url.on.aws/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'ruta/archivo.mp3',
    fileType: 'audio/mpeg'
  })
});

const { signedUrl } = await response.json();
```

### Paso 2: Subir el Archivo

```typescript
await fetch(signedUrl, {
  method: 'PUT',
  body: archivo,
  headers: { 'Content-Type': 'audio/mpeg' }
});

// URL pública del archivo
const publicUrl = `https://BUCKET.s3.REGION.amazonaws.com/ruta/archivo.mp3`;
```

---

## 💻 Implementación en el Código

### 1. Crear Función Helper

Crea un archivo `src/utils/s3Upload.ts`:

```typescript
const LAMBDA_URL = 'https://tu-lambda-url.on.aws/';
const BUCKET = 'tu-bucket';
const REGION = 'tu-region';

export async function uploadToS3(
  file: File | Blob,
  s3Key: string,
  fileType?: string
): Promise<string> {
  // 1. Obtener URL prefirmada
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: s3Key,
      fileType: fileType || file.type || 'application/octet-stream'
    })
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo URL: ${response.status}`);
  }

  const { signedUrl } = await response.json();

  // 2. Subir archivo
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': fileType || file.type }
  });

  if (!uploadResponse.ok) {
    throw new Error(`Error subiendo archivo: ${uploadResponse.status}`);
  }

  // 3. Retornar URL pública
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
}
```

### 2. Usar en Componentes

```typescript
import { uploadToS3 } from '@/utils/s3Upload';

const handleUpload = async (file: File) => {
  try {
    // Generar nombre único
    const timestamp = Date.now();
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `uploads/${timestamp}_${sanitized}`;
    
    // Subir
    const url = await uploadToS3(file, s3Key);
    
    console.log('✅ Archivo subido:', url);
    
    // Guardar en BD o usar URL
    await saveToDatabase({ url, name: file.name });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};
```

---

## 📁 Patrones de Organización

### Estructura Recomendada en S3


await fetch(signedUrl, {
  method: 'PUT',
  body: archivo,
  headers: { 'Content-Type': 'audio/mpeg' }
});

// URL pública del archivo
const publicUrl = `https://BUCKET.s3.REGION.amazonaws.com/ruta/archivo.mp3`;036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();
  
  return `${category}/${timestamp}_${sanitized}`;
}

// Uso
const s3Key = generateS3Key(file, 'contenidos/audio');
```

---

## 🔧 Operaciones Adicionales

### Eliminar Archivo

```typescript
export async function deleteFromS3(s3Key: string): Promise<void> {
  const response = await fetch(LAMBDA_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: s3Key })
  });

  if (!response.ok) {
    throw new Error(`Error eliminando archivo: ${response.status}`);
  }
}
```

### Obtener URL de Descarga

```typescript
export async function getDownloadUrl(
  s3Key: string,
  downloadName?: string
): Promise<string> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: s3Key,
      operation: 'get',
      downloadName
    })
  });

  const { signedUrl } = await response.json();
  return signedUrl;
}
```

---

## 🎨 Ejemplo Completo con UI

```typescript
import { useState } from 'react';
import { uploadToS3 } from '@/utils/s3Upload';

export function FileUploader() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setProgress(0);

      // Validar archivo
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Archivo muy grande (máx 5MB)');
      }

      // Generar ruta S3
      const s3Key = `uploads/${Date.now()}_${file.name}`;

      // Subir
      const url = await uploadToS3(file, s3Key, file.type);

      setProgress(100);
      console.log('✅ Subido:', url);

    } catch (error) {
      console.error('❌ Error:', error);
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <div>Subiendo... {progress}%</div>}
    </div>
  );
}
```

---

## 📝 Validaciones Recomendadas

```typescript
function validateFile(file: File): { valid: boolean; error?: string } {
  // Tamaño máximo
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'Archivo muy grande (máx 5MB)' };
  }

  // Tipos permitidos
  const allowed = ['audio/mpeg', 'audio/wav', 'image/jpeg', 'image/png'];
  if (!allowed.includes(file.type)) {
    return { valid: false, error: 'Tipo de archivo no permitido' };
  }

  return { valid: true };
}
```

---

## ⚠️ Manejo de Errores

```typescript
async function uploadWithRetry(
  file: File,
  s3Key: string,
  maxRetries: number = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadToS3(file, s3Key);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      console.log(`Reintento ${i + 1}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}
```

---

## 🔍 Debugging

### Ver Logs en Consola

```typescript
console.log('🔄 Iniciando subida:', {
  fileName: file.name,
  size: file.size,
  type: file.type
});

console.log('✅ Subida completada:', publicUrl);

console.error('❌ Error:', error.message);
```

### Verificar Configuración

```bash
# Ver CORS del bucket
aws s3api get-bucket-cors --bucket tu-bucket --region tu-region

# Probar Lambda manualmente
curl -X POST https://tu-lambda-url/ \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.txt","fileType":"text/plain"}'
```

---

## 🚨 Problemas Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `CORS Error` | Dominio no permitido | Agregar a `allowedOrigins` en Lambda |
| `403 Forbidden` | Permisos insuficientes | Verificar política IAM de Lambda |
| `SignatureDoesNotMatch` | URL expirada | Reducir tiempo entre pasos 1 y 2 |
| `EntityTooLarge` | Archivo muy grande | Validar tamaño antes de subir |

---

## 📚 Referencias Rápidas

### Configuración Lambda

```javascript
// allowedOrigins en Lambda (index.mjs)
const allowedOrigins = [
  'https://tu-dominio.com',
  'http://localhost:5173'
];
```

### CORS en S3

```json
{
  "CORSRules": [{
    "AllowedOrigins": ["https://tu-dominio.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}
```

---

## ✅ Checklist de Integración

- [ ] Obtener URL de Lambda del administrador
- [ ] Verificar que tu dominio esté en `allowedOrigins`
- [ ] Crear función helper `uploadToS3()`
- [ ] Implementar validación de archivos
- [ ] Agregar manejo de errores
- [ ] Probar subida desde tu aplicación
- [ ] Verificar URL pública sea accesible
- [ ] Implementar logging para debugging

---

**Última actualización:** Noviembre 2025  
**Basado en:** Sistema ONDEON con AWS Lambda + S3


1. Crear Función Helper

const LAMBDA_URL = 'https://tu-lambda-url.on.aws/';
const BUCKET = 'tu-bucket';
const REGION = 'tu-region';

export async function uploadToS3(
  file: File | Blob,
  s3Key: string,
  fileType?: string
): Promise<string> {
  // 1. Obtener URL prefirmada
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: s3Key,
      fileType: fileType || file.type || 'application/octet-stream'
    })
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo URL: ${response.status}`);
  }

  const { signedUrl } = await response.json();

  // 2. Subir archivo
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': fileType || file.type }
  });

  if (!uploadResponse.ok) {
    throw new Error(`Error subiendo archivo: ${uploadResponse.status}`);
  }

  // 3. Retornar URL pública
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
}


2. USAR EN COMPONENTES

import { uploadToS3 } from '@/utils/s3Upload';

const handleUpload = async (file: File) => {
  try {
    // Generar nombre único
    const timestamp = Date.now();
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `uploads/${timestamp}_${sanitized}`;
    
    // Subir
    const url = await uploadToS3(file, s3Key);
    
    console.log('✅ Archivo subido:', url);
    
    // Guardar en BD o usar URL
    await saveToDatabase({ url, name: file.name });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};