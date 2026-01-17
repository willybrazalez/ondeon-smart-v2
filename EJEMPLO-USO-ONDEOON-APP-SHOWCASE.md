# Ejemplo de uso del componente OndeonAppShowcase

Este componente replica la UI del reproductor Ondeon Smart para mostrar en la landing page de ondeón.es.

## Importación

```jsx
import OndeonAppShowcase from '@/components/OndeonAppShowcase';
```

## Opción 1: Visual (UI mockup) - RECOMENDADO ✅

Esta es la opción recomendada ya que muestra una UI interactiva que replica exactamente el reproductor:

```jsx
<OndeonAppShowcase mode="visual" />
```

**Características:**
- UI completamente funcional e interactiva
- Controles de volumen funcionales
- Botón de play/pause funcional
- Selector de canales funcional
- No requiere login ni conexión externa
- Mejor rendimiento y SEO

## Opción 2: Imagen estática

Muestra una captura de pantalla estática del reproductor:

```jsx
<OndeonAppShowcase 
  mode="image" 
  imageSrc="/images/ondeon-app-screenshot.png" 
/>
```

**Características:**
- Imagen estática simple
- Requiere tener la imagen en la carpeta pública
- Sin interactividad
- Mejor para casos donde no necesitas interactividad

## Opción 3: Iframe (requiere login)

Muestra el reproductor real en un iframe:

```jsx
<OndeonAppShowcase 
  mode="iframe" 
  iframeSrc="https://ondeon.smart.app" 
/>
```

**Características:**
- Muestra el reproductor real
- Requiere que el usuario tenga sesión activa
- Puede tener problemas de CORS
- Menor rendimiento que el modo visual

## Ejemplo completo en una landing page

```jsx
import React from 'react';
import OndeonAppShowcase from '@/components/OndeonAppShowcase';

const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-4">
      <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
        {/* Contenido de texto */}
        <div className="text-white">
          <h1 className="text-5xl font-bold mb-4">
            La mejor radio sin SGAE para{' '}
            <span className="text-[#A2D9F7]">Hostelería</span>
          </h1>
          <p className="text-xl mb-2">100% legales para uso público.</p>
          <p className="text-xl mb-8">
            10 veces más económico. Empieza en 5 minutos.
          </p>
          <button className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            PROBAR GRATIS
          </button>
        </div>

        {/* Showcase del reproductor */}
        <div className="flex justify-center">
          <OndeonAppShowcase mode="visual" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
```

## Personalización

El componente acepta las siguientes props:

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `mode` | `'visual' \| 'image' \| 'iframe'` | `'visual'` | Modo de visualización |
| `imageSrc` | `string` | `'/images/ondeon-app-screenshot.png'` | URL de la imagen (solo para mode='image') |
| `iframeSrc` | `string` | `'https://ondeon.smart.app'` | URL del iframe (solo para mode='iframe') |

## Notas

- El modo `visual` es el recomendado porque ofrece la mejor experiencia de usuario sin requerir autenticación
- El componente está diseñado para ser responsive y se adapta a diferentes tamaños de pantalla
- Los colores y estilos están basados en el diseño actual del reproductor Ondeon Smart

