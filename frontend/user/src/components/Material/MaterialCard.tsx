import type { Material } from '@/types/material';
import { useCart } from '@/hooks/useCart';
import { MATERIAL_CATALOG } from '@/types/material';

interface MaterialCardProps {
  material: Material;
}

export function MaterialCard({ material }: MaterialCardProps) {
  const { addItem, getItem } = useCart();
  const cartItem = getItem(material.id);

  const handleAddToCart = () => {
    addItem(material.id, 1);
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow flex flex-col">
      <div className="relative h-44 bg-gray-50 overflow-hidden">
        <img
          src={material.imageUrl}
          alt={material.name}
          className="w-full h-full object-cover"
        />
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
            className="w-full py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
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
