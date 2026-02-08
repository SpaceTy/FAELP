import { useState } from 'preact/hooks';
import { api } from '@/services/api';
import type { MaterialInstance } from '@/types/inventory';

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toLocaleString('de-DE');
}

export function EnterInventoryPage() {
  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [useCount, setUseCount] = useState(0);
  const [location, setLocation] = useState('');

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MaterialInstance | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    clearMessages();
    setIsBusy(true);
    try {
      const created = await api.createMaterialInstance({
        typeId: typeId.trim(),
        description: description.trim(),
        useCount,
        location: location.trim(),
      });
      setLastResult(created);
      setSuccess(`Material ${created.id} wurde erfolgreich ins Inventar aufgenommen.`);
      setTypeId('');
      setDescription('');
      setUseCount(0);
      setLocation('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erfassung fehlgeschlagen.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-text-primary">Material erfassen</h2>
          <p className="text-sm text-text-secondary mt-1">
            Neues Material ins Inventar aufnehmen. Die ID wird automatisch generiert und der Status auf "available" gesetzt.
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Typ ID</label>
              <input
                type="text"
                required
                value={typeId}
                onInput={(e) => setTypeId((e.target as HTMLInputElement).value)}
                placeholder="z.B. manikin-adult-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Lagerort</label>
              <input
                type="text"
                required
                value={location}
                onInput={(e) => setLocation((e.target as HTMLInputElement).value)}
                placeholder="z.B. Lager A"
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
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-text-secondary mb-1">Bisherige Nutzungen</label>
            <input
              type="number"
              min="0"
              value={useCount}
              onInput={(e) => setUseCount(parseInt((e.target as HTMLInputElement).value, 10) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            type="submit"
            disabled={isBusy}
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
