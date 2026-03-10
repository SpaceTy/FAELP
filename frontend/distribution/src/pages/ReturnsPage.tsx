import { useEffect, useState, useMemo, useCallback } from 'preact/hooks';
import { api, type IncomingRequest } from '@/services/api';
import type {
  ReturnRecord,
  ReturnStats,
  ReturnStatus,
  ItemCondition,
  ItemDestination,
} from '@/types/returns';

const STATUS_OPTIONS: Array<ReturnStatus | ''> = ['', 'inAction', 'returned'];
const CONDITION_OPTIONS: ItemCondition[] = ['excellent', 'good', 'fair', 'damaged', 'missing'];
const DESTINATION_OPTIONS: ItemDestination[] = ['inventory', 'cleaning', 'repair', 'writeoff'];

function mapIncomingRequestToReturnRecord(req: IncomingRequest): ReturnRecord {
  return {
    id: req.id,
    requestId: req.id,
    borrowerName: req.shippingName,
    borrowerOrg: `Customer ${req.customerId.slice(0, 8)}`,
    borrowerEmail: '-',
    borrowerPhone: '-',
    items: req.items.map((item) => ({
      materialTypeId: item.materialTypeId,
      materialName: item.materialName,
      materialImageUrl: item.materialImageUrl,
      quantity: item.quantity,
      condition: 'good' as ItemCondition,
      destination: 'inventory' as ItemDestination,
      isInspected: false,
      returnToInventory: true,
    })),
    status: req.status as ReturnStatus,
    sentDate: req.createdAt,
    dueDate: req.plannedReturnDate || req.deliveryDate,
    receivedDate: req.status === 'returned' ? req.updatedAt : undefined,
    purpose: req.note || '-',
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  };
}

function statusClass(status: ReturnStatus): string {
  switch (status) {
    case 'inAction':
      return 'status-badge status-in-progress';
    case 'returned':
      return 'status-badge status-returned';
    case 'unpacked':
      return 'status-badge status-unpacked';
    case 'awaiting':
      return 'status-badge status-awaiting';
    case 'received':
      return 'status-badge status-received';
    case 'inspection':
      return 'status-badge status-inspection';
    case 'completed':
      return 'status-badge status-completed';
    default:
      return 'status-badge';
  }
}

function statusLabel(status: ReturnStatus): string {
  switch (status) {
    case 'inAction':
      return 'In Action';
    case 'returned':
      return 'Returned';
    case 'unpacked':
      return 'Unpacked';
    case 'awaiting':
      return 'Awaiting Return';
    case 'received':
      return 'Received';
    case 'inspection':
      return 'Inspection Pending';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}


function conditionLabel(condition: ItemCondition): string {
  switch (condition) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair - Needs Cleaning';
    case 'damaged':
      return 'Damaged - Needs Repair';
    case 'missing':
      return 'Missing';
    default:
      return condition;
  }
}

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDueInfo(dueDate: string, status: ReturnStatus): { label: string; date: string; overdue: boolean } {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  if (status === 'completed') {
    return { label: 'Was due:', date: formatDate(dueDate), overdue: false };
  }

  if (diffDays > 0) {
    return { label: 'Was due:', date: formatDate(dueDate), overdue: true };
  }
  if (diffDays === 0) {
    return { label: 'Due:', date: 'Today', overdue: true };
  }
  return { label: 'Due:', date: formatDate(dueDate), overdue: false };
}

function ItemCarousel({ items }: { items: ReturnRecord['items'] }) {
  const [idx, setIdx] = useState(0);
  const prev = useCallback(() => setIdx((i) => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % items.length) , [items.length]);
  if (items.length === 0) return null;
  const item = items[idx];
  return (
    <div className="item-carousel">
      <div className="item-carousel-slide">
        {item.materialImageUrl ? (
          <img className="material-thumb" src={item.materialImageUrl} alt={item.materialName} />
        ) : (
          <span className="material-thumb-placeholder">?</span>
        )}
        <div className="item-carousel-info">
          <span className="item-name">{item.materialName}</span>
          <span className="item-qty">{item.quantity}x</span>
        </div>
      </div>
      {items.length > 1 && (
        <div className="item-carousel-nav">
          <button className="item-carousel-btn" onClick={prev}>‹</button>
          <span className="item-carousel-counter">{idx + 1}/{items.length}</span>
          <button className="item-carousel-btn" onClick={next}>›</button>
        </div>
      )}
    </div>
  );
}

export function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [stats, setStats] = useState<ReturnStats>({ inAction: 0, returned: 0, unpacked: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');

  // Inspection state
  const [inspectionState, setInspectionState] = useState<Record<number, { condition: ItemCondition; destination: ItemDestination; humanCode: string; location: string; error: string | null }>>({});

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [inActionRaw, returnedRaw] = await Promise.all([
        api.listIncomingRequests('inAction', false),
        api.listIncomingRequests('returned', false),
      ]);

      const inActionRecords = inActionRaw.map(mapIncomingRequestToReturnRecord);
      const returnedRecords = returnedRaw.map(mapIncomingRequestToReturnRecord);
      const allRecords = [...inActionRecords, ...returnedRecords];

      const filtered = allRecords.filter((r) => !statusFilter || r.status === statusFilter);

      setReturns(filtered);

      setStats({
        inAction: inActionRecords.length,
        returned: returnedRecords.length,
        unpacked: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedReturn) return;

    const initialState: Record<number, { condition: ItemCondition; destination: ItemDestination; humanCode: string; location: string; error: string | null }> = {};
    selectedReturn.items.forEach((item, idx) => {
      initialState[idx] = {
        condition: item.condition,
        destination: item.destination,
        humanCode: '',
        location: item.location || '',
        error: null,
      };
    });
    setInspectionState(initialState);

    // Pre-fill human codes from assigned instances
    api.getRequestInstances(selectedReturn.id).then((instances) => {
      if (instances.length === 0) return;
      // Build a map: typeId -> [humanCode, ...] (in order)
      const byType = new Map<string, string[]>();
      for (const inst of instances) {
        if (!byType.has(inst.typeId)) byType.set(inst.typeId, []);
        byType.get(inst.typeId)!.push(inst.humanCode);
      }
      // Track how many codes per type we've assigned
      const usedCount = new Map<string, number>();
      setInspectionState((prev) => {
        const next = { ...prev };
        selectedReturn.items.forEach((item, idx) => {
          if (next[idx]?.humanCode) return; // already has a code
          const codes = byType.get(item.materialTypeId);
          if (!codes) return;
          const used = usedCount.get(item.materialTypeId) ?? 0;
          if (used < codes.length) {
            next[idx] = { ...next[idx], humanCode: codes[used] };
            usedCount.set(item.materialTypeId, used + 1);
          }
        });
        return next;
      });
    }).catch(() => { /* silently ignore — codes can be entered manually */ });
  }, [selectedReturn]);

  const handleInspectItem = async (returnId: string, itemIndex: number) => {
    const state = inspectionState[itemIndex];
    if (!state) return;
    if (!state.humanCode.trim()) {
      setInspectionState((prev) => ({
        ...prev,
        [itemIndex]: { ...prev[itemIndex], error: 'Enter the item code before marking as inspected' },
      }));
      return;
    }
    setInspectionState((prev) => ({ ...prev, [itemIndex]: { ...prev[itemIndex], error: null } }));
    try {
      await api.inspectReturnItem(returnId, {
        itemIndex,
        humanCode: state.humanCode.trim(),
        condition: state.condition,
        destination: state.destination,
        returnToInventory: state.destination === 'inventory',
        location: state.location,
      });
      setSelectedReturn((prev) => {
        if (!prev) return prev;
        const items = [...prev.items];
        items[itemIndex] = { ...items[itemIndex], isInspected: true };
        return { ...prev, items };
      });
    } catch (err) {
      setInspectionState((prev) => ({
        ...prev,
        [itemIndex]: { ...prev[itemIndex], error: err instanceof Error ? err.message : 'Failed to mark item as inspected' },
      }));
    }
  };

  const handleCompleteReturn = async (returnId: string) => {
    setError(null);
    try {
      await api.archiveIncomingRequest(returnId);
      setSelectedReturn(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete return');
    }
  };

  function destinationForCondition(condition: ItemCondition): ItemDestination {
    switch (condition) {
      case 'fair': return 'cleaning';
      case 'damaged': return 'repair';
      case 'missing': return 'writeoff';
      default: return 'inventory';
    }
  }

  const inspectedCount = useMemo(() => {
    if (!selectedReturn) return 0;
    return selectedReturn.items.filter((i) => i.isInspected).length;
  }, [selectedReturn]);

  const progressPercent = useMemo(() => {
    if (!selectedReturn || selectedReturn.items.length === 0) return 0;
    return Math.round((inspectedCount / selectedReturn.items.length) * 100);
  }, [inspectedCount, selectedReturn]);

  return (
    <main className="main-content">
      {/* Sidebar Filters */}
      <aside className="sidebar">
        <div className="filter-section">
          <h3>Return Status</h3>
          <div className="filter-group">
            {STATUS_OPTIONS.map((s) => (
              <label key={s || 'all'} className="checkbox-label">
                <input
                  type="radio"
                  name="status"
                  checked={statusFilter === s}
                  onChange={() => setStatusFilter(s)}
                />
                <span>{s ? statusLabel(s as ReturnStatus) : 'All'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <h3>Returns Overview</h3>
          <div className="stat-row">
            <span>In Action:</span>
            <span className="stat-value in-progress">{stats.inAction}</span>
          </div>
          <div className="stat-row">
            <span>Returned:</span>
            <span className="stat-value returned">{stats.returned}</span>
          </div>
        </div>
      </aside>

      {/* Returns Section */}
      <section className="content-section">
        <div className="section-header">
          <h2>Returns Processing</h2>
          <div className="section-controls">
            <span className="results-count">{returns.length} returns to process</span>
            <select className="sort-select">
              <option>Sort by: Due Date (Urgent First)</option>
              <option>Return Date</option>
              <option>Borrower</option>
              <option>Status</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="returns-list">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                <p className="mt-2 text-text-secondary">Loading returns...</p>
              </div>
            </div>
          ) : (
            returns.map((returnRecord) => {
              const dueInfo = getDueInfo(returnRecord.dueDate, returnRecord.status);
              const isOverdue = dueInfo.overdue && returnRecord.status !== 'completed';
              const cardClass = isOverdue
                ? 'return-card overdue'
                : returnRecord.status === 'inspection'
                ? 'return-card inspection'
                : returnRecord.status === 'received'
                ? 'return-card due-today'
                : 'return-card';

              return (
                <div key={returnRecord.id} className={cardClass}>
                  <div className="return-header">
                    <div className="return-info">
                      <span className="return-id">{returnRecord.id}</span>
                      <span className={statusClass(returnRecord.status)}>
                        {statusLabel(returnRecord.status)}
                      </span>
                    </div>
                    <div className={`due-info ${isOverdue ? 'overdue' : ''}`}>
                      <span className="due-label">{dueInfo.label}</span>
                      <span className="due-date">{dueInfo.date}</span>
                      {isOverdue && (
                        <span className="days-overdue">
                          {Math.floor(
                            (new Date().getTime() - new Date(returnRecord.dueDate).getTime()) /
                              (1000 * 60 * 60 * 24)
                          )}{' '}
                          days overdue
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="return-details">
                    <div className="borrower-info">
                      <h4>Borrower</h4>
                      <p className="borrower-name">{returnRecord.borrowerName}</p>
                      <p className="borrower-org">{returnRecord.borrowerOrg}</p>
                    </div>

                    <div className="items-borrowed">
                      <h4>Items to Return ({returnRecord.items.length})</h4>
                      <ItemCarousel items={returnRecord.items} />
                    </div>

                    <div className="loan-info">
                      <h4>Loan Details</h4>
                      <p>
                        <strong>Sent:</strong> {formatDate(returnRecord.sentDate)}
                      </p>
                      <p>
                        <strong>Duration:</strong>{' '}
                        {Math.ceil(
                          (new Date(returnRecord.dueDate).getTime() - new Date(returnRecord.sentDate).getTime()) /
                            (1000 * 60 * 60 * 24 * 7)
                        )}{' '}
                        weeks
                      </p>
                      <p>
                        <strong>Purpose:</strong> {returnRecord.purpose}
                      </p>
                      {returnRecord.receivedDate && (
                        <p>
                          <strong>Received:</strong> {formatDate(returnRecord.receivedDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="return-actions">
                    {returnRecord.status === 'awaiting' && (
                      <>
                        <button className="btn-primary">Send Reminder</button>
                        <button className="btn-secondary">Contact Borrower</button>
                      </>
                    )}
                    {(returnRecord.status === 'returned' || returnRecord.status === 'received' || returnRecord.status === 'inspection') && (
                      <button className="btn-primary" onClick={() => setSelectedReturn(returnRecord)}>
                        Inspect Items
                      </button>
                    )}
                    <button className="btn-details" onClick={() => setSelectedReturn(returnRecord)}>
                      View Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {returns.length === 0 && !isLoading && (
            <div className="text-center py-8 text-text-secondary">No returns found.</div>
          )}
        </div>
      </section>

      {/* Return Inspection Modal */}
      {selectedReturn && (
        <div className="modal-overlay" onClick={() => setSelectedReturn(null)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Process Return {selectedReturn.id}</h3>
                <span className={statusClass(selectedReturn.status)}>
                  {statusLabel(selectedReturn.status)}
                </span>
              </div>
              <button className="modal-close" onClick={() => setSelectedReturn(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="font-semibold mb-2">Borrower</h4>
                  <p>
                    <strong>{selectedReturn.borrowerName}</strong>
                  </p>
                  <p>{selectedReturn.borrowerOrg}</p>
                  {selectedReturn.borrowerEmail && selectedReturn.borrowerEmail !== '-' && (
                    <p>{selectedReturn.borrowerEmail}</p>
                  )}
                  {selectedReturn.borrowerPhone && selectedReturn.borrowerPhone !== '-' && (
                    <p>{selectedReturn.borrowerPhone}</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Loan Information</h4>
                  <p>
                    <strong>Sent:</strong> {formatDate(selectedReturn.sentDate)}
                  </p>
                  <p>
                    <strong>Due:</strong> {formatDate(selectedReturn.dueDate)}
                  </p>
                  {selectedReturn.receivedDate && (
                    <p>
                      <strong>Received:</strong> {formatDate(selectedReturn.receivedDate)}
                    </p>
                  )}
                  <p>
                    <strong>Purpose:</strong> {selectedReturn.purpose}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold">Returned Items Inspection</h4>
                  <span className="text-sm text-text-secondary">
                    {inspectedCount} of {selectedReturn.items.length} items inspected
                  </span>
                </div>
                <div className="progress-bar mb-4">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                  <span className="progress-text">{progressPercent}% Complete</span>
                </div>

                <div className="inspection-checklist">
                  {selectedReturn.items.map((item, idx) => {
                    const state = inspectionState[idx] || {
                      condition: item.condition,
                      destination: item.destination,
                      humanCode: '',
                      location: item.location || '',
                      error: null,
                    };
                    const isInspected = item.isInspected;

                    return (
                      <div
                        key={idx}
                        className={`inspection-item ${isInspected ? 'inspected' : ''} ${state.condition}`}
                      >
                        {item.materialImageUrl ? (
                          <img
                            className="material-thumb"
                            src={item.materialImageUrl}
                            alt={item.materialName}
                            style={{ width: '2.5rem', height: '2.5rem', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                          />
                        ) : (
                          <span
                            className="material-thumb-placeholder"
                            style={{ width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '4px', background: 'var(--color-background, #f0f2f5)', fontSize: '1.2rem' }}
                          >
                            ?
                          </span>
                        )}
                        <div className="item-details">
                          <h5>{item.materialName}</h5>
                          {isInspected ? (
                            <p className="text-sm font-mono font-semibold">{state.humanCode}</p>
                          ) : (
                            <>
                              <input
                                type="text"
                                className={`code-input${state.error ? ' input-error' : ''}`}
                                placeholder="Scan or enter item code"
                                value={state.humanCode}
                                style={{ fontFamily: 'monospace', textTransform: 'uppercase', width: '100%', marginTop: '0.25rem' }}
                                onChange={(e) =>
                                  setInspectionState((prev) => ({
                                    ...prev,
                                    [idx]: { ...state, humanCode: (e.target as HTMLInputElement).value.toUpperCase(), error: null },
                                  }))
                                }
                              />
                              {state.error && (
                                <p className="text-xs" style={{ color: '#e53e3e', marginTop: '0.2rem' }}>{state.error}</p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="item-quantity">
                          <span className="qty-label">Qty</span>
                          <span className="qty-value">{item.quantity}</span>
                        </div>
                        <div className="item-condition">
                          <span className="condition-label">Condition</span>
                          <select
                            className={`condition-select ${state.condition}`}
                            value={state.condition}
                            disabled={isInspected}
                            onChange={(e) => {
                              const newCondition = (e.target as HTMLSelectElement).value as ItemCondition;
                              setInspectionState((prev) => ({
                                ...prev,
                                [idx]: { ...state, condition: newCondition, destination: destinationForCondition(newCondition) },
                              }));
                            }}
                          >
                            {CONDITION_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c.charAt(0).toUpperCase() + c.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="item-destination">
                          <span className="dest-label">Destination</span>
                          <select
                            className="destination-select"
                            value={state.destination}
                            disabled={isInspected}
                            onChange={(e) =>
                              setInspectionState((prev) => ({
                                ...prev,
                                [idx]: { ...state, destination: (e.target as HTMLSelectElement).value as ItemDestination },
                              }))
                            }
                          >
                            {DESTINATION_OPTIONS.map((d) => (
                              <option key={d} value={d}>
                                {d.charAt(0).toUpperCase() + d.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="item-location">
                          <span className="dest-label">Location</span>
                          {isInspected ? (
                            <span className="text-sm">{state.location || '—'}</span>
                          ) : (
                            <input
                              type="text"
                              className="location-input"
                              placeholder="Storage location"
                              value={state.location}
                              onChange={(e) =>
                                setInspectionState((prev) => ({
                                  ...prev,
                                  [idx]: { ...state, location: (e.target as HTMLInputElement).value },
                                }))
                              }
                            />
                          )}
                        </div>
                        <div className="item-status-badge">
                          {isInspected ? (
                            <span className={`inspected-badge ${state.condition}`}>
                              {conditionLabel(state.condition)}
                            </span>
                          ) : (
                            <button
                              className="btn-mark-inspected"
                              onClick={() => handleInspectItem(selectedReturn.id, idx)}
                            >
                              Inspect
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedReturn.status !== 'completed' && progressPercent === 100 && (
                <div className="flex justify-end">
                  <button className="btn-success" onClick={() => handleCompleteReturn(selectedReturn.id)}>
                    Complete Return
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
