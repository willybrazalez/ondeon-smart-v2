import React, { useEffect, useState } from 'react';
import { 
  Download, 
  CheckCircle2, 
  Monitor, 
  Apple, 
  Laptop,
  ArrowRight,
  Shield,
  Zap,
  Music
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { stripeApi } from '@/lib/stripeApi';
import WaveBackground from '@/components/player/WaveBackground';
import logger from '@/lib/logger';

/**
 * Página de descarga después de completar el registro y pago
 * Detecta el sistema operativo y ofrece el instalador apropiado
 */
export default function DownloadPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadStarted, setDownloadStarted] = useState(false);
  
  // Detectar sistema operativo
  const [os, setOs] = useState('unknown');
  
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) {
      setOs('windows');
    } else if (userAgent.includes('mac')) {
      setOs('mac');
    } else if (userAgent.includes('linux')) {
      setOs('linux');
    }
  }, []);

  // Verificar sesión y checkout exitoso
  useEffect(() => {
    const verifySession = async () => {
      try {
        // Verificar si hay session_id de Stripe (checkout exitoso)
        const sessionId = searchParams.get('session_id');
        
        if (!sessionId) {
          logger.warn('No session_id en URL, verificando sesión...');
        }

        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUser(user);
          logger.dev('✅ Usuario verificado:', user.email);
          
          // 🔑 CRÍTICO: Marcar registro_completo = true después del pago exitoso
          // Esto es un respaldo al webhook de Stripe
          if (sessionId) {
            logger.dev('💳 Checkout exitoso detectado, marcando registro_completo...');
            
            const { error: updateError } = await supabase
              .from('usuarios')
              .update({ registro_completo: true })
              .eq('auth_user_id', user.id);
            
            if (updateError) {
              logger.error('Error actualizando registro_completo:', updateError);
            } else {
              logger.dev('✅ registro_completo marcado como TRUE');
            }
          }
        } else {
          logger.warn('No hay usuario autenticado');
          // Redirigir a registro si no hay sesión
          setTimeout(() => navigate('/registro'), 3000);
        }
      } catch (err) {
        logger.error('Error verificando sesión:', err);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [searchParams, navigate]);

  // 🌙 Forzar tema oscuro
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  // URLs de descarga (ajustar según tu configuración de releases)
  const downloadUrls = {
    windows: 'https://releases.ondeon.es/Ondeon-Setup.exe',
    mac: 'https://releases.ondeon.es/Ondeon.dmg',
    linux: 'https://releases.ondeon.es/Ondeon.AppImage',
  };

  const handleDownload = () => {
    setDownloadStarted(true);
    const url = downloadUrls[os] || downloadUrls.windows;
    window.location.href = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
      <WaveBackground isPlaying={true} />
      
      <div className="w-full max-w-2xl mx-auto z-10">
        {/* Card principal */}
        <Card className="p-8 rounded-2xl shadow-xl bg-card/95 dark:bg-[#181c24]/90 backdrop-blur-md">
          {/* Header de éxito */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">
              ¡Registro completado!
            </h1>
            <p className="text-muted-foreground">
              Tu prueba gratuita de 7 días ha comenzado
            </p>
            {user && (
              <p className="text-sm text-muted-foreground mt-2">
                Cuenta: <span className="text-foreground font-medium">{user.email}</span>
              </p>
            )}
          </div>

          {/* Sección de descarga */}
          <div className="bg-muted/30 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Descarga la aplicación
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Botón principal de descarga */}
              <Button 
                size="lg"
                className="flex-1 h-14"
                onClick={handleDownload}
                disabled={downloadStarted}
              >
                {os === 'windows' && <Monitor className="w-5 h-5 mr-2" />}
                {os === 'mac' && <Apple className="w-5 h-5 mr-2" />}
                {os === 'linux' && <Laptop className="w-5 h-5 mr-2" />}
                {downloadStarted ? 'Descargando...' : `Descargar para ${
                  os === 'windows' ? 'Windows' : 
                  os === 'mac' ? 'macOS' : 
                  os === 'linux' ? 'Linux' : 'tu sistema'
                }`}
              </Button>
            </div>

            {/* Otras plataformas */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Otras plataformas:</p>
              <div className="flex gap-2">
                {os !== 'windows' && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={downloadUrls.windows}>
                      <Monitor className="w-4 h-4 mr-1" />
                      Windows
                    </a>
                  </Button>
                )}
                {os !== 'mac' && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={downloadUrls.mac}>
                      <Apple className="w-4 h-4 mr-1" />
                      macOS
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Instrucciones */}
          <div className="space-y-4">
            <h3 className="font-semibold">Próximos pasos:</h3>
            <div className="space-y-3">
              {[
                { 
                  step: 1, 
                  title: 'Instala la aplicación',
                  description: 'Abre el archivo descargado y sigue las instrucciones'
                },
                { 
                  step: 2, 
                  title: 'Inicia sesión',
                  description: `Usa tu cuenta: ${user?.email || 'tu correo registrado'}`
                },
                { 
                  step: 3, 
                  title: '¡Empieza a disfrutar!',
                  description: 'Explora los canales y crea tus primeros anuncios'
                },
              ].map(({ step, title, description }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{step}</span>
                  </div>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Features destacados */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border/50">
            <div className="text-center">
              <Zap className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
              <p className="text-xs font-medium">Anuncios al instante</p>
            </div>
            <div className="text-center">
              <Music className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-xs font-medium">Música sin límites</p>
            </div>
            <div className="text-center">
              <Shield className="w-6 h-6 mx-auto mb-2 text-green-500" />
              <p className="text-xs font-medium">Seguro y privado</p>
            </div>
          </div>
        </Card>

        {/* Soporte */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Necesitas ayuda?{' '}
          <a href="mailto:soporte@ondeon.es" className="underline text-primary">
            Contacta con soporte
          </a>
        </p>
      </div>
    </div>
  );
}
