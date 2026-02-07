package domain

import "time"

// MaterialInstance represents a physical inventory item at a distribution center
type MaterialInstance struct {
	ID               string    `json:"id"`
	TypeID           string    `json:"typeId"`
	Status           string    `json:"status"`
	UseCount         int       `json:"useCount"`
	Location         string    `json:"location"`
	CurrentRequestID *string   `json:"currentRequestId"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// Status constants for MaterialInstance
const (
	StatusAvailable = "available"
	StatusRented    = "rented"
	StatusReturned  = "returned"
)

// CreateMaterialInstanceInput contains fields for creating a new material instance
type CreateMaterialInstanceInput struct {
	ID       string `json:"id"`
	TypeID   string `json:"typeId"`
	Location string `json:"location"`
}

// UpdateMaterialInstanceInput contains fields for updating a material instance
type UpdateMaterialInstanceInput struct {
	Status   string  `json:"status"`
	Location string  `json:"location"`
}
