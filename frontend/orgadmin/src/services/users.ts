import { authSignal } from '@/context/AuthContext';
import type { UserImportResult, UserRecord } from '@/types/user';

const API_BASE = '/api';

function getAuthHeaders(json = true): Record<string, string> {
  const token = authSignal.value?.token;
  const headers: Record<string, string> = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

class UserService {
  async listUsers(): Promise<UserRecord[]> {
    const response = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders(false),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    const data = await response.json();
    return data || [];
  }

  async verifyUser(userId: string): Promise<UserRecord> {
    const response = await fetch(`${API_BASE}/users/${userId}/verify`, {
      method: 'POST',
      headers: getAuthHeaders(false),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to verify user');
    }
    const data = await response.json();
    return data.user;
  }

  async importUsers(input: { emailsText?: string; file?: File | null }): Promise<UserImportResult> {
    let response: Response;

    if (input.file) {
      const formData = new FormData();
      formData.append('file', input.file);

      const headers = getAuthHeaders(false);
      response = await fetch(`${API_BASE}/users/import`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } else {
      response = await fetch(`${API_BASE}/users/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ csv: input.emailsText || '' }),
      });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to import users');
    }

    return response.json();
  }
}

export const userService = new UserService();
