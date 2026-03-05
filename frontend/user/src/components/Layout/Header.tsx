import { useEffect, useState, useRef } from 'preact/hooks';
import { cartSignal, getItemCount } from '@/hooks/useCart';
import { useAuth } from '@/context/AuthContext';
import { UserMenu } from '@/components/Auth/UserMenu';

export function Header() {
  const itemCount = getItemCount();
  const { isAuthenticated } = useAuth();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevCountRef = useRef(itemCount);
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const currentCount = getItemCount();
    if (currentCount > prevCountRef.current) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 600);
    }
    prevCountRef.current = currentCount;
  }, [cartSignal.value]);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <header className="bg-secondary text-white shadow-md flex-shrink-0 z-50">
      <div className="flex items-center justify-between px-6 py-4 gap-8">
        <div className="flex-shrink-0">
          <a href="/" className="text-decoration-none">
            <h1 className="text-2xl font-bold text-primary">EHALP</h1>
            <p className="text-xs text-gray-300">Erste-Hilfe-Ausbildungslogistikplattform</p>
          </a>
        </div>

        <nav className="flex-1 flex gap-2">
          <a
            href="/materials"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
          >
            Materialien durchsuchen
          </a>
          <a
            href="/my-requests"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
          >
            Meine Anfragen
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="/hilfe"
            className="px-4 py-2 border border-white rounded hover:bg-white/10 transition-colors"
          >
            Hilfe
          </a>
          <a
            href="/cart"
            className={`px-4 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-all ${
              isFlashing ? 'animate-cart-flash scale-110' : ''
            }`}
          >
            Warenkorb ({itemCount})
          </a>
          {isAuthenticated && <UserMenu />}
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
