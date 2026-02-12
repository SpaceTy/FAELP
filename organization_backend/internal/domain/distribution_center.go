package domain

import "time"

// DistributionCenter represents a distribution center
type DistributionCenter struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Address    string    `json:"address"`
	SocketPath string    `json:"socketPath,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

// CreateDistributionCenterInput contains fields for creating a new distribution center
type CreateDistributionCenterInput struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

// UpdateDistributionCenterInput contains fields for updating a distribution center
type UpdateDistributionCenterInput struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

// RegisterDistBackendInput contains fields for auto-registering a co-located backend
type RegisterDistBackendInput struct {
	Name       string `json:"name"`
	Address    string `json:"address"`
	SocketPath string `json:"socketPath"`
}
