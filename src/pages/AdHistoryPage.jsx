import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Music, Radio, Megaphone, Loader2, History, Play, Pause, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

// Iconos según el tipo de evento
const eventIcons = {
  'song_changed': Music,
  'channel_changed': Radio,
  'scheduled_content_started': Megaphone,
  'scheduled_content_ended': Megaphone,
  'manual_content_started': Megaphone,
  'manual_content_ended': Megaphone,
  'playback_state_changed': Music
};

// Etiquetas amigables para tipos de evento
const eventLabels = {
  'song_changed': 'Canción',
  'channel_changed': 'Cambio de Canal',
  'scheduled_content_started': 'Contenido Programado Iniciado',
  'scheduled_content_ended': 'Contenido Programado Finalizado',
  'manual_content_started': 'Contenido Manual Iniciado',
  'manual_content_ended': 'Contenido Manual Finalizado',
  'playback_state_changed': 'Estado de Reproducción'
};

// Colores según el tipo de evento
const eventColors = {
  'song_changed': 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  'channel_changed': 'bg-purple-500/15 text-purple-700 border-purple-500/30',
  'scheduled_content_started': 'bg-green-500/15 text-green-700 border-green-500/30',
  'scheduled_content_ended': 'bg-green-500/15 text-green-700 border-green-500/30',
  'manual_content_started': 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  'manual_content_ended': 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  'playback_state_changed': 'bg-cyan-500/15 text-cyan-700 border-cyan-500/30'
};

// Helper para obtener info del estado de reproducción
const getPlaybackStateInfo = (state) => {
  const stateMap = {
    'playing': { icon: Play, text: '▶️ Reproduciendo', color: 'text-green-600' },
    'paused': { icon: Pause, text: '⏸️ Pausado', color: 'text-yellow-600' },
    'stopped': { icon: Square, text: '⏹️ Detenido', color: 'text-red-600' }
  };
  return stateMap[state] || { icon: Music, text: state || 'Desconocido', color: 'text-gray-600' };
};

const AdHistoryPage = () => {
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 🔧 10 registros por página
  const [isUserActive, setIsUserActive] = useState(true);
  const { user } = useAuth();

  // 🔧 OPTIMIZACIÓN: Detectar actividad del usuario
  useEffect(() => {
    let activityTimer;
    
    const resetActivityTimer = () => {
      setIsUserActive(true);
      clearTimeout(activityTimer);
      
      // Si no hay actividad en 2 minutos, pausar refreshes
      activityTimer = setTimeout(() => {
        setIsUserActive(false);
        logger.dev('⏸️ Usuario inactivo - pausando auto-refresh del historial');
      }, 120000); // 2 minutos
    };
    
    // Eventos que indican actividad
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetActivityTimer, { passive: true });
    });
    
    resetActivityTimer(); // Iniciar timer
    
    return () => {
      clearTimeout(activityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetActivityTimer);
      });
    };
  }, []);

  // Cargar historial desde Supabase
  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const usuarioId = user?.id || user?.usuario_id || user?.user_id;

        // 🔧 OPTIMIZACIÓN: Solo columnas necesarias + límite 50 eventos
        const { data, error } = await supabase
          .from('user_activity_events')
          .select('id, event_type, content_title, content_artist, canal_name, created_at, event_data')
          .eq('usuario_id', usuarioId)
          .order('created_at', { ascending: false })
          .limit(50); // 🚀 Reducido de 100 a 50 (50% menos tráfico)

        if (error) {
          logger.error('❌ Error cargando historial:', error);
          return;
        }

        logger.dev('✅ Historial cargado:', data?.length || 0, 'eventos');
        setEvents(data || []);

      } catch (error) {
        logger.error('❌ Error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();

    // 🔧 OPTIMIZACIÓN: Auto-refresh más espaciado (60s) y solo si usuario activo
    const interval = setInterval(() => {
      if (isUserActive) {
        logger.dev('🔄 Auto-refresh historial (usuario activo)');
        loadHistory();
      } else {
        logger.dev('⏸️ Auto-refresh pausado (usuario inactivo)');
      }
    }, 60000); // 🚀 Aumentado de 30s a 60s

    return () => clearInterval(interval);
  }, [user, isUserActive]);

  // Filtrar eventos por búsqueda
  const filteredEvents = events.filter(event => 
    event.content_title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    event.content_artist?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.canal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eventLabels[event.event_type]?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔧 PAGINACIÓN: Calcular eventos a mostrar en la página actual
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEvents = filteredEvents.slice(indexOfFirstItem, indexOfLastItem);

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Funciones de paginación
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Formatear fecha - Siempre mostrar fecha/hora real
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    
    return date.toLocaleString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const tableRowVariants = {
    initial: { opacity: 0, y: 10, filter: 'blur(3px)' },
    animate: (i) => ({ 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)',
      transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' } 
    })
    // 🔧 Hover manejado por CSS (hover:bg-primary/5) - framer-motion no puede animar variables CSS
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-4xl sm:text-5xl font-sans font-bold text-black dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-primary/90 dark:via-[#A2D9F7]/80 dark:to-accent/90 mb-10 text-center">
        Historial de reproducción
      </h1>

      <Card useCleanStyle={true} className="animate-clean-pulse" style={{animationDuration: '7.5s'}}>
        <CardHeader>
          <CardTitle useCleanStyle={true} className="text-xl sm:text-2xl text-secondary flex flex-col sm:flex-row justify-between items-center font-sans">
            <div className="relative w-full sm:max-w-md">
              <Input 
                type="search" 
                useCleanStyle={true}
                placeholder="Buscar por título, artista o canal..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/70" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-16">
              <Loader2 size={48} className="mx-auto text-primary/50 mb-4 animate-spin" />
              <p className="text-xl text-muted-foreground font-sans">Cargando historial...</p>
            </div>
          ) : filteredEvents.length > 0 ? (
            <>
              <div className="overflow-x-auto">
              <Table useCleanStyle={true}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground/80 w-[120px]">Tipo</TableHead>
                    <TableHead className="text-foreground/80">Título</TableHead>
                    <TableHead className="text-foreground/80">Artista / Info</TableHead>
                    <TableHead className="text-foreground/80">Canal</TableHead>
                    <TableHead className="text-foreground/80 text-right w-[140px]">Fecha/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentEvents.map((event, i) => {
                    // Obtener icono según el tipo de evento
                    let Icon = eventIcons[event.event_type] || Music;
                    
                    // Si es cambio de estado, usar icono específico del estado
                    if (event.event_type === 'playback_state_changed' && event.event_data?.state) {
                      Icon = getPlaybackStateInfo(event.event_data.state).icon;
                    }
                    
                    return (
                      <motion.tr
                        key={event.id}
                        custom={i}
                        variants={tableRowVariants}
                        initial="initial"
                        animate="animate"
                        className="border-b border-border/60 hover:bg-primary/5 transition-colors duration-150"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon size={16} className="text-primary" />
                            <span className={`px-2 py-0.5 text-[10px] sm:text-xs rounded-md border font-sans ${eventColors[event.event_type] || eventColors['song_changed']}`}>
                              {eventLabels[event.event_type] || event.event_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground font-sans">
                          {event.event_type === 'playback_state_changed' 
                            ? (() => {
                                const stateInfo = getPlaybackStateInfo(event.event_data?.state);
                                return (
                                  <span className={`font-semibold ${stateInfo.color}`}>
                                    {stateInfo.text}
                                  </span>
                                );
                              })()
                            : event.content_title || 'Sin título'
                          }
                        </TableCell>
                        <TableCell className="text-muted-foreground font-sans">
                          {event.event_type === 'channel_changed' 
                            ? event.event_data?.from_channel 
                              ? `De: ${event.event_data.from_channel}`
                              : '-'
                            : event.event_type === 'playback_state_changed'
                            ? event.event_data?.previous_state
                              ? `Estado anterior: ${getPlaybackStateInfo(event.event_data.previous_state).text}`
                              : '-'
                            : event.content_artist || '-'
                          }
                        </TableCell>
                        <TableCell className="text-muted-foreground font-sans">
                          {event.event_type === 'playback_state_changed'
                            ? event.event_data?.channel_name || event.canal_name || '-'
                            : event.canal_name || '-'
                          }
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground font-sans text-sm">
                          {formatDate(event.created_at)}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
                <TableCaption useCleanStyle={true} className="text-muted-foreground/80">
                  Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredEvents.length)} de {filteredEvents.length} eventos
                </TableCaption>
              </Table>
              </div>

              {/* Controles de Paginación */}
              {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <motion.button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg font-sans text-sm transition-all duration-200
                    ${currentPage === 1 
                      ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' 
                      : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                >
                  ← Anterior
                </motion.button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Mostrar máximo 5 páginas
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <motion.button
                        key={pageNumber}
                        onClick={() => goToPage(pageNumber)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={`w-10 h-10 rounded-lg font-sans text-sm font-medium transition-all duration-200
                          ${currentPage === pageNumber 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                      >
                        {pageNumber}
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg font-sans text-sm transition-all duration-200
                    ${currentPage === totalPages 
                      ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' 
                      : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                >
                  Siguiente →
                </motion.button>
              </div>
            )}
          </>
          ) : (
            <div className="text-center py-10">
              <History size={48} className="mx-auto text-primary/50 mb-4 animate-pulse" style={{animationDuration: '4s'}}/>
              <p className="text-xl sm:text-2xl text-muted-foreground font-sans">
                {searchTerm ? 'No hay eventos que coincidan con tu búsqueda' : 'No hay eventos en el historial aún'}
              </p>
              <p className="text-muted-foreground/70 text-xs sm:text-sm mt-1 font-sans">
                {searchTerm 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Los eventos aparecerán aquí cuando reproduzcas canciones o contenidos'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdHistoryPage;
