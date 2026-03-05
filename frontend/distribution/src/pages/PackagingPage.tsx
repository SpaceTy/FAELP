import { useEffect, useState, useCallback } from 'preact/hooks';
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
  const [packChecks, setPackChecks] = useState<Record<string, { checked: boolean; codes: string[] }>>({});
  const [codeValidationErrors, setCodeValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [validatingCodes, setValidatingCodes] = useState<Record<string, boolean>>({});
  const [outgoingTrackingCode, setOutgoingTrackingCode] = useState('');
  const [isSubmittingPack, setIsSubmittingPack] = useState(false);

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

  const fulfillableCount = orders.filter((order) => order.isFulfillable).length;

  const openPackagingModal = (order: IncomingRequest) => {
    const initialChecks: Record<string, { checked: boolean; codes: string[] }> = {};
    for (const item of order.items) {
      initialChecks[item.materialTypeId] = { checked: false, codes: [] };
    }
    setPackChecks(initialChecks);
    setCodeValidationErrors({});
    setValidatingCodes({});
    setOutgoingTrackingCode('');
    setPackagingOrder(order);
  };

  // Validate a single code against the backend
  const validateCode = useCallback(async (materialTypeId: string, code: string) => {
    if (!code || code.length !== 5) return;

    setValidatingCodes(prev => ({ ...prev, [`${materialTypeId}-${code}`]: true }));

    try {
      const result = await api.validateMaterialCode(code, materialTypeId);

      setCodeValidationErrors(prev => ({
        ...prev,
        [materialTypeId]: {
          ...prev[materialTypeId],
          [code]: result.valid ? '' : (result.error || 'Invalid code'),
        },
      }));
    } catch {
      // Silently fail validation - we'll show errors on submit
    } finally {
      setValidatingCodes(prev => ({ ...prev, [`${materialTypeId}-${code}`]: false }));
    }
  }, []);

  // Validate all codes for a material type
  const validateAllCodesForItem = useCallback(async (materialTypeId: string, codes: string[]) => {
    const validCodes = codes.filter(c => c && c.length === 5);
    if (validCodes.length === 0) return;

    for (const code of validCodes) {
      await validateCode(materialTypeId, code);
    }
  }, [validateCode]);

  const packedCount = packagingOrder
    ? packagingOrder.items.filter((item) => !!packChecks[item.materialTypeId]?.checked).length
    : 0;

  const getCodesEnteredCount = (materialTypeId: string, _requiredQty: number): number => {
    const check = packChecks[materialTypeId];
    if (!check || !check.codes) return 0;
    return check.codes.filter(c => c.trim()).length;
  };

  const hasValidCodes = (materialTypeId: string, requiredQty: number): boolean => {
    return getCodesEnteredCount(materialTypeId, requiredQty) >= requiredQty;
  };

  const hasAnyPacked = packedCount > 0;
  const hasTrackingCode = outgoingTrackingCode.trim().length > 0;
  const allCheckedHaveCodes = packagingOrder
    ? packagingOrder.items.every((item) => {
        if (!packChecks[item.materialTypeId]?.checked) return true;
        return hasValidCodes(item.materialTypeId, item.quantity);
      })
    : true;

  // Check if any checked items have validation errors
  const hasValidationErrors = packagingOrder
    ? packagingOrder.items.some((item) => {
        if (!packChecks[item.materialTypeId]?.checked) return false;
        const errors = codeValidationErrors[item.materialTypeId] || {};
        return Object.values(errors).some(error => error !== '');
      })
    : false;

  const canMarkPacked = hasAnyPacked && hasTrackingCode && allCheckedHaveCodes && !hasValidationErrors && !isSubmittingPack;
  const markPackedDisabledReason = !hasAnyPacked
    ? 'Check at least one material type to continue.'
    : !hasTrackingCode
      ? 'Enter DHL tracking code to continue.'
      : !allCheckedHaveCodes
        ? 'Enter material codes for all checked items.'
        : hasValidationErrors
          ? 'Fix invalid material codes to continue.'
          : '';

  const handleMarkPacked = async () => {
    if (!packagingOrder || !canMarkPacked) {
      return;
    }

    setIsSubmittingPack(true);
    setError(null);
    try {
      const itemsWithCodes = packagingOrder.items
        .filter((item) => packChecks[item.materialTypeId]?.checked)
        .map((item) => ({
          materialTypeId: item.materialTypeId,
          codes: packChecks[item.materialTypeId]?.codes.filter(c => c.trim()) || [],
        }));

      await api.markIncomingRequestInAction(packagingOrder.id, outgoingTrackingCode.trim(), itemsWithCodes);
      setPackagingOrder(null);
      setOutgoingTrackingCode('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete packaging');
    } finally {
      setIsSubmittingPack(false);
    }
  };

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
                <p><strong>Intended Students:</strong> {selectedOrder.intendedStudents}</p>
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
                {packagingOrder.items.map((item) => {
                  const check = packChecks[item.materialTypeId];
                  const codesEntered = getCodesEnteredCount(item.materialTypeId, item.quantity);
                  const hasEnoughCodes = hasValidCodes(item.materialTypeId, item.quantity);
                  const canCheck = check && check.codes.length > 0;

                  return (
                    <div key={item.materialTypeId} className="packaging-check-item">
                      <input
                        type="checkbox"
                        checked={!!check?.checked}
                        disabled={!canCheck}
                        onChange={() =>
                          setPackChecks((prev) => ({
                            ...prev,
                            [item.materialTypeId]: {
                              ...prev[item.materialTypeId],
                              checked: !prev[item.materialTypeId].checked,
                            },
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
                      <div className="material-codes-input">
                        <label className="block text-xs font-semibold mb-1">
                          Material Codes ({codesEntered}/{item.quantity})
                        </label>
                        <input
                          type="text"
                          value={check?.codes.join(', ') || ''}
                          onInput={(e) => {
                            const value = (e.target as HTMLInputElement).value;
                            const codes = value.split(',').map(c => c.trim().toUpperCase()).filter(c => c);
                            setPackChecks((prev) => ({
                              ...prev,
                              [item.materialTypeId]: {
                                ...prev[item.materialTypeId],
                                codes,
                              },
                            }));
                            // Trigger validation after a short delay
                            setTimeout(() => {
                              validateAllCodesForItem(item.materialTypeId, codes);
                            }, 500);
                          }}
                          onBlur={() => {
                            if (check?.codes.length) {
                              validateAllCodesForItem(item.materialTypeId, check.codes);
                            }
                          }}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded-md"
                          placeholder={item.quantity === 1 ? 'Enter material code' : 'Enter codes, comma separated'}
                        />
                        {!hasEnoughCodes && check && check.codes.length > 0 && (
                          <span className="text-xs text-red-500">Need {item.quantity - codesEntered} more code(s)</span>
                        )}
                        {/* Show validation errors for each code */}
                        {check?.codes.map((code, idx) => {
                          const error = codeValidationErrors[item.materialTypeId]?.[code];
                          const isValidating = validatingCodes[`${item.materialTypeId}-${code}`];
                          if (!error && !isValidating) return null;
                          return (
                            <div key={idx} className="text-xs mt-1">
                              {isValidating ? (
                                <span className="text-text-secondary">Validating {code}...</span>
                              ) : error ? (
                                <span className="text-red-500">{code}: {error}</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold mb-2" htmlFor="outgoing-tracking-code">
                  DHL Tracking Code
                </label>
                <input
                  id="outgoing-tracking-code"
                  type="text"
                  value={outgoingTrackingCode}
                  onInput={(e) => setOutgoingTrackingCode((e.target as HTMLInputElement).value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  placeholder="Enter DHL tracking code"
                />
                <p className="text-text-secondary mt-1 text-sm">Required to finish packaging and mark request inAction.</p>
              </div>
              <div className="card-actions mt-4">
                <span className="button-tooltip-wrap" title={markPackedDisabledReason}>
                  <button
                    className="btn-primary"
                    disabled={!canMarkPacked}
                    onClick={handleMarkPacked}
                    title={markPackedDisabledReason}
                  >
                    {isSubmittingPack ? 'Saving...' : 'Mark Packed'}
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
