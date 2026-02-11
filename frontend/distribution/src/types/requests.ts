export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type RequestPriority = 'high' | 'normal' | 'low';

export interface RequestItem {
  materialTypeId: string;
  materialName: string;
  quantity: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface RequestStats {
  pending: number;
  approved: number;
  rejected: number;
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
