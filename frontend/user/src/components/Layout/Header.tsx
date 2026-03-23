import { useEffect, useState, useRef } from 'preact/hooks';
import { cartSignal, getItemCount } from '@/hooks/useCart';
import { useAuth } from '@/context/AuthContext';
import { UserMenu } from '@/components/Auth/UserMenu';

interface HeaderProps {
  currentPath: string;
}

export function Header({ currentPath }: HeaderProps) {
  const itemCount = getItemCount();
  const { isAuthenticated, customer } = useAuth();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevCountRef = useRef(itemCount);
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  const navItems = [
    { href: '/materials', label: 'Materialien durchsuchen' },
    { href: '/my-requests', label: 'Meine Anfragen' },
  ];

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

  const isActive = (path: string) => {
    if (path === '/materials') {
      return currentPath === '/' || currentPath === '/materials';
    }
    return currentPath === path;
  };

  return (
    <header className="bg-secondary font-sans text-white shadow-md flex-shrink-0 z-50">
      <div className="flex items-center gap-4 px-6 py-3">
        <div className="min-w-0 flex-shrink-0">
          <a href="/" className="flex items-baseline gap-2 no-underline">
            <h1 className="text-xl font-bold leading-none tracking-tight text-primary">EHALP</h1>
            <p className="hidden text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-300 xl:block">
              Ausbildungslogistik
            </p>
          </a>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <nav className="flex min-w-max flex-nowrap gap-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary text-secondary'
                    : 'text-slate-100 hover:bg-secondary-hover'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="ml-auto flex flex-shrink-0 items-center justify-end gap-2">
          <a
            href="/hilfe"
            className="inline-flex h-9 items-center rounded-lg border border-white/20 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Hilfe
          </a>
          <a
            href="/cart"
            className={`inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-secondary transition-all hover:bg-primary-hover ${
              isFlashing ? 'animate-cart-flash scale-110' : ''
            }`}
          >
            Warenkorb ({itemCount})
          </a>
          {isAuthenticated && <UserMenu />}
          {isAuthenticated && customer && !customer.emailVerified && (
            <span className="hidden xl:inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Nicht verifiziert
            </span>
          )}
          <button
            onClick={toggleDark}
            title={isDark ? 'Hellmodus' : 'Dunkelmodus'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
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
