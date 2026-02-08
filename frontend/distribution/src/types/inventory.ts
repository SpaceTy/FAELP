export type MaterialStatus = 'available' | 'rented' | 'returned';

export interface MaterialInstance {
  id: string;
  typeId: string;
  status: MaterialStatus;
  useCount: number;
  location: string;
  currentRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummaryItem {
  typeId: string;
  status: MaterialStatus;
  count: number;
}

export interface ListMaterialInstancesParams {
  typeId?: string;
  status?: MaterialStatus | '';
  location?: string;
  limit?: number;
  offset?: number;
}

export interface AssignMaterialInput {
  requestId: string;
}

export interface UpdateMaterialInput {
  status: MaterialStatus;
  location: string;
}
