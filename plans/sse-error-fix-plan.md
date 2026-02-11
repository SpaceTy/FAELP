# SSE Error Spam Fix Plan

## Problem Statement

The "My Requests" page is spamming CORS errors when the SSE subscription endpoint fails. The errors include:
- `Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource`
- Status code: `(null)`

## Root Cause Analysis

### Primary Issue: Bypassing Vite Proxy

The **root cause** was that the frontend services were using `http://localhost:8080` directly instead of using the Vite proxy:

1. **Vite proxy configuration** (`vite.config.ts`):
   - Proxies `/api/*` to `http://localhost:8080/*`
   - Rewrites `/api` prefix to empty string

2. **Frontend services** (`api.ts`, `sse.ts`, `auth.ts`):
   - Used `VITE_API_URL || 'http://localhost:8080'` directly
   - This bypassed the Vite proxy entirely
   - Caused cross-origin requests from `localhost:3000` to `localhost:8080`

3. **Why CORS errors occurred**:
   - Browser made cross-origin request from Vite dev server (port 3000) to backend (port 8080)
   - Backend CORS middleware was configured, but SSE connections failed before headers were sent
   - `EventSource` API doesn't support custom headers, so auth token was in query string

### Secondary Issue: Error Spam

The frontend SSE service had exponential backoff, but:
- The `onerror` handler called `onError` callback on every error
- The hook logged every error to console
- No throttling or suppression during reconnection attempts

## Solution Implemented

### 1. Use Vite Proxy (Primary Fix)

Changed all frontend services to use `/api` as the base URL:

**Files modified:**
- `frontend/user/src/services/api.ts`
- `frontend/user/src/services/sse.ts`
- `frontend/user/src/services/auth.ts`

```typescript
// Before (caused CORS issues):
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// After (uses Vite proxy, no CORS):
const API_BASE = '/api';
```

This routes all requests through the Vite dev server proxy, avoiding cross-origin requests entirely.

### 2. Backend SSE Heartbeat

Added initial heartbeat to confirm SSE connection:

**File: `organization_backend/internal/transport/sse.go`**

```go
// Send initial heartbeat to confirm connection is established.
fmt.Fprintf(w, ": connected\n\n")
flusher.Flush()
```

### 3. Frontend Error Suppression

Added error suppression and improved backoff:

**File: `frontend/user/src/services/sse.ts`**

- Error callback only invoked after 3+ consecutive errors
- Rate-limited to at most once every 5 seconds
- Increased initial delay to 2 seconds
- Increased max delay to 60 seconds
- Added `isConnecting` flag to prevent multiple simultaneous connection attempts
- Added `onopen` handler to reset error state on successful connection

## Files Modified

1. `frontend/user/src/services/api.ts` - Use `/api` base URL
2. `frontend/user/src/services/sse.ts` - Use `/api` base URL + error suppression
3. `frontend/user/src/services/auth.ts` - Use `/api` base URL
4. `organization_backend/internal/transport/sse.go` - Add initial heartbeat

## Why This Fix Works

1. **No more CORS**: Requests go through Vite proxy, browser sees them as same-origin
2. **Better error handling**: Errors are suppressed during reconnection attempts
3. **Faster failure detection**: Initial heartbeat confirms connection immediately
4. **Cleaner console**: Only logs errors after threshold and rate-limited
