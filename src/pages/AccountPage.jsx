import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  LogOut, 
  Building2, 
  Mail, 
  Shield,
  ChevronLeft,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { Button } from '@/components/ui/button';

/**
 * Página de cuenta del usuario - Mobile friendly
 */
const AccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasPermission, roleName } = useRole();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const establecimiento = user?.user_metadata?.establecimiento || user?.establecimiento || user?.user_metadata?.username || user?.username || user?.nombre_usuario || 'Usuario';
  const email = user?.email || '';

  return (
    <div className="pb-24 px-4">
      {/* Header con botón atrás */}
      <div className="flex items-center gap-3 mb-6 mt-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.1] transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold text-white">{t('account.title', 'Mi Cuenta')}</h1>
      </div>

      {/* Card de perfil */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 mb-6">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#A2D9F7]/30 to-[#A2D9F7]/10 flex items-center justify-center mb-4 border border-[#A2D9F7]/20">
            <User size={36} className="text-[#A2D9F7]" />
          </div>
          <h2 className="text-lg font-semibold text-white text-center">{establecimiento}</h2>
          <span className="text-sm text-white/50 mt-1">{roleName || 'Usuario'}</span>
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]">
            <Building2 size={20} className="text-[#A2D9F7]" />
            <div>
              <p className="text-xs text-white/50">{t('account.establishment', 'Establecimiento')}</p>
              <p className="text-sm text-white">{establecimiento}</p>
            </div>
          </div>

          {email && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]">
              <Mail size={20} className="text-[#A2D9F7]" />
              <div>
                <p className="text-xs text-white/50">{t('account.email', 'Email')}</p>
                <p className="text-sm text-white">{email}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]">
            <Shield size={20} className="text-[#A2D9F7]" />
            <div>
              <p className="text-xs text-white/50">{t('account.role', 'Rol')}</p>
              <p className="text-sm text-white">{roleName || 'Usuario'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acceso a Gestor (si tiene permisos) */}
      {hasPermission('canAccessGestor') && (
        <button
          onClick={() => window.open('/gestor', '_blank')}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-4 hover:bg-white/[0.08] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#A2D9F7]/20 flex items-center justify-center">
              <ExternalLink size={20} className="text-[#A2D9F7]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">{t('account.gestorDashboard', 'Panel de Gestión')}</p>
              <p className="text-xs text-white/50">{t('account.gestorDesc', 'Administra tu establecimiento')}</p>
            </div>
          </div>
          <ChevronLeft size={20} className="text-white/30 rotate-180" />
        </button>
      )}

      {/* Botón de logout */}
      <Button
        onClick={handleLogout}
        variant="ghost"
        className="w-full h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
      >
        <LogOut size={20} className="mr-3" />
        {t('account.logout', 'Cerrar Sesión')}
      </Button>
    </div>
  );
};

export default AccountPage;
