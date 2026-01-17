import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio,
  ArrowLeft,
  Search,
  RefreshCw,
  Music,
  ListMusic,
  ImageIcon,
  Loader2,
  X,
  Trash2,
  CheckCircle,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';

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

/**
 * Página de Gestión de Canales
 * Administra canales de emisión y distribución
 */
const ChannelsManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [canales, setCanales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showSongsModal, setShowSongsModal] = useState(false);
  const [channelSongs, setChannelSongs] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [playingSongId, setPlayingSongId] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const songsPerPage = 20;

  // Obtener empresas del admin
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);

  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user?.id) return;

      try {
        // 1️⃣ Obtener marcas asignadas al admin
        const { data: asignacionesMarcas, error } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', user.id);

        if (error) throw error;

        const marcasIds = (asignacionesMarcas || []).map(a => a.marca_id).filter(Boolean);
        
        if (marcasIds.length === 0) {
          logger.warn('⚠️ Admin sin marcas asignadas');
          setAdminEmpresaIds([]);
          return;
        }

        // 2️⃣ Obtener empresas de esas marcas
        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select('empresa_id')
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) throw errorMarcaEmpresas;

        const empresaIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        logger.dev(`✅ Admin tiene ${marcasIds.length} marca(s) con ${empresaIds.length} empresa(s)`);
        setAdminEmpresaIds(empresaIds);
      } catch (error) {
        logger.error('Error al obtener marcas y empresas del admin:', error);
      }
    };

    fetchAdminEmpresas();
  }, [user]);

  // Cargar canales de la empresa
  useEffect(() => {
    if (adminEmpresaIds.length === 0) {
      setLoading(false);
      return;
    }

    const loadCanales = async () => {
      setLoading(true);
      try {
        // 1. Obtener grupos de las empresas del admin
        const { data: grupos } = await supabase
          .from('grupos')
          .select('id')
          .in('empresa_id', adminEmpresaIds);

        const grupoIds = grupos?.map(g => g.id) || [];

        // 2. Obtener canales de la empresa
        const { data: empresaCanales } = await supabase
          .from('empresa_canales')
          .select('canal_id')
          .in('empresa_id', adminEmpresaIds);

        // 3. Obtener canales de los grupos de la empresa
        const { data: grupoCanales } = grupoIds.length > 0
          ? await supabase
              .from('grupo_canales')
              .select('canal_id')
              .in('grupo_id', grupoIds)
          : { data: [] };

        // Combinar IDs de canales únicos
        const canalIdsSet = new Set([
          ...(empresaCanales?.map(c => c.canal_id) || []),
          ...(grupoCanales?.map(c => c.canal_id) || [])
        ]);

        const canalIds = Array.from(canalIdsSet);

        if (canalIds.length === 0) {
          setCanales([]);
          setLoading(false);
          return;
        }

        // 4. Obtener información de los canales
        const { data: canalesData, error: canalesError } = await supabase
          .from('canales')
          .select('*')
          .in('id', canalIds);

        if (canalesError) throw canalesError;

        // 5. Para cada canal, contar playlists activas y canciones
        const canalesConStats = await Promise.all(
          canalesData.map(async (canal) => {
            // Contar playlists activas
            const { count: playlistCount } = await supabase
              .from('playlists')
              .select('*', { count: 'exact', head: true })
              .eq('canal_id', canal.id)
              .eq('activa', true);

            // Obtener IDs de playlists para contar canciones
            const { data: playlists } = await supabase
              .from('playlists')
              .select('id')
              .eq('canal_id', canal.id)
              .eq('activa', true);

            const playlistIds = playlists?.map(p => p.id) || [];

            // Contar canciones únicas en las playlists
            let cancionesCount = 0;
            if (playlistIds.length > 0) {
              const { data: playlistCanciones } = await supabase
                .from('playlist_canciones')
                .select('cancion_id')
                .in('playlist_id', playlistIds);

              // Contar canciones únicas
              const cancionIdsSet = new Set(playlistCanciones?.map(pc => pc.cancion_id) || []);
              cancionesCount = cancionIdsSet.size;
            }

            // Determinar tipo de canal basado en nombre
            const channelType = canal.nombre?.toLowerCase().includes('tiki') ? 'musica' : 
                               canal.nombre?.toLowerCase().includes('años') ? 'pop' : 
                               canal.nombre?.toLowerCase().includes('ambient') ? 'ambient' :
                               canal.nombre?.toLowerCase().includes('willcott') ? 'electronic' : 'default';

            return {
              ...canal,
              playlistCount: playlistCount || 0,
              cancionesCount: cancionesCount,
              channelType: channelType
            };
          })
        );

        setCanales(canalesConStats);
      } catch (error) {
        logger.error('Error al cargar canales:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCanales();
  }, [adminEmpresaIds, refreshTrigger]);

  // Cargar canciones del canal seleccionado
  const loadChannelSongs = async (canalId) => {
    setLoadingSongs(true);
    try {
      logger.dev('🎵 Cargando canciones para canal:', canalId);
      
      // 1. Obtener playlists activas del canal
      const { data: playlists, error: playlistsError } = await supabase
        .from('playlists')
        .select('id')
        .eq('canal_id', canalId)
        .eq('activa', true);

      if (playlistsError) {
        logger.error('❌ Error obteniendo playlists:', playlistsError);
        throw playlistsError;
      }

      const playlistIds = playlists?.map(p => p.id) || [];
      logger.dev('📋 Playlists encontradas:', playlistIds.length, playlistIds);

      if (playlistIds.length === 0) {
        logger.warn('⚠️ No hay playlists activas para este canal');
        setChannelSongs([]);
        setLoadingSongs(false);
        return;
      }

      // 2. Obtener canciones de las playlists
      logger.dev('🔍 Buscando canciones en playlists:', playlistIds);
      const { data: playlistCanciones, error: cancionesError } = await supabase
        .from('playlist_canciones')
        .select(`
          cancion_id,
          playlist_id,
          canciones (
            id,
            titulo,
            artista,
            duracion,
            url_s3
          )
        `)
        .in('playlist_id', playlistIds);

      if (cancionesError) {
        logger.error('❌ Error obteniendo canciones:', cancionesError);
        logger.error('❌ Detalles del error:', {
          message: cancionesError.message,
          details: cancionesError.details,
          hint: cancionesError.hint,
          code: cancionesError.code
        });
        throw cancionesError;
      }

      logger.dev('✅ Canciones obtenidas:', playlistCanciones?.length || 0);

      // 3. Eliminar duplicados y preparar lista
      const uniqueSongs = [];
      const seenIds = new Set();

      (playlistCanciones || []).forEach(pc => {
        if (pc.canciones && !seenIds.has(pc.canciones.id)) {
          seenIds.add(pc.canciones.id);
          uniqueSongs.push({
            ...pc.canciones,
            playlist_id: pc.playlist_id
          });
        }
      });

      setChannelSongs(uniqueSongs);
    } catch (error) {
      logger.error('Error cargando canciones del canal:', error);
    } finally {
      setLoadingSongs(false);
    }
  };

  // Abrir modal de canciones
  const handleViewSongs = async (canal) => {
    setSelectedChannel(canal);
    setShowSongsModal(true);
    setSongSearchQuery('');
    setCurrentPage(1);
    setPlayingSongId(null);
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    await loadChannelSongs(canal.id);
  };

  // Play/Pause canción
  const handlePlayPause = (song) => {
    // Si es la misma canción, pausar/reanudar
    if (playingSongId === song.id) {
      if (currentAudio) {
        if (currentAudio.paused) {
          currentAudio.play();
        } else {
          currentAudio.pause();
          setPlayingSongId(null);
        }
      }
      return;
    }

    // Si hay otra canción reproduciéndose, detenerla
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // Reproducir nueva canción
    if (song.url_s3) {
      const cloudFrontUrl = convertToCloudFrontUrl(song.url_s3);
      const audio = new Audio(cloudFrontUrl);
      audio.play();
      audio.onended = () => {
        setPlayingSongId(null);
        setCurrentAudio(null);
      };
      setCurrentAudio(audio);
      setPlayingSongId(song.id);
      logger.dev('🎵 Reproduciendo:', song.titulo);
    }
  };

  // Eliminar canción del canal
  const handleDeleteSong = async (cancionId) => {
    if (!confirm('¿Estás seguro de eliminar esta canción de todas las playlists del canal?')) {
      return;
    }

    try {
      // Obtener playlists del canal
      const { data: playlists } = await supabase
        .from('playlists')
        .select('id')
        .eq('canal_id', selectedChannel.id)
        .eq('activa', true);

      const playlistIds = playlists?.map(p => p.id) || [];

      if (playlistIds.length > 0) {
        // Eliminar canción de todas las playlists
        const { error } = await supabase
          .from('playlist_canciones')
          .delete()
          .eq('cancion_id', cancionId)
          .in('playlist_id', playlistIds);

        if (error) throw error;

        logger.dev('🗑️ Canción eliminada del canal');
        
        // Recargar canciones
        await loadChannelSongs(selectedChannel.id);
        
        // Actualizar conteo en el canal
        setCanales(prevCanales => 
          prevCanales.map(c => 
            c.id === selectedChannel.id 
              ? { ...c, cancionesCount: Math.max(0, c.cancionesCount - 1) }
              : c
          )
        );
      }
    } catch (error) {
      logger.error('Error eliminando canción:', error);
      alert('Error al eliminar la canción: ' + error.message);
    }
  };

  // Filtrar canales
  const filteredCanales = canales.filter(c => {
    const matchesSearch = searchQuery === '' || 
      c.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.descripcion?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Filtrar canciones
  const filteredSongs = channelSongs.filter(song => {
    const matchesSearch = songSearchQuery === '' ||
      song.titulo?.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
      song.artista?.toLowerCase().includes(songSearchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Paginación
  const totalPages = Math.ceil(filteredSongs.length / songsPerPage);
  const startIndex = (currentPage - 1) * songsPerPage;
  const endIndex = startIndex + songsPerPage;
  const paginatedSongs = filteredSongs.slice(startIndex, endIndex);

  // Reiniciar página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [songSearchQuery]);

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/grupos')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gestión de Canales</h1>
              <p className="text-muted-foreground mt-1">
                Administra los canales de emisión y sus contenidos
              </p>
            </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar canales..."
            className="pl-10"
          />
        </div>

        {/* Grid de canales estilo Spotify */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCanales.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Radio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No se encontraron canales' : 'No hay canales disponibles'}
              </p>
            </div>
          ) : (
            filteredCanales.map((canal, index) => {
              const gradient = channelGradients[canal.channelType] || channelGradients.default;
              
              return (
              <motion.div
                key={canal.id}
                  custom={index}
                  variants={cardVariants}
                  initial="initial"
                  animate="animate"
                  whileHover="hover"
                  className="group transform-gpu will-change-transform cursor-pointer"
                >
                  {/* Tarjeta estilo Spotify */}
                  <div className="relative">
                    {/* Imagen/Gradiente de fondo */}
                    <div 
                      className={`
                        aspect-square rounded-lg overflow-hidden
                        shadow-lg group-hover:shadow-2xl
                        transition-all duration-300
                        relative transform-gpu will-change-transform ring-1 ring-black/20
                        ${!canal.imagen_url ? `bg-gradient-to-br ${gradient}` : 'bg-black'}
                      `}
                    >
                      {/* Imagen real */}
                    {canal.imagen_url ? (
                      <img
                        src={canal.imagen_url}
                        alt={canal.nombre}
                          className="absolute inset-0 w-full h-full object-cover block pointer-events-none"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            logger.error('Error cargando imagen:', canal.imagen_url);
                            e.target.style.display = 'none';
                          }}
                      />
                    ) : (
                        /* Icono decorativo */
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                          <Radio size={120} className="text-white" />
                        </div>
                      )}

                      {/* Botón "Ver Canciones" al hacer hover */}
                      <motion.div
                        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        initial={{ scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewSongs(canal);
                        }}
                      >
                        <Button
                          size="sm"
                          className="bg-[#A2D9F7] hover:bg-[#8CC9E7] text-gray-900 shadow-xl gap-2 font-semibold"
                        >
                          <Music size={16} />
                          Ver Canciones
                        </Button>
                      </motion.div>

                      {/* Overlay oscuro para mejorar legibilidad */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 group-hover:from-black/60 group-hover:to-black/90 transition-all" />

                      {/* Descripción al hacer hover */}
                      <div className="absolute inset-0 flex items-center justify-center p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-center text-white/95 text-sm leading-relaxed">
                          {canal.descripcion || 'Canal musical personalizado'}
                        </p>
                      </div>
                    </div>

                    {/* Información debajo de la tarjeta */}
                    <div className="mt-3">
                      <h3 className="font-semibold text-base text-foreground text-center whitespace-normal break-words group-hover:text-primary transition-colors min-h-[2.2rem]">
                        {canal.nombre}
                      </h3>

                    {/* Estadísticas */}
                      <div className="flex items-center justify-center gap-3 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <ListMusic className="w-3 h-3" />
                          <span>{canal.playlistCount} playlists</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Music className="w-3 h-3" />
                          <span>{canal.cancionesCount} canciones</span>
                        </div>
                      </div>
                    </div>
                  </div>
              </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de canciones */}
      <AnimatePresence>
        {showSongsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header del modal */}
              <div className="p-6 border-b border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Music className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Canciones del Canal</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedChannel?.nombre} - {channelSongs.length} canciones
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSongsModal(false)}
                  >
                    <X size={18} />
                  </Button>
                </div>

                {/* Buscador de canciones */}
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={songSearchQuery}
                    onChange={(e) => setSongSearchQuery(e.target.value)}
                    placeholder="Buscar por título o artista..."
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Lista de canciones */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingSongs ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSongs.length === 0 ? (
                  <div className="text-center py-12">
                    <Music className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {songSearchQuery ? 'No se encontraron canciones' : 'No hay canciones en este canal'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedSongs.map((song, index) => {
                        const isPlaying = playingSongId === song.id;
                        return (
                          <motion.div
                            key={`${song.id}-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all group ${
                              isPlaying ? 'bg-purple-500/10 border-purple-500/50' : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isPlaying ? 'bg-purple-500/20' : 'bg-purple-500/10'
                              }`}>
                                <Music className={`w-5 h-5 ${isPlaying ? 'text-purple-600' : 'text-purple-500'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{song.titulo || 'Sin título'}</h4>
                                <p className="text-sm text-muted-foreground truncate">
                                  {song.artista || 'Artista desconocido'}
                                  {song.duracion && ` · ${song.duracion}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`gap-2 ${
                                  isPlaying 
                                    ? 'text-purple-600 hover:text-purple-700 hover:bg-purple-500/10' 
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-500/10 opacity-0 group-hover:opacity-100'
                                } transition-all`}
                                onClick={() => handlePlayPause(song)}
                              >
                                {isPlaying ? (
                                  <>
                                    <Pause size={16} />
                                    Pausar
                                  </>
                                ) : (
                                  <>
                                    <Play size={16} />
                                    Reproducir
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteSong(song.id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          Mostrando {startIndex + 1}-{Math.min(endIndex, filteredSongs.length)} de {filteredSongs.length} canciones
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="gap-1"
                          >
                            <ChevronLeft size={16} />
                            Anterior
                          </Button>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                          >
                            Siguiente
                            <ChevronRight size={16} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default ChannelsManagementPage;
