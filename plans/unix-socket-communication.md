# Unix Socket Inter-Backend Communication

## Overview

This plan describes implementing Unix domain socket-based communication between the organization backend and distribution backend(s) when running on the same server. This approach provides secure, zero-config authentication for inter-service communication without requiring API keys when the backends are co-located and in development.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Server (VPS/Dev Machine)                │
│                                                                 │
│  ┌─────────────────────┐         ┌─────────────────────┐       │
│  │  Organization       │         │  Distribution       │       │
│  │  Backend            │◄───────►│  Backend            │       │
│  │                     │  Unix   │                     │       │
│  │  /tmp/org.sock      │  Socket │  /tmp/dist.sock     │       │
│  └──────────┬──────────┘         └──────────┬──────────┘       │
│             │                               │                   │
│             │ TCP :8080                     │ TCP :8081         │
│             ▼                               ▼                   │
│        Public API                      Public API               │
│        (JWT auth)                      (JWT auth)               │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

| Request Source | Authentication | Trust Level |
|----------------|----------------|-------------|
| Unix socket | None (file permissions) | Full internal trust |
| TCP port | JWT token | User-level permissions |
| TCP port + API key | API key header | Service-level permissions (fallback for multi-server) |

## Implementation Steps

### Phase 1: Configuration Updates

#### 1.1 Organization Backend Config

Update `organization_backend/config.yaml`:

```yaml
# Existing config
DATABASE_URL: "postgresql://..."
JWT_SECRET: "..."

# New internal communication config
internal:
  # Unix socket path for inter-service communication
  socket_path: "/tmp/org-backend.sock"
  # Enable/disable Unix socket listener
  socket_enabled: true
```

#### 1.2 Distribution Backend Config

Update `distribution_backend/config.yaml`:

```yaml
# Existing config
DATABASE_URL: "postgresql://..."
JWT_SECRET: "..."

# Organization backend connection
organization_backend:
  # TCP URL (fallback for multi-server)
  url: "http://localhost:8080"
  # Unix socket path (preferred when on same server)
  socket_path: "/tmp/org-backend.sock"
  # API key (fallback for multi-server)
  api_key: ""

# Internal socket for receiving requests
internal:
  socket_path: "/tmp/dist-backend.sock"
  socket_enabled: true
```

### Phase 2: Config Struct Updates

#### 2.1 Organization Backend

Update `organization_backend/internal/config/config.go`:

```go
type Config struct {
    DatabaseURL    string `yaml:"DATABASE_URL"`
    JWTSecret      string `yaml:"JWT_SECRET"`
    WorkOSAPIKey   string
    WorkOSClientID string
    
    // New internal communication config
    Internal       InternalConfig `yaml:"internal"`
}

type InternalConfig struct {
    SocketPath    string `yaml:"socket_path"`
    SocketEnabled bool   `yaml:"socket_enabled"`
}
```

#### 2.2 Distribution Backend

Update `distribution_backend/internal/config/config.go`:

```go
type Config struct {
    DatabaseURL string `yaml:"DATABASE_URL"`
    JWTSecret   string `yaml:"JWT_SECRET"`
    Admin       AdminConfig `yaml:"admin"`
    
    // Organization backend connection
    OrgBackend   OrgBackendConfig `yaml:"organization_backend"`
    
    // Internal socket for receiving
    Internal     InternalConfig `yaml:"internal"`
}

type OrgBackendConfig struct {
    URL       string `yaml:"url"`
    SocketPath string `yaml:"socket_path"`
    APIKey    string `yaml:"api_key"`
}

type InternalConfig struct {
    SocketPath    string `yaml:"socket_path"`
    SocketEnabled bool   `yaml:"socket_enabled"`
}
```

### Phase 3: Unix Socket Server

#### 3.1 Create Shared Socket Listener Package

Create `organization_backend/internal/socket/listener.go`:

```go
package socket

import (
    "net"
    "os"
)

// Listen creates a Unix domain socket listener
func Listen(socketPath string) (net.Listener, error) {
    // Remove existing socket file (stale from previous run)
    os.Remove(socketPath)
    
    // Create directory if needed
    dir := filepath.Dir(socketPath)
    if err := os.MkdirAll(dir, 0755); err != nil {
        return nil, err
    }
    
    // Create listener
    listener, err := net.Listen("unix", socketPath)
    if err != nil {
        return nil, err
    }
    
    // Set permissions - owner read/write only
    if err := os.Chmod(socketPath, 0600); err != nil {
        listener.Close()
        return nil, err
    }
    
    return listener, nil
}
```

#### 3.2 Update Server Main

Update `organization_backend/cmd/server/main.go`:

```go
func main() {
    // ... existing setup ...
    
    router := api.Routes(handler, authHandler, materialTypeHandler, uploadHandler, cfg.JWTSecret)
    server := &http.Server{Handler: router}
    
    // Start TCP listener (public)
    go func() {
        log.Printf("Organization backend listening on :8080 (TCP)")
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("TCP server error: %v", err)
        }
    }()
    
    // Start Unix socket listener (internal) if enabled
    if cfg.Internal.SocketEnabled && cfg.Internal.SocketPath != "" {
        go func() {
            listener, err := socket.Listen(cfg.Internal.SocketPath)
            if err != nil {
                log.Printf("Failed to create Unix socket: %v", err)
                return
            }
            defer listener.Close()
            
            log.Printf("Internal communication on %s (Unix socket)", cfg.Internal.SocketPath)
            if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
                log.Printf("Unix socket server error: %v", err)
            }
        }()
    }
    
    // ... graceful shutdown ...
}
```

### Phase 4: Unix Socket Client

#### 4.1 Create Unix Socket HTTP Client

Update `distribution_backend/internal/client/org_client.go`:

```go
package client

import (
    "context"
    "net"
    "net/http"
    "time"
)

type OrgClient struct {
    baseURL     string
    apiKey      string
    socketPath  string
    
    httpClient  *http.Client
    unixClient  *http.Client
}

func NewOrgClient(baseURL, apiKey, socketPath string) *OrgClient {
    client := &OrgClient{
        baseURL:    baseURL,
        apiKey:     apiKey,
        socketPath: socketPath,
        httpClient: &http.Client{Timeout: 10 * time.Second},
    }
    
    // Create Unix socket client if path provided
    if socketPath != "" {
        client.unixClient = &http.Client{
            Timeout: 10 * time.Second,
            Transport: &http.Transport{
                DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
                    return net.Dial("unix", socketPath)
                },
            },
        }
    }
    
    return client
}

func (c *OrgClient) do(req *http.Request) (*http.Response, error) {
    // Prefer Unix socket if available
    if c.unixClient != nil {
        return c.unixClient.Do(req)
    }
    
    // Fallback to TCP with API key
    if c.apiKey != "" {
        req.Header.Set("X-API-Key", c.apiKey)
    }
    return c.httpClient.Do(req)
}

func (c *OrgClient) GetMaterialTypes(ctx context.Context) ([]MaterialType, error) {
    // Use dummy URL for Unix socket - transport ignores it
    url := "http://unix/material-types"
    if c.unixClient == nil {
        url = c.baseURL + "/material-types"
    }
    
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := c.do(req)
    // ... rest of implementation
}
```

### Phase 5: Authentication Middleware Update

#### 5.1 Detect Unix Socket Requests

Update `organization_backend/internal/api/auth_middleware.go`:

```go
import (
    "strings"
)

// isUnixSocketRequest checks if the request came via Unix socket
func isUnixSocketRequest(r *http.Request) bool {
    // Unix socket connections have special RemoteAddr formats:
    // - Empty string
    // - Starts with "@" (abstract socket on Linux)
    // - Starts with "/" (filesystem socket path)
    remoteAddr := r.RemoteAddr
    return remoteAddr == "" ||
           strings.HasPrefix(remoteAddr, "@") ||
           strings.HasPrefix(remoteAddr, "/")
}

// InternalMiddleware marks requests from Unix sockets as internal
func InternalMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if isUnixSocketRequest(r) {
                // Mark as internal request - skip auth
                ctx := context.WithValue(r.Context(), internalContextKey, true)
                next.ServeHTTP(w, r.WithContext(ctx))
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

#### 5.2 Update Auth Middleware

```go
func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Skip auth for internal Unix socket requests
            if isUnixSocketRequest(r) {
                ctx := context.WithValue(r.Context(), internalContextKey, true)
                next.ServeHTTP(w, r.WithContext(ctx))
                return
            }
            
            // Standard JWT auth for external requests
            token := extractToken(r)
            if token == "" {
                writeError(w, http.StatusUnauthorized, "missing_auth", "Authorization required")
                return
            }
            
            claims, err := auth.ParseToken(token, jwtSecret)
            if err != nil {
                writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired token")
                return
            }
            
            ctx := context.WithValue(r.Context(), claimsContextKey, claims)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

### Phase 6: Routes Update

Update `organization_backend/internal/api/routes.go`:

```go
func Routes(handler *Handler, authHandler *AuthHandler, materialTypeHandler *MaterialTypeHandler, uploadHandler *UploadHandler, jwtSecret string) http.Handler {
    r := chi.NewRouter()
    
    // Middleware chain
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(cors.Handler(cors.Options{
        AllowedOrigins:   []string{"*"},
        AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
    }))
    
    // Internal middleware to detect Unix socket requests
    r.Use(InternalMiddleware())
    
    // ... rest of routes ...
    
    return r
}
```

### Phase 7: Makefile Updates

Add to root `Makefile`:

```makefile
# =============================================================================
# Socket Cleanup
# =============================================================================

clean-sockets:
	@echo "Cleaning up Unix sockets..."
	rm -f /tmp/org-backend.sock /tmp/dist-backend.sock

# Add to clean-all
clean-all: clean-org clean-dist clean-sockets
```

### Phase 8: Docker Configuration

#### 8.1 Development Docker Compose

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  org-backend:
    build: ./organization_backend
    volumes:
      - socket-volume:/var/run
    environment:
      - INTERNAL_SOCKET_PATH=/var/run/org-backend.sock
      - INTERNAL_SOCKET_ENABLED=true
    ports:
      - "8080:8080"

  dist-backend:
    build: ./distribution_backend
    volumes:
      - socket-volume:/var/run
    environment:
      - ORG_BACKEND_SOCKET_PATH=/var/run/org-backend.sock
      - INTERNAL_SOCKET_PATH=/var/run/dist-backend.sock
      - INTERNAL_SOCKET_ENABLED=true
    ports:
      - "8081:8081"
    depends_on:
      - org-backend

volumes:
  socket-volume:
```

#### 8.2 Production Docker Compose (to be done in the future, do not implement yet)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  org-backend:
    build: ./organization_backend
    user: "1000:1000"  # Run as non-root
    volumes:
      - socket-volume:/var/run
    environment:
      - INTERNAL_SOCKET_PATH=/var/run/org-backend.sock
      - INTERNAL_SOCKET_ENABLED=true
    ports:
      - "8080:8080"
    restart: unless-stopped

  dist-backend:
    build: ./distribution_backend
    user: "1000:1000"  # Same UID for socket access
    volumes:
      - socket-volume:/var/run
    environment:
      - ORG_BACKEND_SOCKET_PATH=/var/run/org-backend.sock
      - INTERNAL_SOCKET_PATH=/var/run/dist-backend.sock
      - INTERNAL_SOCKET_ENABLED=true
    ports:
      - "8081:8081"
    depends_on:
      - org-backend
    restart: unless-stopped

volumes:
  socket-volume:
```

## Testing Plan

### Unit Tests

1. Test `isUnixSocketRequest()` with various RemoteAddr values
2. Test socket creation and cleanup
3. Test client fallback from Unix to TCP

### Integration Tests

1. Start org-backend with Unix socket enabled
2. Start dist-backend configured to use Unix socket
3. Verify dist-backend can call org-backend endpoints without auth
4. Verify external requests still require JWT auth

### Manual Testing

```bash
# Terminal 1: Start org-backend
cd organization_backend && go run ./cmd/server

# Terminal 2: Start dist-backend  
cd distribution_backend && go run ./cmd/server

# Terminal 3: Test external auth (should fail without JWT)
curl http://localhost:8080/material-types
# Expected: 401 Unauthorized

# Terminal 4: Test internal communication (should work)
# Use socat or nc to test Unix socket
socat - UNIX-CONNECT:/tmp/org-backend.sock
GET /material-types HTTP/1.1
Host: localhost

# Expected: 200 OK with material types
```

## Rollback Plan

If issues arise:

1. Set `socket_enabled: false` in config
2. Set `socket_path: ""` in config
3. Services will fall back to TCP communication
4. API keys can be used for multi-server auth

## Future Considerations

1. **Multi-server deployment**: When distribution backends run on separate servers, they will use TCP + API keys (already supported as fallback)

2. **Multiple distribution backends**: Each dist-backend needs its own socket path for receiving requests from org-backend

3. **Monitoring**: Add metrics for Unix socket vs TCP connections

4. **Health checks**: Unix socket endpoint for internal health checks

## Files to Create/Modify

### New Files
- `organization_backend/internal/socket/listener.go`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`

### Modified Files
- `organization_backend/internal/config/config.go`
- `organization_backend/internal/api/auth_middleware.go`
- `organization_backend/internal/api/routes.go`
- `organization_backend/cmd/server/main.go`
- `distribution_backend/internal/config/config.go`
- `distribution_backend/internal/client/org_client.go`
- `distribution_backend/cmd/server/main.go`
- `Makefile`
