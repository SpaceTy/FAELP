import { useAuth } from '@/context/AuthContext';

export function Header() {
  const { isAuthenticated, logout, customer } = useAuth();

  return (
    <header className="bg-secondary text-white shadow-md flex-shrink-0 z-50">
      <div className="flex items-center justify-between px-6 py-4 gap-8">
        <div className="flex-shrink-0">
          <a href="/" className="text-decoration-none">
            <h1 className="text-2xl font-bold text-primary">EHALP</h1>
            <p className="text-xs text-gray-300">Verwaltung</p>
          </a>
        </div>

        <nav className="flex-1 flex gap-2">
          <a
            href="/"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
          >
            Materialtypen
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {isAuthenticated && customer && (
            <span className="text-sm text-gray-300">
              {customer.name}
            </span>
          )}
          {isAuthenticated && (
            <button
              onClick={logout}
              className="px-4 py-2 border border-white rounded hover:bg-white/10 transition-colors"
            >
              Abmelden
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
