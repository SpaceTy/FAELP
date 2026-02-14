import { useEffect, useState } from 'preact/hooks';
import { api, type IncomingRequest } from '@/services/api';

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getShipByLabel(dateStr: string): { text: string; urgent: boolean } {
  const target = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: 'Overdue', urgent: true };
  if (diffDays === 0) return { text: 'Ship by: Today', urgent: true };
  if (diffDays === 1) return { text: 'Ship by: Tomorrow', urgent: false };
  return { text: `Ship by: ${formatDate(dateStr)}`, urgent: false };
}

function totalQuantity(order: IncomingRequest): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function PackagingPage() {
  const [orders, setOrders] = useState<IncomingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<IncomingRequest | null>(null);
  const [packagingOrder, setPackagingOrder] = useState<IncomingRequest | null>(null);
  const [packChecks, setPackChecks] = useState<Record<string, boolean>>({});
  const [selectedLabelURL, setSelectedLabelURL] = useState<string | null>(null);
  const [selectedLabelError, setSelectedLabelError] = useState<string | null>(null);
  const [selectedLabelLoading, setSelectedLabelLoading] = useState(false);
  const [packagingLabelURL, setPackagingLabelURL] = useState<string | null>(null);
  const [packagingLabelError, setPackagingLabelError] = useState<string | null>(null);
  const [packagingLabelLoading, setPackagingLabelLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const approvedOrders = await api.listIncomingRequests('approved');
      approvedOrders.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
      setOrders(approvedOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packaging queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedOrder) {
      if (selectedLabelURL) {
        URL.revokeObjectURL(selectedLabelURL);
      }
      setSelectedLabelURL(null);
      setSelectedLabelError(null);
      setSelectedLabelLoading(false);
      return;
    }

    let cancelled = false;
    let createdURL: string | null = null;
    setSelectedLabelLoading(true);
    setSelectedLabelError(null);

    api.getShippingLabelPdf(selectedOrder.id)
      .then((blob) => {
        if (cancelled) return;
        createdURL = URL.createObjectURL(blob);
        setSelectedLabelURL((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return createdURL;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setSelectedLabelError(err instanceof Error ? err.message : 'Failed to load shipping label');
        setSelectedLabelURL((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setSelectedLabelLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (createdURL) URL.revokeObjectURL(createdURL);
    };
  }, [selectedOrder]);

  useEffect(() => {
    if (!packagingOrder) {
      if (packagingLabelURL) {
        URL.revokeObjectURL(packagingLabelURL);
      }
      setPackagingLabelURL(null);
      setPackagingLabelError(null);
      setPackagingLabelLoading(false);
      return;
    }

    let cancelled = false;
    let createdURL: string | null = null;
    setPackagingLabelLoading(true);
    setPackagingLabelError(null);

    api.getShippingLabelPdf(packagingOrder.id)
      .then((blob) => {
        if (cancelled) return;
        createdURL = URL.createObjectURL(blob);
        setPackagingLabelURL((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return createdURL;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setPackagingLabelError(err instanceof Error ? err.message : 'Failed to load shipping label');
        setPackagingLabelURL((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setPackagingLabelLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (createdURL) URL.revokeObjectURL(createdURL);
    };
  }, [packagingOrder]);

  const fulfillableCount = orders.filter((order) => order.isFulfillable).length;

  const openPackagingModal = (order: IncomingRequest) => {
    const initialChecks: Record<string, boolean> = {};
    for (const item of order.items) {
      initialChecks[item.materialTypeId] = false;
    }
    setPackChecks(initialChecks);
    setPackagingOrder(order);
  };

  const packedCount = packagingOrder
    ? packagingOrder.items.filter((item) => !!packChecks[item.materialTypeId]).length
    : 0;
  const hasAnyPacked = packedCount > 0;

  return (
    <main className="main-content">
      <aside className="sidebar">
        <div className="stats-card">
          <h3>Packaging Queue</h3>
          <div className="stat-row">
            <span>Approved:</span>
            <span className="stat-value approved">{orders.length}</span>
          </div>
          <div className="stat-row">
            <span>Ready to Pack:</span>
            <span className="stat-value pending">{fulfillableCount}</span>
          </div>
          <div className="stat-row">
            <span>Blocked (Stock):</span>
            <span className="stat-value rejected">{orders.length - fulfillableCount}</span>
          </div>
        </div>
      </aside>

      <section className="content-section">
        <div className="section-header">
          <h2>Packaging Queue</h2>
          <div className="section-controls">
            <span className="results-count">{orders.length} approved requests</span>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="requests-table-container">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-text-secondary">Loading queue...</p>
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Recipient</th>
                  <th>Items</th>
                  <th>Ship By</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const shipBy = getShipByLabel(order.deliveryDate);
                  return (
                    <tr key={order.id}>
                      <td>
                        <span className="request-id">{order.id}</span>
                        <span className="request-date">{formatDate(order.createdAt)}</span>
                      </td>
                      <td>
                        <div className="requester-info">
                          <span className="requester-name">{order.shippingName}</span>
                          <span className="requester-org">{order.city}</span>
                        </div>
                      </td>
                      <td>
                        <div className="items-summary">
                          <span className="item-count material-inline">
                            {order.items[0]?.materialImageUrl ? (
                              <img className="material-thumb" src={order.items[0].materialImageUrl} alt={order.items[0].materialName} />
                            ) : (
                              <span className="material-thumb-placeholder">?</span>
                            )}
                            {order.items.length} item types
                          </span>
                          <span className="requester-org">Total qty: {totalQuantity(order)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`days-until ${shipBy.urgent ? 'urgent' : ''}`}>{shipBy.text}</span>
                      </td>
                      <td>
                        <span className={order.isFulfillable ? 'stock-check stock-check-ok' : 'stock-check stock-check-missing'}>
                          {order.isFulfillable ? '✓ Ready' : '✗ Missing'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-primary" onClick={() => setSelectedOrder(order)}>
                            View
                          </button>
                          <button
                            className="btn-approve"
                            disabled={!order.isFulfillable}
                            onClick={() => openPackagingModal(order)}
                            title={order.isFulfillable ? 'Open packaging checklist' : 'Cannot package: insufficient stock'}
                          >
                            Package
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-text-secondary">
                      No approved requests in queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Packaging Details - {selectedOrder.id}</h3>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Shipping</h4>
                <p><strong>Name:</strong> {selectedOrder.shippingName}</p>
                <p><strong>Address:</strong> {selectedOrder.addressLine1}</p>
                {selectedOrder.addressLine2 && <p><strong>Address 2:</strong> {selectedOrder.addressLine2}</p>}
                <p><strong>City:</strong> {selectedOrder.city}</p>
                <p><strong>Zip:</strong> {selectedOrder.zipCode}</p>
                <p><strong>Delivery Date:</strong> {formatDate(selectedOrder.deliveryDate)}</p>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">Items & Availability</h4>
                <ul className="space-y-1">
                  {selectedOrder.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span className="material-inline">
                        {item.materialImageUrl ? (
                          <img className="material-thumb" src={item.materialImageUrl} alt={item.materialName} />
                        ) : (
                          <span className="material-thumb-placeholder">?</span>
                        )}
                        {item.materialName}
                      </span>
                      <span className={item.isFulfillable ? 'stock-check stock-check-ok' : 'stock-check stock-check-missing'}>
                        {item.isFulfillable ? '✓' : '✗'} Req {item.quantity} / Avail {item.availableQuantity}
                        {!item.isFulfillable && item.shortageQuantity > 0 ? ` (Short ${item.shortageQuantity})` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="font-semibold mb-2">Shipping Label</h4>
                {selectedLabelLoading && <p className="text-text-secondary">Loading label...</p>}
                {selectedLabelError && <p className="text-red-600">{selectedLabelError}</p>}
                {selectedLabelURL && (
                  <div className="shipping-label-preview-wrap">
                    <iframe title={`Shipping label preview ${selectedOrder.id}`} src={selectedLabelURL} className="shipping-label-preview" />
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Notes</h4>
                <p>{selectedOrder.note || 'No note provided.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {packagingOrder && (
        <div className="modal-overlay" onClick={() => setPackagingOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Package Request - {packagingOrder.id}</h3>
              <button className="modal-close" onClick={() => setPackagingOrder(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Packaging Checklist</h4>
                <p>{packedCount}/{packagingOrder.items.length} material types picked</p>
              </div>
              <div className="space-y-2">
                {packagingOrder.items.map((item) => (
                  <label key={item.materialTypeId} className="packaging-check-item">
                    <input
                      type="checkbox"
                      checked={!!packChecks[item.materialTypeId]}
                      onChange={() =>
                        setPackChecks((prev) => ({
                          ...prev,
                          [item.materialTypeId]: !prev[item.materialTypeId],
                        }))
                      }
                    />
                    <div className="packaging-check-image">
                      {item.materialImageUrl ? (
                        <img src={item.materialImageUrl} alt={item.materialName} />
                      ) : (
                        <div className="packaging-image-placeholder">No Image</div>
                      )}
                    </div>
                    <div className="packaging-check-text">
                      <strong>{item.materialName}</strong>
                      <span>Required: {item.quantity}</span>
                      <span className={item.isFulfillable ? 'stock-check stock-check-ok' : 'stock-check stock-check-missing'}>
                        Available: {item.availableQuantity}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Shipping Label</h4>
                {packagingLabelLoading && <p className="text-text-secondary">Loading label...</p>}
                {packagingLabelError && <p className="text-red-600">{packagingLabelError}</p>}
                {packagingLabelURL && (
                  <div className="shipping-label-preview-wrap">
                    <iframe title={`Shipping label preview ${packagingOrder.id}`} src={packagingLabelURL} className="shipping-label-preview" />
                  </div>
                )}
              </div>
              <div className="card-actions mt-4">
                <div className="pack-packed-button-wrap">
                  <button className="btn-primary" disabled={!hasAnyPacked}>
                    Mark Packed
                  </button>
                  {!hasAnyPacked && <span className="pack-packed-tooltip">Select at least one item to continue.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
