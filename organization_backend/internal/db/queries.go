package db

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"organization_backend/internal/domain"

	"github.com/google/uuid"
	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

type Store struct {
	db *sql.DB
}

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
	return result, rows.Err()
}

// ListMaterialTypesWithAvailability returns all material types with available counts summed from material_available table
func (s *Store) ListMaterialTypesWithAvailability(ctx context.Context) ([]domain.MaterialType, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT 
			mt.id, 
			mt.name, 
			mt.description, 
			mt.image_url,
			COALESCE(SUM(ma.amount), 0) as available_count
		FROM material_types mt
		LEFT JOIN material_available ma ON mt.id = ma.material_type_id
		GROUP BY mt.id, mt.name, mt.description, mt.image_url
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
