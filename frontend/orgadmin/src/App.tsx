import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MaterialTypesPage } from '@/pages/MaterialTypesPage';

// Wrapper component to handle RoutableProps
const MaterialTypesPageWrapper = (props: RoutableProps) => (
  <ProtectedRoute>
    <MaterialTypesPage />
  </ProtectedRoute>
);

function AppRoutes() {
  return (
    <Router>
      <MaterialTypesPageWrapper path="/" />
      <MaterialTypesPageWrapper path="/material-types" />
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
