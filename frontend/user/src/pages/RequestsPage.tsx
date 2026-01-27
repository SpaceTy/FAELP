import { useState } from 'preact/hooks';
import { Header } from '@/components/Layout/Header';
import { RequestCard } from '@/components/Request/RequestCard';
import { useRequests } from '@/hooks/useRequests';
import type { RequestStatus } from '@/types/request';

const STATUS_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'pending', label: 'Ausstehend' },
  { value: 'inAction', label: 'In Bearbeitung' },
  { value: 'returned', label: 'Zurückgegeben' }
];

export function RequestsPage() {
  const [status, setStatus] = useState<RequestStatus | ''>('');

  // TODO: Get actual customer ID from auth context
  // Using a valid UUID format for testing - this should be replaced with actual auth
  const customerId = '00000000-0000-0000-0000-000000000000';

  const { requests, loading, error, hasMore, loadMore } = useRequests({
    customerId,
    status: status || undefined
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Filters */}
        <aside className="w-64 bg-white p-6 overflow-y-auto shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-secondary mb-4">Status</h3>
            <div className="space-y-3">
              {STATUS_OPTIONS.map(option => (
                <label key={option.value} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === option.value}
                    onChange={() => setStatus(option.value as RequestStatus | '')}
                    className="w-4 h-4 mr-3 text-primary focus:ring-primary"
                  />
                  <span className="text-text-primary">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-secondary">
                Meine Materialanfragen
              </h2>
              <span className="text-text-secondary">
                {requests.length} Anfragen
              </span>
            </div>
          </div>

          {loading && requests.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-text-secondary">Lade Anfragen...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
              <p>Fehler beim Laden der Anfragen: {error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Neu laden
              </button>
            </div>
          )}

          <div className="space-y-4">
            {requests.map(request => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-white border border-gray-300 text-text-primary rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Laden...' : 'Mehr laden'}
              </button>
            </div>
          )}

          {!loading && requests.length === 0 && !error && (
            <div className="text-center py-12">
              <p className="text-text-secondary text-lg">
                Keine Anfragen gefunden.
              </p>
              <p className="text-text-secondary mt-2">
                Erstellen Sie eine neue Anfrage im Materialkatalog.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
