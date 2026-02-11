import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  currentPath: string;
}

export function Header({ currentPath }: HeaderProps) {
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/' && (currentPath === '/' || currentPath === '/inventory')) {
      return true;
    }
    return currentPath === path;
  };

  return (
    <header className="bg-logistics-header text-white shadow-md flex-shrink-0 z-50">
      <div className="flex items-center justify-between px-6 py-3 gap-8">
        {/* Logo */}
        <div className="flex-shrink-0">
          <a href="/" className="block">
            <h1 className="text-2xl font-bold text-logistics-accent">EHALP</h1>
            <p className="text-xs text-gray-400">Distribution Admin</p>
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex gap-2">
          <a
            href="/"
            className={`px-4 py-2 rounded transition-colors text-sm font-medium ${
              isActive('/')
                ? 'bg-logistics-secondary text-white'
                : 'text-gray-300 hover:bg-logistics-secondary hover:text-white'
            }`}
          >
            Inventar
          </a>
          {user?.isAdmin && (
            <a
              href="/accounts"
              className={`px-4 py-2 rounded transition-colors text-sm font-medium ${
                isActive('/accounts')
                  ? 'bg-logistics-secondary text-white'
                  : 'text-gray-300 hover:bg-logistics-secondary hover:text-white'
              }`}
            >
              Accounts
            </a>
          )}
        </nav>

        {/* User Actions */}
        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-white">{user.username}</div>
                  <div className="flex items-center gap-2">
                    {user.isAdmin && (
                      <span className="text-xs bg-logistics-accent text-white px-2 py-0.5 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="btn-logistics btn-logistics-secondary text-sm"
              >
                Abmelden
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
