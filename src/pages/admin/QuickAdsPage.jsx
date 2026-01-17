import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Megaphone, 
  Send, 
  Clock,
  Users,
  MessageSquare,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  PlayCircle,
  Calendar,
  Mic,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Volume2,
  Edit,
  Check,
  X,
  FileText,
  Settings
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AudioPlayer from '@/components/ui/AudioPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { convertToCloudFrontUrl } from '@/lib/cloudfrontUrls.js';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import logger from '@/lib/logger';
import aiAdService from '@/services/aiAdService';

/**
 * Extrae palabras clave relevantes de un texto
 * @param {string} texto - Texto del que extraer palabras clave
 * @param {number} maxPalabras - Número máximo de palabras a extraer
 * @returns {string} - Palabras clave concatenadas
 */
const extraerPalabrasClave = (texto, maxPalabras = 4) => {
  if (!texto) return '';
  
  // Palabras comunes a ignorar (stop words en español)
  const stopWords = new Set([
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber', 'por', 'con', 
    'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo', 'pero', 'más', 'hacer', 'o',
    'poder', 'decir', 'este', 'ir', 'otro', 'ese', 'si', 'me', 'ya', 'ver', 'porque', 'dar',
    'cuando', 'él', 'muy', 'sin', 'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno',
    'mismo', 'yo', 'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero',
    'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella', 'sí', 'día'
  ]);
  
  // Limpiar y dividir en palabras
  const palabras = texto
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, ' ') // Mantener solo letras, números y espacios
    .split(/\s+/)
    .filter(palabra => 
      palabra.length > 3 && // Ignorar palabras muy cortas
      !stopWords.has(palabra) && // Ignorar stop words
      !/^\d+$/.test(palabra) // Ignorar solo números
    );
  
  // Tomar las primeras palabras únicas
  const palabrasUnicas = [...new Set(palabras)].slice(0, maxPalabras);
  
  // Capitalizar primera letra de cada palabra
  return palabrasUnicas
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
};

/**
 * Genera un timestamp corto para el nombre del archivo
 * @returns {string} - Timestamp en formato DDMMYYhhmm
 */
const generarTimestamp = () => {
  const fecha = new Date();
  const dia = fecha.getDate().toString().padStart(2, '0');
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const anio = fecha.getFullYear().toString().slice(-2);
  const hora = fecha.getHours().toString().padStart(2, '0');
  const min = fecha.getMinutes().toString().padStart(2, '0');
  return `${dia}${mes}${anio}${hora}${min}`;
};

/**
 * Obtiene el texto descriptivo del modo de audio
 * @param {string} modo - Modo de audio ('fade_out', 'background', 'esperar_cancion')
 * @returns {string} - Texto descriptivo
 */
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

/**
 * Página de Anuncios Rápidos con IA
 * Sistema completo de generación y programación de anuncios usando OpenAI + ElevenLabs
 * 
 * FLUJO:
 * 1. Generar TEXTO con OpenAI
 * 2a. Mostrar texto → Regenerar o Continuar
 * 2b. Seleccionar voz de ElevenLabs
 * 2c. Generar y mostrar AUDIO final (solo aquí se sube a S3)
 * 3. Programar anuncio
 */
const QuickAdsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Vista principal: 'home' | 'crear' | 'listado'
  const [currentView, setCurrentView] = useState('home');
  
  // Estado del flujo (steps más granulares)
  const [currentStep, setCurrentStep] = useState(1); // 1: Crear | 2: Texto | 3: Voz | 4: Audio | 5: Programar
  
  // Paso 1: Creación (solo idea)
  const [idea, setIdea] = useState('');
  const [duracion, setDuracion] = useState(15); // 10 o 15 segundos
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  
  // Nombre de la marca (obtenido automáticamente)
  const [nombreMarca, setNombreMarca] = useState('');
  
  // Nombre del anuncio (editable por el usuario)
  const [nombreAnuncio, setNombreAnuncio] = useState('');
  const [editandoNombre, setEditandoNombre] = useState(false);
  
  // Paso 2: Texto generado
  const [textoGenerado, setTextoGenerado] = useState('');
  const [textRegenerationCount, setTextRegenerationCount] = useState(0); // Tracking de intentos de texto
  const MAX_TEXT_REGENERATIONS = 3;
  
  // Paso 3: Selección de voz (voces predefinidas con URLs de S3)
  const vocesDisponibles = [
    { 
      id: 'guillermo',
      name: 'Guillermo (Dinámica)',
      gender: 'Masculina',
      accent: 'Castellano',
      voice_id: 'fRDnLmEYnsOOldlrmhg5',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Guillermo+Anuncios+Inmediatos.mp3'),
      settings: { speed: 1.00, stability: 0.30, similarity: 0.50, style: 0.0 }
    },
    { 
      id: 'begona',
      name: 'Begoña',
      gender: 'Femenina',
      accent: 'Español',
      voice_id: '4XB9B4QMeOzSMctqzMZb',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Begon%CC%83a+Anuncios+inmediatos.mp3'),
      settings: { speed: 1.11, stability: 0.30, similarity: 0.20, style: 0.0 }
    },
    { 
      id: 'pablo',
      name: 'Pablo',
      gender: 'Masculina',
      accent: 'Español',
      voice_id: 'aEkhnfGzn6pyq6uZfs3O',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Pablo+Anuncios+Inmediatos+(1).mp3'),
      settings: { speed: 1.00, stability: 0.31, similarity: 0.01, style: 0.0 }
    },
    { 
      id: 'maite',
      name: 'Maite',
      gender: 'Femenina',
      accent: 'Español',
      voice_id: 'BXtvkfRgOYGPQKVRgufE',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Maite+Anuncios+Inmediatos.mp3'),
      settings: { speed: 1.05, stability: 0.39, similarity: 0.0, style: 0.0 }
    },
    { 
      id: 'eva',
      name: 'Eva',
      gender: 'Femenina',
      accent: 'Español',
      voice_id: 'LwzHYaKvQlWNZWOmVAWy',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Eva+Anuncios+inmediatos.mp3'),
      settings: { speed: 1.04, stability: 0.40, similarity: 0.10, style: 0.0 }
    },
    { 
      id: 'pepon',
      name: 'Pepón',
      gender: 'Masculina',
      accent: 'Español',
      voice_id: 'jq4oWAZkNWlzc4Oyj4KK',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Pepo%CC%81n+Anuncios+Inmediatos.mp3'),
      settings: { speed: 1.05, stability: 0.35, similarity: 0.10, style: 0.0 }
    },
    { 
      id: 'lolo',
      name: 'Lolo',
      gender: 'Masculina',
      accent: 'Español',
      voice_id: 'SF7YwxoUtCja63SMKTim',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Lolo+Anuncios+inmediatos.mp3'),
      settings: { speed: 1.00, stability: 0.50, similarity: 0.17, style: 0.0 }
    },
    { 
      id: 'maria',
      name: 'María',
      gender: 'Femenina',
      accent: 'Español',
      voice_id: 'AjUAlEekKaRSqXq4JsM0',
      preview_url: convertToCloudFrontUrl('contenidos/ads/Mari%CC%81a+Anuncios+Inmediatos.mp3'),
      settings: { speed: 1.09, stability: 0.93, similarity: 0.88, style: 0.0 }
    }
  ];
  const [vozSeleccionada, setVozSeleccionada] = useState(null);
  const [voiceChangeCount, setVoiceChangeCount] = useState(0); // Tracking de intentos de voz
  const MAX_VOICE_CHANGES = 3;
  
  // Paso 4: Audio preview temporal (antes de guardar en S3)
  const [audioPreviewBlob, setAudioPreviewBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  
  // Paso 5: Audio final guardado en S3
  const [audioFinalUrl, setAudioFinalUrl] = useState('');
  
  // Paso 5: Programación
  const [tabActivoProgramacion, setTabActivoProgramacion] = useState(1); // Tab activo en el modal de programación
  const [destinatariosTipo, setDestinatariosTipo] = useState('todos');
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState([]);
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState([]); // Array de usuario IDs seleccionados individualmente
  const [gruposConUsuarios, setGruposConUsuarios] = useState({}); // { grupoId: [usuarios] }
  const [gruposExpandidos, setGruposExpandidos] = useState([]); // Array de IDs de grupos expandidos
  const [isProgramming, setIsProgramming] = useState(false);
  const [unaVezAlDia, setUnaVezAlDia] = useState(false); // Modo "Una vez al día" para bloquear frecuencia
  const [horaUnaVez, setHoraUnaVez] = useState('12:00');
  
  const [configuracionProgramacion, setConfiguracionProgramacion] = useState({
    nombre: '',
    tipo: 'diaria', // 'diaria' | 'semanal' | 'anual'
    fechaInicio: new Date().toISOString().split('T')[0],
    horaInicio: '10:00',
    fechaFin: '',
    horaFin: '23:59',
    frecuenciaMinutos: 15,
    modoAudio: 'background', // Siempre música de fondo
    // Diaria
    dailyMode: 'laborales', // 'cada' | 'laborales' | 'una_vez_dia'
    cadaDias: 1,
    rangoDesde: '08:00',
    rangoHasta: '23:59',
    horaUnaVezDia: '12:00',
    // Semanal
    weeklyMode: 'rango', // Solo 'rango' (eliminada opción 'una_vez_dia')
    weeklyDays: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    weeklyRangoDesde: '08:00',
    weeklyRangoHasta: '23:59',
    weeklyHoraUnaVez: '12:00', // Mantener para compatibilidad pero no se usa
    // Anual
    annualDate: '01/01', // dd/mm
    annualTime: '12:00'
  });

  // Estado para listado de anuncios creados
  const [anunciosCreados, setAnunciosCreados] = useState([]);
  const [isLoadingAnuncios, setIsLoadingAnuncios] = useState(false);
  
  // Estados para edición de nombre de anuncio
  const [editandoAnuncioId, setEditandoAnuncioId] = useState(null);
  const [nuevoNombreAnuncio, setNuevoNombreAnuncio] = useState('');

  // Estado para empresas del admin (desde admin_asignaciones)
  const [adminEmpresaIds, setAdminEmpresaIds] = useState([]);
  const [empresasDisponibles, setEmpresasDisponibles] = useState([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);
  const [adminMarcaId, setAdminMarcaId] = useState(null);

  // Cargar empresas y marca del admin desde admin_asignaciones
  useEffect(() => {
    const fetchAdminEmpresas = async () => {
      if (!user) return;
      
      try {
        const userId = user?.id || user?.usuario_id || user?.user_id;
        
        logger.dev('🔒 Obteniendo marcas y empresas asignadas al admin:', userId);
        
        // 1️⃣ Obtener marcas asignadas al admin
        const { data: asignacionesMarcas, error } = await supabase
          .from('admin_asignaciones')
          .select('marca_id')
          .eq('admin_id', userId);

        if (error) {
          logger.error('❌ Error obteniendo marcas del admin:', error);
          setAdminEmpresaIds([]);
          return;
        }

        const marcasIds = (asignacionesMarcas || []).map(a => a.marca_id).filter(Boolean);
        
        if (marcasIds.length === 0) {
          logger.warn('⚠️ Admin sin marcas asignadas');
          setAdminEmpresaIds([]);
          return;
        }

        // Guardar la primera marca del admin
        setAdminMarcaId(marcasIds[0]);

        // 2️⃣ Obtener empresas de esas marcas (con datos completos)
        const { data: marcaEmpresas, error: errorMarcaEmpresas } = await supabase
          .from('marca_empresas')
          .select(`
            empresa_id,
            empresas:empresa_id (
              id,
              razon_social,
              cif
            )
          `)
          .in('marca_id', marcasIds);

        if (errorMarcaEmpresas) {
          logger.error('❌ Error obteniendo empresas de las marcas:', errorMarcaEmpresas);
          setAdminEmpresaIds([]);
          return;
        }

        const empresasIds = (marcaEmpresas || []).map(me => me.empresa_id).filter(Boolean);
        const empresas = (marcaEmpresas || [])
          .map(me => me.empresas)
          .filter(Boolean);
        
        setEmpresasDisponibles(empresas);
        
        // Seleccionar la primera empresa por defecto
        if (empresas.length > 0) {
          setEmpresaSeleccionada(empresas[0]);
        }
        
        // 3️⃣ Obtener el nombre de la primera marca asignada
        const { data: marca, error: errorMarca } = await supabase
          .from('marcas')
          .select('nombre')
          .eq('id', marcasIds[0])
          .single();
        
        if (errorMarca) {
          logger.error('❌ Error obteniendo nombre de marca:', errorMarca);
        } else if (marca?.nombre) {
          setNombreMarca(marca.nombre);
          logger.dev('✅ Nombre de marca cargado:', marca.nombre);
        }
        
        logger.dev(`✅ Admin tiene ${marcasIds.length} marca(s) con ${empresasIds.length} empresa(s)`, empresas);
        setAdminEmpresaIds(empresasIds);
      } catch (e) {
        logger.error('❌ Excepción obteniendo marcas y empresas:', e);
        setAdminEmpresaIds([]);
      }
    };

    fetchAdminEmpresas();
  }, [user]);
      
  // Cargar grupos disponibles al montar
  useEffect(() => {
    cargarGruposDisponibles();
  }, [adminMarcaId]);

  // Cargar anuncios cuando se cambia a vista de listado
  useEffect(() => {
    if (currentView === 'listado' && adminEmpresaIds.length > 0) {
      logger.dev('📋 Vista de listado activada, cargando anuncios...');
      cargarAnunciosCreados();
    }
  }, [currentView, adminEmpresaIds]);

  const cargarGruposDisponibles = async () => {
    logger.dev('🔍 Intentando cargar grupos para marca:', adminMarcaId);
    
    if (!adminMarcaId) {
      logger.warn('⚠️ No hay marca asignada, no se pueden cargar grupos');
      setGruposDisponibles([]);
      return;
    }
    
    try {
      // 1️⃣ Obtener IDs de grupos asignados a la marca desde marca_grupos
      logger.dev('📋 Consultando marca_grupos para marca:', adminMarcaId);
      
      const { data: marcaGrupos, error: errorMarcaGrupos } = await supabase
        .from('marca_grupos')
        .select('grupo_id')
        .eq('marca_id', adminMarcaId);
      
      if (errorMarcaGrupos) {
        logger.error('❌ Error consultando marca_grupos:', errorMarcaGrupos);
        setGruposDisponibles([]);
        return;
      }
      
      const grupoIds = (marcaGrupos || []).map(mg => mg.grupo_id).filter(Boolean);
      logger.dev(`✅ ${grupoIds.length} grupos asignados a la marca:`, grupoIds);
      
      if (grupoIds.length === 0) {
        logger.warn('⚠️ No hay grupos asignados a esta marca');
        setGruposDisponibles([]);
        return;
      }
      
      // 2️⃣ Obtener datos completos de esos grupos
      const { data: grupos, error: errorGrupos } = await supabase
        .from('grupos')
        .select('id, nombre, descripcion, empresa_id')
        .in('id', grupoIds);
      
      if (errorGrupos) {
        logger.error('❌ Error consultando grupos:', errorGrupos);
        setGruposDisponibles([]);
        return;
      }
      
      logger.dev(`✅ ${grupos?.length || 0} grupos cargados:`, grupos);
      setGruposDisponibles(grupos || []);
      
      if (grupos && grupos.length > 0) {
        // Cargar usuarios de cada grupo automáticamente
        logger.dev('👥 Cargando usuarios de los grupos...');
        await cargarUsuariosDeGrupos(grupos.map(g => g.id));
      }
    } catch (error) {
      logger.error('❌ Excepción cargando grupos:', error);
      setGruposDisponibles([]);
    }
  };

  const cargarUsuariosDeGrupos = async (grupoIds) => {
    if (!grupoIds || grupoIds.length === 0) {
      logger.warn('⚠️ No hay grupos para cargar usuarios');
      return;
    }
    
    logger.dev('👥 Consultando usuarios de grupos:', grupoIds);
    
    try {
      // Cargar usuarios de todos los grupos de una vez, incluyendo empresa
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
        logger.error('❌ Error consultando usuarios:', error);
        setGruposConUsuarios({});
        return;
      }
      
      logger.dev(`✅ ${grupoUsuariosData?.length || 0} relaciones grupo-usuario encontradas`);
      
      if (grupoUsuariosData && grupoUsuariosData.length > 0) {
        // Agrupar usuarios por grupo_id
        const usuariosPorGrupo = {};
        grupoUsuariosData.forEach(item => {
          if (!usuariosPorGrupo[item.grupo_id]) {
            usuariosPorGrupo[item.grupo_id] = [];
          }
          if (item.usuarios) {
            usuariosPorGrupo[item.grupo_id].push(item.usuarios);
          }
        });
        
        setGruposConUsuarios(usuariosPorGrupo);
        logger.dev('✅ Usuarios agrupados:', usuariosPorGrupo);
      } else {
        logger.warn('⚠️ No se encontraron usuarios en los grupos');
        setGruposConUsuarios({});
      }
    } catch (error) {
      logger.error('❌ Excepción cargando usuarios:', error);
      setGruposConUsuarios({});
    }
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
      // Deseleccionar todos
      setUsuariosSeleccionados(prev => prev.filter(id => !usuarioIds.includes(id)));
    } else {
      // Seleccionar todos
      setUsuariosSeleccionados(prev => [...new Set([...prev, ...usuarioIds])]);
    }
  };

  const getUsuariosSeleccionadosDeGrupo = (usuarios) => {
    if (!usuarios) return 0;
    return usuarios.filter(u => usuariosSeleccionados.includes(u.id)).length;
  };

  const toggleGrupoExpandido = (grupoId) => {
    setGruposExpandidos(prev => 
      prev.includes(grupoId) 
        ? prev.filter(id => id !== grupoId)
        : [...prev, grupoId]
    );
  };

  //Cargar anuncios creados con IA
  const cargarAnunciosCreados = async () => {
    if (adminEmpresaIds.length === 0) {
      logger.warn('⚠️ No se pueden cargar anuncios: adminEmpresaIds está vacío');
      setAnunciosCreados([]);
      return;
    }
    
    setIsLoadingAnuncios(true);
    
    try {
      logger.dev('📋 Cargando anuncios creados para empresas:', adminEmpresaIds);
      
      // Cargar anuncios de todas las empresas asignadas al admin
      const { data: anuncios, error} = await supabase
        .from('ai_generated_ads')
        .select(`
          *,
          contenidos:contenido_id (
            nombre,
            tipo_contenido,
            url_s3,
            activo
          )
        `)
        .in('empresa_id', adminEmpresaIds)
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error('❌ Error cargando anuncios:', error);
        throw error;
      }
      
      logger.dev(`✅ ${anuncios?.length || 0} anuncios encontrados`);
      
      // Para cada anuncio, verificar si está programado
      const anunciosConEstado = await Promise.all(
        (anuncios || []).map(async (anuncio) => {
          // Si no tiene contenido_id, no puede estar programado
          if (!anuncio.contenido_id) {
            logger.warn('⚠️ Anuncio sin contenido_id:', anuncio.id);
            return {
              ...anuncio,
              estaProgramado: false
            };
          }

          try {
            const { data: programaciones } = await supabase
              .from('programacion_contenidos')
              .select('id, programacion_id')
              .eq('contenido_id', anuncio.contenido_id)
              .limit(1);
            
            return {
              ...anuncio,
              estaProgramado: programaciones && programaciones.length > 0
            };
          } catch (error) {
            logger.error('❌ Error verificando programación para anuncio:', anuncio.id, error);
            return {
              ...anuncio,
              estaProgramado: false
            };
          }
        })
      );
      
      setAnunciosCreados(anunciosConEstado);
      logger.dev(`✅ ${anunciosConEstado?.length} anuncios procesados con estado`);
    } catch (error) {
      logger.error('❌ Error cargando anuncios:', error);
      setAnunciosCreados([]);
      // No mostrar alert, solo loguear el error
    } finally {
      setIsLoadingAnuncios(false);
    }
  };

  const iniciarEdicionAnuncio = (anuncioId, nombreActual) => {
    setEditandoAnuncioId(anuncioId);
    setNuevoNombreAnuncio(nombreActual);
  };

  const cancelarEdicionAnuncio = () => {
    setEditandoAnuncioId(null);
    setNuevoNombreAnuncio('');
  };

  const guardarNombreAnuncio = async (anuncioId, contenidoId) => {
    if (!nuevoNombreAnuncio.trim()) {
      toast({
        title: "⚠️ Campo requerido",
        description: "El nombre del anuncio no puede estar vacío",
        variant: "destructive"
      });
      return;
    }

    try {
      logger.dev('💾 Guardando nuevo nombre de anuncio...');
      
      // Actualizar en AI_GENERATED_ADS
      const { error: errorAiAds } = await supabase
        .from('ai_generated_ads')
        .update({ titulo: nuevoNombreAnuncio.trim() })
        .eq('id', anuncioId);
      
      if (errorAiAds) throw errorAiAds;
      
      // Actualizar en CONTENIDOS
      const { error: errorContenidos } = await supabase
        .from('contenidos')
        .update({ nombre: nuevoNombreAnuncio.trim() })
        .eq('id', contenidoId);
      
      if (errorContenidos) throw errorContenidos;
      
      logger.dev('✅ Nombre actualizado en ambas tablas');
      
      // Actualizar en el estado local
      setAnunciosCreados(prev => 
        prev.map(anuncio => 
          anuncio.id === anuncioId 
            ? { 
                ...anuncio, 
                titulo: nuevoNombreAnuncio.trim(),
                contenidos: {
                  ...anuncio.contenidos,
                  nombre: nuevoNombreAnuncio.trim()
                }
              }
            : anuncio
        )
      );
      
      cancelarEdicionAnuncio();
      
    } catch (error) {
      logger.error('❌ Error actualizando nombre:', error);
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // PASO 1: Generar solo TEXTO
  const handleGenerarTexto = async () => {
    if (!idea || idea.trim().length < 10) {
      toast({
        title: "⚠️ Idea muy corta",
        description: "Por favor escribe una idea más detallada (mínimo 10 caracteres)",
        variant: "destructive"
      });
      return;
    }
    if (!nombreMarca.trim()) {
      toast({
        title: "❌ Error de configuración",
        description: "No se pudo cargar el nombre de la marca. Por favor, recarga la página.",
        variant: "destructive"
      });
      return;
    }
    
    setIsGeneratingText(true);
    
    try {
      logger.dev('📝 Generando texto con GPT-4...', { idea, nombreMarca, duracion });
      
      const resultado = await aiAdService.generarTexto({
        idea: idea.trim(),
        empresaNombre: nombreMarca.trim(),
        targetAudience: 'general',
        duration: duracion
      });
      
      setTextoGenerado(resultado.texto);
      
      // Generar nombre sugerido basado en palabras clave + timestamp
      const palabrasClave = extraerPalabrasClave(idea, 4);
      const timestamp = generarTimestamp();
      const nombreSugerido = `${nombreMarca} - ${palabrasClave} - ${timestamp}`;
      setNombreAnuncio(nombreSugerido);
      
      setCurrentStep(2); // Ir a mostrar el texto
      
      logger.dev('✅ Texto generado exitosamente', { nombreSugerido });
    } catch (error) {
      logger.error('❌ Error generando texto:', error);
      toast({
        title: "❌ Error generando el texto",
        description: error.message + " - ¿Está configurada la API key de OpenAI en Supabase?",
        variant: "destructive",
        duration: 6000
      });
    } finally {
      setIsGeneratingText(false);
    }
  };

  // PASO 2: Continuar a selección de voz
  const handleContinuarAVoz = () => {
    setCurrentStep(3);
  };

  // PASO 3: Generar AUDIO PREVIEW (temporal, NO se sube a S3 todavía)
  const handleGenerarAudioPreview = async () => {
    if (!vozSeleccionada) {
      toast({
        title: "⚠️ Voz no seleccionada",
        description: "Por favor selecciona una voz antes de generar el audio",
        variant: "destructive"
      });
      return;
    }
    
    setIsGeneratingAudio(true);
    
    try {
      logger.dev('🎤 Generando preview de audio...', { 
        voiceId: vozSeleccionada.voice_id,
        settings: vozSeleccionada.settings,
        voiceChangeCount: voiceChangeCount + 1
      });
      
      // Llamar a Edge Function para generar audio como base64 con parámetros personalizados
      const { data, error } = await supabase.functions.invoke('generate-ad', {
        body: { 
          mode: 'audio-preview',
          texto: textoGenerado,
          voiceId: vozSeleccionada.voice_id,
          voiceSettings: vozSeleccionada.settings
        }
      });
      
      if (error) {
        throw error;
      }
      
      // Convertir base64 a Blob y crear URL temporal
      const audioBlob = base64ToBlob(data.audioBase64, 'audio/mpeg');
      const blobUrl = URL.createObjectURL(audioBlob);
      
      setAudioPreviewBlob(audioBlob);
      setAudioPreviewUrl(blobUrl);
      
      // Incrementar contador de intentos de voz
      setVoiceChangeCount(prev => prev + 1);
      
      setCurrentStep(4); // Mostrar preview
      
      logger.dev('✅ Preview de audio generado (temporal)');
    } catch (error) {
      logger.error('❌ Error generando preview:', error);
      toast({
        title: "❌ Error generando el audio",
        description: error.message + " - ¿Está configurada la API key de ElevenLabs?",
        variant: "destructive",
        duration: 6000
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // PASO 4: Confirmar y GUARDAR audio en S3
  // PASO 4: Guardar audio en S3 y BD (con o sin programación)
  const guardarAudioEnS3YBD = async (continuarAProgramacion = true) => {
    if (!audioPreviewBlob) return null;
    
    setIsGeneratingAudio(true);
    
    try {
      logger.dev('☁️ Subiendo audio a S3...');
      
      // 1. Convertir blob a base64 y subir a S3
      const base64Audio = await blobToBase64(audioPreviewBlob);
      
      const { data: s3Data, error: s3Error } = await supabase.functions.invoke('generate-ad', {
        body: { 
          mode: 'save-audio',
          audioBase64: base64Audio
        }
      });
      
      if (s3Error) {
        throw s3Error;
      }
      
      const audioUrl = s3Data.audioUrl;
      setAudioFinalUrl(audioUrl);
      
      logger.dev('✅ Audio guardado en S3:', audioUrl);
      
      // 2. Guardar en BD (contenidos + ai_generated_ads)
      const userId = user.id || user.usuario_id || user.user_id;
      
      // Usar la empresa seleccionada por el usuario
      const empresaId = empresaSeleccionada?.id || null;
      
      // Verificar que tenemos empresa_id
      if (!empresaId) {
        logger.error('❌ No se encontró empresa seleccionada:', { 
          userId, 
          empresaSeleccionada 
        });
        throw new Error('Por favor, selecciona una empresa para facturar antes de guardar.');
      }
      
      logger.dev('💾 Guardando anuncio en BD...', { userId, empresaId, nombreMarca, marcaId: adminMarcaId, nombreAnuncio });
      
      const { contenido, aiAd, asignacion } = await aiAdService.guardarAnuncio({
        titulo: nombreAnuncio || `Anuncio ${nombreMarca} - ${new Date().toLocaleDateString()}`, // Usar nombre editado o fallback
        idea,
        texto: textoGenerado,
        audioUrl: audioUrl,
        audioSize: audioPreviewBlob.size, // Tamaño del blob en bytes
        voiceId: vozSeleccionada?.voice_id || '',
        model: 'gpt-4',
        userId,
        empresaId,
        marcaId: adminMarcaId, // Añadir marca_id para guardar en marca_contenidos
        durationSeconds: duracion,
        empresaNombre: nombreMarca,
        textRegenerationCount,
        voiceChangeCount
      });
      
      logger.dev('✅ Anuncio guardado en BD:', { 
        contenidoId: contenido.id, 
        aiAdId: aiAd.id, 
        asignacionId: asignacion.id 
      });
      
      // 3. Decidir siguiente paso
      if (continuarAProgramacion) {
        setTabActivoProgramacion(1); // Resetear al primer tab
        setCurrentStep(5); // Ir a programación
      } else {
        // Mostrar mensaje de éxito y resetear
        toast({
          title: "✅ Anuncio guardado",
          description: "El anuncio se guardó exitosamente sin programar",
          className: "bg-green-500 text-white border-green-600"
        });
        resetearFormulario();
      }
      
      return { contenido, aiAd };
    } catch (error) {
      logger.error('❌ Error guardando audio:', error);
      toast({
        title: "❌ Error guardando el audio",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  // Guardar sin programar
  const handleGuardarSinProgramar = async () => {
    await guardarAudioEnS3YBD(false);
  };
  
  // Guardar y continuar a programación
  const handleGuardarYProgramar = async () => {
    await guardarAudioEnS3YBD(true);
  };

  // Utilidades para convertir base64 <-> Blob
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Regenerar texto sin cambiar de paso
  const handleRegenerarTexto = async () => {
    // Verificar límite de intentos
    if (textRegenerationCount >= MAX_TEXT_REGENERATIONS) {
      toast({
        title: `⚠️ Límite alcanzado`,
        description: `Has alcanzado el límite de ${MAX_TEXT_REGENERATIONS} regeneraciones de texto. Puedes continuar con el texto actual o volver a editar la idea.`,
        variant: "destructive",
        duration: 6000
      });
      return;
    }
    
    setIsGeneratingText(true);
    setTextoGenerado(''); // Limpiar texto actual para mostrar animación
    
    try {
      logger.dev('🔄 Regenerando texto con GPT-4...', { intento: textRegenerationCount + 1 });
      
      const resultado = await aiAdService.generarTexto({
        idea: idea.trim(),
        empresaNombre: nombreMarca.trim(),
        targetAudience: 'general',
        duration: duracion
      });
      
      setTextoGenerado(resultado.texto);
      setTextRegenerationCount(prev => prev + 1); // Incrementar contador
      
      logger.dev('✅ Texto regenerado exitosamente', { totalIntentos: textRegenerationCount + 1 });
    } catch (error) {
      logger.error('❌ Error regenerando texto:', error);
      toast({
        title: "❌ Error regenerando el texto",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingText(false);
    }
  };

  // Volver a paso anterior
  const handleVolverAtras = () => {
    if (currentStep === 2) {
      // Al editar la idea (volver al paso 1 desde el paso 2), incrementar contador
      setTextRegenerationCount(prev => prev + 1);
      logger.dev('📝 Editando idea, contador incrementado:', textRegenerationCount + 1);
      setCurrentStep(1);
    }
    if (currentStep === 3) setCurrentStep(2);
    if (currentStep === 4) {
      // Verificar límite antes de permitir cambiar voz
      if (voiceChangeCount >= MAX_VOICE_CHANGES) {
        toast({
          title: `⚠️ Límite alcanzado`,
          description: `Has alcanzado el límite de ${MAX_VOICE_CHANGES} cambios de voz. Puedes confirmar el audio actual o volver a editar el texto.`,
          variant: "destructive",
          duration: 6000
        });
        return;
      }
      setCurrentStep(3);
    }
    if (currentStep === 5) setCurrentStep(4);
  };
  
  // Resetear formulario después de guardar sin programar o después de programar
  const resetearFormulario = () => {
    setCurrentView('home');
    setCurrentStep(1);
    setIdea('');
    setNombreAnuncio('');
    setEditandoNombre(false);
    setTextoGenerado('');
    setTextRegenerationCount(0);
    setVozSeleccionada(null);
    setVoiceChangeCount(0);
    setAudioPreviewBlob(null);
    setAudioPreviewUrl('');
    setAudioFinalUrl('');
    setDestinatariosTipo('todos');
    setGruposSeleccionados([]);
    setUsuariosSeleccionados([]);
    setGruposExpandidos([]);
    setConfiguracionProgramacion({
      nombre: '',
      tipo: 'diaria',
      fechaInicio: new Date().toISOString().split('T')[0],
      horaInicio: '10:00',
      fechaFin: '',
      horaFin: '23:59',
      frecuenciaMinutos: 15,
      modoAudio: 'background',
      dailyMode: 'laborales',
      cadaDias: 1,
      rangoDesde: '08:00',
      rangoHasta: '23:59',
      horaUnaVezDia: '12:00',
      weeklyMode: 'rango',
      weeklyDays: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      weeklyRangoDesde: '08:00',
      weeklyRangoHasta: '23:59',
      weeklyHoraUnaVez: '12:00',
      annualDate: '01/01',
      annualTime: '12:00'
    });
  };

  // Limpiar blob URLs al desmontar
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  // PASO 5: Programar anuncio (solo crea la programación, ya está guardado en BD)
  const handleProgramar = async () => {
    if (!textoGenerado || !audioFinalUrl) return;
    
    // Validaciones
    if (!configuracionProgramacion.nombre.trim()) {
      toast({
        title: "⚠️ Campo requerido",
        description: "Por favor, ingresa un nombre para la programación",
        variant: "destructive"
      });
      return;
    }
    
    if (destinatariosTipo === 'grupos' && usuariosSeleccionados.length === 0) {
      toast({
        title: "⚠️ Destinatarios requeridos",
        description: "Por favor, selecciona al menos un usuario de los grupos",
        variant: "destructive"
      });
      return;
    }
    
    setIsProgramming(true);
    
    try {
      // Para administradores, obtener empresa_id desde admin_asignaciones
      const empresaId = adminEmpresaIds.length > 0 ? adminEmpresaIds[0] : null;
      
      if (!empresaId) {
        throw new Error('No se pudo identificar la empresa para programar');
      }
      
      logger.dev('📅 Programando anuncio con configuración completa...');
      
      // Obtener el contenido_id del anuncio guardado
      const { data: aiAd } = await supabase
        .from('ai_generated_ads')
        .select('contenido_id, titulo')
        .eq('audio_url', audioFinalUrl)
        .single();
      
      if (!aiAd || !aiAd.contenido_id) {
        throw new Error('No se encontró el anuncio guardado');
      }
      
      // Crear programación sin guardar anuncio (ya está guardado)
      const { programacion, cantidadUsuarios } = await aiAdService.programarAnuncio({
        contenidoId: aiAd.contenido_id,
        titulo: configuracionProgramacion.nombre,
        descripcion: idea, // Usar idea completa sin truncar
        usuarios: destinatariosTipo === 'grupos' ? usuariosSeleccionados : [], // Usuarios individuales seleccionados
        grupos: [], // Ya no enviamos grupos, solo usuarios
        todosUsuarios: destinatariosTipo === 'todos',
        empresaId,
        frecuencia: {
          tipo: configuracionProgramacion.tipo,
          minutos: configuracionProgramacion.frecuenciaMinutos
        },
        modoAudio: configuracionProgramacion.modoAudio,
        horario: {
          desde: configuracionProgramacion.rangoDesde,
          hasta: configuracionProgramacion.rangoHasta,
          horaInicio: configuracionProgramacion.horaInicio,
          horaFin: configuracionProgramacion.horaFin
        },
        fechas: {
          inicio: configuracionProgramacion.fechaInicio,
          fin: configuracionProgramacion.fechaFin || null
        },
        periodicidad: {
          tipo: configuracionProgramacion.tipo,
          // Diaria
          dailyMode: configuracionProgramacion.dailyMode,
          cadaDias: configuracionProgramacion.cadaDias,
          horaUnaVezDia: configuracionProgramacion.horaUnaVezDia,
          // Semanal
          weeklyMode: configuracionProgramacion.weeklyMode,
          weeklyDays: configuracionProgramacion.weeklyDays,
          weeklyRangoDesde: configuracionProgramacion.weeklyRangoDesde,
          weeklyRangoHasta: configuracionProgramacion.weeklyRangoHasta,
          weeklyHoraUnaVez: configuracionProgramacion.weeklyHoraUnaVez,
          // Anual
          annualDate: configuracionProgramacion.annualDate,
          annualTime: configuracionProgramacion.annualTime
        },
        userId: user?.id || user?.usuario_id || user?.user_id  // ✅ FIX: Pasar userId para usuarios legacy
      });
      
      logger.dev('✅ Anuncio programado:', programacion.id);
      
      toast({
        title: "✅ ¡Anuncio programado exitosamente!",
        description: `Nombre: ${configuracionProgramacion.nombre} • Destinatarios: ${cantidadUsuarios} usuario(s)`,
        className: "bg-green-500 text-white border-green-600",
        duration: 5000
      });
      
      // Resetear formulario
      resetearFormulario();
      
    } catch (error) {
      logger.error('❌ Error programando anuncio:', error);
      toast({
        title: "❌ Error programando el anuncio",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProgramming(false);
    }
  };

  // Componente: Stepper visual (mapea steps internos 1-5 a 3 fases visuales)
  const Stepper = () => {
    const getVisualStep = () => {
      if (currentStep === 1) return 1; // Crear
      if (currentStep >= 2 && currentStep <= 4) return 2; // Resultado (texto → voz → audio)
      if (currentStep === 5) return 3; // Programar
      return 1;
    };

    const visualStep = getVisualStep();

    const steps = [
      { number: 1, title: 'Crear', icon: Sparkles },
      { number: 2, title: 'Resultado', icon: PlayCircle },
      { number: 3, title: 'Programar', icon: Calendar }
  ];

    return (
      <div className="flex items-center justify-center gap-4 mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex flex-col items-center">
              <div 
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  visualStep === step.number
                    ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                    : visualStep > step.number
                    ? 'bg-green-500 text-white'
                    : 'bg-black/5 dark:bg-white/5 text-muted-foreground'
                }`}
              >
                <step.icon className="w-5 h-5" />
              </div>
              <span className="text-xs mt-2 font-medium">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-16 h-1 rounded ${
                visualStep > step.number ? 'bg-green-500' : 'bg-black/10 dark:bg-white/10'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };


  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Anuncios con IA</h1>
            <p className="text-muted-foreground mt-1">
              Crea anuncios profesionales con inteligencia artificial en segundos
            </p>
          </div>
          
          {/* Botón volver cuando estamos en crear o listado */}
          {currentView !== 'home' && (
            <Button
              onClick={() => {
                setCurrentView('home');
                setCurrentStep(1);
              }}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          )}
        </div>

        {/* VISTA HOME: Dos bloques principales */}
        {currentView === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Bloque 1: Crear anuncio inmediato */}
            <Card
              className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary"
              onClick={() => setCurrentView('crear')}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Crear Anuncio Inmediato</h2>
                <p className="text-muted-foreground">
                  Genera un anuncio profesional con IA en segundos. Solo describe tu idea y nosotros creamos el audio.
                </p>
                <Button className="w-full gap-2">
                  <Megaphone className="w-4 h-4" />
                  Crear Ahora
                </Button>
              </div>
            </Card>

            {/* Bloque 2: Ver anuncios creados */}
            <Card
              className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary"
              onClick={() => setCurrentView('listado')}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <PlayCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Ver Anuncios Creados</h2>
                <p className="text-muted-foreground">
                  Explora todos los anuncios que has creado con IA. Escucha, edita o programa nuevamente.
                </p>
                <Button variant="outline" className="w-full gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Ver Listado
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* VISTA CREAR: Flujo de creación completo */}
        {currentView === 'crear' && (
          <>
            {/* Stepper */}
            <Stepper />

        {/* PASO 1: CREAR - Generar TEXTO */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="text-lg font-semibold mb-2 block">
                    ¿Qué quieres anunciar?
                  </label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Describe tu idea en pocas palabras. La IA creará un anuncio profesional.
                  </p>
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Ejemplo: Descuento del 20% en todos los productos este fin de semana"
                    className="w-full h-32 p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
                    <span>{idea.length}/500 caracteres</span>
                    <span>{idea.length >= 10 ? '✅ Listo' : '⚠️ Mínimo 10 caracteres'}</span>
                  </div>
                </div>

                {/* Información de la marca (solo lectura) */}
                {nombreMarca && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm font-medium text-primary mb-1">
                      📢 Marca: {nombreMarca}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Este nombre se mencionará automáticamente en tu anuncio
                    </p>
                  </div>
                )}

                {/* Selector de Empresa (facturación) */}
                {empresasDisponibles.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">
                      💼 Facturar a:
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Selecciona la empresa a la que se facturará este anuncio
                    </p>
                    <select
                      value={empresaSeleccionada?.id || ''}
                      onChange={(e) => {
                        const empresaId = e.target.value;
                        const empresa = empresasDisponibles.find(emp => emp.id === empresaId);
                        setEmpresaSeleccionada(empresa);
                        logger.dev('📝 Empresa seleccionada para facturación:', empresa);
                      }}
                      className="w-full p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {empresasDisponibles.map(empresa => (
                        <option key={empresa.id} value={empresa.id}>
                          {empresa.razon_social} {empresa.cif ? `(${empresa.cif})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selector de Duración */}
                <div>
                  <label className="text-sm font-semibold mb-3 block">
                    Duración del anuncio
                  </label>
                  <div className="grid grid-cols-2 gap-3">
            <button
                      onClick={() => setDuracion(10)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        duracion === 10
                          ? 'border-primary bg-primary/10'
                          : 'border-black/10 dark:border-white/10 hover:border-primary/50'
              }`}
            >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Clock className="w-5 h-5" />
                        <span className="font-semibold">Corto</span>
                      </div>
                      <p className="text-2xl font-bold">10"</p>
                      <p className="text-xs text-muted-foreground mt-1">Anuncio breve</p>
            </button>
                    
                    <button
                      onClick={() => setDuracion(15)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        duracion === 15
                          ? 'border-primary bg-primary/10'
                          : 'border-black/10 dark:border-white/10 hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Clock className="w-5 h-5" />
                        <span className="font-semibold">Medio</span>
                      </div>
                      <p className="text-2xl font-bold">15"</p>
                      <p className="text-xs text-muted-foreground mt-1">Anuncio completo</p>
                    </button>
                  </div>
        </div>

                <Button
                  onClick={handleGenerarTexto}
                  disabled={isGeneratingText || idea.length < 10 || !nombreMarca.trim()}
                  className="w-full h-12 gap-2"
                  size="lg"
                >
                  {isGeneratingText ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generando texto...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generar Texto con IA
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* PASO 2: TEXTO GENERADO - Mostrar y decidir */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                      <h3 className="text-xl font-semibold">
                        {isGeneratingText ? 'Generando texto...' : '¡Texto Generado!'}
                      </h3>
                    </div>
                    {!isGeneratingText && textoGenerado && (
                      <div className="flex gap-2">
                      <Button
                          onClick={() => setCurrentStep(1)}
                          variant="ghost"
                        size="sm"
                        className="gap-2"
                      >
                          <ArrowLeft className="w-4 h-4" />
                          Editar Idea
                        </Button>
                        <Button
                          onClick={handleRegenerarTexto}
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Regenerar
                      </Button>
                    </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm font-medium block">
                      Texto del anuncio:
                    </label>
                    {isGeneratingText ? (
                      <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4 min-h-[150px]">
                        {/* Animación de carga con skeleton mejorado */}
                        <div className="space-y-3">
                          <div className="space-y-3">
                            <div className="h-4 bg-gradient-to-r from-black/20 via-black/10 to-black/20 dark:from-white/20 dark:via-white/10 dark:to-white/20 rounded-full w-full animate-shimmer"></div>
                            <div className="h-4 bg-gradient-to-r from-black/20 via-black/10 to-black/20 dark:from-white/20 dark:via-white/10 dark:to-white/20 rounded-full w-11/12 animate-shimmer" style={{ animationDelay: '0.15s' }}></div>
                            <div className="h-4 bg-gradient-to-r from-black/20 via-black/10 to-black/20 dark:from-white/20 dark:via-white/10 dark:to-white/20 rounded-full w-4/5 animate-shimmer" style={{ animationDelay: '0.3s' }}></div>
                            <div className="h-4 bg-gradient-to-r from-black/20 via-black/10 to-black/20 dark:from-white/20 dark:via-white/10 dark:to-white/20 rounded-full w-10/12 animate-shimmer" style={{ animationDelay: '0.45s' }}></div>
                            <div className="h-4 bg-gradient-to-r from-black/20 via-black/10 to-black/20 dark:from-white/20 dark:via-white/10 dark:to-white/20 rounded-full w-9/12 animate-shimmer" style={{ animationDelay: '0.6s' }}></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          <span className="text-sm font-medium text-primary">La IA está creando tu anuncio...</span>
                        </div>
                      </div>
                    ) : textoGenerado ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                    <textarea
                          value={textoGenerado}
                          onChange={(e) => setTextoGenerado(e.target.value)}
                          className="w-full min-h-[150px] p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary resize-none text-muted-foreground leading-relaxed"
                          placeholder="Edita el texto del anuncio..."
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          💡 Puedes editar el texto antes de continuar
                        </p>
                      </motion.div>
                    ) : null}
                    </div>
                </div>

                {!isGeneratingText && textoGenerado && (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleContinuarAVoz}
                      className="flex-1 gap-2"
                    >
                      Continuar a Voz
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* PASO 3: SELECTOR DE VOZ con preescuchas */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Selecciona una Voz</h3>
                    <p className="text-sm text-muted-foreground">
                    Escucha las voces y elige la que mejor se adapte a tu anuncio
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vocesDisponibles.map((voz) => (
                    <div
                      key={voz.id}
                      onClick={() => setVozSeleccionada(voz)}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        vozSeleccionada?.id === voz.id
                          ? 'border-primary bg-primary/5'
                          : 'border-black/10 dark:border-white/10 hover:border-primary/50'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Mic className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{voz.name}</p>
                              {vozSeleccionada?.id === voz.id && (
                                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                              )}
                          </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 whitespace-nowrap inline-block">
                              {voz.gender} • {voz.accent}
                            </span>
                          </div>
                        </div>
                        
                        {/* Preescucha de audio con AudioPlayer personalizado */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <AudioPlayer src={voz.preview_url} />
                        </div>
                      </div>
                    </div>
                      ))}
                    </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={handleVolverAtras}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Atrás
                  </Button>
                  <Button
                    onClick={handleGenerarAudioPreview}
                    disabled={!vozSeleccionada || isGeneratingAudio}
                    className="flex-1 gap-2"
                  >
                    {isGeneratingAudio ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando preview...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        Generar Preview
                      </>
                    )}
                  </Button>
                      </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* PASO 4: AUDIO PREVIEW - Mostrar preview temporal (NO guardado en S3 todavía) */}
        {currentStep === 4 && audioPreviewUrl && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Volume2 className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-semibold">Preview del Anuncio</h3>
                  </div>
                  
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-primary mb-1">
                      ⚠️ Este audio es temporal
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Escúchalo y si te gusta, confírmalo para guardarlo en S3. Si no, puedes cambiar la voz y regenerarlo.
                      </p>
                    </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium mb-2">Texto del anuncio:</p>
                    <p className="text-muted-foreground text-sm">{textoGenerado}</p>
                  </div>

                  {/* Nombre del anuncio (editable) */}
                  <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Nombre del anuncio:
                    </label>
                    {editandoNombre ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={nombreAnuncio}
                          onChange={(e) => setNombreAnuncio(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-primary/20 focus:border-primary focus:outline-none text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditandoNombre(false);
                            if (e.key === 'Escape') setEditandoNombre(false);
                          }}
                        />
                        <Button
                          onClick={() => setEditandoNombre(false)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 bg-black/5 dark:bg-white/5 rounded-lg p-3">
                        <span className="text-sm text-muted-foreground">{nombreAnuncio}</span>
                        <Button
                          onClick={() => setEditandoNombre(true)}
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                        >
                          <Edit className="w-3 h-3" />
                          Editar
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      Voz seleccionada: <span className="text-primary">{vozSeleccionada?.name}</span>
                    </p>
                    <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4">
                      <AudioPlayer src={audioPreviewUrl} />
                    </div>
                  </div>
                </div>

                {/* Indicador de intentos */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
                  <span>📝 Regeneraciones de texto: {textRegenerationCount}/{MAX_TEXT_REGENERATIONS}</span>
                  <span>🎤 Cambios de voz: {voiceChangeCount}/{MAX_VOICE_CHANGES}</span>
                </div>

                {/* Botones de acción */}
                    <div className="space-y-3">
                  {/* Botón Cambiar Voz */}
                  <Button
                    onClick={handleVolverAtras}
                    variant="outline"
                    className="w-full gap-2"
                    disabled={isGeneratingAudio || voiceChangeCount >= MAX_VOICE_CHANGES}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {voiceChangeCount >= MAX_VOICE_CHANGES 
                      ? `Límite alcanzado (${MAX_VOICE_CHANGES}/${MAX_VOICE_CHANGES})` 
                      : 'Cambiar Voz'
                    }
                  </Button>
                  
                  {/* Botones de Guardado */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleGuardarSinProgramar}
                      disabled={isGeneratingAudio}
                      variant="outline"
                      className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                    >
                      {isGeneratingAudio ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Guardar sin Programar
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleGuardarYProgramar}
                      disabled={isGeneratingAudio}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {isGeneratingAudio ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Guardar y Programar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* PASO 5: PROGRAMAR - CONFIGURACIÓN COMPLETA */}
        {currentStep === 5 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-lg shadow-2xl"
          >
            <Card className="overflow-hidden">
              {/* Header del modal */}
              <div className="bg-background border-b border-border p-6">
                <div>
                  <h2 className="text-2xl font-bold">Configurar Programación</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Completa los datos para programar este anuncio
                  </p>
                </div>
              </div>

              {/* Tabs de navegación */}
              <div className="border-b border-border">
                <div className="flex gap-1 px-6">
                  <button
                    onClick={() => setTabActivoProgramacion(1)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      tabActivoProgramacion === 1
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    1. Contenido
                  </button>
                  <button
                    onClick={() => setTabActivoProgramacion(2)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      tabActivoProgramacion === 2
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    2. Destinatarios
                  </button>
                  <button
                    onClick={() => setTabActivoProgramacion(3)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                      tabActivoProgramacion === 3
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
                {tabActivoProgramacion === 1 && (
                  <div className="space-y-6">
                    {/* Nombre de la programación */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Nombre de la programación *</label>
                      <input
                        type="text"
                        value={configuracionProgramacion.nombre}
                        onChange={(e) => setConfiguracionProgramacion({
                          ...configuracionProgramacion,
                          nombre: e.target.value
                        })}
                        placeholder="Ej: Promoción Black Friday"
                        className="w-full p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                      />
                    </div>

                    {/* Contenido pre-asignado (el anuncio creado) */}
                    <div>
                      <label className="text-sm font-medium mb-3 block">
                        Contenido asignado
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Este anuncio generado con IA se asignará automáticamente a esta programación
                      </p>
                      <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{nombreAnuncio || "Anuncio generado con IA"}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {duracion} segundos • Voz: {vozSeleccionada?.nombre || vozSeleccionada?.name || 'No seleccionada'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botones de navegación */}
                    <div className="flex justify-between pt-4 border-t">
                      <Button
                        onClick={handleVolverAtras}
                        variant="outline"
                        className="gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Atrás
                      </Button>
                      <Button
                        onClick={() => setTabActivoProgramacion(2)}
                        disabled={!configuracionProgramacion.nombre.trim()}
                        className="gap-2"
                      >
                        Siguiente: Destinatarios
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 2: DESTINATARIOS */}
                {tabActivoProgramacion === 2 && (
                  <div className="space-y-6">
                    {/* Destinatarios con usuarios expandibles */}
                    <div>
                  <label className="text-sm font-medium mb-3 block">¿A quién enviar?</label>
                  <div className="space-y-2">
                        <button
                      onClick={() => setDestinatariosTipo('todos')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        destinatariosTipo === 'todos'
                              ? 'border-primary bg-primary/5'
                          : 'border-black/10 dark:border-white/10'
                          }`}
                        >
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">Todos los usuarios</p>
                            <p className="text-sm text-muted-foreground">De toda la empresa</p>
                            </div>
                            </div>
                        {destinatariosTipo === 'todos' && (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        )}
                          </div>
                    </button>

                    <button
                      onClick={() => setDestinatariosTipo('grupos')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        destinatariosTipo === 'grupos'
                          ? 'border-primary bg-primary/5'
                          : 'border-black/10 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">Grupos específicos</p>
                            <p className="text-sm text-muted-foreground">
                              {gruposDisponibles.length} grupos disponibles
                            </p>
                            </div>
                        </div>
                        {destinatariosTipo === 'grupos' && (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                          )}
                      </div>
                        </button>

                    {/* Selector de grupos con usuarios seleccionables individualmente */}
                    {destinatariosTipo === 'grupos' && gruposDisponibles.length > 0 && (
                      <div className="mt-3 space-y-2 ml-8">
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
                    )}
                  </div>
                </div>

                    {/* Botones de navegación */}
                    <div className="flex justify-between pt-4 border-t">
                      <Button
                        onClick={() => setTabActivoProgramacion(1)}
                        variant="outline"
                        className="gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <Button
                        onClick={() => setTabActivoProgramacion(3)}
                        disabled={destinatariosTipo === 'grupos' && usuariosSeleccionados.length === 0}
                        className="gap-2"
                      >
                        Siguiente: Configuración
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 3: CONFIGURACIÓN */}
                {tabActivoProgramacion === 3 && (
                  <div className="space-y-6">
                {/* Fechas y horas */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Periodo de programación</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Fecha de inicio *</label>
                      <input
                        type="date"
                        value={configuracionProgramacion.fechaInicio}
                        onChange={(e) => setConfiguracionProgramacion({
                          ...configuracionProgramacion,
                          fechaInicio: e.target.value
                        })}
                        className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Hora de inicio *</label>
                      <input
                        type="time"
                        value={configuracionProgramacion.horaInicio}
                        onChange={(e) => setConfiguracionProgramacion({
                          ...configuracionProgramacion,
                          horaInicio: e.target.value
                        })}
                        className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Fecha de fin (opcional)</label>
                      <input
                        type="date"
                        value={configuracionProgramacion.fechaFin}
                        onChange={(e) => setConfiguracionProgramacion({
                          ...configuracionProgramacion,
                          fechaFin: e.target.value
                        })}
                        className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Hora de fin</label>
                      <input
                        type="time"
                        value={configuracionProgramacion.horaFin}
                        onChange={(e) => setConfiguracionProgramacion({
                          ...configuracionProgramacion,
                          horaFin: e.target.value
                        })}
                        className="w-full p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Frecuencia */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Frecuencia de reproducción</label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Define con qué frecuencia se reproducirá el anuncio
                  </p>
                  
                  <div className="space-y-3">
                    {/* Opción: Cada X minutos */}
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-all hover:border-primary/50">
                      <input
                        type="radio"
                        checked={!unaVezAlDia}
                        onChange={() => setUnaVezAlDia(false)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium mb-2">Cada X minutos</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Cada</span>
                          <input
                            type="number"
                            min="1"
                            max="1440"
                            value={configuracionProgramacion.frecuenciaMinutos}
                            onChange={(e) => setConfiguracionProgramacion({
                              ...configuracionProgramacion,
                              frecuenciaMinutos: parseInt(e.target.value)
                            })}
                            disabled={unaVezAlDia}
                            className="w-20 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-center disabled:opacity-50"
                          />
                          <span className="text-sm text-muted-foreground">minutos</span>
                        </div>
                      </div>
                    </label>

                    {/* Opción: Una vez al día */}
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-all hover:border-primary/50">
                      <input
                        type="radio"
                        checked={unaVezAlDia}
                        onChange={() => setUnaVezAlDia(true)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium mb-2">Una vez al día</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">A las</span>
                          <input
                            type="time"
                            value={horaUnaVez}
                            onChange={(e) => setHoraUnaVez(e.target.value)}
                            disabled={!unaVezAlDia}
                            className="w-28 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </label>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    {unaVezAlDia 
                      ? `El anuncio se reproducirá una vez al día a las ${horaUnaVez} con música de fondo`
                      : `El anuncio se reproducirá automáticamente cada ${configuracionProgramacion.frecuenciaMinutos} minutos con música de fondo`
                    }
                  </p>
                  
                  <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      ℹ️ Los anuncios generados con IA siempre se reproducen con música de fondo para una mejor experiencia
                    </p>
                  </div>
                </div>

                {/* Periodicidad */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Periodicidad</label>
                  
                  {/* Tabs de periodicidad */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setConfiguracionProgramacion({ ...configuracionProgramacion, tipo: 'diaria' })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        configuracionProgramacion.tipo === 'diaria'
                          ? 'bg-primary text-white'
                          : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      Diariamente
                    </button>
                    <button
                      onClick={() => setConfiguracionProgramacion({ ...configuracionProgramacion, tipo: 'semanal' })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        configuracionProgramacion.tipo === 'semanal'
                          ? 'bg-primary text-white'
                          : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      Semanalmente
                    </button>
                    <button
                      onClick={() => setConfiguracionProgramacion({ ...configuracionProgramacion, tipo: 'anual' })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        configuracionProgramacion.tipo === 'anual'
                          ? 'bg-primary text-white'
                          : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      Anualmente
                    </button>
                  </div>

                  {/* Configuración DIARIA */}
                  {configuracionProgramacion.tipo === 'diaria' && (
                    <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            checked={configuracionProgramacion.dailyMode === 'cada'}
                            onChange={() => setConfiguracionProgramacion({ ...configuracionProgramacion, dailyMode: 'cada' })}
                            className="rounded-full"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-sm">Cada</span>
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={configuracionProgramacion.cadaDias}
                              onChange={(e) => setConfiguracionProgramacion({
                                ...configuracionProgramacion,
                                cadaDias: parseInt(e.target.value)
                              })}
                              disabled={configuracionProgramacion.dailyMode !== 'cada'}
                              className="w-16 p-1 rounded text-sm bg-white dark:bg-black border border-black/10 dark:border-white/10 text-center disabled:opacity-50"
                            />
                            <span className="text-sm">día(s) entre las</span>
                            <input
                              type="time"
                              value={configuracionProgramacion.rangoDesde}
                              onChange={(e) => setConfiguracionProgramacion({
                                ...configuracionProgramacion,
                                rangoDesde: e.target.value
                              })}
                              disabled={configuracionProgramacion.dailyMode !== 'cada'}
                              className="w-24 p-1 rounded text-sm bg-white dark:bg-black border border-black/10 dark:border-white/10 disabled:opacity-50"
                            />
                            <span className="text-sm">y las</span>
                            <input
                              type="time"
                              value={configuracionProgramacion.rangoHasta}
                              onChange={(e) => setConfiguracionProgramacion({
                                ...configuracionProgramacion,
                                rangoHasta: e.target.value
                              })}
                              disabled={configuracionProgramacion.dailyMode !== 'cada'}
                              className="w-24 p-1 rounded text-sm bg-white dark:bg-black border border-black/10 dark:border-white/10 disabled:opacity-50"
                            />
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            checked={configuracionProgramacion.dailyMode === 'laborales'}
                            onChange={() => setConfiguracionProgramacion({ ...configuracionProgramacion, dailyMode: 'laborales' })}
                            className="rounded-full"
                          />
                          <span className="text-sm">Todos los días de la semana (lunes a viernes) entre las {configuracionProgramacion.rangoDesde} y las {configuracionProgramacion.rangoHasta}</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Configuración SEMANAL */}
                  {configuracionProgramacion.tipo === 'semanal' && (
                    <div className="space-y-4 p-4 rounded-lg bg-black/5 dark:bg-white/5">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Días de la semana</label>
                        <div className="flex flex-wrap gap-2">
                          {['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(dia => (
                            <label key={dia} className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                              <input
                                type="checkbox"
                                checked={configuracionProgramacion.weeklyDays.includes(dia)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setConfiguracionProgramacion({
                                      ...configuracionProgramacion,
                                      weeklyDays: [...configuracionProgramacion.weeklyDays, dia]
                                    });
                                  } else {
                                    setConfiguracionProgramacion({
                                      ...configuracionProgramacion,
                                      weeklyDays: configuracionProgramacion.weeklyDays.filter(d => d !== dia)
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm capitalize">{dia}</span>
                            </label>
                          ))}
                        </div>
                    </div>

                      {/* ✅ FIX: Eliminada opción "Una vez al día" de semanal, solo rango horario */}
                      <div className="pt-2 border-t border-border">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            checked={true}
                            readOnly
                            className="rounded-full"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Entre las</span>
                            <input
                              type="time"
                              value={configuracionProgramacion.weeklyRangoDesde}
                              onChange={(e) => setConfiguracionProgramacion({
                                ...configuracionProgramacion,
                                weeklyRangoDesde: e.target.value
                              })}
                              className="w-24 p-1 rounded text-sm bg-white dark:bg-black border border-black/10 dark:border-white/10"
                            />
                            <span className="text-sm">y las</span>
                            <input
                              type="time"
                              value={configuracionProgramacion.weeklyRangoHasta}
                              onChange={(e) => setConfiguracionProgramacion({
                                ...configuracionProgramacion,
                                weeklyRangoHasta: e.target.value
                              })}
                              className="w-24 p-1 rounded text-sm bg-white dark:bg-black border border-black/10 dark:border-white/10"
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Configuración ANUAL */}
                  {configuracionProgramacion.tipo === 'anual' && (
                    <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm">El día</span>
                        <input
                          type="text"
                          value={configuracionProgramacion.annualDate}
                          onChange={(e) => setConfiguracionProgramacion({
                            ...configuracionProgramacion,
                            annualDate: e.target.value
                          })}
                          placeholder="dd/mm"
                          maxLength="5"
                          className="w-24 p-2 rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10 text-center"
                        />
                        <span className="text-sm">a las</span>
                        <input
                          type="time"
                          value={configuracionProgramacion.annualTime}
                          onChange={(e) => setConfiguracionProgramacion({
                            ...configuracionProgramacion,
                            annualTime: e.target.value
                          })}
                          className="w-28 p-2 rounded-lg bg-white dark:bg-black border border-black/10 dark:border-white/10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Formato: dd/mm (Ej: 25/12 para Navidad)
                      </p>
                    </div>
                  )}
                </div>

                    {/* Botones de navegación y acción */}
                    <div className="flex justify-between pt-4 border-t">
                      <Button
                        onClick={() => setTabActivoProgramacion(2)}
                        variant="outline"
                        className="gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <Button
                        onClick={handleProgramar}
                        disabled={isProgramming || !configuracionProgramacion.nombre.trim() || (destinatariosTipo === 'grupos' && usuariosSeleccionados.length === 0)}
                        className="gap-2"
                      >
                        {isProgramming ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Programando...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Programar Anuncio
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
          </>
        )}

        {/* VISTA LISTADO: Anuncios creados con IA */}
        {currentView === 'listado' && (
          <div className="space-y-4">
            {isLoadingAnuncios ? (
              <Card className="p-8">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p>Cargando anuncios...</p>
                </div>
            </Card>
            ) : anunciosCreados.length === 0 ? (
              <Card className="p-12">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Megaphone className="w-16 h-16 text-muted-foreground opacity-30" />
                  <h3 className="text-xl font-semibold">No hay anuncios creados</h3>
                  <p className="text-muted-foreground max-w-md">
                    Aún no has creado ningún anuncio con IA. ¡Crea tu primer anuncio ahora!
                  </p>
                  <Button
                    onClick={() => setCurrentView('crear')}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Crear Primer Anuncio
                  </Button>
          </div>
              </Card>
            ) : (
          <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {anunciosCreados.length} anuncio{anunciosCreados.length !== 1 ? 's' : ''} creado{anunciosCreados.length !== 1 ? 's' : ''}
                  </p>
                  <Button
                    onClick={cargarAnunciosCreados}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Actualizar
                  </Button>
                </div>

                {anunciosCreados.map((anuncio) => (
                  <Card key={anuncio.id} className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Mic className="w-6 h-6 text-primary" />
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div>
                          {editandoAnuncioId === anuncio.id ? (
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="text"
                                value={nuevoNombreAnuncio}
                                onChange={(e) => setNuevoNombreAnuncio(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 border-2 border-primary text-base font-semibold"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') guardarNombreAnuncio(anuncio.id, anuncio.contenido_id);
                                  if (e.key === 'Escape') cancelarEdicionAnuncio();
                                }}
                              />
                              <Button
                                onClick={() => guardarNombreAnuncio(anuncio.id, anuncio.contenido_id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={cancelarEdicionAnuncio}
                                size="sm"
                                variant="outline"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg flex-1">{anuncio.titulo}</h3>
                              <Button
                                onClick={() => iniciarEdicionAnuncio(anuncio.id, anuncio.titulo)}
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-xs"
                              >
                                <Edit className="w-3 h-3" />
                                Editar nombre
                              </Button>
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            {anuncio.idea_original}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">
                            {anuncio.voice_id === 'fRDnLmEYnsOOldlrmhg5' ? 'Guillermo (Dinámica)' :
                             anuncio.voice_id === '4XB9B4QMeOzSMctqzMZb' ? 'Begoña' :
                             anuncio.voice_id === 'aEkhnfGzn6pyq6uZfs3O' ? 'Pablo' :
                             anuncio.voice_id === 'BXtvkfRgOYGPQKVRgufE' ? 'Maite' :
                             anuncio.voice_id === 'LwzHYaKvQlWNZWOmVAWy' ? 'Eva' :
                             anuncio.voice_id === 'jq4oWAZkNWlzc4Oyj4KK' ? 'Pepón' :
                             anuncio.voice_id === 'SF7YwxoUtCja63SMKTim' ? 'Lolo' :
                             anuncio.voice_id === 'AjUAlEekKaRSqXq4JsM0' ? 'María' : 'Voz IA'}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">
                            {anuncio.duration_seconds}s
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                            🔄 Texto: {anuncio.text_regeneration_count}/3
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-600">
                            🎤 Voz: {anuncio.voice_change_count}/3
                  </span>
                </div>

                        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground italic">
                            "{anuncio.texto_generado}"
                          </p>
                </div>

                        <div className="flex items-center gap-3">
                          {anuncio.audio_url && (
                            <AudioPlayer src={anuncio.audio_url} />
                          )}
              </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Creado: {new Date(anuncio.created_at).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {anuncio.estaProgramado ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Programado
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-500/10 text-gray-600">
                                Sin programar
                              </span>
                            )}
              </div>
                          
                          {!anuncio.estaProgramado && (
                            <Button
                              onClick={() => {
                                // Cargar datos del anuncio y navegar a programación
                                setTextoGenerado(anuncio.texto_generado);
                                setAudioFinalUrl(anuncio.audio_url);
                                setVozSeleccionada(vocesDisponibles.find(v => v.voice_id === anuncio.voice_id));
                                setIdea(anuncio.idea_original);
                                setDuracion(anuncio.duration_seconds);
                                setCurrentView('crear');
                                setTabActivoProgramacion(1); // Resetear al primer tab
                                setCurrentStep(5);
                              }}
                              size="sm"
                              variant="outline"
                              className="gap-2"
                            >
                              <Calendar className="w-4 h-4" />
                              Programar Ahora
                            </Button>
                          )}
                    </div>
                  </div>
              </div>
            </Card>
                ))}
          </div>
            )}
        </div>
        )}
      </div>
      <Toaster />
    </AdminLayout>
  );
};

export default QuickAdsPage;
