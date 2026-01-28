import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header } from '@/components/Header';
import { LoginPage } from '@/pages/LoginPage';
import { MaterialTypesPage } from '@/pages/MaterialTypesPage';

// Wrapper component to handle RoutableProps
const MaterialTypesPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <MaterialTypesPage />
  </ProtectedRoute>
);

const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;

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
      <div className="flex-1 flex flex-col overflow-hidden">
        <Router>
          <LoginPageWrapper path="/login" />
          <MaterialTypesPageWrapper path="/" />
          <MaterialTypesPageWrapper path="/material-types" />
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
