import { authSignal } from '@/context/AuthContext';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';
import type {
  AssignMaterialInput,
  CreateMaterialInput,
  InventorySummaryItem,
  ListMaterialInstancesParams,
  MaterialInstance,
  UpdateMaterialInput,
} from '@/types/inventory';

const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiService {
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

  async createMaterialInstance(input: CreateMaterialInput): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create material instance');
    }

    return response.json();
  }

  async listMaterialInstances(params: ListMaterialInstancesParams = {}): Promise<MaterialInstance[]> {
    const query = new URLSearchParams();
    if (params.typeId) query.set('typeId', params.typeId);
    if (params.status) query.set('status', params.status);
    if (params.location) query.set('location', params.location);
    if (typeof params.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params.offset === 'number') query.set('offset', String(params.offset));

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${API_BASE}/api/inventory${suffix}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to load inventory');
    }

    return response.json();
  }

  async getInventorySummary(): Promise<InventorySummaryItem[]> {
    const response = await fetch(`${API_BASE}/api/inventory/summary`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to load inventory summary');
    }

    return response.json();
  }

  async assignMaterialInstance(id: string, input: AssignMaterialInput): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/assign`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to assign material instance');
    }

    return response.json();
  }

  async releaseMaterialInstance(id: string): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/release`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to release material instance');
    }

    return response.json();
  }

  async updateMaterialInstance(id: string, input: UpdateMaterialInput): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to update material instance');
    }

    return response.json();
  }

  private getAuthHeaders(): Record<string, string> {
    const token = authSignal.value?.token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }
}

export const api = new ApiService();
