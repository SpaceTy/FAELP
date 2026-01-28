import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/context/AuthContext';
import { UserMenu } from '@/components/Auth/UserMenu';

export function Header() {
  const { itemCount } = useCart();
  const { isAuthenticated } = useAuth();

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
            href="/requests"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
          >
            Meine Anfragen
          </a>
          <a
            href="/profile"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
          >
            Profil
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <button className="px-4 py-2 border border-white rounded hover:bg-white/10 transition-colors">
            Hilfe
          </button>
          <a
            href="/cart"
            className="px-4 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
          >
            Anfrage-Warenkorb ({itemCount})
          </a>
          {isAuthenticated && <UserMenu />}
        </div>
      </div>
    </header>
  );
}
