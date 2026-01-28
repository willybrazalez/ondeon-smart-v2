import React, { useState } from 'react';
import { Clock, Crown, ExternalLink, Lock, Sparkles } from 'lucide-react';
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
  const { isTrialActive, daysLeftInTrial, planTipo, shouldShowTrialBanner } = useAuth();
  const [showMobilePrompt, setShowMobilePrompt] = useState(false);
  
  // Detectar si estamos en plataforma nativa
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

  if (!shouldShowTrialBanner) return null;

  const handleUpgrade = () => {
    if (isNative) {
      // En iOS/Android: mostrar mensaje educativo
      setShowMobilePrompt(true);
    } else {
      // En web: redirigir a ondeon.es
      window.open('https://ondeon.es', '_blank');
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

  // 🖥️ Diseño para web/desktop
  return (
    <>
      <div className="w-full bg-gradient-to-r from-[#A2D9F7]/10 via-[#7BC4E0]/10 to-[#A2D9F7]/10 border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Info del trial */}
          <div className="flex items-center gap-3">
            {isTrialActive ? (
              <>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#A2D9F7]" />
                  <span className="text-sm text-white/90 font-medium">
                    {daysLeftInTrial === 1 
                      ? 'Último día de prueba' 
                      : `${daysLeftInTrial} días de prueba`}
                  </span>
                </div>
                {daysLeftInTrial <= 3 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                    ¡Quedan pocos días!
                  </span>
                )}
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-white/60" />
                <span className="text-sm text-white/70">
                  Acceso limitado
                </span>
              </>
            )}
          </div>

          {/* Botón Upgrade */}
          <Button
            onClick={handleUpgrade}
            size="sm"
            className="h-8 px-4 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-xs rounded-full hover:shadow-lg hover:shadow-[#A2D9F7]/30 transition-all"
          >
            <Crown className="w-3.5 h-3.5 mr-1.5" />
            Ver planes
            <ExternalLink className="w-3 h-3 ml-1.5" />
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
