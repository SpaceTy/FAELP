import { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: ComponentChildren;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

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
    route('/login', true);
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Zugriff verweigert</h1>
          <p className="mt-2 text-text-secondary">Sie haben keine Berechtigung für diese Seite.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
