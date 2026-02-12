import type { DistributionCenter, CreateDistributionCenterInput, UpdateDistributionCenterInput } from '@/types/distributionCenter';
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

class DistributionCenterService {
  async listDistributionCenters(): Promise<DistributionCenter[]> {
    const response = await fetch(`${API_BASE}/distribution-centers`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch distribution centers');
    }
    const data = await response.json();
    return data || [];
  }

  async getDistributionCenter(id: string): Promise<DistributionCenter> {
    const response = await fetch(`${API_BASE}/distribution-centers/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch distribution center');
    }
    return response.json();
  }

  async createDistributionCenter(input: CreateDistributionCenterInput): Promise<DistributionCenter> {
    const response = await fetch(`${API_BASE}/distribution-centers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to create distribution center');
    }

    return response.json();
  }

  async updateDistributionCenter(id: string, input: UpdateDistributionCenterInput): Promise<DistributionCenter> {
    const response = await fetch(`${API_BASE}/distribution-centers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to update distribution center');
    }

    return response.json();
  }

  async deleteDistributionCenter(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/distribution-centers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Failed to delete distribution center');
    }
  }
}

export const distributionCenterService = new DistributionCenterService();
