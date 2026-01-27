package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"organization_backend/internal/domain"
	"organization_backend/pkg/pagination"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

type CreateRequestInput struct {
	CustomerID           string
	CustomerEmail        string
	CustomerName         string
	CustomerToken        string
	DeliveryDate         time.Time
	Status               string
	ShippingCustomerName string
	ShippingAddressLine1 string
	ShippingAddressLine2 string
	ShippingCity         string
	ShippingZipCode      string
	Items                map[string]int
	Metadata             map[string]any
}

type ListRequestsParams struct {
	Limit      int
	Cursor     *pagination.Cursor
	Query      string
	Status     string
	CustomerID string
	From       *time.Time
	To         *time.Time
}

type ListRequestsResult struct {
	Requests   []domain.Request `json:"requests"`
	NextCursor string           `json:"nextCursor,omitempty"`
}

func (s *Store) CreateRequest(ctx context.Context, input CreateRequestInput) (domain.Request, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Request{}, err
	}
	defer tx.Rollback()

	customer, err := s.ensureCustomer(ctx, tx, input)
	if err != nil {
		return domain.Request{}, err
	}

	metadata := input.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return domain.Request{}, err
	}

	var reqID string
	var createdAt time.Time
	var updatedAt time.Time
	line2 := sql.NullString{String: input.ShippingAddressLine2, Valid: input.ShippingAddressLine2 != ""}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO requests (
			customer_id, delivery_date, status, shipping_customer_name, shipping_address_line1,
			shipping_address_line2, shipping_city, shipping_zip_code, metadata
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, created_at, updated_at
	`, customer.ID, input.DeliveryDate, input.Status, input.ShippingCustomerName, input.ShippingAddressLine1,
		line2, input.ShippingCity, input.ShippingZipCode, metadataBytes).Scan(&reqID, &createdAt, &updatedAt)
	if err != nil {
		return domain.Request{}, err
	}

	if len(input.Items) == 0 {
		return domain.Request{}, errors.New("items required")
	}
	for materialTypeID, quantity := range input.Items {
		if quantity <= 0 {
			return domain.Request{}, errors.New("quantity must be positive")
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO request_items (request_id, material_type_id, quantity)
			VALUES ($1,$2,$3)
		`, reqID, materialTypeID, quantity)
		if err != nil {
			return domain.Request{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return domain.Request{}, err
	}

	return domain.Request{
		ID: reqID,
		Customer: domain.Customer{
			ID:        customer.ID,
			Email:     customer.Email,
			Name:      customer.Name,
			Token:     customer.Token,
			CreatedAt: customer.CreatedAt,
		},
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
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
		Metadata:  metadata,
	}, nil
}

func (s *Store) GetRequestByID(ctx context.Context, id string) (domain.Request, error) {
	row, err := s.getRequestRow(ctx, id)
	if err != nil {
		return domain.Request{}, err
	}
	items, err := s.getItemsForRequest(ctx, id)
	if err != nil {
		return domain.Request{}, err
	}
	return mapRequest(row, items), nil
}

func (s *Store) ListRequests(ctx context.Context, params ListRequestsParams) (ListRequestsResult, error) {
	limit := params.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	args := []any{}
	where := []string{"1=1"}

	if params.Query != "" {
		args = append(args, "%"+params.Query+"%")
		n := len(args)
		where = append(where, fmt.Sprintf("(c.name ILIKE $%d OR c.email ILIKE $%d OR r.id::text ILIKE $%d)", n, n, n))
	}
	if params.Status != "" {
		args = append(args, params.Status)
		where = append(where, fmt.Sprintf("r.status = $%d", len(args)))
	}
	if params.CustomerID != "" {
		args = append(args, params.CustomerID)
		where = append(where, fmt.Sprintf("r.customer_id = $%d", len(args)))
	}
	if params.From != nil {
		args = append(args, *params.From)
		where = append(where, fmt.Sprintf("r.delivery_date >= $%d", len(args)))
	}
	if params.To != nil {
		args = append(args, *params.To)
		where = append(where, fmt.Sprintf("r.delivery_date <= $%d", len(args)))
	}
	if params.Cursor != nil {
		args = append(args, params.Cursor.Time, params.Cursor.ID)
		where = append(where, fmt.Sprintf("(r.updated_at, r.id) < ($%d, $%d)", len(args)-1, len(args)))
	}

	args = append(args, limit+1)
	query := fmt.Sprintf(`
		SELECT r.id, r.customer_id, r.delivery_date, r.status, r.shipping_customer_name,
		       r.shipping_address_line1, r.shipping_address_line2, r.shipping_city, r.shipping_zip_code,
		       r.metadata, r.created_at, r.updated_at,
		       c.email, c.name, c.token, c.workos_user_id, c.email_verified, c.created_at
		FROM requests r
		JOIN customers c ON r.customer_id = c.id
		WHERE %s
		ORDER BY r.updated_at DESC, r.id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), len(args))

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return ListRequestsResult{}, err
	}
	defer rows.Close()

	var result []domain.Request
	var ids []string
	var rowData []requestRow
	for rows.Next() {
		row, err := scanRequestRow(rows)
		if err != nil {
			return ListRequestsResult{}, err
		}
		ids = append(ids, row.ID)
		rowData = append(rowData, row)
		result = append(result, mapRequest(row, nil))
	}
	if err := rows.Err(); err != nil {
		return ListRequestsResult{}, err
	}

	nextCursor := ""
	extraFetched := len(rowData) > limit
	if extraFetched {
		result = result[:limit]
		nextRow := rowData[limit-1]
		nextCursor = pagination.Encode(pagination.Cursor{Time: nextRow.UpdatedAt, ID: nextRow.ID})
		ids = ids[:limit]
	}

	itemsByRequest, err := s.getItemsForRequests(ctx, ids)
	if err != nil {
		return ListRequestsResult{}, err
	}
	for i := range result {
		result[i].Items = itemsByRequest[result[i].ID]
	}

	return ListRequestsResult{Requests: result, NextCursor: nextCursor}, nil
}

func (s *Store) ensureCustomer(ctx context.Context, tx *sql.Tx, input CreateRequestInput) (customerRow, error) {
	if input.CustomerID != "" {
		return s.getCustomerByID(ctx, tx, input.CustomerID)
	}

	if input.CustomerEmail == "" {
		return customerRow{}, errors.New("customer email required")
	}

	customer, err := s.getCustomerByEmail(ctx, tx, input.CustomerEmail)
	if err == nil {
		return customer, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return customerRow{}, err
	}

	if input.CustomerToken == "" {
		input.CustomerToken = uuid.NewString()
	}
	var created customerRow
	err = tx.QueryRowContext(ctx, `
		INSERT INTO customers (email, name, token)
		VALUES ($1,$2,$3)
		RETURNING id, email, name, token, created_at
	`, input.CustomerEmail, input.CustomerName, input.CustomerToken).Scan(
		&created.ID, &created.Email, &created.Name, &created.Token, &created.CreatedAt,
	)
	if err != nil {
		return customerRow{}, err
	}
	return created, nil
}

func (s *Store) getCustomerByID(ctx context.Context, tx *sql.Tx, id string) (customerRow, error) {
	var row customerRow
	err := tx.QueryRowContext(ctx, `
		SELECT id, email, name, token, created_at
		FROM customers WHERE id = $1
	`, id).Scan(&row.ID, &row.Email, &row.Name, &row.Token, &row.CreatedAt)
	return row, err
}

func (s *Store) getCustomerByEmail(ctx context.Context, tx *sql.Tx, email string) (customerRow, error) {
	var row customerRow
	err := tx.QueryRowContext(ctx, `
		SELECT id, email, name, token, created_at
		FROM customers WHERE email = $1
	`, email).Scan(&row.ID, &row.Email, &row.Name, &row.Token, &row.CreatedAt)
	return row, err
}

func (s *Store) getRequestRow(ctx context.Context, id string) (requestRow, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT r.id, r.customer_id, r.delivery_date, r.status, r.shipping_customer_name,
		       r.shipping_address_line1, r.shipping_address_line2, r.shipping_city, r.shipping_zip_code,
		       r.metadata, r.created_at, r.updated_at,
		       c.email, c.name, c.token, c.workos_user_id, c.email_verified, c.created_at
		FROM requests r
		JOIN customers c ON r.customer_id = c.id
		WHERE r.id = $1
	`, id)
	return scanRequestRow(row)
}

func scanRequestRow(scanner interface {
	Scan(dest ...any) error
}) (requestRow, error) {
	var row requestRow
	var line2 sql.NullString
	if err := scanner.Scan(
		&row.ID, &row.CustomerID, &row.DeliveryDate, &row.Status, &row.ShippingCustomerName,
		&row.ShippingAddressLine1, &line2, &row.ShippingCity, &row.ShippingZipCode,
		&row.Metadata, &row.CreatedAt, &row.UpdatedAt,
		&row.CustomerEmail, &row.CustomerName, &row.CustomerToken, &row.CustomerWorkOSUserID, &row.CustomerEmailVerified, &row.CustomerCreatedAt,
	); err != nil {
		return requestRow{}, err
	}
	if line2.Valid {
		row.ShippingAddressLine2 = &line2.String
	}
	return row, nil
}

func (s *Store) getItemsForRequest(ctx context.Context, requestID string) (map[string]int, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT material_type_id, quantity
		FROM request_items
		WHERE request_id = $1
	`, requestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := map[string]int{}
	for rows.Next() {
		var materialID string
		var qty int
		if err := rows.Scan(&materialID, &qty); err != nil {
			return nil, err
		}
		items[materialID] = qty
	}
	return items, rows.Err()
}

func (s *Store) getItemsForRequests(ctx context.Context, requestIDs []string) (map[string]map[string]int, error) {
	result := make(map[string]map[string]int)
	if len(requestIDs) == 0 {
		return result, nil
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT request_id, material_type_id, quantity
		FROM request_items
		WHERE request_id = ANY($1::uuid[])
	`, pq.Array(requestIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var requestID string
		var materialID string
		var qty int
		if err := rows.Scan(&requestID, &materialID, &qty); err != nil {
			return nil, err
		}
		if _, ok := result[requestID]; !ok {
			result[requestID] = map[string]int{}
		}
		result[requestID][materialID] = qty
	}
	return result, rows.Err()
}

func mapRequest(row requestRow, items map[string]int) domain.Request {
	if items == nil {
		items = map[string]int{}
	}
	metadata := map[string]any{}
	if len(row.Metadata) > 0 {
		_ = json.Unmarshal(row.Metadata, &metadata)
	}
	address := domain.ShippingAddress{
		Line1:   row.ShippingAddressLine1,
		City:    row.ShippingCity,
		ZipCode: row.ShippingZipCode,
	}
	if row.ShippingAddressLine2 != nil {
		address.Line2 = *row.ShippingAddressLine2
	}
	return domain.Request{
		ID: row.ID,
		Customer: domain.Customer{
			ID:            row.CustomerID,
			Email:         row.CustomerEmail,
			Name:          row.CustomerName,
			Token:         row.CustomerToken,
			WorkOSUserID:  row.CustomerWorkOSUserID,
			EmailVerified: row.CustomerEmailVerified,
			CreatedAt:     row.CustomerCreatedAt,
		},
		Items:                items,
		DeliveryDate:         row.DeliveryDate,
		Status:               row.Status,
		ShippingCustomerName: row.ShippingCustomerName,
		ShippingAddress:      address,
		CreatedAt:            row.CreatedAt,
		UpdatedAt:            row.UpdatedAt,
		Metadata:             metadata,
	}
}

func (s *Store) GetOrCreateCustomerByWorkOSUser(ctx context.Context, workosUser *usermanagement.User) (domain.Customer, error) {
	var customer domain.Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, name, token, workos_user_id, email_verified, created_at
		FROM customers WHERE workos_user_id = $1
	`, workosUser.ID).Scan(
		&customer.ID, &customer.Email, &customer.Name, &customer.Token,
		&customer.WorkOSUserID, &customer.EmailVerified, &customer.CreatedAt,
	)

	if err == nil {
		return customer, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return domain.Customer{}, err
	}

	err = s.db.QueryRowContext(ctx, `
		INSERT INTO customers (email, name, token, workos_user_id, email_verified)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, email, name, token, workos_user_id, email_verified, created_at
	`,
		workosUser.Email,
		workosUser.FirstName+" "+workosUser.LastName,
		uuid.NewString(),
		workosUser.ID,
		true,
	).Scan(
		&customer.ID, &customer.Email, &customer.Name, &customer.Token,
		&customer.WorkOSUserID, &customer.EmailVerified, &customer.CreatedAt,
	)

	return customer, err
}

func (s *Store) GetCustomerByID(ctx context.Context, id string) (domain.Customer, error) {
	var customer domain.Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, name, token, workos_user_id, email_verified, created_at
		FROM customers WHERE id = $1
	`, id).Scan(
		&customer.ID, &customer.Email, &customer.Name, &customer.Token,
		&customer.WorkOSUserID, &customer.EmailVerified, &customer.CreatedAt,
	)
	return customer, err
}
