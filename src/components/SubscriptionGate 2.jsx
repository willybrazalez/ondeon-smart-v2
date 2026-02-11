import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Clock, Globe, Crown, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import UpgradePromptMobile from '@/components/mobile/UpgradePromptMobile';

/**
 * SubscriptionGate - Componente de bloqueo para contenido premium
 * 
 * Muestra un mensaje cuando el usuario no tiene acceso a contenidos.
 * Detecta la plataforma (web vs iOS/Android) y muestra el CTA apropiado.
 * 
 * Casos:
 * - Usuario sin suscripción/trial expirado → "Ver planes"
 * - Usuario con plan Básico → "Actualizar a Pro"
 * - Usuario con plan Pro → No debería ver este componente
 */
export default function SubscriptionGate() {
  const navigate = useNavigate();
  const { isTrialActive, daysLeftInTrial, planTipo } = useAuth();
  const [showMobilePrompt, setShowMobilePrompt] = useState(false);
  
  // Detectar si estamos en plataforma nativa
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

  // Determinar el escenario
  const isTrialExpired = planTipo === 'trial' && !isTrialActive;
  const isBasicoUser = planTipo === 'basico';
  const needsUpgradeToPro = isBasicoUser; // Usuario básico intentando acceder a contenidos pro

  const handleUpgrade = async () => {
    if (isNative) {
      // En iOS/Android: mostrar mensaje educativo
      setShowMobilePrompt(true);
    } else {
      // En web: abrir modal de planes en gestor
      navigate('/gestor?modal=planes');
    }
  };

  // Determinar título y mensaje según el caso
  const getTitle = () => {
    if (needsUpgradeToPro) return 'Función Pro';
    return 'Contenido Premium';
  };

  const getSubtitle = () => {
    if (needsUpgradeToPro) {
      return 'Esta función requiere el plan Pro';
    }
    if (isTrialExpired) {
      return 'Tu periodo de prueba ha terminado';
    }
    if (planTipo === 'free') {
      return 'Esta función requiere una suscripción';
    }
    return 'Esta función requiere una suscripción activa';
  };

  const getMessage = () => {
    if (needsUpgradeToPro) {
      return (
        <>
          <p>
            Tu plan <strong className="text-white">Ondeón Básico</strong> incluye 
            acceso a canales de música y anuncios.
          </p>
          <p>
            Para acceder a <strong className="text-white">Contenidos Programados</strong> y 
            locuciones de marca, actualiza a <strong className="text-[#A2D9F7]">Ondeón Pro</strong>.
          </p>
        </>
      );
    }
    return (
      <>
        <p>
          Para acceder a <strong className="text-white">Contenidos Programados</strong> y 
          todas las funcionalidades premium, necesitas una suscripción activa.
        </p>
        <p>
          Gestiona tu suscripción desde nuestro sitio web:
        </p>
      </>
    );
  };

  const getButtonText = () => {
    if (isNative) {
      return needsUpgradeToPro ? 'Ver cómo actualizar' : 'Ver cómo suscribirme';
    }
    return needsUpgradeToPro ? 'Actualizar a Pro' : 'Ver planes';
  };

  const getPlanLabel = () => {
    if (planTipo === 'free') return 'Plan actual: Sin suscripción';
    if (planTipo === 'basico') return 'Plan actual: Ondeón Básico';
    if (planTipo === 'trial' && isTrialActive) return `Plan actual: Trial (${daysLeftInTrial} días restantes)`;
    if (planTipo === 'trial' && !isTrialActive) return 'Plan actual: Trial expirado';
    if (planTipo === 'pro') return 'Plan actual: Ondeón Pro';
    return '';
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 space-y-6 text-center bg-white/5 border-white/10 backdrop-blur-xl">
        {/* Icono */}
        <div className="flex justify-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
            needsUpgradeToPro ? 'bg-purple-500/10' : 'bg-[#A2D9F7]/10'
          }`}>
            {needsUpgradeToPro ? (
              <ArrowUpCircle className="w-10 h-10 text-purple-400" />
            ) : (
              <Lock className="w-10 h-10 text-[#A2D9F7]" />
            )}
          </div>
        </div>

        {/* Título */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            {getTitle()}
          </h2>
          <p className="text-white/60">
            {getSubtitle()}
          </p>
        </div>

        {/* Mensaje */}
        <div className="space-y-3 text-white/70 text-sm">
          {isTrialExpired && (
            <div className="flex items-center justify-center gap-2 text-amber-400">
              <Clock className="w-4 h-4" />
              <span>Tu trial de 7 días ha finalizado</span>
            </div>
          )}
          
          {getMessage()}
        </div>

        {/* Botón */}
        <Button
          onClick={handleUpgrade}
          className={`w-full font-medium ${
            needsUpgradeToPro 
              ? 'bg-purple-500 hover:bg-purple-600 text-white' 
              : 'bg-[#A2D9F7] hover:bg-[#A2D9F7]/90 text-black'
          }`}
        >
          {isNative ? (
            <>
              <Globe className="w-4 h-4 mr-2" />
              {getButtonText()}
            </>
          ) : (
            <>
              {needsUpgradeToPro ? (
                <ArrowUpCircle className="w-4 h-4 mr-2" />
              ) : (
                <Crown className="w-4 h-4 mr-2" />
              )}
              {getButtonText()}
            </>
          )}
        </Button>

        {/* Info adicional */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-white/50">
            {getPlanLabel()}
          </p>
        </div>
      </Card>

      {/* Prompt para móvil */}
      <UpgradePromptMobile 
        isOpen={showMobilePrompt}
        onClose={() => setShowMobilePrompt(false)}
      />
    </div>
  );
}
