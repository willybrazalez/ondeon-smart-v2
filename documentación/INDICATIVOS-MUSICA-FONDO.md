# Música de Fondo para Indicativos Automáticos

## Estructura en S3

Los archivos de música de fondo deben subirse a:

```
s3://musicaondeon/indicativos/musica/
├── fondo-1.mp3    (música suave, corporativa)
├── fondo-2.mp3    (música alegre, dinámica)  
└── fondo-3.mp3    (música elegante, lounge)
```

## Especificaciones de los Archivos

| Característica | Valor Requerido |
|----------------|-----------------|
| **Formato** | MP3 |
| **Bitrate** | 192 kbps mínimo |
| **Duración** | 10-20 segundos (se hará loop automático) |
| **Volumen** | Normalizado (-14 LUFS recomendado) |
| **Licencia** | Royalty-free / Uso comercial permitido |

## Recomendaciones de Estilo

### fondo-1.mp3 - Corporativo
- Estilo: Música ambiental suave
- Instrumentos: Piano, cuerdas suaves
- Tempo: Lento (60-80 BPM)
- Ideal para: Establecimientos formales, oficinas

### fondo-2.mp3 - Dinámico
- Estilo: Pop/electrónico suave
- Instrumentos: Sintetizadores, percusión ligera
- Tempo: Medio (100-120 BPM)
- Ideal para: Tiendas, cafeterías modernas

### fondo-3.mp3 - Elegante
- Estilo: Lounge/Jazz suave
- Instrumentos: Piano, saxofón, bajo
- Tempo: Medio-lento (80-100 BPM)
- Ideal para: Restaurantes, hoteles, spas

## Fuentes de Música Royalty-Free

1. **Pixabay Music** (gratis)
   - https://pixabay.com/music/
   
2. **Free Music Archive** (gratis)
   - https://freemusicarchive.org/
   
3. **Epidemic Sound** (suscripción)
   - https://www.epidemicsound.com/
   
4. **Artlist** (suscripción)
   - https://artlist.io/

## Cómo Subir a S3

### Opción 1: AWS Console

1. Ir a https://s3.console.aws.amazon.com/
2. Navegar a bucket `musicaondeon`
3. Crear carpeta `indicativos/musica/` si no existe
4. Subir los 3 archivos MP3
5. Configurar permisos como "Public read"

### Opción 2: AWS CLI

```bash
# Subir los archivos
aws s3 cp fondo-1.mp3 s3://musicaondeon/indicativos/musica/fondo-1.mp3 --acl public-read
aws s3 cp fondo-2.mp3 s3://musicaondeon/indicativos/musica/fondo-2.mp3 --acl public-read
aws s3 cp fondo-3.mp3 s3://musicaondeon/indicativos/musica/fondo-3.mp3 --acl public-read

# Verificar
aws s3 ls s3://musicaondeon/indicativos/musica/
```

### Opción 3: Usar Lambda existente

```javascript
// Usando la función de subida existente
const response = await fetch(ONDEON_LAMBDA_S3_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'indicativos/musica/fondo-1.mp3',
    fileType: 'audio/mpeg'
  })
});

const { signedUrl } = await response.json();

// Subir el archivo
await fetch(signedUrl, {
  method: 'PUT',
  body: audioFile,
  headers: { 'Content-Type': 'audio/mpeg' }
});
```

## URLs Resultantes

Una vez subidos, las URLs serán:

| Archivo | URL CloudFront |
|---------|----------------|
| fondo-1.mp3 | `https://d2ozw1d1zbl64l.cloudfront.net/indicativos/musica/fondo-1.mp3` |
| fondo-2.mp3 | `https://d2ozw1d1zbl64l.cloudfront.net/indicativos/musica/fondo-2.mp3` |
| fondo-3.mp3 | `https://d2ozw1d1zbl64l.cloudfront.net/indicativos/musica/fondo-3.mp3` |

## Uso en n8n

En el workflow de n8n, se seleccionará aleatoriamente uno de estos fondos:

```javascript
// Selección aleatoria en n8n
const fondos = [
  'indicativos/musica/fondo-1.mp3',
  'indicativos/musica/fondo-2.mp3',
  'indicativos/musica/fondo-3.mp3'
];
const backgroundMusicKey = fondos[Math.floor(Math.random() * fondos.length)];
```

## Checklist

- [ ] Descargar/crear 3 pistas de música royalty-free
- [ ] Verificar que cumplan las especificaciones
- [ ] Subir a S3 en la ruta correcta
- [ ] Verificar que las URLs de CloudFront funcionan
- [ ] Probar la mezcla con la Lambda FFmpeg
