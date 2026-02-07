package interbackend

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"distribution_backend/internal/auth"
	"distribution_backend/internal/config"
	"distribution_backend/internal/db"
)

type Manager struct {
	store      *db.Store
	cfg        config.Config
	httpClient *http.Client

	mu   sync.RWMutex
	link db.OrgLink
}

func NewManager(store *db.Store, cfg config.Config) *Manager {
	return &Manager{
		store: store,
		cfg:   cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (m *Manager) Start(ctx context.Context) error {
	link, err := m.ensureLink(ctx)
	if err != nil {
		return err
	}
	m.setLink(link)

	go m.registrationLoop(ctx)
	go m.bootstrapLoop(ctx)
	go m.heartbeatLoop(ctx)
	go m.inventoryLoop(ctx)
	return nil
}

func (m *Manager) Status() db.OrgLink {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.link
}

func (m *Manager) ensureLink(ctx context.Context) (db.OrgLink, error) {
	link, err := m.store.GetOrgLink(ctx, m.cfg.OrgBaseURL, m.cfg.CenterCode)
	if err == nil {
		return link, nil
	}
	if !errors.Is(err, db.ErrOrgLinkNotFound) {
		return db.OrgLink{}, err
	}

	challenge, err := auth.GenerateSecureToken(32)
	if err != nil {
		return db.OrgLink{}, err
	}
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return db.OrgLink{}, err
	}

	return m.store.UpsertOrgLink(ctx, db.UpsertOrgLinkInput{
		OrgBaseURL:     m.cfg.OrgBaseURL,
		CenterCode:     m.cfg.CenterCode,
		CenterName:     m.cfg.CenterName,
		CenterAddress:  m.cfg.CenterAddress,
		CallbackURL:    m.cfg.CallbackURL,
		ChallengeToken: challenge,
		DistPrivateKey: base64.StdEncoding.EncodeToString(priv),
		DistPublicKey:  base64.StdEncoding.EncodeToString(pub),
		LinkState:      "pending",
	})
}

func (m *Manager) registrationLoop(ctx context.Context) {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()

	for {
		if err := m.registerIfNeeded(ctx); err != nil {
			_ = m.store.MarkOrgLinkError(ctx, m.Status().ID, err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (m *Manager) bootstrapLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		if err := m.bootstrapIfNeeded(ctx); err != nil {
			_ = m.store.MarkOrgLinkError(ctx, m.Status().ID, err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (m *Manager) heartbeatLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(m.cfg.InterbackendHeartbeatIntervalSec) * time.Second)
	defer ticker.Stop()
	for {
		if err := m.sendHeartbeat(ctx); err != nil {
			_ = m.store.MarkOrgLinkError(ctx, m.Status().ID, err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (m *Manager) inventoryLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(m.cfg.InterbackendInventoryIntervalSec) * time.Second)
	defer ticker.Stop()
	for {
		if err := m.pushInventory(ctx); err != nil {
			_ = m.store.MarkOrgLinkError(ctx, m.Status().ID, err.Error())
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (m *Manager) registerIfNeeded(ctx context.Context) error {
	link, err := m.store.GetOrgLink(ctx, m.cfg.OrgBaseURL, m.cfg.CenterCode)
	if err != nil {
		return err
	}
	m.setLink(link)

	if link.LinkState != "pending" && link.LinkState != "rejected" {
		return nil
	}

	payload := map[string]any{
		"centerCode":     link.CenterCode,
		"centerName":     link.CenterName,
		"centerAddress":  link.CenterAddress,
		"callbackUrl":    link.CallbackURL,
		"challengeToken": link.ChallengeToken,
		"distPublicKey":  link.DistPublicKey,
	}

	var resp struct {
		RequestID string `json:"requestId"`
		State     string `json:"state"`
	}
	if err := m.postJSON(ctx, m.cfg.OrgBaseURL+"/interbackend/link-requests", payload, "", &resp); err != nil {
		return err
	}

	if resp.State == "approved" || resp.State == "active" || resp.State == "hibernating" {
		if err := m.store.UpdateOrgLinkRequestID(ctx, link.ID, resp.RequestID, "approved"); err != nil {
			return err
		}
	} else {
		if err := m.store.UpdateOrgLinkRequestID(ctx, link.ID, resp.RequestID, "pending"); err != nil {
			return err
		}
	}

	updated, err := m.store.GetOrgLink(ctx, m.cfg.OrgBaseURL, m.cfg.CenterCode)
	if err == nil {
		m.setLink(updated)
	}
	return nil
}

func (m *Manager) bootstrapIfNeeded(ctx context.Context) error {
	link, err := m.store.GetOrgLink(ctx, m.cfg.OrgBaseURL, m.cfg.CenterCode)
	if err != nil {
		return err
	}
	m.setLink(link)

	if link.LinkState == "pending" || link.LinkState == "rejected" || link.LinkState == "revoked" || link.LinkState == "admin_locked" {
		return nil
	}

	if link.OrgAccessToken != "" && link.OrgAccessTokenExpires != nil {
		if time.Until(*link.OrgAccessTokenExpires) > time.Duration(m.cfg.InterbackendTokenRefreshSkewSec)*time.Second {
			return nil
		}
	}

	priv, err := decodePrivateKey(link.DistPrivateKey)
	if err != nil {
		return err
	}
	nonce, err := auth.GenerateSecureToken(16)
	if err != nil {
		return err
	}
	ts := time.Now().UTC().Format(time.RFC3339)
	message := []byte(link.CenterCode + "|" + nonce + "|" + ts)
	sig := ed25519.Sign(priv, message)

	payload := map[string]any{
		"centerCode": link.CenterCode,
		"nonce":      nonce,
		"timestamp":  ts,
		"signature":  base64.StdEncoding.EncodeToString(sig),
	}
	var resp struct {
		AccessToken string    `json:"accessToken"`
		ExpiresAt   time.Time `json:"expiresAt"`
	}
	if err := m.postJSON(ctx, m.cfg.OrgBaseURL+"/interbackend/auth/bootstrap", payload, "", &resp); err != nil {
		if strings.Contains(err.Error(), "403") {
			_ = m.store.UpdateOrgLinkState(ctx, link.ID, "admin_locked")
		}
		return err
	}

	if err := m.store.UpdateOrgAccessToken(ctx, link.ID, resp.AccessToken, resp.ExpiresAt); err != nil {
		return err
	}
	updated, err := m.store.GetOrgLink(ctx, m.cfg.OrgBaseURL, m.cfg.CenterCode)
	if err == nil {
		m.setLink(updated)
	}
	return nil
}

func (m *Manager) sendHeartbeat(ctx context.Context) error {
	link := m.Status()
	if link.ID == "" {
		return nil
	}
	if link.LinkState == "pending" || link.LinkState == "rejected" || link.LinkState == "revoked" || link.LinkState == "admin_locked" {
		return nil
	}
	if link.OrgAccessToken == "" {
		return nil
	}

	payload := map[string]any{
		"distVersion": "v1",
		"distTime":    time.Now().UTC().Format(time.RFC3339),
		"health":      "ok",
	}
	var resp struct {
		LinkState string `json:"linkState"`
	}
	err := m.postJSON(ctx, m.cfg.OrgBaseURL+"/interbackend/heartbeat", payload, link.OrgAccessToken, &resp)
	if err != nil {
		if strings.Contains(err.Error(), "401") {
			return nil
		}
		if strings.Contains(err.Error(), "admin_locked") || strings.Contains(err.Error(), "403") {
			_ = m.store.UpdateOrgLinkState(ctx, link.ID, "admin_locked")
		}
		return err
	}
	state := resp.LinkState
	if state == "" {
		state = "active"
	}
	if err := m.store.MarkOrgHeartbeatSuccess(ctx, link.ID, state); err != nil {
		return err
	}
	updated, err := m.store.GetOrgLink(ctx, m.cfg.OrgBaseURL, m.cfg.CenterCode)
	if err == nil {
		m.setLink(updated)
	}
	return nil
}

func (m *Manager) pushInventory(ctx context.Context) error {
	link := m.Status()
	if link.ID == "" {
		return nil
	}
	if link.LinkState == "pending" || link.LinkState == "rejected" || link.LinkState == "revoked" || link.LinkState == "admin_locked" {
		return nil
	}
	if link.OrgAccessToken == "" {
		return nil
	}

	summary, err := m.store.CountByTypeAndStatus(ctx)
	if err != nil {
		return err
	}

	available := make(map[string]int)
	for _, item := range summary {
		if item.Status == "available" {
			available[item.TypeID] += item.Count
		}
	}
	items := make([]map[string]any, 0, len(available))
	for typeID, amount := range available {
		items = append(items, map[string]any{
			"materialTypeId":  typeID,
			"availableAmount": amount,
		})
	}

	payload := map[string]any{
		"snapshotId": fmt.Sprintf("%s-%d", link.CenterCode, time.Now().Unix()),
		"snapshotAt": time.Now().UTC().Format(time.RFC3339),
		"items":      items,
	}
	var resp map[string]any
	err = m.postJSON(ctx, m.cfg.OrgBaseURL+"/interbackend/inventory/push", payload, link.OrgAccessToken, &resp)
	if err != nil {
		if strings.Contains(err.Error(), "401") {
			return nil
		}
		if strings.Contains(err.Error(), "admin_locked") || strings.Contains(err.Error(), "403") {
			_ = m.store.UpdateOrgLinkState(ctx, link.ID, "admin_locked")
		}
		return err
	}
	return nil
}

func (m *Manager) postJSON(ctx context.Context, url string, payload any, bearer string, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := m.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("request %s failed with %d: %s", url, resp.StatusCode, string(raw))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func decodePrivateKey(encoded string) (ed25519.PrivateKey, error) {
	bytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		bytes, err = base64.RawStdEncoding.DecodeString(encoded)
		if err != nil {
			return nil, err
		}
	}
	if len(bytes) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key size")
	}
	return ed25519.PrivateKey(bytes), nil
}

func (m *Manager) setLink(link db.OrgLink) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.link = link
}
