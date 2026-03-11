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

const INVENTORY_PAGE_SIZE = 50;

type InventoryFilters = {
  typeId: string;
  status: MaterialStatus | '';
  location: string;
  humanCodeFilter: string;
  searchQuery: string;
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

function statusIcon(status: MaterialStatus): string {
  switch (status) {
    case 'available':
      return 'A';
    case 'rented':
      return 'L';
    case 'returned':
      return 'R';
    case 'archived':
      return 'X';
    default:
      return '?';
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
  const [addItemResultMessage, setAddItemResultMessage] = useState<string | null>(null);
  const [bulkAddResultMessage, setBulkAddResultMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [typeFilterDropdownOpen, setTypeFilterDropdownOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [addTypeId, setAddTypeId] = useState('');
  const [addCustomTypeId, setAddCustomTypeId] = useState('');
  const [addIsCustomType, setAddIsCustomType] = useState(false);
  const [addDescription, setAddDescription] = useState('');
  const [addUseCount, setAddUseCount] = useState(0);
  const [addLocation, setAddLocation] = useState('');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addTypeDropdownOpen, setAddTypeDropdownOpen] = useState(false);
  const [addIsBusy, setAddIsBusy] = useState(false);
  const [addIsGeneratingCode, setAddIsGeneratingCode] = useState(false);
  const [addGeneratedCode, setAddGeneratedCode] = useState('');
  const [addIsCodeConfirmed, setAddIsCodeConfirmed] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [bulkTypeId, setBulkTypeId] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [bulkAcknowledged, setBulkAcknowledged] = useState(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkTypeDropdownOpen, setBulkTypeDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inventoryTableRef = useRef<HTMLDivElement>(null);
  const activeFiltersRef = useRef<InventoryFilters>({
    typeId: '',
    status: '',
    location: '',
    humanCodeFilter: '',
    searchQuery: '',
  });
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMoreItems, setHasMoreItems] = useState(true);

  const buildCurrentFilters = (): InventoryFilters => ({
    typeId,
    status,
    location,
    humanCodeFilter,
    searchQuery,
  });

  const loadData = async (
    filters?: InventoryFilters,
    options: { append?: boolean; offset?: number } = {}
  ) => {
    const nextFilters = filters ?? buildCurrentFilters();
    const append = options.append ?? false;
    const nextOffset = options.offset ?? 0;

    activeFiltersRef.current = nextFilters;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setItems([]);
    }

    setError(null);
    try {
      const listData = await api.listMaterialInstances({
        typeId: nextFilters.typeId.trim() || undefined,
        status: nextFilters.status || undefined,
        location: nextFilters.location.trim() || undefined,
        humanCode: nextFilters.humanCodeFilter.trim() || undefined,
        query: nextFilters.searchQuery.trim() || undefined,
        limit: INVENTORY_PAGE_SIZE,
        offset: nextOffset,
      });
      const normalizedData = listData || [];
      setItems((prev) => (append ? [...prev, ...normalizedData] : normalizedData));
      setCurrentOffset(nextOffset + normalizedData.length);
      setHasMoreItems(normalizedData.length === INVENTORY_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inventory could not be loaded.');
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
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
    void loadData(activeFiltersRef.current, { append: false, offset: 0 });
  }, []);

  const materialTypeByID = useMemo(() => {
    const map = new Map<string, MaterialType>();
    for (const mt of materialTypes) {
      map.set(mt.id, mt);
    }
    return map;
  }, [materialTypes]);

  const filteredAddMaterialTypes = useMemo(() => {
    if (!addSearchQuery.trim()) return materialTypes;
    const query = addSearchQuery.toLowerCase();
    return materialTypes.filter((mt) => mt.name.toLowerCase().includes(query) || mt.id.toLowerCase().includes(query));
  }, [materialTypes, addSearchQuery]);

  const filteredBulkMaterialTypes = useMemo(() => {
    if (!bulkSearchQuery.trim()) return materialTypes;
    const query = bulkSearchQuery.toLowerCase();
    return materialTypes.filter((mt) => mt.name.toLowerCase().includes(query) || mt.id.toLowerCase().includes(query));
  }, [materialTypes, bulkSearchQuery]);

  const handleSubmitFilter = async (e: Event) => {
    e.preventDefault();
    await loadData(buildCurrentFilters(), { append: false, offset: 0 });
  };

  const handleResetFilter = async () => {
    setTypeId('');
    setStatus('');
    setLocation('');
    setHumanCodeFilter('');
    setSearchQuery('');
    await loadData({ typeId: '', status: '', location: '', humanCodeFilter: '', searchQuery: '' }, { append: false, offset: 0 });
  };

  const handleExportCSV = async () => {
    const appliedFilters = activeFiltersRef.current;
    setIsExporting(true);
    setError(null);
    try {
      const blob = await api.exportInventoryCSV({
        typeId: appliedFilters.typeId.trim() || undefined,
        status: appliedFilters.status || undefined,
        location: appliedFilters.location.trim() || undefined,
        humanCode: appliedFilters.humanCodeFilter.trim() || undefined,
        query: appliedFilters.searchQuery.trim() || undefined,
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
      await loadData(activeFiltersRef.current, { append: false, offset: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setIsImporting(false);
      input.value = '';
    }
  };

  const resetAddItemForm = () => {
    setAddTypeId('');
    setAddCustomTypeId('');
    setAddIsCustomType(false);
    setAddDescription('');
    setAddUseCount(0);
    setAddLocation('');
    setAddSearchQuery('');
    setAddTypeDropdownOpen(false);
    setAddGeneratedCode('');
    setAddIsCodeConfirmed(false);
    setAddItemError(null);
  };

  const loadAddGeneratedCode = async () => {
    setAddIsGeneratingCode(true);
    try {
      const code = await api.generateMaterialCode();
      setAddGeneratedCode(code);
      setAddIsCodeConfirmed(false);
    } catch (err) {
      setAddItemError(err instanceof Error ? err.message : 'Code could not be generated.');
    } finally {
      setAddIsGeneratingCode(false);
    }
  };

  const openAddItemModal = async () => {
    resetAddItemForm();
    setIsAddItemModalOpen(true);
    await loadAddGeneratedCode();
  };

  const handleAddItemSubmit = async (e: Event) => {
    e.preventDefault();
    setAddItemError(null);

    const finalTypeId = addIsCustomType ? addCustomTypeId.trim() : addTypeId.trim();
    if (!finalTypeId) {
      setAddItemError('Select a material type.');
      return;
    }
    if (!addLocation.trim()) {
      setAddItemError('Location is required.');
      return;
    }
    if (!addGeneratedCode || !addIsCodeConfirmed) {
      setAddItemError('Write the material code onto the physical item and confirm it before saving.');
      return;
    }

    setAddIsBusy(true);
    try {
      const created = await api.createMaterialInstance({
        humanCode: addGeneratedCode,
        typeId: finalTypeId,
        description: addDescription.trim(),
        useCount: addUseCount,
        location: addLocation.trim(),
      });
      const materialLabel = materialTypeByID.get(created.typeId)?.name || created.typeId;
      setAddItemResultMessage(`Added ${materialLabel} with code ${created.humanCode} to inventory.`);
      setIsAddItemModalOpen(false);
      resetAddItemForm();
      await loadData(activeFiltersRef.current, { append: false, offset: 0 });
    } catch (err) {
      setAddItemError(err instanceof Error ? err.message : 'Item creation failed.');
    } finally {
      setAddIsBusy(false);
    }
  };

  const handleSelectAddMaterialType = (selectedTypeId: string) => {
    setAddTypeId(selectedTypeId);
    setAddIsCustomType(false);
    setAddTypeDropdownOpen(false);
    setAddSearchQuery('');
  };

  const handleBulkAdd = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setBulkAddResultMessage(null);

    if (!bulkTypeId.trim()) {
      setError('Select a material type for the bulk add.');
      return;
    }

    if (!Number.isInteger(bulkQuantity) || bulkQuantity <= 0) {
      setError('Quantity must be a positive whole number.');
      return;
    }

    if (!bulkAcknowledged) {
      setError('You must confirm that you read and understand the bulk add notice.');
      return;
    }

    setIsBulkAdding(true);
    try {
      const result = await api.bulkCreateMaterialInstances({
        typeId: bulkTypeId.trim(),
        quantity: bulkQuantity,
        acknowledged: bulkAcknowledged,
      });
      const materialLabel = materialTypeByID.get(bulkTypeId)?.name || bulkTypeId;
      setBulkAddResultMessage(`Bulk added ${result.createdCount} ${materialLabel} item${result.createdCount === 1 ? '' : 's'} to inventory.`);
      setBulkQuantity(1);
      setBulkAcknowledged(false);
      setIsBulkAddModalOpen(false);
      await loadData(activeFiltersRef.current, { append: false, offset: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk add failed.');
    } finally {
      setIsBulkAdding(false);
    }
  };

  const getSelectedAddMaterialTypeName = () => {
    const mt = materialTypes.find((m) => m.id === addTypeId);
    return mt ? `${mt.name} (${mt.id})` : addTypeId;
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
      await loadData(activeFiltersRef.current, { append: false, offset: 0 });
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

  useEffect(() => {
    const container = inventoryTableRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isLoading || isLoadingMore || !hasMoreItems) return;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom <= 120) {
        void loadData(activeFiltersRef.current, { append: true, offset: currentOffset });
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentOffset, hasMoreItems, isLoading, isLoadingMore]);

  useEffect(() => {
    const container = inventoryTableRef.current;
    if (!container || isLoading || isLoadingMore || !hasMoreItems) return;
    if (container.scrollHeight <= container.clientHeight + 1) {
      void loadData(activeFiltersRef.current, { append: true, offset: currentOffset });
    }
  }, [items, currentOffset, hasMoreItems, isLoading, isLoadingMore]);

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

        <button type="button" className="btn-primary btn-full-width" onClick={openAddItemModal}>
          + Add New Item
        </button>
        <button
          type="button"
          className="btn-secondary btn-secondary-light btn-full-width mt-2"
          onClick={() => setIsBulkAddModalOpen(true)}
          disabled={isLoadingTypes}
        >
          Bulk Add Inventory
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void loadData(buildCurrentFilters(), { append: false, offset: 0 });
                  }
                }}
              />
              <button
                type="button"
                className="search-btn"
                onClick={() => void loadData(buildCurrentFilters(), { append: false, offset: 0 })}
              >
                Search
              </button>
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
        {addItemResultMessage && (
          <div className="mt-4 p-3 rounded border border-green-300 bg-green-50 text-green-700 text-sm">{addItemResultMessage}</div>
        )}
        {bulkAddResultMessage && (
          <div className="mt-4 p-3 rounded border border-green-300 bg-green-50 text-green-700 text-sm">{bulkAddResultMessage}</div>
        )}

        <div className="inventory-table-container" ref={inventoryTableRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-text-secondary">Loading inventory...</p>
              </div>
            </div>
          ) : (
            <table className="data-table inventory-table inventory-table-compact">
              <thead>
                <tr>
                  <th>Code</th>
                  <th className="col-id">ID</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Use Count</th>
                  <th>Req</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
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
                      <span
                        className={`${statusBadgeClass(item.status)} status-icon-badge`}
                        title={STATUS_LABELS[item.status]}
                        aria-label={STATUS_LABELS[item.status]}
                      >
                        {statusIcon(item.status)}
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
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="table-icon-btn"
                          disabled={isMutating || item.status === 'rented'}
                          onClick={() => (item.status === 'archived' ? handleUnarchive(item) : handleArchive(item))}
                          title={item.status === 'archived' ? 'Unarchive item' : 'Archive item'}
                          aria-label={item.status === 'archived' ? 'Unarchive item' : 'Archive item'}
                        >
                          {item.status === 'archived' ? 'U' : 'A'}
                        </button>
                        <button
                          type="button"
                          className="table-icon-btn table-icon-btn-danger"
                          disabled={isMutating}
                          onClick={() => handleDelete(item)}
                          title="Delete item"
                          aria-label="Delete item"
                        >
                          X
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-text-secondary">
                      No inventory items found.
                    </td>
                  </tr>
                )}
                {items.length > 0 && isLoadingMore && (
                  <tr>
                    <td colSpan={10} className="text-center py-4 text-text-secondary">
                      Loading more inventory...
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

      {isAddItemModalOpen && (
        <div className="modal-overlay" onClick={() => !addIsBusy && setIsAddItemModalOpen(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Inventory Item</h3>
              <button className="modal-close" onClick={() => setIsAddItemModalOpen(false)} disabled={addIsBusy}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-text-secondary mb-4">
                Add one physical item to inventory. Before saving, write the generated 5-letter material code onto the physical item.
              </p>
              {addItemError && (
                <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm">{addItemError}</div>
              )}
              <form className="bulk-add-form" onSubmit={handleAddItemSubmit}>
                <div>
                  <label className="bulk-add-label">Material type</label>

                  {addIsCustomType ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={addCustomTypeId}
                          onInput={(e) => setAddCustomTypeId((e.target as HTMLInputElement).value)}
                          placeholder="Enter new type ID..."
                          className="search-input"
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setAddIsCustomType(false);
                            setAddCustomTypeId('');
                          }}
                          className="btn-secondary btn-secondary-light"
                        >
                          Choose from list
                        </button>
                      </div>
                      <p className="text-xs text-text-secondary">
                        Enter a new type ID or switch back to the existing material type list.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div
                        className="bulk-type-trigger"
                        onClick={() => !isLoadingTypes && setAddTypeDropdownOpen(!addTypeDropdownOpen)}
                      >
                        <span className={addTypeId ? 'selector-value' : 'selector-placeholder'}>
                          {addTypeId ? (
                            <span className="material-inline">
                              {materialTypes.find((m) => m.id === addTypeId)?.imageUrl ? (
                                <img
                                  className="material-thumb"
                                  src={materialTypes.find((m) => m.id === addTypeId)?.imageUrl}
                                  alt={materialTypes.find((m) => m.id === addTypeId)?.name || addTypeId}
                                />
                              ) : (
                                <span className="material-thumb-placeholder">?</span>
                              )}
                              {getSelectedAddMaterialTypeName()}
                            </span>
                          ) : (
                            'Select material type...'
                          )}
                        </span>
                        {isLoadingTypes ? (
                          <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform ${addTypeDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>

                      {addTypeDropdownOpen && (
                        <div className="material-selector-dropdown">
                          <div className="material-selector-search">
                            <input
                              type="text"
                              value={addSearchQuery}
                              onInput={(e) => setAddSearchQuery((e.target as HTMLInputElement).value)}
                              placeholder="Search..."
                              className="search-input"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setAddIsCustomType(true);
                              setAddTypeDropdownOpen(false);
                              setAddSearchQuery('');
                            }}
                            className="material-selector-item material-selector-action"
                          >
                            New type...
                          </button>

                          {filteredAddMaterialTypes.length === 0 ? (
                            <div className="material-selector-empty">
                              {addSearchQuery ? 'No material types found' : 'No material types available'}
                            </div>
                          ) : (
                            filteredAddMaterialTypes.map((mt) => (
                              <button
                                key={mt.id}
                                type="button"
                                onClick={() => handleSelectAddMaterialType(mt.id)}
                                className={`material-selector-item ${addTypeId === mt.id ? 'selected' : ''}`}
                              >
                                <span className="font-medium material-inline">
                                  {mt.imageUrl ? (
                                    <img className="material-thumb" src={mt.imageUrl} alt={mt.name} />
                                  ) : (
                                    <span className="material-thumb-placeholder">?</span>
                                  )}
                                  {mt.name}
                                </span>
                                <span className="material-selector-meta">ID: {mt.id}</span>
                                {mt.description && <span className="material-selector-description">{mt.description}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {addTypeDropdownOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setAddTypeDropdownOpen(false)} />
                      )}
                    </div>
                  )}
                </div>

                <div className="bulk-add-grid">
                  <div>
                    <label className="bulk-add-label" htmlFor="add-location-input">Location</label>
                    <input
                      id="add-location-input"
                      type="text"
                      required
                      value={addLocation}
                      onInput={(e) => setAddLocation((e.target as HTMLInputElement).value)}
                      placeholder="e.g. Shelf A"
                      className="search-input"
                    />
                  </div>
                  <div>
                    <label className="bulk-add-label" htmlFor="add-use-count-input">Use count</label>
                    <input
                      id="add-use-count-input"
                      type="number"
                      min="0"
                      value={addUseCount}
                      onInput={(e) => setAddUseCount(parseInt((e.target as HTMLInputElement).value, 10) || 0)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="bulk-add-label" htmlFor="add-description-input">Description</label>
                  <textarea
                    id="add-description-input"
                    value={addDescription}
                    onInput={(e) => setAddDescription((e.target as HTMLTextAreaElement).value)}
                    placeholder="Optional description"
                    rows={3}
                    className="inventory-textarea"
                  />
                </div>

                <div className="bulk-add-notice">
                  <div className="bulk-add-code-row">
                    <div>
                      <p className="bulk-add-code-label">Material code</p>
                      <p className="bulk-add-code-value">{addIsGeneratingCode ? '.....' : addGeneratedCode || '-----'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadAddGeneratedCode}
                      disabled={addIsBusy || addIsGeneratingCode}
                      className="btn-secondary btn-secondary-light"
                    >
                      Generate new
                    </button>
                  </div>
                  <label className="bulk-add-checkbox">
                    <input
                      type="checkbox"
                      checked={addIsCodeConfirmed}
                      onChange={(e) => setAddIsCodeConfirmed((e.target as HTMLInputElement).checked)}
                      disabled={!addGeneratedCode || addIsGeneratingCode}
                    />
                    <span>I have written the material code onto the physical item.</span>
                  </label>
                </div>

                <div className="bulk-add-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-secondary-light"
                    onClick={() => setIsAddItemModalOpen(false)}
                    disabled={addIsBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={
                      addIsBusy ||
                      addIsGeneratingCode ||
                      !addGeneratedCode ||
                      !addIsCodeConfirmed ||
                      (!addIsCustomType && !addTypeId) ||
                      (addIsCustomType && !addCustomTypeId.trim())
                    }
                  >
                    {addIsBusy ? 'Saving...' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isBulkAddModalOpen && (
        <div className="modal-overlay" onClick={() => !isBulkAdding && setIsBulkAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bulk Add Inventory</h3>
              <button className="modal-close" onClick={() => setIsBulkAddModalOpen(false)} disabled={isBulkAdding}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <form className="bulk-add-form" onSubmit={handleBulkAdd}>
                <div className="bulk-add-grid">
                  <div>
                    <label className="bulk-add-label" htmlFor="bulk-type-select">Material type</label>
                    <div className="relative">
                      <div
                        id="bulk-type-select"
                        className="bulk-type-trigger"
                        onClick={() => !isLoadingTypes && setBulkTypeDropdownOpen(!bulkTypeDropdownOpen)}
                      >
                        <span className={bulkTypeId ? 'selector-value' : 'selector-placeholder'}>
                          {bulkTypeId ? (
                            <span className="material-inline">
                              {materialTypeByID.get(bulkTypeId)?.imageUrl ? (
                                <img
                                  className="material-thumb"
                                  src={materialTypeByID.get(bulkTypeId)?.imageUrl}
                                  alt={materialTypeByID.get(bulkTypeId)?.name || bulkTypeId}
                                />
                              ) : (
                                <span className="material-thumb-placeholder">?</span>
                              )}
                              {materialTypeByID.get(bulkTypeId)?.name || bulkTypeId}
                            </span>
                          ) : (
                            'Select material type...'
                          )}
                        </span>
                        {isLoadingTypes ? (
                          <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform ${bulkTypeDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>

                      {bulkTypeDropdownOpen && (
                        <div className="material-selector-dropdown">
                          <div className="material-selector-search">
                            <input
                              type="text"
                              value={bulkSearchQuery}
                              onInput={(e) => setBulkSearchQuery((e.target as HTMLInputElement).value)}
                              placeholder="Search..."
                              className="search-input"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {filteredBulkMaterialTypes.length === 0 ? (
                            <div className="material-selector-empty">
                              {bulkSearchQuery ? 'No material types found' : 'No material types available'}
                            </div>
                          ) : (
                            filteredBulkMaterialTypes.map((mt) => (
                              <button
                                key={mt.id}
                                type="button"
                                onClick={() => {
                                  setBulkTypeId(mt.id);
                                  setBulkTypeDropdownOpen(false);
                                  setBulkSearchQuery('');
                                }}
                                className={`material-selector-item ${bulkTypeId === mt.id ? 'selected' : ''}`}
                              >
                                <span className="font-medium material-inline">
                                  {mt.imageUrl ? (
                                    <img className="material-thumb" src={mt.imageUrl} alt={mt.name} />
                                  ) : (
                                    <span className="material-thumb-placeholder">?</span>
                                  )}
                                  {mt.name}
                                </span>
                                <span className="material-selector-meta">ID: {mt.id}</span>
                                {mt.description && <span className="material-selector-description">{mt.description}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {bulkTypeDropdownOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setBulkTypeDropdownOpen(false)} />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="bulk-add-label" htmlFor="bulk-quantity-input">Quantity</label>
                    <input
                      id="bulk-quantity-input"
                      type="number"
                      min="1"
                      step="1"
                      value={bulkQuantity}
                      onInput={(e) => setBulkQuantity((e.target as HTMLInputElement).valueAsNumber || 0)}
                      className="search-input"
                      placeholder="Quantity"
                      disabled={isBulkAdding}
                    />
                  </div>
                </div>
                <div className="bulk-add-notice">
                  <p>
                    When bulk adding inventory items codes/qr-codes will be generated, as the nature of bulk adding doesn't allow for the
                    code/qr-code to be put onto the inventory item there will be no way for the platform to distinguish between them.
                  </p>
                  <p>
                    This means that when packaging a shipment with them the person doing so will have to pick random codes from the
                    inventory list, and preferably put them onto the physical inventory items.
                  </p>
                  <p>
                    This way the load of physically putting the codes onto the items is distributed to the point of packaging.
                  </p>
                </div>
                <label className="bulk-add-checkbox">
                  <input
                    type="checkbox"
                    checked={bulkAcknowledged}
                    onChange={(e) => setBulkAcknowledged((e.target as HTMLInputElement).checked)}
                    disabled={isBulkAdding}
                  />
                  <span>I have read and understand this.</span>
                </label>
                <div className="bulk-add-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-secondary-light"
                    onClick={() => setIsBulkAddModalOpen(false)}
                    disabled={isBulkAdding}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={isBulkAdding || isLoadingTypes}>
                    {isBulkAdding ? 'Bulk adding...' : 'Bulk Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
