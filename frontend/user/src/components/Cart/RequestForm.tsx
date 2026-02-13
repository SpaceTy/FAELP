import { useState } from 'preact/hooks';
import { api, ApiError } from '@/services/api';
import { authSignal } from '@/context/AuthContext';
import type { CreateRequestInput, RequestItem } from '@/types/request';

interface RequestFormProps {
  items: RequestItem[];
  onSuccess: () => void;
}

export function RequestForm({ items, onSuccess }: RequestFormProps) {
  const [deliveryDate, setDeliveryDate] = useState('');
  const [shippingName, setShippingName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const token = authSignal.value?.token;
    if (!token) {
      setError('Sie müssen angemeldet sein, um eine Anfrage zu senden.');
      setIsSubmitting(false);
      return;
    }

    try {
      const input: CreateRequestInput = {
        deliveryDate,
        shippingName,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        city,
        zipCode,
        note: note || undefined,
        items,
      };

      await api.createRequest(input, token);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Lieferdatum
        </label>
        <input
          type="date"
          value={deliveryDate}
          onInput={(e) => setDeliveryDate(e.currentTarget.value)}
          min={minDateStr}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Name (Empfänger)
        </label>
        <input
          type="text"
          value={shippingName}
          onInput={(e) => setShippingName(e.currentTarget.value)}
          placeholder="Max Mustermann"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Straße und Hausnummer
        </label>
        <input
          type="text"
          value={addressLine1}
          onInput={(e) => setAddressLine1(e.currentTarget.value)}
          placeholder="Musterstraße 123"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Adresszusatz (optional)
        </label>
        <input
          type="text"
          value={addressLine2}
          onInput={(e) => setAddressLine2(e.currentTarget.value)}
          placeholder="z.B. 2. OG"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            PLZ
          </label>
          <input
            type="text"
            value={zipCode}
            onInput={(e) => setZipCode(e.currentTarget.value)}
            placeholder="12345"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Stadt
          </label>
          <input
            type="text"
            value={city}
            onInput={(e) => setCity(e.currentTarget.value)}
            placeholder="Berlin"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Anmerkung (optional)
        </label>
        <textarea
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
          placeholder="Weitere Informationen zur Lieferung..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-4 rounded-md transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Wird gesendet...' : 'Anfrage senden'}
      </button>
    </form>
  );
}
