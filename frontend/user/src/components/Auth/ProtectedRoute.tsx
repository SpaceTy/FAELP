import { ComponentChildren } from 'preact';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';
import { LoginPage } from './LoginPage';
import { rememberCurrentPathForLogin } from '@/utils/postLoginRedirect';

interface ProtectedRouteProps {
  children: ComponentChildren;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-text-secondary">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    rememberCurrentPathForLogin();
    return <LoginPage />;
  }

  return <>{children}</>;
}
