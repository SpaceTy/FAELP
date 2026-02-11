import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { useState } from 'preact/hooks';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { LoginPage } from '@/pages/LoginPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;
const InventoryPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute>
    <InventoryPage />
  </ProtectedRoute>
);
const AccountsPageWrapper = (_props: RoutableProps) => (
  <ProtectedRoute requireAdmin>
    <AccountsPage />
  </ProtectedRoute>
);

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-logistics-accent border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f0f2f5]">
      {isAuthenticated && <Header currentPath={currentPath} />}
      <div className="flex-1 overflow-hidden">
        <Router onChange={({ url }: { url: string }) => setCurrentPath(url.split('?')[0])}>
          <LoginPageWrapper path="/login" />
          <InventoryPageWrapper path="/" />
          <InventoryPageWrapper path="/inventory" />
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
