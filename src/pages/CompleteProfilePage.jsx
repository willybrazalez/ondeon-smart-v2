import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import WaveBackground from '@/components/player/WaveBackground';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/logger';

const SECTORES = [
  'Farmacia',
  'Hostelería',
  'Retail',
  'Clínica',
  'Supermercado',
  'Otro',
];

export default function CompleteProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, createProfile, updateProfile } = useAuth();
  
  const initial = location.state || {};
  const [form, setForm] = useState({
    nombre: initial.nombre || '',
    apellidos: initial.apellidos || '',
    telefono: initial.telefono || '',
    nombreComercial: '',
    sector: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  
  const handleSector = (value) => {
    setForm({ ...form, sector: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      // Crear o actualizar perfil con los datos del formulario
      const profileData = {
        nombre: form.nombre,
        apellidos: form.apellidos,
        telefono: form.telefono,
        nombre_comercial: form.nombreComercial,
        sector: form.sector
      };

      await createProfile(profileData);
      navigate('/');
    } catch (err) {
      logger.error('Error al guardar los datos:', err);
      setError('Error al guardar los datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-2">
      <WaveBackground isPlaying={true} />
      <div className="w-full max-w-md mx-auto z-10">
        <Card className="p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col items-center w-full bg-card/95 dark:bg-[#181c24]/90 backdrop-blur-md">
          <img 
            src="/assets/icono-ondeon.png" 
            alt="Logo Ondeón" 
            className="h-12 sm:h-14 mb-2"
            onError={(e) => {
              console.error('Error al cargar el logo en CompleteProfilePage');
              e.target.style.display = 'none';
            }}
          />
          <h2 className="text-xl sm:text-2xl font-bold text-center mb-1">Completa tus datos</h2>
          <p className="text-center text-gray-700 mb-4 text-sm sm:text-base">
            Para finalizar el registro, necesitamos algunos datos adicionales.
          </p>
          {error && <div className="text-red-600 text-xs mb-4 text-center">{error}</div>}
          
          <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
            <div>
              <Label>Email</Label>
              <Input 
                type="email" 
                value={user?.email || ''} 
                disabled 
                className="bg-gray-50 dark:bg-gray-800"
              />
            </div>
            
            <div>
              <Label>Nombre comercial</Label>
              <Input 
                name="nombreComercial" 
                value={form.nombreComercial} 
                onChange={handleChange} 
                required 
                disabled={loading}
                placeholder="Nombre de tu negocio"
              />
            </div>
            
            <div>
              <Label>Sector</Label>
              <Select onValueChange={handleSector} required disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tu sector" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORES.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input 
                  name="nombre" 
                  value={form.nombre} 
                  onChange={handleChange} 
                  required 
                  disabled={loading}
                />
              </div>
              <div>
                <Label>Apellidos</Label>
                <Input 
                  name="apellidos" 
                  value={form.apellidos} 
                  onChange={handleChange} 
                  required 
                  disabled={loading}
                />
              </div>
            </div>
            
            <div>
              <Label>Teléfono</Label>
              <Input 
                name="telefono" 
                type="tel"
                value={form.telefono} 
                onChange={handleChange} 
                required 
                disabled={loading}
                placeholder="+34 600 000 000"
              />
            </div>
            
            <Button 
              className="w-full bg-black text-white text-sm sm:text-base py-2 sm:py-2.5 mt-4" 
              type="submit"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Completar registro'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
} 