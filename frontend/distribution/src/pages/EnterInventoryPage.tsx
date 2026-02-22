import { useState, useEffect, useMemo } from 'preact/hooks';
import { api } from '@/services/api';
import { materialTypesService } from '@/services/materialTypes';
import type { MaterialInstance, MaterialType } from '@/types/inventory';

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toLocaleString('de-DE');
}

export function EnterInventoryPage() {
  const [typeId, setTypeId] = useState('');
  const [customTypeId, setCustomTypeId] = useState('');
  const [isCustomType, setIsCustomType] = useState(false);
  const [description, setDescription] = useState('');
  const [useCount, setUseCount] = useState(0);
  const [location, setLocation] = useState('');

  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [isBusy, setIsBusy] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MaterialInstance | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isCodeConfirmed, setIsCodeConfirmed] = useState(false);

  // Load material types on mount
  useEffect(() => {
    const loadMaterialTypes = async () => {
      setIsLoadingTypes(true);
      try {
        const types = await materialTypesService.getMaterialTypes();
        setMaterialTypes(types);
      } catch (err) {
        console.error('Failed to load material types:', err);
      } finally {
        setIsLoadingTypes(false);
      }
    };
    loadMaterialTypes();
  }, []);

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

  const loadGeneratedCode = async () => {
    setIsGeneratingCode(true);
    try {
      const code = await api.generateMaterialCode();
      setGeneratedCode(code);
      setIsCodeConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code konnte nicht generiert werden.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  useEffect(() => {
    loadGeneratedCode();
  }, []);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    clearMessages();
    setIsBusy(true);

    const finalTypeId = isCustomType ? customTypeId.trim() : typeId.trim();

    try {
      if (!generatedCode || !isCodeConfirmed) {
        throw new Error('Bitte schreiben Sie den Material-Code auf das physische Material und bestätigen Sie dies.');
      }
      const created = await api.createMaterialInstance({
        humanCode: generatedCode,
        typeId: finalTypeId,
        description: description.trim(),
        useCount,
        location: location.trim(),
      });
      setLastResult(created);
      setSuccess(`Material mit Code ${created.humanCode} wurde erfolgreich ins Inventar aufgenommen.`);
      // Reset form
      setTypeId('');
      setCustomTypeId('');
      setIsCustomType(false);
      setDescription('');
      setUseCount(0);
      setLocation('');
      setSearchQuery('');
      await loadGeneratedCode();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erfassung fehlgeschlagen.');
    } finally {
      setIsBusy(false);
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

  return (
    <main className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-text-primary">Material erfassen</h2>
          <p className="text-sm text-text-secondary mt-1">
            Neues Material ins Inventar aufnehmen. Vor dem Speichern schreiben Sie den 5-stelligen Material-Code auf das physische Material.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
          )}
          {success && (
            <div className="mt-4 p-3 rounded border border-green-300 bg-green-50 text-green-700 text-sm">{success}</div>
          )}
        </section>

        <form className="bg-white rounded-lg shadow p-6 space-y-4" onSubmit={handleSubmit}>
          <h3 className="text-lg font-semibold text-text-primary">Neues Material</h3>

          {/* Material Type Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Material-Typ *</label>

            {isCustomType ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customTypeId}
                    onInput={(e) => setCustomTypeId((e.target as HTMLInputElement).value)}
                    placeholder="Neue Typ-ID eingeben..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
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
                {/* Dropdown trigger */}
                <div
                  className="w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer flex items-center justify-between bg-white"
                  onClick={() => !isLoadingTypes && setIsDropdownOpen(!isDropdownOpen)}
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
                  {isLoadingTypes ? (
                    <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
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
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Add new option */}
                    <button
                      type="button"
                      onClick={handleSelectCustomType}
                      className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-green-50 flex items-center gap-2 border-b border-gray-100"
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
                            typeId === mt.id ? 'bg-green-50 text-green-700' : ''
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Lagerort *</label>
              <input
                type="text"
                required
                value={location}
                onInput={(e) => setLocation((e.target as HTMLInputElement).value)}
                placeholder="z.B. Lager A"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Bisherige Nutzungen</label>
              <input
                type="number"
                min="0"
                value={useCount}
                onInput={(e) => setUseCount(parseInt((e.target as HTMLInputElement).value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Beschreibung</label>
            <textarea
              value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              placeholder="Optionale Beschreibung des Materials"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Material-Code (auf das Material schreiben)</p>
                <p className="font-mono text-2xl tracking-widest text-text-primary">
                  {isGeneratingCode ? '.....' : generatedCode || '-----'}
                </p>
              </div>
              <button
                type="button"
                onClick={loadGeneratedCode}
                disabled={isBusy || isGeneratingCode}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Neu generieren
              </button>
            </div>
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={isCodeConfirmed}
                onChange={(e) => setIsCodeConfirmed((e.target as HTMLInputElement).checked)}
                disabled={!generatedCode || isGeneratingCode}
                className="mt-0.5"
              />
              Ich habe den Material-Code auf das physische Material geschrieben.
            </label>
          </div>
          <button
            type="submit"
            disabled={
              isBusy ||
              isGeneratingCode ||
              !generatedCode ||
              !isCodeConfirmed ||
              (!isCustomType && !typeId) ||
              (isCustomType && !customTypeId.trim())
            }
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
          >
            {isBusy ? 'Wird gespeichert...' : 'Material erfassen'}
          </button>
        </form>

        {lastResult && (
          <section className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-text-primary">Zuletzt erfasst</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-text-primary">
              <p><strong>ID:</strong> {lastResult.id}</p>
              <p><strong>Code:</strong> <span className="font-mono">{lastResult.humanCode}</span></p>
              <p><strong>Typ:</strong> {lastResult.typeId}</p>
              <p><strong>Beschreibung:</strong> {lastResult.description || '–'}</p>
              <p><strong>Status:</strong> {lastResult.status}</p>
              <p><strong>Nutzungen:</strong> {lastResult.useCount}</p>
              <p><strong>Lagerort:</strong> {lastResult.location}</p>
              <p><strong>Erfasst:</strong> {formatDate(lastResult.createdAt)}</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
