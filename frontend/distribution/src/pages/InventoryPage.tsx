import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '@/services/api';
import type { InventorySummaryItem, MaterialInstance, MaterialStatus } from '@/types/inventory';

const STATUS_OPTIONS: Array<MaterialStatus | ''> = ['', 'available', 'rented', 'returned'];

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toLocaleString('de-DE');
}

function statusBadge(status: MaterialStatus): string {
  if (status === 'available') return 'bg-green-100 text-green-700';
  if (status === 'rented') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-200 text-slate-700';
}

export function InventoryPage() {
  const [items, setItems] = useState<MaterialInstance[]>([]);
  const [summary, setSummary] = useState<InventorySummaryItem[]>([]);
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState<MaterialStatus | ''>('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [listData, summaryData] = await Promise.all([
        api.listMaterialInstances({
          typeId: typeId.trim() || undefined,
          status: status || undefined,
          location: location.trim() || undefined,
          limit: 200,
          offset: 0,
        }),
        api.getInventorySummary(),
      ]);
      setItems(listData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bestand konnte nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaryTotals = useMemo(() => {
    let available = 0;
    let rented = 0;
    let returned = 0;

    for (const row of summary) {
      if (row.status === 'available') available += row.count;
      if (row.status === 'rented') rented += row.count;
      if (row.status === 'returned') returned += row.count;
    }

    return {
      available,
      rented,
      returned,
      total: available + rented + returned,
    };
  }, [summary]);

  const handleSubmitFilter = async (e: Event) => {
    e.preventDefault();
    await loadData();
  };

  const handleResetFilter = async () => {
    setTypeId('');
    setStatus('');
    setLocation('');
    setTimeout(() => {
      loadData();
    }, 0);
  };

  return (
    <main className="h-full overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-text-secondary">Gesamt</p>
            <p className="text-2xl font-semibold text-text-primary">{summaryTotals.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-text-secondary">Verfuegbar</p>
            <p className="text-2xl font-semibold text-green-700">{summaryTotals.available}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-text-secondary">Vermietet</p>
            <p className="text-2xl font-semibold text-amber-700">{summaryTotals.rented}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-text-secondary">Zurueckgegeben</p>
            <p className="text-2xl font-semibold text-slate-700">{summaryTotals.returned}</p>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Inventory</h2>
              <p className="text-sm text-text-secondary">Uebersicht und Filterung der Material-Instanzen.</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="px-4 py-2 bg-secondary text-white rounded hover:bg-secondary-hover disabled:opacity-50"
            >
              Neu laden
            </button>
          </div>

          <form className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={handleSubmitFilter}>
            <input
              type="text"
              value={typeId}
              onInput={(e) => setTypeId((e.target as HTMLInputElement).value)}
              placeholder="Type ID"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={status}
              onChange={(e) => setStatus((e.target as HTMLSelectElement).value as MaterialStatus | '')}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value || 'Alle Status'}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={location}
              onInput={(e) => setLocation((e.target as HTMLInputElement).value)}
              placeholder="Location"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 px-3 py-2 bg-primary text-white rounded hover:bg-primary-hover">
                Filtern
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className="flex-1 px-3 py-2 bg-gray-200 text-text-primary rounded hover:bg-gray-300"
              >
                Reset
              </button>
            </div>
          </form>

          {error && <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm text-text-secondary">
                  <th className="py-2 pr-4 font-medium">ID</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Location</th>
                  <th className="py-2 pr-4 font-medium">Use Count</th>
                  <th className="py-2 pr-4 font-medium">Request</th>
                  <th className="py-2 pr-4 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 text-sm text-text-primary">
                    <td className="py-2 pr-4 font-mono">{item.id}</td>
                    <td className="py-2 pr-4">{item.typeId}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{item.location}</td>
                    <td className="py-2 pr-4">{item.useCount}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{item.currentRequestId || '-'}</td>
                    <td className="py-2 pr-4">{formatDate(item.updatedAt)}</td>
                  </tr>
                ))}
                {items.length === 0 && !isLoading && (
                  <tr>
                    <td className="py-6 text-center text-text-secondary" colSpan={7}>
                      Keine Eintraege gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
