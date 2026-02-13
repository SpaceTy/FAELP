import { useState, useEffect } from 'preact/hooks';
import { api } from '@/services/api';
import { authSignal } from '@/context/AuthContext';
import type { Request } from '@/types/request';

export function MyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = authSignal.value?.token;
    if (!token) {
      setLoading(false);
      return;
    }

    api.getMyRequests(token)
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const getStatusConfig = (status: Request['status']) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Ausstehend',
          className: 'bg-amber-50 text-amber-700 border-amber-200',
          dotClassName: 'bg-amber-500'
        };
      case 'inAction':
        return {
          label: 'In Bearbeitung',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          dotClassName: 'bg-blue-500'
        };
      case 'returned':
        return {
          label: 'Abgeschlossen',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClassName: 'bg-emerald-500'
        };
      default:
        return {
          label: status,
          className: 'bg-slate-50 text-slate-700 border-slate-200',
          dotClassName: 'bg-slate-500'
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">Fehler beim Laden der Anfragen: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Meine Anfragen</h1>
          <p className="text-slate-500 text-sm">
            Übersicht über alle Ihre Materialanfragen und deren Status
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-slate-900 mb-1">Keine Anfragen vorhanden</h3>
            <p className="text-slate-500 text-sm mb-6">Sie haben noch keine Materialanfragen gestellt.</p>
            <a
              href="/materials"
              className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
            >
              Materialien durchsuchen
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const status = getStatusConfig(request.status);
              const totalItems = request.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div
                  key={request.id}
                  className="bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClassName}`}></span>
                          {status.label}
                        </span>
                        <span className="text-slate-400 text-sm">#{request.id.slice(0, 8)}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-0.5">Eingegangen</p>
                        <p className="text-sm font-medium text-slate-900">{formatDate(request.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Delivery Info */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                          Lieferung
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <div>
                              <p className="text-xs text-slate-500">Lieferdatum</p>
                              <p className="text-sm text-slate-900">{formatDate(request.deliveryDate)}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <div>
                              <p className="text-xs text-slate-500">Lieferadresse</p>
                              <p className="text-sm text-slate-900">{request.shippingName}</p>
                              <p className="text-sm text-slate-600">{request.addressLine1}</p>
                              {request.addressLine2 && (
                                <p className="text-sm text-slate-600">{request.addressLine2}</p>
                              )}
                              <p className="text-sm text-slate-600">{request.zipCode} {request.city}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Materials */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                            Materialien
                          </h4>
                          <span className="text-xs text-slate-500">
                            {totalItems} {totalItems === 1 ? 'Artikel' : 'Artikel'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {request.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-md"
                            >
                              <span className="text-sm text-slate-700">{item.materialTypeId}</span>
                              <span className="text-sm font-medium text-slate-900 tabular-nums">
                                {item.quantity}×
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
