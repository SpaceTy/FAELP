export type MaterialStatus = 'available' | 'rented' | 'returned';

export interface MaterialInstance {
  id: string;
  typeId: string;
  description: string;
  status: MaterialStatus;
  useCount: number;
  location: string;
  currentRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialInstanceInput {
  typeId: string;
  description?: string;
  location: string;
}

export interface UpdateMaterialInstanceInput {
  status: MaterialStatus;
  location: string;
}

export interface AssignMaterialInstanceInput {
  requestId: string;
}

export interface InventorySummary {
  typeId: string;
  status: MaterialStatus;
  count: number;
}

export interface InventoryFilters {
  typeId?: string;
  status?: MaterialStatus;
  location?: string;
}
