import { useAuth } from '@/context/AuthContext';

interface HeaderProps {
  currentPath: string;
}

export function Header({ currentPath }: HeaderProps) {
  const { user, logout } = useAuth();

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
        </div>
      </div>
    </header>
  );
}
