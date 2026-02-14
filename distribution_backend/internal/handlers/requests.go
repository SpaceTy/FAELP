package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"distribution_backend/internal/client"
	"distribution_backend/internal/db"
	"distribution_backend/internal/shippinglabel"
)

// RequestsHandler handles incoming request endpoints.
type RequestsHandler struct {
	orgClient            *client.OrgClient
	store                *db.Store
	distributionCenterID string
	uploadPath           string
}

// NewRequestsHandler creates a new requests handler.
func NewRequestsHandler(store *db.Store, orgClient *client.OrgClient, distributionCenterID, uploadPath string) *RequestsHandler {
	if strings.TrimSpace(uploadPath) == "" {
		uploadPath = "uploads"
	}
	return &RequestsHandler{
		orgClient:            orgClient,
		store:                store,
		distributionCenterID: distributionCenterID,
		uploadPath:           uploadPath,
	}
}

type incomingRequestItem struct {
	MaterialTypeID    string `json:"materialTypeId"`
	MaterialName      string `json:"materialName"`
	MaterialImageURL  string `json:"materialImageUrl"`
	Quantity          int    `json:"quantity"`
	AvailableQuantity int    `json:"availableQuantity"`
	ShortageQuantity  int    `json:"shortageQuantity"`
	IsFulfillable     bool   `json:"isFulfillable"`
}

type incomingRequest struct {
	ID                   string                `json:"id"`
	CustomerID           string                `json:"customerId"`
	DeliveryDate         string                `json:"deliveryDate"`
	Status               string                `json:"status"`
	ShippingCustomerName string                `json:"shippingName"`
	ShippingAddressLine1 string                `json:"addressLine1"`
	ShippingAddressLine2 string                `json:"addressLine2"`
	ShippingCity         string                `json:"city"`
	ShippingZipCode      string                `json:"zipCode"`
	Note                 string                `json:"note"`
	CreatedAt            string                `json:"createdAt"`
	UpdatedAt            string                `json:"updatedAt"`
	IsFulfillable        bool                  `json:"isFulfillable"`
	Items                []incomingRequestItem `json:"items"`
}

// ListIncomingRequests returns incoming requests from organization backend.
// Requires employee authentication via dist backend auth middleware.
func (h *RequestsHandler) ListIncomingRequests(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if h.store == nil {
		http.Error(w, `{"error":"inventory store not configured"}`, http.StatusServiceUnavailable)
		return
	}

	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "pending"
	}
	if !isValidRequestStatus(status) {
		http.Error(w, `{"error":"invalid status"}`, http.StatusBadRequest)
		return
	}

	requests, err := h.orgClient.GetRequests(r.Context(), status, h.distributionCenterID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch requests from organization backend"}`, http.StatusBadGateway)
		return
	}

	availabilities, err := h.store.GetAvailableCountsByType(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch local availability"}`, http.StatusInternalServerError)
		return
	}
	availableByType := make(map[string]int, len(availabilities))
	for _, availability := range availabilities {
		availableByType[availability.MaterialTypeID] = availability.Amount
	}

	typeNameByID := map[string]string{}
	typeImageURLByID := map[string]string{}
	if materialTypes, err := h.orgClient.GetMaterialTypes(r.Context()); err == nil {
		typeImageURLByID = h.syncMaterialTypeImages(r.Context(), materialTypes)
		for _, mt := range materialTypes {
			typeNameByID[mt.ID] = mt.Name
		}
	}

	resp := make([]incomingRequest, 0, len(requests))
	for _, req := range requests {
		items := make([]incomingRequestItem, len(req.Items))
		isFulfillable := true
		for i, item := range req.Items {
			availableQuantity := availableByType[item.MaterialTypeID]
			shortageQuantity := item.Quantity - availableQuantity
			if shortageQuantity < 0 {
				shortageQuantity = 0
			}
			itemFulfillable := availableQuantity >= item.Quantity
			if !itemFulfillable {
				isFulfillable = false
			}
			materialName := typeNameByID[item.MaterialTypeID]
			if strings.TrimSpace(materialName) == "" {
				materialName = item.MaterialTypeID
			}

			items[i] = incomingRequestItem{
				MaterialTypeID:    item.MaterialTypeID,
				MaterialName:      materialName,
				MaterialImageURL:  typeImageURLByID[item.MaterialTypeID],
				Quantity:          item.Quantity,
				AvailableQuantity: availableQuantity,
				ShortageQuantity:  shortageQuantity,
				IsFulfillable:     itemFulfillable,
			}
		}

		note := ""
		if rawNote, ok := req.Metadata["note"].(string); ok {
			note = strings.TrimSpace(rawNote)
		}

		resp = append(resp, incomingRequest{
			ID:                   req.ID,
			CustomerID:           req.CustomerID,
			DeliveryDate:         req.DeliveryDate.Format("2006-01-02"),
			Status:               req.Status,
			ShippingCustomerName: req.ShippingCustomerName,
			ShippingAddressLine1: req.ShippingAddressLine1,
			ShippingAddressLine2: req.ShippingAddressLine2,
			ShippingCity:         req.ShippingCity,
			ShippingZipCode:      req.ShippingZipCode,
			Note:                 note,
			CreatedAt:            req.CreatedAt.Format(time.RFC3339),
			UpdatedAt:            req.UpdatedAt.Format(time.RFC3339),
			IsFulfillable:        isFulfillable,
			Items:                items,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func isValidRequestStatus(status string) bool {
	switch status {
	case "pending", "approved", "inAction", "returned":
		return true
	default:
		return false
	}
}

// ApproveIncomingRequest approves a request in organization backend and binds it to this distribution center.
func (h *RequestsHandler) ApproveIncomingRequest(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if strings.TrimSpace(h.distributionCenterID) == "" {
		http.Error(w, `{"error":"distribution center id not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	approved, err := h.orgClient.ApproveRequest(r.Context(), requestID, h.distributionCenterID)
	if err != nil {
		http.Error(w, `{"error":"failed to approve request"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(approved)
}

var errRequestNotFound = errors.New("request not found")

// GenerateShippingLabel returns a 4x6 shipping label PDF for a request.
func (h *RequestsHandler) GenerateShippingLabel(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	req, err := h.findRequestByID(r.Context(), requestID)
	if err != nil {
		if errors.Is(err, errRequestNotFound) {
			http.Error(w, `{"error":"request not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to fetch request"}`, http.StatusBadGateway)
		return
	}

	label, err := shippinglabel.Generate4x6PDF(shippinglabel.Data{
		RequestID:      req.ID,
		ShipToName:     req.ShippingCustomerName,
		AddressLine1:   req.ShippingAddressLine1,
		AddressLine2:   req.ShippingAddressLine2,
		City:           req.ShippingCity,
		ZipCode:        req.ShippingZipCode,
		DeliveryDate:   req.DeliveryDate.Format("2006-01-02"),
		GeneratedAtUTC: time.Now().UTC(),
	})
	if err != nil {
		http.Error(w, `{"error":"failed to generate shipping label"}`, http.StatusInternalServerError)
		return
	}

	filename := fmt.Sprintf("shipping-label-%s.pdf", sanitizeMaterialTypeID(req.ID))
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(label)))
	_, _ = w.Write(label)
}

func (h *RequestsHandler) findRequestByID(ctx context.Context, requestID string) (client.Request, error) {
	statuses := []string{"approved", "inAction", "pending", "returned"}
	var lastErr error
	for _, status := range statuses {
		requests, err := h.orgClient.GetRequests(ctx, status, h.distributionCenterID)
		if err != nil {
			lastErr = err
			continue
		}
		for _, req := range requests {
			if req.ID == requestID {
				return req, nil
			}
		}
	}
	if lastErr != nil {
		return client.Request{}, lastErr
	}
	return client.Request{}, errRequestNotFound
}

var materialTypeIDSanitizer = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

func sanitizeMaterialTypeID(input string) string {
	s := materialTypeIDSanitizer.ReplaceAllString(strings.TrimSpace(input), "_")
	if s == "" {
		return "unknown"
	}
	return s
}

func imageExtensionFromURL(raw string) string {
	base := raw
	if idx := strings.Index(base, "?"); idx >= 0 {
		base = base[:idx]
	}
	ext := strings.ToLower(filepath.Ext(base))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return ext
	default:
		return ".webp"
	}
}

func (h *RequestsHandler) syncMaterialTypeImages(ctx context.Context, materialTypes []client.MaterialType) map[string]string {
	result := map[string]string{}

	baseDir := filepath.Join(h.uploadPath, "material-types")
	_ = os.MkdirAll(baseDir, 0755)

	for _, mt := range materialTypes {
		if strings.TrimSpace(mt.ImageURL) == "" {
			continue
		}

		localName := sanitizeMaterialTypeID(mt.ID) + imageExtensionFromURL(mt.ImageURL)
		localPath := filepath.Join(baseDir, localName)
		sourcePath := localPath + ".source"
		localURL := fmt.Sprintf("/uploads/material-types/%s", localName)

		sourceURLBytes, readErr := os.ReadFile(sourcePath)
		sourceURL := strings.TrimSpace(string(sourceURLBytes))
		localExists := fileExists(localPath)

		if localExists && readErr == nil && sourceURL == mt.ImageURL {
			result[mt.ID] = localURL
			continue
		}

		imageData, err := h.orgClient.GetAsset(ctx, mt.ImageURL)
		if err != nil {
			if localExists {
				result[mt.ID] = localURL
			} else {
				result[mt.ID] = mt.ImageURL
			}
			continue
		}

		if err := os.WriteFile(localPath, imageData, 0644); err != nil {
			if localExists {
				result[mt.ID] = localURL
			} else {
				result[mt.ID] = mt.ImageURL
			}
			continue
		}

		_ = os.WriteFile(sourcePath, []byte(mt.ImageURL), 0644)
		result[mt.ID] = localURL
	}

	return result
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}
