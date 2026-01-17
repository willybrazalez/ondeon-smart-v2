import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Bot, LifeBuoy, Languages, Sparkles, ShieldQuestion } from 'lucide-react';

const faqData = [
  { q: "¿Cómo selecciono un canal de música?", a: "Visita la sección 'Canales' en el menú inferior. Elige tu canal preferido y la música comenzará a reproducirse automáticamente." },
  { q: "¿Puedo pausar o controlar el volumen de la música?", a: "Sí, en la sección 'Reproductor' encontrarás controles completos para reproducir, pausar y ajustar el volumen de la música." },
  { q: "¿Dónde puedo ver los contenidos disponibles?", a: "En la sección 'Contenidos' del menú inferior podrás explorar todos los canales, playlists y contenidos musicales disponibles." },
  { q: "¿Qué puedo ver en la sección de Historial?", a: "El 'Historial' te muestra un registro de todos los canales que has reproducido recientemente, permitiéndote acceder fácilmente a tus favoritos." },
  { q: "¿Cómo cambio entre modo claro y oscuro?", a: "Puedes alternar entre los temas claro y oscuro usando el botón de cambio de tema ubicado en la parte superior derecha de la aplicación." },
  { q: "¿Cómo contacto con el equipo de soporte?", a: "Puedes contactarnos directamente por email o teléfono. Encuentra nuestros datos de contacto en esta misma página." },
];


const SupportPage = () => {
  const cardItemVariant = {
    initial: { opacity: 0, y: 20, filter: 'blur(2px)' },
    animate: (i) => ({ 
        opacity: 1, y: 0, filter: 'blur(0px)',
        transition: { delay: i * 0.12, duration: 0.55, ease: [0.25, 0.8, 0.25, 1] }
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: "circOut" }}
      className="p-4 sm:p-6 md:p-8"
    >
      <motion.h1 
        className="text-4xl sm:text-5xl font-sans font-bold text-black dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-primary/90 dark:via-[#A2D9F7]/80 dark:to-accent/90 mb-10 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        Soporte y Ayuda
      </motion.h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <div className="lg:col-span-2 space-y-7">
          <motion.div custom={0} variants={cardItemVariant} initial="initial" animate="animate">
            <Card useCleanStyle={true} className="border-border/70 bg-card/95 backdrop-blur">
              <CardHeader>
                <CardTitle useCleanStyle={true} className="text-xl sm:text-2xl flex items-center text-gray-800 dark:text-white font-sans">
                  <ShieldQuestion className="mr-2 text-gray-700 dark:text-white/90" />
                  Preguntas Frecuentes (FAQ)
                </CardTitle>
                <CardDescription useCleanStyle={true} className="text-muted-foreground font-sans">Encuentra respuestas rápidas a las dudas más comunes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {faqData.map((item, index) => (
                  <details key={index} className="clean-details group">
                    <summary className="font-sans text-gray-700 dark:text-gray-200">{item.q}</summary>
                    <p className="text-muted-foreground mt-1.5 text-sm font-sans">{item.a}</p>
                  </details>
                ))}
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div custom={1} variants={cardItemVariant} initial="initial" animate="animate">
            <Card useCleanStyle={true} className="border-border/70 bg-card/95 backdrop-blur">
              <CardHeader>
                <CardTitle useCleanStyle={true} className="text-xl sm:text-2xl flex items-center text-gray-800 dark:text-white font-sans">
                  <Bot className="mr-2 text-gray-700 dark:text-white/90" />
                  Asistente Virtual IA
                </CardTitle>
                <CardDescription useCleanStyle={true} className="text-muted-foreground font-sans">
                  Estamos preparando algo especial para ti.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full p-6 mb-6">
                  <Sparkles className="h-16 w-16 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3 font-sans">Próximamente</h3>
                <p className="text-muted-foreground text-center font-sans max-w-sm">
                  Estamos trabajando en nuestro Asistente Virtual con IA para ofrecerte la mejor experiencia de soporte.
                </p>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground flex items-center justify-center pt-3">
                  <Languages size={12} className="mr-1 text-primary/80"/> Disponible en múltiples idiomas próximamente.
              </CardFooter>
            </Card>
          </motion.div>
        </div>

        <motion.div className="lg:col-span-1" custom={2} variants={cardItemVariant} initial="initial" animate="animate">
          <Card useCleanStyle={true} className="border-border/70 bg-card/95 backdrop-blur">
            <CardHeader>
              <CardTitle useCleanStyle={true} className="text-xl sm:text-2xl flex items-center text-gray-800 dark:text-white font-sans">
                <LifeBuoy className="mr-2 text-gray-700 dark:text-white/90" />
                Contacto
              </CardTitle>
              <CardDescription useCleanStyle={true} className="text-muted-foreground font-sans">Estamos aquí para ayudarte. Contáctanos directamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 py-6">
              <div className="flex flex-col items-center space-y-2 p-4 rounded-lg bg-gradient-to-br from-primary/15 to-secondary/15 dark:from-primary/10 dark:to-secondary/10 border border-primary/30 dark:border-primary/20">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/25 dark:bg-primary/20 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary dark:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-muted-foreground font-sans">Email</p>
                <a 
                  href="mailto:development@ondeon.es" 
                  className="text-base font-semibold text-primary hover:text-primary/80 transition-colors font-sans break-all text-center px-2"
                >
                  development@ondeon.es
                </a>
              </div>
              
              <div className="flex flex-col items-center space-y-2 p-4 rounded-lg bg-gradient-to-br from-primary/15 to-secondary/15 dark:from-primary/10 dark:to-secondary/10 border border-primary/30 dark:border-primary/20">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/25 dark:bg-primary/20 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary dark:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-muted-foreground font-sans">Teléfono</p>
                <a 
                  href="tel:+34692594525" 
                  className="text-base font-semibold text-primary hover:text-primary/80 transition-colors font-sans"
                >
                  +34 692 59 45 25
                </a>
              </div>
            </CardContent>
            <CardFooter className="text-xs text-gray-600 dark:text-muted-foreground text-center pt-2">
              Horario de atención: Lunes a Viernes, 9:00 - 18:00
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SupportPage;