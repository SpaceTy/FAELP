import { authSignal } from '@/context/AuthContext';
import type { MaterialType } from '@/types/inventory';
import { resolveAssetUrl } from '@/utils/url';

const API_BASE = '';

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

    const materialTypes: MaterialType[] = await response.json();
    return materialTypes.map((mt) => ({
      ...mt,
      imageUrl: resolveAssetUrl(mt.imageUrl),
    }));
  }
}

export const materialTypesService = new MaterialTypesService();
