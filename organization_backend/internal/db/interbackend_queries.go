package db

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"
)

const (
	LinkStatePending     = "pending"
	LinkStateApproved    = "approved"
	LinkStateActive      = "active"
	LinkStateHibernating = "hibernating"
	LinkStateAdminLocked = "admin_locked"
	LinkStateRejected    = "rejected"
	LinkStateRevoked     = "revoked"
)

var ErrCenterNotFound = errors.New("distribution center not found")

type DistributionCenter struct {
	ID                      string     `json:"id"`
	CenterCode              string     `json:"centerCode"`
	Name                    string     `json:"name"`
	Address                 string     `json:"address"`
	CallbackURL             string     `json:"callbackUrl"`
	LinkState               string     `json:"linkState"`
	DistPublicKey           string     `json:"distPublicKey,omitempty"`
	ChallengeExpiresAt      *time.Time `json:"challengeExpiresAt,omitempty"`
	ApprovedAt              *time.Time `json:"approvedAt,omitempty"`
	ApprovedByUserID        *string    `json:"approvedByUserId,omitempty"`
	AdminNote               string     `json:"adminNote,omitempty"`
	LastSeenAt              *time.Time `json:"lastSeenAt,omitempty"`
	LastSeenIP              string     `json:"lastSeenIp,omitempty"`
	HibernatedAt            *time.Time `json:"hibernatedAt,omitempty"`
	LockedAt                *time.Time `json:"lockedAt,omitempty"`
	LockReason              string     `json:"lockReason,omitempty"`
	LastInventorySyncAt     *time.Time `json:"lastInventorySyncAt,omitempty"`
	LastInventorySyncStatus string     `json:"lastInventorySyncStatus,omitempty"`
	UpdatedAt               time.Time  `json:"updatedAt"`
}

type DistributionLinkRequest struct {
	ID                   string     `json:"id"`
	DistributionCenterID string     `json:"distributionCenterId"`
	CenterCode           string     `json:"centerCode"`
	RequestedCenterName  string     `json:"requestedCenterName"`
	RequestedCenterAddr  string     `json:"requestedCenterAddress"`
	RequestedCallbackURL string     `json:"requestedCallbackUrl"`
	State                string     `json:"state"`
	ChallengeExpiresAt   time.Time  `json:"challengeExpiresAt"`
	RejectionReason      string     `json:"rejectionReason,omitempty"`
	CreatedAt            time.Time  `json:"createdAt"`
	DecidedAt            *time.Time `json:"decidedAt,omitempty"`
	DecidedByUserID      *string    `json:"decidedByUserId,omitempty"`
}

type UpsertLinkRequestInput struct {
	CenterCode     string
	CenterName     string
	CenterAddress  string
	CallbackURL    string
	ChallengeToken string
	DistPublicKey  string
}

type BootstrapResult struct {
	CenterID    string
	CenterCode  string
	CenterState string
	PublicKey   string
}

type InventoryAmount struct {
	MaterialTypeID  string `json:"materialTypeId"`
	AvailableAmount int    `json:"availableAmount"`
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func (s *Store) UpsertDistributionLinkRequest(ctx context.Context, in UpsertLinkRequestInput) (DistributionLinkRequest, error) {
	hash := hashToken(in.ChallengeToken)
	expires := time.Now().UTC().Add(7 * 24 * time.Hour)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return DistributionLinkRequest{}, err
	}
	defer tx.Rollback()

	var centerID string
	var centerCode string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO distribution_centers (
			name, address, center_code, callback_url, link_state, dist_public_key,
			challenge_token_hash, challenge_expires_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
		ON CONFLICT (center_code) WHERE center_code IS NOT NULL
		DO UPDATE SET
			name = EXCLUDED.name,
			address = EXCLUDED.address,
			callback_url = EXCLUDED.callback_url,
			dist_public_key = EXCLUDED.dist_public_key,
			challenge_token_hash = EXCLUDED.challenge_token_hash,
			challenge_expires_at = EXCLUDED.challenge_expires_at,
			link_state = CASE
				WHEN distribution_centers.link_state IN ('approved','active','hibernating','admin_locked','revoked') THEN distribution_centers.link_state
				ELSE 'pending'
			END,
			updated_at = now()
		RETURNING id, center_code
	`, in.CenterName, in.CenterAddress, in.CenterCode, in.CallbackURL, LinkStatePending, in.DistPublicKey, hash, expires).Scan(&centerID, &centerCode)
	if err != nil {
		return DistributionLinkRequest{}, err
	}

	var req DistributionLinkRequest
	err = tx.QueryRowContext(ctx, `
		INSERT INTO distribution_link_requests (
			distribution_center_id,
			requested_center_name,
			requested_center_address,
			requested_callback_url,
			requested_dist_public_key,
			challenge_token_hash,
			challenge_expires_at,
			state
		) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
		RETURNING id, distribution_center_id, requested_center_name, requested_center_address,
			requested_callback_url, state, challenge_expires_at, created_at
	`, centerID, in.CenterName, in.CenterAddress, in.CallbackURL, in.DistPublicKey, hash, expires).Scan(
		&req.ID,
		&req.DistributionCenterID,
		&req.RequestedCenterName,
		&req.RequestedCenterAddr,
		&req.RequestedCallbackURL,
		&req.State,
		&req.ChallengeExpiresAt,
		&req.CreatedAt,
	)
	if err != nil {
		return DistributionLinkRequest{}, err
	}
	req.CenterCode = centerCode

	if err := tx.Commit(); err != nil {
		return DistributionLinkRequest{}, err
	}
	return req, nil
}

func (s *Store) GetCenterBootstrapDataByCode(ctx context.Context, centerCode string) (BootstrapResult, error) {
	var out BootstrapResult
	err := s.db.QueryRowContext(ctx, `
		SELECT id, center_code, link_state, dist_public_key
		FROM distribution_centers
		WHERE center_code = $1
	`, centerCode).Scan(&out.CenterID, &out.CenterCode, &out.CenterState, &out.PublicKey)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return BootstrapResult{}, ErrCenterNotFound
		}
		return BootstrapResult{}, err
	}
	return out, nil
}

func (s *Store) MarkHeartbeat(ctx context.Context, centerID, remoteAddr, userAgent string) (DistributionCenter, error) {
	ip := remoteAddr
	if host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr)); err == nil {
		ip = host
	}

	row := s.db.QueryRowContext(ctx, `
		UPDATE distribution_centers
		SET
			last_seen_at = now(),
			last_seen_ip = $2,
			link_state = CASE WHEN link_state IN ('approved','hibernating') THEN 'active' ELSE link_state END,
			hibernated_at = CASE WHEN link_state IN ('approved','hibernating') THEN NULL ELSE hibernated_at END,
			updated_at = now(),
			admin_note = CASE WHEN $3 = '' THEN admin_note ELSE COALESCE(admin_note,'') END
		WHERE id = $1
		RETURNING id, center_code, name, address, callback_url, link_state,
			challenge_expires_at, approved_at, approved_by_user_id, admin_note,
			last_seen_at, last_seen_ip, hibernated_at, locked_at, lock_reason,
			last_inventory_sync_at, last_inventory_sync_status, updated_at
	`, centerID, ip, strings.TrimSpace(userAgent))

	center, err := scanDistributionCenter(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DistributionCenter{}, ErrCenterNotFound
		}
		return DistributionCenter{}, err
	}
	return center, nil
}

func (s *Store) RecordInventorySync(ctx context.Context, centerID string, items []InventoryAmount) (int, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	updated := 0
	for _, item := range items {
		if item.MaterialTypeID == "" || item.AvailableAmount < 0 {
			continue
		}
		res, err := tx.ExecContext(ctx, `
			INSERT INTO material_available(material_type_id, distribution_center_id, amount)
			SELECT $1, $2, $3
			WHERE EXISTS (SELECT 1 FROM material_types WHERE id = $1)
			ON CONFLICT (material_type_id, distribution_center_id)
			DO UPDATE SET amount = EXCLUDED.amount
		`, item.MaterialTypeID, centerID, item.AvailableAmount)
		if err != nil {
			return 0, err
		}
		affected, _ := res.RowsAffected()
		if affected > 0 {
			updated++
		}
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE distribution_centers
		SET last_inventory_sync_at = now(),
			last_inventory_sync_status = 'ok',
			updated_at = now()
		WHERE id = $1
	`, centerID)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return updated, nil
}

func (s *Store) MarkInventorySyncFailure(ctx context.Context, centerID, reason string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE distribution_centers
		SET last_inventory_sync_status = $2,
			updated_at = now()
		WHERE id = $1
	`, centerID, strings.TrimSpace(reason))
	return err
}

func (s *Store) ListDistributionLinkRequests(ctx context.Context, state string, limit int) ([]DistributionLinkRequest, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	args := []any{}
	where := "1=1"
	if state != "" {
		args = append(args, state)
		where = fmt.Sprintf("lr.state = $%d", len(args))
	}
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT lr.id, lr.distribution_center_id, dc.center_code, lr.requested_center_name, lr.requested_center_address,
			lr.requested_callback_url, lr.state, lr.challenge_expires_at, COALESCE(lr.rejection_reason,''),
			lr.created_at, lr.decided_at, lr.decided_by_user_id
		FROM distribution_link_requests lr
		JOIN distribution_centers dc ON dc.id = lr.distribution_center_id
		WHERE %s
		ORDER BY lr.created_at DESC
		LIMIT $%d
	`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DistributionLinkRequest
	for rows.Next() {
		lr, err := scanDistributionLinkRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, lr)
	}
	return out, rows.Err()
}

func (s *Store) GetDistributionLinkRequestByID(ctx context.Context, id string) (DistributionLinkRequest, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT lr.id, lr.distribution_center_id, dc.center_code, lr.requested_center_name, lr.requested_center_address,
			lr.requested_callback_url, lr.state, lr.challenge_expires_at, COALESCE(lr.rejection_reason,''),
			lr.created_at, lr.decided_at, lr.decided_by_user_id
		FROM distribution_link_requests lr
		JOIN distribution_centers dc ON dc.id = lr.distribution_center_id
		WHERE lr.id = $1
	`, id)
	return scanDistributionLinkRequest(row)
}

func (s *Store) FindPendingLinkRequestByToken(ctx context.Context, rawToken string) (DistributionLinkRequest, error) {
	hash := hashToken(rawToken)
	row := s.db.QueryRowContext(ctx, `
		SELECT lr.id, lr.distribution_center_id, dc.center_code, lr.requested_center_name, lr.requested_center_address,
			lr.requested_callback_url, lr.state, lr.challenge_expires_at, COALESCE(lr.rejection_reason,''),
			lr.created_at, lr.decided_at, lr.decided_by_user_id
		FROM distribution_link_requests lr
		JOIN distribution_centers dc ON dc.id = lr.distribution_center_id
		WHERE lr.state = 'pending'
		  AND lr.challenge_token_hash = $1
		  AND lr.challenge_expires_at > now()
		ORDER BY lr.created_at DESC
		LIMIT 1
	`, hash)
	lr, err := scanDistributionLinkRequest(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DistributionLinkRequest{}, ErrCenterNotFound
		}
		return DistributionLinkRequest{}, err
	}
	return lr, nil
}

func (s *Store) ApproveDistributionLinkRequest(ctx context.Context, requestID, adminUserID, adminNote string) (DistributionLinkRequest, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return DistributionLinkRequest{}, err
	}
	defer tx.Rollback()

	lr, err := s.getLinkRequestForUpdate(ctx, tx, requestID)
	if err != nil {
		return DistributionLinkRequest{}, err
	}
	if lr.State != "pending" {
		return DistributionLinkRequest{}, fmt.Errorf("request is not pending")
	}
	if lr.ChallengeExpiresAt.Before(time.Now().UTC()) {
		_, _ = tx.ExecContext(ctx, `
			UPDATE distribution_link_requests
			SET state = 'expired', decided_at = now(), decided_by_user_id = $2
			WHERE id = $1
		`, requestID, adminUserID)
		return DistributionLinkRequest{}, fmt.Errorf("challenge token expired")
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE distribution_link_requests
		SET state = 'approved', decided_at = now(), decided_by_user_id = $2
		WHERE id = $1
	`, requestID, adminUserID)
	if err != nil {
		return DistributionLinkRequest{}, err
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE distribution_centers
		SET link_state = 'approved', approved_at = now(), approved_by_user_id = $2,
			admin_note = $3, challenge_token_hash = NULL, challenge_expires_at = NULL,
			locked_at = NULL, lock_reason = NULL, updated_at = now()
		WHERE id = $1
	`, lr.DistributionCenterID, adminUserID, adminNote)
	if err != nil {
		return DistributionLinkRequest{}, err
	}

	if err := tx.Commit(); err != nil {
		return DistributionLinkRequest{}, err
	}
	return s.GetDistributionLinkRequestByID(ctx, requestID)
}

func (s *Store) RejectDistributionLinkRequest(ctx context.Context, requestID, adminUserID, reason string) (DistributionLinkRequest, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return DistributionLinkRequest{}, err
	}
	defer tx.Rollback()

	lr, err := s.getLinkRequestForUpdate(ctx, tx, requestID)
	if err != nil {
		return DistributionLinkRequest{}, err
	}
	if lr.State != "pending" {
		return DistributionLinkRequest{}, fmt.Errorf("request is not pending")
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE distribution_link_requests
		SET state = 'rejected', rejection_reason = $2, decided_at = now(), decided_by_user_id = $3
		WHERE id = $1
	`, requestID, reason, adminUserID)
	if err != nil {
		return DistributionLinkRequest{}, err
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE distribution_centers
		SET link_state = 'rejected', admin_note = $2, challenge_token_hash = NULL,
			challenge_expires_at = NULL, updated_at = now()
		WHERE id = $1
	`, lr.DistributionCenterID, reason)
	if err != nil {
		return DistributionLinkRequest{}, err
	}

	if err := tx.Commit(); err != nil {
		return DistributionLinkRequest{}, err
	}
	return s.GetDistributionLinkRequestByID(ctx, requestID)
}

func (s *Store) ReactivateDistributionCenter(ctx context.Context, centerID, note string) (DistributionCenter, error) {
	row := s.db.QueryRowContext(ctx, `
		UPDATE distribution_centers
		SET link_state = 'hibernating', lock_reason = NULL, locked_at = NULL,
			admin_note = $2, updated_at = now()
		WHERE id = $1 AND link_state = 'admin_locked'
		RETURNING id, center_code, name, address, callback_url, link_state,
			challenge_expires_at, approved_at, approved_by_user_id, admin_note,
			last_seen_at, last_seen_ip, hibernated_at, locked_at, lock_reason,
			last_inventory_sync_at, last_inventory_sync_status, updated_at
	`, centerID, note)
	center, err := scanDistributionCenter(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DistributionCenter{}, ErrCenterNotFound
		}
		return DistributionCenter{}, err
	}
	return center, nil
}

func (s *Store) GetDistributionCenterByID(ctx context.Context, centerID string) (DistributionCenter, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, center_code, name, address, callback_url, link_state,
			challenge_expires_at, approved_at, approved_by_user_id, admin_note,
			last_seen_at, last_seen_ip, hibernated_at, locked_at, lock_reason,
			last_inventory_sync_at, last_inventory_sync_status, updated_at
		FROM distribution_centers
		WHERE id = $1
	`, centerID)
	center, err := scanDistributionCenter(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DistributionCenter{}, ErrCenterNotFound
		}
		return DistributionCenter{}, err
	}
	return center, nil
}

func (s *Store) GetDistributionCenterByCode(ctx context.Context, centerCode string) (DistributionCenter, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, center_code, name, address, callback_url, link_state,
			challenge_expires_at, approved_at, approved_by_user_id, admin_note,
			last_seen_at, last_seen_ip, hibernated_at, locked_at, lock_reason,
			last_inventory_sync_at, last_inventory_sync_status, updated_at
		FROM distribution_centers
		WHERE center_code = $1
	`, centerCode)
	center, err := scanDistributionCenter(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DistributionCenter{}, ErrCenterNotFound
		}
		return DistributionCenter{}, err
	}
	return center, nil
}

func (s *Store) ListDistributionCenters(ctx context.Context, state string, limit int) ([]DistributionCenter, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	args := []any{}
	where := "1=1"
	if state != "" {
		args = append(args, state)
		where = fmt.Sprintf("link_state = $%d", len(args))
	}
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT id, center_code, name, address, callback_url, link_state,
			challenge_expires_at, approved_at, approved_by_user_id, admin_note,
			last_seen_at, last_seen_ip, hibernated_at, locked_at, lock_reason,
			last_inventory_sync_at, last_inventory_sync_status, updated_at
		FROM distribution_centers
		WHERE %s
		ORDER BY updated_at DESC
		LIMIT $%d
	`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DistributionCenter
	for rows.Next() {
		center, err := scanDistributionCenter(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, center)
	}
	return out, rows.Err()
}

func (s *Store) ApplyLinkLifecycleTransitions(ctx context.Context, hibernateAfter, lockAfter time.Duration) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE distribution_centers
		SET link_state = 'hibernating', hibernated_at = now(), updated_at = now()
		WHERE link_state = 'active'
		  AND last_seen_at IS NOT NULL
		  AND last_seen_at < now() - $1::interval
	`, durationToInterval(hibernateAfter))
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `
		UPDATE distribution_centers
		SET link_state = 'admin_locked', locked_at = now(), lock_reason = 'heartbeat_timeout', updated_at = now()
		WHERE link_state = 'hibernating'
		  AND last_seen_at IS NOT NULL
		  AND last_seen_at < now() - $1::interval
	`, durationToInterval(lockAfter))
	return err
}

func durationToInterval(d time.Duration) string {
	sec := int(d.Seconds())
	if sec < 0 {
		sec = 0
	}
	return fmt.Sprintf("%d seconds", sec)
}

func (s *Store) getLinkRequestForUpdate(ctx context.Context, tx *sql.Tx, id string) (DistributionLinkRequest, error) {
	row := tx.QueryRowContext(ctx, `
		SELECT lr.id, lr.distribution_center_id, dc.center_code, lr.requested_center_name,
			lr.requested_center_address, lr.requested_callback_url, lr.state,
			lr.challenge_expires_at, COALESCE(lr.rejection_reason,''),
			lr.created_at, lr.decided_at, lr.decided_by_user_id
		FROM distribution_link_requests lr
		JOIN distribution_centers dc ON dc.id = lr.distribution_center_id
		WHERE lr.id = $1
		FOR UPDATE
	`, id)
	lr, err := scanDistributionLinkRequest(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DistributionLinkRequest{}, ErrCenterNotFound
		}
		return DistributionLinkRequest{}, err
	}
	return lr, nil
}

func scanDistributionLinkRequest(scanner interface{ Scan(dest ...any) error }) (DistributionLinkRequest, error) {
	var out DistributionLinkRequest
	var decidedAt sql.NullTime
	var decidedBy sql.NullString
	err := scanner.Scan(
		&out.ID,
		&out.DistributionCenterID,
		&out.CenterCode,
		&out.RequestedCenterName,
		&out.RequestedCenterAddr,
		&out.RequestedCallbackURL,
		&out.State,
		&out.ChallengeExpiresAt,
		&out.RejectionReason,
		&out.CreatedAt,
		&decidedAt,
		&decidedBy,
	)
	if err != nil {
		return DistributionLinkRequest{}, err
	}
	if decidedAt.Valid {
		out.DecidedAt = &decidedAt.Time
	}
	if decidedBy.Valid {
		out.DecidedByUserID = &decidedBy.String
	}
	return out, nil
}

func scanDistributionCenter(scanner interface{ Scan(dest ...any) error }) (DistributionCenter, error) {
	var out DistributionCenter
	var challengeExpires, approvedAt, lastSeenAt, hibernatedAt, lockedAt, invSyncAt sql.NullTime
	var approvedBy sql.NullString
	var adminNote, lastSeenIP, lockReason, invStatus sql.NullString
	err := scanner.Scan(
		&out.ID,
		&out.CenterCode,
		&out.Name,
		&out.Address,
		&out.CallbackURL,
		&out.LinkState,
		&challengeExpires,
		&approvedAt,
		&approvedBy,
		&adminNote,
		&lastSeenAt,
		&lastSeenIP,
		&hibernatedAt,
		&lockedAt,
		&lockReason,
		&invSyncAt,
		&invStatus,
		&out.UpdatedAt,
	)
	if err != nil {
		return DistributionCenter{}, err
	}
	if challengeExpires.Valid {
		out.ChallengeExpiresAt = &challengeExpires.Time
	}
	if approvedAt.Valid {
		out.ApprovedAt = &approvedAt.Time
	}
	if approvedBy.Valid {
		out.ApprovedByUserID = &approvedBy.String
	}
	if adminNote.Valid {
		out.AdminNote = adminNote.String
	}
	if lastSeenAt.Valid {
		out.LastSeenAt = &lastSeenAt.Time
	}
	if lastSeenIP.Valid {
		out.LastSeenIP = lastSeenIP.String
	}
	if hibernatedAt.Valid {
		out.HibernatedAt = &hibernatedAt.Time
	}
	if lockedAt.Valid {
		out.LockedAt = &lockedAt.Time
	}
	if lockReason.Valid {
		out.LockReason = lockReason.String
	}
	if invSyncAt.Valid {
		out.LastInventorySyncAt = &invSyncAt.Time
	}
	if invStatus.Valid {
		out.LastInventorySyncStatus = invStatus.String
	}
	return out, nil
}
