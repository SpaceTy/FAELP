package domain

import "time"

type ShippingAddress struct {
	Line1   string `json:"line1"`
	Line2   string `json:"line2,omitempty"`
	City    string `json:"city"`
	ZipCode string `json:"zipCode"`
}

type Request struct {
	ID                   string          `json:"id"`
	Customer             Customer        `json:"customer"`
	Items                map[string]int  `json:"items"`
	DeliveryDate         time.Time       `json:"deliveryDate"`
	Status               string          `json:"status"`
	ShippingCustomerName string          `json:"shippingCustomerName"`
	ShippingAddress      ShippingAddress `json:"shippingAddress"`
	CreatedAt            time.Time       `json:"createdAt"`
	UpdatedAt            time.Time       `json:"updatedAt"`
	Metadata             map[string]any  `json:"metadata,omitempty"`
}
