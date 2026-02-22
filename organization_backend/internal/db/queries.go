package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"organization_backend/internal/domain"

	"github.com/google/uuid"
	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

type Store struct {
	db *sql.DB
}

var (
	ErrRequestNotFound        = errors.New("request not found")
	ErrRequestAlreadyApproved = errors.New("request already approved by another distribution center")
	ErrInvalidRequestStatus   = errors.New("request status does not allow this operation")
)

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ensureUser(ctx context.Context, tx *sql.Tx, input CreateRequestInput) (userRow, error) {
	if input.CustomerID != "" {
		return s.getUserByID(ctx, tx, input.CustomerID)
	}

	if input.CustomerEmail == "" {
		return userRow{}, errors.New("customer email required")
	}

	user, err := s.getUserByEmail(ctx, tx, input.CustomerEmail)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return userRow{}, err
	}

	if input.CustomerToken == "" {
		input.CustomerToken = uuid.NewString()
	}
	var created userRow
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (email, name, token)
		VALUES ($1,$2,$3)
		RETURNING id, email, name, token, is_admin, created_at
	`, input.CustomerEmail, input.CustomerName, input.CustomerToken).Scan(
		&created.ID, &created.Email, &created.Name, &created.Token, &created.IsAdmin, &created.CreatedAt,
	)
	if err != nil {
		return userRow{}, err
	}
	return created, nil
}

func (s *Store) getUserByID(ctx context.Context, tx *sql.Tx, id string) (userRow, error) {
	var row userRow
	err := tx.QueryRowContext(ctx, `
		SELECT id, email, name, token, is_admin, created_at
		FROM users WHERE id = $1
	`, id).Scan(&row.ID, &row.Email, &row.Name, &row.Token, &row.IsAdmin, &row.CreatedAt)
	return row, err
}

func (s *Store) getUserByEmail(ctx context.Context, tx *sql.Tx, email string) (userRow, error) {
	var row userRow
	err := tx.QueryRowContext(ctx, `
		SELECT id, email, name, token, is_admin, created_at
		FROM users WHERE email = $1
	`, email).Scan(&row.ID, &row.Email, &row.Name, &row.Token, &row.IsAdmin, &row.CreatedAt)
	return row, err
}

func (s *Store) GetOrCreateUserByWorkOSUser(ctx context.Context, workosUser *usermanagement.User) (domain.Customer, error) {
	var user domain.Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, name, token, workos_user_id, email_verified, is_admin, created_at
		FROM users WHERE workos_user_id = $1
	`, workosUser.ID).Scan(
		&user.ID, &user.Email, &user.Name, &user.Token,
		&user.WorkOSUserID, &user.EmailVerified, &user.IsAdmin, &user.CreatedAt,
	)

	if err == nil {
		return user, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return domain.Customer{}, err
	}

	name := strings.TrimSpace(workosUser.FirstName + " " + workosUser.LastName)
	if name == "" {
		name = workosUser.Email
	}

	err = s.db.QueryRowContext(ctx, `
		INSERT INTO users (email, name, token, workos_user_id, email_verified)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, email, name, token, workos_user_id, email_verified, is_admin, created_at
	`,
		workosUser.Email,
		name,
		uuid.NewString(),
		workosUser.ID,
		true,
	).Scan(
		&user.ID, &user.Email, &user.Name, &user.Token,
		&user.WorkOSUserID, &user.EmailVerified, &user.IsAdmin, &user.CreatedAt,
	)

	return user, err
}

func (s *Store) GetUserByID(ctx context.Context, id string) (domain.Customer, error) {
	var user domain.Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, name, token, workos_user_id, email_verified, is_admin, created_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &user.Email, &user.Name, &user.Token,
		&user.WorkOSUserID, &user.EmailVerified, &user.IsAdmin, &user.CreatedAt,
	)
	return user, err
}

// GetCustomerByID is an alias for GetUserByID for backwards compatibility
func (s *Store) GetCustomerByID(ctx context.Context, id string) (domain.Customer, error) {
	return s.GetUserByID(ctx, id)
}

// GetOrCreateCustomerByWorkOSUser is an alias for GetOrCreateUserByWorkOSUser for backwards compatibility
func (s *Store) GetOrCreateCustomerByWorkOSUser(ctx context.Context, workosUser *usermanagement.User) (domain.Customer, error) {
	return s.GetOrCreateUserByWorkOSUser(ctx, workosUser)
}

// Material Type CRUD operations

// ListMaterialTypes returns all material types ordered by name
func (s *Store) ListMaterialTypes(ctx context.Context) ([]domain.MaterialType, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, description, image_url
		FROM material_types
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.MaterialType
	for rows.Next() {
		var mt domain.MaterialType
		if err := rows.Scan(&mt.ID, &mt.Name, &mt.Description, &mt.ImageURL); err != nil {
			return nil, err
		}
		result = append(result, mt)
	}
	if result == nil {
		result = []domain.MaterialType{}
	}
	return result, rows.Err()
}

// ListMaterialTypesWithAvailability returns all material types with available counts.
// Availability is total material available minus material reserved in pending/approved/inAction requests.
func (s *Store) ListMaterialTypesWithAvailability(ctx context.Context) ([]domain.MaterialType, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			mt.id, 
			mt.name, 
			mt.description, 
			mt.image_url,
			COALESCE(ma_totals.total_amount, 0) - COALESCE(reserved_totals.reserved_amount, 0) as available_count
		FROM material_types mt
		LEFT JOIN (
			SELECT material_type_id, SUM(amount) AS total_amount
			FROM material_available
			GROUP BY material_type_id
		) ma_totals ON mt.id = ma_totals.material_type_id
		LEFT JOIN (
			SELECT ri.material_type_id, SUM(ri.quantity) AS reserved_amount
			FROM request_items ri
			JOIN requests r ON r.id = ri.request_id
			WHERE r.status IN ('pending', 'approved', 'inAction') AND r.archived = FALSE
			GROUP BY ri.material_type_id
		) reserved_totals ON mt.id = reserved_totals.material_type_id
		ORDER BY mt.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.MaterialType
	for rows.Next() {
		var mt domain.MaterialType
		if err := rows.Scan(&mt.ID, &mt.Name, &mt.Description, &mt.ImageURL, &mt.AvailableCount); err != nil {
			return nil, err
		}
		result = append(result, mt)
	}
	if result == nil {
		result = []domain.MaterialType{}
	}
	return result, rows.Err()
}

// GetMaterialTypeByID returns a single material type by ID
func (s *Store) GetMaterialTypeByID(ctx context.Context, id string) (domain.MaterialType, error) {
	var mt domain.MaterialType
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, description, image_url
		FROM material_types
		WHERE id = $1
	`, id).Scan(&mt.ID, &mt.Name, &mt.Description, &mt.ImageURL)
	if err != nil {
		return domain.MaterialType{}, err
	}
	return mt, nil
}

// CreateMaterialType creates a new material type
func (s *Store) CreateMaterialType(ctx context.Context, id, name, description, imageURL string) (domain.MaterialType, error) {
	var mt domain.MaterialType
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO material_types (id, name, description, image_url)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, description, image_url
	`, id, name, description, imageURL).Scan(&mt.ID, &mt.Name, &mt.Description, &mt.ImageURL)
	if err != nil {
		return domain.MaterialType{}, err
	}
	return mt, nil
}

// UpdateMaterialType updates an existing material type
func (s *Store) UpdateMaterialType(ctx context.Context, id, name, description string) (domain.MaterialType, error) {
	var mt domain.MaterialType
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_types
		SET name = $2, description = $3
		WHERE id = $1
		RETURNING id, name, description, image_url
	`, id, name, description).Scan(&mt.ID, &mt.Name, &mt.Description, &mt.ImageURL)
	if err != nil {
		return domain.MaterialType{}, err
	}
	return mt, nil
}

// UpdateMaterialTypeImage updates only the image URL of a material type
func (s *Store) UpdateMaterialTypeImage(ctx context.Context, id, imageURL string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE material_types
		SET image_url = $2
		WHERE id = $1
	`, id, imageURL)
	return err
}

// DeleteMaterialType deletes a material type by ID
func (s *Store) DeleteMaterialType(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `
		DELETE FROM material_types
		WHERE id = $1
	`, id)
	return err
}

// UpdateMaterialAvailability updates the availability count for a distribution center
// Only material types that exist in material_types table will be stored
func (s *Store) UpdateMaterialAvailability(ctx context.Context, distributionCenterID string, availability map[string]int) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete existing availability for this distribution center
	_, err = tx.ExecContext(ctx, `
		DELETE FROM material_available
		WHERE distribution_center_id = $1
	`, distributionCenterID)
	if err != nil {
		return err
	}

	// Get list of valid material type IDs from material_types table
	rows, err := tx.QueryContext(ctx, `SELECT id FROM material_types`)
	if err != nil {
		return err
	}
	defer rows.Close()

	validTypeIDs := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		validTypeIDs[id] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// Insert new availability records only for known material types
	for materialTypeID, amount := range availability {
		if !validTypeIDs[materialTypeID] {
			// Skip unknown material types
			continue
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO material_available (material_type_id, distribution_center_id, amount)
			VALUES ($1, $2, $3)
		`, materialTypeID, distributionCenterID, amount)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// Distribution Center CRUD operations

// ListDistributionCenters returns all distribution centers
func (s *Store) ListDistributionCenters(ctx context.Context) ([]domain.DistributionCenter, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, address, socket_path, created_at
		FROM distribution_centers
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.DistributionCenter
	for rows.Next() {
		var dc domain.DistributionCenter
		var socketPath sql.NullString
		if err := rows.Scan(&dc.ID, &dc.Name, &dc.Address, &socketPath, &dc.CreatedAt); err != nil {
			return nil, err
		}
		if socketPath.Valid {
			dc.SocketPath = socketPath.String
		}
		result = append(result, dc)
	}
	if result == nil {
		result = []domain.DistributionCenter{}
	}
	return result, rows.Err()
}

// GetDistributionCenterByID returns a single distribution center by ID
func (s *Store) GetDistributionCenterByID(ctx context.Context, id string) (domain.DistributionCenter, error) {
	var dc domain.DistributionCenter
	var socketPath sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, address, socket_path, created_at
		FROM distribution_centers
		WHERE id = $1
	`, id).Scan(&dc.ID, &dc.Name, &dc.Address, &socketPath, &dc.CreatedAt)
	if err != nil {
		return domain.DistributionCenter{}, err
	}
	if socketPath.Valid {
		dc.SocketPath = socketPath.String
	}
	return dc, nil
}

// GetDistributionCenterBySocketPath returns a distribution center by socket path
func (s *Store) GetDistributionCenterBySocketPath(ctx context.Context, socketPath string) (domain.DistributionCenter, error) {
	var dc domain.DistributionCenter
	var socketPathNull sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, address, socket_path, created_at
		FROM distribution_centers
		WHERE socket_path = $1
	`, socketPath).Scan(&dc.ID, &dc.Name, &dc.Address, &socketPathNull, &dc.CreatedAt)
	if err != nil {
		return domain.DistributionCenter{}, err
	}
	if socketPathNull.Valid {
		dc.SocketPath = socketPathNull.String
	}
	return dc, nil
}

// CreateDistributionCenter creates a new distribution center
func (s *Store) CreateDistributionCenter(ctx context.Context, input domain.CreateDistributionCenterInput) (domain.DistributionCenter, error) {
	var dc domain.DistributionCenter
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO distribution_centers (name, address)
		VALUES ($1, $2)
		RETURNING id, name, address, created_at
	`, input.Name, input.Address).Scan(&dc.ID, &dc.Name, &dc.Address, &dc.CreatedAt)
	if err != nil {
		return domain.DistributionCenter{}, err
	}
	return dc, nil
}

// CreateDistributionCenterWithSocket creates a new distribution center with socket path (for auto-registration)
func (s *Store) CreateDistributionCenterWithSocket(ctx context.Context, name, address, socketPath string) (domain.DistributionCenter, error) {
	var dc domain.DistributionCenter
	var socketPathNull sql.NullString
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO distribution_centers (name, address, socket_path)
		VALUES ($1, $2, $3)
		RETURNING id, name, address, socket_path, created_at
	`, name, address, socketPath).Scan(&dc.ID, &dc.Name, &dc.Address, &socketPathNull, &dc.CreatedAt)
	if err != nil {
		return domain.DistributionCenter{}, err
	}
	if socketPathNull.Valid {
		dc.SocketPath = socketPathNull.String
	}
	return dc, nil
}

// UpdateDistributionCenter updates an existing distribution center
func (s *Store) UpdateDistributionCenter(ctx context.Context, id string, input domain.UpdateDistributionCenterInput) (domain.DistributionCenter, error) {
	var dc domain.DistributionCenter
	var socketPath sql.NullString
	err := s.db.QueryRowContext(ctx, `
		UPDATE distribution_centers
		SET name = $2, address = $3
		WHERE id = $1
		RETURNING id, name, address, socket_path, created_at
	`, id, input.Name, input.Address).Scan(&dc.ID, &dc.Name, &dc.Address, &socketPath, &dc.CreatedAt)
	if err != nil {
		return domain.DistributionCenter{}, err
	}
	if socketPath.Valid {
		dc.SocketPath = socketPath.String
	}
	return dc, nil
}

// DeleteDistributionCenter deletes a distribution center by ID
func (s *Store) DeleteDistributionCenter(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `
		DELETE FROM distribution_centers
		WHERE id = $1
	`, id)
	return err
}

// CreateRequestInput is kept for backwards compatibility during migration
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

func (s *Store) CreateRequest(ctx context.Context, input domain.CreateRequestInput) (domain.Request, error) {
	slog.Info("store_create_request_started",
		"customer_id", input.CustomerID,
		"delivery_date", input.DeliveryDate,
		"item_count", len(input.Items),
	)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Info("store_create_request_transaction_failed", "error", err.Error())
		return domain.Request{}, err
	}
	defer tx.Rollback()

	slog.Info("store_create_request_transaction_begun")

	metadata := make(map[string]any)
	if input.Note != "" {
		metadata["note"] = input.Note
	}

	// Convert metadata map to JSON bytes for PostgreSQL
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		slog.Info("store_create_request_metadata_marshal_failed", "error", err.Error())
		return domain.Request{}, err
	}

	slog.Info("store_create_request_inserting_request",
		"customer_id", input.CustomerID,
		"delivery_date", input.DeliveryDate,
	)

	var req domain.Request
	var approvedDistributionCenterID sql.NullString
	var outgoingTrackingCode sql.NullString
	var plannedReturnDate sql.NullTime
	var metadataBytes []byte
	err = tx.QueryRowContext(ctx, `
		INSERT INTO requests (customer_id, delivery_date, planned_return_date, intended_students, status, approved_distribution_center_id, shipping_customer_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata)
		VALUES ($1, $2, $3, $4, 'pending', NULL, $5, $6, $7, $8, $9, $10)
		RETURNING id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, "outgoingTrackingCode", shipping_customer_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata, created_at, updated_at
	`, input.CustomerID, input.DeliveryDate, input.PlannedReturnDate, input.IntendedStudents, input.ShippingCustomerName, input.ShippingAddressLine1, input.ShippingAddressLine2, input.ShippingCity, input.ShippingZipCode, metadataJSON).Scan(
		&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &outgoingTrackingCode, &req.ShippingCustomerName,
		&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
		&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		slog.Info("store_create_request_insert_failed", "error", err.Error())
		return domain.Request{}, err
	}

	// Unmarshal metadata JSON bytes to map
	if len(metadataBytes) > 0 {
		req.Metadata = make(map[string]any)
		if err := json.Unmarshal(metadataBytes, &req.Metadata); err != nil {
			slog.Info("store_create_request_metadata_unmarshal_failed", "error", err.Error())
			// Don't fail the request if metadata unmarshal fails
			req.Metadata = nil
		}
	}
	if approvedDistributionCenterID.Valid {
		req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
	}
	if outgoingTrackingCode.Valid {
		req.OutgoingTrackingCode = &outgoingTrackingCode.String
	}
	if plannedReturnDate.Valid {
		req.PlannedReturnDate = &plannedReturnDate.Time
	}

	slog.Info("store_create_request_inserted",
		"request_id", req.ID,
		"customer_id", req.CustomerID,
	)

	slog.Info("store_create_request_inserting_items",
		"request_id", req.ID,
		"item_count", len(input.Items),
	)

	for i, item := range input.Items {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO request_items (request_id, material_type_id, quantity)
			VALUES ($1, $2, $3)
		`, req.ID, item.MaterialTypeID, item.Quantity)
		if err != nil {
			slog.Info("store_create_request_item_insert_failed",
				"request_id", req.ID,
				"index", i,
				"material_type_id", item.MaterialTypeID,
				"error", err.Error(),
			)
			return domain.Request{}, err
		}
		req.Items = append(req.Items, item)
	}

	slog.Info("store_create_request_items_inserted",
		"request_id", req.ID,
		"items_inserted", len(req.Items),
	)

	if err = tx.Commit(); err != nil {
		slog.Info("store_create_request_commit_failed",
			"request_id", req.ID,
			"error", err.Error(),
		)
		return domain.Request{}, err
	}

	slog.Info("store_create_request_completed",
		"request_id", req.ID,
		"customer_id", req.CustomerID,
		"item_count", len(req.Items),
	)

	return req, nil
}

// ListRequestsByCustomerID returns all requests for a specific customer with their items
func (s *Store) ListRequestsByCustomerID(ctx context.Context, customerID string) ([]domain.Request, error) {
	slog.Info("store_list_requests_started", "customer_id", customerID)

	// First, get all requests for the customer
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, shipping_customer_name,
		       "outgoingTrackingCode", shipping_address_line1, shipping_address_line2, shipping_city,
		       shipping_zip_code, metadata, created_at, updated_at
		FROM requests
		WHERE customer_id = $1
		ORDER BY created_at DESC
	`, customerID)
	if err != nil {
		slog.Info("store_list_requests_query_failed", "customer_id", customerID, "error", err.Error())
		return nil, err
	}
	defer rows.Close()

	requests := make([]domain.Request, 0)
	for rows.Next() {
		var req domain.Request
		var approvedDistributionCenterID sql.NullString
		var outgoingTrackingCode sql.NullString
		var plannedReturnDate sql.NullTime
		var metadataBytes []byte
		err := rows.Scan(
			&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &req.ShippingCustomerName, &outgoingTrackingCode,
			&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
			&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
		)
		if err != nil {
			slog.Info("store_list_requests_scan_failed", "customer_id", customerID, "error", err.Error())
			return nil, err
		}
		if approvedDistributionCenterID.Valid {
			req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
		}
		if outgoingTrackingCode.Valid {
			req.OutgoingTrackingCode = &outgoingTrackingCode.String
		}
		if plannedReturnDate.Valid {
			req.PlannedReturnDate = &plannedReturnDate.Time
		}

		// Unmarshal metadata
		if len(metadataBytes) > 0 {
			req.Metadata = make(map[string]any)
			if err := json.Unmarshal(metadataBytes, &req.Metadata); err != nil {
				slog.Info("store_list_requests_metadata_unmarshal_failed", "request_id", req.ID, "error", err.Error())
				req.Metadata = nil
			}
		}

		requests = append(requests, req)
	}

	if err := rows.Err(); err != nil {
		slog.Info("store_list_requests_rows_error", "customer_id", customerID, "error", err.Error())
		return nil, err
	}

	// Now fetch items for each request
	for i := range requests {
		itemRows, err := s.db.QueryContext(ctx, `
			SELECT material_type_id, quantity
			FROM request_items
			WHERE request_id = $1
		`, requests[i].ID)
		if err != nil {
			slog.Info("store_list_requests_items_query_failed", "request_id", requests[i].ID, "error", err.Error())
			return nil, err
		}

		for itemRows.Next() {
			var item domain.RequestItem
			if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
				itemRows.Close()
				slog.Info("store_list_requests_item_scan_failed", "request_id", requests[i].ID, "error", err.Error())
				return nil, err
			}
			requests[i].Items = append(requests[i].Items, item)
		}
		itemRows.Close()

		if err := itemRows.Err(); err != nil {
			slog.Info("store_list_requests_items_rows_error", "request_id", requests[i].ID, "error", err.Error())
			return nil, err
		}
	}

	slog.Info("store_list_requests_completed", "customer_id", customerID, "count", len(requests))
	return requests, nil
}

// CancelRequestByCustomer marks a customer's own pending/approved request as cancelled.
func (s *Store) CancelRequestByCustomer(ctx context.Context, requestID, customerID string) (domain.Request, error) {
	var req domain.Request
	var approvedDistributionCenterID sql.NullString
	var outgoingTrackingCode sql.NullString
	var plannedReturnDate sql.NullTime
	var metadataBytes []byte

	err := s.db.QueryRowContext(ctx, `
		UPDATE requests
		SET status = 'cancelled', approved_distribution_center_id = NULL, "outgoingTrackingCode" = NULL
		WHERE id = $1 AND customer_id = $2 AND status IN ('pending', 'approved') AND archived = FALSE
		RETURNING id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, "outgoingTrackingCode", shipping_customer_name,
		          shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata, created_at, updated_at
	`, requestID, customerID).Scan(
		&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &outgoingTrackingCode, &req.ShippingCustomerName,
		&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
		&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
	)
	if err == nil {
		if plannedReturnDate.Valid {
			req.PlannedReturnDate = &plannedReturnDate.Time
		}
		if len(metadataBytes) > 0 {
			req.Metadata = make(map[string]any)
			if unmarshalErr := json.Unmarshal(metadataBytes, &req.Metadata); unmarshalErr != nil {
				req.Metadata = nil
			}
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return domain.Request{}, err
	}

	if errors.Is(err, sql.ErrNoRows) {
		var existingStatus string
		var existingArchived bool
		err = s.db.QueryRowContext(ctx, `
			SELECT status, archived
			FROM requests
			WHERE id = $1 AND customer_id = $2
		`, requestID, customerID).Scan(&existingStatus, &existingArchived)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Request{}, ErrRequestNotFound
		}
		if err != nil {
			return domain.Request{}, err
		}
		return domain.Request{}, ErrInvalidRequestStatus
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT material_type_id, quantity
		FROM request_items
		WHERE request_id = $1
	`, req.ID)
	if err != nil {
		return domain.Request{}, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var item domain.RequestItem
		if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
			return domain.Request{}, err
		}
		req.Items = append(req.Items, item)
	}
	if err := itemRows.Err(); err != nil {
		return domain.Request{}, err
	}

	return req, nil
}

// ListRequests returns all requests, optionally filtered by status and archive state.
func (s *Store) ListRequests(ctx context.Context, status, distributionCenterID string, archived *bool) ([]domain.Request, error) {
	slog.Info("store_list_all_requests_started", "status", status, "distribution_center_id", distributionCenterID, "archived", archived)

	query := `
		SELECT id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, shipping_customer_name,
		       "outgoingTrackingCode", shipping_address_line1, shipping_address_line2, shipping_city,
		       shipping_zip_code, metadata, created_at, updated_at
		FROM requests
	`
	args := []any{}
	where := []string{}
	if strings.TrimSpace(status) != "" {
		args = append(args, status)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}
	if archived != nil {
		args = append(args, *archived)
		where = append(where, fmt.Sprintf("archived = $%d", len(args)))
	}
	if strings.TrimSpace(distributionCenterID) != "" {
		args = append(args, distributionCenterID)
		where = append(where, fmt.Sprintf("(approved_distribution_center_id IS NULL OR approved_distribution_center_id = $%d)", len(args)))
	} else {
		where = append(where, "approved_distribution_center_id IS NULL")
	}
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	query += " ORDER BY created_at DESC"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		slog.Info("store_list_all_requests_query_failed", "status", status, "error", err.Error())
		return nil, err
	}
	defer rows.Close()

	requests := make([]domain.Request, 0)
	for rows.Next() {
		var req domain.Request
		var approvedDistributionCenterID sql.NullString
		var outgoingTrackingCode sql.NullString
		var plannedReturnDate sql.NullTime
		var metadataBytes []byte
		err := rows.Scan(
			&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &req.ShippingCustomerName, &outgoingTrackingCode,
			&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
			&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
		)
		if err != nil {
			slog.Info("store_list_all_requests_scan_failed", "status", status, "error", err.Error())
			return nil, err
		}
		if approvedDistributionCenterID.Valid {
			req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
		}
		if outgoingTrackingCode.Valid {
			req.OutgoingTrackingCode = &outgoingTrackingCode.String
		}
		if plannedReturnDate.Valid {
			req.PlannedReturnDate = &plannedReturnDate.Time
		}

		if len(metadataBytes) > 0 {
			req.Metadata = make(map[string]any)
			if err := json.Unmarshal(metadataBytes, &req.Metadata); err != nil {
				slog.Info("store_list_all_requests_metadata_unmarshal_failed", "request_id", req.ID, "error", err.Error())
				req.Metadata = nil
			}
		}

		requests = append(requests, req)
	}

	if err := rows.Err(); err != nil {
		slog.Info("store_list_all_requests_rows_error", "status", status, "error", err.Error())
		return nil, err
	}

	for i := range requests {
		itemRows, err := s.db.QueryContext(ctx, `
			SELECT material_type_id, quantity
			FROM request_items
			WHERE request_id = $1
		`, requests[i].ID)
		if err != nil {
			slog.Info("store_list_all_requests_items_query_failed", "request_id", requests[i].ID, "error", err.Error())
			return nil, err
		}

		for itemRows.Next() {
			var item domain.RequestItem
			if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
				itemRows.Close()
				slog.Info("store_list_all_requests_item_scan_failed", "request_id", requests[i].ID, "error", err.Error())
				return nil, err
			}
			requests[i].Items = append(requests[i].Items, item)
		}
		itemRows.Close()

		if err := itemRows.Err(); err != nil {
			slog.Info("store_list_all_requests_items_rows_error", "request_id", requests[i].ID, "error", err.Error())
			return nil, err
		}
	}

	slog.Info("store_list_all_requests_completed", "status", status, "distribution_center_id", distributionCenterID, "count", len(requests))
	return requests, nil
}

// ApproveRequest marks a pending request as approved by a distribution center.
func (s *Store) ApproveRequest(ctx context.Context, requestID, distributionCenterID string) (domain.Request, error) {
	var req domain.Request
	var approvedDistributionCenterID sql.NullString
	var outgoingTrackingCode sql.NullString
	var plannedReturnDate sql.NullTime
	var metadataBytes []byte

	err := s.db.QueryRowContext(ctx, `
		UPDATE requests
		SET status = 'approved', approved_distribution_center_id = $2
		WHERE id = $1 AND status = 'pending' AND archived = FALSE
		RETURNING id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, "outgoingTrackingCode", shipping_customer_name,
		          shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata, created_at, updated_at
	`, requestID, distributionCenterID).Scan(
		&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &outgoingTrackingCode, &req.ShippingCustomerName,
		&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
		&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
	)
	if err == nil {
		if approvedDistributionCenterID.Valid {
			req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
		}
		if outgoingTrackingCode.Valid {
			req.OutgoingTrackingCode = &outgoingTrackingCode.String
		}
		if plannedReturnDate.Valid {
			req.PlannedReturnDate = &plannedReturnDate.Time
		}
		if len(metadataBytes) > 0 {
			req.Metadata = make(map[string]any)
			if unmarshalErr := json.Unmarshal(metadataBytes, &req.Metadata); unmarshalErr != nil {
				req.Metadata = nil
			}
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return domain.Request{}, err
	}

	if errors.Is(err, sql.ErrNoRows) {
		var existingStatus string
		var existingApprovedDistributionCenterID sql.NullString
		err = s.db.QueryRowContext(ctx, `
			SELECT status, approved_distribution_center_id
			FROM requests
			WHERE id = $1
		`, requestID).Scan(&existingStatus, &existingApprovedDistributionCenterID)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Request{}, ErrRequestNotFound
		}
		if err != nil {
			return domain.Request{}, err
		}
		if existingStatus == "approved" && existingApprovedDistributionCenterID.Valid && existingApprovedDistributionCenterID.String != distributionCenterID {
			return domain.Request{}, ErrRequestAlreadyApproved
		}
		return domain.Request{}, ErrInvalidRequestStatus
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT material_type_id, quantity
		FROM request_items
		WHERE request_id = $1
	`, req.ID)
	if err != nil {
		return domain.Request{}, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var item domain.RequestItem
		if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
			return domain.Request{}, err
		}
		req.Items = append(req.Items, item)
	}
	if err := itemRows.Err(); err != nil {
		return domain.Request{}, err
	}

	return req, nil
}

// MarkRequestInAction marks an approved request as inAction and stores outgoing tracking code.
func (s *Store) MarkRequestInAction(ctx context.Context, requestID, distributionCenterID, outgoingTrackingCode string) (domain.Request, error) {
	var req domain.Request
	var approvedDistributionCenterID sql.NullString
	var currentOutgoingTrackingCode sql.NullString
	var plannedReturnDate sql.NullTime
	var metadataBytes []byte

	err := s.db.QueryRowContext(ctx, `
		UPDATE requests
		SET status = 'inAction', "outgoingTrackingCode" = $3
		WHERE id = $1 AND status = 'approved' AND archived = FALSE AND approved_distribution_center_id = $2
		RETURNING id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, "outgoingTrackingCode", shipping_customer_name,
		          shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata, created_at, updated_at
	`, requestID, distributionCenterID, outgoingTrackingCode).Scan(
		&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &currentOutgoingTrackingCode, &req.ShippingCustomerName,
		&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
		&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
	)
	if err == nil {
		if approvedDistributionCenterID.Valid {
			req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
		}
		if currentOutgoingTrackingCode.Valid {
			req.OutgoingTrackingCode = &currentOutgoingTrackingCode.String
		}
		if plannedReturnDate.Valid {
			req.PlannedReturnDate = &plannedReturnDate.Time
		}
		if len(metadataBytes) > 0 {
			req.Metadata = make(map[string]any)
			if unmarshalErr := json.Unmarshal(metadataBytes, &req.Metadata); unmarshalErr != nil {
				req.Metadata = nil
			}
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return domain.Request{}, err
	}

	if errors.Is(err, sql.ErrNoRows) {
		var existingStatus string
		var existingApprovedDistributionCenterID sql.NullString
		err = s.db.QueryRowContext(ctx, `
			SELECT status, approved_distribution_center_id
			FROM requests
			WHERE id = $1
		`, requestID).Scan(&existingStatus, &existingApprovedDistributionCenterID)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Request{}, ErrRequestNotFound
		}
		if err != nil {
			return domain.Request{}, err
		}
		if existingApprovedDistributionCenterID.Valid && existingApprovedDistributionCenterID.String != distributionCenterID {
			return domain.Request{}, ErrRequestAlreadyApproved
		}
		return domain.Request{}, ErrInvalidRequestStatus
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT material_type_id, quantity
		FROM request_items
		WHERE request_id = $1
	`, req.ID)
	if err != nil {
		return domain.Request{}, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var item domain.RequestItem
		if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
			return domain.Request{}, err
		}
		req.Items = append(req.Items, item)
	}
	if err := itemRows.Err(); err != nil {
		return domain.Request{}, err
	}

	return req, nil
}

// CancelAssignedRequest reverts an approved/inAction request back to pending and clears assignment/tracking data.
func (s *Store) CancelAssignedRequest(ctx context.Context, requestID, distributionCenterID string) (domain.Request, error) {
	var req domain.Request
	var approvedDistributionCenterID sql.NullString
	var currentOutgoingTrackingCode sql.NullString
	var plannedReturnDate sql.NullTime
	var metadataBytes []byte

	err := s.db.QueryRowContext(ctx, `
		UPDATE requests
		SET status = 'pending', approved_distribution_center_id = NULL, "outgoingTrackingCode" = NULL
		WHERE id = $1 AND status IN ('approved', 'inAction') AND archived = FALSE AND approved_distribution_center_id = $2
		RETURNING id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, "outgoingTrackingCode", shipping_customer_name,
		          shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata, created_at, updated_at
	`, requestID, distributionCenterID).Scan(
		&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &currentOutgoingTrackingCode, &req.ShippingCustomerName,
		&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
		&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
	)
	if err == nil {
		if approvedDistributionCenterID.Valid {
			req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
		}
		if currentOutgoingTrackingCode.Valid {
			req.OutgoingTrackingCode = &currentOutgoingTrackingCode.String
		}
		if plannedReturnDate.Valid {
			req.PlannedReturnDate = &plannedReturnDate.Time
		}
		if len(metadataBytes) > 0 {
			req.Metadata = make(map[string]any)
			if unmarshalErr := json.Unmarshal(metadataBytes, &req.Metadata); unmarshalErr != nil {
				req.Metadata = nil
			}
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return domain.Request{}, err
	}

	if errors.Is(err, sql.ErrNoRows) {
		var existingStatus string
		var existingApprovedDistributionCenterID sql.NullString
		err = s.db.QueryRowContext(ctx, `
			SELECT status, approved_distribution_center_id
			FROM requests
			WHERE id = $1
		`, requestID).Scan(&existingStatus, &existingApprovedDistributionCenterID)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Request{}, ErrRequestNotFound
		}
		if err != nil {
			return domain.Request{}, err
		}
		if existingApprovedDistributionCenterID.Valid && existingApprovedDistributionCenterID.String != distributionCenterID {
			return domain.Request{}, ErrRequestAlreadyApproved
		}
		return domain.Request{}, ErrInvalidRequestStatus
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT material_type_id, quantity
		FROM request_items
		WHERE request_id = $1
	`, req.ID)
	if err != nil {
		return domain.Request{}, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var item domain.RequestItem
		if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
			return domain.Request{}, err
		}
		req.Items = append(req.Items, item)
	}
	if err := itemRows.Err(); err != nil {
		return domain.Request{}, err
	}

	return req, nil
}

// ArchiveRequest marks request as archived without changing its status.
func (s *Store) ArchiveRequest(ctx context.Context, requestID, distributionCenterID string) (domain.Request, error) {
	var req domain.Request
	var approvedDistributionCenterID sql.NullString
	var outgoingTrackingCode sql.NullString
	var plannedReturnDate sql.NullTime
	var metadataBytes []byte

	err := s.db.QueryRowContext(ctx, `
		UPDATE requests
		SET archived = TRUE
		WHERE id = $1
		  AND archived = FALSE
		  AND (approved_distribution_center_id IS NULL OR approved_distribution_center_id = $2)
		RETURNING id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, "outgoingTrackingCode", shipping_customer_name,
		          shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata, created_at, updated_at
	`, requestID, distributionCenterID).Scan(
		&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &outgoingTrackingCode, &req.ShippingCustomerName,
		&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
		&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return domain.Request{}, err
	}

	if errors.Is(err, sql.ErrNoRows) {
		var existingApprovedDistributionCenterID sql.NullString
		var alreadyArchived bool
		err = s.db.QueryRowContext(ctx, `
			SELECT approved_distribution_center_id, archived
			FROM requests
			WHERE id = $1
		`, requestID).Scan(&existingApprovedDistributionCenterID, &alreadyArchived)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Request{}, ErrRequestNotFound
		}
		if err != nil {
			return domain.Request{}, err
		}
		if existingApprovedDistributionCenterID.Valid && existingApprovedDistributionCenterID.String != distributionCenterID {
			return domain.Request{}, ErrRequestAlreadyApproved
		}
		if alreadyArchived {
			return domain.Request{}, ErrInvalidRequestStatus
		}
		return domain.Request{}, ErrInvalidRequestStatus
	}

	if approvedDistributionCenterID.Valid {
		req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
	}
	if outgoingTrackingCode.Valid {
		req.OutgoingTrackingCode = &outgoingTrackingCode.String
	}
	if plannedReturnDate.Valid {
		req.PlannedReturnDate = &plannedReturnDate.Time
	}
	if len(metadataBytes) > 0 {
		req.Metadata = make(map[string]any)
		if unmarshalErr := json.Unmarshal(metadataBytes, &req.Metadata); unmarshalErr != nil {
			req.Metadata = nil
		}
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT material_type_id, quantity
		FROM request_items
		WHERE request_id = $1
	`, req.ID)
	if err != nil {
		return domain.Request{}, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var item domain.RequestItem
		if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
			return domain.Request{}, err
		}
		req.Items = append(req.Items, item)
	}
	if err := itemRows.Err(); err != nil {
		return domain.Request{}, err
	}

	return req, nil
}

// UnarchiveRequest marks request as unarchived without changing its status.
func (s *Store) UnarchiveRequest(ctx context.Context, requestID, distributionCenterID string) (domain.Request, error) {
	var req domain.Request
	var approvedDistributionCenterID sql.NullString
	var outgoingTrackingCode sql.NullString
	var plannedReturnDate sql.NullTime
	var metadataBytes []byte

	err := s.db.QueryRowContext(ctx, `
		UPDATE requests
		SET archived = FALSE
		WHERE id = $1
		  AND archived = TRUE
		  AND (approved_distribution_center_id IS NULL OR approved_distribution_center_id = $2)
		RETURNING id, customer_id, delivery_date, planned_return_date, intended_students, status, archived, approved_distribution_center_id, "outgoingTrackingCode", shipping_customer_name,
		          shipping_address_line1, shipping_address_line2, shipping_city, shipping_zip_code, metadata, created_at, updated_at
	`, requestID, distributionCenterID).Scan(
		&req.ID, &req.CustomerID, &req.DeliveryDate, &plannedReturnDate, &req.IntendedStudents, &req.Status, &req.Archived, &approvedDistributionCenterID, &outgoingTrackingCode, &req.ShippingCustomerName,
		&req.ShippingAddressLine1, &req.ShippingAddressLine2, &req.ShippingCity, &req.ShippingZipCode,
		&metadataBytes, &req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return domain.Request{}, err
	}

	if errors.Is(err, sql.ErrNoRows) {
		var existingApprovedDistributionCenterID sql.NullString
		var alreadyArchived bool
		err = s.db.QueryRowContext(ctx, `
			SELECT approved_distribution_center_id, archived
			FROM requests
			WHERE id = $1
		`, requestID).Scan(&existingApprovedDistributionCenterID, &alreadyArchived)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Request{}, ErrRequestNotFound
		}
		if err != nil {
			return domain.Request{}, err
		}
		if existingApprovedDistributionCenterID.Valid && existingApprovedDistributionCenterID.String != distributionCenterID {
			return domain.Request{}, ErrRequestAlreadyApproved
		}
		if !alreadyArchived {
			return domain.Request{}, ErrInvalidRequestStatus
		}
		return domain.Request{}, ErrInvalidRequestStatus
	}

	if approvedDistributionCenterID.Valid {
		req.ApprovedDistributionCenterID = &approvedDistributionCenterID.String
	}
	if outgoingTrackingCode.Valid {
		req.OutgoingTrackingCode = &outgoingTrackingCode.String
	}
	if plannedReturnDate.Valid {
		req.PlannedReturnDate = &plannedReturnDate.Time
	}
	if len(metadataBytes) > 0 {
		req.Metadata = make(map[string]any)
		if unmarshalErr := json.Unmarshal(metadataBytes, &req.Metadata); unmarshalErr != nil {
			req.Metadata = nil
		}
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT material_type_id, quantity
		FROM request_items
		WHERE request_id = $1
	`, req.ID)
	if err != nil {
		return domain.Request{}, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var item domain.RequestItem
		if err := itemRows.Scan(&item.MaterialTypeID, &item.Quantity); err != nil {
			return domain.Request{}, err
		}
		req.Items = append(req.Items, item)
	}
	if err := itemRows.Err(); err != nil {
		return domain.Request{}, err
	}

	return req, nil
}

func (s *Store) GetRequestStatus(ctx context.Context, requestID string) string {
	var status string
	err := s.db.QueryRowContext(ctx, `
		SELECT status FROM requests WHERE id = $1
	`, requestID).Scan(&status)
	if err != nil {
		return ""
	}
	return status
}
