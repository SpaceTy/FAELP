import { useEffect, useState, useMemo } from 'preact/hooks';
import { api, type IncomingRequest } from '@/services/api';
import type {
  ReturnRecord,
  ReturnStats,
  ReturnStatus,
  ItemCondition,
  ItemDestination,
} from '@/types/returns';

const STATUS_OPTIONS: Array<ReturnStatus | ''> = ['', 'inAction', 'returned', 'unpacked'];
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
  const now = new Date('2026-01-19');
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

export function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [stats, setStats] = useState<ReturnStats>({ inAction: 0, returned: 0, unpacked: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');

  // Inspection state
  const [inspectionState, setInspectionState] = useState<Record<number, { condition: ItemCondition; destination: ItemDestination; returnToInventory: boolean }>>({});

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
    if (selectedReturn) {
      const initialState: Record<number, { condition: ItemCondition; destination: ItemDestination; returnToInventory: boolean }> = {};
      selectedReturn.items.forEach((item, idx) => {
        initialState[idx] = {
          condition: item.condition,
          destination: item.destination,
          returnToInventory: item.returnToInventory,
        };
      });
      setInspectionState(initialState);
    }
  }, [selectedReturn]);

  const handleInspectItem = async (_returnId: string, _itemIndex: number) => {
    setError('Inspection functionality requires backend implementation');
  };

  const handleCompleteReturn = async (_returnId: string) => {
    setError('Complete return functionality requires backend implementation');
  };

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
          <div className="stat-row">
            <span>Unpacked:</span>
            <span className="stat-value unpacked">{stats.unpacked}</span>
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
                            (new Date('2026-01-19').getTime() - new Date(returnRecord.dueDate).getTime()) /
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
                      <p className="borrower-contact">{returnRecord.borrowerEmail}</p>
                      <p className="borrower-phone">{returnRecord.borrowerPhone}</p>
                    </div>

                    <div className="items-borrowed">
                      <h4>Items to Return ({returnRecord.items.length})</h4>
                      {returnRecord.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="borrowed-item">
                          <span className="item-qty">{item.quantity}x</span>
                          <span className="item-name">{item.materialName}</span>
                        </div>
                      ))}
                      {returnRecord.items.length > 3 && (
                        <p className="text-sm text-text-secondary">
                          +{returnRecord.items.length - 3} more items
                        </p>
                      )}
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
                    {(returnRecord.status === 'received' || returnRecord.status === 'inspection') && (
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
                  <p>{selectedReturn.borrowerEmail}</p>
                  <p>{selectedReturn.borrowerPhone}</p>
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
                      returnToInventory: item.returnToInventory,
                    };
                    const isInspected = item.isInspected;

                    return (
                      <div
                        key={idx}
                        className={`inspection-item ${isInspected ? 'inspected' : ''} ${state.condition}`}
                      >
                        <div className="item-select">
                          <input
                            type="checkbox"
                            id={`inspect-${selectedReturn.id}-${idx}`}
                            checked={state.returnToInventory}
                            onChange={(e) =>
                              setInspectionState({
                                ...inspectionState,
                                [idx]: { ...state, returnToInventory: (e.target as HTMLInputElement).checked },
                              })
                            }
                          />
                          <label htmlFor={`inspect-${selectedReturn.id}-${idx}`}>Return to Inventory</label>
                        </div>
                        <div className="item-details">
                          <h5>{item.materialName}</h5>
                          {item.unitId && <p className="text-sm text-text-secondary">Unit: {item.unitId}</p>}
                          <p className="text-sm text-text-secondary">Sent: {formatDate(selectedReturn.sentDate)}</p>
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
                            onChange={(e) =>
                              setInspectionState({
                                ...inspectionState,
                                [idx]: { ...state, condition: (e.target as HTMLSelectElement).value as ItemCondition },
                              })
                            }
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
                            onChange={(e) =>
                              setInspectionState({
                                ...inspectionState,
                                [idx]: { ...state, destination: (e.target as HTMLSelectElement).value as ItemDestination },
                              })
                            }
                          >
                            {DESTINATION_OPTIONS.map((d) => (
                              <option key={d} value={d}>
                                {d === 'inventory' ? (item.location || 'Inventory') : d.charAt(0).toUpperCase() + d.slice(1)}
                              </option>
                            ))}
                          </select>
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
                              Mark Inspected
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
