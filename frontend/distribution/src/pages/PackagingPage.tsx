import { useEffect, useState } from 'preact/hooks';
import { api, type IncomingRequest } from '@/services/api';

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function normalizeCodeInput(value: string): string {
  return value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5);
}

function getDraftCodes(order: IncomingRequest, materialTypeId: string, quantity: number): string[] {
  const saved = order.packagingDraft?.items.find((item) => item.materialTypeId === materialTypeId)?.codes ?? [];
  const next = Array.from({ length: quantity }, (_, index) => saved[index] ?? '');
  return next.map((code) => normalizeCodeInput(code));
}

function getDuplicateFieldKeys(packCodes: Record<string, string[]>): Set<string> {
  const keysByCode = new Map<string, string[]>();

  Object.entries(packCodes).forEach(([materialTypeId, codes]) => {
    codes.forEach((code, index) => {
      const normalized = normalizeCodeInput(code);
      if (!normalized) return;
      const fieldKey = `${materialTypeId}-${index}`;
      const existing = keysByCode.get(normalized) ?? [];
      existing.push(fieldKey);
      keysByCode.set(normalized, existing);
    });
  });

  const duplicates = new Set<string>();
  keysByCode.forEach((fieldKeys) => {
    if (fieldKeys.length < 2) return;
    fieldKeys.forEach((fieldKey) => duplicates.add(fieldKey));
  });
  return duplicates;
}

type AutoFillConfirmation = {
  materialTypeId: string;
  materialName: string;
  index: number;
  code: string;
  previousCode: string;
};

export function PackagingPage() {
  const [orders, setOrders] = useState<IncomingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<IncomingRequest | null>(null);
  const [packagingOrder, setPackagingOrder] = useState<IncomingRequest | null>(null);
  const [packCodes, setPackCodes] = useState<Record<string, string[]>>({});
  const [codeValidationErrors, setCodeValidationErrors] = useState<Record<string, string[]>>({});
  const [validatingCodes, setValidatingCodes] = useState<Record<string, boolean>>({});
  const [outgoingTrackingCode, setOutgoingTrackingCode] = useState('');
  const [isSubmittingPack, setIsSubmittingPack] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [autoFillConfirmation, setAutoFillConfirmation] = useState<AutoFillConfirmation | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const approvedOrders = await api.listIncomingRequests('approved');
      approvedOrders.sort((a, b) => {
        const draftPriority = Number(Boolean(b.packagingDraft)) - Number(Boolean(a.packagingDraft));
        if (draftPriority !== 0) return draftPriority;
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
      });
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
  const draftCount = orders.filter((order) => !!order.packagingDraft).length;

  const openPackagingModal = (order: IncomingRequest) => {
    const initialCodes: Record<string, string[]> = {};
    const initialErrors: Record<string, string[]> = {};

    for (const item of order.items) {
      initialCodes[item.materialTypeId] = getDraftCodes(order, item.materialTypeId, item.quantity);
      initialErrors[item.materialTypeId] = Array.from({ length: item.quantity }, () => '');
    }

    setPackCodes(initialCodes);
    setCodeValidationErrors(initialErrors);
    setValidatingCodes({});
    setOutgoingTrackingCode(order.packagingDraft?.outgoingTrackingCode ?? '');
    setAutoFillConfirmation(null);
    setPackagingOrder(order);
  };

  const closePackagingModal = () => {
    setPackagingOrder(null);
    setAutoFillConfirmation(null);
  };

  const updateCodeValue = (materialTypeId: string, index: number, value: string) => {
    const normalized = normalizeCodeInput(value);

    setPackCodes((prev) => ({
      ...prev,
      [materialTypeId]: (prev[materialTypeId] ?? []).map((code, codeIndex) => (codeIndex === index ? normalized : code)),
    }));

    setCodeValidationErrors((prev) => ({
      ...prev,
      [materialTypeId]: (prev[materialTypeId] ?? []).map((errorMessage, codeIndex) => (codeIndex === index ? '' : errorMessage)),
    }));
  };

  const validateCodeField = async (materialTypeId: string, index: number, rawCode: string): Promise<boolean> => {
    const code = normalizeCodeInput(rawCode);
    const fieldKey = `${materialTypeId}-${index}`;

    if (!code) {
      setCodeValidationErrors((prev) => ({
        ...prev,
        [materialTypeId]: (prev[materialTypeId] ?? []).map((message, codeIndex) => (codeIndex === index ? '' : message)),
      }));
      return false;
    }

    if (code.length !== 5) {
      setCodeValidationErrors((prev) => ({
        ...prev,
        [materialTypeId]: (prev[materialTypeId] ?? []).map((message, codeIndex) => (
          codeIndex === index ? 'Code must be 5 letters.' : message
        )),
      }));
      return false;
    }

    setValidatingCodes((prev) => ({ ...prev, [fieldKey]: true }));
    try {
      const result = await api.validateMaterialCode(code, materialTypeId);
      const nextMessage = result.valid ? '' : (result.error || 'Invalid code');
      setCodeValidationErrors((prev) => ({
        ...prev,
        [materialTypeId]: (prev[materialTypeId] ?? []).map((message, codeIndex) => (
          codeIndex === index ? nextMessage : message
        )),
      }));
      return result.valid;
    } catch {
      setCodeValidationErrors((prev) => ({
        ...prev,
        [materialTypeId]: (prev[materialTypeId] ?? []).map((message, codeIndex) => (
          codeIndex === index ? 'Could not validate code right now.' : message
        )),
      }));
      return false;
    } finally {
      setValidatingCodes((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const validateAllCodes = async (): Promise<boolean> => {
    if (!packagingOrder) return false;

    const validationTasks: Array<Promise<boolean>> = [];
    for (const item of packagingOrder.items) {
      const codes = packCodes[item.materialTypeId] ?? [];
      for (let index = 0; index < item.quantity; index += 1) {
        validationTasks.push(validateCodeField(item.materialTypeId, index, codes[index] ?? ''));
      }
    }

    const results = await Promise.all(validationTasks);
    return results.every(Boolean);
  };

  const handleRandomFill = async (materialTypeId: string, materialName: string, index: number) => {
    if (!packagingOrder) return;

    setError(null);

    try {
      const availableInstances = await api.listAvailableMaterialInstances(materialTypeId, 200);
      const currentValue = packCodes[materialTypeId]?.[index] ?? '';
      const selectedCodes = new Set(
        Object.values(packCodes)
          .flat()
          .map((code) => normalizeCodeInput(code))
          .filter((code) => code && code !== normalizeCodeInput(currentValue)),
      );

      const candidates = availableInstances.filter((instance) => !selectedCodes.has(instance.humanCode));
      if (candidates.length === 0) {
        throw new Error(`No unused in-stock codes are available for ${materialName}.`);
      }

      const selectedInstance = candidates[Math.floor(Math.random() * candidates.length)];
      updateCodeValue(materialTypeId, index, selectedInstance.humanCode);
      await validateCodeField(materialTypeId, index, selectedInstance.humanCode);

      setAutoFillConfirmation({
        materialTypeId,
        materialName,
        index,
        code: selectedInstance.humanCode,
        previousCode: currentValue,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick a random material code');
    }
  };

  const getEnteredCount = (materialTypeId: string): number => {
    return (packCodes[materialTypeId] ?? []).filter((code) => normalizeCodeInput(code)).length;
  };

  const isCategoryComplete = (materialTypeId: string, quantity: number): boolean => {
    return getEnteredCount(materialTypeId) === quantity;
  };

  const duplicateFieldKeys = getDuplicateFieldKeys(packCodes);
  const hasDuplicateCodes = duplicateFieldKeys.size > 0;
  const completedCategories = packagingOrder
    ? packagingOrder.items.filter((item) => isCategoryComplete(item.materialTypeId, item.quantity)).length
    : 0;
  const hasTrackingCode = outgoingTrackingCode.trim().length > 0;
  const allRequiredCodesEntered = packagingOrder
    ? packagingOrder.items.every((item) => isCategoryComplete(item.materialTypeId, item.quantity))
    : false;
  const hasAsyncValidationErrors = packagingOrder
    ? packagingOrder.items.some((item) => (codeValidationErrors[item.materialTypeId] ?? []).some((message) => message !== ''))
    : false;
  const hasValidationErrors = hasDuplicateCodes || hasAsyncValidationErrors;
  const canSaveDraft = !!packagingOrder && allRequiredCodesEntered && !hasValidationErrors && !isSavingDraft && !isSubmittingPack;
  const canMarkPacked = canSaveDraft && hasTrackingCode;

  const saveDraftDisabledReason = !allRequiredCodesEntered
    ? 'Enter a code for each requested item before saving the draft.'
    : hasDuplicateCodes
      ? 'Each material code can only be used once in the package.'
      : hasAsyncValidationErrors
        ? 'Fix invalid material codes before saving the draft.'
        : '';

  const markPackedDisabledReason = !allRequiredCodesEntered
    ? 'Enter a code for each requested item before continuing.'
    : hasDuplicateCodes
      ? 'Each material code can only be used once in the package.'
      : hasAsyncValidationErrors
        ? 'Fix invalid material codes before continuing.'
        : !hasTrackingCode
          ? 'Enter DHL tracking code to continue.'
          : '';

  const buildItemsPayload = (): Array<{ materialTypeId: string; codes: string[] }> => {
    if (!packagingOrder) return [];

    return packagingOrder.items.map((item) => ({
      materialTypeId: item.materialTypeId,
      codes: (packCodes[item.materialTypeId] ?? []).map((code) => normalizeCodeInput(code)).filter(Boolean),
    }));
  };

  const handleSaveDraft = async () => {
    if (!packagingOrder || !canSaveDraft) return;

    const isValid = await validateAllCodes();
    if (!isValid) return;

    setIsSavingDraft(true);
    setError(null);
    try {
      await api.saveIncomingRequestPackagingDraft(packagingOrder.id, outgoingTrackingCode.trim(), buildItemsPayload());
      closePackagingModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save packaging draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleMarkPacked = async () => {
    if (!packagingOrder || !canMarkPacked) return;

    const isValid = await validateAllCodes();
    if (!isValid) return;

    setIsSubmittingPack(true);
    setError(null);
    try {
      await api.markIncomingRequestInAction(packagingOrder.id, outgoingTrackingCode.trim(), buildItemsPayload());
      closePackagingModal();
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
            <span>Drafts Saved:</span>
            <span className="stat-value in-progress">{draftCount}</span>
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
                  <th>Packaging</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const shipBy = getShipByLabel(order.deliveryDate);
                  const isDraft = !!order.packagingDraft;
                  const draftHasTracking = !!order.packagingDraft?.outgoingTrackingCode?.trim();

                  return (
                    <tr key={order.id}>
                      <td>
                        <span className="request-id">{order.id}</span>
                        <span className="request-date">{formatDate(order.createdAt)}</span>
                        {isDraft && (
                          <span className="request-date">
                            Draft saved {formatDateTime(order.packagingDraft!.updatedAt)}
                          </span>
                        )}
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
                        {isDraft ? (
                          <div className="flex flex-col gap-1">
                            <span className="status-badge status-in-progress">Draft saved</span>
                            <span className={`packaging-draft-note ${draftHasTracking ? 'is-complete' : 'is-missing'}`}>
                              {draftHasTracking ? 'Tracking added' : 'Tracking missing'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-text-secondary">Not started</span>
                        )}
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
                            title={order.isFulfillable ? (isDraft ? 'Edit saved packaging draft' : 'Open packaging checklist') : 'Cannot package: insufficient stock'}
                          >
                            {isDraft ? 'Edit Draft' : 'Package'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-text-secondary">
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
        <div className="modal-overlay" onClick={closePackagingModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Package Request - {packagingOrder.id}</h3>
              <button className="modal-close" onClick={closePackagingModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Packaging Checklist</h4>
                <p>{completedCategories}/{packagingOrder.items.length} categories complete</p>
                {packagingOrder.packagingDraft && (
                  <p className="text-sm text-text-secondary mt-1">
                    Draft last saved {formatDateTime(packagingOrder.packagingDraft.updatedAt)}.
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {packagingOrder.items.map((item) => {
                  const codes = packCodes[item.materialTypeId] ?? [];
                  const fieldErrors = codeValidationErrors[item.materialTypeId] ?? [];
                  const enteredCount = getEnteredCount(item.materialTypeId);
                  const isComplete = enteredCount === item.quantity;

                  return (
                    <section key={item.materialTypeId} className="packaging-group-card">
                      <div className="flex items-start gap-4">
                        <div className="packaging-check-image shrink-0">
                          {item.materialImageUrl ? (
                            <img src={item.materialImageUrl} alt={item.materialName} />
                          ) : (
                            <div className="packaging-image-placeholder">No Image</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong>{item.materialName}</strong>
                            <span className={isComplete ? 'status-badge status-approved' : 'status-badge status-pending'}>
                              {enteredCount}/{item.quantity} codes
                            </span>
                            <span className={item.isFulfillable ? 'stock-check stock-check-ok' : 'stock-check stock-check-missing'}>
                              Available: {item.availableQuantity}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-text-secondary">
                            Required quantity: {item.quantity}
                          </p>

                          <div className="mt-4 space-y-2">
                            {Array.from({ length: item.quantity }, (_, index) => {
                              const fieldKey = `${item.materialTypeId}-${index}`;
                              const duplicateError = duplicateFieldKeys.has(fieldKey) ? 'Code already used in this package.' : '';
                              const validationError = fieldErrors[index] || duplicateError;
                              const isValidating = validatingCodes[fieldKey];

                              return (
                                <div key={fieldKey} className="packaging-code-row">
                                  <div className="flex items-center gap-2">
                                    <span className="w-16 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                      Item {index + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={codes[index] ?? ''}
                                      onInput={(e) => updateCodeValue(item.materialTypeId, index, (e.target as HTMLInputElement).value)}
                                      onBlur={(e) => validateCodeField(item.materialTypeId, index, (e.target as HTMLInputElement).value)}
                                      className="code-input packaging-code-input min-w-0 flex-1 text-sm uppercase tracking-[0.2em]"
                                      placeholder="Enter code"
                                      maxLength={5}
                                    />
                                    <button
                                      type="button"
                                      className="packaging-code-action"
                                      onClick={() => handleRandomFill(item.materialTypeId, item.materialName, index)}
                                      title="Pick a random in-stock code"
                                    >
                                      Auto
                                    </button>
                                  </div>
                                  {(isValidating || validationError) && (
                                    <p className={`mt-1 text-xs ${validationError ? 'text-red-500' : 'text-text-secondary'}`}>
                                      {isValidating ? 'Validating code...' : validationError}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </section>
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
                  className="code-input packaging-tracking-input"
                  placeholder="Enter DHL tracking code"
                />
                <p className="text-text-secondary mt-1 text-sm">
                  Required to move the request to inAction. You can save the package as a draft without it.
                </p>
              </div>

              <div className="card-actions mt-4 gap-2">
                <span className="button-tooltip-wrap" title={saveDraftDisabledReason}>
                  <button
                    className="btn-secondary btn-secondary-light"
                    disabled={!canSaveDraft}
                    onClick={handleSaveDraft}
                    title={saveDraftDisabledReason}
                  >
                    {isSavingDraft ? 'Saving Draft...' : 'Save Draft'}
                  </button>
                </span>
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

      {autoFillConfirmation && (
        <div className="modal-overlay" onClick={() => setAutoFillConfirmation(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Auto Fill</h3>
              <button className="modal-close" onClick={() => setAutoFillConfirmation(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-text-secondary">
                The code <strong>{autoFillConfirmation.code}</strong> was inserted for {autoFillConfirmation.materialName} item {autoFillConfirmation.index + 1}.
              </p>
              <p className="mt-3 text-sm text-text-secondary">
                If this code is not already written on the physical item, write it onto the item now before continuing.
              </p>
              <div className="card-actions mt-4 gap-2">
                <button
                  className="btn-secondary btn-secondary-light"
                  onClick={() => {
                    updateCodeValue(autoFillConfirmation.materialTypeId, autoFillConfirmation.index, autoFillConfirmation.previousCode);
                    setAutoFillConfirmation(null);
                  }}
                >
                  Undo
                </button>
                <button className="btn-primary" onClick={() => setAutoFillConfirmation(null)}>
                  Keep Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
