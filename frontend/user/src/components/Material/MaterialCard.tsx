import type { Material } from '@/types/material';
import { addItem, getItem, updateQuantity } from '@/hooks/useCart';
import { useI18n } from '@/i18n';
import { resolveAssetUrl } from '@/utils/url';

interface MaterialCardProps {
  material: Material;
}

function getFullImageUrl(imageUrl: string | undefined): string {
  return resolveAssetUrl(imageUrl);
}

export function MaterialCard({ material }: MaterialCardProps) {
  const { t } = useI18n();
  const cartItem = getItem(material.id);

  const handleAddToCart = () => {
    addItem(material.id, 1);
  };

  const handleDecreaseQuantity = () => {
    if (cartItem) {
      updateQuantity(material.id, cartItem.quantity - 1);
    }
  };

  const handleIncreaseQuantity = () => {
    if (cartItem && cartItem.quantity < material.availableCount) {
      addItem(material.id, 1);
    }
  };

  const isAvailable = material.availableCount > 0;
  const isMaxReached = cartItem && cartItem.quantity >= material.availableCount;

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow flex flex-col">
      <div className="relative h-44 bg-gray-50 overflow-hidden">
        <img
          src={getFullImageUrl(material.imageUrl)}
          alt={material.name}
          className="w-full h-full object-cover"
        />
        {isAvailable && (
          <div className={`absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-full ${cartItem && cartItem.quantity >= material.availableCount ? 'bg-amber-500' : 'bg-green-500'}`}>
            {t('materialCard.available', { count: material.availableCount })}
          </div>
        )}
        {!isAvailable && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            {t('materialCard.unavailable')}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-secondary mb-1">
          {material.name}
        </h3>
        <div className="flex gap-2 mb-2">
          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-text-secondary">
            {t('materialCard.practiceSet')}
          </span>
          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-text-secondary">
            {t('materialCard.allLevels')}
          </span>
        </div>
        <p className="text-sm text-text-secondary mb-4 flex-1 line-clamp-3">
          {material.description}
        </p>
        <div className="text-xs text-text-secondary mb-3">
          {t('materialCard.physicalEquipment')}
        </div>
        <div className="flex flex-col gap-2">
          {cartItem ? (
            <div className="w-full h-[42px] flex items-center bg-white border border-gray-300 rounded overflow-hidden">
              <button
                onClick={handleDecreaseQuantity}
                className="w-10 h-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors text-secondary font-bold"
                aria-label={t('materialCard.decreaseQuantity')}
              >
                −
              </button>
              <div className={`flex-1 text-center font-medium ${isMaxReached ? 'text-amber-600' : 'text-secondary'}`}>
                {cartItem.quantity}
              </div>
              <button
                onClick={handleIncreaseQuantity}
                disabled={isMaxReached}
                className={`w-10 h-full flex items-center justify-center transition-colors font-bold ${
                  isMaxReached
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-secondary hover:bg-primary-hover'
                }`}
                aria-label={t('materialCard.increaseQuantity')}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className={`w-full py-2 font-medium rounded transition-colors ${
                isAvailable
                  ? 'bg-primary text-secondary hover:bg-primary-hover'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {t('materialCard.requestMaterial')}
            </button>
          )}
          <button className="w-full py-2 bg-white border border-gray-300 text-text-primary rounded hover:bg-gray-50 transition-colors">
            {t('materialCard.showDetails')}
          </button>
        </div>
      </div>
    </div>
  );
}
