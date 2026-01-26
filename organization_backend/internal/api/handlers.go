package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"organization_backend/internal/db"
	"organization_backend/internal/domain"
	"organization_backend/internal/service"
	"organization_backend/internal/transport"
	"organization_backend/pkg/pagination"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	Service  *service.RequestService
	Store    *db.Store
	Notifier *db.Notifier
}

func (h *Handler) CreateRequest(w http.ResponseWriter, r *http.Request) {
	var payload service.CreateRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	req, err := h.Service.CreateRequest(r.Context(), payload)
	if err != nil {
		var validation service.ValidationErrors
		if errors.As(err, &validation) {
			writeJSON(w, http.StatusBadRequest, validation)
			return
		}
		writeError(w, http.StatusInternalServerError, "create_failed", err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, req)
}

func (h *Handler) GetRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	req, err := h.Service.GetRequestByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Request not found")
		return
	}
	writeJSON(w, http.StatusOK, req)
}

func (h *Handler) ListRequests(w http.ResponseWriter, r *http.Request) {
	params, err := parseListParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_params", err.Error())
		return
	}
	result, err := h.Service.ListRequests(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) SubscribeRequest(w http.ResponseWriter, r *http.Request) {
	requestID := chi.URLParam(r, "id")
	if strings.TrimSpace(requestID) == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "id required")
		return
	}
	events := make(chan []byte, 10)
	subID, updates := h.Notifier.Subscribe()
	defer h.Notifier.Unsubscribe(subID)

	go func() {
		defer close(events)
		ctx := r.Context()
		initial, err := h.Service.GetRequestByID(r.Context(), requestID)
		if err == nil {
			sendEvent(events, "snapshot", "SNAPSHOT", &initial, requestID, time.Now())
		}
		for {
			select {
			case <-ctx.Done():
				return
			case update, ok := <-updates:
				if !ok {
					return
				}
				if update.RequestID != requestID {
					continue
				}
				switch update.Action {
				case "DELETE":
					sendEvent(events, "deleted", update.Action, nil, update.RequestID, update.UpdatedAt)
				default:
					req, err := h.Service.GetRequestByID(ctx, requestID)
					if err != nil {
						sendEvent(events, "deleted", update.Action, nil, update.RequestID, update.UpdatedAt)
						continue
					}
					sendEvent(events, "update", update.Action, &req, update.RequestID, update.UpdatedAt)
				}
			}
		}
	}()

	transport.Stream(w, r, events)
}

func (h *Handler) SubscribeRequests(w http.ResponseWriter, r *http.Request) {
	params, err := parseListParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_params", err.Error())
		return
	}

	events := make(chan []byte, 10)
	subID, updates := h.Notifier.Subscribe()
	defer h.Notifier.Unsubscribe(subID)

	go func() {
		defer close(events)
		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case update, ok := <-updates:
				if !ok {
					return
				}
				if update.Action == "DELETE" {
					sendEvent(events, "deleted", update.Action, nil, update.RequestID, update.UpdatedAt)
					continue
				}
				req, err := h.Service.GetRequestByID(ctx, update.RequestID)
				if err != nil {
					continue
				}
				if matchesListQuery(req, params) {
					sendEvent(events, "update", update.Action, &req, update.RequestID, update.UpdatedAt)
				}
			}
		}
	}()

	transport.Stream(w, r, events)
}

func parseListParams(r *http.Request) (db.ListRequestsParams, error) {
	q := r.URL.Query()

	limit := 20
	if q.Get("limit") != "" {
		parsed, err := strconv.Atoi(q.Get("limit"))
		if err != nil {
			return db.ListRequestsParams{}, errors.New("limit must be number")
		}
		limit = parsed
	}

	var cursor *pagination.Cursor
	if q.Get("cursor") != "" {
		parsed, err := pagination.Decode(q.Get("cursor"))
		if err != nil {
			return db.ListRequestsParams{}, errors.New("invalid cursor")
		}
		cursor = &parsed
	}

	var from *time.Time
	if q.Get("from") != "" {
		ts, err := time.Parse(time.RFC3339, q.Get("from"))
		if err != nil {
			return db.ListRequestsParams{}, errors.New("invalid from")
		}
		from = &ts
	}
	var to *time.Time
	if q.Get("to") != "" {
		ts, err := time.Parse(time.RFC3339, q.Get("to"))
		if err != nil {
			return db.ListRequestsParams{}, errors.New("invalid to")
		}
		to = &ts
	}

	return db.ListRequestsParams{
		Limit:      limit,
		Cursor:     cursor,
		Query:      strings.TrimSpace(q.Get("q")),
		Status:     strings.TrimSpace(q.Get("status")),
		CustomerID: strings.TrimSpace(q.Get("customerId")),
		From:       from,
		To:         to,
	}, nil
}

func matchesListQuery(req domain.Request, params db.ListRequestsParams) bool {
	if params.Status != "" && req.Status != params.Status {
		return false
	}
	if params.CustomerID != "" && req.Customer.ID != params.CustomerID {
		return false
	}
	if params.From != nil && req.DeliveryDate.Before(*params.From) {
		return false
	}
	if params.To != nil && req.DeliveryDate.After(*params.To) {
		return false
	}
	if params.Query != "" {
		q := strings.ToLower(params.Query)
		if !strings.Contains(strings.ToLower(req.Customer.Name), q) &&
			!strings.Contains(strings.ToLower(req.Customer.Email), q) &&
			!strings.Contains(strings.ToLower(req.ID), q) {
			return false
		}
	}
	return true
}

type requestEvent struct {
	Type      string          `json:"type"`
	Action    string          `json:"action"`
	Request   *domain.Request `json:"request,omitempty"`
	RequestID string          `json:"requestId"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

func sendEvent(events chan<- []byte, eventType, action string, request *domain.Request, requestID string, updatedAt time.Time) {
	payload, err := json.Marshal(requestEvent{
		Type:      eventType,
		Action:    action,
		Request:   request,
		RequestID: requestID,
		UpdatedAt: updatedAt,
	})
	if err != nil {
		return
	}
	select {
	case events <- payload:
	default:
	}
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
