package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
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
	ID                           string                 `json:"id"`
	CustomerID                   string                 `json:"customerId"`
	DeliveryDate                 time.Time              `json:"deliveryDate"`
	Status                       string                 `json:"status"`
	ApprovedDistributionCenterID *string                `json:"approvedDistributionCenterId,omitempty"`
	ShippingCustomerName         string                 `json:"shippingName"`
	ShippingAddressLine1         string                 `json:"addressLine1"`
	ShippingAddressLine2         string                 `json:"addressLine2"`
	ShippingCity                 string                 `json:"city"`
	ShippingZipCode              string                 `json:"zipCode"`
	Metadata                     map[string]interface{} `json:"metadata"`
	CreatedAt                    time.Time              `json:"createdAt"`
	UpdatedAt                    time.Time              `json:"updatedAt"`
	Items                        []RequestItem          `json:"items"`
}

// DistributionCenter represents a distribution center in organization backend.
type DistributionCenter struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Address    string `json:"address"`
	SocketPath string `json:"socketPath,omitempty"`
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
func (c *OrgClient) GetRequests(ctx context.Context, status, distributionCenterID string) ([]Request, error) {
	endpoint := "http://unix/internal/requests"
	if c.unixClient == nil {
		endpoint = fmt.Sprintf("%s/internal/requests", c.baseURL)
	}
	params := url.Values{}
	if status != "" {
		params.Set("status", status)
	}
	if distributionCenterID != "" {
		params.Set("distributionCenterId", distributionCenterID)
	}
	if params.Encode() != "" {
		endpoint = fmt.Sprintf("%s?%s", endpoint, params.Encode())
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

// ApproveRequest updates a request in organization backend as approved by a distribution center.
func (c *OrgClient) ApproveRequest(ctx context.Context, requestID, distributionCenterID string) (Request, error) {
	endpoint := fmt.Sprintf("http://unix/internal/requests/%s/approve", url.PathEscape(requestID))
	if c.unixClient == nil {
		endpoint = fmt.Sprintf("%s/internal/requests/%s/approve", c.baseURL, url.PathEscape(requestID))
	}

	body := map[string]string{
		"distributionCenterId": distributionCenterID,
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return Request{}, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return Request{}, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.do(req)
	if err != nil {
		return Request{}, fmt.Errorf("failed to approve request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Request{}, fmt.Errorf("organization backend returned status %d", resp.StatusCode)
	}

	var request Request
	if err := json.NewDecoder(resp.Body).Decode(&request); err != nil {
		return Request{}, fmt.Errorf("failed to decode approved request: %w", err)
	}

	return request, nil
}

// RegisterDistBackend registers this distribution backend in organization backend and returns the center.
func (c *OrgClient) RegisterDistBackend(ctx context.Context, name, address, socketPath string) (DistributionCenter, error) {
	endpoint := "http://unix/internal/register-dist-backend"
	if c.unixClient == nil {
		endpoint = fmt.Sprintf("%s/internal/register-dist-backend", c.baseURL)
	}

	body := map[string]string{
		"name":       name,
		"address":    address,
		"socketPath": socketPath,
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return DistributionCenter{}, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return DistributionCenter{}, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.do(req)
	if err != nil {
		return DistributionCenter{}, fmt.Errorf("failed to register dist backend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return DistributionCenter{}, fmt.Errorf("organization backend returned status %d", resp.StatusCode)
	}

	var center DistributionCenter
	if err := json.NewDecoder(resp.Body).Decode(&center); err != nil {
		return DistributionCenter{}, fmt.Errorf("failed to decode distribution center: %w", err)
	}

	return center, nil
}

// GetAsset downloads a static asset from organization backend.
// assetPath can be an absolute URL or a path like /uploads/material-types/foo.webp.
func (c *OrgClient) GetAsset(ctx context.Context, assetPath string) ([]byte, error) {
	endpoint := assetPath
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		if strings.TrimSpace(endpoint) == "" || !strings.HasPrefix(endpoint, "/") {
			return nil, fmt.Errorf("invalid asset path")
		}
		if c.unixClient != nil {
			endpoint = "http://unix" + endpoint
		} else {
			endpoint = fmt.Sprintf("%s%s", c.baseURL, endpoint)
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch asset: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("organization backend returned status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read asset body: %w", err)
	}
	return data, nil
}
