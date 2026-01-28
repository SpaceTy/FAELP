import type { AuthSession, Customer } from '@/types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const authService = {
  async requestMagicLink(email: string): Promise<void> {
    const response = await fetch(`${API_BASE}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown', message: 'Failed to send magic link' }));
      throw new AuthError(response.status, error.error, error.message);
    }
  },

  async verifyMagicLink(code: string, email?: string): Promise<AuthSession> {
    const response = await fetch(`${API_BASE}/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown', message: 'Invalid or expired code' }));
      throw new AuthError(response.status, error.error, error.message);
    }

    return response.json();
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
