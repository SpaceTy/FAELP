import Router from 'preact-router';
import type { RoutableProps } from 'preact-router';
import { useState } from 'preact/hooks';
import { AuthProvider } from '@/context/AuthContext';
import { MaterialTypesProvider } from '@/context/MaterialTypesContext';
import { useAuth } from '@/context/AuthContext';
import { VerifiedRoute } from '@/components/Auth/VerifiedRoute';
import { LoginPage } from '@/components/Auth/LoginPage';
import { CallbackPage } from '@/components/Auth/CallbackPage';
import { MaterialsPage } from '@/pages/MaterialsPage';
import { CartPage } from '@/pages/CartPage';
import { HilfePage } from '@/pages/HilfePage';
import { MyRequestsPage } from '@/pages/MyRequestsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Header } from '@/components/Layout/Header';
import { I18nProvider, useI18n } from '@/i18n';

// Wrapper components to handle RoutableProps
const MaterialsPageWrapper = (_props: RoutableProps) => <MaterialsPage />;
const LoginPageWrapper = (_props: RoutableProps) => <LoginPage />;
const CallbackPageWrapper = (props: { code?: string } & RoutableProps) => (
  <CallbackPage code={props.code} />
);
const ProtectedCartWrapper = (_props: RoutableProps) => (
  <VerifiedRoute><CartPage /></VerifiedRoute>
);
const HilfePageWrapper = (_props: RoutableProps) => <HilfePage />;
const NotFoundPageWrapper = (_props: RoutableProps) => <NotFoundPage />;
const ProtectedMyRequestsWrapper = (_props: RoutableProps) => (
  <VerifiedRoute><MyRequestsPage /></VerifiedRoute>
);

function VerificationBanner() {
  const { isAuthenticated, customer } = useAuth();
  const { t } = useI18n();

  if (!isAuthenticated || customer?.emailVerified) {
    return null;
  }

  return (
    <div className="bg-amber-100 border-b border-amber-200 px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold">
          !
        </div>
        <div>
          <p className="font-semibold text-amber-900">{t('app.unverifiedBannerTitle')}</p>
          <p className="text-sm text-amber-900/90">{t('app.unverifiedBannerBody')}</p>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header currentPath={currentPath} />
      <VerificationBanner />
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
    <I18nProvider>
      <AuthProvider>
        <MaterialTypesProvider>
          <AppRoutes />
        </MaterialTypesProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
