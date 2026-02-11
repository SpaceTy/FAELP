import { useEffect, useState, useMemo } from 'preact/hooks';
import { mockRequestsService } from '@/services/mockRequests';
import type {
  BorrowRequest,
  RequestStats,
  RequestStatus,
  RequestPriority,
  ListRequestsParams,
} from '@/types/requests';

const STATUS_OPTIONS: Array<RequestStatus | ''> = ['', 'pending', 'approved', 'rejected'];
const PRIORITY_OPTIONS: Array<RequestPriority | ''> = ['', 'high', 'normal', 'low'];
const DATE_OPTIONS: Array<{ value: ListRequestsParams['dateRange']; label: string }> = [
  { value: '', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'older', label: 'Older' },
];

function priorityClass(priority: RequestPriority): string {
  switch (priority) {
    case 'high':
      return 'priority-badge priority-high';
    case 'normal':
      return 'priority-badge priority-normal';
    case 'low':
      return 'priority-badge priority-low';
    default:
      return 'priority-badge';
  }
}

function statusClass(status: RequestStatus): string {
  switch (status) {
    case 'approved':
      return 'status-badge status-approved';
    case 'rejected':
      return 'status-badge status-rejected';
    case 'pending':
      return 'status-badge status-pending';
    default:
      return 'status-badge';
  }
}

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysUntil(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date('2026-01-19'); // Mock current date
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays} days`;
}

export function RequestsPage() {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [stats, setStats] = useState<RequestStats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('pending');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | ''>('');
  const [dateFilter, setDateFilter] = useState<ListRequestsParams['dateRange']>('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [requestsData, statsData] = await Promise.all([
        mockRequestsService.listRequests({
          status: statusFilter,
          priority: priorityFilter,
          dateRange: dateFilter,
        }),
        mockRequestsService.getRequestStats(),
      ]);
      setRequests(requestsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, dateFilter]);

  const handleApprove = async (requestId: string) => {
    try {
      await mockRequestsService.approveRequest({ requestId });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await mockRequestsService.rejectRequest({ requestId, reason: 'Rejected by admin' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    }
  };

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);

  return (
    <main className="main-content">
      {/* Sidebar Filters */}
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
                <span>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Priority</h3>
          <div className="filter-group">
            {PRIORITY_OPTIONS.map((p) => (
              <label key={p || 'all'} className="checkbox-label">
                <input
                  type="radio"
                  name="priority"
                  checked={priorityFilter === p}
                  onChange={() => setPriorityFilter(p)}
                />
                <span>{p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Request Date</h3>
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
            <span>Rejected:</span>
            <span className="stat-value rejected">{stats.rejected}</span>
          </div>
          <div className="stat-row">
            <span>Total:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
      </aside>

      {/* Requests Section */}
      <section className="content-section">
        <div className="section-header">
          <h2>Incoming Requests</h2>
          <div className="section-controls">
            <span className="results-count">{pendingRequests.length} pending requests</span>
            <select className="sort-select">
              <option>Sort by: Oldest First</option>
              <option>Newest First</option>
              <option>Priority</option>
              <option>Requester</option>
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
                  <th>Request ID</th>
                  <th>Requester</th>
                  <th>Items</th>
                  <th>Purpose</th>
                  <th>Requested For</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className={`priority-${request.priority}`}>
                    <td>
                      <span className="request-id">{request.id}</span>
                      <span className="request-date">{formatDate(request.createdAt)}</span>
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
                          {request.items[0]?.quantity}x {request.items[0]?.materialName}
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
                      <span className={`days-until ${
                        new Date(request.requestedFor) < new Date('2026-01-19') ? 'urgent' : ''
                      }`}>
                        {getDaysUntil(request.requestedFor)}
                      </span>
                    </td>
                    <td>
                      <span className={priorityClass(request.priority)}>
                        {request.priority}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {request.status === 'pending' ? (
                          <>
                            <button
                              className="btn-approve"
                              onClick={() => handleApprove(request.id)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-reject"
                              onClick={() => handleReject(request.id)}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className={statusClass(request.status)}>
                            {request.status}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-text-secondary">
                      No requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Request Details Modal */}
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
                <p><strong>Email:</strong> {selectedRequest.requesterEmail}</p>
                <p><strong>Phone:</strong> {selectedRequest.requesterPhone}</p>
              </div>
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Requested Items</h4>
                <ul className="space-y-1">
                  {selectedRequest.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{item.materialName}</span>
                      <span className="font-semibold">Qty: {item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Details</h4>
                <p><strong>Purpose:</strong> {selectedRequest.purpose}</p>
                <p><strong>Requested For:</strong> {formatDate(selectedRequest.requestedFor)}</p>
                <p><strong>Priority:</strong> {selectedRequest.priority}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
