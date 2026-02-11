import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { useState } from 'preact/hooks';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { LoginPage } from '@/pages/LoginPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { PackagingPage } from '@/pages/PackagingPage';
import { ReturnsPage } from '@/pages/ReturnsPage';
import { EnterInventoryPage } from '@/pages/EnterInventoryPage';
import { OperationsPage } from '@/pages/OperationsPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;
const InventoryPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <InventoryPage />
  </ProtectedRoute>
);
const RequestsPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <RequestsPage />
  </ProtectedRoute>
);
const PackagingPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <PackagingPage />
  </ProtectedRoute>
);
const ReturnsPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <ReturnsPage />
  </ProtectedRoute>
);
const EnterInventoryPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <EnterInventoryPage />
  </ProtectedRoute>
);
const OperationsPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <OperationsPage />
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
          <p className="mt-2 text-text-secondary">Loading...</p>
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
          <RequestsPageWrapper path="/" />
          <RequestsPageWrapper path="/requests" />
          <PackagingPageWrapper path="/packaging" />
          <ReturnsPageWrapper path="/returns" />
          <InventoryPageWrapper path="/inventory" />
          <EnterInventoryPageWrapper path="/enter" />
          <OperationsPageWrapper path="/operations" />
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
