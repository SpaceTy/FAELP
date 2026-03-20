import { useState } from 'preact/hooks';
import { useAuth } from '@/context/AuthContext';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { customer, logout } = useAuth();

  if (!customer) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        <span className="hidden max-w-40 truncate sm:inline">{customer.name}</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <div className="border-b border-gray-100 px-4 py-2">
              <p className="text-sm font-medium text-text-primary">{customer.name}</p>
              <p className="text-xs text-text-secondary truncate">{customer.email}</p>
            </div>
            <a href="/profile" className="block px-4 py-2 text-sm text-text-primary hover:bg-gray-100">
              Profil
            </a>
            <button
              onClick={() => { logout(); window.location.href = '/'; }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              Abmelden
            </button>
          </div>
        </>
      )}
    </div>
  );
}
