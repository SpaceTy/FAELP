import { useState } from 'preact/hooks';
import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  currentPath: string;
}

export function Header({ currentPath }: HeaderProps) {
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

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
            <>
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
              <a
                href="/audit"
                className={`px-4 py-2 rounded transition-colors text-sm font-medium ${
                  isActive('/audit')
                    ? 'bg-logistics-secondary text-white'
                    : 'text-gray-300 hover:bg-logistics-secondary hover:text-white'
                }`}
              >
                Audit-Log
              </a>
            </>
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
          <button
            onClick={toggleDark}
            title={isDark ? 'Hellmodus' : 'Dunkelmodus'}
            className="p-2 rounded transition-colors text-gray-400 hover:text-white hover:bg-white/10"
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
