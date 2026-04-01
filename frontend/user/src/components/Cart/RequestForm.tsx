import { useState } from 'preact/hooks';
import { api, ApiError } from '@/services/api';
import { authSignal } from '@/context/AuthContext';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
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
      setError(t('requestForm.errors.notLoggedIn'));
      setIsSubmitting(false);
      return;
    }
    if (!dataProcessingConsent) {
      setError(t('requestForm.errors.privacyRequired'));
      setIsSubmitting(false);
      return;
    }
    if (
      shareIntendedStudents &&
      (!Number.isFinite(parsedIntendedStudents) || parsedIntendedStudents <= 0)
    ) {
      setError(t('requestForm.errors.invalidStudents'));
      setIsSubmitting(false);
      return;
    }
    if (deliveryDate && deliveryDate < minDateStr) {
      setError(t('requestForm.errors.deliveryTooSoon'));
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
        setError(t('requestForm.errors.generic'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          {t('requestForm.deliveryDate')}
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
          {t('requestForm.plannedReturnDate')}
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
          {t('requestForm.plannedStudents')}
        </label>
        <p className="text-sm text-text-secondary mb-3">
          {t('requestForm.plannedStudentsHelp')}
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
              {t('requestForm.shareStudents')}
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
              {t('requestForm.doNotShareStudents')}
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
            {t('requestForm.studentsNotUsed')}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          {t('requestForm.shippingName')}
        </label>
        <input
          type="text"
          value={shippingName}
          onInput={(e) => setShippingName(e.currentTarget.value)}
          placeholder={t('requestForm.shippingNamePlaceholder')}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          {t('requestForm.addressLine1')}
        </label>
        <input
          type="text"
          value={addressLine1}
          onInput={(e) => setAddressLine1(e.currentTarget.value)}
          placeholder={t('requestForm.addressLine1Placeholder')}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          {t('requestForm.addressLine2')}
        </label>
        <input
          type="text"
          value={addressLine2}
          onInput={(e) => setAddressLine2(e.currentTarget.value)}
          placeholder={t('requestForm.addressLine2Placeholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            {t('requestForm.zipCode')}
          </label>
          <input
            type="text"
            value={zipCode}
            onInput={(e) => setZipCode(e.currentTarget.value)}
            placeholder={t('requestForm.zipCodePlaceholder')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            {t('requestForm.city')}
          </label>
          <input
            type="text"
            value={city}
            onInput={(e) => setCity(e.currentTarget.value)}
            placeholder={t('requestForm.cityPlaceholder')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          {t('requestForm.note')}
        </label>
        <textarea
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
          placeholder={t('requestForm.notePlaceholder')}
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
          <h3 className="text-sm font-semibold text-text-primary">{t('requestForm.privacyTitle')}</h3>
          <p className="text-sm text-text-secondary mt-1">
            {t('requestForm.privacyBody')}
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
            {t('requestForm.privacyConsent')}
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-4 rounded-md transition-colors disabled:opacity-50"
      >
        {isSubmitting ? t('requestForm.submitting') : t('requestForm.submit')}
      </button>
    </form>
  );
}
