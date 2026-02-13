# Plan: Backend-Served Frontends

## Overview

Currently, all 4 frontends are served by Vite dev servers during development. This plan outlines how to configure the backends to serve their associated frontends from static files, matching the production deployment model.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Development (Current)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Organization Backend (:8080)     Distribution Backend (:8081)   │
│         │                                │                       │
│         ▼                                ▼                       │
│    API only                          API only                    │
│                                                                  │
│  User Frontend (:3000)            Distribution Frontend (:3003)  │
│  OrgAdmin Frontend (:3001)        DistAdmin Frontend (:3002)     │
│         │                                │                       │
│         ▼                                ▼                       │
│    Vite Dev Server                  Vite Dev Server              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Target (Backend-Served)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Organization Backend                                            │
│  ├── :8080 (Main)               Distribution Backend             │
│  │   ├── /api/* → API routes    ├── :8081 (Main)                │
│  │   └── /* → User frontend     │   ├── /api/* → API routes     │
│  │                              │   └── /* → Distribution FE     │
│  └── :8082 (Admin)              │                               │
│      └── /* → OrgAdmin frontend └── :8083 (Admin)               │
│                                     └── /* → DistAdmin frontend  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Port Allocation

| Service | Port | Purpose |
|---------|------|---------|
| Organization Backend (Main) | 8080 | API + User Frontend |
| Organization Backend (Admin) | 8082 | OrgAdmin Frontend |
| Distribution Backend (Main) | 8081 | API + Distribution Frontend |
| Distribution Backend (Admin) | 8083 | DistAdmin Frontend |

## Implementation Details

### 1. Configuration Changes

#### organization_backend/config.yaml

```yaml
# Frontend serving configuration
frontend:
  user:
    enabled: true
    path: "../frontend/user/dist"  # Path to built user frontend
  admin:
    enabled: true
    port: 8082
    path: "../frontend/orgadmin/dist"  # Path to built orgadmin frontend
```

#### distribution_backend/config.yaml

```yaml
# Frontend serving configuration
frontend:
  distribution:
    enabled: true
    path: "../frontend/distribution/dist"
  admin:
    enabled: true
    port: 8083
    path: "../frontend/distadmin/dist"
```

### 2. Config Struct Updates

Both backends need their config structs extended:

```go
// FrontendConfig for serving static frontend files
type FrontendConfig struct {
    Enabled bool   `yaml:"enabled"`
    Path    string `yaml:"path"`
}

// AdminFrontendConfig includes port for admin frontends
type AdminFrontendConfig struct {
    Enabled bool   `yaml:"enabled"`
    Port    int    `yaml:"port"`
    Path    string `yaml:"path"`
}
```

### 3. Static File Serving Handler

Create a reusable handler for serving SPAs:

```go
// SPAHandler serves a single-page application from a directory
type SPAHandler struct {
    staticPath string
    indexPath  string
}

func (h SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // Try to serve static file first
    // If not found, serve index.html for client-side routing
}
```

### 4. Main Server Changes

#### organization_backend/cmd/server/main.go

- Add frontend config loading
- Mount User frontend at root on :8080 (after API routes)
- Start separate :8082 server for OrgAdmin frontend

#### distribution_backend/cmd/server/main.go

- Add frontend config loading
- Mount Distribution frontend at root on :8081 (after API routes)
- Start separate :8083 server for DistAdmin frontend

### 5. Vite Configuration Updates

The Vite configs need to ensure API routes work correctly when served from backend:

#### frontend/user/vite.config.ts

```typescript
export default defineConfig({
  plugins: [preact()],
  base: '/',  // Default base
  build: {
    outDir: 'dist',
  },
  // Remove proxy config - not needed when served by backend
})
```

All frontends will make API calls to relative paths like `/api/...` which will be handled by the backend serving them.

### 6. Makefile Updates

Update development targets to build frontends first:

```makefile
dev-org:
    @echo "Building frontends..."
    cd $(USER_FRONTEND_DIR) && npm run build
    cd $(ORGADMIN_FRONTEND_DIR) && npm run build
    @echo "Starting orgbackend..."
    cd $(ORG_BACKEND_DIR) && go run ./cmd/server

dev-dist:
    @echo "Building frontends..."
    cd $(DISTRIBUTION_FRONTEND_DIR) && npm run build
    cd $(DISTADMIN_FRONTEND_DIR) && npm run build
    @echo "Starting distbackend..."
    cd $(DIST_BACKEND_DIR) && go run ./cmd/server
```

### 7. API Route Prefix

**Distribution Backend**: Already uses `/api` prefix for all routes. No changes needed.

**Organization Backend**: Routes are currently at root level (`/auth/...`, `/requests/...`). Need to prefix with `/api`:

- Current: `/auth/...`, `/requests/...`, `/material-types/...`
- Target: `/api/auth/...`, `/api/requests/...`, `/api/material-types/...`

This requires updating:
1. Organization backend route definitions in `routes.go`
2. User frontend API service calls (already use `/api` prefix via Vite proxy rewrite)
3. OrgAdmin frontend API service calls (currently use direct URLs without `/api`)

## File Changes Summary

### Backend Files to Modify

| File | Changes |
|------|---------|
| `organization_backend/config.yaml` | Add frontend config section |
| `distribution_backend/config.yaml` | Add frontend config section |
| `organization_backend/internal/config/config.go` | Add frontend config structs |
| `distribution_backend/internal/config/config.go` | Add frontend config structs |
| `organization_backend/cmd/server/main.go` | Add frontend servers |
| `distribution_backend/cmd/server/main.go` | Add frontend servers |
| `organization_backend/internal/api/routes.go` | Prefix routes with /api |

**Note**: Distribution backend routes already use `/api` prefix - no route changes needed.

### Frontend Files to Modify

| File | Changes |
|------|---------|
| `frontend/user/vite.config.ts` | Remove dev proxy, ensure build config |
| `frontend/orgadmin/vite.config.ts` | Remove dev proxy, update API_BASE to use /api prefix |
| `frontend/orgadmin/src/services/auth.ts` | Update API_BASE to use relative /api paths |
| `frontend/orgadmin/src/services/distributionCenters.ts` | Update API paths |
| `frontend/orgadmin/src/services/materialTypes.ts` | Update API paths |
| `frontend/distribution/vite.config.ts` | Remove dev proxy, ensure build config |
| `frontend/distadmin/vite.config.ts` | Remove dev proxy, ensure build config |

**Note**: Distribution and DistAdmin frontends already use `/api` prefix - minimal changes needed.

### Build System Files

| File | Changes |
|------|---------|
| `Makefile` | Update dev targets to build frontends first |

## New Files to Create

| File | Purpose |
|------|---------|
| `organization_backend/internal/api/spa_handler.go` | SPA file serving handler |
| `distribution_backend/internal/handlers/spa_handler.go` | SPA file serving handler |

## Implementation Order

1. **Create SPA handler** - Reusable handler for serving static files with SPA fallback
2. **Update config structs** - Add frontend configuration options
3. **Update config YAML files** - Add frontend paths and ports
4. **Update API routes** - Add /api prefix to all routes
5. **Update frontend API calls** - Adjust paths for /api prefix
6. **Update main.go files** - Add frontend serving servers
7. **Update Vite configs** - Remove dev proxy settings
8. **Update Makefile** - Build frontends before running backends
9. **Test complete setup** - Verify all frontends work correctly

## Questions Resolved

- ✅ Frontends served from separate `dist` directories (not embedded)
- ✅ No live reload required during development
- ✅ Main frontends on same port as API, admin frontends on separate ports
