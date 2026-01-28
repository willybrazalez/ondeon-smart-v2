import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Lock, Check, Music, Radio, FileText, PlusCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UpgradePromptMobile from '@/components/mobile/UpgradePromptMobile';

/**
 * TrialExpiredModal - Modal que se muestra cuando el trial expira
 * 
 * Se muestra automáticamente cuando el usuario inicia sesión después
 * de que su trial de 7 días haya expirado.
 */
export default function TrialExpiredModal({ isOpen, onClose }) {
  const [showMobilePrompt, setShowMobilePrompt] = useState(false);
  
  // Detectar si estamos en plataforma nativa
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

  const handleUpgrade = () => {
    if (isNative) {
      setShowMobilePrompt(true);
    } else {
      window.open('https://ondeon.es', '_blank');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-lg bg-[#181c24] rounded-3xl shadow-2xl border border-white/10 overflow-hidden"
          >
            {/* Botón cerrar */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>

            {/* Contenido */}
            <div className="p-8 text-center">
              {/* Icono */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-2xl" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center border border-amber-500/30">
                    <Clock className="w-10 h-10 text-amber-400" />
                  </div>
                </div>
              </div>

              {/* Título */}
              <h2 className="text-2xl font-bold text-white mb-2">
                Tu periodo de prueba ha finalizado
              </h2>

              <p className="text-white/60 text-sm mb-6">
                Ahora tienes acceso limitado a la plataforma
              </p>

              {/* Lo que PUEDE seguir usando */}
              <div className="space-y-3 mb-4">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider text-left">
                  Puedes seguir usando:
                </p>
                
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-white text-sm font-medium">Reproductor</p>
                    <p className="text-white/50 text-xs">Canal aleatorio</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-white text-sm font-medium">Tu cuenta</p>
                    <p className="text-white/50 text-xs">Gestión y configuración</p>
                  </div>
                </div>
              </div>

              {/* Lo que NECESITA suscripción */}
              <div className="space-y-3 mb-6">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider text-left">
                  Requieren suscripción:
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <Lock className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span className="text-white/60 text-sm">Seleccionar canales</span>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <Lock className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span className="text-white/60 text-sm">Contenidos programados</span>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <Lock className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span className="text-white/60 text-sm">Crear anuncios</span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleUpgrade}
                  className="w-full h-12 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base rounded-full shadow-lg shadow-[#A2D9F7]/30 hover:shadow-[#A2D9F7]/50 transition-all"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  {isNative ? 'Suscribirse' : 'Ver planes'}
                </Button>

                <button
                  onClick={onClose}
                  className="text-sm text-white/50 hover:text-white/70 transition-colors py-2"
                >
                  Continuar con acceso limitado
                </button>
              </div>
            </div>
          </motion.div>

          {/* Prompt para móvil */}
          <UpgradePromptMobile 
            isOpen={showMobilePrompt}
            onClose={() => setShowMobilePrompt(false)}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
