/**
 * ContentCard - Componente para gestión de contenidos programados
 * 
 * v3.1 - Simplificado
 * - Diseño elegante y minimalista coherente con Ondeon
 * - Control de programación completa (pausar/reanudar)
 * - Modal de edición con campos dinámicos según tipo de programación
 * - Botones: Reproducir, Pausar/Reanudar, Editar
 * 
 * @version 3.1.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Pause,
  Clock, 
  Loader2,
  Pencil,
  Volume2,
  Radio,
  Calendar,
  Repeat
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

// 🎨 Colores sutiles por tipo de contenido (borde izquierdo)
const getAccentColor = (tipo) => {
  const t = tipo?.toLowerCase() || '';
  if (t.includes('indicativo')) return 'border-l-emerald-500';
  if (t.includes('cuña')) return 'border-l-blue-500';
  if (t.includes('mención') || t.includes('mencion')) return 'border-l-orange-500';
  if (t.includes('pieza') || t.includes('divulgativa')) return 'border-l-violet-500';
  if (t.includes('promoción') || t.includes('promocion')) return 'border-l-amber-500';
  return 'border-l-gray-500';
};

// 🎨 Icono por tipo
const getTypeIcon = (tipo) => {
  const t = tipo?.toLowerCase() || '';
  if (t.includes('indicativo')) return <Radio size={14} className="text-emerald-400" />;
  if (t.includes('cuña')) return <Volume2 size={14} className="text-blue-400" />;
  if (t.includes('mención')) return <Volume2 size={14} className="text-orange-400" />;
  return <Volume2 size={14} className="text-gray-400" />;
};

// 📝 Título editable inline
const EditableTitle = ({ value, onSave, disabled = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    if (editValue.trim() === value || !editValue.trim()) {
      setIsEditing(false);
      setEditValue(value);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      setEditValue(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          className="h-7 text-sm bg-white/5 border-white/20 text-white px-2"
        />
        {isSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1 group">
      <span className="text-white font-medium text-sm truncate">{value || 'Sin nombre'}</span>
      {!disabled && (
        <button
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
          title="Editar nombre"
        >
          <Pencil size={12} className="text-gray-400" />
        </button>
      )}
    </div>
  );
};


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

// ⚙️ Modal de edición de programación
const EditModal = ({ open, onClose, item, onSave }) => {
  const prog = item.programacion_info;
  
  const [formData, setFormData] = useState({
    nombre: item.contenidos?.nombre || '',
    tipo: prog?.tipo || 'diaria',
    frecuencia_minutos: prog?.frecuencia_minutos || 30,
    modo_audio: prog?.modo_audio || 'fade_out',
    esperar_fin_cancion: prog?.esperar_fin_cancion || false,
    // Horario general
    hora_inicio: prog?.hora_inicio || '08:00',
    hora_fin: prog?.hora_fin || '23:59',
    // Diaria
    daily_mode: prog?.daily_mode || 'cada',
    cada_dias: prog?.cada_dias || 1,
    rango_desde: prog?.rango_desde || '08:00',
    rango_hasta: prog?.rango_hasta || '22:00',
    hora_una_vez_dia: prog?.hora_una_vez_dia || '12:00',
    // Semanal
    weekly_mode: prog?.weekly_mode || 'rango',
    weekly_days: prog?.weekly_days || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    weekly_rango_desde: prog?.weekly_rango_desde || '08:00',
    weekly_rango_hasta: prog?.weekly_rango_hasta || '22:00',
    weekly_hora_una_vez: prog?.weekly_hora_una_vez || '12:00',
    // Anual
    annual_date: prog?.annual_date || '01-01',
    annual_time: prog?.annual_time || '12:00',
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const p = item.programacion_info;
    setFormData({
      nombre: item.contenidos?.nombre || '',
      tipo: p?.tipo || 'diaria',
      frecuencia_minutos: p?.frecuencia_minutos || 30,
      modo_audio: p?.modo_audio || 'fade_out',
      esperar_fin_cancion: p?.esperar_fin_cancion || false,
      hora_inicio: p?.hora_inicio?.slice(0,5) || '08:00',
      hora_fin: p?.hora_fin?.slice(0,5) || '23:59',
      daily_mode: p?.daily_mode || 'cada',
      cada_dias: p?.cada_dias || 1,
      rango_desde: p?.rango_desde?.slice(0,5) || '08:00',
      rango_hasta: p?.rango_hasta?.slice(0,5) || '22:00',
      hora_una_vez_dia: p?.hora_una_vez_dia?.slice(0,5) || '12:00',
      weekly_mode: p?.weekly_mode || 'rango',
      weekly_days: p?.weekly_days || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      weekly_rango_desde: p?.weekly_rango_desde?.slice(0,5) || '08:00',
      weekly_rango_hasta: p?.weekly_rango_hasta?.slice(0,5) || '22:00',
      weekly_hora_una_vez: p?.weekly_hora_una_vez?.slice(0,5) || '12:00',
      annual_date: p?.annual_date || '01-01',
      annual_time: p?.annual_time?.slice(0,5) || '12:00',
    });
  }, [item]);

  const toggleWeekday = (day) => {
    setFormData(prev => ({
      ...prev,
      weekly_days: prev.weekly_days.includes(day)
        ? prev.weekly_days.filter(d => d !== day)
        : [...prev.weekly_days, day]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Actualizar nombre del contenido
      if (formData.nombre !== item.contenidos?.nombre) {
        const { error: contentError } = await supabase
          .from('contenidos')
          .update({ nombre: formData.nombre })
          .eq('id', item.contenidos.id);
        if (contentError) throw contentError;
      }

      // Construir objeto de actualización de programación
      if (prog) {
        const updateData = {
          tipo: formData.tipo,
          frecuencia_minutos: formData.frecuencia_minutos,
          modo_audio: formData.modo_audio,
          esperar_fin_cancion: formData.esperar_fin_cancion,
          hora_inicio: formData.hora_inicio,
          hora_fin: formData.hora_fin,
        };

        // Campos específicos por tipo
        if (formData.tipo === 'diaria') {
          updateData.daily_mode = formData.daily_mode;
          updateData.cada_dias = formData.cada_dias;
          updateData.rango_desde = formData.rango_desde;
          updateData.rango_hasta = formData.rango_hasta;
          updateData.hora_una_vez_dia = formData.hora_una_vez_dia;
        } else if (formData.tipo === 'semanal') {
          updateData.weekly_mode = formData.weekly_mode;
          updateData.weekly_days = formData.weekly_days;
          updateData.weekly_rango_desde = formData.weekly_rango_desde;
          updateData.weekly_rango_hasta = formData.weekly_rango_hasta;
          updateData.weekly_hora_una_vez = formData.weekly_hora_una_vez;
        } else if (formData.tipo === 'anual') {
          updateData.annual_date = formData.annual_date;
          updateData.annual_time = formData.annual_time;
        }

        const { error: progError } = await supabase
          .from('programaciones')
          .update(updateData)
          .eq('id', item.programacion_id);
        if (progError) throw progError;
      }

      toast({
        title: 'Guardado',
        description: 'Los cambios se han aplicado correctamente',
        className: "bg-sky-600 text-white border-none",
      });

      onSave();
      onClose(false);
    } catch (error) {
      logger.error('Error guardando:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los cambios',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-[#1a1a1e] border-[#3a3a3f]/60">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <Pencil size={18} className="text-sky-400" />
            Editar configuración
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm">
            Modifica las propiedades del contenido y su programación
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-2">
          {/* Nombre del contenido */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Nombre del contenido</Label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="bg-[#242428] border-[#3a3a3f] text-white"
            />
          </div>

          {prog && (
            <>
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
            </>
          )}
        </div>
        
        <DialogFooter className="gap-2 pt-2 border-t border-[#3a3a3f]/50">
          <Button variant="ghost" onClick={() => onClose(false)} disabled={isSaving} className="text-gray-400 hover:text-white hover:bg-[#333]/50">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-sky-500 hover:bg-sky-600 text-white">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// 🎴 Componente principal ContentCard
const ContentCard = ({ 
  item, 
  onPlay, 
  isPlaying = false,
  isDisabled = false,
  disabledReason = '',
  onUpdate 
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isTogglingProgramacion, setIsTogglingProgramacion] = useState(false);
  const { toast } = useToast();
  
  const accentColor = getAccentColor(item.contenidos?.tipo_contenido);
  const isPaused = item.programacion_info?.estado === 'pausado';
  const isCompleted = item.programacion_info?.estado === 'completado';
  const isActive = item.programacion_info?.estado === 'activo';

  // Pausar/Reanudar programación completa
  const handleToggleProgramacion = async () => {
    if (!item.programacion_id) return;
    
    setIsTogglingProgramacion(true);
    try {
      const newState = isPaused ? 'activo' : 'pausado';
      const { error } = await supabase
        .from('programaciones')
        .update({ estado: newState })
        .eq('id', item.programacion_id);

      if (error) throw error;

      toast({
        title: isPaused ? 'Programación reanudada' : 'Programación pausada',
        description: isPaused 
          ? 'Los contenidos volverán a reproducirse según programación' 
          : 'Los contenidos no se reproducirán automáticamente',
        className: isPaused 
          ? "bg-sky-600 text-white border-none"
          : "bg-amber-600 text-white border-none",
      });

      onUpdate?.();
    } catch (error) {
      logger.error('Error cambiando estado:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingProgramacion(false);
    }
  };

  // Guardar nombre
  const handleSaveName = async (newName) => {
    const { error } = await supabase
      .from('contenidos')
      .update({ nombre: newName })
      .eq('id', item.contenidos.id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
      throw error;
    }

    toast({
      title: 'Nombre actualizado',
      className: "bg-sky-600 text-white border-none",
    });
    onUpdate?.();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="group h-full"
      >
        <Card className={`
          relative overflow-hidden border-l-[3px] ${accentColor}
          bg-[#242428] border border-[#3a3a3f]/60 hover:border-sky-500/40
          transition-all duration-300 hover:shadow-lg hover:shadow-black/20
          h-full flex flex-col
          ${isPaused ? 'opacity-70' : ''} ${isCompleted ? 'opacity-50' : ''}
        `}>
          {/* Header con título completo */}
          <div className="p-4 pb-2 flex-1">
            {/* Título */}
            <div className="mb-2">
              <h3 className="text-white font-semibold text-[15px] leading-snug mb-1 line-clamp-2">
                {item.contenidos?.nombre || 'Sin nombre'}
              </h3>
              <div className="flex items-center gap-2">
                {getTypeIcon(item.contenidos?.tipo_contenido)}
                <span className="text-xs text-gray-400 capitalize">
                  {item.contenidos?.tipo_contenido || 'Contenido'}
                </span>
              </div>
            </div>
            
            {/* Info compacta */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-sky-400/70" />
                <span>{formatDuration(item.contenidos?.duracion_segundos)}</span>
              </div>
              {item.programacion_info?.frecuencia_minutos && (
                <div className="flex items-center gap-1.5">
                  <Repeat size={12} className="text-sky-400/70" />
                  <span>c/{item.programacion_info.frecuencia_minutos}min</span>
                </div>
              )}
            </div>
          </div>

          {/* Estado badge */}
          <div className="px-4 pb-2">
            {isCompleted ? (
              <span className="inline-flex text-[10px] px-2 py-0.5 rounded bg-gray-600/30 text-gray-400 font-medium">
                Completado
              </span>
            ) : isPaused ? (
              <span className="inline-flex text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                Pausado
              </span>
            ) : (
              <span className="inline-flex text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium">
                Activo
              </span>
            )}
          </div>

          {/* Actions - en dos filas para que quepan bien */}
          <div className="p-3 pt-2 bg-[#1e1e22] border-t border-[#333]/60 space-y-2">
            {/* Fila 1: Botón reproducir */}
            <button
              onClick={() => onPlay(item)}
              disabled={isDisabled}
              className={`
                w-full flex items-center justify-center gap-2 py-2 rounded-md
                text-sm font-medium transition-all
                ${isPlaying 
                  ? 'bg-sky-500 text-white shadow shadow-sky-500/30' 
                  : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                }
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
              title={isDisabled ? disabledReason : 'Reproducir'}
            >
              <Play size={14} fill={isPlaying ? "currentColor" : "none"} />
              <span>{isPlaying ? 'Reproduciendo...' : 'Reproducir'}</span>
            </button>

            {/* Fila 2: Acciones secundarias */}
            <div className="flex items-center justify-center gap-2">
              {/* Pause/Resume programación */}
              {!isCompleted && (
                <button
                  onClick={handleToggleProgramacion}
                  disabled={isTogglingProgramacion}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all text-xs
                    ${isPaused 
                      ? 'bg-sky-500/15 text-sky-400 hover:bg-sky-500/25' 
                      : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                    }
                    disabled:opacity-40
                  `}
                  title={isPaused ? 'Reanudar' : 'Pausar'}
                >
                  {isTogglingProgramacion ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : isPaused ? (
                    <Play size={12} />
                  ) : (
                    <Pause size={12} />
                  )}
                  <span>{isPaused ? 'Reanudar' : 'Pausar'}</span>
                </button>
              )}

              {/* Edit */}
              {!isCompleted && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-1.5 rounded-md bg-[#333]/50 text-gray-400 hover:bg-[#444]/60 hover:text-white transition-all"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Modal de edición */}
      <EditModal 
        open={showEditModal} 
        onClose={setShowEditModal} 
        item={item}
        onSave={() => onUpdate?.()}
      />
    </>
  );
};

export default ContentCard;
