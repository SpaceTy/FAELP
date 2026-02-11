import { authSignal } from '@/context/AuthContext';
import type { MaterialType } from '@/types/inventory';

const API_BASE = import.meta.env.VITE_API_URL || '';

class MaterialTypesService {
  private getAuthHeaders(): Record<string, string> {
    const token = authSignal.value?.token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // Fetch all material types from the organization backend (via distribution backend)
  async getMaterialTypes(): Promise<MaterialType[]> {
    const response = await fetch(`${API_BASE}/api/material-types`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to fetch material types');
    }

    return response.json();
  }
}

export const materialTypesService = new MaterialTypesService();
