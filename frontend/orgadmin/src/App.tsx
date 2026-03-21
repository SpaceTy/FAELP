import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { useState } from 'preact/hooks';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header } from '@/components/Header';
import { LoginPage } from '@/pages/LoginPage';
import { MaterialTypesPage } from '@/pages/MaterialTypesPage';
import { DistributionCentersPage } from '@/pages/DistributionCentersPage';
import { UsersPage } from '@/pages/UsersPage';

// Wrapper component to handle RoutableProps
const MaterialTypesPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <MaterialTypesPage />
  </ProtectedRoute>
);

const DistributionCentersPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <DistributionCentersPage />
  </ProtectedRoute>
);

const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;

const UsersPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <UsersPage />
  </ProtectedRoute>
);

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

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
      {isAuthenticated && <Header currentPath={currentPath} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Router onChange={({ url }: { url: string }) => setCurrentPath(url.split('?')[0])}>
          <LoginPageWrapper path="/login" />
          <MaterialTypesPageWrapper path="/" />
          <MaterialTypesPageWrapper path="/material-types" />
          <DistributionCentersPageWrapper path="/distribution-centers" />
          <UsersPageWrapper path="/users" />
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
