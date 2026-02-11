import { useEffect, useState, useMemo } from 'preact/hooks';
import { mockPackagingService } from '@/services/mockPackaging';
import type {
  PackagingOrder,
  PackagingStats,
  PackagingStatus,
  PackageSize,
  ListPackagingParams,
} from '@/types/packaging';

const STATUS_OPTIONS: Array<PackagingStatus | ''> = ['', 'to_package', 'in_progress', 'ready', 'shipped'];
const PACKAGE_SIZE_OPTIONS: Array<PackageSize | ''> = ['', 'small', 'medium', 'large', 'pallet'];
const DATE_OPTIONS: Array<{ value: ListPackagingParams['dateRange']; label: string }> = [
  { value: '', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'This Week' },
  { value: 'nextWeek', label: 'Next Week' },
];

function statusClass(status: PackagingStatus): string {
  switch (status) {
    case 'to_package':
      return 'status-badge status-to-package';
    case 'in_progress':
      return 'status-badge status-in-progress';
    case 'ready':
      return 'status-badge status-ready';
    case 'shipped':
      return 'status-badge status-shipped';
    default:
      return 'status-badge';
  }
}

function statusLabel(status: PackagingStatus): string {
  switch (status) {
    case 'to_package':
      return 'To Package';
    case 'in_progress':
      return 'In Progress';
    case 'ready':
      return 'Ready';
    case 'shipped':
      return 'Shipped';
    default:
      return status;
  }
}

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getShipByLabel(dateStr: string): { text: string; urgent: boolean } {
  const target = new Date(dateStr);
  const now = new Date('2026-01-19'); // Mock current date
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: 'Overdue', urgent: true };
  if (diffDays === 0) return { text: 'Ship by: Today', urgent: true };
  if (diffDays === 1) return { text: 'Ship by: Tomorrow', urgent: false };
  return { text: `Ship by: ${formatDate(dateStr)}`, urgent: false };
}

function packageSizeLabel(size: PackageSize): string {
  switch (size) {
    case 'small':
      return 'Small Package';
    case 'medium':
      return 'Medium Package';
    case 'large':
      return 'Large Package';
    case 'pallet':
      return 'Pallet';
    default:
      return size;
  }
}

export function PackagingPage() {
  const [orders, setOrders] = useState<PackagingOrder[]>([]);
  const [stats, setStats] = useState<PackagingStats>({ toPackage: 0, inProgress: 0, ready: 0, shippedToday: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PackagingOrder | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PackagingStatus | ''>('');
  const [sizeFilter, setSizeFilter] = useState<PackageSize | ''>('');
  const [dateFilter, setDateFilter] = useState<ListPackagingParams['dateRange']>('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ordersData, statsData] = await Promise.all([
        mockPackagingService.listOrders({
          status: statusFilter,
          packageSize: sizeFilter,
          dateRange: dateFilter,
        }),
        mockPackagingService.getPackagingStats(),
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, sizeFilter, dateFilter]);

  const handleTogglePacked = async (orderId: string, itemIndex: number, currentValue: boolean) => {
    try {
      await mockPackagingService.markItemPacked({
        orderId,
        itemIndex,
        packed: !currentValue,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const handleMarkShipped = async (orderId: string) => {
    try {
      await mockPackagingService.markShipped({
        orderId,
        trackingNumber: `1Z${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as shipped');
    }
  };

  const packedCount = useMemo(() => {
    if (!selectedOrder) return 0;
    return selectedOrder.items.filter((item) => item.isPacked).length;
  }, [selectedOrder]);

  const progressPercent = useMemo(() => {
    if (!selectedOrder || selectedOrder.items.length === 0) return 0;
    return Math.round((packedCount / selectedOrder.items.length) * 100);
  }, [packedCount, selectedOrder]);

  return (
    <main className="main-content">
      {/* Sidebar Filters */}
      <aside className="sidebar">
        <div className="filter-section">
          <h3>Packaging Status</h3>
          <div className="filter-group">
            {STATUS_OPTIONS.map((s) => (
              <label key={s || 'all'} className="checkbox-label">
                <input
                  type="radio"
                  name="status"
                  checked={statusFilter === s}
                  onChange={() => setStatusFilter(s)}
                />
                <span>{s ? statusLabel(s as PackagingStatus) : 'All'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Package Size</h3>
          <div className="filter-group">
            {PACKAGE_SIZE_OPTIONS.map((s) => (
              <label key={s || 'all'} className="checkbox-label">
                <input
                  type="radio"
                  name="size"
                  checked={sizeFilter === s}
                  onChange={() => setSizeFilter(s)}
                />
                <span>{s ? packageSizeLabel(s as PackageSize) : 'All'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Ship Date</h3>
          <div className="filter-group">
            {DATE_OPTIONS.map((d) => (
              <label key={d.value || 'all'} className="checkbox-label">
                <input
                  type="radio"
                  name="date"
                  checked={dateFilter === d.value}
                  onChange={() => setDateFilter(d.value)}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <h3>Packaging Queue</h3>
          <div className="stat-row">
            <span>To Package:</span>
            <span className="stat-value pending">{stats.toPackage}</span>
          </div>
          <div className="stat-row">
            <span>In Progress:</span>
            <span className="stat-value in-progress">{stats.inProgress}</span>
          </div>
          <div className="stat-row">
            <span>Ready:</span>
            <span className="stat-value ready">{stats.ready}</span>
          </div>
          <div className="stat-row">
            <span>Shipped Today:</span>
            <span className="stat-value approved">{stats.shippedToday}</span>
          </div>
        </div>
      </aside>

      {/* Packaging Section */}
      <section className="content-section">
        <div className="section-header">
          <h2>Packaging Queue</h2>
          <div className="section-controls">
            <span className="results-count">{orders.length} orders to package</span>
            <select className="sort-select">
              <option>Sort by: Ship Date (Urgent First)</option>
              <option>Newest First</option>
              <option>Package Size</option>
              <option>Destination</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="packaging-grid">
          {isLoading ? (
            <div className="flex items-center justify-center col-span-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-text-secondary">Loading orders...</p>
              </div>
            </div>
          ) : (
            orders.map((order) => {
              const shipBy = getShipByLabel(order.shipByDate);
              const packedItems = order.items.filter((i) => i.isPacked).length;
              const totalItems = order.items.length;
              const isUrgent = shipBy.urgent || order.status === 'to_package';

              return (
                <div key={order.id} className={`packaging-card ${isUrgent ? 'urgent' : ''}`}>
                  <div className="card-header">
                    <div className="order-info">
                      <span className="order-id">{order.id}</span>
                      <span className={statusClass(order.status)}>{statusLabel(order.status)}</span>
                    </div>
                    <span className={`ship-date ${shipBy.urgent ? 'urgent' : ''}`}>{shipBy.text}</span>
                  </div>

                  <div className="destination-info">
                    <h4>{order.recipientName}</h4>
                    <p>{order.recipientOrg}</p>
                    {order.recipientAddress.map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>

                  <div className="items-list">
                    <h4>Items to Pack ({totalItems})</h4>
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className={`pack-item ${item.isPacked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          id={`${order.id}-${idx}`}
                          checked={item.isPacked}
                          onChange={() => handleTogglePacked(order.id, idx, item.isPacked)}
                        />
                        <label htmlFor={`${order.id}-${idx}`}>
                          <span className="item-qty">{item.quantity}x</span>
                          <span className="item-name">{item.materialName}</span>
                          <span className="item-location">{item.location}</span>
                        </label>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <button className="btn-view-items" onClick={() => setSelectedOrder(order)}>
                        +{order.items.length - 3} more items
                      </button>
                    )}
                  </div>

                  <div className="package-info">
                    <span className="package-size">{packageSizeLabel(order.packageSize)}</span>
                    <span className="total-items">{packedItems}/{totalItems} packed</span>
                  </div>

                  {order.status === 'ready' && (
                    <div className="card-actions">
                      <button className="btn-success" onClick={() => handleMarkShipped(order.id)}>
                        Mark Shipped
                      </button>
                      {order.trackingNumber && (
                        <span className="tracking-info">Tracking: {order.trackingNumber}</span>
                      )}
                    </div>
                  )}

                  {order.status !== 'shipped' && (
                    <div className="card-actions">
                      <button className="btn-primary" onClick={() => setSelectedOrder(order)}>
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {orders.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-8 text-text-secondary">
              No packaging orders found.
            </div>
          )}
        </div>
      </section>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Pack Order {selectedOrder.id}</h3>
                <span className={statusClass(selectedOrder.status)}>{statusLabel(selectedOrder.status)}</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="font-semibold mb-2">Recipient</h4>
                  <p><strong>{selectedOrder.recipientName}</strong></p>
                  <p>{selectedOrder.recipientOrg}</p>
                  {selectedOrder.recipientAddress.map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Shipping Details</h4>
                  <p><strong>Ship By:</strong> {formatDate(selectedOrder.shipByDate)}</p>
                  <p><strong>Package Size:</strong> {packageSizeLabel(selectedOrder.packageSize)}</p>
                  {selectedOrder.trackingNumber && (
                    <p><strong>Tracking:</strong> {selectedOrder.trackingNumber}</p>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold">Packing Checklist</h4>
                  <span className="text-sm text-text-secondary">
                    {packedCount} of {selectedOrder.items.length} items packed
                  </span>
                </div>
                <div className="progress-bar mb-4">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                  <span className="progress-text">{progressPercent}% Complete</span>
                </div>
                <div className="packing-checklist">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className={`packing-item ${item.isPacked ? 'packed' : ''}`}>
                      <div className="item-checkbox">
                        <input
                          type="checkbox"
                          id={`detail-${selectedOrder.id}-${idx}`}
                          checked={item.isPacked}
                          onChange={() => handleTogglePacked(selectedOrder.id, idx, item.isPacked)}
                        />
                      </div>
                      <div className="item-details">
                        <h5>{item.materialName}</h5>
                        <p className="text-sm text-text-secondary">Location: {item.location}</p>
                      </div>
                      <div className="item-quantity">
                        <span className="qty-value">{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.status === 'ready' && (
                <div className="flex justify-end">
                  <button className="btn-success" onClick={() => handleMarkShipped(selectedOrder.id)}>
                    Mark as Shipped
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
