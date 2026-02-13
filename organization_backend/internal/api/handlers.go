package api

import (
	"encoding/json"
	"net/http"

	"organization_backend/internal/db"
	"organization_backend/internal/transport"
)

type Handler struct {
	Store            *db.Store
	MaterialNotifier *db.MaterialNotifier
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{
		"error":   code,
		"message": message,
	})
}

// UpdateAvailabilityFromDistBackend receives availability updates from distribution backends
// This endpoint is called via Unix socket or internal API
func (h *Handler) UpdateAvailabilityFromDistBackend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DistributionCenterID string         `json:"distributionCenterId"`
		Availability         map[string]int `json:"availability"` // material_type_id -> count
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	if req.DistributionCenterID == "" {
		writeError(w, http.StatusBadRequest, "missing_field", "distributionCenterId is required")
		return
	}

	// Update material_available table
	// This will trigger the pg_notify automatically via the database trigger
	err := h.Store.UpdateMaterialAvailability(r.Context(), req.DistributionCenterID, req.Availability)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// SubscribeMaterialAvailability handles SSE subscriptions for material availability updates
func (h *Handler) SubscribeMaterialAvailability(w http.ResponseWriter, r *http.Request) {
	events := make(chan []byte, 10)
	subID, updates := h.MaterialNotifier.Subscribe()
	defer h.MaterialNotifier.Unsubscribe(subID)

	go func() {
		defer close(events)
		ctx := r.Context()

		// Send initial snapshot
		materials, err := h.Store.ListMaterialTypesWithAvailability(ctx)
		if err != nil {
			// Send error event
			payload, _ := json.Marshal(map[string]interface{}{
				"type":    "error",
				"message": "Failed to fetch initial material availability",
			})
			events <- payload
			return
		}

		snapshotPayload, _ := json.Marshal(map[string]interface{}{
			"type":      "snapshot",
			"materials": materials,
		})
		events <- snapshotPayload

		// Stream updates
		for {
			select {
			case <-ctx.Done():
				return
			case update, ok := <-updates:
				if !ok {
					return
				}

				// Fetch updated material type details
				material, err := h.Store.GetMaterialTypeByID(ctx, update.MaterialTypeID)
				if err != nil {
					continue
				}

				// Get the updated availability count
				materialsWithAvail, err := h.Store.ListMaterialTypesWithAvailability(ctx)
				if err != nil {
					continue
				}

				for _, m := range materialsWithAvail {
					if m.ID == update.MaterialTypeID {
						material.AvailableCount = m.AvailableCount
						break
					}
				}

				payload, _ := json.Marshal(map[string]interface{}{
					"type":     "update",
					"action":   update.Action,
					"material": material,
				})
				events <- payload
			}
		}
	}()

	transport.Stream(w, r, events)
}
