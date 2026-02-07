package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"distribution_backend/internal/domain"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// ListMaterialInstancesParams contains filters for listing material instances
type ListMaterialInstancesParams struct {
	TypeID   string
	Status   string
	Location string
	Limit    int
	Offset   int
}

// InventorySummary represents count of instances by type and status
type InventorySummary struct {
	TypeID string `json:"typeId"`
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// CreateMaterialInstance creates a new material instance
func (s *Store) CreateMaterialInstance(ctx context.Context, input domain.CreateMaterialInstanceInput) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO material_instances (id, type_id, status, location)
		VALUES ($1, $2, $3, $4)
		RETURNING id, type_id, status, use_count, location, current_request_id, created_at, updated_at
	`, input.ID, input.TypeID, domain.StatusAvailable, input.Location).Scan(
		&row.ID, &row.TypeID, &row.Status, &row.UseCount, &row.Location,
		&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.MaterialInstance{}, err
	}
	return mapMaterialInstance(row), nil
}

// GetMaterialInstanceByID returns a single material instance by ID
func (s *Store) GetMaterialInstanceByID(ctx context.Context, id string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		SELECT id, type_id, status, use_count, location, current_request_id, created_at, updated_at
		FROM material_instances
		WHERE id = $1
	`, id).Scan(
		&row.ID, &row.TypeID, &row.Status, &row.UseCount, &row.Location,
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
		SELECT id, type_id, status, use_count, location, current_request_id, created_at, updated_at
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
			&row.ID, &row.TypeID, &row.Status, &row.UseCount, &row.Location,
			&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, mapMaterialInstance(row))
	}
	return result, rows.Err()
}

// UpdateMaterialInstance updates a material instance
func (s *Store) UpdateMaterialInstance(ctx context.Context, id string, input domain.UpdateMaterialInstanceInput) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2, location = $3
		WHERE id = $1
		RETURNING id, type_id, status, use_count, location, current_request_id, created_at, updated_at
	`, id, input.Status, input.Location).Scan(
		&row.ID, &row.TypeID, &row.Status, &row.UseCount, &row.Location,
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

// AssignToRequest assigns a material instance to a request (renting)
func (s *Store) AssignToRequest(ctx context.Context, instanceID string, requestID string) (domain.MaterialInstance, error) {
	var row materialInstanceRow
	err := s.db.QueryRowContext(ctx, `
		UPDATE material_instances
		SET status = $2, current_request_id = $3
		WHERE id = $1 AND status = $4
		RETURNING id, type_id, status, use_count, location, current_request_id, created_at, updated_at
	`, instanceID, domain.StatusRented, requestID, domain.StatusAvailable).Scan(
		&row.ID, &row.TypeID, &row.Status, &row.UseCount, &row.Location,
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
		RETURNING id, type_id, status, use_count, location, current_request_id, created_at, updated_at
	`, instanceID, domain.StatusReturned, domain.StatusRented).Scan(
		&row.ID, &row.TypeID, &row.Status, &row.UseCount, &row.Location,
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
	return result, rows.Err()
}

// GetAvailableByType returns available instances for a given material type
func (s *Store) GetAvailableByType(ctx context.Context, typeID string, limit int) ([]domain.MaterialInstance, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, type_id, status, use_count, location, current_request_id, created_at, updated_at
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
			&row.ID, &row.TypeID, &row.Status, &row.UseCount, &row.Location,
			&row.CurrentRequestID, &row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, mapMaterialInstance(row))
	}
	return result, rows.Err()
}

func mapMaterialInstance(row materialInstanceRow) domain.MaterialInstance {
	instance := domain.MaterialInstance{
		ID:        row.ID,
		TypeID:    row.TypeID,
		Status:    row.Status,
		UseCount:  row.UseCount,
		Location:  row.Location,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
	if row.CurrentRequestID.Valid {
		instance.CurrentRequestID = &row.CurrentRequestID.String
	}
	return instance
}
