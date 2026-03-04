# Branch: feature/dist-workflow

## Tasks (sequential order)
1. Incoming requests page — only show pending and approved (remove other status options)
2. Returns page — show inAction and returned (add new "unpacked" category)
3. Packaging page — require user to enter material codes they are packing

These are sequential because they may share type definitions and API patterns within the distribution frontend.

---

## Task 1: Incoming requests page — simplify status filters

### Context
The RequestsPage (`frontend/distribution/src/pages/RequestsPage.tsx`) currently shows filter options for ALL statuses: pending, approved, inAction, returned, cancelled. The incoming requests page should only concern itself with **pending** and **approved** requests. The other statuses (inAction, returned, cancelled) are handled on other pages or are irrelevant here.

### Steps

1. **Edit** `frontend/distribution/src/pages/RequestsPage.tsx`
   - Change `STATUS_OPTIONS` from `['', 'pending', 'approved', 'inAction', 'returned', 'cancelled']` to `['', 'pending', 'approved']`
   - In `loadData()`, remove the API calls for `inAction`, `returned`, and `cancelled` — only fetch `pending` and `approved`
   - Update the `stats` object to only track `pending` and `approved` counts (remove inAction, returned, cancelled, archived from stats display)
   - Remove the "Show archived" checkbox (archived requests are not relevant for incoming)
   - Update the stats card in the sidebar to only show Pending, Approved, and Total
   - Keep all existing functionality for approve/cancel/archive actions on pending and approved requests

---

## Task 2: Returns page — show inAction and returned, add "unpacked" category

### Context
The ReturnsPage (`frontend/distribution/src/pages/ReturnsPage.tsx`) currently uses a mock service with statuses: awaiting, received, inspection, completed. It needs to be reworked to show real requests with statuses **inAction** (currently out on loan) and **returned** (sent back). Additionally, add a new "unpacked" status/category for items that have been returned but not yet inspected/unpacked.

### Steps

1. **Edit** `frontend/distribution/src/types/returns.ts`
   - Add 'unpacked' to the `ReturnStatus` type if not already present
   - Ensure the type definitions align with the actual request statuses from the API

2. **Edit** `frontend/distribution/src/pages/ReturnsPage.tsx`
   - Change `STATUS_OPTIONS` to show statuses relevant to returns: `['', 'inAction', 'returned', 'unpacked']`
   - Replace the mock service calls with real API calls using `api.listIncomingRequests()` for 'inAction' and 'returned' statuses
   - Add status styling for 'unpacked' (new badge class/color)
   - Add status label for 'unpacked' (e.g., "Unpacked" or "Ausgepackt")
   - Update the stats card to show: In Action, Returned, Unpacked counts
   - Keep the existing inspection modal and item processing functionality for returned/unpacked items
   - The "unpacked" status represents items that have physically arrived but haven't been processed yet — it sits between "returned" and being put back in inventory

3. **Check** if the backend needs a new status
   - If 'unpacked' is not an existing backend status, note this in the plan but implement the frontend assuming the API will support it. The backend changes would be:
     - Add 'unpacked' to the request status enum in `distribution_backend/internal/db/models.go`
     - Add a migration for the new status
     - Add an endpoint to mark a request as 'unpacked'

---

## Task 3: Packaging page — require material codes input

### Context
The PackagingPage (`frontend/distribution/src/pages/PackagingPage.tsx`) has a packaging checklist where users check off material types. Currently it's just checkboxes — the user should also be required to enter/scan material unit codes (serial numbers or barcodes) for each item they are packing. This ensures traceability.

### Steps

1. **Edit** `frontend/distribution/src/pages/PackagingPage.tsx`
   - In the packaging modal (the `packagingOrder` modal), modify each checklist item:
     - Add a text input field for each item where the user enters the material code(s)
     - The input should accept comma-separated codes for items with quantity > 1
     - The checkbox should only be checkable AFTER at least one code has been entered
     - Show the count of entered codes vs required quantity (e.g., "2/3 codes entered")
   - Update `packChecks` state to also store the entered material codes (change from `Record<string, boolean>` to `Record<string, { checked: boolean; codes: string[] }>`)
   - Validate that the number of entered codes matches the required quantity before allowing the checkbox to be checked
   - Update `handleMarkPacked` to include the material codes in the API call (add them to the request body)
   - Add the material codes to the `markIncomingRequestInAction` API call

2. **Edit** `frontend/distribution/src/services/api.ts`
   - Update `markIncomingRequestInAction` to accept an optional parameter for material codes per item
   - The payload should include something like: `{ trackingCode: string, items: [{ materialTypeId: string, codes: string[] }] }`

3. **Backend consideration**: The backend (`distribution_backend/internal/handlers/requests.go`) will need to accept and store material codes. If the current API doesn't support this field, add it:
   - Update the `markInAction` handler to accept item codes in the request body
   - Store the codes in the database (may need a new table or column)
   - This enables future audit trail and return verification
