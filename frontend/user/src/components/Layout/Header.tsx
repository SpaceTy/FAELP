import { Link } from 'preact-router/match';
import { useCart } from '@/hooks/useCart';

export function Header() {
  const { itemCount } = useCart();

  return (
    <header className="bg-secondary text-white shadow-md flex-shrink-0 z-50">
      <div className="flex items-center justify-between px-6 py-4 gap-8">
        <div className="flex-shrink-0">
          <Link href="/" className="text-decoration-none">
            <h1 className="text-2xl font-bold text-primary">EHALP</h1>
            <p className="text-xs text-gray-300">Erste-Hilfe-Ausbildungslogistikplattform</p>
          </Link>
        </div>

        <nav className="flex-1 flex gap-2">
          <Link
            href="/materials"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
            activeClassName="bg-secondary-hover font-medium"
          >
            Materialien durchsuchen
          </Link>
          <Link
            href="/requests"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
            activeClassName="bg-secondary-hover font-medium"
          >
            Meine Anfragen
          </Link>
          <Link
            href="/profile"
            className="px-4 py-2 rounded transition-colors hover:bg-secondary-hover"
            activeClassName="bg-secondary-hover font-medium"
          >
            Profil
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <button className="px-4 py-2 border border-white rounded hover:bg-white/10 transition-colors">
            Hilfe
          </button>
          <Link
            href="/cart"
            className="px-4 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
          >
            Anfrage-Warenkorb ({itemCount})
          </Link>
        </div>
      </div>
    </header>
  );
}
