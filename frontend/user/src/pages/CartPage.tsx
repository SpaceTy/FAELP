import { useState } from 'preact/hooks';
import { Header } from '@/components/Layout/Header';
import { useCart } from '@/hooks/useCart';
import { MATERIAL_CATALOG } from '@/types/material';
import { api } from '@/services/api';
import type { CreateRequestPayload } from '@/types/request';

export function CartPage() {
  const { items, itemCount, updateQuantity, removeItem, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form state
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [shippingCustomerName, setShippingCustomerName] = useState('');
  const [shippingAddress, setShippingAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    zipCode: ''
  });
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  const cartMaterials = Object.entries(items).map(([materialId, cartItem]) => {
    const material = MATERIAL_CATALOG.find(m => m.id === materialId);
    return { material, cartItem };
  }).filter(({ material }) => material !== undefined);

  const totalUnits = Object.values(items).reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateRequestPayload = {
        customerEmail,
        customerName,
        shippingCustomerName: shippingCustomerName || customerName,
        shippingAddress,
        deliveryDate: new Date(deliveryDate).toISOString(),
        items: Object.fromEntries(
          Object.entries(items).map(([id, item]) => [id, item.quantity])
        ),
        metadata: notes ? { note: notes } : undefined
      };

      await api.createRequest(payload);
      setSubmitSuccess(true);
      clearCart();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Anfrage konnte nicht erstellt werden');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-semibold text-secondary mb-2">
              Anfrage erfolgreich!
            </h2>
            <p className="text-text-secondary mb-6">
              Ihre Materialanfrage wurde erfolgreich übermittelt. Sie erhalten eine Bestätigung per E-Mail.
            </p>
            <a
              href="/materials"
              className="inline-block px-6 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
            >
              Weitere Materialien anfragen
            </a>
          </div>
        </main>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-lg shadow-sm text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-semibold text-secondary mb-2">
              Ihr Warenkorb ist leer
            </h2>
            <p className="text-text-secondary mb-6">
              Durchsuchen Sie unsere Materialien und fügen Sie Artikel zu Ihrem Anfrage-Warenkorb hinzu.
            </p>
            <a
              href="/materials"
              className="inline-block px-6 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors"
            >
              Materialien durchsuchen
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {/* Cart Items */}
        <section className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <h2 className="text-2xl font-semibold text-secondary">
              Anfrage-Warenkorb
            </h2>
            <p className="text-text-secondary">
              {itemCount} Artikel im Warenkorb
            </p>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
              <p>Fehler: {submitError}</p>
            </div>
          )}

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

        {/* Checkout Form */}
        <aside className="w-96 bg-white p-6 overflow-y-auto shadow-sm">
          <h3 className="text-lg font-semibold text-secondary mb-4">
            Anfrage-Details
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                E-Mail *
              </label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Lieferdatum *
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDeliveryDate((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Empfängername (falls abweichend)
              </label>
              <input
                type="text"
                value={shippingCustomerName}
                onChange={(e) => setShippingCustomerName((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Straße und Hausnummer *
              </label>
              <input
                type="text"
                required
                value={shippingAddress.line1}
                onChange={(e) => setShippingAddress(prev => ({ ...prev, line1: (e.target as HTMLInputElement).value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Adresszusatz
              </label>
              <input
                type="text"
                value={shippingAddress.line2}
                onChange={(e) => setShippingAddress(prev => ({ ...prev, line2: (e.target as HTMLInputElement).value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  PLZ *
                </label>
                <input
                  type="text"
                  required
                  value={shippingAddress.zipCode}
                  onChange={(e) => setShippingAddress(prev => ({ ...prev, zipCode: (e.target as HTMLInputElement).value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Ort *
                </label>
                <input
                  type="text"
                  required
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress(prev => ({ ...prev, city: (e.target as HTMLInputElement).value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Notizen
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between mb-2">
                <span>Gesamt Artikel:</span>
                <span>{cartMaterials.length}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span>Gesamt Einheiten:</span>
                <span>{totalUnits}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-primary text-secondary font-semibold rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Wird gesendet...' : 'Anfrage einreichen'}
              </button>
            </div>
          </form>
        </aside>
      </main>
    </div>
  );
}
