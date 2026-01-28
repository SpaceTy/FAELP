import { useAuth } from '@/context/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import type { ComponentChildren } from 'preact';

interface ProtectedRouteProps {
  children: ComponentChildren;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          <p className="mt-2 text-text-secondary">Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
