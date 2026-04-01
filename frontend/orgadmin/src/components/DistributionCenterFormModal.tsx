import { useState, useEffect } from 'preact/hooks';
import { useI18n } from '@/i18n';
import type { DistributionCenter, CreateDistributionCenterInput, UpdateDistributionCenterInput } from '@/types/distributionCenter';

interface DistributionCenterFormModalProps {
  center: DistributionCenter | null;
  onSubmit: (input: CreateDistributionCenterInput | UpdateDistributionCenterInput) => Promise<void>;
  onClose: () => void;
}

export function DistributionCenterFormModal({ center, onSubmit, onClose }: DistributionCenterFormModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!center;

  useEffect(() => {
    if (center) {
      setName(center.name);
      setAddress(center.address);
    }
  }, [center]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!name.trim()) {
        throw new Error(t('distributionCenterForm.nameRequired'));
      }
      if (!address.trim()) {
        throw new Error(t('distributionCenterForm.addressRequired'));
      }

      await onSubmit({
        name: name.trim(),
        address: address.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('distributionCenterForm.unknownError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEditing ? t('distributionCenterForm.titleEdit') : t('distributionCenterForm.titleCreate')}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('distributionCenterForm.nameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('distributionCenterForm.namePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('distributionCenterForm.addressLabel')}
            </label>
            <textarea
              value={address}
              onInput={(e) => setAddress((e.target as HTMLTextAreaElement).value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('distributionCenterForm.addressPlaceholder')}
              rows={3}
              required
            />
          </div>

          {center?.socketPath && (
            <div className="bg-blue-50 text-blue-700 p-3 rounded text-sm">
              {t('distributionCenterForm.socketConnected', { path: center.socketPath })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? t('distributionCenterForm.submitting')
                : isEditing
                  ? t('distributionCenterForm.submitEdit')
                  : t('distributionCenterForm.submitCreate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
