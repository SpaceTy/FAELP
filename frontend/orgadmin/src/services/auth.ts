import type { Customer, AuthSession, MagicLinkResponse, AuthCallbackResponse } from '@/types/auth';

// Use relative URL since frontend is served by the backend
const API_BASE = '/api';

class AuthService {
  async requestMagicLink(email: string): Promise<MagicLinkResponse> {
    const response = await fetch(`${API_BASE}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to send magic link');
    }

    return response.json();
  }

  async verifyMagicLink(code: string, email?: string): Promise<AuthSession> {
    const response = await fetch(`${API_BASE}/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to verify code');
    }

    const data: AuthCallbackResponse = await response.json();
    return {
      token: data.token,
      userId: data.userId,
      customer: data.customer,
    };
  }

  async getCurrentUser(token: string): Promise<Customer> {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return response.json();
  }
}

export const authService = new AuthService();
