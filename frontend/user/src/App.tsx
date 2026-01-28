import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';
import { LoginPage } from '@/components/Auth/LoginPage';
import { CallbackPage } from '@/components/Auth/CallbackPage';
import { MaterialsPage } from '@/pages/MaterialsPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { CartPage } from '@/pages/CartPage';
import { ProfilePage } from '@/pages/ProfilePage';

// Wrapper components to handle RoutableProps
const MaterialsPageWrapper = (props: RoutableProps) => <MaterialsPage />;
const RequestsPageWrapper = (props: RoutableProps) => <RequestsPage />;
const CartPageWrapper = (props: RoutableProps) => <CartPage />;
const ProfilePageWrapper = (props: RoutableProps) => <ProfilePage />;
const LoginPageWrapper = (props: RoutableProps) => <LoginPage />;
const CallbackPageWrapper = (props: { code?: string } & RoutableProps) => (
  <CallbackPage code={props.code} />
);
const ProtectedRequestsWrapper = (props: RoutableProps) => (
  <ProtectedRoute><RequestsPage /></ProtectedRoute>
);
const ProtectedCartWrapper = (props: RoutableProps) => (
  <ProtectedRoute><CartPage /></ProtectedRoute>
);
const ProtectedProfileWrapper = (props: RoutableProps) => (
  <ProtectedRoute><ProfilePage /></ProtectedRoute>
);

function AppRoutes() {
  return (
    <Router>
      <MaterialsPageWrapper path="/" />
      <MaterialsPageWrapper path="/materials" />
      <LoginPageWrapper path="/login" />
      <CallbackPageWrapper path="/callback" />
      <ProtectedRequestsWrapper path="/requests" />
      <ProtectedCartWrapper path="/cart" />
      <ProtectedProfileWrapper path="/profile" />
    </Router>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
