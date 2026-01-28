import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { AuthProvider } from '@/context/AuthContext';
import { MaterialTypesProvider } from '@/context/MaterialTypesContext';
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';
import { LoginPage } from '@/components/Auth/LoginPage';
import { CallbackPage } from '@/components/Auth/CallbackPage';
import { MaterialsPage } from '@/pages/MaterialsPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { CartPage } from '@/pages/CartPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { Header } from '@/components/Layout/Header';

// Wrapper components to handle RoutableProps
const MaterialsPageWrapper = (_props: RoutableProps) => <MaterialsPage />;
const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;
const CallbackPageWrapper = (props: { code?: string } & RoutableProps) => (
  <CallbackPage code={props.code} />
);
const ProtectedRequestsWrapper = (_props: RoutableProps) => (
  <ProtectedRoute><RequestsPage /></ProtectedRoute>
);
const ProtectedCartWrapper = (_props: RoutableProps) => (
  <ProtectedRoute><CartPage /></ProtectedRoute>
);
const ProtectedProfileWrapper = (_props: RoutableProps) => (
  <ProtectedRoute><ProfilePage /></ProtectedRoute>
);

function AppRoutes() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Router>
          <MaterialsPageWrapper path="/" />
          <MaterialsPageWrapper path="/materials" />
          <LoginPageWrapper path="/login" />
          <CallbackPageWrapper path="/callback" />
          <ProtectedRequestsWrapper path="/requests" />
          <ProtectedCartWrapper path="/cart" />
          <ProtectedProfileWrapper path="/profile" />
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
