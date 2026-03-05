package db

import (
	"context"
	"log"
)

type AuditLogger struct {
	store *Store
}

func NewAuditLogger(store *Store) *AuditLogger {
	return &AuditLogger{store: store}
}

func (a *AuditLogger) Log(ctx context.Context, userID, username, action, entityType, entityID string, details any, previousState any) error {
	detailsMap, ok := details.(map[string]interface{})
	if !ok {
		detailsMap = map[string]interface{}{"details": details}
	}

	var previousStateMap map[string]interface{}
	if previousState != nil {
		var ok bool
		previousStateMap, ok = previousState.(map[string]interface{})
		if !ok {
			previousStateMap = map[string]interface{}{"previousState": previousState}
		}
	}

	_, err := a.store.InsertAuditEntry(ctx, InsertAuditEntryInput{
		UserID:        userID,
		Username:      username,
		Action:        action,
		EntityType:    entityType,
		EntityID:      entityID,
		Details:       detailsMap,
		PreviousState: previousStateMap,
	})
	if err != nil {
		log.Printf("audit log failed: action=%s entityType=%s entityID=%s error=%v", action, entityType, entityID, err)
	}
	return err
}
