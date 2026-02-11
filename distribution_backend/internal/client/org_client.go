package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

// OrgClient is a client for communicating with the organization backend
type OrgClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewOrgClient creates a new organization backend client
func NewOrgClient(baseURL, apiKey string) *OrgClient {
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	return &OrgClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetMaterialTypes fetches all material types from the organization backend
func (c *OrgClient) GetMaterialTypes(ctx context.Context) ([]MaterialType, error) {
	url := fmt.Sprintf("%s/material-types", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add API key header if configured (for future use)
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
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
