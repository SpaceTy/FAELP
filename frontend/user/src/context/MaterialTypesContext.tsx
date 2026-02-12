import { createContext, ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { api } from '@/services/api';
import { materialSse } from '@/services/materialSse';
import type { Material, MaterialCategory } from '@/types/material';

interface MaterialTypesContextValue {
  materials: Material[];
  materialsById: Map<string, Material>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const MaterialTypesContext = createContext<MaterialTypesContextValue | null>(null);

// Helper to determine category from material ID (based on image path or ID patterns)
function determineCategory(material: Material): MaterialCategory {
  // If the material already has a valid category, return it
  if (material.category) {
    return material.category;
  }
  
  // Determine category based on ID patterns
  const id = material.id.toLowerCase();
  
  // Wundversorgung & Trauma items
  if (id.includes('dreieckstuch') || 
      id.includes('fixierbinde') || 
      id.includes('rettungsdecke') || 
      id.includes('kompressen') || 
      id.includes('tourniquet')) {
    return 'Wundversorgung&Trauma';
  }
  
  // Zubehoer items
  if (id.includes('airway') || 
      id.includes('matte') || 
      id.includes('apollo')) {
    return 'Zubehoer';
  }
  
  // Default to Reanimation
  return 'Reanimation';
}

// Helper to ensure image URL is properly formatted
function ensureImageUrl(material: Material): string {
  if (!material.imageUrl) {
    // Generate default image path based on category and ID
    const category = determineCategory(material);
    return `/assets/material/${category}/${material.id}.webp`;
  }
  return material.imageUrl;
}

export function MaterialTypesProvider({ children }: { children: ComponentChildren }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listMaterialTypes();
      // Enrich materials with category and ensure image URLs
      const enrichedMaterials = data.map(m => ({
        ...m,
        category: determineCategory(m),
        imageUrl: ensureImageUrl(m)
      }));
      setMaterials(enrichedMaterials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('Materials state changed:', materials.map(m => ({ id: m.id, count: m.availableCount })));
  }, [materials]);

  useEffect(() => {
    fetchMaterials();

    // Subscribe to real-time material availability updates
    const subscription = materialSse.subscribeToAvailability((event) => {
      console.log('SSE Event received:', event);
      if (event.type === 'snapshot' && event.materials) {
        console.log('Processing snapshot:', event.materials.length, 'materials');
        // Update all materials with the snapshot
        const enrichedMaterials = event.materials.map(m => ({
          ...m,
          category: determineCategory(m),
          imageUrl: ensureImageUrl(m)
        }));
        setMaterials(enrichedMaterials);
      } else if (event.type === 'update' && event.material) {
        console.log('Processing update for:', event.material.id, 'availableCount:', event.material.availableCount);
        // Update single material (or add if not exists)
        setMaterials(prev => {
          const index = prev.findIndex(m => m.id === event.material!.id);
          console.log('Found index:', index, 'current value:', prev[index]?.availableCount, 'prev length:', prev.length);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = {
              ...event.material!,
              category: determineCategory(event.material!),
              imageUrl: ensureImageUrl(event.material!)
            };
            console.log('Updated value:', updated[index].availableCount);
            return updated;
          } else {
            // Material not found, add it
            console.log('Material not found, adding new:', event.material!.id);
            return [...prev, {
              ...event.material!,
              category: determineCategory(event.material!),
              imageUrl: ensureImageUrl(event.material!)
            }];
          }
        });
      } else if (event.type === 'error') {
        console.error('Material SSE error:', event.message);
      }
    }, (error) => {
      console.error('Material SSE connection error:', error);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const materialsById = new Map(materials.map(m => [m.id, m]));

  return (
    <MaterialTypesContext.Provider 
      value={{ 
        materials, 
        materialsById, 
        isLoading, 
        error,
        refetch: fetchMaterials 
      }}
    >
      {children}
    </MaterialTypesContext.Provider>
  );
}

export function useMaterialTypes() {
  const context = useContext(MaterialTypesContext);
  if (!context) {
    throw new Error('useMaterialTypes must be used within MaterialTypesProvider');
  }
  return context;
}

export function useMaterial(materialId: string | null): Material | undefined {
  const { materialsById } = useMaterialTypes();
  return materialId ? materialsById.get(materialId) : undefined;
}
