import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '@/services/api';
import { materialTypesService } from '@/services/materialTypes';
import type { MaterialInstance, MaterialStatus, MaterialType } from '@/types/inventory';

const STATUS_OPTIONS: Array<MaterialStatus | ''> = ['', 'available', 'rented', 'returned', 'archived'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All Status',
  'available': 'In Stock',
  'rented': 'On Loan',
  'returned': 'Returned',
  'archived': 'Archived',
};

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }
  return parsed.toLocaleDateString('de-DE');
}

function statusBadgeClass(status: MaterialStatus): string {
  switch (status) {
    case 'available':
      return 'status-badge status-available';
    case 'rented':
      return 'status-badge status-rented';
    case 'returned':
      return 'status-badge status-returned';
    case 'archived':
      return 'status-badge status-archived';
    default:
      return 'status-badge';
  }
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

type PendingAction = {
  kind: 'archive' | 'unarchive' | 'delete';
  item: MaterialInstance;
};

export function InventoryPage() {
  const [items, setItems] = useState<MaterialInstance[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState<MaterialStatus | ''>('');
  const [location, setLocation] = useState('');
  const [humanCodeFilter, setHumanCodeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResultMessage, setImportResultMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [typeFilterDropdownOpen, setTypeFilterDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async (filters?: { typeId: string; status: MaterialStatus | ''; location: string; humanCodeFilter: string }) => {
    const nextTypeId = filters?.typeId ?? typeId;
    const nextStatus = filters?.status ?? status;
    const nextLocation = filters?.location ?? location;
    const nextHumanCode = filters?.humanCodeFilter ?? humanCodeFilter;

    setIsLoading(true);
    setError(null);
    try {
      const listData = await api.listMaterialInstances({
        typeId: nextTypeId.trim() || undefined,
        status: nextStatus || undefined,
        location: nextLocation.trim() || undefined,
        humanCode: nextHumanCode.trim() || undefined,
        limit: 200,
        offset: 0,
      });
      setItems(listData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inventory could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

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

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const safeItems = items || [];
    if (!searchQuery) return safeItems;
    const query = searchQuery.toLowerCase();
    return safeItems.filter(
      (item) =>
        item.id.toLowerCase().includes(query) ||
        item.humanCode.toLowerCase().includes(query) ||
        item.typeId.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const materialTypeByID = useMemo(() => {
    const map = new Map<string, MaterialType>();
    for (const mt of materialTypes) {
      map.set(mt.id, mt);
    }
    return map;
  }, [materialTypes]);

  const handleSubmitFilter = async (e: Event) => {
    e.preventDefault();
    await loadData();
  };

  const handleResetFilter = async () => {
    setTypeId('');
    setStatus('');
    setLocation('');
    setHumanCodeFilter('');
    setSearchQuery('');
    await loadData({ typeId: '', status: '', location: '', humanCodeFilter: '' });
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const blob = await api.exportInventoryCSV({
        typeId: typeId.trim() || undefined,
        status: status || undefined,
        location: location.trim() || undefined,
        humanCode: humanCodeFilter.trim() || undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    if (isImporting) return;
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setImportResultMessage(null);
    try {
      const result = await api.importInventoryCSV(file);
      setImportResultMessage(
        `Import complete: ${result.importedCount} rows (${result.createdCount} created, ${result.updatedCount} updated).`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setIsImporting(false);
      input.value = '';
    }
  };

  const handleArchive = async (item: MaterialInstance) => {
    if (item.status === 'rented') {
      setError('Rented items cannot be archived.');
      return;
    }
    setPendingAction({ kind: 'archive', item });
  };

  const handleDelete = async (item: MaterialInstance) => {
    setPendingAction({ kind: 'delete', item });
  };

  const handleUnarchive = async (item: MaterialInstance) => {
    setPendingAction({ kind: 'unarchive', item });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsMutating(true);
    setError(null);
    try {
      if (pendingAction.kind === 'archive') {
        await api.archiveMaterialInstance(pendingAction.item.id);
      } else if (pendingAction.kind === 'unarchive') {
        await api.unarchiveMaterialInstance(pendingAction.item.id);
      } else {
        await api.deleteMaterialInstance(pendingAction.item.id);
      }
      await loadData();
    } catch (err) {
      if (pendingAction.kind === 'archive') {
        setError(err instanceof Error ? err.message : 'Archiving failed.');
      } else if (pendingAction.kind === 'unarchive') {
        setError(err instanceof Error ? err.message : 'Unarchive failed.');
      } else {
        setError(err instanceof Error ? err.message : 'Delete failed.');
      }
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  };

  return (
    <main className="main-content">
      {/* Sidebar Filters */}
      <aside className="sidebar">
        <div className="filter-section">
          <h3>Quick Filter</h3>
          <div className="filter-group">
            {/* Material Type Dropdown */}
            <div className="relative">
              <div
                className="search-input cursor-pointer flex items-center justify-between"
                onClick={() => !isLoadingTypes && setTypeFilterDropdownOpen(!typeFilterDropdownOpen)}
              >
                <span className={typeId ? 'text-gray-900' : 'text-gray-400'}>
                  {typeId ? (
                    <span className="material-inline">
                      {materialTypeByID.get(typeId)?.imageUrl ? (
                        <img className="material-thumb" src={materialTypeByID.get(typeId)?.imageUrl} alt={materialTypeByID.get(typeId)?.name || typeId} />
                      ) : (
                        <span className="material-thumb-placeholder">?</span>
                      )}
                      {materialTypeByID.get(typeId)?.name || typeId}
                    </span>
                  ) : (
                    'All Types'
                  )}
                </span>
                {isLoadingTypes ? (
                  <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${typeFilterDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>

              {/* Dropdown */}
              {typeFilterDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setTypeId('');
                      setTypeFilterDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${!typeId ? 'bg-green-50 text-green-700' : ''}`}
                  >
                    All Types
                  </button>
                  {materialTypes.map((mt) => (
                    <button
                      key={mt.id}
                      type="button"
                      onClick={() => {
                        setTypeId(mt.id);
                        setTypeFilterDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex flex-col gap-1 ${typeId === mt.id ? 'bg-green-50 text-green-700' : ''}`}
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
                    </button>
                  ))}
                </div>
              )}

              {/* Click outside to close */}
              {typeFilterDropdownOpen && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setTypeFilterDropdownOpen(false)}
                />
              )}
            </div>

            <select
              value={status}
              onChange={(e) => setStatus((e.target as HTMLSelectElement).value as MaterialStatus | '')}
              className="sort-select"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={location}
              onInput={(e) => setLocation((e.target as HTMLInputElement).value)}
              placeholder="Location"
              className="search-input"
            />
            <input
              type="text"
              value={humanCodeFilter}
              onInput={(e) => setHumanCodeFilter((e.target as HTMLInputElement).value.toUpperCase())}
              placeholder="Code (e.g. ABCDE)"
              className="search-input"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleSubmitFilter({ preventDefault: () => {} } as Event)}
                className="btn-primary flex-1"
              >
                Apply
              </button>
              <button type="button" onClick={handleResetFilter} className="btn-secondary btn-secondary-light flex-1">
                Reset
              </button>
            </div>
          </div>
        </div>

        <button className="btn-primary btn-full-width" onClick={() => (window.location.href = '/enter')}>
          + Add New Item
        </button>
        <button className="btn-secondary btn-secondary-light btn-full-width mt-2" onClick={handleExportCSV} disabled={isExporting || isLoading}>
          {isExporting ? 'Exporting CSV...' : 'Export CSV'}
        </button>
        <button className="btn-secondary btn-secondary-light btn-full-width mt-2" onClick={handleImportClick} disabled={isImporting}>
          {isImporting ? 'Importing CSV...' : 'Import CSV'}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
      </aside>

      {/* Inventory Section */}
      <section className="content-section">
        <div className="section-header">
          <h2>Distribution Center Inventory</h2>
          <div className="section-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search inventory..."
                className="search-input"
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
              <button className="search-btn">Search</button>
            </div>
            <select className="sort-select">
              <option>Sort by: Name (A-Z)</option>
              <option>Name (Z-A)</option>
              <option>Stock Level</option>
              <option>Category</option>
              <option>Location</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {importResultMessage && (
          <div className="mt-4 p-3 rounded border border-green-300 bg-green-50 text-green-700 text-sm">{importResultMessage}</div>
        )}

        <div className="inventory-table-container">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-text-secondary">Loading inventory...</p>
              </div>
            </div>
          ) : (
            <table className="data-table inventory-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th className="col-id">ID</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Use Count</th>
                  <th>Request ID</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-mono text-sm">{item.humanCode}</span>
                    </td>
                    <td className="col-id">
                      <button
                        onClick={() => copyToClipboard(item.id)}
                        className="copy-id-btn"
                        title={`Copy ID: ${item.id}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </td>
                    <td>
                      <span className="material-inline">
                        {materialTypeByID.get(item.typeId)?.imageUrl ? (
                          <img className="material-thumb" src={materialTypeByID.get(item.typeId)?.imageUrl} alt={materialTypeByID.get(item.typeId)?.name || item.typeId} />
                        ) : (
                          <span className="material-thumb-placeholder">?</span>
                        )}
                        {materialTypeByID.get(item.typeId)?.name || item.typeId}
                      </span>
                    </td>
                    <td>{item.description || '-'}</td>
                    <td>{item.location}</td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td>{item.useCount}</td>
                    <td>
                      {item.currentRequestId ? (
                        <span className="font-mono text-xs">{item.currentRequestId}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{formatDate(item.updatedAt)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-secondary-light text-xs px-2 py-1"
                          disabled={isMutating || item.status === 'rented'}
                          onClick={() => (item.status === 'archived' ? handleUnarchive(item) : handleArchive(item))}
                        >
                          {item.status === 'archived' ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-secondary-light text-xs px-2 py-1"
                          disabled={isMutating}
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-text-secondary">
                      No inventory items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {pendingAction && (
        <div className="modal-overlay" onClick={() => !isMutating && setPendingAction(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {pendingAction.kind === 'delete'
                  ? 'Delete Inventory Item'
                  : pendingAction.kind === 'archive'
                    ? 'Archive Inventory Item'
                    : 'Unarchive Inventory Item'}
              </h3>
              <button className="modal-close" onClick={() => setPendingAction(null)} disabled={isMutating}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-text-secondary">
                {pendingAction.kind === 'delete'
                  ? `Delete item ${pendingAction.item.humanCode}? This cannot be undone.`
                  : pendingAction.kind === 'archive'
                    ? `Archive item ${pendingAction.item.humanCode}?`
                    : `Unarchive item ${pendingAction.item.humanCode}?`}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-secondary-light"
                  onClick={() => setPendingAction(null)}
                  disabled={isMutating}
                >
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={confirmPendingAction} disabled={isMutating}>
                  {isMutating
                    ? 'Processing...'
                    : pendingAction.kind === 'delete'
                      ? 'Delete'
                      : pendingAction.kind === 'archive'
                        ? 'Archive'
                        : 'Unarchive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
