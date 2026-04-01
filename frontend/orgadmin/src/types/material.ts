export type MaterialCategory = 'Reanimation' | 'Wundversorgung&Trauma' | 'Zubehoer';

export const MATERIAL_CATEGORY_TRANSLATION_KEYS: Record<MaterialCategory, string> = {
  Reanimation: 'materialCategories.Reanimation',
  'Wundversorgung&Trauma': 'materialCategories.Wundversorgung&Trauma',
  Zubehoer: 'materialCategories.Zubehoer',
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
