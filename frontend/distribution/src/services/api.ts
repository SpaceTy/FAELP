import { authSignal } from '@/context/AuthContext';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';
import type {
  AssignMaterialInput,
  CreateMaterialInput,
  ImportInventoryResponse,
  InventorySummaryItem,
  ListMaterialInstancesParams,
  MaterialInstance,
  UpdateMaterialInput,
} from '@/types/inventory';
import type { RequestStatus } from '@/types/requests';
import { resolveAssetUrl } from '@/utils/url';

const API_BASE = '';

class ApiService {
  async generateMaterialCode(): Promise<string> {
    const response = await fetch(`${API_BASE}/api/inventory/code`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to generate material code');
    }

    const data: { humanCode: string } = await response.json();
    return data.humanCode;
  }

  async validateMaterialCode(code: string, typeId?: string): Promise<{ valid: boolean; code?: string; typeId?: string; typeIdMatch?: boolean; error?: string }> {
    const query = new URLSearchParams();
    query.set('code', code);
    if (typeId) query.set('typeId', typeId);

    const response = await fetch(`${API_BASE}/api/inventory/validate-code?${query.toString()}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to validate material code');
    }

    return response.json();
  }

  async listIncomingRequests(status: RequestStatus | '' = 'pending', archived = false): Promise<IncomingRequest[]> {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    query.set('archived', archived ? 'true' : 'false');
    const suffix = query.toString() ? `?${query.toString()}` : '';

    const response = await fetch(`${API_BASE}/api/requests/incoming${suffix}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to load incoming requests');
    }

    const data: IncomingRequest[] = await response.json();
    return data.map(normalizeIncomingRequest);
  }

  async approveIncomingRequest(requestID: string): Promise<IncomingRequest> {
    const response = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(requestID)}/approve`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to approve request');
    }

    const data: IncomingRequest = await response.json();
    return normalizeIncomingRequest(data);
  }

  async markIncomingRequestInAction(
    requestID: string,
    outgoingTrackingCode: string,
    items?: Array<{ materialTypeId: string; codes: string[] }>
  ): Promise<IncomingRequest> {
    const response = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(requestID)}/in-action`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ outgoingTrackingCode, items }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to mark request inAction');
    }

    const data: IncomingRequest = await response.json();
    return normalizeIncomingRequest(data);
  }

  async cancelIncomingRequest(requestID: string): Promise<IncomingRequest> {
    const response = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(requestID)}/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to cancel request');
    }

    const data: IncomingRequest = await response.json();
    return normalizeIncomingRequest(data);
  }

  async archiveIncomingRequest(requestID: string): Promise<IncomingRequest> {
    const response = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(requestID)}/archive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to archive request');
    }

    const data: IncomingRequest = await response.json();
    return normalizeIncomingRequest(data);
  }

  async unarchiveIncomingRequest(requestID: string): Promise<IncomingRequest> {
    const response = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(requestID)}/unarchive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to unarchive request');
    }

    const data: IncomingRequest = await response.json();
    return normalizeIncomingRequest(data);
  }

  async inspectReturnItem(requestId: string, input: {
    itemIndex: number;
    humanCode: string;
    condition: string;
    destination: string;
    returnToInventory: boolean;
    location: string;
  }): Promise<{ id: string; humanCode: string; status: string; location: string }> {
    const response = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(requestId)}/inspect-item`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to mark item as inspected');
    }

    return response.json();
  }

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
    if (params.humanCode) query.set('humanCode', params.humanCode);
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

  async exportInventoryCSV(params: ListMaterialInstancesParams = {}): Promise<Blob> {
    const query = new URLSearchParams();
    if (params.typeId) query.set('typeId', params.typeId);
    if (params.status) query.set('status', params.status);
    if (params.location) query.set('location', params.location);
    if (params.humanCode) query.set('humanCode', params.humanCode);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${API_BASE}/api/inventory/export${suffix}`, {
      headers: this.getAuthHeaders({ jsonContentType: false }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to export inventory');
    }

    return response.blob();
  }

  async importInventoryCSV(file: File): Promise<ImportInventoryResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/inventory/import`, {
      method: 'POST',
      headers: this.getAuthHeaders({ jsonContentType: false }),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const details = Array.isArray(error.details) ? `: ${error.details.join('; ')}` : '';
      throw new Error((error.error || 'Failed to import inventory') + details);
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

  async archiveMaterialInstance(id: string): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/archive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to archive material instance');
    }

    return response.json();
  }

  async unarchiveMaterialInstance(id: string): Promise<MaterialInstance> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}/unarchive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to unarchive material instance');
    }

    return response.json();
  }

  async deleteMaterialInstance(id: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to delete material instance');
    }

    return response.json();
  }

  private getAuthHeaders(options: { jsonContentType?: boolean } = {}): Record<string, string> {
    const { jsonContentType = true } = options;
    const token = authSignal.value?.token;
    const headers: Record<string, string> = {};
    if (jsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }
}

export const api = new ApiService();

function normalizeIncomingRequest(request: IncomingRequest): IncomingRequest {
  return {
    ...request,
    items: request.items.map((item) => ({
      ...item,
      materialImageUrl: resolveAssetUrl(item.materialImageUrl),
    })),
  };
}

export interface IncomingRequestItem {
  materialTypeId: string;
  materialName: string;
  materialImageUrl: string;
  quantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  isFulfillable: boolean;
}

export interface IncomingRequest {
  id: string;
  customerId: string;
  deliveryDate: string;
  plannedReturnDate?: string;
  intendedStudents: number;
  status: RequestStatus;
  archived: boolean;
  outgoingTrackingCode?: string;
  shippingName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  zipCode: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  isFulfillable: boolean;
  items: IncomingRequestItem[];
}
