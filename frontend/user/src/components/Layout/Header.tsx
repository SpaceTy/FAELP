import { useEffect, useState, useRef } from 'preact/hooks';
import { cartSignal, getItemCount } from '@/hooks/useCart';
import { useAuth } from '@/context/AuthContext';
import { UserMenu } from '@/components/Auth/UserMenu';

export function Header() {
  const itemCount = getItemCount();
  const { isAuthenticated } = useAuth();
  const [isFlashing, setIsFlashing] = useState(false);
  const prevCountRef = useRef(itemCount);

  useEffect(() => {
    const currentCount = getItemCount();
    if (currentCount > prevCountRef.current) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 600);
    }
    prevCountRef.current = currentCount;
  }, [cartSignal.value]);

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
        </div>
      </div>
    </header>
  );
}
