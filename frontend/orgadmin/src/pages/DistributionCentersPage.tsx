import { useEffect, useMemo, useState } from 'preact/hooks';
import type { DistributionCenter, LinkRequest } from '@/types/distributionCenter';
import { distributionCenterService } from '@/services/distributionCenters';

export function DistributionCentersPage() {
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [centers, setCenters] = useState<DistributionCenter[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [tokenInput, setTokenInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [reactivateNote, setReactivateNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [reqs, cts] = await Promise.all([
        distributionCenterService.listLinkRequests(),
        distributionCenterService.listCenters(),
      ]);
      setRequests(reqs);
      setCenters(cts);
      if (!selectedRequestId && reqs.length > 0) {
        setSelectedRequestId(reqs[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Verknüpfungen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindByToken = async () => {
    setError('');
    setInfo('');
    if (!tokenInput.trim()) {
      setError('Bitte Challenge-Token eingeben.');
      return;
    }
    try {
      const match = await distributionCenterService.findByToken(tokenInput.trim());
      if (!match) {
        setInfo('Kein passender pending request gefunden.');
        return;
      }
      setSelectedRequestId(match.id);
      setInfo(`Treffer: ${match.centerCode} (${match.requestedCenterName})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token-Abgleich fehlgeschlagen');
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setError('');
    setInfo('');
    try {
      await distributionCenterService.approveLinkRequest(selectedRequest.id, noteInput);
      setNoteInput('');
      await loadData();
      setInfo('Request freigegeben.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freigabe fehlgeschlagen');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      setError('Ablehnungsgrund ist erforderlich.');
      return;
    }
    setError('');
    setInfo('');
    try {
      await distributionCenterService.rejectLinkRequest(selectedRequest.id, rejectReason.trim());
      setRejectReason('');
      await loadData();
      setInfo('Request abgelehnt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ablehnung fehlgeschlagen');
    }
  };

  const handleReactivate = async (centerId: string) => {
    setError('');
    setInfo('');
    try {
      await distributionCenterService.reactivateCenter(centerId, reactivateNote);
      setReactivateNote('');
      await loadData();
      setInfo('Distribution Center reaktiviert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reaktivierung fehlgeschlagen');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Distribution Center Linking</h1>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-hover transition-colors"
          >
            Aktualisieren
          </button>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <label className="block text-sm font-semibold mb-2 text-text-primary">Challenge-Token Verifikation</label>
          <div className="flex gap-2">
            <input
              value={tokenInput}
              onInput={(e) => setTokenInput((e.target as HTMLInputElement).value)}
              placeholder="Token aus privater Kommunikation"
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
            />
            <button
              onClick={handleFindByToken}
              className="px-4 py-2 bg-secondary text-white rounded hover:bg-secondary-hover"
            >
              Matching Request finden
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-4 rounded">{error}</div>}
        {info && <div className="bg-emerald-50 text-emerald-700 p-4 rounded">{info}</div>}

        {isLoading ? (
          <div className="text-center py-12 text-text-secondary">Wird geladen...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded shadow overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold">Link Requests</div>
              <div className="max-h-[520px] overflow-auto divide-y">
                {requests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selectedRequestId === req.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-text-primary">{req.centerCode}</div>
                    <div className="text-sm text-text-secondary">{req.requestedCenterName}</div>
                    <div className="text-xs text-text-secondary">Status: {req.state}</div>
                  </button>
                ))}
                {requests.length === 0 && (
                  <div className="px-4 py-8 text-text-secondary text-sm">Keine Link Requests gefunden.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded shadow p-4 space-y-4">
              <h2 className="font-semibold text-lg">Request Details</h2>
              {!selectedRequest ? (
                <p className="text-text-secondary">Kein Request ausgewählt.</p>
              ) : (
                <>
                  <div className="text-sm space-y-1">
                    <div><span className="font-semibold">Code:</span> {selectedRequest.centerCode}</div>
                    <div><span className="font-semibold">Name:</span> {selectedRequest.requestedCenterName}</div>
                    <div><span className="font-semibold">Address:</span> {selectedRequest.requestedCenterAddress}</div>
                    <div><span className="font-semibold">Callback:</span> {selectedRequest.requestedCallbackUrl}</div>
                    <div><span className="font-semibold">Status:</span> {selectedRequest.state}</div>
                    <div><span className="font-semibold">Challenge gültig bis:</span> {new Date(selectedRequest.challengeExpiresAt).toLocaleString()}</div>
                  </div>

                  {selectedRequest.state === 'pending' && (
                    <div className="space-y-3 pt-2 border-t">
                      <div>
                        <label className="block text-sm font-semibold mb-1">Admin Notiz (bei Freigabe)</label>
                        <textarea
                          className="w-full border border-gray-300 rounded p-2"
                          rows={2}
                          value={noteInput}
                          onInput={(e) => setNoteInput((e.target as HTMLTextAreaElement).value)}
                        />
                      </div>
                      <button
                        onClick={handleApprove}
                        className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        Freigeben
                      </button>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Ablehnungsgrund</label>
                        <textarea
                          className="w-full border border-gray-300 rounded p-2"
                          rows={2}
                          value={rejectReason}
                          onInput={(e) => setRejectReason((e.target as HTMLTextAreaElement).value)}
                        />
                      </div>
                      <button
                        onClick={handleReject}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Ablehnen
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded shadow overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">Distribution Center Status</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-text-secondary">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Letzter Heartbeat</th>
                  <th className="px-4 py-2 text-left">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2">{c.centerCode}</td>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2">{c.linkState}</td>
                    <td className="px-4 py-2">{c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2">
                      {c.linkState === 'admin_locked' ? (
                        <div className="flex gap-2">
                          <input
                            value={reactivateNote}
                            onInput={(e) => setReactivateNote((e.target as HTMLInputElement).value)}
                            placeholder="Notiz"
                            className="px-2 py-1 border border-gray-300 rounded"
                          />
                          <button
                            onClick={() => handleReactivate(c.id)}
                            className="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                          >
                            Reaktivieren
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
                {centers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-text-secondary text-center">
                      Keine Distribution Center gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
