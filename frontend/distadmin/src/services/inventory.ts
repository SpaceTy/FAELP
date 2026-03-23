import { authSignal } from '@/context/AuthContext';
import type {
  MaterialInstance,
  CreateMaterialInstanceInput,
  UpdateMaterialInstanceInput,
  AssignMaterialInstanceInput,
  InventorySummary,
} from '@/types/inventory';

const API_BASE = '';

class InventoryService {
  private getAuthHeaders(): Record<string, string> {
    const token = authSignal.value?.token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async generateMaterialCode(): Promise<string> {
    const response = await fetch(`${API_BASE}/api/inventory/code`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to generate inventory code');
    }

    const data: { humanCode: string } = await response.json();
    return data.humanCode;
  }

  // List material instances with optional filters
  async listMaterialInstances(filters?: {
    typeId?: string;
    status?: string;
    location?: string;
    humanCode?: string;
    sort?: 'updatedAtDesc' | 'useCountAsc' | 'useCountDesc';
    limit?: number;
    offset?: number;
  }): Promise<MaterialInstance[]> {
    const params = new URLSearchParams();
    if (filters?.typeId) params.append('typeId', filters.typeId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.location) params.append('location', filters.location);
    if (filters?.humanCode) params.append('humanCode', filters.humanCode);
    if (filters?.sort && filters.sort !== 'updatedAtDesc') params.append('sort', filters.sort);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    const url = `${API_BASE}/api/inventory${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to list inventory items');
    }

    return response.json();
  }

  // Get a single material instance by ID
  async getMaterialInstance(id: string): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to get inventory item');
    }

    return response.json();
  }

  // Create a new material instance
  async createMaterialInstance(input: CreateMaterialInstanceInput): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create inventory item');
    }

    return response.json();
  }

  // Update a material instance
  async updateMaterialInstance(id: string, input: UpdateMaterialInstanceInput): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to update inventory item');
    }

    return response.json();
  }

  // Delete a material instance
  async deleteMaterialInstance(id: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to delete inventory item');
    }

    return response.json();
  }

  // Archive a material instance
  async archiveMaterialInstance(id: string): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/archive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to archive inventory item');
    }

    return response.json();
  }

  // Unarchive a material instance
  async unarchiveMaterialInstance(id: string): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/unarchive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to unarchive inventory item');
    }

    return response.json();
  }

  // Assign a material instance to a request
  async assignMaterialInstance(id: string, input: AssignMaterialInstanceInput): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/assign`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to assign inventory item');
    }

    return response.json();
  }

  // Release a material instance from a request
  async releaseMaterialInstance(id: string): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/release`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to release inventory item');
    }

    return response.json();
  }

  // Get inventory summary (count by type and status)
  async getInventorySummary(): Promise<InventorySummary[]> {
    const response = await fetch(`${API_BASE}/api/inventory/summary`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to get inventory summary');
    }

    return response.json();
  }

  // Get available instances by type
  async getAvailableByType(typeId: string, limit?: number): Promise<MaterialInstance[]> {
    const params = new URLSearchParams();
    params.append('typeId', typeId);
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE}/api/inventory/available?${params.toString()}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to get available inventory');
    }

    return response.json();
  }
}

export const inventoryService = new InventoryService();
