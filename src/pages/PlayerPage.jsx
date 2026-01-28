import React, { useState, useEffect } from 'react';
import PlayerHeader from '@/components/player/PlayerHeader';
import RippleBackground from '@/components/effects/RippleBackground';
import WaveBackground from '@/components/player/WaveBackground';
import { usePlayer } from '@/contexts/PlayerContext';
import WelcomeModal from '@/components/modals/WelcomeModal';
import TrialExpiredModal from '@/components/modals/TrialExpiredModal';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

const PlayerPage = () => {
  const { isPlaying } = usePlayer();
  const { isTrialActive, planTipo, userData, loading } = useAuth();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  // Verificar si debe mostrar modal de bienvenida
  useEffect(() => {
    const shouldShowWelcome = localStorage.getItem('ondeon_show_welcome_modal');
    if (shouldShowWelcome === 'true') {
      logger.dev('🎉 Mostrando modal de bienvenida');
      setShowWelcomeModal(true);
      // Limpiar flag
      localStorage.removeItem('ondeon_show_welcome_modal');
    }
  }, []);

  // Verificar si debe mostrar modal de trial expirado
  useEffect(() => {
    // 🔑 NO mostrar modal si:
    // - Aún está cargando
    // - No hay userData (datos no cargados)
    // - planTipo no es 'free' (trial activo, básico o pro)
    if (loading || !userData) {
      return;
    }
    
    // Mostrar solo una vez por sesión si el trial expiró
    const shownThisSession = sessionStorage.getItem('ondeon_shown_expired_modal');
    
    // 🔑 SOLO mostrar si:
    // 1. Los datos están cargados (userData existe)
    // 2. No está cargando
    // 3. El planTipo es EXACTAMENTE 'free' (trial expirado, confirmado desde BD)
    // 4. No se ha mostrado esta sesión
    // 5. El trial NO está activo
    if (planTipo === 'free' && !isTrialActive && !shownThisSession) {
      logger.dev('⏰ Trial expirado - mostrando modal (planTipo:', planTipo, ', userData:', !!userData, ')');
      setShowExpiredModal(true);
      sessionStorage.setItem('ondeon_shown_expired_modal', 'true');
    }
  }, [isTrialActive, planTipo, userData, loading]);

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
    logger.dev('✅ Modal de bienvenida cerrado');
  };

  const handleCloseExpired = () => {
    setShowExpiredModal(false);
    logger.dev('✅ Modal de trial expirado cerrado');
  };

  return (
    <>
      {isPlaying && <WaveBackground isPlaying={isPlaying} />}
      <RippleBackground isPlaying={isPlaying} />
      <div className="w-full p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-4xl mx-auto relative">
          <PlayerHeader />
        </div>
      </div>

      {/* Modales */}
      <WelcomeModal isOpen={showWelcomeModal} onClose={handleCloseWelcome} />
      <TrialExpiredModal isOpen={showExpiredModal} onClose={handleCloseExpired} />
    </>
  );
};

export default PlayerPage;
