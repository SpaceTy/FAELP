export type RequestStatus = 'pending' | 'inAction' | 'returned';

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  zipCode: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  token: string;
  createdAt: string;
}

export interface Request {
  id: string;
  customer: Customer;
  items: Record<string, number>;
  deliveryDate: string;
  status: RequestStatus;
  shippingCustomerName: string;
  shippingAddress: ShippingAddress;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface CreateRequestPayload {
  customerEmail: string;
  customerName: string;
  deliveryDate: string;
  status?: string;
  shippingCustomerName: string;
  shippingAddress: ShippingAddress;
  items: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface ListRequestsParams {
  customerId?: string;
  status?: RequestStatus;
  limit?: number;
  cursor?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface ListRequestsResult {
  requests: Request[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface RequestEvent {
  type: 'snapshot' | 'update' | 'deleted';
  action: string;
  request?: Request;
  requestId: string;
  updatedAt: string;
}
