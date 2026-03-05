package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type AuditEntry struct {
	ID            int64                  `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	UserID        string                 `json:"userId"`
	Username      string                 `json:"username"`
	Action        string                 `json:"action"`
	EntityType    string                 `json:"entityType"`
	EntityID      string                 `json:"entityId"`
	Details       map[string]interface{} `json:"details"`
	PreviousState map[string]interface{} `json:"previousState"`
	RolledBack    bool                   `json:"rolledBack"`
	RolledBackAt  *time.Time             `json:"rolledBackAt"`
	RolledBackBy  *string                `json:"rolledBackBy"`
}

type AuditEntryRow struct {
	ID            int64
	Timestamp     time.Time
	UserID        string
	Username      string
	Action        string
	EntityType    string
	EntityID      string
	Details       []byte
	PreviousState []byte
	RolledBack    bool
	RolledBackAt  sql.NullTime
	RolledBackBy  sql.NullString
}

type ListAuditEntriesParams struct {
	EntityType string
	EntityID   string
	UserID     string
	Action     string
	From       *time.Time
	To         *time.Time
	Limit      int
	Offset     int
}

type InsertAuditEntryInput struct {
	UserID        string
	Username      string
	Action        string
	EntityType    string
	EntityID      string
	Details       map[string]interface{}
	PreviousState map[string]interface{}
}

func mapAuditEntry(row AuditEntryRow) AuditEntry {
	entry := AuditEntry{
		ID:         row.ID,
		Timestamp:  row.Timestamp,
		UserID:     row.UserID,
		Username:   row.Username,
		Action:     row.Action,
		EntityType: row.EntityType,
		EntityID:   row.EntityID,
		RolledBack: row.RolledBack,
	}

	if row.Details != nil {
		_ = json.Unmarshal(row.Details, &entry.Details)
	} else {
		entry.Details = map[string]interface{}{}
	}

	if row.PreviousState != nil {
		_ = json.Unmarshal(row.PreviousState, &entry.PreviousState)
	}

	if row.RolledBackAt.Valid {
		entry.RolledBackAt = &row.RolledBackAt.Time
	}

	if row.RolledBackBy.Valid {
		entry.RolledBackBy = &row.RolledBackBy.String
	}

	return entry
}

func (s *Store) InsertAuditEntry(ctx context.Context, input InsertAuditEntryInput) (AuditEntry, error) {
	detailsJSON, _ := json.Marshal(input.Details)
	var previousStateJSON []byte
	if input.PreviousState != nil {
		previousStateJSON, _ = json.Marshal(input.PreviousState)
	}

	var row AuditEntryRow
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details, previous_state)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, timestamp, user_id, username, action, entity_type, entity_id, details, previous_state, rolled_back, rolled_back_at, rolled_back_by
	`, input.UserID, input.Username, input.Action, input.EntityType, input.EntityID, detailsJSON, previousStateJSON).Scan(
		&row.ID, &row.Timestamp, &row.UserID, &row.Username, &row.Action, &row.EntityType, &row.EntityID,
		&row.Details, &row.PreviousState, &row.RolledBack, &row.RolledBackAt, &row.RolledBackBy,
	)
	if err != nil {
		return AuditEntry{}, err
	}
	return mapAuditEntry(row), nil
}

func (s *Store) GetAuditEntry(ctx context.Context, id int64) (AuditEntry, error) {
	var row AuditEntryRow
	err := s.db.QueryRowContext(ctx, `
		SELECT id, timestamp, user_id, username, action, entity_type, entity_id, details, previous_state, rolled_back, rolled_back_at, rolled_back_by
		FROM audit_log
		WHERE id = $1
	`, id).Scan(
		&row.ID, &row.Timestamp, &row.UserID, &row.Username, &row.Action, &row.EntityType, &row.EntityID,
		&row.Details, &row.PreviousState, &row.RolledBack, &row.RolledBackAt, &row.RolledBackBy,
	)
	if err != nil {
		return AuditEntry{}, err
	}
	return mapAuditEntry(row), nil
}

func (s *Store) ListAuditEntries(ctx context.Context, params ListAuditEntriesParams) ([]AuditEntry, error) {
	args := []any{}
	where := []string{"1=1"}

	if params.EntityType != "" {
		args = append(args, params.EntityType)
		where = append(where, fmt.Sprintf("entity_type = $%d", len(args)))
	}
	if params.EntityID != "" {
		args = append(args, params.EntityID)
		where = append(where, fmt.Sprintf("entity_id = $%d", len(args)))
	}
	if params.UserID != "" {
		args = append(args, params.UserID)
		where = append(where, fmt.Sprintf("user_id = $%d", len(args)))
	}
	if params.Action != "" {
		args = append(args, params.Action)
		where = append(where, fmt.Sprintf("action = $%d", len(args)))
	}
	if params.From != nil {
		args = append(args, *params.From)
		where = append(where, fmt.Sprintf("timestamp >= $%d", len(args)))
	}
	if params.To != nil {
		args = append(args, *params.To)
		where = append(where, fmt.Sprintf("timestamp <= $%d", len(args)))
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
		SELECT id, timestamp, user_id, username, action, entity_type, entity_id, details, previous_state, rolled_back, rolled_back_at, rolled_back_by
		FROM audit_log
		WHERE %s
		ORDER BY timestamp DESC
		LIMIT $%d OFFSET $%d
	`, strings.Join(where, " AND "), len(args)-1, len(args))

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AuditEntry
	for rows.Next() {
		var row AuditEntryRow
		if err := rows.Scan(
			&row.ID, &row.Timestamp, &row.UserID, &row.Username, &row.Action, &row.EntityType, &row.EntityID,
			&row.Details, &row.PreviousState, &row.RolledBack, &row.RolledBackAt, &row.RolledBackBy,
		); err != nil {
			return nil, err
		}
		result = append(result, mapAuditEntry(row))
	}
	if result == nil {
		result = []AuditEntry{}
	}
	return result, rows.Err()
}

func (s *Store) MarkRolledBack(ctx context.Context, id int64, rolledBackBy string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE audit_log
		SET rolled_back = true, rolled_back_at = now(), rolled_back_by = $2
		WHERE id = $1
	`, id, rolledBackBy)
	return err
}
