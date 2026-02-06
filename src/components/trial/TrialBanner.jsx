import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Crown, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import UpgradePromptMobile from '@/components/mobile/UpgradePromptMobile';

/**
 * TrialBanner - Indicador discreto de días restantes del trial
 * 
 * Se muestra en todas las páginas cuando:
 * - El usuario está en trial (muestra días restantes)
 * - El usuario es free (invita a suscribirse)
 */
export default function TrialBanner() {
  const navigate = useNavigate();
  const { isTrialActive, daysLeftInTrial, shouldShowTrialBanner } = useAuth();
  const [showMobilePrompt, setShowMobilePrompt] = useState(false);
  
  // Detectar si estamos en plataforma nativa
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

  if (!shouldShowTrialBanner) return null;

  const handleUpgrade = () => {
    if (isNative) {
      // En iOS/Android: mostrar mensaje educativo
      setShowMobilePrompt(true);
    } else {
      // En web: abrir modal de planes en gestor
      navigate('/gestor?modal=planes');
    }
  };

  // 🎨 Diseño compacto para móvil nativo
  if (isNative) {
    return (
      <>
        <div className="mx-4 mt-2 rounded-2xl bg-gradient-to-r from-[#1a2030] to-[#1a2535] border border-white/10 shadow-lg overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            {/* Info del trial */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#A2D9F7]/15 flex items-center justify-center">
                {isTrialActive ? (
                  <Clock className="w-4 h-4 text-[#A2D9F7]" />
                ) : (
                  <Lock className="w-4 h-4 text-white/50" />
                )}
              </div>
              <div className="min-w-0">
                {isTrialActive ? (
                  <p className="text-sm font-medium text-white truncate">
                    {daysLeftInTrial === 1 
                      ? 'Último día de prueba' 
                      : `${daysLeftInTrial} días de prueba`}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-white/70 truncate">
                    Acceso limitado
                  </p>
                )}
              </div>
            </div>

            {/* Botón Upgrade */}
            <Button
              onClick={handleUpgrade}
              size="sm"
              className="flex-shrink-0 h-9 px-4 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-sm rounded-xl shadow-lg shadow-[#A2D9F7]/20 active:scale-95 transition-transform"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Ver planes
            </Button>
          </div>
        </div>

        {/* Prompt para móvil */}
        <UpgradePromptMobile 
          isOpen={showMobilePrompt}
          onClose={() => setShowMobilePrompt(false)}
        />
      </>
    );
  }

  // 🖥️ Diseño inline para web/desktop - se integra en el header
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a2030]/80 border border-white/10">
        {/* Info del trial */}
        <div className="flex items-center gap-1.5">
          {isTrialActive ? (
            <Clock className="w-3.5 h-3.5 text-[#A2D9F7]" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-white/50" />
          )}
          <span className="text-xs text-white/80 font-medium whitespace-nowrap">
            {isTrialActive 
              ? (daysLeftInTrial === 1 ? 'Último día' : `${daysLeftInTrial} días de prueba`)
              : 'Acceso limitado'}
          </span>
        </div>

        {/* Botón Upgrade */}
        <Button
          onClick={handleUpgrade}
          size="sm"
          className="h-7 px-2.5 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-[11px] rounded-lg hover:shadow-lg hover:shadow-[#A2D9F7]/30 transition-all"
        >
          <Crown className="w-3 h-3 mr-1" />
          Ver planes
        </Button>
      </div>

      {/* Prompt para móvil */}
      <UpgradePromptMobile 
        isOpen={showMobilePrompt}
        onClose={() => setShowMobilePrompt(false)}
      />
    </>
  );
}
