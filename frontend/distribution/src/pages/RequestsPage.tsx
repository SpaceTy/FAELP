import { useEffect, useState } from 'preact/hooks';
import { api, type IncomingRequest } from '@/services/api';
import type {
  BorrowRequest,
  RequestStats,
  RequestStatus,
} from '@/types/requests';

const STATUS_OPTIONS: Array<RequestStatus | ''> = ['', 'pending', 'approved', 'inAction', 'returned'];

function statusClass(status: RequestStatus): string {
  switch (status) {
    case 'approved':
      return 'status-badge status-approved';
    case 'inAction':
      return 'status-badge status-in-progress';
    case 'returned':
      return 'status-badge status-returned';
    case 'pending':
      return 'status-badge status-pending';
    default:
      return 'status-badge';
  }
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'inAction':
      return 'In Action';
    case 'returned':
      return 'Returned';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
}

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function getDaysUntil(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays} days`;
}

function mapIncomingRequest(input: IncomingRequest): BorrowRequest {
  return {
    id: input.id,
    requesterName: input.shippingName,
    requesterOrg: `Customer ${input.customerId.slice(0, 8)}`,
    requesterEmail: '-',
    requesterPhone: '-',
    items: input.items.map((item) => ({
      materialTypeId: item.materialTypeId,
      materialName: item.materialName,
      materialImageUrl: item.materialImageUrl,
      quantity: item.quantity,
      availableQuantity: item.availableQuantity,
      shortageQuantity: item.shortageQuantity,
      isFulfillable: item.isFulfillable,
    })),
    purpose: input.note || 'No note provided',
    requestedFor: input.deliveryDate,
    priority: 'normal',
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    isFulfillable: input.isFulfillable,
  };
}

export function RequestsPage() {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [stats, setStats] = useState<RequestStats>({ pending: 0, approved: 0, inAction: 0, returned: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  const [approvingRequestID, setApprovingRequestID] = useState<string | null>(null);
  const [cancellingRequestID, setCancellingRequestID] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('pending');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pendingRaw, approvedRaw, inActionRaw, returnedRaw] = await Promise.all([
        api.listIncomingRequests('pending'),
        api.listIncomingRequests('approved'),
        api.listIncomingRequests('inAction'),
        api.listIncomingRequests('returned'),
      ]);

      const pending = pendingRaw.map(mapIncomingRequest);
      const approved = approvedRaw.map(mapIncomingRequest);
      const inAction = inActionRaw.map(mapIncomingRequest);
      const returned = returnedRaw.map(mapIncomingRequest);
      const all = [...pending, ...approved, ...inAction, ...returned];

      setStats({
        pending: pending.length,
        approved: approved.length,
        inAction: inAction.length,
        returned: returned.length,
        total: all.length,
      });

      const filtered = all
        .filter((request) => !statusFilter || request.status === statusFilter)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRequests(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleApprove = async (requestID: string) => {
    setApprovingRequestID(requestID);
    setError(null);
    try {
      await api.approveIncomingRequest(requestID);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setApprovingRequestID(null);
    }
  };

  const handleCancel = async (requestID: string) => {
    setCancellingRequestID(requestID);
    setError(null);
    try {
      await api.cancelIncomingRequest(requestID);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request');
    } finally {
      setCancellingRequestID(null);
    }
  };

  return (
    <main className="main-content">
      <aside className="sidebar">
        <div className="filter-section">
          <h3>Request Status</h3>
          <div className="filter-group">
            {STATUS_OPTIONS.map((s) => (
              <label key={s || 'all'} className="checkbox-label">
                <input
                  type="radio"
                  name="status"
                  checked={statusFilter === s}
                  onChange={() => setStatusFilter(s)}
                />
                <span>{s ? statusLabel(s) : 'All'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <h3>Request Stats</h3>
          <div className="stat-row">
            <span>Pending:</span>
            <span className="stat-value pending">{stats.pending}</span>
          </div>
          <div className="stat-row">
            <span>Approved:</span>
            <span className="stat-value approved">{stats.approved}</span>
          </div>
          <div className="stat-row">
            <span>Returned:</span>
            <span className="stat-value rejected">{stats.returned}</span>
          </div>
          <div className="stat-row">
            <span>In Action:</span>
            <span className="stat-value pending">{stats.inAction}</span>
          </div>
          <div className="stat-row">
            <span>Total:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
      </aside>

      <section className="content-section">
        <div className="section-header">
          <h2>Incoming Requests</h2>
          <div className="section-controls">
            <span className="results-count">{requests.length} requests</span>
            <select className="sort-select">
              <option>Sort by: Newest First</option>
            </select>
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
                <p className="mt-2 text-text-secondary">Loading requests...</p>
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>Requester</th>
                  <th>Items</th>
                  <th>Purpose</th>
                  <th>Requested For</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="col-id">
                      <button
                        onClick={() => copyToClipboard(request.id)}
                        className="copy-id-btn"
                        title={`Copy ID: ${request.id}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </td>
                    <td>
                      <div className="requester-info">
                        <span className="requester-name">{request.requesterName}</span>
                        <span className="requester-org">{request.requesterOrg}</span>
                      </div>
                    </td>
                    <td>
                      <div className="items-summary">
                        <span className="item-count">
                          {request.items[0]?.materialImageUrl ? (
                            <img className="material-thumb" src={request.items[0].materialImageUrl} alt={request.items[0].materialName} />
                          ) : (
                            <span className="material-thumb-placeholder">?</span>
                          )}
                          {request.items[0]?.quantity}x {request.items[0]?.materialName}
                        </span>
                        <span className={request.isFulfillable ? 'stock-check stock-check-ok' : 'stock-check stock-check-missing'}>
                          {request.isFulfillable ? '✓ In Stock' : '✗ Missing Stock'}
                        </span>
                        {request.items.length > 1 && (
                          <button
                            className="btn-view-items"
                            onClick={() => setSelectedRequest(request)}
                          >
                            +{request.items.length - 1} more
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="purpose-tag">{request.purpose}</span>
                    </td>
                    <td>
                      <span className="date-needed">{formatDate(request.requestedFor)}</span>
                      <span className={`days-until ${new Date(request.requestedFor) < new Date() ? 'urgent' : ''}`}>
                        {getDaysUntil(request.requestedFor)}
                      </span>
                    </td>
                    <td>
                      {request.status === 'pending' ? (
                        <div className="action-buttons">
                          <button
                            className="btn-approve"
                            onClick={() => handleApprove(request.id)}
                            disabled={approvingRequestID === request.id || !request.isFulfillable}
                            title={request.isFulfillable ? 'Approve request' : 'Cannot approve: insufficient stock'}
                          >
                            {approvingRequestID === request.id ? 'Approving...' : 'Approve'}
                          </button>
                        </div>
                      ) : request.status === 'approved' || request.status === 'inAction' ? (
                        <div className="action-buttons">
                          <span className={statusClass(request.status)}>{statusLabel(request.status)}</span>
                          <button
                            className="btn-reject"
                            onClick={() => handleCancel(request.id)}
                            disabled={cancellingRequestID === request.id}
                          >
                            {cancellingRequestID === request.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <span className={statusClass(request.status)}>{statusLabel(request.status)}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-text-secondary">
                      No requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Request Details - {selectedRequest.id}</h3>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Requester Information</h4>
                <p><strong>Name:</strong> {selectedRequest.requesterName}</p>
                <p><strong>Organization:</strong> {selectedRequest.requesterOrg}</p>
              </div>
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Requested Items</h4>
                <ul className="space-y-1">
                  {selectedRequest.items.map((item, idx) => (
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
                        {item.isFulfillable ? '✓' : '✗'} Req {item.quantity} / Avail {item.availableQuantity ?? 0}
                        {!item.isFulfillable && item.shortageQuantity ? ` (Short ${item.shortageQuantity})` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Details</h4>
                <p><strong>Purpose:</strong> {selectedRequest.purpose}</p>
                <p><strong>Requested For:</strong> {formatDate(selectedRequest.requestedFor)}</p>
                <p><strong>Status:</strong> {statusLabel(selectedRequest.status)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
