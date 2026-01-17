import React, { useEffect, useRef } from 'react';

const DynamicBackground = ({ isPlaying, theme }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const rippleArrayRef = useRef([]);

  class Ripple {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 0;
      this.opacity = 0.5;
      this.maxRadius = Math.max(window.innerWidth, window.innerHeight) * 1.5; // Aumentado para cubrir toda la pantalla
      this.speed = 2; // Velocidad base de expansión
      this.expandingSpeed = 2; // Velocidad adicional cuando está reproduciendo
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      
      // Aumentar opacidad y grosor en modo oscuro
      if (theme === 'dark') {
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 1.5})`; // 50% más de opacidad en modo oscuro
        ctx.lineWidth = 3; // Línea más gruesa en modo oscuro
      } else {
        ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity})`;
        ctx.lineWidth = 2;
      }
      
      ctx.stroke();
    }

    update(isPlaying) {
      const currentSpeed = isPlaying ? this.speed + this.expandingSpeed : this.speed;
      this.radius += currentSpeed;
      
      // Ajuste de opacidad diferente para modo oscuro y claro
      if (theme === 'dark') {
        this.opacity = Math.max(0, 0.7 * (1 - this.radius / this.maxRadius)); // Mayor opacidad inicial en modo oscuro
      } else {
        this.opacity = Math.max(0, 0.5 * (1 - this.radius / this.maxRadius));
      }
      
      return this.radius <= this.maxRadius;
    }
  }

  const createRipple = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ripple = new Ripple(
      canvas.width / 2,
      canvas.height / 2
    );
    rippleArrayRef.current.push(ripple);
  };

  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Efecto de fondo con gradiente
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );

    if (theme === 'dark') {
      gradient.addColorStop(0, 'rgba(25, 25, 25, 0.9)'); // Más contraste en el centro
      gradient.addColorStop(1, 'rgba(5, 5, 5, 0.95)'); // Más oscuro en los bordes
    } else {
      gradient.addColorStop(0, 'rgba(242, 242, 242, 0.8)'); // Tono más suave (~95% lightness)
      gradient.addColorStop(1, 'rgba(230, 230, 230, 0.9)'); // Tono más suave (~90% lightness)
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Actualizar y dibujar ondas
    rippleArrayRef.current = rippleArrayRef.current.filter(ripple => {
      ripple.draw(ctx);
      return ripple.update(isPlaying);
    });

    // Crear nueva onda si está reproduciendo
    if (isPlaying && rippleArrayRef.current.length < 5) {
      if (Math.random() < 0.03) { // Ajustado para crear ondas más frecuentemente
        createRipple();
      }
    }

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Iniciar animación
    animate();

    // Crear onda inicial
    createRipple();

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Efecto para manejar cambios en isPlaying
  useEffect(() => {
    if (isPlaying) {
      createRipple();
    }
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10"
      style={{ 
        background: theme === 'dark' ? '#111111' : '#f0f0f0', // Tono más suave (~94% lightness) en modo claro
        transition: 'background-color 0.3s ease'
      }}
    />
  );
};

export default DynamicBackground;