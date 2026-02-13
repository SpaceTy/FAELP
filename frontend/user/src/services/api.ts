import type { Material } from '@/types/material';
import type { CreateRequestInput, Request } from '@/types/request';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'unknown',
      message: 'An unknown error occurred'
    }));
    throw new ApiError(
      response.status,
      error.error || 'unknown',
      error.message || 'An error occurred'
    );
  }
  return response.json();
}

class ApiService {
  async listMaterialTypes(): Promise<Material[]> {
    const response = await fetch(`${API_BASE}/material-types`);
    return handleResponse<Material[]>(response);
  }

  async getMaterialType(id: string): Promise<Material> {
    const response = await fetch(`${API_BASE}/material-types/${id}`);
    return handleResponse<Material>(response);
  }

  async createRequest(input: CreateRequestInput, token: string): Promise<Request> {
    const response = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    return handleResponse<Request>(response);
  }

  async getMyRequests(token: string): Promise<Request[]> {
    const response = await fetch(`${API_BASE}/requests/my`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse<Request[]>(response);
  }
}

export const api = new ApiService();
export { ApiError };
