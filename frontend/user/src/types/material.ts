export type MaterialCategory = 'Reanimation' | 'Wundversorgung&Trauma' | 'Zubehoer';

export interface Material {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: MaterialCategory;
  availableCount: number;
}

export interface CartItem {
  materialId: string;
  quantity: number;
  addedAt: string;
}

export interface Cart {
  items: Record<string, CartItem>;
}

export const MATERIAL_CATALOG: Material[] = [
  // Reanimation
  {
    id: 'AED_Trainer',
    name: 'AED Trainer',
    description: 'Professional AED training device for practicing automated external defibrillator use. Realistic simulation with voice prompts and visual indicators.',
    imageUrl: '/assets/material/Reanimation/AED_Trainer.webp',
    category: 'Reanimation',
    availableCount: 0
  },
  {
    id: 'Laerdal_Family_Satz',
    name: 'Laerdal Family Satz',
    description: 'Complete family CPR training set including adult, child, and infant manikins. Comprehensive solution for teaching CPR across all age groups.',
    imageUrl: '/assets/material/Reanimation/Laerdal_Family_Satz.webp',
    category: 'Reanimation',
    availableCount: 0
  },
  {
    id: 'Mini-Anne_10er',
    name: 'Mini-Anne 10er',
    description: 'Pack of 10 Mini-Anne CPR training manikins, ideal for group training sessions.',
    imageUrl: '/assets/material/Reanimation/Mini-Anne_10er.webp',
    category: 'Reanimation',
    availableCount: 0
  },
  {
    id: 'Mini-Anne_einzeln',
    name: 'Mini-Anne Einzeln',
    description: 'Single Mini-Anne CPR training manikin, compact and portable.',
    imageUrl: '/assets/material/Reanimation/Mini-Anne_einzeln.webp',
    category: 'Reanimation',
    availableCount: 0
  },
  {
    id: 'QCPR_Junior_Puppe-4er',
    name: 'QCPR Junior Puppe 4er',
    description: 'Pack of 4 QCPR Junior puppets for child CPR training with real-time feedback.',
    imageUrl: '/assets/material/Reanimation/QCPR_Junior_Puppe-4er.webp',
    category: 'Reanimation',
    availableCount: 0
  },
  {
    id: 'QCPR_Junior_Puppe',
    name: 'QCPR Junior Puppe',
    description: 'QCPR Junior puppet for child CPR training with quality feedback technology.',
    imageUrl: '/assets/material/Reanimation/QCPR_Junior_Puppe.webp',
    category: 'Reanimation',
    availableCount: 0
  },
  {
    id: 'QCPR_Little_Anne',
    name: 'QCPR Little Anne',
    description: 'Advanced CPR training manikin with quality feedback technology. Real-time performance tracking for compression depth and rate.',
    imageUrl: '/assets/material/Reanimation/QCPR_Little_Anne.webp',
    category: 'Reanimation',
    availableCount: 0
  },
  // Wundversorgung & Trauma
  {
    id: 'Dreieckstuch',
    name: 'Dreieckstuch',
    description: 'Triangular bandage for wound care and immobilization training.',
    imageUrl: '/assets/material/Wundversorgung&Trauma/Dreieckstuch.webp',
    category: 'Wundversorgung&Trauma',
    availableCount: 0
  },
  {
    id: 'Fixierbinde',
    name: 'Fixierbinde',
    description: 'Fixation bandage for securing dressings and wound care training.',
    imageUrl: '/assets/material/Wundversorgung&Trauma/Fixierbinde.webp',
    category: 'Wundversorgung&Trauma',
    availableCount: 0
  },
  {
    id: 'Rettungsdecke',
    name: 'Rettungsdecke',
    description: 'Emergency blanket for shock prevention and temperature regulation training.',
    imageUrl: '/assets/material/Wundversorgung&Trauma/Rettungsdecke.webp',
    category: 'Wundversorgung&Trauma',
    availableCount: 0
  },
  {
    id: 'Sterile_Kompressen-10x10',
    name: 'Sterile Kompressen 10x10',
    description: 'Sterile gauze compresses (10x10cm) for wound care training exercises.',
    imageUrl: '/assets/material/Wundversorgung&Trauma/Sterile_Kompressen-10x10.webp',
    category: 'Wundversorgung&Trauma',
    availableCount: 0
  },
  {
    id: 'Tourniquet',
    name: 'Tourniquet',
    description: 'Combat application tourniquet for severe bleeding control training.',
    imageUrl: '/assets/material/Wundversorgung&Trauma/Tourniquet.webp',
    category: 'Wundversorgung&Trauma',
    availableCount: 0
  },
  // Zubehoer
  {
    id: 'Airwaykopf',
    name: 'Airwaykopf',
    description: 'Airway management training head for practicing intubation and airway techniques.',
    imageUrl: '/assets/material/Zubehoer/Airwaykopf.webp',
    category: 'Zubehoer',
    availableCount: 0
  },
  {
    id: 'Apollo_Uebungsmatte',
    name: 'Apollo Übungsmatte',
    description: 'Apollo training mat for CPR practice, providing a stable and comfortable surface.',
    imageUrl: '/assets/material/Zubehoer/Apollo_Uebungsmatte.webp',
    category: 'Zubehoer',
    availableCount: 0
  }
];

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  'Reanimation': 'Reanimation',
  'Wundversorgung&Trauma': 'Wundversorgung & Trauma',
  'Zubehoer': 'Zubehör'
};
