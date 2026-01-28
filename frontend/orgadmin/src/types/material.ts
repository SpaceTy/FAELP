export interface MaterialType {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface CreateMaterialTypeInput {
  name: string;
  description: string;
  imageUrl?: string;
}

export interface UpdateMaterialTypeInput {
  name: string;
  description: string;
}
