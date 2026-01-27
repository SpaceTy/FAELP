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
        className="flex items-center space-x-2 text-white hover:text-gray-200"
      >
        <span className="hidden md:inline">{customer.name}</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
            <div className="px-4 py-2 border-b border-gray-100">
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
