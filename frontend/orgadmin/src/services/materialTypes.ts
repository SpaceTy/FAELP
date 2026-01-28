import type { MaterialType, CreateMaterialTypeInput, UpdateMaterialTypeInput } from '@/types/material';
import { authSignal } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getAuthHeaders(): Record<string, string> {
  const token = authSignal.value?.token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

class MaterialTypeService {
  async listMaterialTypes(): Promise<MaterialType[]> {
    const response = await fetch(`${API_BASE}/material-types`);
    if (!response.ok) {
      throw new Error('Failed to fetch material types');
    }
    const data = await response.json();
    return data || [];
  }

  async getMaterialType(id: string): Promise<MaterialType> {
    const response = await fetch(`${API_BASE}/material-types/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch material type');
    }
    return response.json();
  }

  async createMaterialType(input: CreateMaterialTypeInput): Promise<MaterialType> {
    const response = await fetch(`${API_BASE}/material-types`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to create material type');
    }

    return response.json();
  }

  async updateMaterialType(id: string, input: UpdateMaterialTypeInput): Promise<MaterialType> {
    const response = await fetch(`${API_BASE}/material-types/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to update material type');
    }

    return response.json();
  }

  async deleteMaterialType(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/material-types/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to delete material type');
    }
  }

  async uploadImage(id: string, file: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const headers: Record<string, string> = {};
    const token = authSignal.value?.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/material-types/${id}/image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to upload image');
    }

    return response.json();
  }
}

export const materialTypeService = new MaterialTypeService();
