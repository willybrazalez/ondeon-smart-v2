import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_STATUS } from '@/hooks/useSubscription';
import { useRole, ROLES } from '@/hooks/useRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, CreditCard } from 'lucide-react';

/**
 * Componente que protege rutas según el estado de la suscripción
 * Solo aplica para usuarios con rol_id = 2 (Gestores)
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Contenido a mostrar si tiene acceso
 * @param {boolean} [props.requireActive=true] - Si true, requiere suscripción activa o en trial
 * @param {string} [props.fallbackPath] - Ruta a redirigir si no tiene acceso
 * @param {React.ReactNode} [props.fallbackComponent] - Componente a mostrar si no tiene acceso
 */
const SubscriptionGuard = ({ 
  children, 
  requireActive = true, 
  fallbackPath = null,
  fallbackComponent = null 
}) => {
  const { user, loading: authLoading } = useAuth();
  const { userRole } = useRole();
  const { 
    subscription, 
    loading: subLoading, 
    hasActiveSubscription,
    isPaymentFailed,
    isCancelled 
  } = useSubscription();

  // Si no hay usuario, redirigir a login
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Si el rol no es gestor (2), permitir acceso sin verificar suscripción
  if (userRole !== ROLES.GESTOR) {
    return <>{children}</>;
  }

  // Mostrar loading mientras se cargan datos
  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando suscripción...</p>
        </div>
      </div>
    );
  }

  // Si no requiere suscripción activa, permitir acceso
  if (!requireActive) {
    return <>{children}</>;
  }

  // Verificar suscripción activa
  if (!hasActiveSubscription()) {
    // Si hay fallback path, redirigir
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    // Si hay componente fallback, mostrarlo
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }

    // Componente por defecto para suscripción inactiva
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            {isCancelled() ? (
              <AlertTriangle className="w-8 h-8 text-red-500" />
            ) : isPaymentFailed() ? (
              <CreditCard className="w-8 h-8 text-orange-500" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold mb-2">
            {isCancelled() 
              ? 'Suscripción Cancelada' 
              : isPaymentFailed() 
                ? 'Problema con el Pago'
                : 'Suscripción Requerida'}
          </h2>
          
          <p className="text-muted-foreground mb-6">
            {isCancelled() 
              ? 'Tu suscripción ha sido cancelada. Renueva para continuar usando la aplicación.'
              : isPaymentFailed()
                ? 'No pudimos procesar tu pago. Actualiza tu método de pago para continuar.'
                : 'Necesitas una suscripción activa para acceder a esta sección.'}
          </p>

          {subscription ? (
            <Button 
              className="w-full"
              onClick={() => {
                // Abrir portal de Stripe para gestionar suscripción
                import('@/lib/stripeApi').then(({ stripeApi }) => {
                  stripeApi.openPortal(user?.id);
                });
              }}
            >
              {isPaymentFailed() ? 'Actualizar Pago' : 'Renovar Suscripción'}
            </Button>
          ) : (
            <Button 
              className="w-full"
              onClick={() => window.open('https://ondeon.es/registro-gestor', '_blank')}
            >
              Completar Registro
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // Suscripción activa, permitir acceso
  return <>{children}</>;
};

export default SubscriptionGuard;
