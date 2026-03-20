import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { useState } from 'preact/hooks';
import { AuthProvider } from '@/context/AuthContext';
import { MaterialTypesProvider } from '@/context/MaterialTypesContext';
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';
import { LoginPage } from '@/components/Auth/LoginPage';
import { CallbackPage } from '@/components/Auth/CallbackPage';
import { MaterialsPage } from '@/pages/MaterialsPage';
import { CartPage } from '@/pages/CartPage';
import { HilfePage } from '@/pages/HilfePage';
import { MyRequestsPage } from '@/pages/MyRequestsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Header } from '@/components/Layout/Header';

// Wrapper components to handle RoutableProps
const MaterialsPageWrapper = (_props: RoutableProps) => <MaterialsPage />;
const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;
const CallbackPageWrapper = (props: { code?: string } & RoutableProps) => (
  <CallbackPage code={props.code} />
);
const ProtectedCartWrapper = (_props: RoutableProps) => (
  <ProtectedRoute><CartPage /></ProtectedRoute>
);
const HilfePageWrapper = (_props: RoutableProps) => <HilfePage />;
const NotFoundPageWrapper = (_props: RoutableProps) => <NotFoundPage />;
const ProtectedMyRequestsWrapper = (_props: RoutableProps) => (
  <ProtectedRoute><MyRequestsPage /></ProtectedRoute>
);

function AppRoutes() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header currentPath={currentPath} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Router onChange={({ url }: { url: string }) => setCurrentPath(url.split('?')[0])}>
          <MaterialsPageWrapper path="/" />
          <MaterialsPageWrapper path="/materials" />
          <LoginPageWrapper path="/login" />
          <CallbackPageWrapper path="/callback" />
          <ProtectedCartWrapper path="/cart" />
          <HilfePageWrapper path="/hilfe" />
          <ProtectedMyRequestsWrapper path="/my-requests" />
          <NotFoundPageWrapper default />
        </Router>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MaterialTypesProvider>
        <AppRoutes />
      </MaterialTypesProvider>
    </AuthProvider>
  );
}
