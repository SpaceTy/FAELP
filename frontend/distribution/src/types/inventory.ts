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

export interface InventorySummaryItem {
  typeId: string;
  status: MaterialStatus;
  count: number;
}

export interface ListMaterialInstancesParams {
  typeId?: string;
  status?: MaterialStatus | '';
  location?: string;
  humanCode?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface CreateMaterialInput {
  humanCode: string;
  typeId: string;
  description: string;
  useCount: number;
  location: string;
}

export interface BulkCreateMaterialInput {
  typeId: string;
  quantity: number;
  acknowledged: boolean;
}

export interface BulkCreateMaterialResponse {
  createdCount: number;
}

export interface AssignMaterialInput {
  requestId: string;
}

export interface UpdateMaterialInput {
  status: MaterialStatus;
  location: string;
}

export interface ImportInventoryResponse {
  importedCount: number;
  createdCount: number;
  updatedCount: number;
}
