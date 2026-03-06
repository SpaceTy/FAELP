import { useState } from 'preact/hooks';
import { cartSignal, getItemCount, updateQuantity, removeItem, clearCart } from '@/hooks/useCart';
import { useMaterialTypes } from '@/context/MaterialTypesContext';
import { useAuth } from '@/context/AuthContext';
import { RequestForm } from '@/components/Cart/RequestForm';
import type { RequestItem } from '@/types/request';

export function CartPage() {
  const items = cartSignal.value.items;
  const itemCount = getItemCount();
  const { materialsById } = useMaterialTypes();
  const { isAuthenticated } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const cartMaterials = Object.entries(items).map(([materialId, cartItem]) => {
    const material = materialsById.get(materialId);
    return { material, cartItem };
  }).filter(({ material }) => material !== undefined);

  const totalUnits = Object.values(items).reduce((sum, item) => sum + item.quantity, 0);

  const requestItems: RequestItem[] = Object.entries(items).map(([materialId, cartItem]) => ({
    materialTypeId: materialId,
    quantity: cartItem.quantity,
  }));

  const handleSubmitSuccess = () => {
    clearCart();
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-semibold text-secondary mb-2">
            Anfrage erfolgreich gesendet
          </h2>
          <p className="text-text-secondary mb-6">
            Ihre Anfrage wurde erfolgreich übermittelt. Sie erhalten eine Bestätigung per E-Mail.
          </p>
          <a
            href="/materials"
            className="inline-block px-6 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors"
          >
            Weiter stöbern
          </a>
        </div>
      </main>
    );
  }

  if (itemCount === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-lg shadow-sm text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-semibold text-secondary mb-2">
              Ihr Warenkorb ist leer
            </h2>
            <p className="text-text-secondary mb-6">
              Durchsuchen Sie unsere Materialien und fügen Sie Artikel zu Ihrem Warenkorb hinzu.
            </p>
            <a
              href="/materials"
              className="inline-block px-6 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
            >
              Materialien durchsuchen
            </a>
          </div>
        </main>
    );
  }

  return (
    <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-secondary">
                Warenkorb
              </h2>
              <p className="text-text-secondary">
                {itemCount} Artikel im Warenkorb
              </p>
            </div>
            <button
              onClick={clearCart}
              className="px-4 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              Warenkorb leeren
            </button>
          </div>

          <div className="space-y-4">
            {cartMaterials.map(({ material, cartItem }) => material && (
              <div key={material.id} className="bg-white p-4 rounded-lg shadow-sm flex gap-4">
                <div className="w-24 h-24 flex-shrink-0 bg-gray-50 rounded overflow-hidden">
                  <img
                    src={material.imageUrl}
                    alt={material.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-secondary">{material.name}</h3>
                  <p className="text-sm text-text-secondary line-clamp-2">{material.description}</p>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(material.id, cartItem.quantity - 1)}
                        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(material.id, cartItem.quantity + 1)}
                        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(material.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="w-96 bg-white p-6 overflow-y-auto shadow-sm">
          <h3 className="text-lg font-semibold text-secondary mb-4">
            Zusammenfassung
          </h3>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-text-secondary">Artikel:</span>
              <span className="font-medium">{cartMaterials.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Einheiten:</span>
              <span className="font-medium">{totalUnits}</span>
            </div>
          </div>

          <div className="pt-4 border-t">
            {isAuthenticated ? (
              <RequestForm items={requestItems} onSuccess={handleSubmitSuccess} />
            ) : (
              <div className="text-center">
                <p className="text-sm text-text-secondary mb-4">
                  Bitte melden Sie sich an, um eine Anfrage zu senden.
                </p>
                <a
                  href="/login"
                  className="block w-full py-3 bg-primary text-white font-semibold rounded hover:bg-primary-hover transition-colors text-center"
                >
                  Anmelden
                </a>
              </div>
            )}
          </div>
        </aside>
      </main>
  );
}
