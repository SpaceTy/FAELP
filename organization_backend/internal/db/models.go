package db

import (
	"encoding/json"
	"time"
)

type customerRow struct {
	ID            string
	Email         string
	Name          string
	Token         string
	WorkOSUserID  string
	EmailVerified bool
	CreatedAt     time.Time
}

type requestRow struct {
	ID                     string
	CustomerID             string
	DeliveryDate           time.Time
	Status                 string
	ShippingCustomerName   string
	ShippingAddressLine1   string
	ShippingAddressLine2   *string
	ShippingCity           string
	ShippingZipCode        string
	Metadata               json.RawMessage
	CreatedAt              time.Time
	UpdatedAt              time.Time
	CustomerEmail          string
	CustomerName           string
	CustomerToken          string
	CustomerWorkOSUserID   string
	CustomerEmailVerified  bool
	CustomerCreatedAt      time.Time
}

type requestItemRow struct {
	RequestID      string
	MaterialTypeID string
	Quantity       int
}
