import type { Material } from '@/types/material';

// Use relative URL to leverage Vite proxy in development, avoiding CORS issues
// The Vite proxy forwards /api/* to the backend and rewrites to /*
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
  // Material Types API (public)
  async listMaterialTypes(): Promise<Material[]> {
    const response = await fetch(`${API_BASE}/material-types`);
    return handleResponse<Material[]>(response);
  }

  async getMaterialType(id: string): Promise<Material> {
    const response = await fetch(`${API_BASE}/material-types/${id}`);
    return handleResponse<Material>(response);
  }
}

export const api = new ApiService();
export { ApiError };
