package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"organization_backend/internal/db"
	"organization_backend/internal/domain"
)

type RequestService struct {
	store *db.Store
}

func NewRequestService(store *db.Store) *RequestService {
	return &RequestService{store: store}
}

type CreateRequestPayload struct {
	CustomerID           string         `json:"customerId"`
	CustomerEmail        string         `json:"customerEmail"`
	CustomerName         string         `json:"customerName"`
	CustomerToken        string         `json:"customerToken"`
	DeliveryDate         time.Time      `json:"deliveryDate"`
	Status               string         `json:"status"`
	ShippingCustomerName string         `json:"shippingCustomerName"`
	ShippingAddress      AddressPayload `json:"shippingAddress"`
	Items                map[string]int `json:"items"`
	Metadata             map[string]any `json:"metadata"`
}

type AddressPayload struct {
	Line1   string `json:"line1"`
	Line2   string `json:"line2"`
	City    string `json:"city"`
	ZipCode string `json:"zipCode"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationErrors struct {
	Errors []ValidationError `json:"errors"`
}

func (v ValidationErrors) Error() string {
	return "validation failed"
}

func (s *RequestService) CreateRequest(ctx context.Context, payload CreateRequestPayload) (domain.Request, error) {
	validation := validateCreate(payload)
	if len(validation) > 0 {
		return domain.Request{}, ValidationErrors{Errors: validation}
	}

	status := payload.Status
	if status == "" {
		status = "pending"
	}

	return s.store.CreateRequest(ctx, db.CreateRequestInput{
		CustomerID:           payload.CustomerID,
		CustomerEmail:        payload.CustomerEmail,
		CustomerName:         payload.CustomerName,
		CustomerToken:        payload.CustomerToken,
		DeliveryDate:         payload.DeliveryDate,
		Status:               status,
		ShippingCustomerName: payload.ShippingCustomerName,
		ShippingAddressLine1: payload.ShippingAddress.Line1,
		ShippingAddressLine2: payload.ShippingAddress.Line2,
		ShippingCity:         payload.ShippingAddress.City,
		ShippingZipCode:      payload.ShippingAddress.ZipCode,
		Items:                payload.Items,
		Metadata:             payload.Metadata,
	})
}

func (s *RequestService) GetRequestByID(ctx context.Context, id string) (domain.Request, error) {
	if strings.TrimSpace(id) == "" {
		return domain.Request{}, errors.New("id required")
	}
	return s.store.GetRequestByID(ctx, id)
}

func (s *RequestService) ListRequests(ctx context.Context, params db.ListRequestsParams) (db.ListRequestsResult, error) {
	return s.store.ListRequests(ctx, params)
}

func validateCreate(payload CreateRequestPayload) []ValidationError {
	var errorsOut []ValidationError
	if payload.Status != "" {
		switch payload.Status {
		case "pending", "inAction", "returned":
		default:
			errorsOut = append(errorsOut, ValidationError{Field: "status", Message: "invalid status"})
		}
	}
	if payload.CustomerID == "" && payload.CustomerEmail == "" {
		errorsOut = append(errorsOut, ValidationError{Field: "customerEmail", Message: "required when customerId missing"})
	}
	if payload.CustomerName == "" && payload.CustomerID == "" {
		errorsOut = append(errorsOut, ValidationError{Field: "customerName", Message: "required when customerId missing"})
	}
	if payload.ShippingCustomerName == "" {
		errorsOut = append(errorsOut, ValidationError{Field: "shippingCustomerName", Message: "required"})
	}
	if payload.ShippingAddress.Line1 == "" {
		errorsOut = append(errorsOut, ValidationError{Field: "shippingAddress.line1", Message: "required"})
	}
	if payload.ShippingAddress.City == "" {
		errorsOut = append(errorsOut, ValidationError{Field: "shippingAddress.city", Message: "required"})
	}
	if payload.ShippingAddress.ZipCode == "" {
		errorsOut = append(errorsOut, ValidationError{Field: "shippingAddress.zipCode", Message: "required"})
	}
	if payload.DeliveryDate.IsZero() {
		errorsOut = append(errorsOut, ValidationError{Field: "deliveryDate", Message: "required"})
	}
	if len(payload.Items) == 0 {
		errorsOut = append(errorsOut, ValidationError{Field: "items", Message: "at least one item required"})
	}
	for materialID, qty := range payload.Items {
		if strings.TrimSpace(materialID) == "" {
			errorsOut = append(errorsOut, ValidationError{Field: "items", Message: "materialTypeId required"})
			break
		}
		if qty <= 0 {
			errorsOut = append(errorsOut, ValidationError{Field: "items", Message: "quantity must be positive"})
			break
		}
	}
	return errorsOut
}
