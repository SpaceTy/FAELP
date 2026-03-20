package db

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"distribution_backend/internal/domain"
	"github.com/lib/pq"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// ListMaterialInstancesParams contains filters for listing material instances
type ListMaterialInstancesParams struct {
	TypeID    string
	Status    string
	Location  string
	HumanCode string
	Query     string
	Limit     int
	Offset    int
}

// UpsertMaterialInstanceInput contains fields for CSV inventory import.
type UpsertMaterialInstanceInput struct {
	HumanCode        string
	TypeID           string
	Description      string
	Status           string
	UseCount         int
	Location         string
	CurrentRequestID *string
}

// InventorySummary represents count of instances by type and status
type InventorySummary struct {
	TypeID string `json:"typeId"`
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// CreateMaterialInstance creates a new material instance with an auto-generated ID
func (s *Store) CreateMaterialInstance(ctx context.Context, input domain.CreateMaterialInstanceInput) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO material_instances (id, human_code, type_id, description, status, use_count, location)
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`, input.HumanCode, input.TypeID, input.Description, domain.StatusAvailable, input.UseCount, input.Location).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// CreateMaterialInstancesBulk creates many inventory items with generated human codes in one transaction.
func (s *Store) CreateMaterialInstancesBulk(ctx context.Context, input domain.BulkCreateMaterialInstancesInput, location string) ([]domain.MaterialInstance, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO material_instances (id, human_code, type_id, description, status, use_count, location)
		VALUES (gen_random_uuid()::text, $1, $2, '', $3, 0, $4)
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	items := make([]domain.MaterialInstance, 0, input.Quantity)
	generatedCodes := make(map[string]struct{}, input.Quantity)

	for range input.Quantity {
		created := false
		for attempts := 0; attempts < 50; attempts++ {
			code, codeErr := randomHumanCode()
			if codeErr != nil {
				err = codeErr
				return nil, err
			}
			if _, exists := generatedCodes[code]; exists {
				continue
			}

			var row materialInstanceRow
			scanErr := stmt.QueryRowContext(ctx, code, input.TypeID, domain.StatusAvailable, location).Scan(
				&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
				&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
			)
			if scanErr == nil {
				generatedCodes[code] = struct{}{}
				items = append(items, mapMaterialInstance(row))
				created = true
				break
			}

			var pqErr *pq.Error
			if errors.As(scanErr, &pqErr) && pqErr.Code == "23505" && pqErr.Constraint == "material_instances_human_code_key" {
				continue
			}

			err = scanErr
			return nil, err
		}

		if !created {
			err = fmt.Errorf("failed to generate a unique material code for bulk add")
			return nil, err
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return items, nil
}

// GetMaterialInstanceByID returns a single material instance by ID
func (s *Store) GetMaterialInstanceByID(ctx context.Context, id string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		SELECT id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
		FROM material_instances
		WHERE id = $1
	`, id).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// GetInstancesByRequestID returns all material instances currently assigned to a request.
func (s *Store) GetInstancesByRequestID(ctx context.Context, requestID string) ([]domain.MaterialInstance, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
		FROM material_instances
		WHERE current_request_id = $1
		ORDER BY type_id, human_code
	`, requestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.MaterialInstance
	for rows.Next() {
		var row materialInstanceRow
		if err := rows.Scan(
			&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
			&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, mapMaterialInstance(row))
	}
	if result == nil {
		result = []domain.MaterialInstance{}
	}
	return result, rows.Err()
}

// GetMaterialInstanceByHumanCode returns a single material instance by human code
func (s *Store) GetMaterialInstanceByHumanCode(ctx context.Context, humanCode string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		SELECT id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
		FROM material_instances
		WHERE human_code = $1
	`, humanCode).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// ListMaterialInstances returns material instances with optional filters
func (s *Store) ListMaterialInstances(ctx context.Context, params ListMaterialInstancesParams) ([]domain.MaterialInstance, error) {
	args := []any{}
	where := []string{"1=1"}

	if params.TypeID != "" {
		args = append(args, params.TypeID)
		where = append(where, fmt.Sprintf("type_id = $%d", len(args)))
	}
	if params.Status != "" {
		args = append(args, params.Status)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}
	if params.Location != "" {
		args = append(args, params.Location)
		where = append(where, fmt.Sprintf("location = $%d", len(args)))
	}
	if params.HumanCode != "" {
		args = append(args, params.HumanCode)
		where = append(where, fmt.Sprintf("human_code = $%d", len(args)))
	}
	if params.Query != "" {
		args = append(args, "%"+params.Query+"%")
		searchArgPos := len(args)
		where = append(where, fmt.Sprintf(`(
			id ILIKE $%[1]d OR
			human_code ILIKE $%[1]d OR
			type_id ILIKE $%[1]d OR
			description ILIKE $%[1]d OR
			location ILIKE $%[1]d
		)`, searchArgPos))
	}

	limit := params.Limit
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
		FROM material_instances
		WHERE %s
		ORDER BY updated_at DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(where, " AND "), len(args)-1, len(args))

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.MaterialInstance
	for rows.Next() {
		var row materialInstanceRow
		if err := rows.Scan(
			&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
			&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, mapMaterialInstance(row))
	}
	if result == nil {
		result = []domain.MaterialInstance{}
	}
	return result, rows.Err()
}

// ListMaterialInstancesForExport returns all material instances matching optional filters.
func (s *Store) ListMaterialInstancesForExport(ctx context.Context, params ListMaterialInstancesParams) ([]domain.MaterialInstance, error) {
	args := []any{}
	where := []string{"1=1"}

	if params.TypeID != "" {
		args = append(args, params.TypeID)
		where = append(where, fmt.Sprintf("type_id = $%d", len(args)))
	}
	if params.Status != "" {
		args = append(args, params.Status)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}
	if params.Location != "" {
		args = append(args, params.Location)
		where = append(where, fmt.Sprintf("location = $%d", len(args)))
	}
	if params.HumanCode != "" {
		args = append(args, params.HumanCode)
		where = append(where, fmt.Sprintf("human_code = $%d", len(args)))
	}
	if params.Query != "" {
		args = append(args, "%"+params.Query+"%")
		searchArgPos := len(args)
		where = append(where, fmt.Sprintf(`(
			id ILIKE $%[1]d OR
			human_code ILIKE $%[1]d OR
			type_id ILIKE $%[1]d OR
			description ILIKE $%[1]d OR
			location ILIKE $%[1]d
		)`, searchArgPos))
	}

	query := fmt.Sprintf(`
		SELECT id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
		FROM material_instances
		WHERE %s
		ORDER BY updated_at DESC
	`, strings.Join(where, " AND "))

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.MaterialInstance
	for rows.Next() {
		var row materialInstanceRow
		if err := rows.Scan(
			&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
			&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, mapMaterialInstance(row))
	}
	if result == nil {
		result = []domain.MaterialInstance{}
	}
	return result, rows.Err()
}

// UpsertMaterialInstances inserts or updates material instances by human_code.
func (s *Store) UpsertMaterialInstances(ctx context.Context, inputs []UpsertMaterialInstanceInput) (createdCount int, updatedCount int, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO material_instances (id, human_code, type_id, description, status, use_count, location, current_request_id)
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (human_code) DO UPDATE SET
			type_id = EXCLUDED.type_id,
			description = EXCLUDED.description,
			status = EXCLUDED.status,
			use_count = EXCLUDED.use_count,
			location = EXCLUDED.location,
			current_request_id = EXCLUDED.current_request_id,
			updated_at = NOW()
		RETURNING (xmax = 0) AS inserted
	`)
	if err != nil {
		return 0, 0, err
	}
	defer stmt.Close()

	for _, input := range inputs {
		var inserted bool
		if err = stmt.QueryRowContext(
			ctx,
			input.HumanCode,
			input.TypeID,
			input.Description,
			input.Status,
			input.UseCount,
			input.Location,
			input.CurrentRequestID,
		).Scan(&inserted); err != nil {
			return 0, 0, err
		}
		if inserted {
			createdCount++
		} else {
			updatedCount++
		}
	}

	if err = tx.Commit(); err != nil {
		return 0, 0, err
	}

	return createdCount, updatedCount, nil
}

// UpdateMaterialInstance updates a material instance
func (s *Store) UpdateMaterialInstance(ctx context.Context, id string, input domain.UpdateMaterialInstanceInput) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2, location = $3
		WHERE id = $1
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`, id, input.Status, input.Location).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// DeleteMaterialInstance deletes a material instance by ID
func (s *Store) DeleteMaterialInstance(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `
		DELETE FROM material_instances
		WHERE id = $1
	`, id)
	return err
}

// ArchiveMaterialInstance marks a material instance as archived.
func (s *Store) ArchiveMaterialInstance(ctx context.Context, id string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2, current_request_id = NULL
		WHERE id = $1
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`, id, domain.StatusArchived).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// UnarchiveMaterialInstance marks a material instance as available again.
func (s *Store) UnarchiveMaterialInstance(ctx context.Context, id string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2
		WHERE id = $1 AND status = $3
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`, id, domain.StatusAvailable, domain.StatusArchived).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// AssignToRequest assigns a material instance to a request (renting)
func (s *Store) AssignToRequest(ctx context.Context, instanceID string, requestID string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2, current_request_id = $3
		WHERE id = $1 AND status = $4
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`, instanceID, domain.StatusRented, requestID, domain.StatusAvailable).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// ReleaseFromRequest releases a material instance from a request (returning) and increments use_count
func (s *Store) ReleaseFromRequest(ctx context.Context, instanceID string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2, current_request_id = NULL, use_count = use_count + 1
		WHERE id = $1 AND status = $3
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`, instanceID, domain.StatusReturned, domain.StatusRented).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// CountByTypeAndStatus returns inventory summary grouped by type and status
func (s *Store) CountByTypeAndStatus(ctx context.Context) ([]InventorySummary, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT type_id, status, COUNT(*) as count
		FROM material_instances
		GROUP BY type_id, status
		ORDER BY type_id, status
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []InventorySummary
	for rows.Next() {
		var summary InventorySummary
		if err := rows.Scan(&summary.TypeID, &summary.Status, &summary.Count); err != nil {
			return nil, err
		}
		result = append(result, summary)
	}
	if result == nil {
		result = []InventorySummary{}
	}
	return result, rows.Err()
}

// MaterialAvailability represents the count of available instances for a material type
type MaterialAvailability struct {
	MaterialTypeID string `json:"material_type_id"`
	Amount         int    `json:"amount"`
}

// GetAvailableCountsByType returns the count of available material instances grouped by type_id
func (s *Store) GetAvailableCountsByType(ctx context.Context) ([]MaterialAvailability, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT type_id, COUNT(*) as amount
		FROM material_instances
		WHERE status = $1
		GROUP BY type_id
		ORDER BY type_id
	`, domain.StatusAvailable)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []MaterialAvailability
	for rows.Next() {
		var avail MaterialAvailability
		if err := rows.Scan(&avail.MaterialTypeID, &avail.Amount); err != nil {
			return nil, err
		}
		result = append(result, avail)
	}
	if result == nil {
		result = []MaterialAvailability{}
	}
	return result, rows.Err()
}

// GetAvailableByType returns available instances for a given material type
func (s *Store) GetAvailableByType(ctx context.Context, typeID string, limit int) ([]domain.MaterialInstance, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
		FROM material_instances
		WHERE type_id = $1 AND status = $2
		ORDER BY use_count ASC, updated_at ASC
		LIMIT $3
	`, typeID, domain.StatusAvailable, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.MaterialInstance
	for rows.Next() {
		var row materialInstanceRow
		if err := rows.Scan(
			&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
			&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, mapMaterialInstance(row))
	}
	if result == nil {
		result = []domain.MaterialInstance{}
	}
	return result, rows.Err()
}

func mapMaterialInstance(row materialInstanceRow) domain.MaterialInstance {
	instance := domain.MaterialInstance{
		ID:          row.ID,
		HumanCode:   row.HumanCode,
		TypeID:      row.TypeID,
		Description: row.Description,
		Status:      row.Status,
		UseCount:    row.UseCount,
		Location:    row.Location,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
	if row.CurrentRequestID.Valid {
		instance.CurrentRequestID = &row.CurrentRequestID.String
	}
	return instance
}

// ReturnAndInspectMaterialInstance marks a returned item as inspected: clears request assignment,
// increments use_count, updates status and optionally updates location (if non-empty).
func (s *Store) ReturnAndInspectMaterialInstance(ctx context.Context, id string, newStatus string, location string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2,
		    location = CASE WHEN $3 = '' THEN location ELSE $3 END,
		    use_count = use_count + 1,
		    current_request_id = NULL
		WHERE id = $1
		RETURNING id, human_code, type_id, description, status, use_count, location, current_request_id, created_at, updated_at
	`, id, newStatus, location).Scan(
		&row.ID, &row.HumanCode, &row.TypeID, &row.Description, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// GenerateMaterialHumanCode creates a unique 5-letter code for writing on physical inventory.
func (s *Store) GenerateMaterialHumanCode(ctx context.Context) (string, error) {
	const maxAttempts = 20
	for range maxAttempts {
		code, err := randomHumanCode()
		if err != nil {
			return "", err
		}

		var exists bool
		if err := s.db.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM material_instances WHERE human_code = $1
			)
		`, code).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}

	return "", fmt.Errorf("failed to generate unique material code after %d attempts", maxAttempts)
}

func randomHumanCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ"
	const codeLength = 5

	buf := make([]byte, codeLength)
	randomBytes := make([]byte, codeLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	for i := range codeLength {
		buf[i] = alphabet[int(randomBytes[i])%len(alphabet)]
	}
	return string(buf), nil
}

const distributionCenterIDConfigKey = "distribution_center_id"

// SetRequestArchived stores archived state for a request in local dist db.
func (s *Store) SetRequestArchived(ctx context.Context, requestID string, archived bool) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO request_archive_state (request_id, archived, updated_at)
		VALUES ($1, $2, now())
		ON CONFLICT (request_id)
		DO UPDATE SET archived = EXCLUDED.archived, updated_at = now()
	`, requestID, archived)
	return err
}

// UpsertRequestArchiveStates syncs local archive state for many requests.
func (s *Store) UpsertRequestArchiveStates(ctx context.Context, states map[string]bool) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for requestID, archived := range states {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO request_archive_state (request_id, archived, updated_at)
			VALUES ($1, $2, now())
			ON CONFLICT (request_id)
			DO UPDATE SET archived = EXCLUDED.archived, updated_at = now()
		`, requestID, archived); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetDistributionCenterID returns persisted distribution center ID.
func (s *Store) GetDistributionCenterID(ctx context.Context) (string, error) {
	var value string
	err := s.db.QueryRowContext(ctx, `
		SELECT value
		FROM app_config
		WHERE key = $1
	`, distributionCenterIDConfigKey).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

// SetDistributionCenterID stores distribution center ID in local database config.
func (s *Store) SetDistributionCenterID(ctx context.Context, distributionCenterID string) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO app_config (key, value, updated_at)
		VALUES ($1, $2, now())
		ON CONFLICT (key)
		DO UPDATE SET value = EXCLUDED.value, updated_at = now()
	`, distributionCenterIDConfigKey, distributionCenterID)
	return err
}
