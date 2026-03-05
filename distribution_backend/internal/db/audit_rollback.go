package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var (
	ErrAlreadyRolledBack = errors.New("audit entry already rolled back")
	ErrNotRollbackable   = errors.New("action is not rollbackable")
	ErrNoPreviousState   = errors.New("no previous state available for rollback")
)

var rollbackableActions = map[string]bool{
	"inventory.update":    true,
	"inventory.delete":    true,
	"inventory.archive":   true,
	"inventory.unarchive": true,
	"request.archive":     true,
	"request.unarchive":   true,
	"user.set_admin":      true,
}

type RollbackResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func (s *Store) RollbackAuditEntry(ctx context.Context, entryID int64, rolledBackBy string) (RollbackResult, error) {
	entry, err := s.GetAuditEntry(ctx, entryID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return RollbackResult{Success: false, Message: "audit entry not found"}, nil
		}
		return RollbackResult{Success: false, Message: err.Error()}, err
	}

	if entry.RolledBack {
		return RollbackResult{Success: false, Message: "audit entry already rolled back"}, ErrAlreadyRolledBack
	}

	if !rollbackableActions[entry.Action] {
		return RollbackResult{Success: false, Message: fmt.Sprintf("action %s is not rollbackable", entry.Action)}, ErrNotRollbackable
	}

	if entry.PreviousState == nil {
		return RollbackResult{Success: false, Message: "no previous state available for rollback"}, ErrNoPreviousState
	}

	switch entry.EntityType {
	case "material_instance":
		if err := s.rollbackMaterialInstance(ctx, entry); err != nil {
			return RollbackResult{Success: false, Message: err.Error()}, err
		}
	case "request":
		if err := s.rollbackRequest(ctx, entry); err != nil {
			return RollbackResult{Success: false, Message: err.Error()}, err
		}
	case "user":
		if err := s.rollbackUser(ctx, entry); err != nil {
			return RollbackResult{Success: false, Message: err.Error()}, err
		}
	default:
		return RollbackResult{Success: false, Message: "unknown entity type"}, nil
	}

	if err := s.MarkRolledBack(ctx, entryID, rolledBackBy); err != nil {
		return RollbackResult{Success: false, Message: err.Error()}, err
	}

	return RollbackResult{Success: true, Message: "rollback successful"}, nil
}

func (s *Store) rollbackMaterialInstance(ctx context.Context, entry AuditEntry) error {
	prev := entry.PreviousState

	switch entry.Action {
	case "inventory.update":
		typeID, _ := prev["typeId"].(string)
		description, _ := prev["description"].(string)
		status, _ := prev["status"].(string)
		useCount, _ := prev["useCount"].(float64)
		location, _ := prev["location"].(string)

		_, err := s.db.ExecContext(ctx, `
			UPDATE material_instances
			SET type_id = $1, description = $2, status = $3, use_count = $4, location = $5, updated_at = now()
			WHERE id = $6
		`, typeID, description, status, int(useCount), location, entry.EntityID)
		return err

	case "inventory.delete":
		humanCode, _ := prev["humanCode"].(string)
		typeID, _ := prev["typeId"].(string)
		description, _ := prev["description"].(string)
		status, _ := prev["status"].(string)
		useCount, _ := prev["useCount"].(float64)
		location, _ := prev["location"].(string)

		var currentRequestID any
		if cr, ok := prev["currentRequestId"]; ok && cr != nil {
			currentRequestID = cr
		}

		_, err := s.db.ExecContext(ctx, `
			INSERT INTO material_instances (id, human_code, type_id, description, status, use_count, location, current_request_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, entry.EntityID, humanCode, typeID, description, status, int(useCount), location, currentRequestID)
		return err

	case "inventory.archive":
		_, err := s.db.ExecContext(ctx, `
			UPDATE material_instances
			SET status = 'available', updated_at = now()
			WHERE id = $1
		`, entry.EntityID)
		return err

	case "inventory.unarchive":
		_, err := s.db.ExecContext(ctx, `
			UPDATE material_instances
			SET status = 'archived', updated_at = now()
			WHERE id = $1
		`, entry.EntityID)
		return err

	default:
		return fmt.Errorf("unknown inventory action: %s", entry.Action)
	}
}

func (s *Store) rollbackRequest(ctx context.Context, entry AuditEntry) error {
	switch entry.Action {
	case "request.archive":
		_, err := s.db.ExecContext(ctx, `
			DELETE FROM request_archive_state WHERE request_id = $1
		`, entry.EntityID)
		return err

	case "request.unarchive":
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO request_archive_state (request_id, archived, updated_at)
			VALUES ($1, true, now())
		`, entry.EntityID)
		return err

	default:
		return fmt.Errorf("unknown request action: %s", entry.Action)
	}
}

func (s *Store) rollbackUser(ctx context.Context, entry AuditEntry) error {
	if entry.Action != "user.set_admin" {
		return fmt.Errorf("unknown user action: %s", entry.Action)
	}

	prev := entry.PreviousState
	isAdmin, _ := prev["isAdmin"].(bool)

	_, err := s.db.ExecContext(ctx, `
		UPDATE users
		SET is_admin = $1, updated_at = now()
		WHERE id = $2
	`, isAdmin, entry.EntityID)
	return err
}

func IsRollbackable(action string) bool {
	return rollbackableActions[action]
}

func GetRollbackableActions() []string {
	actions := []string{}
	for action := range rollbackableActions {
		actions = append(actions, action)
	}
	return actions
}
