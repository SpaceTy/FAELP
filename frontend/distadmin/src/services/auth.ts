import type { 
  User, 
  LoginRequest, 
  LoginResponse, 
  CreateUserInput,
  UpdatePasswordInput,
  ResetPasswordInput,
  SetAdminInput
} from '@/types/auth';
import { authSignal } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiService {
  // Auth endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Login failed');
    }

    return response.json();
  }

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get current user');
    }

    return response.json();
  }

  async updatePassword(input: UpdatePasswordInput): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/api/auth/password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to update password');
    }

    return response.json();
  }

  // User management endpoints (admin only)
  async listUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE}/api/users`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to list users');
    }

    return response.json();
  }

  async getUser(id: string): Promise<User> {
    const response = await fetch(`${API_BASE}/api/users/${id}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get user');
    }

    return response.json();
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const response = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create user');
    }

    return response.json();
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/api/users/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to delete user');
    }

    return response.json();
  }

  async resetUserPassword(id: string, input: ResetPasswordInput): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/api/users/${id}/password`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to reset password');
    }

    return response.json();
  }

  async setUserAdmin(id: string, input: SetAdminInput): Promise<User> {
    const response = await fetch(`${API_BASE}/api/users/${id}/admin`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to update admin status');
    }

    return response.json();
  }

  private getAuthHeaders(): Record<string, string> {
    const token = authSignal.value?.token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }
}

export const api = new ApiService();
