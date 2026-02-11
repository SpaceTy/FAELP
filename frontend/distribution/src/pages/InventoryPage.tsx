import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '@/services/api';
import { materialTypesService } from '@/services/materialTypes';
import type { InventorySummaryItem, MaterialInstance, MaterialStatus, MaterialType } from '@/types/inventory';

const STATUS_OPTIONS: Array<MaterialStatus | ''> = ['', 'available', 'rented', 'returned'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All Status',
  'available': 'In Stock',
  'rented': 'On Loan',
  'returned': 'Returned',
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

export function InventoryPage() {
  const [items, setItems] = useState<MaterialInstance[]>([]);
  const [summary, setSummary] = useState<InventorySummaryItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState<MaterialStatus | ''>('');
  const [location, setLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilterDropdownOpen, setTypeFilterDropdownOpen] = useState(false);

  // Filter states for sidebar
  const [statusFilters, setStatusFilters] = useState({
    inStock: true,
    lowStock: true,
    outOfStock: true,
    onLoan: true,
  });

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
      setItems(listData || []);
      setSummary(summaryData || []);
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

  // Check if any items have low stock (arbitrary threshold for demo)
  const lowStockCount = 5; // Mock value for demo

  const filteredItems = useMemo(() => {
    const safeItems = items || [];
    if (!searchQuery) return safeItems;
    const query = searchQuery.toLowerCase();
    return safeItems.filter(
      (item) =>
        item.id.toLowerCase().includes(query) ||
        item.typeId.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const handleSubmitFilter = async (e: Event) => {
    e.preventDefault();
    await loadData();
  };

  const handleResetFilter = async () => {
    setTypeId('');
    setStatus('');
    setLocation('');
    setSearchQuery('');
    setTimeout(() => {
      loadData();
    }, 0);
  };

  return (
    <main className="main-content">
      {/* Sidebar Filters */}
      <aside className="sidebar">
        <div className="filter-section">
          <h3>Stock Status</h3>
          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={statusFilters.inStock}
                onChange={(e) =>
                  setStatusFilters({ ...statusFilters, inStock: (e.target as HTMLInputElement).checked })
                }
              />
              <span>In Stock</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={statusFilters.lowStock}
                onChange={(e) =>
                  setStatusFilters({ ...statusFilters, lowStock: (e.target as HTMLInputElement).checked })
                }
              />
              <span>Low Stock</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={statusFilters.outOfStock}
                onChange={(e) =>
                  setStatusFilters({ ...statusFilters, outOfStock: (e.target as HTMLInputElement).checked })
                }
              />
              <span>Out of Stock</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={statusFilters.onLoan}
                onChange={(e) =>
                  setStatusFilters({ ...statusFilters, onLoan: (e.target as HTMLInputElement).checked })
                }
              />
              <span>On Loan</span>
            </label>
          </div>
        </div>

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
                  {typeId
                    ? materialTypes.find((mt) => mt.id === typeId)?.name || typeId
                    : 'All Types'}
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
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex flex-col ${typeId === mt.id ? 'bg-green-50 text-green-700' : ''}`}
                    >
                      <span className="font-medium">{mt.name}</span>
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
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleSubmitFilter({ preventDefault: () => {} } as Event)}
                className="btn-primary flex-1"
              >
                Apply
              </button>
              <button type="button" onClick={handleResetFilter} className="btn-secondary flex-1">
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="stats-card">
          <h3>Inventory Summary</h3>
          <div className="stat-row">
            <span>Total Items:</span>
            <span className="stat-value">{summaryTotals.total}</span>
          </div>
          <div className="stat-row">
            <span>Available:</span>
            <span className="stat-value approved">{summaryTotals.available}</span>
          </div>
          <div className="stat-row">
            <span>On Loan:</span>
            <span className="stat-value in-progress">{summaryTotals.rented}</span>
          </div>
          <div className="stat-row">
            <span>Low Stock:</span>
            <span className="stat-value pending">{lowStockCount}</span>
          </div>
          <div className="stat-row">
            <span>In Repair:</span>
            <span className="stat-value rejected">3</span>
          </div>
        </div>

        <button className="btn-primary btn-full-width" onClick={() => (window.location.href = '/enter')}>
          + Add New Item
        </button>
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

        {/* Inventory Alerts */}
        {lowStockCount > 0 && (
          <div className="alerts-section">
            <div className="alert alert-warning">
              <span className="alert-icon">!</span>
              <span className="alert-text">
                <strong>Low Stock Alert:</strong> {lowStockCount} items are running low and may need reordering.
              </span>
              <button className="alert-action">View Items</button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm">{error}</div>
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
                  <th className="col-id">ID</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Use Count</th>
                  <th>Request ID</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
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
                    <td>{item.typeId}</td>
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
                  </tr>
                ))}
                {filteredItems.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-text-secondary">
                      No inventory items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
