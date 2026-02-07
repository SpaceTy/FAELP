package db

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

var ErrOrgLinkNotFound = errors.New("org link not found")

type OrgLink struct {
	ID                    string     `json:"id"`
	OrgBaseURL            string     `json:"orgBaseUrl"`
	CenterCode            string     `json:"centerCode"`
	CenterName            string     `json:"centerName"`
	CenterAddress         string     `json:"centerAddress"`
	CallbackURL           string     `json:"callbackUrl"`
	ChallengeToken        string     `json:"challengeToken"`
	DistPrivateKey        string     `json:"-"`
	DistPublicKey         string     `json:"distPublicKey"`
	OrgLinkRequestID      *string    `json:"orgLinkRequestId,omitempty"`
	LinkState             string     `json:"linkState"`
	OrgAccessToken        string     `json:"-"`
	OrgAccessTokenExpires *time.Time `json:"orgAccessTokenExpiresAt,omitempty"`
	LastBootstrapAt       *time.Time `json:"lastBootstrapAt,omitempty"`
	LastHeartbeatAt       *time.Time `json:"lastHeartbeatAt,omitempty"`
	LastError             string     `json:"lastError,omitempty"`
	CreatedAt             time.Time  `json:"createdAt"`
	UpdatedAt             time.Time  `json:"updatedAt"`
}

type UpsertOrgLinkInput struct {
	OrgBaseURL     string
	CenterCode     string
	CenterName     string
	CenterAddress  string
	CallbackURL    string
	ChallengeToken string
	DistPrivateKey string
	DistPublicKey  string
	LinkState      string
}

func (s *Store) UpsertOrgLink(ctx context.Context, in UpsertOrgLinkInput) (OrgLink, error) {
	row := s.db.QueryRowContext(ctx, `
		INSERT INTO org_links (
			org_base_url, center_code, center_name, center_address, callback_url,
			challenge_token, dist_private_key, dist_public_key, link_state
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (org_base_url, center_code)
		DO UPDATE SET
			center_name = EXCLUDED.center_name,
			center_address = EXCLUDED.center_address,
			callback_url = EXCLUDED.callback_url,
			challenge_token = CASE WHEN org_links.link_state IN ('pending','rejected') THEN EXCLUDED.challenge_token ELSE org_links.challenge_token END,
			dist_private_key = org_links.dist_private_key,
			dist_public_key = org_links.dist_public_key,
			updated_at = now()
		RETURNING id, org_base_url, center_code, center_name, center_address, callback_url,
			challenge_token, dist_private_key, dist_public_key, org_link_request_id,
			link_state, org_access_token, org_access_token_expires_at,
			last_bootstrap_at, last_heartbeat_at, COALESCE(last_error,''), created_at, updated_at
	`, in.OrgBaseURL, in.CenterCode, in.CenterName, in.CenterAddress, in.CallbackURL,
		in.ChallengeToken, in.DistPrivateKey, in.DistPublicKey, in.LinkState)
	return scanOrgLink(row)
}

func (s *Store) GetOrgLink(ctx context.Context, orgBaseURL, centerCode string) (OrgLink, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, org_base_url, center_code, center_name, center_address, callback_url,
			challenge_token, dist_private_key, dist_public_key, org_link_request_id,
			link_state, org_access_token, org_access_token_expires_at,
			last_bootstrap_at, last_heartbeat_at, COALESCE(last_error,''), created_at, updated_at
		FROM org_links
		WHERE org_base_url = $1 AND center_code = $2
	`, orgBaseURL, centerCode)
	item, err := scanOrgLink(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return OrgLink{}, ErrOrgLinkNotFound
		}
		return OrgLink{}, err
	}
	return item, nil
}

func (s *Store) UpdateOrgLinkRequestID(ctx context.Context, id, requestID, state string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE org_links
		SET org_link_request_id = $2,
			link_state = $3,
			updated_at = now()
		WHERE id = $1
	`, id, requestID, state)
	return err
}

func (s *Store) UpdateOrgLinkState(ctx context.Context, id, state string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE org_links
		SET link_state = $2,
			updated_at = now()
		WHERE id = $1
	`, id, state)
	return err
}

func (s *Store) UpdateOrgAccessToken(ctx context.Context, id, token string, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE org_links
		SET org_access_token = $2,
			org_access_token_expires_at = $3,
			last_bootstrap_at = now(),
			updated_at = now()
		WHERE id = $1
	`, id, token, expiresAt)
	return err
}

func (s *Store) MarkOrgHeartbeatSuccess(ctx context.Context, id, newState string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE org_links
		SET last_heartbeat_at = now(),
			link_state = $2,
			last_error = NULL,
			updated_at = now()
		WHERE id = $1
	`, id, newState)
	return err
}

func (s *Store) MarkOrgLinkError(ctx context.Context, id, errMsg string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE org_links
		SET last_error = $2,
			updated_at = now()
		WHERE id = $1
	`, id, errMsg)
	return err
}

func scanOrgLink(scanner interface{ Scan(dest ...any) error }) (OrgLink, error) {
	var out OrgLink
	var requestID sql.NullString
	var token sql.NullString
	var tokenExp, lastBootstrap, lastHeartbeat sql.NullTime
	var lastError sql.NullString
	err := scanner.Scan(
		&out.ID,
		&out.OrgBaseURL,
		&out.CenterCode,
		&out.CenterName,
		&out.CenterAddress,
		&out.CallbackURL,
		&out.ChallengeToken,
		&out.DistPrivateKey,
		&out.DistPublicKey,
		&requestID,
		&out.LinkState,
		&token,
		&tokenExp,
		&lastBootstrap,
		&lastHeartbeat,
		&lastError,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return OrgLink{}, err
	}
	if requestID.Valid {
		out.OrgLinkRequestID = &requestID.String
	}
	if token.Valid {
		out.OrgAccessToken = token.String
	}
	if tokenExp.Valid {
		out.OrgAccessTokenExpires = &tokenExp.Time
	}
	if lastBootstrap.Valid {
		out.LastBootstrapAt = &lastBootstrap.Time
	}
	if lastHeartbeat.Valid {
		out.LastHeartbeatAt = &lastHeartbeat.Time
	}
	if lastError.Valid {
		out.LastError = lastError.String
	}
	return out, nil
}
