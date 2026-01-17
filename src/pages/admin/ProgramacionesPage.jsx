import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  Music,
  Play,
  Pause,
  Edit,
  Trash2,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Check,
  X,
  Save,
  Loader2,
  FileText,
  Settings
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import logger from '@/lib/logger';

const ProgramacionesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [programaciones, setProgramaciones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'activo' | 'pausado' | 'completado'
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);
  const [adminMarcaId, setAdminMarcaId] = useState(null); // Para cargar grupos desde marca_grupos
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados para edición inline de nombre
  const [editandoId, setEditandoId] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  
  // Estados para modal de edición completa
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [programacionEditando, setProgramacionEditando] = useState(null);
  const [formEdicion, setFormEdicion] = useState(null);
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [gruposConUsuarios, setGruposConUsuarios] = useState({});
  const [gruposExpandidos, setGruposExpandidos] = useState([]);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Tab activo en el modal de edición (1: Contenido, 2: Destinatarios, 3: Configuración)
  const [tabActivo, setTabActivo] = useState(1);
  
  // Contenidos disponibles y seleccionados
  const [contenidosDisponibles, setContenidosDisponibles] = useState([]);
  const [contenidosSeleccionados, setContenidosSeleccionados] = useState([]);
  
  // Modo "Una vez al día" (para frecuencia)
  const [unaVezAlDia, setUnaVezAlDia] = useState(false);
  const [horaUnaVez, setHoraUnaVez] = useState('12:00');
  
  // 🔧 NUEVO: Estado para detectar si hay contenido de IA seleccionado
  const [hayContenidoIA, setHayContenidoIA] = useState(false);

  // ✅ FIX: Resetear unaVezAlDia solo cuando el tipo cambia a 'anual' (no aplica a anual)
  useEffect(() => {
    if (formEdicion && formEdicion.tipo === 'anual' && unaVezAlDia) {
      logger.dev('🔄 Tipo cambió a anual, reseteando unaVezAlDia (no aplica a anual)');
      setUnaVezAlDia(false);
    }
  }, [formEdicion?.tipo, unaVezAlDia]);

  // Cargar empresas del admin (a través de sus marcas)
  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user) return;
      
      try {
        const userId = user?.id || user?.usuario_id || user?.user_id;
        
        // 1️⃣ Obtener marcas asignadas al admin
        const { data: asignacionesMarcas, error } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', userId);

        if (error) {
          logger.error('❌ Error obteniendo marcas del admin:', error);
          return;
        }

        const marcasIds = (asignacionesMarcas || []).map(a => a.marca_id).filter(Boolean);
        
        if (marcasIds.length === 0) {
          logger.warn('⚠️ Admin sin marcas asignadas');
          setAdminEmpresaIds([]);
          setAdminMarcaId(null);
          return;
        }

        // Guardar la primera marca del admin (para cargar grupos desde marca_grupos)
        setAdminMarcaId(marcasIds[0]);

        // 2️⃣ Obtener empresas de esas marcas
        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select('empresa_id')
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) {
          logger.error('❌ Error obteniendo empresas de las marcas:', errorMarcaEmpresas);
          return;
        }

        const empresasIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        logger.dev(`✅ Admin tiene ${marcasIds.length} marca(s) con ${empresasIds.length} empresa(s)`);
        setAdminEmpresaIds(empresasIds);
      } catch (e) {
        logger.error('❌ Error obteniendo marcas y empresas del admin:', e);
      }
    };

    fetchAdminEmpresas();
  }, [user]);

  // Cargar programaciones
  useEffect(() => {
    if (adminEmpresaIds.length > 0) {
      cargarProgramaciones();
    }
  }, [adminEmpresaIds, filtroEstado]);

  // 🔧 NUEVO: Detectar si se viene desde ContentManagementPage con contenido pre-seleccionado
  useEffect(() => {
    const contenidoId = searchParams.get('crearConContenido');
    if (contenidoId && adminEmpresaIds.length > 0 && adminMarcaId) {
      // Limpiar el parámetro de URL
      setSearchParams({});
      
      // Abrir modal de creación con el contenido pre-seleccionado
      abrirModalCreacionConContenido(contenidoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, adminEmpresaIds, adminMarcaId]);

  // 🔧 NUEVO: Detectar si hay contenido de IA seleccionado y forzar modo background
  useEffect(() => {
    const verificarContenidoIA = async () => {
      if (contenidosSeleccionados.length === 0) {
        setHayContenidoIA(false);
        return;
      }
      
      try {
        const { data: aiAds } = await supabase
          .from('ai_generated_ads')
          .select('contenido_id')
          .in('contenido_id', contenidosSeleccionados);
        
        const hayIA = aiAds && aiAds.length > 0;
        setHayContenidoIA(hayIA);
        
        // Si hay contenido IA y el modo no es background, forzarlo
        if (hayIA && formEdicion && formEdicion.modoAudio !== 'background') {
          logger.dev('🤖 Contenido IA detectado - forzando modo background');
          setFormEdicion({...formEdicion, modoAudio: 'background'});
        }
      } catch (error) {
        logger.error('❌ Error verificando contenido IA:', error);
        setHayContenidoIA(false);
      }
    };
    
    if (modalEditarAbierto && contenidosSeleccionados.length > 0) {
      verificarContenidoIA();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contenidosSeleccionados, modalEditarAbierto]);

  const cargarProgramaciones = async () => {
    setIsLoading(true);
    
    try {
      logger.dev('📋 Cargando programaciones para empresas:', adminEmpresaIds);
      
      // CRÍTICO: Primero obtener IDs de usuarios de las empresas del admin
      const { data: usuariosEmpresas, error: errorUsuarios } = await supabase
        .from('usuarios')
        .select('id')
        .in('empresa_id', adminEmpresaIds);
      
      if (errorUsuarios) {
        logger.error('❌ Error obteniendo usuarios:', errorUsuarios);
        throw errorUsuarios;
      }
      
      const usuariosIds = usuariosEmpresas?.map(u => u.id) || [];
      
      if (usuariosIds.length === 0) {
        logger.warn('⚠️ No hay usuarios en las empresas del admin');
        setProgramaciones([]);
        setIsLoading(false);
        return;
      }
      
      logger.dev(`🔍 Filtrando por ${usuariosIds.length} usuarios de las empresas del admin`);
      
      // Obtener programaciones que tengan destinatarios de estas empresas
      let query = supabase
        .from('programaciones')
        .select(`
          *,
          programacion_contenidos!inner (
            contenido_id,
            contenidos (
              nombre,
              tipo_contenido,
              duracion_segundos
            )
          ),
          programacion_destinatarios!inner (
            id,
            tipo,
            usuario_id,
            usuarios:usuario_id (
              nombre,
              username,
              empresa_id
            )
          )
        `)
        .in('programacion_destinatarios.usuario_id', usuariosIds)
        .order('created_at', { ascending: false });
      
      // Filtrar por estado si no es 'todos'
      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('❌ Error cargando programaciones:', error);
        throw error;
      }
      
      // Obtener todos los IDs únicos de created_by, modified_by y updated_by para verificar usuarios y superadmins
      const createdByIds = [...new Set((data || []).map(prog => prog.created_by).filter(Boolean))];
      const modifiedByIds = [...new Set((data || []).map(prog => prog.modified_by || prog.updated_by).filter(Boolean))];
      const allUserIds = [...new Set([...createdByIds, ...modifiedByIds])];
      
      // Consultar usuarios creadores y modificadores
      let usuariosMap = new Map();
      if (allUserIds.length > 0) {
        const { data: usuarios, error: errorUsuarios } = await supabase
          .from('usuarios')
          .select('id, username')
          .in('id', allUserIds);
        
        if (!errorUsuarios && usuarios) {
          usuarios.forEach(u => {
            usuariosMap.set(u.id, u.username);
          });
        }
      }
      
      // Consultar superadmins para los created_by y modified_by que existen
      let superadminsMap = new Map();
      if (allUserIds.length > 0) {
        const { data: superadmins, error: errorSuperadmins } = await supabase
          .from('superadmins')
          .select('id')
          .in('id', allUserIds);
        
        if (!errorSuperadmins && superadmins) {
          superadmins.forEach(sa => {
            superadminsMap.set(sa.id, true);
          });
        }
      }
      
      // Eliminar duplicados (si una programación aparece múltiples veces por tener varios destinatarios)
      const programacionesUnicas = new Map();
      
      (data || []).forEach(prog => {
        if (!programacionesUnicas.has(prog.id)) {
          programacionesUnicas.set(prog.id, prog);
        }
      });
      
      // Procesar y contar destinatarios únicos (solo de las empresas del admin)
      const programacionesConInfo = Array.from(programacionesUnicas.values()).map(prog => {
        // Filtrar destinatarios que pertenecen a las empresas del admin
        const destinatariosDeEmpresasAdmin = prog.programacion_destinatarios?.filter(d => 
          d.usuarios?.empresa_id && adminEmpresaIds.includes(d.usuarios.empresa_id)
        ) || [];
        
        const destinatariosUnicos = new Set(
          destinatariosDeEmpresasAdmin.map(d => d.usuario_id)
        ).size;
        
        const contenidosUnicos = new Set(
          prog.programacion_contenidos?.map(pc => pc.contenido_id) || []
        ).size;
        
        // Determinar el nombre del creador
        let creadorNombre = 'Sistema';
        if (prog.created_by) {
          if (superadminsMap.has(prog.created_by)) {
            creadorNombre = 'superadmin';
          } else if (usuariosMap.has(prog.created_by)) {
            creadorNombre = usuariosMap.get(prog.created_by);
          }
        }
        
        // Determinar el nombre del último modificador (priorizar modified_by sobre updated_by)
        const modificadorId = prog.modified_by || prog.updated_by;
        let modificadorNombre = null;
        if (modificadorId) {
          if (superadminsMap.has(modificadorId)) {
            modificadorNombre = 'superadmin';
          } else if (usuariosMap.has(modificadorId)) {
            modificadorNombre = usuariosMap.get(modificadorId);
          }
        }
        
        return {
          ...prog,
          programacion_destinatarios: destinatariosDeEmpresasAdmin, // Solo mostrar destinatarios de empresas del admin
          cantidadUsuarios: destinatariosUnicos,
          cantidadContenidos: contenidosUnicos,
          creadorNombre: creadorNombre, // Agregar el nombre del creador
          modificadorNombre: modificadorNombre // Agregar el nombre del modificador
        };
      });
      
      setProgramaciones(programacionesConInfo);
      logger.dev(`✅ ${programacionesConInfo.length} programaciones cargadas (filtradas por empresa)`);
      
    } catch (error) {
      logger.error('❌ Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePausarProgramacion = async (programacionId, estadoActual) => {
    try {
      // Si el estado es 'completado', no se puede activar directamente
      if (estadoActual === 'completado') {
        toast({
          title: "⚠️ Programación completada",
          description: (
            <div className="space-y-2 mt-2">
              <p className="text-sm">Esta programación ya finalizó porque su fecha de fin ha pasado.</p>
              <div className="text-sm mt-3">
                <p className="font-semibold mb-1">📝 Para reactivarla:</p>
                <ol className="list-decimal ml-4 space-y-1 text-xs">
                  <li>Haz clic en "Editar"</li>
                  <li>Cambia la "Fecha de fin" a una fecha futura</li>
                  <li>Guarda los cambios</li>
                  <li>La programación se activará automáticamente</li>
                </ol>
              </div>
            </div>
          ),
          variant: "destructive",
          duration: 8000,
        });
        return;
      }
      
      const nuevoEstado = estadoActual === 'activo' ? 'pausado' : 'activo';
      
      // ✅ Obtener ID del admin - intentar auth.users primero, luego usuarios legacy
      let adminId = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        adminId = authUser?.id || null;
      } catch (e) {
        logger.warn('⚠️ No se pudo obtener usuario de auth, usando usuario legacy');
      }
      
      // Si no hay auth user, usar usuario legacy (solo si las constraints fueron eliminadas)
      if (!adminId) {
        adminId = user?.id || user?.usuario_id || user?.user_id || null;
      }
      
      const { error } = await supabase
        .from('programaciones')
        .update({ 
          estado: nuevoEstado,
          updated_by: adminId,
          modified_by: adminId, // ✅ Actualizar modified_by en cualquier modificación
          updated_at: new Date().toISOString()
        })
        .eq('id', programacionId);
      
      if (error) throw error;
      
      logger.dev(`✅ Programación ${nuevoEstado === 'pausado' ? 'pausada' : 'activada'}`);
      
      // Recargar programaciones
      cargarProgramaciones();
      
    } catch (error) {
      logger.error('❌ Error cambiando estado:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleEliminarProgramacion = async (programacionId, descripcion) => {
    const confirmar = confirm(`¿Estás seguro de eliminar la programación "${descripcion}"?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmar) return;
    
    try {
      const { error } = await supabase
        .from('programaciones')
        .delete()
        .eq('id', programacionId);
      
      if (error) throw error;
      
      logger.dev('✅ Programación eliminada');
      cargarProgramaciones();
      
    } catch (error) {
      logger.error('❌ Error eliminando:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const iniciarEdicion = (programacionId, nombreActual) => {
    setEditandoId(programacionId);
    setNuevoNombre(nombreActual);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNuevoNombre('');
  };

  const guardarNombreProgramacion = async (programacionId) => {
    if (!nuevoNombre.trim()) {
      alert('⚠️ El nombre no puede estar vacío');
      return;
    }

    try {
      // ✅ Obtener ID del admin - intentar auth.users primero, luego usuarios legacy
      let adminId = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        adminId = authUser?.id || null;
      } catch (e) {
        logger.warn('⚠️ No se pudo obtener usuario de auth, usando usuario legacy');
      }
      
      // Si no hay auth user, usar usuario legacy (solo si las constraints fueron eliminadas)
      if (!adminId) {
        adminId = user?.id || user?.usuario_id || user?.user_id || null;
      }
      
      const { error } = await supabase
        .from('programaciones')
        .update({ 
          descripcion: nuevoNombre.trim(),
          updated_by: adminId,
          modified_by: adminId, // ✅ Actualizar modified_by en cualquier modificación
          updated_at: new Date().toISOString()
        })
        .eq('id', programacionId);
      
      if (error) throw error;
      
      logger.dev('✅ Nombre de programación actualizado');
      
      // Actualizar en el estado local
      setProgramaciones(prev => 
        prev.map(prog => 
          prog.id === programacionId 
            ? { ...prog, descripcion: nuevoNombre.trim() }
            : prog
        )
      );
      
      cancelarEdicion();
      
    } catch (error) {
      logger.error('❌ Error actualizando nombre:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // ========== MODAL DE EDICIÓN COMPLETA ==========
  
  const cargarContenidosDisponibles = async () => {
    if (!adminMarcaId) {
      logger.warn('⚠️ No hay marca asignada');
      setContenidosDisponibles([]);
      return;
    }
    
    try {
      logger.dev('📄 Cargando contenidos de la marca:', adminMarcaId);
      
      // Obtener IDs de contenidos de la marca
      const { data: marcaContenidos, error: errorMarcaContenidos } = await supabase
        .from('marca_contenidos')
        .select('contenido_id')
        .eq('marca_id', adminMarcaId);
      
      if (errorMarcaContenidos) {
        logger.error('❌ Error consultando marca_contenidos:', errorMarcaContenidos);
        setContenidosDisponibles([]);
        return;
      }
      
      const contenidoIds = (marcaContenidos || []).map(mc => mc.contenido_id).filter(Boolean);
      
      if (contenidoIds.length === 0) {
        logger.warn('⚠️ No hay contenidos asignados a esta marca');
        setContenidosDisponibles([]);
        return;
      }
      
      // Obtener datos completos de los contenidos
      const { data: contenidos, error: errorContenidos } = await supabase
        .from('contenidos')
        .select('id, nombre, tipo_contenido, duracion_segundos, activo')
        .in('id', contenidoIds)
        .eq('activo', true)
        .order('nombre');
      
      if (errorContenidos) {
        logger.error('❌ Error consultando contenidos:', errorContenidos);
        setContenidosDisponibles([]);
        return;
      }
      
      logger.dev(`✅ ${contenidos?.length || 0} contenidos disponibles`);
      setContenidosDisponibles(contenidos || []);
      
    } catch (error) {
      logger.error('❌ Error cargando contenidos:', error);
      setContenidosDisponibles([]);
    }
  };

  // 🔧 NUEVO: Abrir modal de creación con contenido pre-seleccionado
  const abrirModalCreacionConContenido = async (contenidoId) => {
    try {
      logger.dev('📝 Abriendo modal de creación con contenido:', contenidoId);
      
      // 🔧 NUEVO: Verificar si el contenido es de IA
      const { data: aiAd } = await supabase
        .from('ai_generated_ads')
        .select('contenido_id')
        .eq('contenido_id', contenidoId)
        .maybeSingle();
      
      const esContenidoIA = !!aiAd;
      logger.dev(`🤖 Contenido es de IA: ${esContenidoIA}`);
      
      // Cargar contenidos disponibles
      await cargarContenidosDisponibles();
      
      // Pre-seleccionar el contenido
      setContenidosSeleccionados([contenidoId]);
      
      if (!adminMarcaId) {
        logger.warn('⚠️ No hay marca asignada, no se pueden cargar grupos');
        setGruposDisponibles([]);
      } else {
        // 1️⃣ Obtener IDs de grupos asignados a la marca desde marca_grupos
        logger.dev('📋 Consultando marca_grupos para marca:', adminMarcaId);
        
        const { data: marcaGrupos, error: errorMarcaGrupos } = await supabase
          .from('marca_grupos')
          .select('grupo_id')
          .eq('marca_id', adminMarcaId);
        
        if (errorMarcaGrupos) {
          logger.error('❌ Error consultando marca_grupos:', errorMarcaGrupos);
          setGruposDisponibles([]);
        } else {
          const grupoIds = (marcaGrupos || []).map(mg => mg.grupo_id).filter(Boolean);
          logger.dev(`✅ ${grupoIds.length} grupos asignados a la marca:`, grupoIds);
          
          if (grupoIds.length === 0) {
            logger.warn('⚠️ No hay grupos asignados a esta marca');
            setGruposDisponibles([]);
          } else {
            // 2️⃣ Obtener datos completos de esos grupos
            const { data: grupos, error: errorGrupos } = await supabase
              .from('grupos')
              .select('id, nombre, descripcion, empresa_id')
              .in('id', grupoIds);
            
            if (errorGrupos) {
              logger.error('❌ Error consultando grupos:', errorGrupos);
              setGruposDisponibles([]);
            } else {
              logger.dev(`✅ ${grupos?.length || 0} grupos cargados`);
              setGruposDisponibles(grupos || []);
              
              // 3️⃣ Cargar usuarios de los grupos
              if (grupos && grupos.length > 0) {
                await cargarUsuariosDeGrupos(grupos.map(g => g.id));
              }
            }
          }
        }
      }
      
      // Preparar formulario con valores por defecto
      const fechaHoy = new Date().toISOString().split('T')[0];
      setFormEdicion({
        nombre: '', // Se puede dejar vacío para que el usuario lo complete
        tipo: 'diaria',
        fechaInicio: fechaHoy,
        horaInicio: '10:00',
        fechaFin: '',
        horaFin: '23:59',
        frecuenciaMinutos: 15,
        modoAudio: esContenidoIA ? 'background' : 'background', // 🔧 NUEVO: Si es IA, forzar 'background'
        // Diaria
        dailyMode: 'laborales',
        cadaDias: 1,
        rangoDesde: '08:00',
        rangoHasta: '23:59',
        horaUnaVezDia: '12:00',
        // Semanal
        weeklyMode: 'rango',
        weeklyDays: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        weeklyRangoDesde: '08:00',
        weeklyRangoHasta: '23:59',
        weeklyHoraUnaVez: '12:00',
        // Anual
        annualDate: '01/01',
        annualTime: '12:00'
      });
      
      setUnaVezAlDia(false);
      setHoraUnaVez('12:00');
      setUsuariosSeleccionados([]);
      setProgramacionEditando(null); // null = modo creación
      setTabActivo(1);
      setModalEditarAbierto(true);
      
    } catch (error) {
      logger.error('❌ Error abriendo modal de creación:', error);
      toast({
        title: "Error",
        description: "No se pudo abrir el modal de creación",
        variant: "destructive"
      });
    }
  };
  
  const abrirModalEdicion = async (programacion) => {
    try {
      logger.dev('📝 Abriendo modal de edición para:', programacion.id);
      logger.dev('🏢 Marca del admin:', adminMarcaId);
      
      // Cargar contenidos disponibles
      await cargarContenidosDisponibles();
      
      // Cargar contenidos actuales de la programación
      const { data: progContenidos, error: errorProgContenidos } = await supabase
        .from('programacion_contenidos')
        .select('contenido_id')
        .eq('programacion_id', programacion.id);
      
      if (!errorProgContenidos && progContenidos) {
        setContenidosSeleccionados(progContenidos.map(pc => pc.contenido_id));
      }
      
      if (!adminMarcaId) {
        logger.warn('⚠️ No hay marca asignada, no se pueden cargar grupos');
        setGruposDisponibles([]);
        // Continuar con el resto del modal sin grupos
      } else {
        // 1️⃣ Obtener IDs de grupos asignados a la marca desde marca_grupos
        logger.dev('📋 Consultando marca_grupos para marca:', adminMarcaId);
        
        const { data: marcaGrupos, error: errorMarcaGrupos } = await supabase
          .from('marca_grupos')
          .select('grupo_id')
          .eq('marca_id', adminMarcaId);
        
        if (errorMarcaGrupos) {
          logger.error('❌ Error consultando marca_grupos:', errorMarcaGrupos);
          setGruposDisponibles([]);
        } else {
          const grupoIds = (marcaGrupos || []).map(mg => mg.grupo_id).filter(Boolean);
          logger.dev(`✅ ${grupoIds.length} grupos asignados a la marca:`, grupoIds);
          
          if (grupoIds.length === 0) {
            logger.warn('⚠️ No hay grupos asignados a esta marca');
            setGruposDisponibles([]);
          } else {
            // 2️⃣ Obtener datos completos de esos grupos
      const { data: grupos, error: errorGrupos } = await supabase
        .from('grupos')
        .select('id, nombre, descripcion, empresa_id')
              .in('id', grupoIds);
      
      if (errorGrupos) {
              logger.error('❌ Error consultando grupos:', errorGrupos);
              setGruposDisponibles([]);
            } else {
              logger.dev(`✅ ${grupos?.length || 0} grupos cargados`);
      setGruposDisponibles(grupos || []);
      
              // 3️⃣ Cargar usuarios de los grupos
      if (grupos && grupos.length > 0) {
        await cargarUsuariosDeGrupos(grupos.map(g => g.id));
              }
            }
          }
        }
      }
      
      // Cargar destinatarios actuales de la programación
      const { data: destinatarios, error: errorDest } = await supabase
        .from('programacion_destinatarios')
        .select('*, usuarios:usuario_id(id, nombre, username)')
        .eq('programacion_id', programacion.id)
        .eq('activo', true);
      
      if (errorDest) throw errorDest;
      
      const usuariosIds = destinatarios?.filter(d => d.tipo === 'usuario').map(d => d.usuario_id) || [];
      setUsuariosSeleccionados(usuariosIds);
      
      // Preparar formulario con datos actuales
      // ✅ FIX: Cargar todos los valores guardados correctamente
      logger.dev('📋 Datos de programación a cargar:', {
        descripcion: programacion.descripcion,
        tipo: programacion.tipo,
        daily_mode: programacion.daily_mode,
        weekly_mode: programacion.weekly_mode,
        weekly_days: programacion.weekly_days,
        frecuencia_minutos: programacion.frecuencia_minutos
      });
      
      // Parsear weekly_days si viene como string (array JSON)
      // ✅ FIX: Mapear días de inglés a español para el formulario
      const mapeoDiasInglesEspañol = {
        'mon': 'lunes',
        'tue': 'martes',
        'wed': 'miercoles',
        'thu': 'jueves',
        'fri': 'viernes',
        'sat': 'sabado',
        'sun': 'domingo',
        // También soportar abreviaciones en español
        'lun': 'lunes',
        'mar': 'martes',
        'mie': 'miercoles',
        'jue': 'jueves',
        'vie': 'viernes',
        'sab': 'sabado',
        'dom': 'domingo'
      };
      
      let weeklyDaysParsed = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
      if (programacion.weekly_days) {
        let diasParseados = [];
        
        if (typeof programacion.weekly_days === 'string') {
          try {
            diasParseados = JSON.parse(programacion.weekly_days);
          } catch (e) {
            logger.warn('⚠️ Error parseando weekly_days:', e);
            diasParseados = programacion.weekly_days.split(',').map(d => d.trim().replace(/"/g, ''));
          }
        } else if (Array.isArray(programacion.weekly_days)) {
          diasParseados = programacion.weekly_days;
        }
        
        // Convertir días de inglés a español
        weeklyDaysParsed = diasParseados.map(dia => {
          const diaLower = dia.toLowerCase().trim();
          // Si ya está en español completo, mantenerlo
          if (['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo'].includes(diaLower)) {
            // Normalizar variantes
            if (diaLower === 'miércoles') return 'miercoles';
            if (diaLower === 'sábado') return 'sabado';
            return diaLower;
          }
          // Si está en inglés o abreviación, convertir a español
          return mapeoDiasInglesEspañol[diaLower] || dia;
        }).filter(Boolean); // Filtrar valores nulos/undefined
        
        logger.dev('📅 Días parseados:', {
          original: programacion.weekly_days,
          parseados: diasParseados,
          convertidos: weeklyDaysParsed
        });
      }
      
      // ✅ FIX: Detectar si está en modo "Una vez al día" ANTES de cargar frecuenciaMinutos
      // Puede ser diaria (daily_mode === 'una_vez_dia') o semanal (weekly_mode === 'una_vez_dia')
      const esUnaVezDiaria = programacion.tipo === 'diaria' && programacion.daily_mode === 'una_vez_dia';
      const esUnaVezSemanal = programacion.tipo === 'semanal' && programacion.weekly_mode === 'una_vez_dia';
      const esUnaVez = esUnaVezDiaria || esUnaVezSemanal;
      
      // ✅ FIX: Establecer estado ANTES de cargar formulario para evitar renderizado incorrecto
      setUnaVezAlDia(esUnaVez);
      // Cargar la hora correcta según el tipo
      if (esUnaVezDiaria) {
        setHoraUnaVez(programacion.hora_una_vez_dia || '12:00');
      } else if (esUnaVezSemanal) {
        setHoraUnaVez(programacion.weekly_hora_una_vez || '12:00');
      } else {
        setHoraUnaVez('12:00');
      }
      
      // ✅ FIX: Cargar frecuencia_minutos correctamente
      // Si es una_vez_dia, frecuencia_minutos debería ser null en la BD
      // Si no es null, puede ser un dato inconsistente, pero lo ignoramos visualmente
      // Cargamos un valor por defecto que no se usará (el campo estará deshabilitado)
      // Para otros tipos, cargar el valor guardado o 15 por defecto
      const frecuenciaMinutosCargar = esUnaVez 
        ? 15 // Valor por defecto que no se usará (campo deshabilitado cuando unaVezAlDia es true)
        : (programacion.frecuencia_minutos !== null && programacion.frecuencia_minutos !== undefined 
            ? programacion.frecuencia_minutos 
            : 15); // Valor guardado o 15 por defecto
      
      // ✅ FIX: Función auxiliar para normalizar horas (quitar segundos si existen)
      const normalizarHora = (hora) => {
        if (!hora) return null;
        // Si viene como "08:00:00", convertir a "08:00"
        if (typeof hora === 'string' && hora.includes(':')) {
          const partes = hora.split(':');
          return `${partes[0]}:${partes[1]}`;
        }
        return hora;
      };
      
      setFormEdicion({
        nombre: programacion.descripcion || '',
        tipo: programacion.tipo || 'diaria',
        fechaInicio: programacion.fecha_inicio ? programacion.fecha_inicio.split('T')[0] : new Date().toISOString().split('T')[0],
        horaInicio: normalizarHora(programacion.hora_inicio) || '10:00',
        fechaFin: programacion.fecha_fin ? programacion.fecha_fin.split('T')[0] : '',
        horaFin: normalizarHora(programacion.hora_fin) || '23:59',
        frecuenciaMinutos: frecuenciaMinutosCargar,
        modoAudio: programacion.modo_audio || 'background',
        // Diaria - ✅ FIX: Solo cargar daily_mode si el tipo es 'diaria'
        dailyMode: programacion.tipo === 'diaria' ? (programacion.daily_mode || 'laborales') : 'laborales',
        cadaDias: programacion.cada_dias ?? 1,
        rangoDesde: normalizarHora(programacion.rango_desde) || '08:00',
        rangoHasta: normalizarHora(programacion.rango_hasta) || '23:59',
        horaUnaVezDia: normalizarHora(programacion.hora_una_vez_dia) || '12:00',
        // Semanal - ✅ FIX: Cargar valores guardados (aunque solo permitimos 'rango' ahora)
        weeklyMode: programacion.weekly_mode || 'rango', // Cargar valor guardado, pero si es 'una_vez_dia' se mostrará como 'rango'
        weeklyDays: weeklyDaysParsed,
        weeklyRangoDesde: normalizarHora(programacion.weekly_rango_desde) || '08:00',
        weeklyRangoHasta: normalizarHora(programacion.weekly_rango_hasta) || '23:59',
        weeklyHoraUnaVez: normalizarHora(programacion.weekly_hora_una_vez) || '12:00', // Cargar valor guardado aunque no se use
        // Anual
        annualDate: programacion.annual_date || '01/01',
        annualTime: normalizarHora(programacion.annual_time) || '12:00'
      });
      
      logger.dev('✅ Formulario cargado:', {
        nombre: programacion.descripcion,
        tipo: programacion.tipo,
        dailyMode: programacion.daily_mode,
        esUnaVez,
        horaUnaVez: programacion.hora_una_vez_dia
      });
      
      setProgramacionEditando(programacion);
      setTabActivo(1); // Resetear a la primera pestaña
      setModalEditarAbierto(true);
      
    } catch (error) {
      logger.error('❌ Error abriendo modal:', error);
      alert('Error cargando datos para edición');
    }
  };
  
  const cargarUsuariosDeGrupos = async (grupoIds) => {
    if (!grupoIds || grupoIds.length === 0) {
      logger.dev('⚠️ No hay grupos para cargar usuarios');
      return;
    }
    try {
      logger.dev(`👥 Cargando usuarios de ${grupoIds.length} grupo(s)...`);
      
      const { data: grupoUsuariosData, error } = await supabase
        .from('grupo_usuarios')
        .select(`
          grupo_id,
          usuario_id,
          usuarios:usuario_id (
            id,
            nombre,
            email,
            username,
            empresa_id,
            empresas:empresa_id (
              razon_social
            )
          )
        `)
        .in('grupo_id', grupoIds);
      
      if (error) {
        logger.error('❌ Error cargando usuarios de grupos:', error);
        return;
      }
      
      if (grupoUsuariosData) {
        const usuariosPorGrupo = {};
        let totalUsuarios = 0;
        
        grupoUsuariosData.forEach(item => {
          if (!usuariosPorGrupo[item.grupo_id]) {
            usuariosPorGrupo[item.grupo_id] = [];
          }
          if (item.usuarios) {
            usuariosPorGrupo[item.grupo_id].push(item.usuarios);
            totalUsuarios++;
          }
        });
        
        logger.dev(`✅ ${totalUsuarios} usuarios cargados de los grupos`);
        logger.dev('📊 Usuarios por grupo:', Object.keys(usuariosPorGrupo).map(gId => ({
          grupoId: gId,
          usuarios: usuariosPorGrupo[gId].length
        })));
        
        setGruposConUsuarios(usuariosPorGrupo);
      }
    } catch (error) {
      logger.warn('⚠️ Error cargando usuarios de grupos:', error);
    }
  };
  
  const cerrarModalEdicion = () => {
    setModalEditarAbierto(false);
    setProgramacionEditando(null);
    setFormEdicion(null);
    setUsuariosSeleccionados([]);
    setGruposExpandidos([]);
    setContenidosSeleccionados([]);
    setUnaVezAlDia(false);
    setHoraUnaVez('12:00');
    setHayContenidoIA(false); // ✅ FIX: Resetear estado de contenido IA
    setTabActivo(1); // Resetear tab para la próxima vez
  };
  
  // Función auxiliar para obtener el texto descriptivo del modo de audio
  const obtenerTextoModoAudio = (modo) => {
    switch (modo) {
      case 'fade_out':
        return 'bajando gradualmente la música';
      case 'background':
        return 'con música de fondo';
      case 'esperar_cancion':
        return 'esperando a que termine la canción actual';
      default:
        return 'con música de fondo';
    }
  };
  
  const guardarEdicionCompleta = async () => {
    if (!formEdicion) return;
    
    // 🔧 NUEVO: Si programacionEditando es null, es modo creación
    const esModoCreacion = !programacionEditando;
    
    if (!formEdicion.nombre.trim()) {
      alert('⚠️ Por favor, ingresa un nombre para la programación');
      return;
    }
    
    if (contenidosSeleccionados.length === 0) {
      alert('⚠️ Por favor, selecciona al menos un contenido');
      return;
    }
    
    if (usuariosSeleccionados.length === 0) {
      alert('⚠️ Por favor, selecciona al menos un usuario');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // ✅ Obtener ID del admin - intentar auth.users primero, luego usuarios legacy
      let adminId = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        adminId = authUser?.id || null;
      } catch (e) {
        logger.warn('⚠️ No se pudo obtener usuario de auth, usando usuario legacy');
      }
      
      // Si no hay auth user, usar usuario legacy (solo si las constraints fueron eliminadas)
      if (!adminId) {
        adminId = user?.id || user?.usuario_id || user?.user_id || null;
      }
      
      // 🔧 CRÍTICO: Determinar frecuencia_minutos según el modo
      // Si es modo una_vez_dia (diaria o semanal), frecuencia_minutos debe ser null
      const esModoUnaVezDia = unaVezAlDia; // Aplica tanto a diaria como a semanal
      
      // Preparar datos de actualización
      const updateData = {
        descripcion: formEdicion.nombre.trim(),
        tipo: formEdicion.tipo,
        fecha_inicio: formEdicion.fechaInicio,
        fecha_fin: formEdicion.fechaFin || null,
        hora_inicio: formEdicion.horaInicio,
        hora_fin: formEdicion.horaFin,
        frecuencia_minutos: esModoUnaVezDia ? null : formEdicion.frecuenciaMinutos, // ✅ FIX: null si es una_vez_dia
        modo_audio: formEdicion.modoAudio,
        updated_at: new Date().toISOString()
      };
      
      // ✅ Solo agregar modified_by si es una actualización (no creación)
      if (!esModoCreacion) {
        updateData.modified_by = adminId; // ✅ Actualizar modified_by en cualquier modificación
      }
      
      // Detectar automáticamente el tipo de terminación
      if (formEdicion.fechaFin && formEdicion.horaFin) {
        // Si tiene fecha_fin y hora_fin → 'en_fecha'
        updateData.terminacion_tipo = 'en_fecha';
        updateData.despues_dias = null; // Limpiar despues_dias si existe
      } else if (formEdicion.despuesDias) {
        // Si tiene despues_dias → 'despues'
        updateData.terminacion_tipo = 'despues';
        updateData.despues_dias = formEdicion.despuesDias;
        updateData.fecha_fin = null; // Limpiar fecha_fin si existe
        updateData.hora_fin = null; // Limpiar hora_fin si existe
      } else {
        // Si no tiene ninguno → 'nunca'
        updateData.terminacion_tipo = 'nunca';
        updateData.fecha_fin = null;
        updateData.hora_fin = null;
        updateData.despues_dias = null;
      }
      
      logger.dev('📋 Tipo de terminación detectado:', updateData.terminacion_tipo);
      
      // Añadir campos según tipo de periodicidad
      if (formEdicion.tipo === 'diaria') {
        // Si "Una vez al día" está activo, usar ese modo
        updateData.daily_mode = unaVezAlDia ? 'una_vez_dia' : formEdicion.dailyMode;
        updateData.cada_dias = formEdicion.cadaDias;
        updateData.rango_desde = formEdicion.rangoDesde;
        updateData.rango_hasta = formEdicion.rangoHasta;
        updateData.hora_una_vez_dia = unaVezAlDia ? horaUnaVez : formEdicion.horaUnaVezDia;
        
        // ✅ FIX: Limpiar campos de otros tipos
        updateData.weekly_mode = null;
        updateData.weekly_days = null;
        updateData.weekly_rango_desde = null;
        updateData.weekly_rango_hasta = null;
        updateData.weekly_hora_una_vez = null;
        updateData.annual_date = null;
        updateData.annual_time = null;
        
      } else if (formEdicion.tipo === 'semanal') {
        // ✅ FIX: Semanal puede tener modo 'rango' o 'una_vez_dia'
        updateData.weekly_mode = unaVezAlDia ? 'una_vez_dia' : 'rango';
        
        // ✅ FIX: Convertir días de español a inglés para guardar en BD
        const mapeoDiasEspañolIngles = {
          'lunes': 'mon',
          'martes': 'tue',
          'miercoles': 'wed',
          'jueves': 'thu',
          'viernes': 'fri',
          'sabado': 'sat',
          'domingo': 'sun'
        };
        
        const weeklyDaysIngles = Array.isArray(formEdicion.weeklyDays)
          ? formEdicion.weeklyDays.map(dia => {
              const diaLower = dia.toLowerCase().trim();
              return mapeoDiasEspañolIngles[diaLower] || dia;
            })
          : formEdicion.weeklyDays;
        
        updateData.weekly_days = weeklyDaysIngles;
        
        logger.dev('📅 Días convertidos para guardar:', {
          español: formEdicion.weeklyDays,
          ingles: weeklyDaysIngles
        });
        if (unaVezAlDia) {
          // Si es "Una vez al día", usar horaUnaVez
          updateData.weekly_hora_una_vez = horaUnaVez;
          updateData.weekly_rango_desde = null;
          updateData.weekly_rango_hasta = null;
        } else {
          // Si es rango horario, usar los rangos
          updateData.weekly_rango_desde = formEdicion.weeklyRangoDesde;
          updateData.weekly_rango_hasta = formEdicion.weeklyRangoHasta;
          updateData.weekly_hora_una_vez = null;
        }
        
        // ✅ FIX: Limpiar campos de otros tipos
        updateData.daily_mode = null;
        updateData.cada_dias = null;
        updateData.rango_desde = null;
        updateData.rango_hasta = null;
        updateData.hora_una_vez_dia = null;
        updateData.annual_date = null;
        updateData.annual_time = null;
        
      } else if (formEdicion.tipo === 'anual') {
        updateData.annual_date = formEdicion.annualDate;
        // ✅ FIX: Si frecuencia es "Una vez a las...", no guardar annual_time (se usa horaUnaVez)
        updateData.annual_time = unaVezAlDia ? null : formEdicion.annualTime;
        
        // ✅ FIX: Limpiar campos de otros tipos
        updateData.daily_mode = null;
        updateData.cada_dias = null;
        updateData.rango_desde = null;
        updateData.rango_hasta = null;
        updateData.hora_una_vez_dia = null;
        updateData.weekly_mode = null;
        updateData.weekly_days = null;
        updateData.weekly_rango_desde = null;
        updateData.weekly_rango_hasta = null;
        updateData.weekly_hora_una_vez = null;
      }
      
      let programacionId;
      
      if (esModoCreacion) {
        // 🔧 NUEVO: Crear nueva programación
        updateData.created_by = adminId;
        updateData.estado = 'activo';
        
        const { data: nuevaProgramacion, error: errorCreate } = await supabase
          .from('programaciones')
          .insert(updateData)
          .select()
          .single();
        
        if (errorCreate) throw errorCreate;
        programacionId = nuevaProgramacion.id;
        logger.dev('✅ Programación creada:', programacionId);
      } else {
        // Actualizar programación existente
        const { error: errorUpdate } = await supabase
          .from('programaciones')
          .update(updateData)
          .eq('id', programacionEditando.id);
        
        if (errorUpdate) throw errorUpdate;
        programacionId = programacionEditando.id;
      }
      
      // Actualizar destinatarios
      if (!esModoCreacion) {
        // 1. Eliminar destinatarios actuales (solo en edición)
        const { error: errorDeleteDest } = await supabase
          .from('programacion_destinatarios')
          .delete()
          .eq('programacion_id', programacionId);
        
        if (errorDeleteDest) throw errorDeleteDest;
      }
      
      // 2. Insertar nuevos destinatarios
      const nuevosDestinatarios = usuariosSeleccionados.map(userId => ({
        programacion_id: programacionId,
        tipo: 'usuario',
        usuario_id: userId,
        activo: true
      }));
      
      const { error: errorInsertDest } = await supabase
        .from('programacion_destinatarios')
        .insert(nuevosDestinatarios);
      
      if (errorInsertDest) throw errorInsertDest;
      
      // Actualizar contenidos
      if (!esModoCreacion) {
        // 1. Eliminar contenidos actuales (solo en edición)
        const { error: errorDeleteCont } = await supabase
          .from('programacion_contenidos')
          .delete()
          .eq('programacion_id', programacionId);
        
        if (errorDeleteCont) throw errorDeleteCont;
      }
      
      // 2. Insertar nuevos contenidos
      if (contenidosSeleccionados.length > 0) {
        const nuevosContenidos = contenidosSeleccionados.map((contenidoId, index) => ({
          programacion_id: programacionId,
          contenido_id: contenidoId,
          orden: index,
          activo: true
        }));
        
        const { error: errorInsertCont } = await supabase
          .from('programacion_contenidos')
          .insert(nuevosContenidos);
        
        if (errorInsertCont) throw errorInsertCont;
      }
      
      logger.dev(`✅ Programación ${esModoCreacion ? 'creada' : 'actualizada'} correctamente`);
      alert(`✅ Programación ${esModoCreacion ? 'creada' : 'actualizada'} exitosamente`);
      
      cerrarModalEdicion();
      cargarProgramaciones();
      
    } catch (error) {
      logger.error('❌ Error guardando edición:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const toggleGrupoExpandido = (grupoId) => {
    setGruposExpandidos(prev => 
      prev.includes(grupoId) 
        ? prev.filter(id => id !== grupoId)
        : [...prev, grupoId]
    );
  };
  
  const toggleUsuarioSeleccionado = (usuarioId) => {
    setUsuariosSeleccionados(prev => 
      prev.includes(usuarioId)
        ? prev.filter(id => id !== usuarioId)
        : [...prev, usuarioId]
    );
  };
  
  const toggleTodosUsuariosGrupo = (grupoId, usuarios) => {
    const usuarioIds = usuarios.map(u => u.id);
    const todosSeleccionados = usuarioIds.every(id => usuariosSeleccionados.includes(id));
    
    if (todosSeleccionados) {
      setUsuariosSeleccionados(prev => prev.filter(id => !usuarioIds.includes(id)));
    } else {
      setUsuariosSeleccionados(prev => [...new Set([...prev, ...usuarioIds])]);
    }
  };
  
  const getUsuariosSeleccionadosDeGrupo = (usuarios) => {
    if (!usuarios) return 0;
    return usuarios.filter(u => usuariosSeleccionados.includes(u.id)).length;
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Formatear hora
  const formatearHora = (hora) => {
    if (!hora) return '';
    return hora.substring(0, 5); // HH:MM
  };

  // Obtener info de periodicidad
  const getPeriodicidadTexto = (prog) => {
    if (prog.tipo === 'diaria') {
      if (prog.daily_mode === 'cada') {
        return `Cada ${prog.cada_dias} día(s), ${formatearHora(prog.rango_desde)}-${formatearHora(prog.rango_hasta)}`;
      } else if (prog.daily_mode === 'laborales') {
        return `Días laborables, ${formatearHora(prog.rango_desde)}-${formatearHora(prog.rango_hasta)}`;
      } else if (prog.daily_mode === 'una_vez_dia') {
        return `Una vez a las ${formatearHora(prog.hora_una_vez_dia)}`;
      }
    } else if (prog.tipo === 'semanal') {
      const dias = prog.weekly_days?.join(', ') || 'días seleccionados';
      return `Semanal: ${dias}`;
    } else if (prog.tipo === 'anual') {
      return `Anual: ${prog.annual_date} a las ${formatearHora(prog.annual_time)}`;
    }
    return prog.tipo;
  };
  
  // ✅ FIX: Obtener texto de frecuencia (solo si aplica)
  const getFrecuenciaTexto = (prog) => {
    // Si es "una vez al día", no mostrar frecuencia
    if (prog.tipo === 'diaria' && prog.daily_mode === 'una_vez_dia') {
      return null;
    }
    // Si frecuencia_minutos es null, no mostrar
    if (!prog.frecuencia_minutos) {
      return null;
    }
    return `(cada ${prog.frecuencia_minutos} min)`;
  };

  // Obtener icono de estado
  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'activo':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pausado':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completado':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'cancelado':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  // Contar programaciones por estado
  const contarPorEstado = (estado) => {
    if (estado === 'todos') return programaciones.length;
    return programaciones.filter(p => p.estado === estado).length;
  };

  // Filtrar programaciones por búsqueda
  const programacionesFiltradas = programaciones.filter(prog => {
    if (!searchQuery) return true;
    return prog.descripcion?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Listado de programaciones</h1>
            <p className="text-muted-foreground mt-1">Gestiona todas las programaciones activas de tu empresa</p>
          </div>
          <Button
            onClick={cargarProgramaciones}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
        </div>

        {/* Buscador */}
        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en la plataforma..."
            className="flex-1 px-4 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
          />
        </div>

        {/* Filtros por estado */}
        <div className="flex gap-3">
          <button
            onClick={() => setFiltroEstado('todos')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filtroEstado === 'todos'
                ? 'bg-primary text-white'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            Todos <span className="ml-2 opacity-70">{contarPorEstado('todos')}</span>
          </button>
          <button
            onClick={() => setFiltroEstado('activo')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              filtroEstado === 'activo'
                ? 'bg-green-600 text-white'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Activas <span className="ml-2 opacity-70">{contarPorEstado('activo')}</span>
          </button>
          <button
            onClick={() => setFiltroEstado('completado')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filtroEstado === 'completado'
                ? 'bg-blue-600 text-white'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            Completadas <span className="ml-2 opacity-70">{contarPorEstado('completado')}</span>
          </button>
          <button
            onClick={() => setFiltroEstado('pausado')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              filtroEstado === 'pausado'
                ? 'bg-yellow-600 text-white'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            Pausadas <span className="ml-2 opacity-70">{contarPorEstado('pausado')}</span>
          </button>
        </div>

        {/* Lista de programaciones */}
        {isLoading ? (
          <Card className="p-12">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p>Cargando programaciones...</p>
            </div>
          </Card>
        ) : programacionesFiltradas.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center text-center space-y-4">
              <Calendar className="w-16 h-16 text-muted-foreground opacity-30" />
              <h3 className="text-xl font-semibold">No hay programaciones</h3>
              <p className="text-muted-foreground max-w-md">
                {filtroEstado === 'todos' 
                  ? 'Aún no has creado ninguna programación.'
                  : `No hay programaciones en estado "${filtroEstado}".`
                }
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {programacionesFiltradas.map((prog) => (
              <motion.div
                key={prog.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-4">
                      {/* Título y estado */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          {editandoId === prog.id ? (
                            <div className="flex items-center gap-2 mb-1">
                              <input
                                type="text"
                                value={nuevoNombre}
                                onChange={(e) => setNuevoNombre(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 border-2 border-primary text-lg font-semibold"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') guardarNombreProgramacion(prog.id);
                                  if (e.key === 'Escape') cancelarEdicion();
                                }}
                              />
                              <Button
                                onClick={() => guardarNombreProgramacion(prog.id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={cancelarEdicion}
                                size="sm"
                                variant="outline"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <h3 className="text-xl font-semibold mb-1">
                              {prog.descripcion || 'Sin descripción'}
                            </h3>
                          )}
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Creado por: {prog.creadorNombre || 'Sistema'}
                            </p>
                            {prog.modificadorNombre && (
                              <p className="text-sm text-muted-foreground">
                                Modificado por: {prog.modificadorNombre}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getEstadoIcon(prog.estado)}
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            prog.estado === 'activo' ? 'bg-green-500/10 text-green-600' :
                            prog.estado === 'pausado' ? 'bg-yellow-500/10 text-yellow-600' :
                            prog.estado === 'completado' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-gray-500/10 text-gray-600'
                          }`}>
                            {prog.estado}
                          </span>
                        </div>
                      </div>

                      {/* Información de la programación */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Periodicidad</p>
                            <p className="text-sm font-medium">{getPeriodicidadTexto(prog)}</p>
                            {getFrecuenciaTexto(prog) && (
                              <p className="text-xs text-muted-foreground">
                                {getFrecuenciaTexto(prog)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Desde</p>
                            <p className="text-sm font-medium">{formatearFecha(prog.fecha_inicio)}</p>
                            <p className="text-xs text-muted-foreground">
                              hasta {prog.fecha_fin ? formatearFecha(prog.fecha_fin) : '10 nov 2025'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Modo audio</p>
                            <p className="text-sm font-medium capitalize">
                              {prog.modo_audio === 'fade_out' ? 'Fade Out/In' : 
                               prog.modo_audio === 'background' ? 'Música de fondo' : 
                               prog.modo_audio === 'esperar_cancion' ? 'Esperar canción' :
                               'Música de fondo'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Destinatarios</p>
                            <p className="text-sm font-medium">
                              {prog.cantidadContenidos || 0} contenido{prog.cantidadContenidos !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {prog.cantidadUsuarios || 0} usuarios
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ID de programación */}
                      <p className="text-xs text-muted-foreground">
                        ID: {prog.id.substring(0, 8)}... • Tipo: {prog.tipo}
                      </p>
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        onClick={() => handlePausarProgramacion(prog.id, prog.estado)}
                        variant="outline"
                        size="sm"
                        className={`gap-2 ${prog.estado === 'completado' ? 'opacity-60' : ''}`}
                      >
                        {prog.estado === 'pausado' || prog.estado === 'completado' ? (
                          <>
                            <Play className="w-4 h-4" />
                            Activar
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4" />
                            Pausar
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => abrirModalEdicion(prog)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </Button>
                      
                      <Button
                        onClick={() => handleEliminarProgramacion(prog.id, prog.descripcion)}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN COMPLETA */}
      {modalEditarAbierto && formEdicion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold">
                  {programacionEditando ? 'Editar Programación' : 'Crear Nueva Programación'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {programacionEditando 
                    ? 'Modifica los campos que desees actualizar'
                    : 'Completa los datos para crear una nueva programación'}
                </p>
              </div>
              <Button
                onClick={cerrarModalEdicion}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Cerrar
              </Button>
            </div>

            {/* Tabs de navegación */}
            <div className="border-b border-border">
              <div className="flex gap-1 px-6">
                <button
                  onClick={() => setTabActivo(1)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                    tabActivo === 1
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  1. Contenido
                </button>
                <button
                  onClick={() => setTabActivo(2)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                    tabActivo === 2
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  2. Destinatarios
                </button>
                <button
                  onClick={() => setTabActivo(3)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                    tabActivo === 3
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  3. Configuración
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* TAB 1: CONTENIDO */}
              {tabActivo === 1 && (
                <div className="space-y-6">
              {/* Nombre de la programación */}
              <div>
                <label className="text-sm font-medium mb-2 block">Nombre de la programación *</label>
                <input
                  type="text"
                  value={formEdicion.nombre}
                  onChange={(e) => setFormEdicion({...formEdicion, nombre: e.target.value})}
                  placeholder="Ej: Promoción Black Friday"
                  className="w-full p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                />
              </div>

                  {/* Selector de contenidos */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">
                      Contenidos asignados ({contenidosSeleccionados.length} seleccionado{contenidosSeleccionados.length !== 1 ? 's' : ''})
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Selecciona los contenidos que se reproducirán en esta programación
                    </p>
                    
                    {contenidosDisponibles.length > 0 ? (
                      <div className="border rounded-lg max-h-64 overflow-y-auto">
                        {/* Ordenar: seleccionados primero, luego no seleccionados */}
                        {[...contenidosDisponibles]
                          .sort((a, b) => {
                            const aSelected = contenidosSeleccionados.includes(a.id);
                            const bSelected = contenidosSeleccionados.includes(b.id);
                            if (aSelected && !bSelected) return -1;
                            if (!aSelected && bSelected) return 1;
                            return 0;
                          })
                          .map(contenido => {
                          const isSelected = contenidosSeleccionados.includes(contenido.id);
                          return (
                            <label
                              key={contenido.id}
                              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                                isSelected 
                                  ? 'bg-primary/10 hover:bg-primary/15' 
                                  : 'hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setContenidosSeleccionados(prev => 
                                    isSelected 
                                      ? prev.filter(id => id !== contenido.id)
                                      : [...prev, contenido.id]
                                  );
                                }}
                                className="rounded"
                              />
                              <FileText className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm truncate ${isSelected ? 'font-medium' : ''}`}>
                                  {contenido.nombre}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="capitalize">{contenido.tipo_contenido}</span>
                                  {contenido.duracion_segundos && (
                                    <>
                                      <span>•</span>
                                      <span>{contenido.duracion_segundos}s</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-muted/30 rounded-lg p-4 border border-muted text-center">
                        <p className="text-sm text-muted-foreground">No hay contenidos disponibles</p>
                        <p className="text-xs text-muted-foreground mt-1">Los contenidos deben estar asignados a tu marca</p>
                      </div>
                    )}
                  </div>

                  {/* Botones de navegación y guardar */}
                  <div className="flex justify-between pt-4 border-t">
                    <div className="flex gap-2">
                      <Button
                        onClick={cerrarModalEdicion}
                        variant="outline"
                        disabled={isSaving}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={guardarEdicionCompleta}
                        disabled={isSaving || !formEdicion.nombre.trim() || contenidosSeleccionados.length === 0 || usuariosSeleccionados.length === 0}
                        variant="outline"
                        className="gap-2"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Guardar Cambios
                          </>
                        )}
                      </Button>
                    </div>
                    <Button 
                      onClick={() => setTabActivo(2)} 
                      disabled={contenidosSeleccionados.length === 0}
                      className="gap-2"
                    >
                      Siguiente: Destinatarios
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: DESTINATARIOS */}
              {tabActivo === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-3 block">Destinatarios ({usuariosSeleccionados.length} seleccionados)</label>
                    {gruposDisponibles.length > 0 ? (
                      <div className="space-y-2">
                        {gruposDisponibles.map(grupo => {
                          const usuarios = gruposConUsuarios[grupo.id] || [];
                          const isExpanded = gruposExpandidos.includes(grupo.id);
                          const usuariosSeleccionadosGrupo = getUsuariosSeleccionadosDeGrupo(usuarios);
                          const todosSeleccionados = usuarios.length > 0 && usuariosSeleccionadosGrupo === usuarios.length;
                          const algunosSeleccionados = usuariosSeleccionadosGrupo > 0 && !todosSeleccionados;
                          
                          return (
                            <div key={grupo.id} className="border rounded-lg overflow-hidden">
                              <div className="flex items-center gap-2 p-3 bg-black/5 dark:bg-white/5">
                                <input
                                  type="checkbox"
                                  checked={todosSeleccionados}
                                  ref={(el) => {
                                    if (el) el.indeterminate = algunosSeleccionados;
                                  }}
                                  onChange={() => toggleTodosUsuariosGrupo(grupo.id, usuarios)}
                                  className="rounded"
                                />
                                <button
                                  onClick={() => toggleGrupoExpandido(grupo.id)}
                                  className="flex-1 flex items-center justify-between text-left"
                                >
                                  <span className="text-sm font-medium">{grupo.nombre}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {usuariosSeleccionadosGrupo > 0 && (
                                        <span className="text-primary font-semibold">{usuariosSeleccionadosGrupo}/</span>
                                      )}
                                      {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
                                    </span>
                                    <ArrowRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  </div>
                                </button>
                              </div>
                              
                              {isExpanded && usuarios.length > 0 && (
                                <div className="p-3 space-y-2 bg-black/2 dark:bg-white/2">
                                  {usuarios.map(usuario => {
                                    const establecimiento = usuario.empresas?.razon_social || 'Sin establecimiento';
                                    const nombreUsuario = usuario.username || usuario.email || usuario.nombre || 'Usuario';
                                    const isSelected = usuariosSeleccionados.includes(usuario.id);
                                    
                                    return (
                                      <label 
                                        key={usuario.id} 
                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                          isSelected 
                                            ? 'bg-primary/10 border border-primary/30' 
                                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleUsuarioSeleccionado(usuario.id)}
                                          className="rounded"
                                        />
                                        <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-sm flex-1">
                                          <span className={isSelected ? 'font-medium' : ''}>{nombreUsuario}</span>
                                          <span className="text-muted-foreground"> - {establecimiento}</span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay grupos disponibles</p>
                    )}
                  </div>

                  {/* Botones de navegación y guardar */}
                  <div className="flex justify-between pt-4 border-t">
                    <Button onClick={() => setTabActivo(1)} variant="outline" className="gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        onClick={guardarEdicionCompleta}
                        disabled={isSaving || !formEdicion.nombre.trim() || contenidosSeleccionados.length === 0 || usuariosSeleccionados.length === 0}
                        variant="outline"
                        className="gap-2"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Guardar Cambios
                          </>
                        )}
                      </Button>
                      <Button onClick={() => setTabActivo(3)} className="gap-2">
                        Siguiente: Configuración
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CONFIGURACIÓN */}
              {tabActivo === 3 && (
                <div className="space-y-6">
              {/* Fechas y horas */}
              <div>
                <label className="text-sm font-medium mb-3 block">Periodo de programación</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Fecha de inicio *</label>
                    <input
                      type="date"
                      value={formEdicion.fechaInicio}
                      onChange={(e) => setFormEdicion({...formEdicion, fechaInicio: e.target.value})}
                      className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Hora de inicio *</label>
                    <input
                      type="time"
                      value={formEdicion.horaInicio}
                      onChange={(e) => setFormEdicion({...formEdicion, horaInicio: e.target.value})}
                      className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Fecha de fin (opcional)</label>
                    <input
                      type="date"
                      value={formEdicion.fechaFin}
                      onChange={(e) => setFormEdicion({...formEdicion, fechaFin: e.target.value})}
                      className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Hora de fin</label>
                    <input
                      type="time"
                      value={formEdicion.horaFin}
                      onChange={(e) => setFormEdicion({...formEdicion, horaFin: e.target.value})}
                      className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                    />
                  </div>
                </div>
              </div>

              {/* 🔧 NUEVO: Frecuencia y Periodicidad unidos en dos columnas */}
              <div className="space-y-4">
                <label className="text-sm font-semibold mb-4 block">Frecuencia y Periodicidad</label>
                <div className="grid grid-cols-2 gap-6">
                  {/* COLUMNA 1: Frecuencia de reproducción */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-4 bg-primary rounded-full"></div>
                      <label className="text-sm font-semibold">Frecuencia de reproducción</label>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Opción: Cada X minutos */}
                      <label className={`group flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        !unaVezAlDia
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/30 bg-background'
                      }`}>
                        <input
                          type="radio"
                          checked={!unaVezAlDia}
                          onChange={() => {
                            setUnaVezAlDia(false);
                          }}
                          className="mt-1 rounded-full w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${!unaVezAlDia ? 'text-primary' : 'text-muted-foreground'}`}>
                              Repetición periódica
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Cada</span>
                            <input
                              type="number"
                              min="1"
                              max="1440"
                              value={formEdicion.frecuenciaMinutos}
                              onChange={(e) => setFormEdicion({...formEdicion, frecuenciaMinutos: parseInt(e.target.value)})}
                              disabled={unaVezAlDia}
                              className="w-16 p-1.5 rounded-md bg-background border border-input text-sm text-center font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary/20"
                            />
                            <span className="text-xs text-muted-foreground">minutos</span>
                          </div>
                        </div>
                      </label>

                      {/* Opción: Una vez a las... */}
                      {/* ✅ FIX: Permitir "Una vez al día" para diaria y semanal (no anual) */}
                      <label className={`group flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                        formEdicion.tipo === 'anual'
                          ? 'opacity-50 cursor-not-allowed border-border bg-muted/20'
                          : unaVezAlDia
                            ? 'border-primary bg-primary/5 shadow-sm cursor-pointer'
                            : 'border-border hover:border-primary/30 bg-background cursor-pointer'
                      }`}>
                        <input
                          type="radio"
                          checked={unaVezAlDia && formEdicion.tipo !== 'anual'}
                          disabled={formEdicion.tipo === 'anual'}
                          onChange={() => {
                            if (formEdicion.tipo === 'anual') return;
                            setUnaVezAlDia(true);
                            // Si tienen "esperar_cancion", cambiar a "background"
                            if (formEdicion.modoAudio === 'esperar_cancion') {
                              setFormEdicion({...formEdicion, modoAudio: 'background'});
                              alert('⚠️ El modo "Esperar a que acabe la canción" no es compatible con "Una vez al día".\n\nSe ha cambiado automáticamente a "Música de fondo".');
                            }
                          }}
                          className="mt-1 rounded-full w-4 h-4 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${unaVezAlDia ? 'text-primary' : 'text-muted-foreground'}`}>
                              Una vez al día
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">A las</span>
                            <input
                              type="time"
                              value={horaUnaVez}
                              onChange={(e) => setHoraUnaVez(e.target.value)}
                              disabled={!unaVezAlDia || formEdicion.tipo === 'anual'}
                              className="w-24 p-1.5 rounded-md bg-background border border-input text-sm text-center font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Resumen */}
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs font-medium text-foreground">
                        {unaVezAlDia && formEdicion.tipo !== 'anual'
                          ? `📅 Se reproducirá una vez al día a las ${horaUnaVez}`
                          : `🔄 Se reproducirá cada ${formEdicion.frecuenciaMinutos} minutos`
                        }
                      </p>
                    </div>
                  </div>

                  {/* COLUMNA 2: Periodicidad */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-4 bg-primary rounded-full"></div>
                      <label className="text-sm font-semibold">Periodicidad</label>
                    </div>
                
                    {/* Tabs de periodicidad */}
                    <div className="flex gap-2 mb-4 p-1 rounded-lg bg-muted/30 border border-border">
                      <button
                        onClick={() => {
                          setFormEdicion({...formEdicion, tipo: 'diaria'});
                          // ✅ FIX: Si cambiamos a diaria, mantener el estado actual de unaVezAlDia
                          // (no resetear, porque podría estar editando una programación diaria con una_vez_dia)
                        }}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                          formEdicion.tipo === 'diaria'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        Diaria
                      </button>
                      <button
                        onClick={() => {
                          setFormEdicion({...formEdicion, tipo: 'semanal'});
                          // ✅ FIX: Mantener unaVezAlDia si estaba activo (también aplica a semanal)
                        }}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                          formEdicion.tipo === 'semanal'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        Semanal
                      </button>
                      <button
                        onClick={() => {
                          setFormEdicion({...formEdicion, tipo: 'anual'});
                          // ✅ FIX: Si cambiamos a anual, mantener unaVezAlDia (puede usarse para hora específica)
                          // Pero si estaba en true y cambiamos a anual, podría causar confusión
                          // Por ahora, lo mantenemos para que el usuario pueda configurarlo manualmente
                        }}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                          formEdicion.tipo === 'anual'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        Anual
                      </button>
                    </div>

                    {/* Configuración DIARIA */}
                    {formEdicion.tipo === 'diaria' && (
                      <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
                        <div className="space-y-3">
                          <label className={`group flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formEdicion.dailyMode === 'cada'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30 bg-background'
                          }`}>
                            <input
                              type="radio"
                              checked={formEdicion.dailyMode === 'cada'}
                              onChange={() => setFormEdicion({...formEdicion, dailyMode: 'cada'})}
                              className="mt-0.5 rounded-full w-4 h-4"
                            />
                            <div className="flex-1">
                              <div className="text-xs font-medium mb-2">Cada X días</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">Cada</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  value={formEdicion.cadaDias}
                                  onChange={(e) => setFormEdicion({
                                    ...formEdicion,
                                    cadaDias: parseInt(e.target.value)
                                  })}
                                  disabled={formEdicion.dailyMode !== 'cada' || unaVezAlDia}
                                  className="w-14 p-1.5 rounded-md bg-background border border-input text-xs text-center font-medium disabled:opacity-50 focus:ring-2 focus:ring-primary/20"
                                />
                                <span className="text-xs text-muted-foreground">día(s)</span>
                                {/* 🔧 NUEVO: Ocultar opciones temporales si frecuencia es "Una vez a las..." */}
                                {!unaVezAlDia && (
                                  <>
                                    <span className="text-xs text-muted-foreground">entre las</span>
                                    <input
                                      type="time"
                                      value={formEdicion.rangoDesde}
                                      onChange={(e) => setFormEdicion({
                                        ...formEdicion,
                                        rangoDesde: e.target.value
                                      })}
                                      disabled={formEdicion.dailyMode !== 'cada' || unaVezAlDia}
                                      className="w-20 p-1.5 rounded-md bg-background border border-input text-xs text-center disabled:opacity-50 focus:ring-2 focus:ring-primary/20"
                                    />
                                    <span className="text-xs text-muted-foreground">y las</span>
                                    <input
                                      type="time"
                                      value={formEdicion.rangoHasta}
                                      onChange={(e) => setFormEdicion({
                                        ...formEdicion,
                                        rangoHasta: e.target.value
                                      })}
                                      disabled={formEdicion.dailyMode !== 'cada' || unaVezAlDia}
                                      className="w-20 p-1.5 rounded-md bg-background border border-input text-xs text-center disabled:opacity-50 focus:ring-2 focus:ring-primary/20"
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          </label>

                          <label className={`group flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formEdicion.dailyMode === 'laborales'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30 bg-background'
                          }`}>
                            <input
                              type="radio"
                              checked={formEdicion.dailyMode === 'laborales'}
                              onChange={() => setFormEdicion({...formEdicion, dailyMode: 'laborales'})}
                              className="mt-0.5 rounded-full w-4 h-4"
                            />
                            <div className="flex-1">
                              <div className="text-xs font-medium mb-1">Días laborables</div>
                              <span className="text-xs text-muted-foreground">
                                Lunes a viernes
                                {/* 🔧 NUEVO: Ocultar horas si frecuencia es "Una vez a las..." */}
                                {!unaVezAlDia && (
                                  <> • {formEdicion.rangoDesde} - {formEdicion.rangoHasta}</>
                                )}
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Configuración SEMANAL */}
                    {formEdicion.tipo === 'semanal' && (
                      <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border">
                        <div>
                          <label className="text-xs font-semibold mb-3 block">Días de la semana</label>
                          <div className="flex flex-wrap gap-2">
                            {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(dia => (
                              <label key={dia} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 cursor-pointer transition-all ${
                                formEdicion.weeklyDays.includes(dia)
                                  ? 'border-primary bg-primary/10 text-primary font-medium'
                                  : 'border-border hover:border-primary/50 bg-background'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={formEdicion.weeklyDays.includes(dia)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormEdicion({
                                        ...formEdicion,
                                        weeklyDays: [...formEdicion.weeklyDays, dia]
                                      });
                                    } else {
                                      setFormEdicion({
                                        ...formEdicion,
                                        weeklyDays: formEdicion.weeklyDays.filter(d => d !== dia)
                                      });
                                    }
                                  }}
                                  className="rounded w-3.5 h-3.5"
                                />
                                <span className="text-xs capitalize">{dia}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 🔧 NUEVO: Solo mostrar rango horario (eliminada opción "Una vez al día") */}
                        {!unaVezAlDia && (
                          <div className="pt-2 border-t border-border">
                            <label className={`group flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              formEdicion.weeklyMode === 'rango'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30 bg-background'
                            }`}>
                              <input
                                type="radio"
                                checked={formEdicion.weeklyMode === 'rango'}
                                onChange={() => setFormEdicion({...formEdicion, weeklyMode: 'rango'})}
                                className="mt-0.5 rounded-full w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="text-xs font-medium mb-2">Rango horario</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">Entre las</span>
                                  <input
                                    type="time"
                                    value={formEdicion.weeklyRangoDesde}
                                    onChange={(e) => setFormEdicion({
                                      ...formEdicion,
                                      weeklyRangoDesde: e.target.value
                                    })}
                                    disabled={formEdicion.weeklyMode !== 'rango'}
                                    className="w-20 p-1.5 rounded-md bg-background border border-input text-xs text-center disabled:opacity-50 focus:ring-2 focus:ring-primary/20"
                                  />
                                  <span className="text-xs text-muted-foreground">y las</span>
                                  <input
                                    type="time"
                                    value={formEdicion.weeklyRangoHasta}
                                    onChange={(e) => setFormEdicion({
                                      ...formEdicion,
                                      weeklyRangoHasta: e.target.value
                                    })}
                                    disabled={formEdicion.weeklyMode !== 'rango'}
                                    className="w-20 p-1.5 rounded-md bg-background border border-input text-xs text-center disabled:opacity-50 focus:ring-2 focus:ring-primary/20"
                                  />
                                </div>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Configuración ANUAL */}
                    {formEdicion.tipo === 'anual' && (
                      <div className="p-4 rounded-xl bg-muted/30 border border-border">
                        <div className="space-y-3">
                          <div className="text-xs font-semibold mb-2">Fecha específica</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">El día</span>
                            <input
                              type="text"
                              value={formEdicion.annualDate}
                              onChange={(e) => setFormEdicion({
                                ...formEdicion,
                                annualDate: e.target.value
                              })}
                              placeholder="dd/mm"
                              maxLength="5"
                              className="w-24 p-2 rounded-md bg-background border border-input text-xs text-center font-medium focus:ring-2 focus:ring-primary/20"
                            />
                            {/* 🔧 NUEVO: Ocultar hora si frecuencia es "Una vez a las..." */}
                            {!unaVezAlDia && (
                              <>
                                <span className="text-xs text-muted-foreground">a las</span>
                                <input
                                  type="time"
                                  value={formEdicion.annualTime}
                                  onChange={(e) => setFormEdicion({
                                    ...formEdicion,
                                    annualTime: e.target.value
                                  })}
                                  className="w-24 p-2 rounded-md bg-background border border-input text-xs text-center focus:ring-2 focus:ring-primary/20"
                                />
                              </>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                            📅 Formato: dd/mm (Ej: 25/12 para Navidad)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modo de Audio */}
              <div>
                <label className="text-sm font-medium mb-3 block">Modo de audio</label>
                <p className="text-xs text-muted-foreground mb-3">
                  Selecciona cómo se reproducirá el anuncio respecto a la música actual
                </p>
                
                {/* 🔧 NUEVO: Aviso si hay contenido IA */}
                {hayContenidoIA && (
                  <div className="mb-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      ℹ️ Contenido de IA detectado. El modo de audio se ha establecido automáticamente en "Música de fondo".
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  {/* Fade Out/In */}
                  <button
                    onClick={() => {
                      if (hayContenidoIA) {
                        alert('⚠️ Los contenidos de IA solo pueden reproducirse con modo "Música de fondo".');
                        return;
                      }
                      setFormEdicion({...formEdicion, modoAudio: 'fade_out'});
                    }}
                    disabled={hayContenidoIA}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      formEdicion.modoAudio === 'fade_out'
                        ? 'border-primary bg-primary/5'
                        : hayContenidoIA
                        ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={formEdicion.modoAudio === 'fade_out'}
                        onChange={() => {
                          if (!hayContenidoIA) {
                            setFormEdicion({...formEdicion, modoAudio: 'fade_out'});
                          }
                        }}
                        disabled={hayContenidoIA}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium mb-1">
                          Fade Out/In
                          {hayContenidoIA && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(No disponible para IA)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          La música baja gradualmente de volumen, se reproduce el anuncio, y luego la música vuelve a subir
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Música de fondo */}
                  <button
                    onClick={() => setFormEdicion({...formEdicion, modoAudio: 'background'})}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      formEdicion.modoAudio === 'background'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={formEdicion.modoAudio === 'background'}
                        onChange={() => setFormEdicion({...formEdicion, modoAudio: 'background'})}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium mb-1">Música de fondo</div>
                        <div className="text-xs text-muted-foreground">
                          El anuncio se reproduce sobre la música actual a bajo volumen de fondo
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Esperar a que acabe la canción */}
                  <button
                    onClick={() => {
                      // Validar si estamos en modo "Una vez al día" o hay contenido IA
                      if (unaVezAlDia || hayContenidoIA) {
                        const motivo = unaVezAlDia 
                          ? 'frecuencia "Una vez al día"'
                          : 'contenido de IA';
                        alert(`⚠️ El modo "Esperar a que acabe la canción" no está disponible con ${motivo}.\n\nPor favor, selecciona otro modo de audio o cambia la configuración.`);
                        return;
                      }
                      setFormEdicion({...formEdicion, modoAudio: 'esperar_cancion'});
                    }}
                    disabled={unaVezAlDia || hayContenidoIA}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      formEdicion.modoAudio === 'esperar_cancion'
                        ? 'border-primary bg-primary/5'
                        : (unaVezAlDia || hayContenidoIA)
                        ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={formEdicion.modoAudio === 'esperar_cancion'}
                        onChange={() => {
                          if (!unaVezAlDia && !hayContenidoIA) {
                            setFormEdicion({...formEdicion, modoAudio: 'esperar_cancion'});
                          }
                        }}
                        disabled={unaVezAlDia || hayContenidoIA}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium mb-1">
                          Esperar a que acabe la canción
                          {(unaVezAlDia || hayContenidoIA) && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(No disponible)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          El anuncio espera a que termine la canción actual antes de reproducirse
                          {unaVezAlDia && (
                            <span className="block mt-1 text-yellow-600 dark:text-yellow-500">
                              No compatible con frecuencia "Una vez al día"
                            </span>
                          )}
                          {hayContenidoIA && !unaVezAlDia && (
                            <span className="block mt-1 text-yellow-600 dark:text-yellow-500">
                              No compatible con contenido de IA
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

                  {/* Botones de navegación y acción */}
                  <div className="flex justify-between pt-4 border-t sticky bottom-0 bg-background">
                    <Button onClick={() => setTabActivo(2)} variant="outline" className="gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <div className="flex gap-2">
                <Button
                  onClick={cerrarModalEdicion}
                  variant="outline"
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={guardarEdicionCompleta}
                        disabled={isSaving || !formEdicion.nombre.trim() || contenidosSeleccionados.length === 0 || usuariosSeleccionados.length === 0}
                        className="gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
      <Toaster />
    </AdminLayout>
  );
};

export default ProgramacionesPage;

