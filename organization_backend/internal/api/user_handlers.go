package api

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"organization_backend/internal/db"
	"organization_backend/internal/domain"
	"organization_backend/internal/email"
)

type UserHandler struct {
	Store        *db.Store
	EmailService *email.Service
}

func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.Store.ListUsers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch users")
		return
	}

	writeJSON(w, http.StatusOK, users)
}

func (h *UserHandler) VerifyUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	if strings.TrimSpace(userID) == "" {
		writeError(w, http.StatusBadRequest, "missing_user_id", "User ID is required")
		return
	}

	user, changed, err := h.Store.VerifyUserByID(r.Context(), userID)
	if err != nil {
		switch err {
		case db.ErrUserNotFound:
			writeError(w, http.StatusNotFound, "user_not_found", "User not found")
		default:
			writeError(w, http.StatusInternalServerError, "verify_failed", "Failed to verify user")
		}
		return
	}

	if changed {
		h.sendVerificationNotificationAsync(user)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user":           user,
		"changed":        changed,
		"emailScheduled": changed && user.WorkOSUserID != "",
	})
}

func (h *UserHandler) UnverifyUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	if strings.TrimSpace(userID) == "" {
		writeError(w, http.StatusBadRequest, "missing_user_id", "User ID is required")
		return
	}

	user, changed, err := h.Store.UnverifyUserByID(r.Context(), userID)
	if err != nil {
		switch err {
		case db.ErrUserNotFound:
			writeError(w, http.StatusNotFound, "user_not_found", "User not found")
		default:
			writeError(w, http.StatusInternalServerError, "unverify_failed", "Failed to unverify user")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user":    user,
		"changed": changed,
	})
}

func (h *UserHandler) ImportVerifiedUsers(w http.ResponseWriter, r *http.Request) {
	emails, err := extractImportedEmails(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_import", err.Error())
		return
	}
	if len(emails) == 0 {
		writeError(w, http.StatusBadRequest, "no_emails", "No email addresses found in import")
		return
	}

	result, err := h.Store.BulkVerifyUsers(r.Context(), emails)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "import_failed", "Failed to import verified users")
		return
	}

	for _, user := range result.NewlyVerifiedUsers {
		h.sendVerificationNotificationAsync(user)
	}

	writeJSON(w, http.StatusOK, result)
}

func extractImportedEmails(r *http.Request) ([]string, error) {
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			return nil, err
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			return nil, err
		}
		defer file.Close()
		return parseEmailsFromReader(file)
	}

	var req struct {
		Emails []string `json:"emails"`
		CSV    string   `json:"csv"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, err
	}

	if len(req.Emails) > 0 {
		return req.Emails, nil
	}

	return parseEmailsFromReader(strings.NewReader(req.CSV))
}

func parseEmailsFromReader(reader io.Reader) ([]string, error) {
	payload, err := io.ReadAll(io.LimitReader(reader, 10<<20))
	if err != nil {
		return nil, err
	}

	content := string(payload)
	if strings.TrimSpace(content) == "" {
		return []string{}, nil
	}

	csvReader := csv.NewReader(strings.NewReader(content))
	csvReader.FieldsPerRecord = -1
	if strings.Count(content, ";") > strings.Count(content, ",") {
		csvReader.Comma = ';'
	}

	var emails []string
	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		for _, field := range record {
			candidate := strings.TrimSpace(field)
			if strings.Contains(candidate, "@") {
				emails = append(emails, candidate)
				break
			}
		}
	}

	return emails, nil
}

func (h *UserHandler) sendVerificationNotificationAsync(user domain.Customer) {
	if user.WorkOSUserID == "" {
		return
	}

	go func() {
		if err := h.sendVerificationNotification(user); err != nil {
			slog.Warn("user_verification_email_failed", "user_id", user.ID, "email", user.Email, "error", err.Error())
		}
	}()
}

func (h *UserHandler) sendVerificationNotification(user domain.Customer) error {
	if h.EmailService == nil {
		return nil
	}

	displayName := strings.TrimSpace(user.Name)
	if displayName == "" {
		displayName = user.Email
	}

	subject := "Ihr EHALP-Konto wurde freigeschaltet"
	textBody := strings.Join([]string{
		"Hallo " + displayName + ",",
		"",
		"Ihr Konto wurde von einem Administrator freigeschaltet.",
		"Sie koennen sich jetzt anmelden und Materialanfragen stellen.",
		"",
		"Viele Gruesse",
		"EHALP",
	}, "\n")
	htmlBody := strings.Join([]string{
		"<p>Hallo " + displayName + ",</p>",
		"<p>Ihr Konto wurde von einem Administrator freigeschaltet.</p>",
		"<p>Sie koennen sich jetzt anmelden und Materialanfragen stellen.</p>",
		"<p>Viele Gruesse<br>EHALP</p>",
	}, "")

	return h.EmailService.Send(context.Background(), user.Email, subject, htmlBody, textBody)
}
