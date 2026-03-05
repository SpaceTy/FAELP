import { useState, useEffect, useCallback } from 'preact/hooks';
import { auditService } from '@/services/audit';
import type { AuditEntry, AuditFilters } from '@/types/audit';
import { Modal } from '@/components/Modal';
import { ConfirmModal } from '@/components/ConfirmModal';

const ENTITY_TYPES = [
  { value: '', label: 'Alle' },
  { value: 'material_instance', label: 'Material Instance' },
  { value: 'request', label: 'Request' },
  { value: 'user', label: 'User' },
];

const ACTIONS = [
  'inventory.create',
  'inventory.update',
  'inventory.delete',
  'inventory.archive',
  'inventory.unarchive',
  'inventory.assign',
  'inventory.release',
  'inventory.import',
  'request.approve',
  'request.in_action',
  'request.cancel',
  'request.archive',
  'request.unarchive',
  'user.create',
  'user.delete',
  'user.set_admin',
  'user.reset_password',
];

const ROLLBACKABLE_ACTIONS = [
  'inventory.update',
  'inventory.delete',
  'inventory.archive',
  'inventory.unarchive',
  'request.archive',
  'request.unarchive',
  'user.set_admin',
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAction(action: string): string {
  return action.replace('.', ': ').replace(/_/g, ' ');
}

function isRollbackable(action: string): boolean {
  return ROLLBACKABLE_ACTIONS.includes(action);
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filters, setFilters] = useState<AuditFilters>({
    limit: 50,
    offset: 0,
  });

  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [rollingBackEntry, setRollingBackEntry] = useState<AuditEntry | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await auditService.listAuditEntries(filters);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Audit-Log-Einträge');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined, offset: 0 }));
  };

  const handlePageChange = (newOffset: number) => {
    setFilters(prev => ({ ...prev, offset: newOffset }));
  };

  const openViewModal = (entry: AuditEntry) => {
    setSelectedEntry(entry);
    setIsViewModalOpen(true);
  };

  const openRollbackModal = (entry: AuditEntry) => {
    setRollingBackEntry(entry);
    setIsRollbackModalOpen(true);
  };

  const handleRollback = async () => {
    if (!rollingBackEntry) return;
    setIsRollingBack(true);
    try {
      const result = await auditService.rollbackAuditEntry(rollingBackEntry.id);
      if (result.success) {
        setSuccess(`Eintrag wurde erfolgreich zurückgesetzt`);
        setTimeout(() => setSuccess(null), 3000);
        setIsRollbackModalOpen(false);
        setRollingBackEntry(null);
        await loadEntries();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Zurücksetzen');
    } finally {
      setIsRollingBack(false);
    }
  };

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1;
  const hasMore = entries.length === (filters.limit || 50);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Audit-Log</h2>
          <p className="text-sm text-gray-500">Alle Aktionen im Überblick</p>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entity-Typ</label>
              <select
                className="form-select text-sm"
                value={filters.entityType || ''}
                onChange={(e) => handleFilterChange('entityType', (e.target as HTMLSelectElement).value)}
              >
                {ENTITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Aktion</label>
              <select
                className="form-select text-sm"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', (e.target as HTMLSelectElement).value)}
              >
                <option value="">Alle</option>
                {ACTIONS.map(action => (
                  <option key={action} value={action}>{formatAction(action)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Von</label>
              <input
                type="datetime-local"
                className="form-input text-sm"
                value={filters.from || ''}
                onChange={(e) => handleFilterChange('from', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bis</label>
              <input
                type="datetime-local"
                className="form-input text-sm"
                value={filters.to || ''}
                onChange={(e) => handleFilterChange('to', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-500 underline mt-1">Schließen</button>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zeitstempel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Benutzer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktion</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Laden...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Keine Einträge gefunden</td>
                </tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(entry.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {formatAction(entry.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.entityType}: {entry.entityId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {entry.rolledBack ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Zurückgesetzt
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Aktiv
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openViewModal(entry)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Ansehen
                      </button>
                      {!entry.rolledBack && isRollbackable(entry.action) && (
                        <button
                          onClick={() => openRollbackModal(entry)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Zurücksetzen
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => handlePageChange((filters.offset || 0) - (filters.limit || 50))}
            disabled={(filters.offset || 0) === 0}
            className="btn-logistics btn-logistics-secondary text-sm disabled:opacity-50"
          >
            Zurück
          </button>
          <span className="text-sm text-gray-600">
            Seite {currentPage}
          </span>
          <button
            onClick={() => handlePageChange((filters.offset || 0) + (filters.limit || 50))}
            disabled={!hasMore}
            className="btn-logistics btn-logistics-secondary text-sm disabled:opacity-50"
          >
            Weiter
          </button>
        </div>
      </div>

      {/* View Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Audit-Log Details"
      >
        {selectedEntry && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">ID</label>
              <p className="text-sm text-gray-900">{selectedEntry.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Zeitstempel</label>
              <p className="text-sm text-gray-900">{formatDate(selectedEntry.timestamp)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Benutzer</label>
              <p className="text-sm text-gray-900">{selectedEntry.username} ({selectedEntry.userId})</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aktion</label>
              <p className="text-sm text-gray-900">{selectedEntry.action}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Entity</label>
              <p className="text-sm text-gray-900">{selectedEntry.entityType}: {selectedEntry.entityId}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Details</label>
              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(selectedEntry.details, null, 2)}
              </pre>
            </div>
            {selectedEntry.previousState && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Vorheriger Zustand</label>
                <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(selectedEntry.previousState, null, 2)}
                </pre>
              </div>
            )}
            {selectedEntry.rolledBack && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Zurückgesetzt</label>
                <p className="text-sm text-gray-900">
                  Am {selectedEntry.rolledBackAt ? formatDate(selectedEntry.rolledBackAt) : 'unbekannt'} 
                  {selectedEntry.rolledBackBy ? ` von ${selectedEntry.rolledBackBy}` : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Rollback Confirmation Modal */}
      <ConfirmModal
        isOpen={isRollbackModalOpen}
        onClose={() => setIsRollbackModalOpen(false)}
        onConfirm={handleRollback}
        title="Aktion zurücksetzen"
        message={`Sind Sie sicher, dass Sie die Aktion "${rollingBackEntry?.action}" zurücksetzen möchten? Dies kann nicht rückgängig gemacht werden.`}
        confirmText={isRollingBack ? 'Wird zurückgesetzt...' : 'Zurücksetzen'}
        isLoading={isRollingBack}
      />
    </div>
  );
}
