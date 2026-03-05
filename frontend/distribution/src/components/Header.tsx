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
    if (path === '/' || path === '/requests') {
      return currentPath === '/' || currentPath === '/requests';
    }
    return currentPath === path;
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <h1>EHALP</h1>
          <p className="tagline">Logistics Portal</p>
        </div>
        <nav className="main-nav">
          <a
            href="/requests"
            className={`nav-link ${isActive('/requests') ? 'active' : ''}`}
          >
            Incoming Requests
          </a>
          <a
            href="/packaging"
            className={`nav-link ${isActive('/packaging') ? 'active' : ''}`}
          >
            Packaging
          </a>
          <a
            href="/returns"
            className={`nav-link ${isActive('/returns') ? 'active' : ''}`}
          >
            Returns
          </a>
          <a
            href="/inventory"
            className={`nav-link ${isActive('/inventory') ? 'active' : ''}`}
          >
            Inventory
          </a>
        </nav>
        <div className="header-actions">
          <span className="user-info">{user?.username || 'User'} (Logistics)</span>
          <button className="btn-secondary" onClick={logout}>
            Logout
          </button>
          <button
            onClick={toggleDark}
            title={isDark ? 'Light mode' : 'Dark mode'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: '#a0aec0', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#a0aec0')}
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
