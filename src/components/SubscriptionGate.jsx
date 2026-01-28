import React from 'react';
import { Lock, ExternalLink, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * SubscriptionGate - Componente de bloqueo para contenido premium
 * 
 * Muestra un mensaje cuando el usuario no tiene acceso a contenidos.
 * Indica que debe gestionar su suscripción desde ondeon.es
 */
export default function SubscriptionGate() {
  const { isTrialActive, daysLeftInTrial, planTipo } = useAuth();

  const handleGoToWeb = () => {
    // Abrir ondeon.es en nueva pestaña
    window.open('https://ondeon.es', '_blank');
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 space-y-6 text-center bg-white/5 border-white/10 backdrop-blur-xl">
        {/* Icono */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-[#A2D9F7]/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-[#A2D9F7]" />
          </div>
        </div>

        {/* Título */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            Contenido Premium
          </h2>
          {isTrialActive ? (
            <p className="text-white/60">
              Tu periodo de prueba ha terminado
            </p>
          ) : (
            <p className="text-white/60">
              Esta función requiere una suscripción activa
            </p>
          )}
        </div>

        {/* Mensaje */}
        <div className="space-y-3 text-white/70 text-sm">
          {isTrialActive && daysLeftInTrial === 0 && (
            <div className="flex items-center justify-center gap-2 text-amber-400">
              <Clock className="w-4 h-4" />
              <span>Tu trial de 7 días ha finalizado</span>
            </div>
          )}
          
          <p>
            Para acceder a <strong className="text-white">Contenidos Programados</strong> y 
            todas las funcionalidades premium, necesitas una suscripción activa.
          </p>
          
          <p>
            Gestiona tu suscripción desde nuestro sitio web:
          </p>
        </div>

        {/* Botón */}
        <Button
          onClick={handleGoToWeb}
          className="w-full bg-[#A2D9F7] hover:bg-[#A2D9F7]/90 text-black font-medium"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Ir a ondeon.es
        </Button>

        {/* Info adicional */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-white/50">
            {planTipo === 'free' && 'Plan actual: Gratuito'}
            {planTipo === 'basico' && 'Plan actual: Básico'}
            {planTipo === 'trial' && 'Plan actual: Trial finalizado'}
          </p>
        </div>
      </Card>
    </div>
  );
}
