/**
 * NewProgramacionModal - Modal para crear nuevas programaciones
 * 
 * Flujo de 2 pasos:
 * 1. Seleccionar contenidos de la biblioteca
 * 2. Configurar la programación (tipo, frecuencia, horario, modo audio)
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Repeat,
  Radio,
  Volume2,
  Music,
  Check,
  Clock
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

// Días de la semana para selección
const DIAS_SEMANA = [
  { value: 'lunes', label: 'L', fullLabel: 'Lunes' },
  { value: 'martes', label: 'M', fullLabel: 'Martes' },
  { value: 'miercoles', label: 'X', fullLabel: 'Miércoles' },
  { value: 'jueves', label: 'J', fullLabel: 'Jueves' },
  { value: 'viernes', label: 'V', fullLabel: 'Viernes' },
  { value: 'sabado', label: 'S', fullLabel: 'Sábado' },
  { value: 'domingo', label: 'D', fullLabel: 'Domingo' },
];

// Icono por tipo de contenido
const getTypeIcon = (tipo) => {
  const t = tipo?.toLowerCase() || '';
  if (t.includes('indicativo')) return <Radio size={14} className="text-emerald-400" />;
  if (t.includes('cuña') || t.includes('cuna')) return <Volume2 size={14} className="text-blue-400" />;
  if (t.includes('mención') || t.includes('mencion')) return <Music size={14} className="text-orange-400" />;
  return <Volume2 size={14} className="text-gray-400" />;
};

// Color por tipo de contenido
const getTypeColor = (tipo) => {
  const t = tipo?.toLowerCase() || '';
  if (t.includes('indicativo')) return 'border-emerald-500/50 bg-emerald-500/5';
  if (t.includes('cuña') || t.includes('cuna')) return 'border-blue-500/50 bg-blue-500/5';
  if (t.includes('mención') || t.includes('mencion')) return 'border-orange-500/50 bg-orange-500/5';
  return 'border-gray-500/50 bg-gray-500/5';
};

const NewProgramacionModal = ({ open, onClose, userContents = [], onSave }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Estado del wizard
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  // Paso 1: Contenidos seleccionados
  const [selectedContents, setSelectedContents] = useState([]);
  
  // Paso 2: Configuración de programación
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'diaria',
    frecuencia_minutos: 30,
    modo_audio: 'fade_out',
    esperar_fin_cancion: false,
    // Horario general
    hora_inicio: '08:00',
    hora_fin: '22:00',
    // Diaria
    daily_mode: 'cada',
    cada_dias: 1,
    rango_desde: '08:00',
    rango_hasta: '22:00',
    hora_una_vez_dia: '12:00',
    // Semanal
    weekly_mode: 'rango',
    weekly_days: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    weekly_rango_desde: '08:00',
    weekly_rango_hasta: '22:00',
    weekly_hora_una_vez: '12:00',
    // Anual
    annual_date: '01-01',
    annual_time: '12:00',
    // Fechas de vigencia
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '',
  });

  // Reset al abrir/cerrar
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedContents([]);
      setFormData({
        nombre: '',
        tipo: 'diaria',
        frecuencia_minutos: 30,
        modo_audio: 'fade_out',
        esperar_fin_cancion: false,
        hora_inicio: '08:00',
        hora_fin: '22:00',
        daily_mode: 'cada',
        cada_dias: 1,
        rango_desde: '08:00',
        rango_hasta: '22:00',
        hora_una_vez_dia: '12:00',
        weekly_mode: 'rango',
        weekly_days: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
        weekly_rango_desde: '08:00',
        weekly_rango_hasta: '22:00',
        weekly_hora_una_vez: '12:00',
        annual_date: '01-01',
        annual_time: '12:00',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: '',
      });
    }
  }, [open]);

  // Toggle selección de contenido
  const toggleContent = (contentId) => {
    setSelectedContents(prev => 
      prev.includes(contentId) 
        ? prev.filter(id => id !== contentId)
        : [...prev, contentId]
    );
  };

  // Toggle día de la semana
  const toggleWeekday = (day) => {
    setFormData(prev => ({
      ...prev,
      weekly_days: prev.weekly_days.includes(day)
        ? prev.weekly_days.filter(d => d !== day)
        : [...prev.weekly_days, day]
    }));
  };

  // Input de tiempo reutilizable
  const TimeInput = ({ value, onChange, label }) => (
    <div className="space-y-1">
      {label && <Label className="text-gray-400 text-xs">{label}</Label>}
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1a1a1e] border-[#3a3a3f] text-white text-sm h-9 [color-scheme:dark]"
      />
    </div>
  );

  // Guardar programación
  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'No se pudo identificar al usuario',
        variant: 'destructive',
      });
      return;
    }

    if (selectedContents.length === 0) {
      toast({
        title: 'Error',
        description: 'Selecciona al menos un contenido',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.nombre.trim()) {
      toast({
        title: 'Error',
        description: 'Ingresa un nombre para la programación',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Construir objeto de programación
      const programacionData = {
        usuario_id: user.id,
        descripcion: formData.nombre,
        tipo: formData.tipo,
        estado: 'activo',
        modo_audio: formData.modo_audio,
        frecuencia_minutos: formData.frecuencia_minutos,
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
        esperar_fin_cancion: formData.esperar_fin_cancion,
        fecha_inicio: formData.fecha_inicio || new Date().toISOString().split('T')[0],
        fecha_fin: formData.fecha_fin || null,
      };

      // Campos específicos por tipo
      if (formData.tipo === 'diaria') {
        programacionData.daily_mode = formData.daily_mode;
        programacionData.cada_dias = formData.cada_dias;
        programacionData.rango_desde = formData.rango_desde;
        programacionData.rango_hasta = formData.rango_hasta;
        programacionData.hora_una_vez_dia = formData.hora_una_vez_dia;
      } else if (formData.tipo === 'semanal') {
        programacionData.weekly_mode = formData.weekly_mode;
        programacionData.weekly_days = formData.weekly_days;
        programacionData.weekly_rango_desde = formData.weekly_rango_desde;
        programacionData.weekly_rango_hasta = formData.weekly_rango_hasta;
        programacionData.weekly_hora_una_vez = formData.weekly_hora_una_vez;
      } else if (formData.tipo === 'anual') {
        programacionData.annual_date = formData.annual_date;
        programacionData.annual_time = formData.annual_time;
      }

      logger.dev('📝 Creando programación:', programacionData);

      // 1. Insertar programación
      const { data: newProgramacion, error: progError } = await supabase
        .from('programaciones')
        .insert(programacionData)
        .select()
        .single();

      if (progError) throw progError;

      logger.dev('✅ Programación creada:', newProgramacion.id);

      // 2. Insertar contenidos asociados
      const contenidosToInsert = selectedContents.map((contentId, index) => ({
        programacion_id: newProgramacion.id,
        contenido_id: contentId,
        orden: index,
        activo: true,
      }));

      const { error: contenidosError } = await supabase
        .from('programacion_contenidos')
        .insert(contenidosToInsert);

      if (contenidosError) throw contenidosError;

      logger.dev('✅ Contenidos asociados:', contenidosToInsert.length);

      toast({
        title: 'Programación creada',
        description: `"${formData.nombre}" con ${selectedContents.length} contenido${selectedContents.length > 1 ? 's' : ''}`,
        className: "bg-emerald-600 text-white border-none",
      });

      onSave?.();
      onClose(false);
    } catch (error) {
      logger.error('Error creando programación:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la programación',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-[#1a1a1e] border-[#3a3a3f]/60 max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <Calendar size={18} className="text-sky-400" />
            Nueva programación
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm">
            {step === 1 
              ? 'Paso 1 de 2: Selecciona los contenidos a programar'
              : 'Paso 2 de 2: Configura cuándo y cómo se reproducirán'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-2 py-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
            step === 1 ? 'bg-sky-500 text-white' : 'bg-sky-500/20 text-sky-400'
          }`}>
            {step > 1 ? <Check size={14} /> : '1'}
          </div>
          <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-sky-500' : 'bg-[#3a3a3f]'}`} />
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
            step === 2 ? 'bg-sky-500 text-white' : 'bg-[#3a3a3f] text-gray-500'
          }`}>
            2
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          {step === 1 ? (
            /* ═══════════ PASO 1: SELECCIÓN DE CONTENIDOS ═══════════ */
            <div className="space-y-3">
              {userContents.length === 0 ? (
                <div className="text-center py-8">
                  <Volume2 size={40} className="mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">No tienes contenidos en tu biblioteca</p>
                  <p className="text-gray-500 text-sm mt-1">Crea contenidos primero para poder programarlos</p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-500 mb-2">
                    {selectedContents.length} de {userContents.length} seleccionados
                  </div>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {userContents.map((content) => {
                      const isSelected = selectedContents.includes(content.id);
                      return (
                        <div
                          key={content.id}
                          onClick={() => toggleContent(content.id)}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                            ${isSelected 
                              ? 'border-sky-500/50 bg-sky-500/10' 
                              : `${getTypeColor(content.tipo)} hover:border-gray-400/50`
                            }
                          `}
                        >
                          <div className={`
                            flex items-center justify-center w-5 h-5 rounded border-2 transition-all
                            ${isSelected 
                              ? 'bg-sky-500 border-sky-500' 
                              : 'border-gray-500 bg-transparent'
                            }
                          `}>
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(content.tipo)}
                              <span className="text-white text-sm font-medium truncate">
                                {content.nombre}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                              <span>{content.tipo || 'Contenido'}</span>
                              <span>·</span>
                              <span>{content.duracion_segundos || 0}s</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ═══════════ PASO 2: CONFIGURACIÓN ═══════════ */
            <div className="space-y-4">
              {/* Nombre de la programación */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">Nombre de la programación</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Indicativos mañana"
                  className="bg-[#242428] border-[#3a3a3f] text-white"
                />
              </div>

              {/* Tipo de programación */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">Tipo de programación</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                  <SelectTrigger className="bg-[#242428] border-[#3a3a3f] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242428] border-[#3a3a3f]">
                    <SelectItem value="una_vez" className="text-white hover:bg-sky-500/10">
                      <span className="flex items-center gap-2"><Calendar size={14} className="text-sky-400" /> Una sola vez</span>
                    </SelectItem>
                    <SelectItem value="diaria" className="text-white hover:bg-sky-500/10">
                      <span className="flex items-center gap-2"><Repeat size={14} className="text-emerald-400" /> Diaria</span>
                    </SelectItem>
                    <SelectItem value="semanal" className="text-white hover:bg-sky-500/10">
                      <span className="flex items-center gap-2"><Calendar size={14} className="text-amber-400" /> Semanal</span>
                    </SelectItem>
                    <SelectItem value="anual" className="text-white hover:bg-sky-500/10">
                      <span className="flex items-center gap-2"><Calendar size={14} className="text-violet-400" /> Anual</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ═══════════ CAMPOS DIARIA ═══════════ */}
              {formData.tipo === 'diaria' && (
                <div className="space-y-3 p-3 rounded-lg bg-[#242428]/50 border border-emerald-500/20">
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Configuración diaria</p>
                  
                  <div className="space-y-1.5">
                    <Label className="text-gray-400 text-xs">Modo</Label>
                    <Select value={formData.daily_mode} onValueChange={(v) => setFormData(prev => ({ ...prev, daily_mode: v }))}>
                      <SelectTrigger className="bg-[#1a1a1e] border-[#3a3a3f] text-white text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242428] border-[#3a3a3f]">
                        <SelectItem value="cada" className="text-white text-sm">Cada X días</SelectItem>
                        <SelectItem value="laborales" className="text-white text-sm">Solo días laborales</SelectItem>
                        <SelectItem value="una_vez_dia" className="text-white text-sm">Una vez al día</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.daily_mode === 'cada' && (
                    <div className="space-y-1.5">
                      <Label className="text-gray-400 text-xs">Cada cuántos días</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.cada_dias}
                        onChange={(e) => setFormData(prev => ({ ...prev, cada_dias: parseInt(e.target.value) || 1 }))}
                        className="bg-[#1a1a1e] border-[#3a3a3f] text-white text-sm h-9 w-24"
                      />
                    </div>
                  )}

                  {formData.daily_mode === 'una_vez_dia' ? (
                    <TimeInput 
                      label="Hora de reproducción" 
                      value={formData.hora_una_vez_dia} 
                      onChange={(v) => setFormData(prev => ({ ...prev, hora_una_vez_dia: v }))} 
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <TimeInput 
                        label="Desde" 
                        value={formData.rango_desde} 
                        onChange={(v) => setFormData(prev => ({ ...prev, rango_desde: v }))} 
                      />
                      <TimeInput 
                        label="Hasta" 
                        value={formData.rango_hasta} 
                        onChange={(v) => setFormData(prev => ({ ...prev, rango_hasta: v }))} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════ CAMPOS SEMANAL ═══════════ */}
              {formData.tipo === 'semanal' && (
                <div className="space-y-3 p-3 rounded-lg bg-[#242428]/50 border border-amber-500/20">
                  <p className="text-xs font-medium text-amber-400 uppercase tracking-wide">Configuración semanal</p>
                  
                  {/* Selector de días */}
                  <div className="space-y-1.5">
                    <Label className="text-gray-400 text-xs">Días de la semana</Label>
                    <div className="flex gap-1">
                      {DIAS_SEMANA.map(dia => (
                        <button
                          key={dia.value}
                          type="button"
                          onClick={() => toggleWeekday(dia.value)}
                          title={dia.fullLabel}
                          className={`
                            w-8 h-8 rounded-md text-xs font-medium transition-all
                            ${formData.weekly_days.includes(dia.value)
                              ? 'bg-amber-500 text-white'
                              : 'bg-[#1a1a1e] text-gray-400 hover:bg-[#2a2a2e]'
                            }
                          `}
                        >
                          {dia.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-gray-400 text-xs">Modo</Label>
                    <Select value={formData.weekly_mode} onValueChange={(v) => setFormData(prev => ({ ...prev, weekly_mode: v }))}>
                      <SelectTrigger className="bg-[#1a1a1e] border-[#3a3a3f] text-white text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242428] border-[#3a3a3f]">
                        <SelectItem value="rango" className="text-white text-sm">Rango horario</SelectItem>
                        <SelectItem value="una_vez_dia" className="text-white text-sm">Una vez al día</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.weekly_mode === 'una_vez_dia' ? (
                    <TimeInput 
                      label="Hora de reproducción" 
                      value={formData.weekly_hora_una_vez} 
                      onChange={(v) => setFormData(prev => ({ ...prev, weekly_hora_una_vez: v }))} 
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <TimeInput 
                        label="Desde" 
                        value={formData.weekly_rango_desde} 
                        onChange={(v) => setFormData(prev => ({ ...prev, weekly_rango_desde: v }))} 
                      />
                      <TimeInput 
                        label="Hasta" 
                        value={formData.weekly_rango_hasta} 
                        onChange={(v) => setFormData(prev => ({ ...prev, weekly_rango_hasta: v }))} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════ CAMPOS ANUAL ═══════════ */}
              {formData.tipo === 'anual' && (
                <div className="space-y-3 p-3 rounded-lg bg-[#242428]/50 border border-violet-500/20">
                  <p className="text-xs font-medium text-violet-400 uppercase tracking-wide">Configuración anual</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-gray-400 text-xs">Fecha (DD-MM)</Label>
                      <Input
                        type="text"
                        placeholder="25-12"
                        value={formData.annual_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, annual_date: e.target.value }))}
                        className="bg-[#1a1a1e] border-[#3a3a3f] text-white text-sm h-9"
                      />
                    </div>
                    <TimeInput 
                      label="Hora" 
                      value={formData.annual_time} 
                      onChange={(v) => setFormData(prev => ({ ...prev, annual_time: v }))} 
                    />
                  </div>
                </div>
              )}

              {/* ═══════════ CAMPOS COMUNES ═══════════ */}
              <div className="space-y-3 pt-2 border-t border-[#3a3a3f]/50">
                {/* Horario general */}
                <div className="grid grid-cols-2 gap-3">
                  <TimeInput 
                    label="Horario inicio diario" 
                    value={formData.hora_inicio} 
                    onChange={(v) => setFormData(prev => ({ ...prev, hora_inicio: v }))} 
                  />
                  <TimeInput 
                    label="Horario fin diario" 
                    value={formData.hora_fin} 
                    onChange={(v) => setFormData(prev => ({ ...prev, hora_fin: v }))} 
                  />
                </div>

                {/* Frecuencia */}
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-sm">Frecuencia de reproducción</Label>
                  <Select value={String(formData.frecuencia_minutos)} onValueChange={(v) => setFormData(prev => ({ ...prev, frecuencia_minutos: parseInt(v) }))}>
                    <SelectTrigger className="bg-[#242428] border-[#3a3a3f] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242428] border-[#3a3a3f]">
                      {[5, 10, 15, 20, 30, 45, 60, 90, 120].map(m => (
                        <SelectItem key={m} value={String(m)} className="text-white hover:bg-sky-500/10">
                          {m < 60 ? `Cada ${m} minutos` : `Cada ${m/60} ${m === 60 ? 'hora' : 'horas'}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modo de audio */}
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-sm">Modo de audio</Label>
                  <Select value={formData.modo_audio} onValueChange={(v) => setFormData(prev => ({ ...prev, modo_audio: v }))}>
                    <SelectTrigger className="bg-[#242428] border-[#3a3a3f] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242428] border-[#3a3a3f]">
                      <SelectItem value="fade_out" className="text-white hover:bg-sky-500/10">Fade out (silencia música)</SelectItem>
                      <SelectItem value="background" className="text-white hover:bg-sky-500/10">Con música de fondo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Esperar fin de canción */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <Label className="text-gray-300 text-sm">Esperar fin de canción</Label>
                    <p className="text-xs text-gray-500">Espera a que termine la canción actual</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, esperar_fin_cancion: !prev.esperar_fin_cancion }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${formData.esperar_fin_cancion ? 'bg-sky-500' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.esperar_fin_cancion ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con navegación */}
        <DialogFooter className="gap-2 pt-3 border-t border-[#3a3a3f]/50 flex-shrink-0">
          {step === 1 ? (
            <>
              <Button 
                variant="ghost" 
                onClick={() => onClose(false)} 
                className="text-gray-400 hover:text-white hover:bg-[#333]/50"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => setStep(2)} 
                disabled={selectedContents.length === 0}
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                Siguiente
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                onClick={() => setStep(1)} 
                disabled={isSaving}
                className="text-gray-400 hover:text-white hover:bg-[#333]/50"
              >
                <ChevronLeft size={16} className="mr-1" />
                Atrás
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !formData.nombre.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Crear programación
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewProgramacionModal;
