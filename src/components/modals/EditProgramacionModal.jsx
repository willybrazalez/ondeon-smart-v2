/**
 * EditProgramacionModal - Modal para editar programaciones existentes
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2,
  Calendar,
  Repeat,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
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

const EditProgramacionModal = ({ 
  open, 
  onClose, 
  programacion, // { id, nombre, tipo, estado, ... }
  onSave,
  onDelete 
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [formData, setFormData] = useState({
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
  });

  // Cargar datos de la programación al abrir
  useEffect(() => {
    if (open && programacion) {
      loadProgramacion();
    }
    setShowDeleteConfirm(false);
  }, [open, programacion]);

  const loadProgramacion = async () => {
    if (!programacion?.programacionId) return;
    
    try {
      const { data, error } = await supabase
        .from('programaciones')
        .select('*')
        .eq('id', programacion.programacionId)
        .single();

      if (error) throw error;

      if (data) {
        // Normalizar tipo de programación
        let tipo = data.tipo || 'diaria';
        // Mapear valores antiguos a nuevos si es necesario
        if (!['una_vez', 'diaria', 'semanal', 'anual'].includes(tipo)) {
          tipo = 'diaria'; // Valor por defecto si el tipo no es válido
        }

        // Normalizar modo de audio
        let modoAudio = data.modo_audio || 'fade_out';
        if (!['fade_out', 'background'].includes(modoAudio)) {
          modoAudio = 'fade_out'; // Valor por defecto si no es válido
        }

        setFormData({
          nombre: data.descripcion || data.nombre || '',
          tipo: tipo,
          frecuencia_minutos: data.frecuencia_minutos || 30,
          modo_audio: modoAudio,
          esperar_fin_cancion: data.esperar_fin_cancion ?? false,
          hora_inicio: data.hora_inicio?.slice(0, 5) || '08:00',
          hora_fin: data.hora_fin?.slice(0, 5) || '22:00',
          daily_mode: data.daily_mode || 'cada',
          cada_dias: data.cada_dias || 1,
          rango_desde: data.rango_desde?.slice(0, 5) || '08:00',
          rango_hasta: data.rango_hasta?.slice(0, 5) || '22:00',
          hora_una_vez_dia: data.hora_una_vez_dia?.slice(0, 5) || '12:00',
          weekly_mode: data.weekly_mode || 'rango',
          weekly_days: data.weekly_days || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
          weekly_rango_desde: data.weekly_rango_desde?.slice(0, 5) || '08:00',
          weekly_rango_hasta: data.weekly_rango_hasta?.slice(0, 5) || '22:00',
          weekly_hora_una_vez: data.weekly_hora_una_vez?.slice(0, 5) || '12:00',
          annual_date: data.annual_date || '01-01',
          annual_time: data.annual_time?.slice(0, 5) || '12:00',
        });

        logger.dev('📋 Programación cargada:', { tipo, modoAudio, frecuencia: data.frecuencia_minutos });
      }
    } catch (error) {
      logger.error('Error cargando programación:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la programación',
        variant: 'destructive',
      });
    }
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

  // Guardar cambios
  const handleSave = async () => {
    if (!programacion?.programacionId) return;

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
      const updateData = {
        descripcion: formData.nombre,
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

      logger.dev('📝 Actualizando programación:', updateData);

      const { error } = await supabase
        .from('programaciones')
        .update(updateData)
        .eq('id', programacion.programacionId);

      if (error) throw error;

      toast({
        title: 'Programación actualizada',
        description: 'Los cambios se han guardado correctamente',
        className: "bg-emerald-600 text-white border-none",
      });

      onSave?.();
      onClose(false);
    } catch (error) {
      logger.error('Error actualizando programación:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la programación',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar programación
  const handleDelete = async () => {
    if (!programacion?.programacionId) return;

    setIsDeleting(true);
    try {
      // Primero eliminar contenidos asociados
      const { error: contentError } = await supabase
        .from('programacion_contenidos')
        .delete()
        .eq('programacion_id', programacion.programacionId);

      if (contentError) {
        logger.warn('Error eliminando contenidos asociados:', contentError);
      }

      // Luego eliminar la programación
      const { error } = await supabase
        .from('programaciones')
        .delete()
        .eq('id', programacion.programacionId);

      if (error) throw error;

      toast({
        title: 'Programación eliminada',
        description: 'La programación se ha eliminado correctamente',
        className: "bg-rose-600 text-white border-none",
      });

      onDelete?.();
      onClose(false);
    } catch (error) {
      logger.error('Error eliminando programación:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la programación',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!programacion) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-[#1a1a1e] border-[#3a3a3f]/60 max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <Pencil size={18} className="text-sky-400" />
            Editar programación
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-sm">
            Modifica la configuración de "{programacion.programacionNombre || 'Sin nombre'}"
          </DialogDescription>
        </DialogHeader>

        {showDeleteConfirm ? (
          /* Confirmación de eliminación */
          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar programación?</h3>
            <p className="text-gray-400 text-sm mb-6">
              Se eliminará "{programacion.programacionNombre}" y todos sus contenidos asociados.
              <br />Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="ghost" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="text-gray-400 hover:text-white hover:bg-[#333]/50"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-rose-500 hover:bg-rose-600 text-white"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Trash2 size={16} className="mr-2" />}
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          /* Formulario de edición */
          <>
            <div className="flex-1 overflow-y-auto pr-1 min-h-0 space-y-4 py-2">
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

              {/* Campos DIARIA */}
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

              {/* Campos SEMANAL */}
              {formData.tipo === 'semanal' && (
                <div className="space-y-3 p-3 rounded-lg bg-[#242428]/50 border border-amber-500/20">
                  <p className="text-xs font-medium text-amber-400 uppercase tracking-wide">Configuración semanal</p>
                  
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

              {/* Campos ANUAL */}
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

              {/* Campos COMUNES */}
              <div className="space-y-3 pt-2 border-t border-[#3a3a3f]/50">
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

            <DialogFooter className="gap-2 pt-3 border-t border-[#3a3a3f]/50 flex-shrink-0">
              <Button 
                variant="ghost" 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 mr-auto"
              >
                <Trash2 size={16} className="mr-2" />
                Eliminar
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => onClose(false)} 
                disabled={isSaving}
                className="text-gray-400 hover:text-white hover:bg-[#333]/50"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !formData.nombre.trim()}
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditProgramacionModal;
