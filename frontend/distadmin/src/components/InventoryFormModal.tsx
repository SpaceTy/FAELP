import { useState, useEffect } from 'preact/hooks';
import { Modal } from './Modal';
import type { MaterialInstance, MaterialStatus } from '@/types/inventory';

interface InventoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  instance?: MaterialInstance | null;
}

const STATUS_OPTIONS: { value: MaterialStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Verfügbar', color: 'text-green-700' },
  { value: 'rented', label: 'Verliehen', color: 'text-yellow-700' },
  { value: 'returned', label: 'Zurückgegeben', color: 'text-gray-700' },
];

export function InventoryFormModal({ isOpen, onClose, onSubmit, instance }: InventoryFormModalProps) {
  const isEditing = !!instance;

  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<MaterialStatus>('available');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (instance) {
        setTypeId(instance.typeId);
        setDescription(instance.description || '');
        setLocation(instance.location);
        setStatus(instance.status);
      } else {
        setTypeId('');
        setDescription('');
        setLocation('');
        setStatus('available');
      }
      setError(null);
    }
  }, [isOpen, instance]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isEditing && instance) {
        await onSubmit({ status, location: location.trim() });
      } else {
        await onSubmit({
          typeId: typeId.trim(),
          description: description.trim() || '',
          location: location.trim(),
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Material-Instanz bearbeiten' : 'Neue Material-Instanz'}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-logistics btn-logistics-outline"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            form="inventory-form"
            disabled={isLoading || !location.trim() || (!isEditing && !typeId.trim())}
            className="btn-logistics btn-logistics-primary"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Wird gespeichert...
              </>
            ) : (
              isEditing ? 'Speichern' : 'Erstellen'
            )}
          </button>
        </>
      }
    >
      <form id="inventory-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {isEditing && instance && (
          <div className="p-3 bg-gray-50 rounded text-sm">
            <span className="text-gray-600">ID:</span>{' '}
            <span className="font-mono text-gray-800">{instance.id}</span>
          </div>
        )}

        {/* Type ID */}
        <div>
          <label className="logistics-label" htmlFor="typeId">
            Material-Typ ID {isEditing && '(Nicht änderbar)'}
          </label>
          <input
            type="text"
            id="typeId"
            value={typeId}
            onInput={(e) => setTypeId((e.target as HTMLInputElement).value)}
            disabled={isEditing}
            className="logistics-input disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="z.B. material-type-uuid"
            required={!isEditing}
          />
          <p className="mt-1 text-xs text-gray-500">
            Die ID des Materialtyps aus dem Organisation-Backend
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="logistics-label" htmlFor="description">
            Beschreibung
          </label>
          <input
            type="text"
            id="description"
            value={description}
            onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
            disabled={isEditing}
            className="logistics-input disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="Optionale Beschreibung"
          />
        </div>

        {/* Location */}
        <div>
          <label className="logistics-label" htmlFor="location">
            Standort *
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onInput={(e) => setLocation((e.target as HTMLInputElement).value)}
            className="logistics-input"
            placeholder="z.B. Lager A, Regal 3"
            required
          />
        </div>

        {/* Status (only when editing) */}
        {isEditing && (
          <div>
            <label className="logistics-label">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-colors ${
                    status === option.value
                      ? 'bg-logistics-accent text-white border-logistics-accent'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
