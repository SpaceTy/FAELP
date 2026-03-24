import { useState } from 'preact/hooks';
import { api, ApiError } from '@/services/api';
import { authSignal } from '@/context/AuthContext';
import type { CreateRequestInput, RequestItem } from '@/types/request';

interface RequestFormProps {
  items: RequestItem[];
  onSuccess: () => void;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function RequestForm({ items, onSuccess }: RequestFormProps) {
  const [deliveryDate, setDeliveryDate] = useState('');
  const [plannedReturnDate, setPlannedReturnDate] = useState('');
  const [intendedStudents, setIntendedStudents] = useState('1');
  const [shareIntendedStudents, setShareIntendedStudents] = useState(true);
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false);
  const [shippingName, setShippingName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);
  const minDateStr = formatDateForInput(minDate);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const parsedIntendedStudents = Number.parseInt(intendedStudents, 10);

    const token = authSignal.value?.token;
    if (!token) {
      setError('Sie müssen angemeldet sein, um eine Anfrage zu senden.');
      setIsSubmitting(false);
      return;
    }
    if (!dataProcessingConsent) {
      setError('Bitte bestätigen Sie die Verarbeitung Ihrer Angaben zur Bearbeitung der Anfrage.');
      setIsSubmitting(false);
      return;
    }
    if (
      shareIntendedStudents &&
      (!Number.isFinite(parsedIntendedStudents) || parsedIntendedStudents <= 0)
    ) {
      setError('Bitte geben Sie eine gültige Anzahl geplanter Schüler:innen an.');
      setIsSubmitting(false);
      return;
    }
    if (deliveryDate && deliveryDate < minDateStr) {
      setError('Das Lieferdatum muss mindestens 3 Tage in der Zukunft liegen.');
      setIsSubmitting(false);
      return;
    }

    try {
      const intendedStudentsForRequest = shareIntendedStudents ? parsedIntendedStudents : 0;
      const input: CreateRequestInput = {
        deliveryDate,
        plannedReturnDate,
        intendedStudents: intendedStudentsForRequest,
        dataProcessingConsent,
        shareIntendedStudents,
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
          Geplantes Rückgabedatum
        </label>
        <input
          type="date"
          value={plannedReturnDate}
          onInput={(e) => setPlannedReturnDate(e.currentTarget.value)}
          min={deliveryDate || minDateStr}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Geplante Anzahl Schüler:innen
        </label>
        <p className="text-sm text-text-secondary mb-3">
          Diese Angabe ist freiwillig. Sie hilft bei der bedarfsgerechten Bearbeitung Ihrer Anfrage.
        </p>
        <div className="space-y-3 rounded-md border border-gray-300 p-3 mb-3">
          <label className="flex items-start gap-3">
            <input
              type="radio"
              name="student-count-consent"
              checked={shareIntendedStudents}
              onChange={() => setShareIntendedStudents(true)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary"
            />
            <span className="text-sm text-text-primary">
              Ich willige ein, dass die geplante Anzahl der Schüler:innen zur Bearbeitung meiner Anfrage
              übermittelt wird.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="radio"
              name="student-count-consent"
              checked={!shareIntendedStudents}
              onChange={() => setShareIntendedStudents(false)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary"
            />
            <span className="text-sm text-text-primary">
              Ich möchte die geplante Anzahl der Schüler:innen nicht übermitteln. In diesem Fall wird der
              Wert <span className="font-semibold">0</span> gesendet.
            </span>
          </label>
        </div>
        <input
          type="number"
          value={intendedStudents}
          onInput={(e) => setIntendedStudents(e.currentTarget.value)}
          min="1"
          step="1"
          required={shareIntendedStudents}
          disabled={!shareIntendedStudents}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        />
        {!shareIntendedStudents && (
          <p className="text-sm text-text-secondary mt-2">
            Die Schülerzahl wird in diesem Fall nicht verwendet und mit <span className="font-semibold">0</span>{' '}
            übermittelt.
          </p>
        )}
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

      <div className="rounded-md border border-gray-300 bg-gray-50 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Datenschutzbestätigung</h3>
          <p className="text-sm text-text-secondary mt-1">
            Mit dem Absenden Ihrer Anfrage werden Ihre im Formular angegebenen personenbezogenen Daten zum Zweck
            der Prüfung, Bearbeitung, Durchführung und Dokumentation Ihrer Anfrage verarbeitet. Dazu gehören
            insbesondere Kontakt-, Liefer- und Anfragedaten.
          </p>
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={dataProcessingConsent}
            onChange={(e) => setDataProcessingConsent(e.currentTarget.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-text-primary">
            Ich bestätige, dass meine Angaben zu diesen Zwecken verarbeitet werden dürfen, damit meine Anfrage
            bearbeitet und abgewickelt werden kann.
          </span>
        </label>
      </div>

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
