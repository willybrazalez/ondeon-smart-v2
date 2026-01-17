import React, { useState } from 'react';
import { 
  CreditCard, 
  Calendar, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  XCircle,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_STATUS } from '@/hooks/useSubscription';
import { stripeApi } from '@/lib/stripeApi';
import logger from '@/lib/logger';

/**
 * Panel de información de suscripción para usuarios Gestores
 * Muestra estado, próxima factura y botón para gestionar en Stripe Portal
 */
const SubscriptionPanel = ({ compact = false }) => {
  const { user, isLegacyUser } = useAuth();
  const { 
    subscription, 
    loading, 
    error,
    hasActiveSubscription,
    isInTrial,
    getTrialDaysRemaining,
    getStatusLabel,
    getStatusColor,
    refresh
  } = useSubscription();
  
  const [openingPortal, setOpeningPortal] = useState(false);

  // Obtener auth_user_id
  const getAuthUserId = () => {
    if (isLegacyUser) {
      return null; // Usuarios legacy no tienen auth_user_id
    }
    return user?.id;
  };

  // Abrir Stripe Customer Portal
  const handleOpenPortal = async () => {
    const authUserId = getAuthUserId();
    if (!authUserId) {
      logger.error('No se puede abrir portal: usuario sin auth_user_id');
      return;
    }

    try {
      setOpeningPortal(true);
      await stripeApi.openPortal(authUserId);
    } catch (err) {
      logger.error('Error abriendo portal:', err);
      alert('Error al abrir el portal de suscripción. Por favor, intenta de nuevo.');
    } finally {
      setOpeningPortal(false);
    }
  };

  // Renderizar icono según estado
  const getStatusIcon = () => {
    if (!subscription) return <XCircle className="w-5 h-5 text-gray-400" />;
    
    switch (subscription.estado) {
      case SUBSCRIPTION_STATUS.TRIALING:
        return <Clock className="w-5 h-5 text-blue-500" />;
      case SUBSCRIPTION_STATUS.ACTIVE:
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case SUBSCRIPTION_STATUS.PAST_DUE:
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case SUBSCRIPTION_STATUS.CANCELLED:
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Formatear precio
  const formatPrice = (amount, currency = 'eur') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  // Estado de carga
  if (loading) {
    return (
      <Card className={`p-6 ${compact ? '' : ''}`}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando...</span>
        </div>
      </Card>
    );
  }

  // Error
  if (error) {
    return (
      <Card className={`p-6 ${compact ? '' : ''}`}>
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">Error cargando suscripción</span>
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={refresh}>
          Reintentar
        </Button>
      </Card>
    );
  }

  // Sin suscripción
  if (!subscription) {
    return (
      <Card className={`p-6 ${compact ? '' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Tu Suscripción</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          No tienes una suscripción activa.
        </p>
        <Button 
          className="w-full"
          onClick={() => window.open('https://ondeon.es/registro', '_blank')}
        >
          Suscribirse
        </Button>
      </Card>
    );
  }

  // Color de fondo según estado
  const statusBgColor = {
    [SUBSCRIPTION_STATUS.TRIALING]: 'bg-blue-500/5 border-blue-500/20',
    [SUBSCRIPTION_STATUS.ACTIVE]: 'bg-green-500/5 border-green-500/20',
    [SUBSCRIPTION_STATUS.PAST_DUE]: 'bg-orange-500/5 border-orange-500/20',
    [SUBSCRIPTION_STATUS.CANCELLED]: 'bg-red-500/5 border-red-500/20',
  }[subscription.estado] || '';

  return (
    <Card className={`p-6 ${statusBgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Tu Suscripción</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <span className="sr-only">Actualizar</span>
          🔄
        </Button>
      </div>

      {/* Estado */}
      <div className="flex items-center gap-2 mb-4">
        {getStatusIcon()}
        <span className={`text-sm font-medium text-${getStatusColor()}-500`}>
          {getStatusLabel()}
        </span>
      </div>

      {/* Detalles */}
      <div className="space-y-3 text-sm">
        {/* Plan */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">{subscription.plan_nombre || 'Gestor'}</span>
        </div>

        {/* Precio */}
        {subscription.precio_mensual > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precio</span>
            <span className="font-medium">
              {formatPrice(subscription.precio_mensual, subscription.moneda)}/mes
            </span>
          </div>
        )}

        {/* Trial */}
        {isInTrial() && subscription.fecha_fin_trial && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trial termina</span>
            <span className="font-medium text-blue-500">
              {formatDate(subscription.fecha_fin_trial)}
            </span>
          </div>
        )}

        {/* Próxima factura */}
        {subscription.fecha_proxima_factura && subscription.estado !== SUBSCRIPTION_STATUS.CANCELLED && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Próxima factura</span>
            <span className="font-medium">
              {formatDate(subscription.fecha_proxima_factura)}
            </span>
          </div>
        )}

        {/* Fecha cancelación */}
        {subscription.cancelado_en && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cancelado el</span>
            <span className="font-medium text-red-500">
              {formatDate(subscription.cancelado_en)}
            </span>
          </div>
        )}
      </div>

      {/* Botón de gestión */}
      {getAuthUserId() && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleOpenPortal}
            disabled={openingPortal}
          >
            {openingPortal ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Abriendo...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Gestionar suscripción
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Se abrirá en tu navegador
          </p>
        </div>
      )}
    </Card>
  );
};

export default SubscriptionPanel;
