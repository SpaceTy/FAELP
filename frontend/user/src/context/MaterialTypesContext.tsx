import { createContext, ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { api } from '@/services/api';
import { isMaterialCategory, type Material, type MaterialCategory } from '@/types/material';

interface MaterialTypesContextValue {
  materials: Material[];
  materialsById: Map<string, Material>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const MaterialTypesContext = createContext<MaterialTypesContextValue | null>(null);

function normalizeCategory(category: string | undefined): MaterialCategory {
  return isMaterialCategory(category) ? category : 'Reanimation';
}

// Helper to ensure image URL is properly formatted
function ensureImageUrl(material: Material): string {
  if (!material.imageUrl) {
    // Generate default image path based on category and ID
    const category = normalizeCategory(material.category);
    return `/assets/material/${category}/${material.id}.webp`;
  }
  return material.imageUrl;
}

export function MaterialTypesProvider({ children }: { children: ComponentChildren }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = async (backgroundRefresh = false) => {
    if (!backgroundRefresh) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await api.listMaterialTypes();
      const enrichedMaterials = (data || []).map(m => ({
        ...m,
        category: normalizeCategory(m.category),
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
    fetchMaterials();

    const es = new EventSource('/api/material-types/subscribe');

    es.addEventListener('update', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.type === 'snapshot') {
        const enriched = (data.materials || []).map((m: Material) => ({
          ...m,
          category: normalizeCategory(m.category),
          imageUrl: ensureImageUrl(m),
        }));
        setMaterials(enriched);
      } else if (data.type === 'update' && data.material) {
        const m = data.material as Material;
        const enriched = { ...m, category: normalizeCategory(m.category), imageUrl: ensureImageUrl(m) };
        setMaterials(prev => prev.map(existing => existing.id === enriched.id ? enriched : existing));
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects; no action needed
    };

    return () => es.close();
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
