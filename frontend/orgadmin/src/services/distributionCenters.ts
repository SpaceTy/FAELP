import { authSignal } from '@/context/AuthContext';
import type { DistributionCenter, LinkRequest } from '@/types/distributionCenter';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getAuthHeaders(): Record<string, string> {
  const token = authSignal.value?.token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const error = await response.json().catch(() => ({ message: fallback }));
  throw new Error(error.message || fallback);
}

class DistributionCenterService {
  async listLinkRequests(state = ''): Promise<LinkRequest[]> {
    const query = state ? `?state=${encodeURIComponent(state)}` : '';
    const response = await fetch(`${API_BASE}/interbackend/link-requests${query}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return parseError(response, 'Failed to fetch link requests');
    }
    return response.json();
  }

  async listCenters(state = ''): Promise<DistributionCenter[]> {
    const query = state ? `?state=${encodeURIComponent(state)}` : '';
    const response = await fetch(`${API_BASE}/interbackend/centers${query}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return parseError(response, 'Failed to fetch centers');
    }
    return response.json();
  }

  async approveLinkRequest(id: string, adminNote: string): Promise<LinkRequest> {
    const response = await fetch(`${API_BASE}/interbackend/link-requests/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminNote }),
    });
    if (!response.ok) {
      return parseError(response, 'Failed to approve request');
    }
    return response.json();
  }

  async rejectLinkRequest(id: string, reason: string): Promise<LinkRequest> {
    const response = await fetch(`${API_BASE}/interbackend/link-requests/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      return parseError(response, 'Failed to reject request');
    }
    return response.json();
  }

  async findByToken(challengeToken: string): Promise<LinkRequest | null> {
    const response = await fetch(`${API_BASE}/interbackend/link-requests/find-by-token`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ challengeToken }),
    });
    if (!response.ok) {
      return parseError(response, 'Failed to find request by token');
    }
    const data = await response.json();
    return data.match || null;
  }

  async reactivateCenter(id: string, note: string): Promise<DistributionCenter> {
    const response = await fetch(`${API_BASE}/interbackend/centers/${id}/reactivate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ note }),
    });
    if (!response.ok) {
      return parseError(response, 'Failed to reactivate center');
    }
    return response.json();
  }
}

export const distributionCenterService = new DistributionCenterService();
