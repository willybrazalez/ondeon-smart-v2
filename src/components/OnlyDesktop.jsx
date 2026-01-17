import React from 'react';

const isMobile = () => {
  const ua = navigator.userAgent;
  const isPhone = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Tablet|PlayBook|Silk|Kindle|Nexus 7|Nexus 10|SM-T|GT-P|SCH-I800|xoom|tab/i.test(ua);
  const isSmallScreen = window.innerWidth < 800;
  return isPhone && !isTablet && isSmallScreen;
};

const OnlyDesktop = ({ children }) => {
  if (isMobile()) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #A2D9F7 0%, #f8fafc 100%)',
        color: '#1a202c',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <img 
          src="/assets/icono-ondeon.png" 
          alt="ONDEON Logo" 
          style={{ width: 90, marginBottom: 24 }}
          onError={(e) => {
            console.error('Error al cargar el logo en OnlyDesktop');
            e.target.style.display = 'none';
          }}
        />
        <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem', color: '#0a2540', letterSpacing: '0.01em' }}>
          Acceso solo desde ordenador
        </h2>
        <p style={{ fontSize: '1.1rem', maxWidth: 340, margin: '0 auto', color: '#222', marginBottom: 0 }}>
          La plataforma <span style={{ color: '#1e90ff', fontWeight: 600 }}>ONDEON</span> solo está disponible para navegadores de escritorio.<br />
          Por favor, accede desde tu ordenador para disfrutar de la mejor experiencia.
        </p>
      </div>
    );
  }
  return children;
};

export default OnlyDesktop; 