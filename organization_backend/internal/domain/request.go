package domain

import "time"

type Request struct {
	ID                           string         `json:"id"`
	CustomerID                   string         `json:"customerId"`
	DeliveryDate                 time.Time      `json:"deliveryDate"`
	PlannedReturnDate            *time.Time     `json:"plannedReturnDate,omitempty"`
	IntendedStudents             int            `json:"intendedStudents"`
	Status                       string         `json:"status"`
	Archived                     bool           `json:"archived"`
	ApprovedDistributionCenterID *string        `json:"approvedDistributionCenterId,omitempty"`
	OutgoingTrackingCode         *string        `json:"outgoingTrackingCode,omitempty"`
	ShippingCustomerName         string         `json:"shippingName"`
	ShippingAddressLine1         string         `json:"addressLine1"`
	ShippingAddressLine2         string         `json:"addressLine2"`
	ShippingCity                 string         `json:"city"`
	ShippingZipCode              string         `json:"zipCode"`
	Metadata                     map[string]any `json:"metadata"`
	CreatedAt                    time.Time      `json:"createdAt"`
	UpdatedAt                    time.Time      `json:"updatedAt"`
	Items                        []RequestItem  `json:"items"`
}

type RequestItem struct {
	MaterialTypeID string `json:"materialTypeId"`
	Quantity       int    `json:"quantity"`
}

type CreateRequestInput struct {
	CustomerID           string
	DeliveryDate         time.Time
	PlannedReturnDate    time.Time
	IntendedStudents     int
	ShippingCustomerName string
	ShippingAddressLine1 string
	ShippingAddressLine2 string
	ShippingCity         string
	ShippingZipCode      string
	Note                 string
	Items                []RequestItem
}
