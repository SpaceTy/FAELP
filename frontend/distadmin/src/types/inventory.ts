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

export interface CreateMaterialInstanceInput {
  id: string;
  typeId: string;
  location: string;
}

export interface UpdateMaterialInstanceInput {
  status: MaterialStatus;
  location: string;
}

export interface AssignMaterialInstanceInput {
  requestId: string;
}
