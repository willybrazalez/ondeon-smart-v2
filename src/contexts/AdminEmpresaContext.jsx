import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

/**
 * Contexto para gestionar las empresas asignadas a un administrador
 * y permitir filtrar/cambiar entre ellas
 */

const AdminEmpresaContext = createContext();

export function AdminEmpresaProvider({ children }) {
  const { user } = useAuth();
  
  // Marcas asignadas al admin
  const [marcasAsignadas, setMarcasAsignadas] = useState([]);
  
  // Empresas asignadas al admin (obtenidas a través de las marcas)
  const [empresasAsignadas, setEmpresasAsignadas] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  
  // Empresa actualmente seleccionada (null = todas)
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);
  
  // Estadísticas por empresa
  const [estadisticasPorEmpresa, setEstadisticasPorEmpresa] = useState({});

  // Cargar empresas asignadas al admin
  useEffect(() => {
    const fetchEmpresas = async () => {
      if (!user) {
        setEmpresasAsignadas([]);
        setLoadingEmpresas(false);
        return;
      }

      try {
        setLoadingEmpresas(true);
        const userId = user?.id || user?.usuario_id || user?.user_id;
        
        logger.dev('🏢 Cargando marcas y empresas asignadas al admin:', userId);

        // 1️⃣ Obtener marcas asignadas al admin
        const { data: asignaciones, error: errorAsig } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', userId);

        if (errorAsig) throw errorAsig;

        const marcasIds = (asignaciones || []).map(a => a.marca_id).filter(Boolean);
        
        if (marcasIds.length === 0) {
          logger.warn('⚠️ Admin sin marcas asignadas');
          setMarcasAsignadas([]);
          setEmpresasAsignadas([]);
          setLoadingEmpresas(false);
          return;
        }

        // 2️⃣ Obtener datos completos de las marcas
        const { data: marcas, error: errorMarcas } = await supabase
          .from('marcas')
          .select('*')
          .in('id', marcasIds)
          .eq('activa', true)
          .order('nombre');

        if (errorMarcas) {
          logger.warn('⚠️ Error obteniendo marcas:', errorMarcas);
        }

        setMarcasAsignadas(marcas || []);
        logger.dev(`✅ ${marcas?.length || 0} marca(s) asignadas`);

        // 3️⃣ Obtener empresas de esas marcas
        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select('empresa_id, marca_id')
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) throw errorMarcaEmpresas;

        const empresaIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        
        if (empresaIds.length === 0) {
          logger.warn('⚠️ Las marcas del admin no tienen empresas asignadas');
          setEmpresasAsignadas([]);
          setLoadingEmpresas(false);
          return;
        }

        // 4️⃣ Obtener datos completos de las empresas
        const { data: empresas, error: errorEmpresas } = await supabase
          .from('empresas')
          .select('*')
          .in('id', empresaIds)
          .order('razon_social');

        if (errorEmpresas) throw errorEmpresas;

        logger.dev(`✅ ${empresas?.length || 0} empresa(s) cargadas de ${marcasIds.length} marca(s)`);
        setEmpresasAsignadas(empresas || []);

        // Si había una empresa seleccionada guardada, restaurarla
        const savedEmpresaId = localStorage.getItem('admin_empresa_seleccionada');
        if (savedEmpresaId && empresaIds.includes(savedEmpresaId)) {
          setEmpresaSeleccionada(savedEmpresaId);
        }

      } catch (error) {
        logger.error('❌ Error cargando marcas y empresas:', error);
        setMarcasAsignadas([]);
        setEmpresasAsignadas([]);
      } finally {
        setLoadingEmpresas(false);
      }
    };

    fetchEmpresas();
  }, [user]);

  // Cargar estadísticas por empresa
  useEffect(() => {
    const fetchEstadisticas = async () => {
      if (empresasAsignadas.length === 0) return;

      try {
        const stats = {};

        for (const empresa of empresasAsignadas) {
          // Contar usuarios
          const { count: usuariosCount } = await supabase
            .from('usuarios')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresa.id);

          // Contar grupos
          const { count: gruposCount } = await supabase
            .from('grupos')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresa.id);

          // Contar usuarios online
          const { count: onlineCount } = await supabase
            .from('user_current_state')
            .select('*, usuarios!inner(empresa_id)', { count: 'exact', head: true })
            .eq('usuarios.empresa_id', empresa.id)
            .eq('is_online', true);

          stats[empresa.id] = {
            usuarios: usuariosCount || 0,
            grupos: gruposCount || 0,
            online: onlineCount || 0
          };
        }

        setEstadisticasPorEmpresa(stats);
      } catch (error) {
        logger.warn('⚠️ Error cargando estadísticas:', error);
      }
    };

    fetchEstadisticas();

    // Actualizar cada 30 segundos
    const interval = setInterval(fetchEstadisticas, 30000);
    return () => clearInterval(interval);
  }, [empresasAsignadas]);

  // IDs de empresas para filtros
  const empresaIdsActivos = useMemo(() => {
    if (empresaSeleccionada) {
      return [empresaSeleccionada];
    }
    return empresasAsignadas.map(e => e.id);
  }, [empresaSeleccionada, empresasAsignadas]);

  // Función para cambiar empresa seleccionada
  const seleccionarEmpresa = (empresaId) => {
    setEmpresaSeleccionada(empresaId);
    if (empresaId) {
      localStorage.setItem('admin_empresa_seleccionada', empresaId);
      logger.dev('🏢 Empresa seleccionada:', empresaId);
    } else {
      localStorage.removeItem('admin_empresa_seleccionada');
      logger.dev('🏢 Mostrando todas las empresas');
    }
  };

  // Función para ver todas las empresas
  const verTodasEmpresas = () => {
    seleccionarEmpresa(null);
  };

  const value = {
    // Estado
    marcasAsignadas,
    empresasAsignadas,
    loadingEmpresas,
    empresaSeleccionada,
    empresaIdsActivos,
    estadisticasPorEmpresa,
    
    // Acciones
    seleccionarEmpresa,
    verTodasEmpresas,
    
    // Helpers
    esModoTodasEmpresas: empresaSeleccionada === null,
    empresaActual: empresasAsignadas.find(e => e.id === empresaSeleccionada),
    totalMarcas: marcasAsignadas.length,
  };

  return (
    <AdminEmpresaContext.Provider value={value}>
      {children}
    </AdminEmpresaContext.Provider>
  );
}

export function useAdminEmpresas() {
  const context = useContext(AdminEmpresaContext);
  if (!context) {
    throw new Error('useAdminEmpresas debe usarse dentro de AdminEmpresaProvider');
  }
  return context;
}

export default AdminEmpresaContext;

