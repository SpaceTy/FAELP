import { createContext, ComponentChildren } from 'preact';
import { useContext, useState, useEffect, useCallback } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { User, AuthSession } from '@/types/auth';
import { api } from '@/services/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const STORAGE_KEY = 'faelp_distadmin_auth_session';

export const authSignal = signal<AuthSession | null>(null);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: AuthSession = JSON.parse(stored);
        authSignal.value = parsed;

        // Verify the session is still valid
        api.getCurrentUser().then(user => {
          authSignal.value = { ...parsed, user };
        }).catch(() => {
          logout();
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login({ username, password });
    const session: AuthSession = {
      token: response.token,
      user: response.user,
    };
    authSignal.value = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, []);

  const logout = useCallback(() => {
    authSignal.value = null;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: AuthContextType = {
    user: authSignal.value?.user || null,
    isAuthenticated: !!authSignal.value,
    isLoading,
    isAdmin: authSignal.value?.user?.isAdmin || false,
    login,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
