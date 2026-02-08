import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { useState } from 'preact/hooks';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { LoginPage } from '@/pages/LoginPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { OperationsPage } from '@/pages/OperationsPage';
import { EnterInventoryPage } from '@/pages/EnterInventoryPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;
const InventoryPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <InventoryPage />
  </ProtectedRoute>
);
const OperationsPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <OperationsPage />
  </ProtectedRoute>
);
const EnterInventoryPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <EnterInventoryPage />
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
      <div className="flex-1 overflow-hidden">
        <Router onChange={({ url }: { url: string }) => setCurrentPath(url.split('?')[0])}>
          <LoginPageWrapper path="/login" />
          <InventoryPageWrapper path="/" />
          <InventoryPageWrapper path="/inventory" />
          <OperationsPageWrapper path="/operations" />
          <EnterInventoryPageWrapper path="/enter" />
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
