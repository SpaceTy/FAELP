import { createContext, ComponentChildren } from 'preact';
import { useContext, useState, useEffect, useCallback } from 'preact/hooks';
import { signal } from '@preact/signals';
import { API_REFRESH_INTERVAL_MS } from '@/constants/polling';
import type { Customer, AuthSession } from '@/types/auth';
import { authService, AuthError } from '@/services/auth';

interface AuthContextType {
  userId: string | null;
  customer: Customer | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  verifyCode: (code: string, email?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const STORAGE_KEY = 'faelp_auth_session';

export const authSignal = signal<AuthSession | null>(null);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [isLoading, setIsLoading] = useState(true);
  const clearSession = useCallback(() => {
    authSignal.value = null;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    let refreshIntervalId: number | undefined;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: AuthSession = JSON.parse(stored);
        // Ensure userId is set for backwards compatibility with old sessions
        const sessionWithUserId = {
          ...parsed,
          userId: parsed.userId || parsed.customer?.id,
        };
        authSignal.value = sessionWithUserId;

        const refreshCurrentUser = async () => {
          try {
            const customer = await authService.getCurrentUser(sessionWithUserId.token);
            const updatedSession = { ...sessionWithUserId, customer, userId: customer.id };
            authSignal.value = updatedSession;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
          } catch (err) {
            // Only clear session on auth errors (token invalid/expired), not transient network issues
            if (err instanceof AuthError && (err.status === 401 || err.status === 403)) {
              clearSession();
            }
          }
        };

        refreshCurrentUser();
        refreshIntervalId = window.setInterval(refreshCurrentUser, API_REFRESH_INTERVAL_MS);
      } catch {
        clearSession();
      }
    }
    setIsLoading(false);
    return () => {
      if (refreshIntervalId) {
        window.clearInterval(refreshIntervalId);
      }
    };
  }, [clearSession]);

  const login = useCallback(async (email: string) => {
    console.log('[AUTH_CONTEXT] login: requesting magic link for email=', email);
    await authService.requestMagicLink(email);
    console.log('[AUTH_CONTEXT] login: magic link request completed');
  }, []);

  const verifyCode = useCallback(async (code: string, email?: string) => {
    console.log('[AUTH_CONTEXT] verifyCode: verifying code for email=', email);
    const session = await authService.verifyMagicLink(code, email);
    console.log('[AUTH_CONTEXT] verifyCode: got session, userId=', session.userId);
    const sessionWithUserId = {
      ...session,
      userId: session.userId || session.customer.id,
    };
    authSignal.value = sessionWithUserId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionWithUserId));
    console.log('[AUTH_CONTEXT] verifyCode: session stored, user authenticated');
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value: AuthContextType = {
    userId: authSignal.value?.userId || null,
    customer: authSignal.value?.customer || null,
    isAuthenticated: !!authSignal.value,
    isVerified: !!authSignal.value?.customer?.emailVerified,
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
