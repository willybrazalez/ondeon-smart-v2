import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Music, Radio, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * WelcomeModal - Modal de bienvenida tras completar el registro
 * 
 * Se muestra una sola vez después de que el usuario completa su perfil
 * y es redirigido al reproductor.
 */
export default function WelcomeModal({ isOpen, onClose }) {
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
              {/* Icono de bienvenida */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] rounded-full blur-2xl opacity-50" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#A2D9F7]/20 to-[#7BC4E0]/10 flex items-center justify-center border border-[#A2D9F7]/30">
                    <Sparkles className="w-10 h-10 text-[#A2D9F7]" />
                  </div>
                </div>
              </div>

              {/* Título */}
              <h2 className="text-3xl font-bold text-white mb-3">
                ¡Bienvenido a Ondeón Smart!
              </h2>

              {/* Mensaje principal */}
              <p className="text-white/70 text-base mb-6">
                Tienes <span className="font-bold text-[#A2D9F7]">7 días</span> para explorar el reproductor
              </p>

              {/* Lista de características */}
              <div className="space-y-3 mb-8 text-left">
                {/* Incluido en el trial */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Music className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Reproductor completo</p>
                    <p className="text-white/60 text-xs">Música profesional 24/7 con licencia</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Radio className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Selección de canales</p>
                    <p className="text-white/60 text-xs">Cambia entre diferentes estilos musicales</p>
                  </div>
                </div>

                {/* Bloqueado - requiere suscripción */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lock className="w-4 h-4 text-white/40" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/70 font-medium text-sm">Contenidos y anuncios</p>
                    <p className="text-white/50 text-xs">Disponible con suscripción</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={onClose}
                className="w-full h-14 bg-gradient-to-r from-[#A2D9F7] to-[#7BC4E0] text-[#0a0e14] font-semibold text-base rounded-full shadow-lg shadow-[#A2D9F7]/30 hover:shadow-[#A2D9F7]/50 transition-all"
              >
                Empezar a explorar
              </Button>

              {/* Nota final */}
              <p className="text-white/40 text-xs mt-4">
                Explora sin límites durante tu periodo de prueba
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
