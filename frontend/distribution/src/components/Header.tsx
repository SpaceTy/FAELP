import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  currentPath: string;
}

export function Header({ currentPath }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-secondary text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold text-primary">EHALP</h1>
              <p className="text-xs text-gray-300">Distribution Center</p>
            </div>
            <nav className="flex items-center gap-2">
              <a
                href="/inventory"
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  currentPath === '/' || currentPath === '/inventory'
                    ? 'bg-primary text-secondary font-medium'
                    : 'text-gray-200 hover:bg-secondary-hover'
                }`}
              >
                Inventory
              </a>
              <a
                href="/operations"
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  currentPath === '/operations'
                    ? 'bg-primary text-secondary font-medium'
                    : 'text-gray-200 hover:bg-secondary-hover'
                }`}
              >
                Operations
              </a>
            </nav>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-gray-300">Angemeldet als:</span>
                <span className="ml-1 font-medium">{user.username}</span>
                {user.isAdmin && (
                  <span className="ml-2 px-2 py-0.5 bg-primary text-secondary text-xs rounded-full">
                    Admin
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 text-sm bg-secondary-hover hover:bg-opacity-80 rounded transition-colors"
              >
                Abmelden
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
