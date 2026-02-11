import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * UpgradePromptMobile - Mensaje educativo para iOS/Android
 * 
 * Informa al usuario que las suscripciones se gestionan desde la web,
 * cumpliendo con las restricciones de App Store y Google Play.
 */
export default function UpgradePromptMobile({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopyDomain = () => {
    navigator.clipboard.writeText('ondeon.es');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-md bg-[#181c24] rounded-3xl shadow-2xl border border-white/10 overflow-hidden"
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
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A2D9F7]/20 to-[#7BC4E0]/10 flex items-center justify-center border border-[#A2D9F7]/30">
                  <Globe className="w-8 h-8 text-[#A2D9F7]" />
                </div>
              </div>

              {/* Título */}
              <h2 className="text-2xl font-bold text-white mb-3">
                Suscripción disponible en web
              </h2>

              {/* Mensaje */}
              <p className="text-white/70 text-sm mb-6">
                Para suscribirte a Ondeón Smart, visita nuestro sitio web desde tu navegador
              </p>

              {/* Dominio clickeable */}
              <div className="mb-6">
                <button
                  onClick={handleCopyDomain}
                  className="group w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <span className="text-[#A2D9F7] font-mono font-semibold text-lg">
                    ondeon.es
                  </span>
                  {copied ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Check className="w-4 h-4" />
                      <span className="text-xs font-medium">Copiado</span>
                    </div>
                  ) : (
                    <Copy className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                  )}
                </button>
              </div>

              {/* Nota informativa */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-6">
                <p className="text-white/50 text-xs leading-relaxed">
                  Las apps de iOS y Android no pueden procesar pagos externos.
                  Gestiona tu suscripción desde nuestro sitio web.
                </p>
              </div>

              {/* Botón cerrar */}
              <Button
                onClick={onClose}
                variant="outline"
                className="w-full h-12 border-white/20 text-white hover:bg-white/5"
              >
                Entendido
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
