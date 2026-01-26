package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"organization_backend/internal/config"
	"organization_backend/internal/domain"
	"organization_backend/pkg/pagination"

	dbmw "github.com/yourusername/database_handler"

	"github.com/google/uuid"
)

type MiddlewareStore struct {
	db dbmw.Database
}

func NewMiddlewareStore(cfg config.Config) (*MiddlewareStore, error) {
	var dbConfig dbmw.Config

	switch cfg.DatabaseMode {
	case "json", "":
		dbConfig = dbmw.Config{
			Mode:     dbmw.ModeJSON,
			DataPath: cfg.DataPath,
		}
	case "postgresql":
		if cfg.DatabaseURL == "" {
			return nil, errors.New("DATABASE_URL required for postgresql mode")
		}

		parsedURL, err := url.Parse(cfg.DatabaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse database URL: %w", err)
		}

		password, _ := parsedURL.User.Password()
		port := 5432
		if parsedURL.Port() != "" {
			port, _ = strconv.Atoi(parsedURL.Port())
		}

		dbConfig = dbmw.Config{
			Mode:     dbmw.ModePostgreSQL,
			Host:     parsedURL.Hostname(),
			Port:     port,
			Database: parsedURL.Path[1:],
			User:     parsedURL.User.Username(),
			Password: password,
			SSLMode:  "disable",
		}
	default:
		return nil, fmt.Errorf("unsupported database mode: %s", cfg.DatabaseMode)
	}

	db, err := dbmw.NewDatabase(dbConfig)
	if err != nil {
		return nil, err
	}

	store := &MiddlewareStore{db: db}

	// Initialize tables
	if err := store.initializeTables(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

func (s *MiddlewareStore) initializeTables() error {
	// Create customers table
	customersExists, err := s.db.TableExists("customers")
	if err != nil {
		return err
	}

	if !customersExists {
		customerSchema := dbmw.TableSchema{
			Fields: []dbmw.FieldDefinition{
				{Name: "id", Type: "string"},
				{Name: "email", Type: "string"},
				{Name: "name", Type: "string"},
				{Name: "token", Type: "string"},
				{Name: "createdAt", Type: "date"},
			},
			UniqueFields:   []string{"email"},
			RequiredFields: []string{"email", "name", "token"},
		}
		if err := s.db.CreateTable("customers", customerSchema); err != nil {
			return fmt.Errorf("failed to create customers table: %w", err)
		}
	}

	// Create requests table
	requestsExists, err := s.db.TableExists("requests")
	if err != nil {
		return err
	}

	if !requestsExists {
		requestSchema := dbmw.TableSchema{
			Fields: []dbmw.FieldDefinition{
				{Name: "id", Type: "string"},
				{Name: "customerId", Type: "string"},
				{Name: "items", Type: "object"},
				{Name: "deliveryDate", Type: "date"},
				{Name: "status", Type: "string"},
				{Name: "shippingCustomerName", Type: "string"},
				{Name: "shippingAddressLine1", Type: "string"},
				{Name: "shippingAddressLine2", Type: "string"},
				{Name: "shippingCity", Type: "string"},
				{Name: "shippingZipCode", Type: "string"},
				{Name: "metadata", Type: "object"},
				{Name: "createdAt", Type: "date"},
				{Name: "updatedAt", Type: "date"},
			},
			RequiredFields: []string{"customerId", "items", "deliveryDate", "status"},
		}
		if err := s.db.CreateTable("requests", requestSchema); err != nil {
			return fmt.Errorf("failed to create requests table: %w", err)
		}
	}

	return nil
}

func (s *MiddlewareStore) CreateRequest(ctx context.Context, input CreateRequestInput) (domain.Request, error) {
	// Ensure customer exists
	customer, err := s.ensureCustomer(ctx, input)
	if err != nil {
		return domain.Request{}, err
	}

	if len(input.Items) == 0 {
		return domain.Request{}, errors.New("items required")
	}

	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}

	requestID := uuid.New().String()
	now := time.Now()

	requestData := map[string]interface{}{
		"id":                   requestID,
		"customerId":           customer.ID,
		"items":                input.Items,
		"deliveryDate":         input.DeliveryDate,
		"status":               input.Status,
		"shippingCustomerName": input.ShippingCustomerName,
		"shippingAddressLine1": input.ShippingAddressLine1,
		"shippingAddressLine2": input.ShippingAddressLine2,
		"shippingCity":         input.ShippingCity,
		"shippingZipCode":      input.ShippingZipCode,
		"metadata":             metadata,
		"createdAt":            now,
		"updatedAt":            now,
	}

	_, err = s.db.Insert("requests", requestData)
	if err != nil {
		return domain.Request{}, err
	}

	return domain.Request{
		ID:                   requestID,
		Customer:             customer,
		Items:                input.Items,
		DeliveryDate:         input.DeliveryDate,
		Status:               input.Status,
		ShippingCustomerName: input.ShippingCustomerName,
		ShippingAddress: domain.ShippingAddress{
			Line1:   input.ShippingAddressLine1,
			Line2:   input.ShippingAddressLine2,
			City:    input.ShippingCity,
			ZipCode: input.ShippingZipCode,
		},
		CreatedAt: now,
		UpdatedAt: now,
		Metadata:  metadata,
	}, nil
}

func (s *MiddlewareStore) GetRequestByID(ctx context.Context, id string) (domain.Request, error) {
	data, err := s.db.Get("requests", id)
	if err != nil {
		return domain.Request{}, err
	}

	return s.mapToRequest(ctx, data)
}

func (s *MiddlewareStore) ListRequests(ctx context.Context, params ListRequestsParams) (ListRequestsResult, error) {
	limit := params.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	// Get all requests (filtering will be done in memory for now)
	allRequests, err := s.db.List("requests", nil)
	if err != nil {
		return ListRequestsResult{}, err
	}

	// Apply filters
	var filtered []map[string]interface{}
	for _, req := range allRequests {
		if s.matchesFilters(req, params) {
			filtered = append(filtered, req)
		}
	}

	// Sort by updatedAt DESC
	for i := 0; i < len(filtered); i++ {
		for j := i + 1; j < len(filtered); j++ {
			iTime := s.getTimeField(filtered[i], "updatedAt")
			jTime := s.getTimeField(filtered[j], "updatedAt")
			if iTime.Before(jTime) {
				filtered[i], filtered[j] = filtered[j], filtered[i]
			}
		}
	}

	// Apply cursor pagination
	startIdx := 0
	if params.Cursor != nil {
		for i, req := range filtered {
			reqTime := s.getTimeField(req, "updatedAt")
			reqID := s.getStringField(req, "id")
			if reqTime.Before(params.Cursor.Time) ||
				(reqTime.Equal(params.Cursor.Time) && reqID < params.Cursor.ID) {
				startIdx = i
				break
			}
		}
	}

	// Get page of results
	endIdx := startIdx + limit
	hasMore := endIdx < len(filtered)
	if hasMore {
		endIdx = startIdx + limit
	} else {
		endIdx = len(filtered)
	}

	var results []domain.Request
	for i := startIdx; i < endIdx; i++ {
		req, err := s.mapToRequest(ctx, filtered[i])
		if err != nil {
			continue
		}
		results = append(results, req)
	}

	nextCursor := ""
	if hasMore && len(results) > 0 {
		lastReq := results[len(results)-1]
		nextCursor = pagination.Encode(pagination.Cursor{
			Time: lastReq.UpdatedAt,
			ID:   lastReq.ID,
		})
	}

	return ListRequestsResult{
		Requests:   results,
		NextCursor: nextCursor,
	}, nil
}

func (s *MiddlewareStore) Close() error {
	return s.db.Close()
}

func (s *MiddlewareStore) ensureCustomer(ctx context.Context, input CreateRequestInput) (domain.Customer, error) {
	if input.CustomerID != "" {
		customerData, err := s.db.Get("customers", input.CustomerID)
		if err != nil {
			return domain.Customer{}, fmt.Errorf("customer not found: %w", err)
		}
		return s.mapToCustomer(customerData), nil
	}

	if input.CustomerEmail == "" {
		return domain.Customer{}, errors.New("customer email required")
	}

	// Try to find existing customer by email
	allCustomers, err := s.db.List("customers", map[string]interface{}{"email": input.CustomerEmail})
	if err != nil {
		return domain.Customer{}, err
	}

	if len(allCustomers) > 0 {
		return s.mapToCustomer(allCustomers[0]), nil
	}

	// Create new customer
	customerID := uuid.New().String()
	token := input.CustomerToken
	if token == "" {
		token = uuid.New().String()
	}

	customerData := map[string]interface{}{
		"id":        customerID,
		"email":     input.CustomerEmail,
		"name":      input.CustomerName,
		"token":     token,
		"createdAt": time.Now(),
	}

	_, err = s.db.Insert("customers", customerData)
	if err != nil {
		return domain.Customer{}, err
	}

	return s.mapToCustomer(customerData), nil
}

func (s *MiddlewareStore) mapToRequest(ctx context.Context, data map[string]interface{}) (domain.Request, error) {
	// Get customer
	customerID := s.getStringField(data, "customerId")
	customerData, err := s.db.Get("customers", customerID)
	if err != nil {
		return domain.Request{}, err
	}
	customer := s.mapToCustomer(customerData)

	// Parse items
	items := make(map[string]int)
	if itemsData, ok := data["items"].(map[string]interface{}); ok {
		for k, v := range itemsData {
			switch val := v.(type) {
			case float64:
				items[k] = int(val)
			case int:
				items[k] = val
			}
		}
	}

	// Parse metadata
	metadata := make(map[string]any)
	if metadataData, ok := data["metadata"].(map[string]interface{}); ok {
		metadata = metadataData
	}

	return domain.Request{
		ID:                   s.getStringField(data, "id"),
		Customer:             customer,
		Items:                items,
		DeliveryDate:         s.getTimeField(data, "deliveryDate"),
		Status:               s.getStringField(data, "status"),
		ShippingCustomerName: s.getStringField(data, "shippingCustomerName"),
		ShippingAddress: domain.ShippingAddress{
			Line1:   s.getStringField(data, "shippingAddressLine1"),
			Line2:   s.getStringField(data, "shippingAddressLine2"),
			City:    s.getStringField(data, "shippingCity"),
			ZipCode: s.getStringField(data, "shippingZipCode"),
		},
		CreatedAt: s.getTimeField(data, "createdAt"),
		UpdatedAt: s.getTimeField(data, "updatedAt"),
		Metadata:  metadata,
	}, nil
}

func (s *MiddlewareStore) mapToCustomer(data map[string]interface{}) domain.Customer {
	return domain.Customer{
		ID:        s.getStringField(data, "id"),
		Email:     s.getStringField(data, "email"),
		Name:      s.getStringField(data, "name"),
		Token:     s.getStringField(data, "token"),
		CreatedAt: s.getTimeField(data, "createdAt"),
	}
}

func (s *MiddlewareStore) matchesFilters(req map[string]interface{}, params ListRequestsParams) bool {
	if params.Status != "" && s.getStringField(req, "status") != params.Status {
		return false
	}

	if params.CustomerID != "" && s.getStringField(req, "customerId") != params.CustomerID {
		return false
	}

	deliveryDate := s.getTimeField(req, "deliveryDate")
	if params.From != nil && deliveryDate.Before(*params.From) {
		return false
	}
	if params.To != nil && deliveryDate.After(*params.To) {
		return false
	}

	if params.Query != "" {
		// Simple text search - could be enhanced
		query := params.Query
		id := s.getStringField(req, "id")
		customerName := s.getStringField(req, "shippingCustomerName")

		if !contains(id, query) && !contains(customerName, query) {
			return false
		}
	}

	return true
}

func (s *MiddlewareStore) getStringField(data map[string]interface{}, field string) string {
	if val, ok := data[field].(string); ok {
		return val
	}
	return ""
}

func (s *MiddlewareStore) getTimeField(data map[string]interface{}, field string) time.Time {
	if val, ok := data[field].(time.Time); ok {
		return val
	}
	if str, ok := data[field].(string); ok {
		t, _ := time.Parse(time.RFC3339, str)
		return t
	}
	return time.Time{}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr ||
		len(s) > 0 && len(substr) > 0 &&
			(s[:len(substr)] == substr || contains(s[1:], substr)))
}

func parseJSONTime(val interface{}) time.Time {
	switch v := val.(type) {
	case time.Time:
		return v
	case string:
		t, _ := time.Parse(time.RFC3339, v)
		return t
	default:
		return time.Time{}
	}
}

func toJSONMap(v interface{}) map[string]interface{} {
	data, _ := json.Marshal(v)
	var result map[string]interface{}
	json.Unmarshal(data, &result)
	return result
}
