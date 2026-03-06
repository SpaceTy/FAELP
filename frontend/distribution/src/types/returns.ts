export type ReturnStatus = 'awaiting' | 'received' | 'inspection' | 'completed' | 'unpacked' | 'inAction' | 'returned';
export type ItemCondition = 'excellent' | 'good' | 'fair' | 'damaged' | 'missing';
export type ItemDestination = 'inventory' | 'cleaning' | 'repair' | 'writeoff';

export interface ReturnedItem {
  materialTypeId: string;
  materialName: string;
  materialImageUrl?: string;
  quantity: number;
  unitId?: string;
  condition: ItemCondition;
  destination: ItemDestination;
  location?: string;
  isInspected: boolean;
  returnToInventory: boolean;
}

export interface ReturnRecord {
  id: string;
  requestId: string;
  borrowerName: string;
  borrowerOrg: string;
  borrowerEmail: string;
  borrowerPhone: string;
  items: ReturnedItem[];
  status: ReturnStatus;
  sentDate: string;
  dueDate: string;
  receivedDate?: string;
  purpose: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnStats {
  inAction: number;
  returned: number;
  unpacked: number;
}

export interface ListReturnsParams {
  status?: ReturnStatus | '';
  dueDate?: 'overdue' | 'today' | 'week' | 'later' | '';
}

export interface InspectItemInput {
  returnId: string;
  itemIndex: number;
  condition: ItemCondition;
  destination: ItemDestination;
  returnToInventory: boolean;
}

export interface CompleteReturnInput {
  returnId: string;
}
