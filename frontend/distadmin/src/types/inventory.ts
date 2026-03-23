export type MaterialStatus = 'available' | 'rented' | 'returned' | 'archived';

export interface MaterialType {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  availableCount: number;
}

export interface MaterialInstance {
  id: string;
  humanCode: string;
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
  humanCode: string;
  typeId: string;
  description?: string;
  location: string;
}

export interface UpdateMaterialInstanceInput {
  status: MaterialStatus;
  location: string;
  useCount: number;
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
  humanCode?: string;
}
