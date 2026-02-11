import { useState, useEffect, useCallback } from 'react';
import { sectionsApi } from '@/lib/api';
import logger from '@/lib/logger';

/**
 * Hook personalizado para manejar las secciones de canales
 * Carga las secciones del home y sus canales asociados
 */
export function useChannelsSections() {
  const [sections, setSections] = useState([]);
  const [sectionsWithChannels, setSectionsWithChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Carga las secciones iniciales
   */
  const loadSections = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      logger.dev('📥 Cargando secciones del home...');
      const sectionsData = await sectionsApi.getHomeSections(forceRefresh);
      
      // Filtrar la sección de favoritos vacía si no hay favoritos
      const filteredSections = sectionsData.filter(section => {
        // Mantener todas las secciones excepto favoritos si no queremos cargarla aún
        return true; // Por ahora mostramos todas
      });
      
      setSections(filteredSections);
      logger.dev(`✅ ${filteredSections.length} secciones cargadas`);
    } catch (err) {
      logger.error('❌ Error cargando secciones:', err);
      setError(err.message || 'Error al cargar secciones');
      setSections([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Carga los canales de una sección específica
   */
  const loadSectionChannels = useCallback(async (sectionId, forceRefresh = false) => {
    try {
      logger.dev(`📥 Cargando canales de sección ${sectionId}...`);
      const channels = await sectionsApi.getSectionChannels(sectionId, forceRefresh);
      
      // Actualizar la sección con sus canales
      setSectionsWithChannels(prev => {
        const existing = prev.find(s => s.id === sectionId);
        if (existing) {
          // Actualizar existente
          return prev.map(s => 
            s.id === sectionId 
              ? { ...s, channels, loaded: true }
              : s
          );
        } else {
          // Añadir nueva
          const section = sections.find(s => s.id === sectionId);
          if (section) {
            return [...prev, { ...section, channels, loaded: true }];
          }
          return prev;
        }
      });
      
      logger.dev(`✅ ${channels.length} canales cargados para sección ${sectionId}`);
      return channels;
    } catch (err) {
      logger.error(`❌ Error cargando canales de sección ${sectionId}:`, err);
      return [];
    }
  }, [sections]);

  /**
   * Carga todos los canales de todas las secciones
   */
  const loadAllSectionChannels = useCallback(async (forceRefresh = false) => {
    if (sections.length === 0) return;

    try {
      logger.dev('📥 Cargando canales de todas las secciones...');
      
      // Cargar canales de cada sección en paralelo
      const promises = sections.map(section => 
        sectionsApi.getSectionChannels(section.id, forceRefresh)
          .then(channels => ({
            ...section,
            channels: channels || [],
            loaded: true
          }))
          .catch(err => {
            logger.error(`Error cargando sección ${section.id}:`, err);
            return {
              ...section,
              channels: [],
              loaded: true,
              error: err.message
            };
          })
      );

      const results = await Promise.all(promises);
      
      // Filtrar secciones sin canales (opcional, depende del diseño)
      const filteredResults = results.filter(section => {
        // Mantener todas las secciones, incluso sin canales
        // (la UI puede mostrar un mensaje de "sin canales")
        return true;
      });
      
      setSectionsWithChannels(filteredResults);
      logger.dev(`✅ Canales cargados para ${filteredResults.length} secciones`);
    } catch (err) {
      logger.error('❌ Error cargando canales:', err);
    }
  }, [sections]);

  /**
   * Refresca todas las secciones y sus canales
   */
  const refresh = useCallback(async () => {
    logger.dev('🔄 Refrescando secciones...');
    await loadSections(true);
  }, [loadSections]);

  /**
   * Invalida el cache de una sección específica
   */
  const invalidateSectionCache = useCallback((sectionId) => {
    sectionsApi.invalidateSectionChannelsCache(sectionId);
  }, []);

  /**
   * Invalida todo el cache
   */
  const invalidateAllCache = useCallback(() => {
    sectionsApi.invalidateAllCache();
  }, []);

  // Cargar secciones al montar el componente
  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Cargar canales cuando las secciones estén disponibles
  useEffect(() => {
    if (sections.length > 0 && sectionsWithChannels.length === 0) {
      loadAllSectionChannels();
    }
  }, [sections, sectionsWithChannels.length, loadAllSectionChannels]);

  return {
    // Estados
    sections,
    sectionsWithChannels,
    loading,
    error,
    refreshing,
    
    // Funciones
    loadSections,
    loadSectionChannels,
    loadAllSectionChannels,
    refresh,
    invalidateSectionCache,
    invalidateAllCache
  };
}

export default useChannelsSections;
