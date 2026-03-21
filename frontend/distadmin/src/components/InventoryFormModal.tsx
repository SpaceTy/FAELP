import { useState, useEffect, useMemo } from 'preact/hooks';
import { Modal } from './Modal';
import { inventoryService } from '@/services/inventory';
import type { MaterialInstance, MaterialStatus, MaterialType } from '@/types/inventory';

export interface InventoryFormValues {
  humanCode?: string;
  typeId?: string;
  description?: string;
  location: string;
  status?: MaterialStatus;
  useCount?: number;
}

interface InventoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InventoryFormValues) => Promise<void>;
  instance?: MaterialInstance | null;
  materialTypes?: MaterialType[];
}

const STATUS_OPTIONS: { value: MaterialStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Verfügbar', color: 'text-green-700' },
  { value: 'rented', label: 'Verliehen', color: 'text-yellow-700' },
  { value: 'returned', label: 'Zurückgegeben', color: 'text-gray-700' },
  { value: 'archived', label: 'Archiviert', color: 'text-gray-700' },
];

export function InventoryFormModal({ isOpen, onClose, onSubmit, instance, materialTypes = [] }: InventoryFormModalProps) {
  const isEditing = !!instance;

  const [typeId, setTypeId] = useState('');
  const [customTypeId, setCustomTypeId] = useState('');
  const [isCustomType, setIsCustomType] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<MaterialStatus>('available');
  const [useCount, setUseCount] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isCodeConfirmed, setIsCodeConfirmed] = useState(false);

  // Filter material types based on search query
  const filteredMaterialTypes = useMemo(() => {
    if (!searchQuery.trim()) return materialTypes;
    const query = searchQuery.toLowerCase();
    return materialTypes.filter(
      (mt) =>
        mt.name.toLowerCase().includes(query) ||
        mt.id.toLowerCase().includes(query)
    );
  }, [materialTypes, searchQuery]);

  useEffect(() => {
    const loadGeneratedCode = async () => {
      setIsGeneratingCode(true);
      try {
        const code = await inventoryService.generateMaterialCode();
        setGeneratedCode(code);
        setIsCodeConfirmed(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Code konnte nicht generiert werden');
      } finally {
        setIsGeneratingCode(false);
      }
    };

    if (isOpen) {
      if (instance) {
        setTypeId(instance.typeId);
        setCustomTypeId('');
        setIsCustomType(false);
        setDescription(instance.description || '');
        setLocation(instance.location);
        setStatus(instance.status);
        setUseCount(instance.useCount.toString());
      } else {
        setTypeId('');
        setCustomTypeId('');
        setIsCustomType(false);
        setDescription('');
        setLocation('');
        setStatus('available');
        setUseCount('0');
        setGeneratedCode('');
        setIsCodeConfirmed(false);
        loadGeneratedCode();
      }
      setSearchQuery('');
      setIsDropdownOpen(false);
      setError(null);
    }
  }, [isOpen, instance]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const finalTypeId = isCustomType ? customTypeId.trim() : typeId.trim();

      if (isEditing && instance) {
        const parsedUseCount = Number.parseInt(useCount, 10);
        if (!Number.isInteger(parsedUseCount) || parsedUseCount < 0) {
          throw new Error('Die Nutzungszahl muss eine ganze Zahl ab 0 sein.');
        }
        await onSubmit({ status, location: location.trim(), useCount: parsedUseCount });
      } else {
        if (!generatedCode || !isCodeConfirmed) {
          throw new Error('Bitte schreiben Sie den Material-Code auf das Material und bestätigen Sie dies.');
        }
        await onSubmit({
          humanCode: generatedCode,
          typeId: finalTypeId,
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

  const handleSelectMaterialType = (selectedTypeId: string) => {
    setTypeId(selectedTypeId);
    setIsCustomType(false);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleSelectCustomType = () => {
    setIsCustomType(true);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const getSelectedMaterialTypeName = () => {
    const mt = materialTypes.find((m) => m.id === typeId);
    return mt ? `${mt.name} (${mt.id})` : typeId;
  };
  const parsedUseCount = Number.parseInt(useCount, 10);
  const hasValidUseCount = useCount.trim() !== '' && Number.isInteger(parsedUseCount) && parsedUseCount >= 0;

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
            disabled={
              isLoading ||
              (!isEditing && (isGeneratingCode || !generatedCode || !isCodeConfirmed)) ||
              !location.trim() ||
              (isEditing && !hasValidUseCount) ||
              (!isEditing && !(isCustomType ? customTypeId.trim() : typeId.trim()))
            }
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

        {/* Type ID Selection */}
        {!isEditing && (
          <div>
            <label className="logistics-label" htmlFor="typeId">
              Material-Typ *
            </label>

            {isCustomType ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="customTypeId"
                    value={customTypeId}
                    onInput={(e) => setCustomTypeId((e.target as HTMLInputElement).value)}
                    className="logistics-input flex-1"
                    placeholder="Neue Typ-ID eingeben..."
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomType(false);
                      setCustomTypeId('');
                    }}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 whitespace-nowrap"
                  >
                    Aus Liste wählen
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Geben Sie eine neue Typ-ID ein oder wählen Sie aus der Liste
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Search/Select Input */}
                <div
                  className="logistics-input cursor-pointer flex items-center justify-between"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span className={typeId ? 'text-gray-900' : 'text-gray-400'}>
                    {typeId ? (
                      <span className="material-inline">
                        {materialTypes.find((m) => m.id === typeId)?.imageUrl ? (
                          <img
                            className="material-thumb"
                            src={materialTypes.find((m) => m.id === typeId)?.imageUrl}
                            alt={materialTypes.find((m) => m.id === typeId)?.name || typeId}
                          />
                        ) : (
                          <span className="material-thumb-placeholder">?</span>
                        )}
                        {getSelectedMaterialTypeName()}
                      </span>
                    ) : (
                      'Material-Typ auswählen...'
                    )}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-80 overflow-auto">
                    {/* Search in dropdown */}
                    <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                      <input
                        type="text"
                        value={searchQuery}
                        onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                        placeholder="Suchen..."
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-logistics-accent"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Add new option */}
                    <button
                      type="button"
                      onClick={handleSelectCustomType}
                      className="w-full px-4 py-2 text-left text-sm text-logistics-accent hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Neuen Typ erstellen...
                    </button>

                    {/* Material type list */}
                    {filteredMaterialTypes.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        {searchQuery ? 'Keine Material-Typen gefunden' : 'Keine Material-Typen verfügbar'}
                      </div>
                    ) : (
                      filteredMaterialTypes.map((mt) => (
                        <button
                          key={mt.id}
                          type="button"
                          onClick={() => handleSelectMaterialType(mt.id)}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex flex-col gap-0.5 ${
                            typeId === mt.id ? 'bg-blue-50 text-blue-700' : ''
                          }`}
                        >
                          <span className="font-medium material-inline">
                            {mt.imageUrl ? (
                              <img className="material-thumb" src={mt.imageUrl} alt={mt.name} />
                            ) : (
                              <span className="material-thumb-placeholder">?</span>
                            )}
                            {mt.name}
                          </span>
                          <span className="text-xs text-gray-500">ID: {mt.id}</span>
                          {mt.description && (
                            <span className="text-xs text-gray-400 truncate">{mt.description}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Click outside to close dropdown */}
                {isDropdownOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Display selected type when editing */}
        {isEditing && (
          <div>
            <label className="logistics-label">Material-Typ ID</label>
            <input
              type="text"
              value={typeId}
              disabled
              className="logistics-input disabled:bg-gray-100 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">Der Material-Typ kann nicht geändert werden</p>
          </div>
        )}

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

        {!isEditing && (
          <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 uppercase">Material-Code</p>
                <p className="font-mono text-2xl tracking-widest">{isGeneratingCode ? '.....' : generatedCode || '-----'}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setIsGeneratingCode(true);
                  try {
                    const code = await inventoryService.generateMaterialCode();
                    setGeneratedCode(code);
                    setIsCodeConfirmed(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Code konnte nicht generiert werden');
                  } finally {
                    setIsGeneratingCode(false);
                  }
                }}
                disabled={isGeneratingCode || isLoading}
                className="btn-logistics btn-logistics-outline text-xs py-1.5 px-2"
              >
                Neu
              </button>
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isCodeConfirmed}
                onChange={(e) => setIsCodeConfirmed((e.target as HTMLInputElement).checked)}
                disabled={!generatedCode || isGeneratingCode}
                className="mt-0.5"
              />
              Ich habe den Code auf dem physischen Material notiert.
            </label>
          </div>
        )}

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

        {isEditing && (
          <div>
            <label className="logistics-label" htmlFor="useCount">
              Nutzungszahl *
            </label>
            <input
              type="number"
              id="useCount"
              value={useCount}
              onInput={(e) => setUseCount((e.target as HTMLInputElement).value)}
              className="logistics-input"
              min="0"
              step="1"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Kann manuell korrigiert werden, falls der Zähler angepasst werden muss.</p>
          </div>
        )}

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
