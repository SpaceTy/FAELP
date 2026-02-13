package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"organization_backend/internal/db"
	"organization_backend/internal/domain"
)

type RequestHandler struct {
	Store *db.Store
}

type createRequestRequest struct {
	DeliveryDate         string `json:"deliveryDate"`
	ShippingCustomerName string `json:"shippingName"`
	ShippingAddressLine1 string `json:"addressLine1"`
	ShippingAddressLine2 string `json:"addressLine2"`
	ShippingCity         string `json:"city"`
	ShippingZipCode      string `json:"zipCode"`
	Note                 string `json:"note"`
	Items                []struct {
		MaterialTypeID string `json:"materialTypeId"`
		Quantity       int    `json:"quantity"`
	} `json:"items"`
}

func (h *RequestHandler) CreateRequest(w http.ResponseWriter, r *http.Request) {
	claims := GetClaimsFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req createRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	if strings.TrimSpace(req.ShippingCustomerName) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Shipping name is required")
		return
	}
	if strings.TrimSpace(req.ShippingAddressLine1) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Address is required")
		return
	}
	if strings.TrimSpace(req.ShippingCity) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "City is required")
		return
	}
	if strings.TrimSpace(req.ShippingZipCode) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Zip code is required")
		return
	}
	if req.DeliveryDate == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Delivery date is required")
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "At least one item is required")
		return
	}

	deliveryDate, err := time.Parse("2006-01-02", req.DeliveryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", "Invalid delivery date format (use YYYY-MM-DD)")
		return
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if deliveryDate.Before(today) {
		writeError(w, http.StatusBadRequest, "validation_error", "Delivery date must be in the future")
		return
	}

	items := make([]domain.RequestItem, len(req.Items))
	for i, item := range req.Items {
		if strings.TrimSpace(item.MaterialTypeID) == "" {
			writeError(w, http.StatusBadRequest, "validation_error", "Material type ID is required for all items")
			return
		}
		if item.Quantity <= 0 {
			writeError(w, http.StatusBadRequest, "validation_error", "Quantity must be greater than 0 for all items")
			return
		}
		items[i] = domain.RequestItem{
			MaterialTypeID: strings.TrimSpace(item.MaterialTypeID),
			Quantity:       item.Quantity,
		}
	}

	input := domain.CreateRequestInput{
		CustomerID:           claims.CustomerID,
		DeliveryDate:         deliveryDate,
		ShippingCustomerName: strings.TrimSpace(req.ShippingCustomerName),
		ShippingAddressLine1: strings.TrimSpace(req.ShippingAddressLine1),
		ShippingAddressLine2: strings.TrimSpace(req.ShippingAddressLine2),
		ShippingCity:         strings.TrimSpace(req.ShippingCity),
		ShippingZipCode:      strings.TrimSpace(req.ShippingZipCode),
		Note:                 strings.TrimSpace(req.Note),
		Items:                items,
	}

	created, err := h.Store.CreateRequest(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to create request")
		return
	}

	writeJSON(w, http.StatusCreated, created)
}
