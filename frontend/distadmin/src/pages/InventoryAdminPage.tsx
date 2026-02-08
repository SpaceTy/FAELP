import { useState } from 'preact/hooks';
import { api } from '@/services/auth';
import type { MaterialInstance, MaterialStatus } from '@/types/inventory';

const STATUS_OPTIONS: MaterialStatus[] = ['available', 'rented', 'returned'];

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toLocaleString('de-DE');
}

export function InventoryAdminPage() {
  const [createId, setCreateId] = useState('');
  const [createTypeId, setCreateTypeId] = useState('');
  const [createLocation, setCreateLocation] = useState('');

  const [updateId, setUpdateId] = useState('');
  const [updateStatus, setUpdateStatus] = useState<MaterialStatus>('available');
  const [updateLocation, setUpdateLocation] = useState('');

  const [assignId, setAssignId] = useState('');
  const [assignRequestId, setAssignRequestId] = useState('');

  const [releaseId, setReleaseId] = useState('');
  const [deleteId, setDeleteId] = useState('');

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MaterialInstance | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    clearMessages();
    setIsBusy(true);
    try {
      const created = await api.createMaterialInstance({
        id: createId.trim(),
        typeId: createTypeId.trim(),
        location: createLocation.trim(),
      });
      setLastResult(created);
      setSuccess(`Material-Instanz ${created.id} wurde erstellt.`);
      setCreateId('');
      setCreateTypeId('');
      setCreateLocation('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erstellen fehlgeschlagen.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    clearMessages();
    setIsBusy(true);
    try {
      const updated = await api.updateMaterialInstance(updateId.trim(), {
        status: updateStatus,
        location: updateLocation.trim(),
      });
      setLastResult(updated);
      setSuccess(`Material-Instanz ${updated.id} wurde aktualisiert.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktualisierung fehlgeschlagen.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAssign = async (e: Event) => {
    e.preventDefault();
    clearMessages();
    setIsBusy(true);
    try {
      const updated = await api.assignMaterialInstance(assignId.trim(), {
        requestId: assignRequestId.trim(),
      });
      setLastResult(updated);
      setSuccess(`Material-Instanz ${updated.id} wurde einer Anfrage zugeordnet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zuweisung fehlgeschlagen.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRelease = async (e: Event) => {
    e.preventDefault();
    clearMessages();
    setIsBusy(true);
    try {
      const updated = await api.releaseMaterialInstance(releaseId.trim());
      setLastResult(updated);
      setSuccess(`Material-Instanz ${updated.id} wurde freigegeben.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigabe fehlgeschlagen.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (e: Event) => {
    e.preventDefault();
    clearMessages();
    setIsBusy(true);
    try {
      await api.deleteMaterialInstance(deleteId.trim());
      setSuccess(`Material-Instanz ${deleteId.trim()} wurde gelöscht.`);
      if (lastResult?.id === deleteId.trim()) {
        setLastResult(null);
      }
      setDeleteId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-text-primary">Inventory Admin Aktionen</h2>
          <p className="text-sm text-text-secondary mt-1">
            Nur exklusive Admin-Operationen auf <code>/api/inventory</code>. Die reine Bestandsansicht erfolgt im normalen Distribution-Frontend.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 rounded border border-green-300 bg-green-50 text-green-700 text-sm">
              {success}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form className="bg-white rounded-lg shadow p-6 space-y-3" onSubmit={handleCreate}>
            <h3 className="text-lg font-semibold text-text-primary">Material anlegen</h3>
            <input
              type="text"
              required
              value={createId}
              onInput={(e) => setCreateId((e.target as HTMLInputElement).value)}
              placeholder="ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="text"
              required
              value={createTypeId}
              onInput={(e) => setCreateTypeId((e.target as HTMLInputElement).value)}
              placeholder="Type ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="text"
              required
              value={createLocation}
              onInput={(e) => setCreateLocation((e.target as HTMLInputElement).value)}
              placeholder="Lagerort"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md disabled:opacity-50"
            >
              Anlegen
            </button>
          </form>

          <form className="bg-white rounded-lg shadow p-6 space-y-3" onSubmit={handleUpdate}>
            <h3 className="text-lg font-semibold text-text-primary">Material aktualisieren</h3>
            <input
              type="text"
              required
              value={updateId}
              onInput={(e) => setUpdateId((e.target as HTMLInputElement).value)}
              placeholder="Material ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={updateStatus}
              onChange={(e) => setUpdateStatus((e.target as HTMLSelectElement).value as MaterialStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={updateLocation}
              onInput={(e) => setUpdateLocation((e.target as HTMLInputElement).value)}
              placeholder="Neuer Lagerort"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md disabled:opacity-50"
            >
              Aktualisieren
            </button>
          </form>

          <form className="bg-white rounded-lg shadow p-6 space-y-3" onSubmit={handleAssign}>
            <h3 className="text-lg font-semibold text-text-primary">Zu Anfrage zuweisen</h3>
            <input
              type="text"
              required
              value={assignId}
              onInput={(e) => setAssignId((e.target as HTMLInputElement).value)}
              placeholder="Material ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="text"
              required
              value={assignRequestId}
              onInput={(e) => setAssignRequestId((e.target as HTMLInputElement).value)}
              placeholder="Request ID (UUID)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md disabled:opacity-50"
            >
              Zuweisen
            </button>
          </form>

          <div className="space-y-6">
            <form className="bg-white rounded-lg shadow p-6 space-y-3" onSubmit={handleRelease}>
              <h3 className="text-lg font-semibold text-text-primary">Freigeben (Return)</h3>
              <input
                type="text"
                required
                value={releaseId}
                onInput={(e) => setReleaseId((e.target as HTMLInputElement).value)}
                placeholder="Material ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md disabled:opacity-50"
              >
                Freigeben
              </button>
            </form>

            <form className="bg-white rounded-lg shadow p-6 space-y-3" onSubmit={handleDelete}>
              <h3 className="text-lg font-semibold text-text-primary">Material löschen</h3>
              <input
                type="text"
                required
                value={deleteId}
                onInput={(e) => setDeleteId((e.target as HTMLInputElement).value)}
                placeholder="Material ID"
                className="w-full px-3 py-2 border border-red-300 rounded-md"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md disabled:opacity-50"
              >
                Löschen
              </button>
            </form>
          </div>
        </section>

        {lastResult && (
          <section className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-text-primary">Letztes Ergebnis</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-text-primary">
              <p><strong>ID:</strong> {lastResult.id}</p>
              <p><strong>Type:</strong> {lastResult.typeId}</p>
              <p><strong>Status:</strong> {lastResult.status}</p>
              <p><strong>Use Count:</strong> {lastResult.useCount}</p>
              <p><strong>Location:</strong> {lastResult.location}</p>
              <p><strong>Request ID:</strong> {lastResult.currentRequestId || 'keine'}</p>
              <p><strong>Created:</strong> {formatDate(lastResult.createdAt)}</p>
              <p><strong>Updated:</strong> {formatDate(lastResult.updatedAt)}</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
