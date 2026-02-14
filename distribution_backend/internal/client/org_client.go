package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"
)

// MaterialType represents a material type from the organization backend
type MaterialType struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	ImageURL       string `json:"imageUrl"`
	AvailableCount int    `json:"availableCount"`
}

// RequestItem represents a requested material item in organization backend.
type RequestItem struct {
	MaterialTypeID string `json:"materialTypeId"`
	Quantity       int    `json:"quantity"`
}

// Request represents a borrow request from organization backend.
type Request struct {
	ID                   string                 `json:"id"`
	CustomerID           string                 `json:"customerId"`
	DeliveryDate         time.Time              `json:"deliveryDate"`
	Status               string                 `json:"status"`
	ShippingCustomerName string                 `json:"shippingName"`
	ShippingAddressLine1 string                 `json:"addressLine1"`
	ShippingAddressLine2 string                 `json:"addressLine2"`
	ShippingCity         string                 `json:"city"`
	ShippingZipCode      string                 `json:"zipCode"`
	Metadata             map[string]interface{} `json:"metadata"`
	CreatedAt            time.Time              `json:"createdAt"`
	UpdatedAt            time.Time              `json:"updatedAt"`
	Items                []RequestItem          `json:"items"`
}

// OrgClient is a client for communicating with the organization backend
type OrgClient struct {
	baseURL    string
	apiKey     string
	socketPath string
	httpClient *http.Client
	unixClient *http.Client
}

// NewOrgClient creates a new organization backend client
func NewOrgClient(baseURL, apiKey, socketPath string) *OrgClient {
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	client := &OrgClient{
		baseURL:    baseURL,
		apiKey:     apiKey,
		socketPath: socketPath,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
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

// do executes an HTTP request, preferring Unix socket if available
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

// GetMaterialTypes fetches all material types from the organization backend
func (c *OrgClient) GetMaterialTypes(ctx context.Context) ([]MaterialType, error) {
	// Use dummy URL for Unix socket - transport ignores it
	url := "http://unix/api/material-types"
	if c.unixClient == nil {
		url = fmt.Sprintf("%s/api/material-types", c.baseURL)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch material types: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("organization backend returned status %d", resp.StatusCode)
	}

	var materialTypes []MaterialType
	if err := json.NewDecoder(resp.Body).Decode(&materialTypes); err != nil {
		return nil, fmt.Errorf("failed to decode material types: %w", err)
	}

	return materialTypes, nil
}

// UpdateAvailability sends current availability to organization backend
func (c *OrgClient) UpdateAvailability(ctx context.Context, distributionCenterID string, availability map[string]int) error {
	url := "http://unix/internal/availability"
	if c.unixClient == nil {
		url = fmt.Sprintf("%s/internal/availability", c.baseURL)
	}

	body := map[string]interface{}{
		"distributionCenterId": distributionCenterID,
		"availability":         availability,
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.do(req)
	if err != nil {
		return fmt.Errorf("failed to update availability: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("organization backend returned status %d", resp.StatusCode)
	}

	return nil
}

// GetRequests fetches requests from organization backend, optionally filtered by status.
func (c *OrgClient) GetRequests(ctx context.Context, status string) ([]Request, error) {
	endpoint := "http://unix/internal/requests"
	if c.unixClient == nil {
		endpoint = fmt.Sprintf("%s/internal/requests", c.baseURL)
	}
	if status != "" {
		endpoint = fmt.Sprintf("%s?status=%s", endpoint, url.QueryEscape(status))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch requests: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("organization backend returned status %d", resp.StatusCode)
	}

	var requests []Request
	if err := json.NewDecoder(resp.Body).Decode(&requests); err != nil {
		return nil, fmt.Errorf("failed to decode requests: %w", err)
	}

	return requests, nil
}
