import type { Material } from '@/types/material';
import { useCart } from '@/hooks/useCart';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface MaterialCardProps {
  material: Material;
}

function getFullImageUrl(imageUrl: string | undefined): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

export function MaterialCard({ material }: MaterialCardProps) {
  const { addItem, getItem } = useCart();
  const cartItem = getItem(material.id);

  const handleAddToCart = () => {
    addItem(material.id, 1);
  };

  const isAvailable = material.availableCount > 0;

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow flex flex-col">
      <div className="relative h-44 bg-gray-50 overflow-hidden">
        <img
          src={getFullImageUrl(material.imageUrl)}
          alt={material.name}
          className="w-full h-full object-cover"
        />
        {isAvailable && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
            {material.availableCount} verfügbar
          </div>
        )}
        {!isAvailable && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            Nicht verfügbar
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-secondary mb-1">
          {material.name}
        </h3>
        <div className="flex gap-2 mb-2">
          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-text-secondary">
            Übungs-Set
          </span>
          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-text-secondary">
            Alle Niveaus
          </span>
        </div>
        <p className="text-sm text-text-secondary mb-4 flex-1 line-clamp-3">
          {material.description}
        </p>
        <div className="text-xs text-text-secondary mb-3">
          Physische Ausrüstung
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className={`w-full py-2 font-medium rounded transition-colors ${
              isAvailable
                ? 'bg-primary text-secondary hover:bg-primary-hover'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {cartItem ? `Im Warenkorb (${cartItem.quantity})` : 'Material anfragen'}
          </button>
          <button className="w-full py-2 bg-white border border-gray-300 text-text-primary rounded hover:bg-gray-50 transition-colors">
            Details anzeigen
          </button>
        </div>
      </div>
    </div>
  );
}
