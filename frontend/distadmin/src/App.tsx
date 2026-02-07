import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { LoginPage } from '@/pages/LoginPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;
const AccountsPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute requireAdmin>
    <AccountsPage />
  </ProtectedRoute>
);

function AppContent() {
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {isAuthenticated && <Header />}
      <div className="flex-1 overflow-hidden">
        <Router>
          <LoginPageWrapper path="/login" />
          <AccountsPageWrapper path="/" />
          <AccountsPageWrapper path="/accounts" />
        </Router>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
