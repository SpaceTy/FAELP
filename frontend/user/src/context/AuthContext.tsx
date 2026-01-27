import { createContext, ComponentChildren } from 'preact';
import { useContext, useState, useEffect, useCallback } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { Customer, AuthSession } from '@/types/auth';
import { authService } from '@/services/auth';

interface AuthContextType {
  customer: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const STORAGE_KEY = 'falp_auth_session';

export const authSignal = signal<AuthSession | null>(null);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: AuthSession = JSON.parse(stored);
        authSignal.value = parsed;

        authService.getCurrentUser(parsed.token).then(customer => {
          authSignal.value = { ...parsed, customer };
        }).catch(() => {
          logout();
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string) => {
    await authService.requestMagicLink(email);
  }, []);

  const verifyCode = useCallback(async (code: string) => {
    const session = await authService.verifyMagicLink(code);
    authSignal.value = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, []);

  const logout = useCallback(() => {
    authSignal.value = null;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: AuthContextType = {
    customer: authSignal.value?.customer || null,
    isAuthenticated: !!authSignal.value,
    isLoading,
    login,
    verifyCode,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
