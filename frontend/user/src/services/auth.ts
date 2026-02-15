import type { AuthSession, Customer } from '@/types/auth';

// Use relative URL to leverage Vite proxy in development, avoiding CORS issues
// The Vite proxy forwards /api/* to the backend and rewrites to /*
const API_BASE = '/api';

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const authService = {
  async requestMagicLink(email: string): Promise<void> {
    console.log('[AUTH] requestMagicLink: sending request for email=', email);
    const response = await fetch(`${API_BASE}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown', message: 'Failed to send magic link' }));
      console.error('[AUTH] requestMagicLink: failed', response.status, error);
      throw new AuthError(response.status, error.error, error.message);
    }
    console.log('[AUTH] requestMagicLink: magic link sent successfully');
  },

  async verifyMagicLink(code: string, email?: string): Promise<AuthSession> {
    console.log('[AUTH] verifyMagicLink: verifying code for email=', email);
    const response = await fetch(`${API_BASE}/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown', message: 'Invalid or expired code' }));
      console.error('[AUTH] verifyMagicLink: failed', response.status, error);
      throw new AuthError(response.status, error.error, error.message);
    }

    const session = await response.json();
    console.log('[AUTH] verifyMagicLink: authentication successful, userId=', session.userId);
    return session;
  },

  async getCurrentUser(token: string): Promise<Customer> {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new AuthError(response.status, 'fetch_error', 'Failed to fetch user');
    }

    return response.json();
  },
};
