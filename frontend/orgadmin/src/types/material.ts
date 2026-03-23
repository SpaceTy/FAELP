export type MaterialCategory = 'Reanimation' | 'Wundversorgung&Trauma' | 'Zubehoer';

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  Reanimation: 'Reanimation',
  'Wundversorgung&Trauma': 'Wundversorgung & Trauma',
  Zubehoer: 'Zubehör',
};

export interface MaterialType {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: MaterialCategory;
}

export interface CreateMaterialTypeInput {
  name: string;
  description: string;
  category: MaterialCategory;
  imageUrl?: string;
}

export interface UpdateMaterialTypeInput {
  name: string;
  description: string;
  category: MaterialCategory;
}
