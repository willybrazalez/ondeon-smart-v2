import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Radio, Music, Waves, Aperture, Zap, CheckCircle, Leaf, Coffee, Loader2, AlertCircle, Play, Star } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

// ============================================================================
// ONDEON SMART v2 - CHANNELS PAGE
// ============================================================================
// Muestra todos los canales disponibles con indicador de recomendados por sector.
// Los canales se obtienen via rpc_get_all_canales.
// ============================================================================

// Gradientes temáticos por tipo de canal (estilo Spotify)
const channelGradients = {
  musica: 'from-purple-500 via-pink-500 to-red-500',
  musical: 'from-blue-500 via-purple-500 to-pink-500',
  fiesta: 'from-yellow-400 via-orange-500 to-red-500',
  relax: 'from-cyan-400 via-blue-400 to-indigo-500',
  rock: 'from-gray-700 via-gray-800 to-black',
  ambient: 'from-green-400 via-teal-500 to-blue-500',
  actualidad: 'from-orange-400 via-amber-500 to-yellow-500',
  pop: 'from-pink-400 via-purple-400 to-indigo-500',
  jazz: 'from-amber-600 via-orange-700 to-red-800',
  electronic: 'from-cyan-500 via-blue-600 to-purple-700',
  default: 'from-slate-600 via-slate-700 to-slate-800',
};

const channelIcons = { 
  musica: Music,
  musical: Music,
  fiesta: Zap,
  relax: Waves,
  rock: Aperture,
  default: Radio,
  ambient: Leaf, 
  actualidad: Coffee,
  pop: Music,
  jazz: Music,
  electronic: Zap,
};

const ChannelsPage = ({ setCurrentChannel, currentChannel, isPlaying, togglePlayPause }) => {
  const [selectedVisualChannel, setSelectedVisualChannel] = useState(null);
  const [isChangingChannel, setIsChangingChannel] = useState(false);
  const { toast } = useToast();
  
  const { 
    user,
    userData,
    userChannels, 
    recommendedChannels,
    channelsLoading, 
    loadAllChannels,
    isManualPlaybackActive, 
    manualPlaybackInfo 
  } = useAuth();

  // Cargar canales al montar si no están cargados
  useEffect(() => {
    if (!channelsLoading && userChannels.length === 0 && user) {
      logger.dev('🔄 Cargando canales iniciales...');
      loadAllChannels();
    }
  }, [user, channelsLoading, userChannels.length, loadAllChannels]);

  // Sincronizar canal seleccionado con el reproductor
  useEffect(() => {
    if (!channelsLoading && userChannels.length > 0) {
      if (currentChannel?.id) {
        setSelectedVisualChannel(currentChannel.id);
      } else if (!selectedVisualChannel) {
        setSelectedVisualChannel(userChannels[0].id);
      }
    }
  }, [channelsLoading, userChannels, currentChannel, selectedVisualChannel]);

  // Ordenar canales: recomendados primero
  const sortedChannels = React.useMemo(() => {
    if (!userChannels.length) return [];
    
    // Separar recomendados y no recomendados
    const recommended = userChannels.filter(c => c.recomendado);
    const others = userChannels.filter(c => !c.recomendado);
    
    // Recomendados primero, luego el resto
    return [...recommended, ...others];
  }, [userChannels]);

  const handleChannelChange = async (channel) => {
    // Bloqueo si hay reproducción manual activa
    if (isManualPlaybackActive) {
      const contentName = manualPlaybackInfo?.contentName || 'un contenido';
      toast({
        title: "Reproducción manual en curso",
        description: `No se puede cambiar de canal mientras se reproduce ${contentName}. Espera a que termine.`,
        variant: "destructive",
        className: "bg-orange-500 text-white dark:bg-orange-600 dark:text-white border-none shadow-lg",
      });
      return;
    }
    
    if (isChangingChannel) return;

    try {
      setIsChangingChannel(true);
      setSelectedVisualChannel(channel.id);
      
      // Formatear canal para el reproductor
      const channelFormatted = {
        id: channel.id,
        name: channel.nombre,
        description: channel.descripcion,
        songTitle: channel.nombre,
        artist: "Radio Online",
        imagen_url: channel.imagen_url
      };
      
      setCurrentChannel(channelFormatted);
    
      toast({
        title: "Sintonizando Canal",
        description: `Conectando con ${channel.nombre}...`,
        className: "bg-blue-500 text-white dark:bg-blue-200 dark:text-blue-900 border-none shadow-lg",
      });

      // Iniciar reproducción cuando el canal esté listo
      if (!isPlaying) {
        const handleReady = () => {
          try { 
            togglePlayPause(); 
          } catch (e) {
            logger.warn('⚠️ Error iniciando play:', e);
          }
          window.removeEventListener('audio-ready', handleReady);
        };
        window.addEventListener('audio-ready', handleReady, { once: true });
      }
      
      setTimeout(() => {
        toast({
          title: "¡Canal Cambiado!",
          description: `Ahora reproduciendo: ${channel.nombre}`,
          className: "bg-green-500 text-white dark:bg-green-600 dark:text-white border-none shadow-lg",
        });
      }, 1000);

    } catch (error) {
      logger.error('❌ Error cambiando canal:', error);
      toast({
        title: "Error",
        description: `Error al cambiar a ${channel.nombre}`,
        variant: "destructive",
      });
    } finally {
      setIsChangingChannel(false);
    }
  };

  const cardVariants = {
    initial: { opacity: 0, y: 25, filter: 'blur(5px)' },
    animate: (i) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        delay: i * 0.08,
        duration: 0.4,
        ease: [0.25, 0.8, 0.25, 1], 
      },
    }),
    hover: {
      scale: 1.05,
      y: -8,
      transition: { 
        type: 'spring', 
        stiffness: 400, 
        damping: 15 
      }
    }
  };

  // Loading state
  if (channelsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando canales...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (sortedChannels.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No hay canales disponibles</h2>
          <p className="text-muted-foreground">Pronto habrá nuevos canales disponibles.</p>
        </div>
      </div>
    );
  }

  // Contar recomendados para mostrar sección separada
  const hasRecommended = sortedChannels.some(c => c.recomendado);

  return (
    <motion.div 
      className="w-full max-w-[3000px] 2xl:max-w-[3000px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <motion.h1 
          className="text-4xl sm:text-5xl font-sans font-bold text-black dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-primary/90 dark:via-[#A2D9F7]/80 dark:to-accent/90"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Canales Disponibles
        </motion.h1>
        <motion.p 
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {userData?.establecimiento 
            ? `Canales de música para ${userData.establecimiento}`
            : 'Descubre la perfecta banda sonora para cada momento.'
          }
        </motion.p>
      </div>

      {/* Sección de Recomendados (si hay) */}
      {hasRecommended && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <h2 className="text-xl font-semibold">Recomendados para ti</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Canales seleccionados especialmente para tu sector
          </p>
        </div>
      )}

      {/* Grid de canales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-3 gap-6 sm:gap-7 xl:gap-8">
        {sortedChannels.map((channel, index) => {
          const isSelected = selectedVisualChannel === channel.id;
          const channelType = channel.nombre?.toLowerCase().includes('tiki') ? 'musica' : 
                             channel.nombre?.toLowerCase().includes('años') ? 'pop' : 
                             channel.nombre?.toLowerCase().includes('ambient') ? 'ambient' :
                             channel.nombre?.toLowerCase().includes('willcott') ? 'electronic' : 'default';
          const gradient = channelGradients[channelType] || channelGradients.default;
          const IconComponent = channelIcons[channelType] || channelIcons.default;
          
          return (
            <motion.div
              key={channel.id}
              custom={index}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              whileHover={isManualPlaybackActive ? {} : "hover"}
              className={`group transform-gpu will-change-transform ${isManualPlaybackActive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              onClick={() => handleChannelChange(channel)}
            >
              <div className="relative">
                {/* Imagen/Gradiente de fondo */}
                <div 
                  className={`
                    aspect-square rounded-lg overflow-hidden
                    shadow-lg group-hover:shadow-2xl
                    transition-all duration-300
                    relative transform-gpu will-change-transform ring-1 ring-black/20
                    ${!channel.imagen_url ? `bg-gradient-to-br ${gradient}` : 'bg-black'}
                  `}
                >
                  {channel.imagen_url ? (
                    <img 
                      src={channel.imagen_url} 
                      alt={channel.nombre}
                      className="absolute inset-0 w-full h-full object-cover block pointer-events-none"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                      <IconComponent size={120} className="text-white" />
                    </div>
                  )}
                  
                  {/* Badge de recomendado */}
                  {channel.recomendado && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-3 left-3 z-10"
                    >
                      <div className="bg-yellow-500 rounded-full p-1.5 shadow-lg">
                        <Star size={14} className="text-white fill-white" />
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Badge de seleccionado */}
                  {isSelected && !isManualPlaybackActive && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-3 right-3 z-10"
                    >
                      <div className="bg-[#A2D9F7] rounded-full p-1.5 shadow-lg">
                        <CheckCircle size={16} className="text-gray-900" />
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Badge de bloqueo */}
                  {isManualPlaybackActive && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-3 right-3 z-10"
                    >
                      <div className="bg-orange-500 rounded-full p-1.5 shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </div>
                    </motion.div>
                  )}

                  {/* Botón Play al hacer hover */}
                  <motion.div
                    className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    initial={{ scale: 0.8 }}
                    whileHover={{ scale: 1.1 }}
                  >
                    <div className="bg-[#A2D9F7] hover:bg-[#8CC9E7] rounded-full p-3 shadow-xl transition-colors">
                      {isChangingChannel && isSelected ? (
                        <Loader2 size={20} className="text-gray-900 animate-spin" />
                      ) : (
                        <Play size={20} className="text-gray-900 fill-gray-900" />
                      )}
                    </div>
                  </motion.div>

                  {/* Overlay oscuro */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 group-hover:from-black/60 group-hover:to-black/90 transition-all" />

                  {/* Descripción al hacer hover */}
                  <div className="absolute inset-0 flex items-center justify-center p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-center text-white/95 text-sm leading-relaxed">
                      {channel.descripcion || 'Canal musical personalizado'}
                    </p>
                  </div>
                </div>

                {/* Información debajo de la tarjeta */}
                <div className="mt-3">
                  <h3 className="font-semibold text-base text-foreground text-center whitespace-normal break-words group-hover:text-primary transition-colors min-h-[2.2rem]">
                    {channel.nombre}
                  </h3>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ChannelsPage;
