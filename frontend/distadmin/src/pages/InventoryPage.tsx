import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { inventoryService } from '@/services/inventory';
import type { MaterialInstance, MaterialStatus, InventorySummary } from '@/types/inventory';
import { InventoryFormModal } from '@/components/InventoryFormModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Modal } from '@/components/Modal';

const STATUS_OPTIONS: { value: MaterialStatus | ''; label: string; color: string; bgColor: string }[] = [
  { value: '', label: 'Alle', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  { value: 'available', label: 'Verfügbar', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'rented', label: 'Verliehen', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { value: 'returned', label: 'Zurückgegeben', color: 'text-gray-700', bgColor: 'bg-gray-200' },
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

function getStatusBadge(status: MaterialStatus) {
  switch (status) {
    case 'available':
      return <span className="status-badge status-available">Verfügbar</span>;
    case 'rented':
      return <span className="status-badge status-rented">Verliehen</span>;
    case 'returned':
      return <span className="status-badge status-returned">Zurückgegeben</span>;
    default:
      return <span className="status-badge status-returned">{status}</span>;
  }
}

export function InventoryPage() {
  // State
  const [instances, setInstances] = useState<MaterialInstance[]>([]);
  const [summary, setSummary] = useState<InventorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<MaterialStatus | ''>('');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeIdFilter, setTypeIdFilter] = useState('');

  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<MaterialInstance | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingInstance, setDeletingInstance] = useState<MaterialInstance | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailInstance, setDetailInstance] = useState<MaterialInstance | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningInstance, setAssigningInstance] = useState<MaterialInstance | null>(null);
  const [assignRequestId, setAssignRequestId] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [instancesData, summaryData] = await Promise.all([
        inventoryService.listMaterialInstances({
          status: statusFilter || undefined,
          location: locationFilter || undefined,
          typeId: typeIdFilter || undefined,
        }),
        inventoryService.getInventorySummary(),
      ]);
      setInstances(instancesData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, locationFilter, typeIdFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Summary calculations
  const summaryByStatus = useMemo(() => {
    const result: Record<string, number> = { available: 0, rented: 0, returned: 0 };
    summary.forEach((item) => {
      result[item.status] = (result[item.status] || 0) + item.count;
    });
    return result;
  }, [summary]);

  // Actions
  const handleFormSubmit = async (data: Record<string, string>) => {
    if (editingInstance) {
      // Update case
      await inventoryService.updateMaterialInstance(editingInstance.id, {
        status: data.status as MaterialStatus,
        location: data.location,
      });
    } else {
      // Create case
      await inventoryService.createMaterialInstance({
        typeId: data.typeId,
        description: data.description || undefined,
        location: data.location,
      });
    }
    await loadData();
  };

  const handleDelete = async () => {
    if (!deletingInstance) return;
    await inventoryService.deleteMaterialInstance(deletingInstance.id);
    setIsDeleteModalOpen(false);
    setDeletingInstance(null);
    await loadData();
  };

  const handleAssign = async () => {
    if (!assigningInstance || !assignRequestId.trim()) return;
    await inventoryService.assignMaterialInstance(assigningInstance.id, {
      requestId: assignRequestId.trim(),
    });
    setIsAssignModalOpen(false);
    setAssigningInstance(null);
    setAssignRequestId('');
    await loadData();
  };

  const handleRelease = async (instance: MaterialInstance) => {
    await inventoryService.releaseMaterialInstance(instance.id);
    await loadData();
  };

  // Open modals
  const openCreateModal = () => {
    setEditingInstance(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (instance: MaterialInstance) => {
    setEditingInstance(instance);
    setIsFormModalOpen(true);
  };

  const openDeleteModal = (instance: MaterialInstance) => {
    setDeletingInstance(instance);
    setIsDeleteModalOpen(true);
  };

  const openDetailModal = (instance: MaterialInstance) => {
    setDetailInstance(instance);
    setIsDetailModalOpen(true);
  };

  const openAssignModal = (instance: MaterialInstance) => {
    setAssigningInstance(instance);
    setAssignRequestId('');
    setIsAssignModalOpen(true);
  };

  return (
    <div className="h-full flex overflow-hidden bg-[#f0f2f5]">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-4 overflow-y-auto border-r border-gray-200 flex-shrink-0">
        <div className="mb-6">
          <button
            onClick={openCreateModal}
            className="w-full btn-logistics btn-logistics-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Material
          </button>
        </div>

        {/* Status Filter */}
        <div className="filter-section">
          <h3>Status</h3>
          <div className="filter-group">
            {STATUS_OPTIONS.map((option) => (
              <label key={option.value} className="checkbox-label">
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  checked={statusFilter === option.value}
                  onChange={() => setStatusFilter(option.value as MaterialStatus | '')}
                />
                <span className={option.color}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div className="filter-section">
          <h3>Standort</h3>
          <input
            type="text"
            value={locationFilter}
            onInput={(e) => setLocationFilter((e.target as HTMLInputElement).value)}
            placeholder="Filter nach Standort..."
            className="logistics-input text-sm"
          />
        </div>

        {/* Type Filter */}
        <div className="filter-section">
          <h3>Material-Typ</h3>
          <input
            type="text"
            value={typeIdFilter}
            onInput={(e) => setTypeIdFilter((e.target as HTMLInputElement).value)}
            placeholder="Filter nach Typ-ID..."
            className="logistics-input text-sm"
          />
        </div>

        {/* Stats */}
        <div className="stats-card">
          <h3>Zusammenfassung</h3>
          <div className="stat-row">
            <span>Verfügbar</span>
            <span className="stat-value text-green-600">{summaryByStatus.available}</span>
          </div>
          <div className="stat-row">
            <span>Verliehen</span>
            <span className="stat-value text-yellow-600">{summaryByStatus.rented}</span>
          </div>
          <div className="stat-row">
            <span>Zurückgegeben</span>
            <span className="stat-value text-gray-600">{summaryByStatus.returned}</span>
          </div>
          <div className="stat-row border-t border-gray-300 mt-2 pt-2">
            <span className="font-medium">Gesamt</span>
            <span className="stat-value">{instances.length}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Inventarverwaltung</h1>
          <p className="text-gray-600 mt-1">
            Verwalten Sie Material-Instanzen, weisen Sie sie Anfragen zu und verfolgen Sie den Status.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-logistics-accent border-t-transparent"></div>
            <span className="ml-3 text-gray-600">Wird geladen...</span>
          </div>
        )}

        {/* Inventory Grid */}
        {!isLoading && (
          <div className="grid gap-4">
            {instances.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-gray-500">Keine Material-Instanzen gefunden</p>
                <button
                  onClick={openCreateModal}
                  className="mt-4 text-logistics-accent hover:underline"
                >
                  Erste Instanz erstellen
                </button>
              </div>
            ) : (
              instances.map((instance) => (
                <div key={instance.id} className="logistics-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusBadge(instance.status)}
                        <span className="text-sm text-gray-500 font-mono">{instance.id.slice(0, 8)}...</span>
                      </div>
                      <h3 className="font-medium text-gray-800 mb-1">
                        Material-Typ: <span className="font-mono text-sm">{instance.typeId.slice(0, 16)}...</span>
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Standort: <span className="font-medium">{instance.location}</span>
                      </p>
                      {instance.description && (
                        <p className="text-sm text-gray-500 italic">{instance.description}</p>
                      )}
                      {instance.currentRequestId && (
                        <p className="text-sm text-yellow-700 mt-2">
                          Anfrage: <span className="font-mono">{instance.currentRequestId.slice(0, 16)}...</span>
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>Nutzungszahl: {instance.useCount}</span>
                        <span>Aktualisiert: {formatDate(instance.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => openDetailModal(instance)}
                        className="btn-logistics btn-logistics-outline text-xs py-1.5 px-3"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => openEditModal(instance)}
                        className="btn-logistics btn-logistics-outline text-xs py-1.5 px-3"
                      >
                        Bearbeiten
                      </button>
                      {instance.status === 'available' && (
                        <button
                          onClick={() => openAssignModal(instance)}
                          className="btn-logistics btn-logistics-primary text-xs py-1.5 px-3"
                        >
                          Zuweisen
                        </button>
                      )}
                      {instance.status === 'rented' && (
                        <button
                          onClick={() => handleRelease(instance)}
                          className="btn-logistics btn-logistics-warning text-xs py-1.5 px-3"
                        >
                          Freigeben
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(instance)}
                        className="btn-logistics btn-logistics-danger text-xs py-1.5 px-3"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Form Modal */}
      <InventoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        instance={editingInstance}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Material-Instanz löschen"
        message={`Möchten Sie die Material-Instanz "${deletingInstance?.id.slice(0, 16)}..." wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmText="Löschen"
        variant="danger"
      />

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Material-Instanz Details"
        maxWidth="md"
      >
        {detailInstance && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase">ID</label>
                <p className="font-mono text-sm">{detailInstance.id}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Status</label>
                <div className="mt-1">{getStatusBadge(detailInstance.status)}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Material-Typ ID</label>
                <p className="font-mono text-sm">{detailInstance.typeId}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Standort</label>
                <p className="text-sm font-medium">{detailInstance.location}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Nutzungszahl</label>
                <p className="text-sm">{detailInstance.useCount}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Aktuelle Anfrage</label>
                <p className="font-mono text-sm">
                  {detailInstance.currentRequestId || '-'}
                </p>
              </div>
            </div>
            {detailInstance.description && (
              <div>
                <label className="text-xs text-gray-500 uppercase">Beschreibung</label>
                <p className="text-sm mt-1">{detailInstance.description}</p>
              </div>
            )}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div>
                  <label className="uppercase">Erstellt am</label>
                  <p>{formatDate(detailInstance.createdAt)}</p>
                </div>
                <div>
                  <label className="uppercase">Aktualisiert am</label>
                  <p>{formatDate(detailInstance.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Material-Instanz zuweisen"
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="btn-logistics btn-logistics-outline"
            >
              Abbrechen
            </button>
            <button
              onClick={handleAssign}
              disabled={!assignRequestId.trim()}
              className="btn-logistics btn-logistics-primary"
            >
              Zuweisen
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Weisen Sie die Material-Instanz einer Anfrage zu. Die Instanz muss den Status "Verfügbar" haben.
          </p>
          {assigningInstance && (
            <div className="p-3 bg-gray-50 rounded text-sm">
              <span className="text-gray-600">Material-Instanz:</span>{' '}
              <span className="font-mono">{assigningInstance.id.slice(0, 16)}...</span>
            </div>
          )}
          <div>
            <label className="logistics-label" htmlFor="requestId">
              Anfrage ID *
            </label>
            <input
              type="text"
              id="requestId"
              value={assignRequestId}
              onInput={(e) => setAssignRequestId((e.target as HTMLInputElement).value)}
              className="logistics-input"
              placeholder="Anfrage-ID eingeben..."
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
