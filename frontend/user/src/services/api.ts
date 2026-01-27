import type { 
  Request, 
  CreateRequestPayload, 
  ListRequestsParams, 
  ListRequestsResult 
} from '@/types/request';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
  async createRequest(payload: CreateRequestPayload): Promise<Request> {
    const response = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<Request>(response);
  }

  async getRequest(id: string): Promise<Request> {
    const response = await fetch(`${API_BASE}/requests/${id}`);
    return handleResponse<Request>(response);
  }

  async listRequests(params: ListRequestsParams): Promise<ListRequestsResult> {
    const query = new URLSearchParams();
    
    if (params.customerId) query.set('customerId', params.customerId);
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.q) query.set('q', params.q);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);

    const response = await fetch(`${API_BASE}/requests?${query}`);
    return handleResponse<ListRequestsResult>(response);
  }

  // Get my requests - separate endpoint for customer-specific requests
  async getMyRequests(params: Omit<ListRequestsParams, 'customerId'> & { customerId: string }): Promise<ListRequestsResult> {
    const query = new URLSearchParams();
    
    // customerId is required for this endpoint
    query.set('customerId', params.customerId);
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.q) query.set('q', params.q);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);

    const response = await fetch(`${API_BASE}/my-requests?${query}`);
    return handleResponse<ListRequestsResult>(response);
  }
}

export const api = new ApiService();
export { ApiError };
