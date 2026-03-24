import { ComponentChildren } from 'preact';
import { useAuth } from '@/context/AuthContext';
import { LoginPage } from './LoginPage';
import { rememberCurrentPathForLogin } from '@/utils/postLoginRedirect';

interface VerifiedRouteProps {
  children: ComponentChildren;
}

export function VerifiedRoute({ children }: VerifiedRouteProps) {
  const { isAuthenticated, isLoading, customer } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    rememberCurrentPathForLogin();
    return <LoginPage />;
  }

  if (!customer?.emailVerified) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-2xl">
            !
          </div>
          <h1 className="text-2xl font-semibold text-secondary mb-3">
            Konto noch nicht verifiziert
          </h1>
          <p className="text-text-secondary mb-6">
            Ihr Konto ist bereits angelegt, wurde aber noch nicht von einem Administrator freigeschaltet.
            Bis dahin können Sie die Materialien nur durchsuchen.
          </p>
          <a
            href="/materials"
            className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-semibold text-secondary hover:bg-primary-hover transition-colors"
          >
            Zur Materialübersicht
          </a>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
