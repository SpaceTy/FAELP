import type { Request } from '@/types/request';
import { MATERIAL_CATALOG } from '@/types/material';

interface RequestCardProps {
  request: Request;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Ausstehend';
    case 'inAction':
      return 'In Bearbeitung';
    case 'returned':
      return 'Zurückgegeben';
    default:
      return status;
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'status-pending';
    case 'inAction':
      return 'status-inAction';
    case 'returned':
      return 'status-returned';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function RequestCard({ request }: RequestCardProps) {
  const firstItemId = Object.keys(request.items)[0];
  const firstMaterial = MATERIAL_CATALOG.find(m => m.id === firstItemId);
  const totalItems = Object.values(request.items).reduce((sum, qty) => sum + qty, 0);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex">
        <div className="w-32 h-32 flex-shrink-0 bg-gray-50">
          {firstMaterial && (
            <img
              src={firstMaterial.imageUrl}
              alt={firstMaterial.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-secondary">
              {firstMaterial?.name || 'Unbekanntes Material'}
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusClass(request.status)}`}>
              {getStatusLabel(request.status)}
            </span>
          </div>

          <div className="text-sm text-text-secondary mb-3">
            <div className="flex gap-4">
              <span>Anfrage-ID: <span className="font-mono text-xs">{request.id.slice(0, 8)}</span></span>
              <span>{totalItems} {totalItems === 1 ? 'Einheit' : 'Einheiten'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="text-text-secondary">Erstellt:</span>
              <span className="ml-2">{formatDate(request.createdAt)}</span>
            </div>
            <div>
              <span className="text-text-secondary">Lieferdatum:</span>
              <span className="ml-2">{formatDate(request.deliveryDate)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {request.status === 'pending' && (
              <button className="px-4 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors">
                Stornieren
              </button>
            )}
            {request.status === 'inAction' && (
              <>
                <button className="px-4 py-2 bg-primary text-secondary font-medium rounded hover:bg-primary-hover transition-colors">
                  Verlängern
                </button>
                <button className="px-4 py-2 border border-secondary text-secondary rounded hover:bg-gray-50 transition-colors">
                  Früh zurückgeben
                </button>
              </>
            )}
            <button className="px-4 py-2 border border-gray-300 text-text-primary rounded hover:bg-gray-50 transition-colors">
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
