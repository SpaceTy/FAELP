package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"time"
)

// MaterialAvailability represents available material counts from dist backend
type MaterialAvailability struct {
	MaterialTypeID string `json:"material_type_id"`
	Amount         int    `json:"amount"`
}

// DistClient is a client for communicating with the distribution backend
type DistClient struct {
	socketPath string
	httpClient *http.Client
}

// NewDistClient creates a new distribution backend client
func NewDistClient(socketPath string) *DistClient {
	client := &DistClient{
		socketPath: socketPath,
	}

	// Create Unix socket client if path provided
	if socketPath != "" {
		client.httpClient = &http.Client{
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

// GetAvailableMaterials fetches available material counts from the distribution backend
// Returns a map of material_type_id -> amount
func (c *DistClient) GetAvailableMaterials(ctx context.Context) (map[string]int, error) {
	if c.httpClient == nil {
		return nil, fmt.Errorf("distribution backend socket not configured")
	}

	// Use dummy URL for Unix socket - transport ignores it
	url := "http://unix/internal/available-materials"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch available materials: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("distribution backend returned status %d", resp.StatusCode)
	}

	var availabilities []MaterialAvailability
	if err := json.NewDecoder(resp.Body).Decode(&availabilities); err != nil {
		return nil, fmt.Errorf("failed to decode available materials: %w", err)
	}

	// Convert to map for easier lookup
	result := make(map[string]int)
	for _, avail := range availabilities {
		result[avail.MaterialTypeID] = avail.Amount
	}

	return result, nil
}
