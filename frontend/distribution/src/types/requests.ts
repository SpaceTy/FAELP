export type RequestStatus = 'pending' | 'approved' | 'inAction' | 'returned';
export type RequestPriority = 'high' | 'normal' | 'low';

export interface RequestItem {
  materialTypeId: string;
  materialName: string;
  materialImageUrl?: string;
  quantity: number;
  availableQuantity?: number;
  shortageQuantity?: number;
  isFulfillable?: boolean;
}

export interface BorrowRequest {
  id: string;
  requesterName: string;
  requesterOrg: string;
  requesterEmail: string;
  requesterPhone: string;
  items: RequestItem[];
  purpose: string;
  requestedFor: string;
  priority: RequestPriority;
  status: RequestStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  isFulfillable?: boolean;
}

export interface RequestStats {
  pending: number;
  approved: number;
  inAction: number;
  returned: number;
  archived: number;
  total: number;
}

export interface ListRequestsParams {
  status?: RequestStatus | '';
  priority?: RequestPriority | '';
  dateRange?: 'today' | 'week' | 'older' | '';
}

export interface ApproveRequestInput {
  requestId: string;
}

export interface RejectRequestInput {
  requestId: string;
  reason: string;
}
